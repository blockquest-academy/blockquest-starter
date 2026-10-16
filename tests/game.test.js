import test from 'node:test';
import assert from 'node:assert/strict';
import * as defaults from '../student/config.js';
import { validateConfig, LIMITS } from '../games/blockquest/src/engine/config.js';
import { createGame, startGame, togglePause, updateGame, collectCrystal, damagePlayer, restartGame, applyConfig } from '../games/blockquest/src/engine/game.js';
import { canStand, moveBody, WIDTH, HEIGHT, COLS, ROWS, tileAt, spawn, portal, obstacles, crystalSpawns, monsterSpawns, beetleSpawns } from '../games/blockquest/src/world/island.js';

const config = Object.fromEntries(Object.entries(LIMITS).map(([k,v]) => [k,v[2]]));
function playing(extra = {}) { const g = createGame({ ...config, ...extra }); startGame(g); return g; }
function advance(g, input, seconds) { for (let t = 0; t < seconds - 0.0001; t += 1/60) updateGame(g, input, 1/60); }

test('старт: здоровье, очки, кристаллы, монстры и состояние', () => {
  const g = createGame(config);
  assert.equal(g.status, 'ready'); assert.equal(g.score, 0); assert.equal(g.collected, 0);
  assert.equal(g.player.health, 100); assert.equal(g.crystals.length, 22); assert.equal(g.monsters.length, 6);
  assert.equal(g.monsters.filter(m => m.type === 'beetle').length, 1);
  assert.deepEqual(g.warnings, []); assert.ok(canStand(g.player.x, g.player.y));
});
test('готовый ученический файл содержит пять допустимых чисел', () => {
  assert.deepEqual(Object.keys(defaults).sort(), Object.keys(LIMITS).sort());
  assert.deepEqual(validateConfig(defaults).warnings, []);
});
test('до начала и на паузе мир не движется', () => {
  const g = createGame(config); updateGame(g, {right:true}, 0.05); assert.equal(g.player.x, spawn.x);
  startGame(g); togglePause(g); updateGame(g, {right:true}, 0.05);
  assert.equal(g.time, 0); assert.equal(g.status, 'paused');
  togglePause(g); assert.equal(g.status, 'playing');
});
test('playerSpeed 3 → 6 удваивает пройденное расстояние', () => {
  const a = playing({playerSpeed:3}), b = playing({playerSpeed:6});
  advance(a, {right:true}, .2); advance(b, {right:true}, .2);
  assert.ok(Math.abs((b.player.x-spawn.x) / (a.player.x-spawn.x) - 2) < .001);
});
test('движение по диагонали нормализовано', () => {
  const a = playing(), b = playing(); advance(a,{right:true},.1); advance(b,{right:true,down:true},.1);
  assert.ok(Math.abs(Math.hypot(b.player.x-spawn.x,b.player.y-spawn.y) - (a.player.x-spawn.x)) < .001);
});
test('движение не зависит от частоты кадров', () => {
  const a = playing(), b = playing();
  for(let i=0;i<12;i++) updateGame(a,{right:true},1/60);
  for(let i=0;i<6;i++) updateGame(b,{right:true},1/30);
  assert.ok(Math.abs(a.player.x-b.player.x)<.001);
});
test('большой delta ограничен: герой не телепортируется', () => {
  const g=playing(); updateGame(g,{right:true},99); assert.ok(g.player.x-spawn.x<=9.01);
});
test('граница воды и деревья блокируют движение, включая рывок', () => {
  assert.equal(canStand(-20,20),false); assert.equal(canStand(WIDTH+20,HEIGHT),false);
  const tree=obstacles.find(o=>o.kind==='tree'); assert.equal(canStand(tree.x,tree.y),false);
  const body={x:tree.x-40,y:tree.y,radius:9}; moveBody(body,100,0); assert.ok(body.x<tree.x-20);
  const shore={x:48,y:304,radius:9}; assert.ok(canStand(shore.x,shore.y)); moveBody(shore,-500,0); assert.ok(shore.x>=41);
});
test('вся карта прямоугольная, объекты на суше и доступны из лагеря', () => {
  for(let y=0;y<ROWS;y++) { for(let x=0;x<COLS;x++) assert.ok(['#','.','='].includes(tileAt(x,y))); assert.equal(tileAt(COLS,y),'#'); }
  const step=8, seen=new Set(), queue=[{...spawn}];
  seen.add(`${spawn.x},${spawn.y}`);
  for(let i=0;i<queue.length;i++) for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step]]) {
    const x=queue[i].x+dx,y=queue[i].y+dy,key=`${x},${y}`;
    if(!seen.has(key)&&canStand(x,y)){seen.add(key);queue.push({x,y});}
  }
  for(const p of [...crystalSpawns,...monsterSpawns,...beetleSpawns,portal]) {
    assert.ok(canStand(p.x,p.y),`Объект на препятствии ${JSON.stringify(p)}`);
    assert.ok(queue.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<16),`Объект недоступен ${JSON.stringify(p)}`);
  }
});
test('кристалл начисляет очки только один раз', () => {
  const g=playing(); collectCrystal(g,g.crystals[0]); collectCrystal(g,g.crystals[0]);
  assert.equal(g.collected,1); assert.equal(g.score,10); assert.equal(g.crystals[0].taken,true);
});
test('реальное движение подбирает кристалл', () => {
  const g=playing(); advance(g,{right:true},.15); assert.equal(g.collected,1); assert.equal(g.score,10);
});
test('crystalPoints 10 → 20 меняет награду, пять кристаллов дают 100', () => {
  const a=playing(),b=playing({crystalPoints:20});
  collectCrystal(a,a.crystals[0]); for(const c of b.crystals.slice(0,5)) collectCrystal(b,c);
  assert.equal(a.score,10); assert.equal(b.score,100);
});
test('playerHealth изменяет стартовое здоровье и запас после урона', () => {
  const g=playing({playerHealth:160}); damagePlayer(g,20); assert.equal(g.player.health,140);
});
test('урон: неуязвимость, её окончание, поражение и нижняя граница', () => {
  const g=playing({playerHealth:40}); damagePlayer(g,20); damagePlayer(g,20); assert.equal(g.player.health,20);
  advance(g,{},1.3); damagePlayer(g,99); assert.equal(g.player.health,0); assert.equal(g.status,'lost');
  advance(g,{right:true},.1); assert.equal(g.player.health,0);
});
test('касание слизня наносит урон', () => {
  const g=playing({monsterSpeed:0}); g.monsters[0].x=g.player.x;g.monsters[0].y=g.player.y;
  updateGame(g,{},1/60); assert.equal(g.player.health,80);
});
test('monsterSpeed 0 останавливает слизней; ускорение меняет путь', () => {
  const frozen=playing({monsterSpeed:0}); const initial={...frozen.monsters[0]}; advance(frozen,{},.3);
  assert.equal(frozen.monsters[0].x,initial.x);assert.equal(frozen.monsters[0].y,initial.y);
  const a=playing({monsterSpeed:1}),b=playing({monsterSpeed:2});
  a.player.x=b.player.x=336;a.player.y=b.player.y=240;
  advance(a,{},.2);advance(b,{},.2);
  const dist=g=>Math.hypot(g.monsters[0].x-monsterSpawns[0].x,g.monsters[0].y-monsterSpawns[0].y);
  assert.ok(dist(b)>dist(a)*1.8);
});
test('импульс оглушает слизня, повтор ограничен перезарядкой', () => {
  const g=playing();g.monsters[0].x=g.player.x+40;g.monsters[0].y=g.player.y;
  updateGame(g,{pulse:true},1/60);assert.ok(g.monsters[0].stun>2);const cooldown=g.pulseCooldown;
  updateGame(g,{pulse:true},1/60);assert.ok(g.pulseCooldown<cooldown);assert.equal(g.player.health,100);
});
test('рывок быстрее ходьбы, защищает от урона и имеет перезарядку', () => {
  const a=playing(),b=playing();updateGame(a,{right:true},.05);updateGame(b,{right:true,dash:true},.05);
  assert.ok(b.player.x-spawn.x>(a.player.x-spawn.x)*2);damagePlayer(b,20);assert.equal(b.player.health,100);
  assert.ok(b.dashCooldown>0);
});
test('crystalsToWin открывает портал; победа только при возвращении', () => {
  const g=playing({crystalsToWin:2}); collectCrystal(g,g.crystals[0]);collectCrystal(g,g.crystals[1]);
  updateGame(g,{},1/60);assert.equal(g.status,'playing');assert.ok(g.events.includes('portal'));
  g.player.x=portal.x;g.player.y=portal.y;updateGame(g,{},1/60);assert.equal(g.status,'won');
  assert.ok(g.events.includes('won'));
});
test('портал не выпускает без цели', () => {
  const g=playing();g.player.x=portal.x;g.player.y=portal.y;updateGame(g,{},1/60);assert.equal(g.status,'playing');
});
test('победа достижима при максимальной цели 22', () => {
  const g=playing({crystalsToWin:22}); for(const c of g.crystals)collectCrystal(g,c);
  g.player.x=portal.x;g.player.y=portal.y;updateGame(g,{},1/60);assert.equal(g.status,'won');assert.equal(g.score,220);
});
test('после поражения и победы очки не меняются', () => {
  for(const status of ['lost','won']) {const g=playing();g.status=status;collectCrystal(g,g.crystals[0]);assert.equal(g.score,0);}
});
test('перезапуск сбрасывает мир и сохраняет ученические настройки', () => {
  const g=playing({crystalPoints:25});collectCrystal(g,g.crystals[0]);damagePlayer(g,20);g.status='lost';
  const reset=restartGame(g);assert.equal(reset.status,'ready');assert.equal(reset.score,0);assert.equal(reset.player.health,100);
  assert.equal(reset.config.crystalPoints,25);assert.ok(reset.crystals.every(c=>!c.taken));assert.equal(reset.time,0);
});
test('валидация подсказывает ошибки, NaN, Infinity, строки и отсутствующие exports', () => {
  const {config:c,warnings}=validateConfig({playerSpeed:'6',playerHealth:NaN,monsterSpeed:Infinity,crystalPoints:null});
  assert.deepEqual(c,config);assert.equal(warnings.length,5);
});
test('валидация диапазонов, целые цели, дробная скорость, остановка монстров', () => {
  const {config:c,warnings}=validateConfig({playerSpeed:2.5,playerHealth:0,monsterSpeed:0,crystalPoints:1e9,crystalsToWin:7.2});
  assert.equal(c.playerSpeed,2.5);assert.equal(c.playerHealth,1);assert.equal(c.monsterSpeed,0);assert.equal(c.crystalPoints,1_000_000);assert.equal(c.crystalsToWin,7);assert.equal(warnings.length,3);
});

