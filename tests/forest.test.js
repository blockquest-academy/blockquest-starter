import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import * as template from '../scripts/templates/forest.js';
import * as studentForest from '../student/forest.js';
import { LIMITS } from '../games/blockquest/src/engine/config.js';
import { createGame, startGame, updateGame, restartGame, setForge, setForest, removeForest, enterForest, leaveForest, updateTreantPhase } from '../games/blockquest/src/engine/game.js';
import { FORGE_DEFAULTS } from '../games/blockquest/src/engine/forge.js';
import { FOREST_DEFAULTS, validateForest, helperInside, phaseFor, evaluateForest, checkSays, saysFor, PHASE_ORDER, PHASE_RULE, PHASES, TREANT, PHASE_STATS, lanternsFrom, inLight, lanternLighting } from '../games/blockquest/src/engine/forest.js';
import { canStand, setArea, currentArea, tileAt, FORGE_SITE, spawn, COLS, ROWS, TILE } from '../games/blockquest/src/world/island.js';
import { FOREST_ENTRY, FOREST_EXIT_X, LANTERN_SITES, TREANT_HOME, FOREST_MAP } from '../games/blockquest/src/world/forest.js';
import { forestMissions, evaluateForestMission, freshForestEvidence, forestState } from '../games/blockquest/src/ui/forest-missions.js';
import { parseCurrentLesson, LESSONS } from '../games/blockquest/src/ui/guardian-missions.js';
import { resetLesson } from '../scripts/reset-lesson.js';

const config = Object.fromEntries(Object.entries(LIMITS).map(([k, v]) => [k, v[2]]));
const templateSource = await readFile(new URL('../scripts/templates/forest.js', import.meta.url), 'utf8');
const solvedPhase = health => health > 60 ? 'calm' : health > 30 ? 'angry' : 'giant';
const solvedSource = 'function isDanger(health) {\n  return health <= 30;\n}\nexport function treantPhase(health) {\n  if (health > 60) { return "calm"; } else if (isDanger(health)) { return "giant"; } else { return "angry"; }\n}\n';
function forest(raw = FOREST_DEFAULTS, { inside = true } = {}) {
  const g = createGame(config);
  setForge(g, FORGE_DEFAULTS); g.weaponsReceived = true; g.weapon = 'hammer';
  setForest(g, raw); startGame(g);
  if (inside) enterForest(g, { quiet: true });
  return g;
}
function advance(g, input, seconds) { for (let t = 0; t < seconds - 0.0001; t += 1 / 60) updateGame(g, input, 1 / 60); }
const hit = g => { g.pulseCooldown = 0; updateGame(g, { pulse: true }, 1 / 60); };
test.afterEach(() => setArea('island'));

