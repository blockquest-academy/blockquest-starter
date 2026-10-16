import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, collectCrystal, damagePlayer, applyRule, restartGame } from '../games/blockquest/src/engine/game.js';
import { DEFAULT_CONFIG } from '../games/blockquest/src/engine/config.js';
import { crystalRule as starterRule } from '../scripts/templates/rules.js';

function shieldRule(crystals) { if (crystals >= 3) return 'shield'; }
function healRule(crystals) { if (crystals >= 5) return 'heal'; }
function playing(rule) { const game = createGame(DEFAULT_CONFIG, rule); startGame(game); return game; }
function pick(game, count = 1) { for (let i=0; i<count; i++) collectCrystal(game, game.crystals.find(c => !c.taken)); }
const abilityEvents = game => game.events.filter(event => event?.type === 'shield' || event?.type === 'heal');
function hit(game) { game.player.invincible = 0; damagePlayer(game, 20); }

test('пустое правило оставляет исходную игру полностью играбельной', () => {
  const game = playing(starterRule); pick(game, 15);
  assert.equal(game.collected, 15); assert.equal(game.score, 150);
  assert.equal(game.reward.used, false); assert.equal(game.ruleWarning, '');
});
test('правило получает только общее число crystals при каждом новом кристалле', () => {
  const calls = [];
  const game = playing((...args) => { calls.push(args); });
  pick(game, 4); collectCrystal(game, game.crystals[0]);
  assert.deepEqual(calls, [[1],[2],[3],[4]]);
  assert.equal(starterRule.length, 1);
});
test('условие создаёт видимый щит только на третьем кристалле', () => {
  const game = playing(shieldRule); pick(game, 2);
  assert.equal(game.player.shield, false); assert.equal(game.reward.used, false);
  pick(game); assert.equal(game.player.shield, true);
  assert.deepEqual(game.reward, { used:true, action:'shield', at:3, fromStart:true, count:1 });
  assert.ok(game.texts.some(t => t.text.includes('ЩИТ')));
  assert.deepEqual(abilityEvents(game)[0], {type:'shield',reward:{id:1,action:'shield',at:3,fromStart:true,blocked:false}});
});
test('щит поглощает один удар, даёт передышку и восстанавливается на новом кристалле по условию', () => {
  const game = playing(shieldRule); pick(game, 3); damagePlayer(game, 20);
  assert.equal(game.player.health, 100); assert.equal(game.player.shield, false);
  assert.ok(game.events.some(event => event.type === 'shield-break' && event.rewardId === 1));
  damagePlayer(game, 20); assert.equal(game.player.health, 100);
  hit(game); assert.equal(game.player.health, 80);
  pick(game); assert.equal(game.player.shield, true); assert.equal(game.reward.at, 4);
  assert.equal(game.reward.count, 2); assert.equal(game.player.health, 80);
  hit(game); assert.equal(game.player.health, 80); assert.equal(game.player.shield, false);
});
test('надетый щит не складывается, не обновляется и не создаёт повторных эффектов', () => {
  const game = playing(shieldRule); pick(game, 3);
  const id = game.player.shieldRewardId; pick(game, 4);
  assert.equal(game.player.shieldRewardId, id); assert.equal(game.reward.count, 1);
  assert.equal(abilityEvents(game).length, 1);
  hit(game); hit(game); assert.equal(game.player.health, 80);
  assert.equal(game.player.shield, false);
});
test('пользовательское правило каждого третьего кристалла восстанавливает щит на 6-м и 9-м', () => {
  const game = playing(crystals => { if (crystals % 3 === 0 && crystals > 0) return 'shield'; });
  pick(game, 3); hit(game); pick(game, 2);
  assert.equal(game.collected, 5); assert.equal(game.player.shield, false);
  pick(game); assert.equal(game.player.shield, true); assert.equal(game.reward.at, 6);
  hit(game); pick(game, 2); assert.equal(game.player.shield, false);
  pick(game); assert.equal(game.player.shield, true);
  assert.deepEqual(abilityEvents(game).map(event => event.reward.at), [3,6,9]);
  assert.deepEqual(abilityEvents(game).map(event => event.reward.id), [1,2,3]);
});
test('лечение добавляет до 40 здоровья, не превышает максимум и повторяется на следующих кристаллах', () => {
  for (const [before, after] of [[20,60],[80,100],[100,100]]) {
    const game = playing(healRule); game.player.health = before; pick(game, 4);
    assert.equal(game.player.health, before); pick(game); assert.equal(game.player.health, after);
    assert.equal(game.reward.at, 5); assert.equal(abilityEvents(game)[0].type, 'heal');
    if (before === 100) assert.ok(game.texts.some(t => t.text === 'Здоровье полное'));
    game.player.health = 10; pick(game); assert.equal(game.player.health, 50);
    assert.equal(game.reward.count, 2);
    const count = game.reward.count; collectCrystal(game, game.crystals[5]);
    assert.equal(game.player.health, 50); assert.equal(game.reward.count, count);
  }
});
test('условие каждого третьего кристалла так же управляет повторным лечением', () => {
  const game = playing(crystals => { if (crystals % 3 === 0) return 'heal'; });
  game.player.health = 10; pick(game, 3); assert.equal(game.player.health, 50);
  pick(game, 2); assert.equal(game.player.health, 50);
  pick(game); assert.equal(game.player.health, 90);
  pick(game, 3); assert.equal(game.player.health, 100);
  assert.deepEqual(abilityEvents(game).map(event => event.reward.at), [3,6,9]);
});
test('сохранение правила хранит мир, не выдаёт способность до следующей находки', () => {
  const game = playing(shieldRule); pick(game, 3); hit(game);
  const before = { x:game.player.x, score:game.score, collected:game.collected, time:game.time, count:game.reward.count };
  applyRule(game, healRule);
  assert.equal(game.reward.count, before.count); assert.equal(game.player.shield, false);
  pick(game); assert.equal(game.reward.action, 'shield');
  game.player.health = 20; pick(game); assert.equal(game.reward.action, 'heal');
  assert.equal(game.player.health, 60); assert.equal(game.reward.fromStart, false);
  assert.equal(game.player.x, before.x); assert.equal(game.time, before.time);
  assert.equal(game.collected, before.collected + 2); assert.equal(game.score, before.score + 20);
  const fresh = restartGame(game); startGame(fresh); fresh.player.health = 20; pick(fresh, 5);
  assert.equal(fresh.reward.action, 'heal'); assert.equal(fresh.player.health, 60);
  assert.equal(fresh.reward.fromStart, true); assert.equal(fresh.reward.count, 1);
});
test('смена порога щита и отмена команды работают без жёсткой частоты в движке', () => {
  const game = playing(shieldRule); pick(game, 3); hit(game);
  applyRule(game, crystals => { if (crystals >= 6) return 'shield'; });
  pick(game, 2); assert.equal(game.player.shield, false);
  pick(game); assert.equal(game.player.shield, true);
  hit(game); applyRule(game, starterRule); pick(game);
  assert.equal(game.player.shield, false); assert.equal(game.reward.count, 2);
});
test('изменение условия посреди попытки требует новой попытки для учебной проверки', () => {
  const game = playing(starterRule); pick(game, 2); applyRule(game, shieldRule); pick(game);
  assert.equal(game.player.shield, true); assert.equal(game.reward.fromStart, false);
  const fresh = restartGame(game); startGame(fresh); pick(fresh, 3);
  assert.equal(fresh.reward.fromStart, true);
});
test('события первой способности и её удара не подменяются повторным получением', () => {
  const game = playing(shieldRule); pick(game, 3); hit(game); pick(game);
  const rewards = abilityEvents(game);
  assert.equal(rewards[0].reward.at, 3); assert.equal(rewards[1].reward.at, 4);
  const broken = game.events.find(event => event.type === 'shield-break');
  assert.equal(broken.rewardId, rewards[0].reward.id);
  assert.notEqual(broken.rewardId, rewards[1].reward.id);
});
test('ошибки команды и выполнения объясняются, не ломают сбор и исправляются сохранением', () => {
  for (const rule of [() => 'dragon', () => { throw new Error('typo'); }, () => null, () => Promise.resolve('shield')]) {
    const game = playing(rule); pick(game);
    assert.equal(game.collected, 1); assert.equal(game.score, 10); assert.equal(game.status, 'playing');
    assert.equal(game.reward.used, false); assert.match(game.ruleWarning, /student\/rules.js/);
    applyRule(game, shieldRule); assert.equal(game.ruleWarning, ''); pick(game, 2);
    assert.equal(game.player.shield, true);
  }
  const game = playing(starterRule); applyRule(game, undefined);
  assert.match(game.ruleWarning, /crystalRule/);
});
test('на паузе, до старта, после победы и поражения правило не исполняется', () => {
  let calls = 0; const game = createGame(DEFAULT_CONFIG, () => { calls++; return 'shield'; });
  for (const status of ['ready','paused','won','lost']) { game.status=status; pick(game); }
  assert.equal(calls, 0); assert.equal(game.reward.used, false);
});