test('скорости 15 и 50 реально различаются и не ограничиваются рекомендацией 8', () => {
  const a=playing({playerSpeed:15}),b=playing({playerSpeed:50});
  updateGame(a,{right:true},.02);updateGame(b,{right:true},.02);
  assert.ok(Math.abs((a.player.x-spawn.x)-18)<.001);assert.ok(Math.abs((b.player.x-spawn.x)-60)<.001);
  assert.equal(a.warnings.length,0);assert.equal(b.warnings.length,0);
});
test('высокая скорость не пропускает кристаллы между кадрами', () => {
  const g=playing({playerSpeed:50});updateGame(g,{right:true},.05);
  assert.ok(g.collected>=2);assert.equal(g.score,g.collected*10);
});
test('высокая скорость не позволяет проскочить слизня без урона', () => {
  const g=playing({playerSpeed:50,monsterSpeed:0});
  g.monsters[0].x=240;g.monsters[0].y=306;updateGame(g,{right:true},.05);
  assert.equal(g.player.health,80);
});
test('экстремальные конечные значения и перемещения ограничены безопасно', () => {
  const g=playing({playerSpeed:1e300,monsterSpeed:1e300,playerHealth:1e300,crystalPoints:1e300,crystalsToWin:999});
  assert.equal(g.config.playerSpeed,100);assert.equal(g.config.monsterSpeed,100);assert.equal(g.config.crystalsToWin,22);
  for(let i=0;i<20;i++)updateGame(g,{right:true,down:true,dash:true,pulse:true},.05);
  assert.ok(Number.isFinite(g.player.x)&&Number.isFinite(g.player.health));assert.ok(canStand(g.player.x,g.player.y));
  const body={...spawn,radius:9};moveBody(body,1e300,1e300);assert.ok(canStand(body.x,body.y));
  const before={...body};moveBody(body,NaN,Infinity);assert.deepEqual(body,before);
  const time=g.time;updateGame(g,{},NaN);assert.equal(g.time,time);
});
test('живая настройка сохраняет позицию, время, кристаллы и заработанные очки', () => {
  const g=playing();collectCrystal(g,g.crystals[0]);advance(g,{right:true},.1);
  const before={x:g.player.x,time:g.time,score:g.score,collected:g.collected};
  const changes=applyConfig(g,{...config,playerSpeed:6,monsterSpeed:0,crystalPoints:20});
  assert.deepEqual(changes,['playerSpeed','monsterSpeed','crystalPoints']);
  assert.deepEqual({x:g.player.x,time:g.time,score:g.score,collected:g.collected},before);
  collectCrystal(g,g.crystals[1]);assert.equal(g.score,before.score+20);
});
test('изменение здоровья восстанавливает запас один раз, повторное сохранение не лечит', () => {
  const g=playing();damagePlayer(g,20);applyConfig(g,{...config,playerHealth:160});assert.equal(g.player.health,160);
  g.player.invincible=0;damagePlayer(g,20);assert.deepEqual(applyConfig(g,{...config,playerHealth:160}),[]);assert.equal(g.player.health,140);
});
test('новая цель открывает портал в текущей попытке', () => {
  const g=playing();collectCrystal(g,g.crystals[0]);applyConfig(g,{...config,crystalsToWin:1});assert.ok(g.events.includes('portal'));
  g.player.x=portal.x;g.player.y=portal.y;updateGame(g,{},.01);assert.equal(g.status,'won');
});