test('заготовка леса: три яркости по формуле размер × 20 + 10, без предупреждений; student/forest.js совпадает', () => {
  assert.deepEqual(Object.keys(template).sort(), Object.keys(FOREST_DEFAULTS).sort());
  assert.deepEqual(validateForest(template).settings, { lanternSmall: 50, lanternMedium: 90, lanternBig: 130 });
  assert.deepEqual(validateForest(template).warnings, []);
  assert.deepEqual(Object.keys({ ...studentForest }).sort(), Object.keys(FOREST_DEFAULTS).sort(), 'в student/forest.js те же три имени, значения — свои');
  assert.match(templateSource, /ФАЗЫ ДРЕВНЯ/);
  assert.equal(evaluateForest(template, templateSource).glow, null);
});
test('яркость фонаря — число: текст и пропавший export останавливают игру, дробь и предел — мягко', () => {
  const text = validateForest({ ...FOREST_DEFAULTS, lanternBig: '130' });
  assert.equal(text.settings.lanternBig, 130); assert.match(text.errors[0].text, /текст "130".*убери кавычки/);
  const missing = validateForest({ lanternSmall: 50, lanternMedium: 90 });
  assert.equal(missing.errors[0].key, 'lanternBig'); assert.match(missing.errors[0].text, /игра не видит это имя/);
  const soft = validateForest({ ...FOREST_DEFAULTS, lanternSmall: 50.4, lanternBig: 5000 });
  assert.deepEqual(soft.errors, []); assert.equal(soft.settings.lanternBig, 1000); assert.equal(soft.warnings.length, 2);
});
test('фазы: граница 61/60 и 31/30, таблица с ✘ и скрытое число ловят подгон', () => {
  assert.deepEqual([100, 61, 60, 31, 30, 1].map(PHASE_RULE), ['calm', 'calm', 'angry', 'angry', 'giant', 'giant']);
  assert.equal(evaluateForest({ treantPhase: solvedPhase }, solvedSource).phase.status, 'passed');
  const ge = evaluateForest({ treantPhase: h => h >= 60 ? 'calm' : h > 30 ? 'angry' : 'giant' }, '').phase;
  assert.equal(ge.status, 'failed'); assert.match(ge.message, /treantPhase\(60\): жду "angry", получил "calm"/);
  const two = evaluateForest({ treantPhase: h => h > 60 ? 'calm' : 'angry' }, '').phase;
  assert.equal(two.status, 'failed'); assert.match(two.message, /treantPhase\(30\): жду "giant", получил "angry"/);
  const table = Object.fromEntries(PHASE_ORDER.cases.map(c => [c.args[0], c.expected]));
  const faked = evaluateForest({ treantPhase: h => table[h] }, '').phase;
  assert.equal(faked.status, 'failed'); assert.match(faked.message, /Проверка на другом числе/);
  const none = evaluateForest({ treantPhase: () => {} }, '').phase;
  assert.equal(none.status, 'failed'); assert.match(none.message, /где return/);
  const missing = evaluateForest({}, 'function treantPhase(health) { return "calm"; }').phase;
  assert.equal(missing.status, 'missing'); assert.match(missing.message, /нужен export перед function/);
  assert.match(evaluateForest({}, '').phase.message, /student\/forest\.js/);
  assert.match(evaluateForest({ treantPhas: solvedPhase }, '').phase.message, /treantPhas/);
});
test('фаза в игре: без функции Древень спокоен; неверное слово, «ничего» и ошибка объясняются', () => {
  assert.deepEqual(phaseFor({}, 10), { phase: 'calm', warning: '' });
  assert.deepEqual(phaseFor({ treantPhase: solvedPhase }, 10), { phase: 'giant', warning: '' });
  assert.match(phaseFor({ treantPhase: () => 'mad' }, 10).warning, /вернула "mad".*только "calm", "angry" или "giant"/);
  assert.match(phaseFor({ treantPhase: () => {} }, 10).warning, /ничего не вернула — где return/);
  assert.match(phaseFor({ treantPhase: () => helth }, 10).warning, /имя helth не найдено/);
});
test('помощник внутри: своя функция без export, вызванная внутри treantPhase', () => {
  assert.equal(helperInside(solvedSource), 'isDanger');
  assert.equal(helperInside('function isDanger(h) { return h <= 30; }\nexport function treantPhase(health) { return "calm"; }'), null);
  assert.equal(helperInside('function isDanger(h) { return h <= 30; }'), null);
  assert.equal(helperInside('export function treantPhase(health) { return "calm"; }\nfunction low(h) { return h < 10; }\n'), null);
  assert.equal(helperInside('export function treantPhase(health) {\n  if (low(health)) { return "giant"; }\n  return "calm";\n}\nfunction low(h) { return h < 10; }'), 'low');
});
test('слова Древня: текст на каждую фазу, иначе слова по умолчанию', () => {
  assert.equal(checkSays({}).status, 'missing');
  assert.match(checkSays({}, 'function treantSays(phase) { return "x"; }').message, /нужен export/);
  const partial = checkSays({ treantSays: phase => phase === 'giant' ? 'Я ВЫРОС!' : undefined });
  assert.equal(partial.status, 'failed'); assert.match(partial.message, /treantSays\("calm"\): функция ничего не вернула/);
  assert.equal(checkSays({ treantSays: phase => `Фаза ${phase}` }).status, 'passed');
  assert.equal(saysFor({ treantSays: () => 'Тише' }, 'calm'), 'Тише');
  assert.equal(saysFor({ treantSays: () => 5 }, 'angry'), 'Ты меня разозлил!');
  assert.equal(saysFor({}, 'giant'), 'Я РАСТУ!');
});
test('лес проходим: от входа до Древня и каждого фонаря есть путь', () => {
  setArea('forest');
  assert.equal(FOREST_MAP.length, ROWS); assert.ok(FOREST_MAP.every(row => row.length === COLS));
  assert.ok(canStand(FOREST_ENTRY.x, FOREST_ENTRY.y)); assert.ok(canStand(TREANT_HOME.x, TREANT_HOME.y));
  const step = 8, key = (x, y) => `${Math.round(x)},${Math.round(y)}`;
  const seen = new Set([key(FOREST_ENTRY.x, FOREST_ENTRY.y)]), queue = [FOREST_ENTRY];
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
    const x = queue[i].x + dx, y = queue[i].y + dy;
    if (x < 0 || y < 0 || x >= COLS * TILE || y >= ROWS * TILE || seen.has(key(x, y)) || !canStand(x, y)) continue;
    seen.add(key(x, y)); queue.push({ x, y });
  }
  const reachable = (x, y) => [...seen].some(k => { const [sx, sy] = k.split(',').map(Number); return Math.hypot(sx - x, sy - y) < 30; });
  assert.ok(reachable(TREANT_HOME.x, TREANT_HOME.y), 'Древень недостижим');
  for (const l of Object.values(LANTERN_SITES)) assert.ok(reachable(l.x, l.y + 20), `фонарь ${l.name} недостижим`);
  assert.ok(reachable(FOREST_EXIT_X + 4, FOREST_ENTRY.y), 'выход недостижим');
  assert.equal(tileAt(0, 10), '='); setArea('island'); assert.equal(tileAt(0, 10), '#');
});
test('сохранение леса открывает ворота, зажигает фонари числами из файла и убирает паука', () => {
  const g = forest(undefined, { inside: false });
  assert.equal(g.gateOpen, true); assert.equal(g.spider, null); assert.equal(g.area, 'island');
  assert.deepEqual(g.lanterns.map(l => l.radius), [50, 90, 130]);
  assert.equal(g.treant.phase, 'calm'); assert.equal(g.treant.health, 140);
  const dim = forest({ ...FOREST_DEFAULTS, lanternBig: 0 }, { inside: false });
  assert.deepEqual(dim.lanterns.map(l => l.radius), [50, 90, 0]);
  assert.equal(inLight(lanternsFrom({ lanternSmall: 50, lanternMedium: 90, lanternBig: 0 }), { x: LANTERN_SITES.lanternBig.x + 10, y: LANTERN_SITES.lanternBig.y }), false);
  assert.equal(inLight(dim.lanterns, { x: LANTERN_SITES.lanternSmall.x + 30, y: LANTERN_SITES.lanternSmall.y }), true);
  setForge(dim, FORGE_DEFAULTS); assert.equal(dim.spider, null, 'перековка в уроке 04 не возвращает паука');
  removeForest(dim); assert.equal(dim.gateOpen, false); assert.ok(dim.spider, 'без леса паук снова у ворот'); assert.equal(dim.treant, null);
});
test('ворота ведут в лес, тропа на запад — обратно на остров; новая попытка из леса начинается у входа', () => {
  const g = forest(undefined, { inside: false });
  g.player.x = FORGE_SITE.gate.x - 60; g.player.y = FORGE_SITE.gate.y + 6;
  advance(g, { right: true }, 1.2);
  assert.equal(g.area, 'forest'); assert.equal(currentArea(), 'forest');
  assert.ok(Math.abs(g.player.y - FOREST_ENTRY.y) < 1 && g.player.x >= FOREST_ENTRY.x);
  assert.ok(g.events.includes('forest-enter')); assert.equal(g.forestVisits, 1);
  assert.ok(g.texts.some(t => /фонарей/.test(t.text)));
  const again = restartGame(g);
  assert.equal(again.area, 'forest'); assert.deepEqual([again.player.x, again.player.y], [FOREST_ENTRY.x, FOREST_ENTRY.y]); assert.equal(again.status, 'ready');
  g.player.x = FOREST_ENTRY.x; g.events = [];
  advance(g, { left: true }, 1);
  assert.equal(g.area, 'island'); assert.ok(g.events.includes('forest-leave'));
  assert.ok(g.player.x < FORGE_SITE.gate.x - 36, 'герой стоит перед воротами, а не внутри них');
  assert.equal(canStand(g.player.x, g.player.y), true);
  const closed = createGame(config); setForge(closed, FORGE_DEFAULTS); startGame(closed);
  closed.player.x = FORGE_SITE.gate.x - 60; closed.player.y = FORGE_SITE.gate.y + 6; advance(closed, { right: true }, 1.2);
  assert.equal(closed.area, 'island', 'в уроке 03 ворота закрыты');
});
test('в лесу остров замирает: кристаллы, слизни и хранитель не трогаются', () => {
  const g = forest();
  const before = JSON.stringify([g.monsters.map(m => [m.x, m.y]), g.crystals.filter(c => c.taken).length]);
  advance(g, { right: true }, 1);
  assert.equal(JSON.stringify([g.monsters.map(m => [m.x, m.y]), g.crystals.filter(c => c.taken).length]), before);
  assert.equal(g.collected, 0);
});
test('удар по Древню отнимает урон оружия и спрашивает фазу; молотом «злой» проскакивает, мечом виден каждый', () => {
  const g = forest({ ...FOREST_DEFAULTS, treantPhase: solvedPhase });
  g.player.x = g.treant.x - 50; g.player.y = g.treant.y;
  hit(g); assert.equal(g.treant.health, 102); assert.equal(g.treant.phase, 'calm');
  hit(g); assert.equal(g.treant.health, 64); assert.equal(g.treant.phase, 'calm');
  hit(g); assert.equal(g.treant.health, 26); assert.equal(g.treant.phase, 'giant');
  const changes = g.events.filter(e => e.type === 'treant-phase');
  assert.deepEqual(changes.map(e => [e.from, e.to, e.health]), [['calm', 'giant', 26]]);
  assert.ok(g.texts.some(t => /ВЕЛИКАН/.test(t.text)));
  assert.equal(g.treant.says, 'Я РАСТУ!');
  const s = forest({ ...FOREST_DEFAULTS, treantPhase: solvedPhase }); s.weapon = 'sword';
  s.player.x = s.treant.x - 50; s.player.y = s.treant.y;
  const seen = [];
  for (let i = 0; i < 20 && !s.treant.defeated; i++) { hit(s); seen.push(s.treant.phase); s.player.x = s.treant.x - 50; s.player.y = s.treant.y; }
  assert.deepEqual([...new Set(seen)], ['calm', 'angry', 'giant']);
  assert.equal(s.treant.defeated, true); assert.equal(s.score, TREANT.reward); assert.ok(s.forestGlow > 0.9, 'лес светлеет после победы');
  assert.ok(s.events.some(e => e.type === 'treant-defeated' && e.hits === 14));
  advance(s, {}, TREANT.respawn + 0.5);
  assert.equal(s.treant.defeated, false); assert.equal(s.treant.health, 140); assert.equal(s.treant.phase, 'calm');
});
test('без функции Древень не меняется; неверный ответ даёт предупреждение и спокойную фазу', () => {
  const g = forest();
  g.player.x = g.treant.x - 50; g.player.y = g.treant.y;
  hit(g); hit(g); hit(g); assert.equal(g.treant.health, 26); assert.equal(g.treant.phase, 'calm'); assert.equal(g.phaseWarning, '');
  const bad = forest({ ...FOREST_DEFAULTS, treantPhase: () => 'mad' });
  assert.match(bad.phaseWarning, /"mad"/); assert.equal(bad.treant.phase, 'calm');
  const fixed = forest({ ...FOREST_DEFAULTS, treantPhase: solvedPhase });
  fixed.treant.health = 10; updateTreantPhase(fixed); assert.equal(fixed.treant.phase, 'giant');
});
test('заметив героя, Древень гонится по всему лесу; в круг света не заходит, ждёт у границы и ранит только снаружи', () => {
  const g = forest({ ...FOREST_DEFAULTS, treantPhase: solvedPhase });
  const lantern = g.lanterns[2];
  g.treant.x = lantern.x + 60; g.treant.y = lantern.y; g.treant.home = { x: g.treant.x, y: g.treant.y };
  g.player.x = lantern.x + 20; g.player.y = lantern.y;
  advance(g, {}, 3);
  assert.equal(g.player.health, 100, 'в круге света удара нет');
  assert.equal(lanternLighting(g.lanterns, g.treant), null, 'Древень вышел из круга');
  assert.ok(Math.hypot(g.treant.x - lantern.x, g.treant.y - lantern.y) >= lantern.radius + 100, 'и отошёл дальше любого оружия');
  assert.equal(g.treant.waiting, true); assert.equal(g.treant.chasing, true, 'заметил героя и ждёт, когда тот выйдет из круга');
  // Из света не бьют: даже вплотную удар не проходит, игра подсказывает выйти из круга.
  const cheat = forest({ ...FOREST_DEFAULTS, treantPhase: solvedPhase }); const big = cheat.lanterns[2];
  cheat.player.x = big.x + 100; cheat.player.y = big.y; cheat.treant.x = big.x + 150; cheat.treant.y = big.y; cheat.weapon = 'hammer';
  cheat.pulseCooldown = 0; updateGame(cheat, { pulse: true }, 1 / 60);
  assert.equal(cheat.treant.health, 140); assert.ok(cheat.texts.some(x => /Выйди из круга/.test(x.text)));
  const dark = forest({ ...FOREST_DEFAULTS, treantPhase: solvedPhase });
  dark.player.x = dark.treant.x - 70; dark.player.y = dark.treant.y; dark.player.invincible = 0;
  advance(dark, {}, 2.5);
  assert.equal(dark.treant.chasing, true); assert.ok(dark.player.health < 100, 'Древень достал героя вне света');
  assert.equal((100 - dark.player.health) % TREANT.damage, 0, 'урон спокойного Древня — по 16');
  // Убежать нельзя: герой ушёл далеко на запад, Древень всё ещё идёт за ним и сокращает дистанцию.
  const run = forest({ ...FOREST_DEFAULTS, treantPhase: solvedPhase });
  run.player.x = run.treant.x - 100; run.player.y = run.treant.y; advance(run, {}, 0.2);
  assert.equal(run.treant.chasing, true);
  run.player.x = 120; run.player.y = run.treant.y; const before = Math.hypot(run.player.x - run.treant.x, run.player.y - run.treant.y);
  advance(run, {}, 2);
  assert.equal(run.treant.chasing, true); assert.ok(Math.hypot(run.player.x - run.treant.x, run.player.y - run.treant.y) < before - 150, 'Древень догоняет через весь лес');
  // Злой Древень быстрее героя: по скорости героя, а не слизней.
  assert.ok(PHASE_STATS.angry.chase > 1 && PHASE_STATS.calm.chase < 1);
  const calm = forest(); calm.treant.chasing = true; calm.player.x = 120; calm.player.y = calm.treant.y; const cx = calm.treant.x; advance(calm, {}, 1);
  assert.ok(Math.abs(cx - calm.treant.x) > config.playerSpeed * 60 * 0.6, 'погоня не зависит от monsterSpeed');
  const giant = forest({ ...FOREST_DEFAULTS, treantPhase: () => 'giant' });
  giant.player.x = giant.treant.x - 20; giant.player.y = giant.treant.y; giant.player.invincible = 0;
  updateGame(giant, {}, 1 / 60);
  assert.equal(giant.player.health, 100 - Math.round(TREANT.damage * PHASE_STATS.giant.damage));
});
test('маршруты урока 04: фонари, фазы, помощник', () => {
  const fresh = freshForestEvidence();
  const recipe = 'function glow(size) { return size * 20 + 10; }\nexport const lanternSmall = glow(2);\nexport const lanternMedium = glow(4);\nexport const lanternBig = glow(6);\n';
  const none = forestState(evaluateForest(template, templateSource));
  assert.deepEqual(evaluateForestMission('easy', none, fresh), { configured: false, tested: false });
  const lit = forestState(evaluateForest(template, recipe));
  assert.deepEqual(evaluateForestMission('easy', lit, fresh), { configured: true, tested: false });
  assert.equal(evaluateForestMission('easy', lit, { ...fresh, entered: true }).tested, true);
  assert.equal(evaluateForestMission('easy', lit, { ...fresh, entered: true }, ['warning']).tested, false);
  assert.equal(evaluateForestMission('normal', lit, fresh).configured, false);
  const half = forestState(evaluateForest({ ...template, treantPhase: h => h > 60 ? 'calm' : 'angry' }, recipe));
  assert.deepEqual(evaluateForestMission('normal', half, fresh), { configured: true, tested: false });
  const done = forestState(evaluateForest({ ...template, treantPhase: solvedPhase }, recipe + solvedSource));
  assert.equal(evaluateForestMission('normal', done, fresh).tested, true);
  assert.deepEqual(evaluateForestMission('challenge', done, fresh), { configured: true, tested: true });
  const noHelper = forestState(evaluateForest({ ...template, treantPhase: solvedPhase }, recipe));
  assert.equal(evaluateForestMission('challenge', noHelper, fresh).configured, false);
  assert.deepEqual(Object.keys(forestMissions), ['easy', 'normal', 'challenge']);
  assert.ok(LESSONS.includes(4)); assert.equal(parseCurrentLesson('Сейчас изучаем [урок 04 — Лес](lesson-04.md).'), 4);
});
test('сброс леса возвращает заготовку и сохраняет копию в lesson-04; полный сброс включает forest.js', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'blockquest-forest-reset-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'student')); await mkdir(resolve(root, 'scripts/templates'), { recursive: true });
  for (const name of ['config', 'rules', 'forest']) {
    await writeFile(resolve(root, `scripts/templates/${name}.js`), `template ${name}`);
    await writeFile(resolve(root, `student/${name}.js`), `my ${name}`);
  }
  const backup = await resetLesson(root, { confirmed: true, exercise: 'forest' });
  assert.match(backup, /lesson-04-/);
  assert.equal(await readFile(resolve(root, 'student/forest.js'), 'utf8'), 'template forest');
  assert.equal(await readFile(resolve(root, 'student/config.js'), 'utf8'), 'my config');
  assert.equal(await readFile(resolve(backup, 'forest.js'), 'utf8'), 'my forest');
  await writeFile(resolve(root, 'student/forest.js'), 'again');
  await resetLesson(root, { confirmed: true });
  assert.equal(await readFile(resolve(root, 'student/forest.js'), 'utf8'), 'template forest');
});
