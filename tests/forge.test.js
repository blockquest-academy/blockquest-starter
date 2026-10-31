import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import * as template from '../scripts/templates/forge.js';
import { LIMITS } from '../games/blockquest/src/engine/config.js';
import { createGame, startGame, updateGame, restartGame, setGuardian, setMonsters, setForge, removeForge, selectWeapon, queueTrials, setForgeStatus, smithStrike, startForging, forgePending } from '../games/blockquest/src/engine/game.js';
import { GUARDIAN_DEFAULTS } from '../games/blockquest/src/engine/guardian.js';
import { FORGE_DEFAULTS, WEAPONS, validateForge, ORDERS, EXTRA_ORDERS, runOrder, checkHits, trailingNumber, recipeFunction, evaluateOrders, nearestName, secretTable } from '../games/blockquest/src/engine/forge.js';
import { canStand, tileAt, spawn, setForgeOpen, isForgeOpen, FORGE_SITE } from '../games/blockquest/src/world/island.js';
import { forgeMissions, evaluateForgeMission, freshForgeEvidence, forgeState } from '../games/blockquest/src/ui/forge-missions.js';
import { parseCurrentLesson, LESSONS } from '../games/blockquest/src/ui/guardian-missions.js';
import { SPIDER, SPIDER_HOME, spiderDamage } from '../games/blockquest/src/engine/spider.js';
import { resetLesson } from '../scripts/reset-lesson.js';

const config = Object.fromEntries(Object.entries(LIMITS).map(([k, v]) => [k, v[2]]));
const templateSource = await readFile(new URL('../scripts/templates/forge.js', import.meta.url), 'utf8');
const solved = {
  ...FORGE_DEFAULTS,
  armor: metal => metal * 2, spark: metal => metal * 10, lightning: metal => metal * 2 + 3,
  weaponTitle: name => 'Меч ' + name, healthAfterHit: (health, damage) => health - damage < 0 ? 0 : health - damage,
};
function workshop(raw = FORGE_DEFAULTS, guardian = {}, received = true) {
  const g = createGame(config);
  setGuardian(g, { ...GUARDIAN_DEFAULTS, ...guardian }); setMonsters(g, { monsterHealth: 30 });
  setForge(g, raw); g.weaponsReceived = received; startGame(g);
  for (const m of g.monsters) m.stun = 1e6;
  return g;
}
// Герой стоит у манекена и бьёт, между ударами — откат оружия.
function hitDummy(g, times = 1) {
  for (let k = 0; k < times; k++) {
    g.player.x = 540; g.player.y = 150; g.player.invincible = 10;
    updateGame(g, { pulse: true }, 1 / 60);
    for (let i = 0; i < 60 && g.pulseCooldown > 0; i++) updateGame(g, {}, 1 / 60);
  }
}
test.afterEach(() => setForgeOpen(false));

test('заготовка кузницы: три числа урона без предупреждений, функций пока нет', () => {
  assert.deepEqual(Object.keys(template).sort(), Object.keys(FORGE_DEFAULTS).sort());
  const { settings, warnings, errors } = validateForge(template);
  assert.deepEqual(settings, { swordDamage: 10, axeDamage: 22, hammerDamage: 38 }); assert.deepEqual(warnings, []); assert.deepEqual(errors, []);
  assert.equal(recipeFunction(templateSource), null);
  assert.match(templateSource, /ЗАКАЗЫ КУЗНЕЦА/);
});
test('урон оружия: текст в кавычках и пропавший export — ошибка типа, дробь и предел — мягкое предупреждение', () => {
  const quoted = validateForge({ ...FORGE_DEFAULTS, swordDamage: '10' });
  assert.equal(quoted.settings.swordDamage, 10); assert.match(quoted.errors[0].text, /текст "10" — а здесь нужно число: убери кавычки/);
  const missing = validateForge({ swordDamage: 10, axeDamage: 22 });
  assert.deepEqual(missing.errors.map(e => e.key), ['hammerDamage']); assert.match(missing.errors[0].text, /игра не видит это имя/);
  const clamped = validateForge({ ...FORGE_DEFAULTS, axeDamage: 12.6, hammerDamage: 1e9 });
  assert.deepEqual(clamped.settings, { swordDamage: 10, axeDamage: 13, hammerDamage: 100_000 }); assert.equal(clamped.warnings.length, 2); assert.deepEqual(clamped.errors, []);
});
test('заказ: верная функция проходит, ответ проверяется и на скрытом числе', () => {
  const ok = runOrder(ORDERS.armor, solved, '');
  assert.equal(ok.status, 'passed'); assert.equal(ok.rows.length, 3); assert.ok(ok.rows.every(row => row.ok)); assert.match(ok.message, /щит на стойке/);
  const hidden = runOrder(ORDERS.lightning, { lightning: metal => [5, 7, 9, 23][metal - 1] ?? metal * 2 + 3 }, '');
  assert.equal(hidden.status, 'passed');
  const plus4 = runOrder(ORDERS.lightning, { lightning: metal => metal + 4 }, '');
  assert.equal(plus4.status, 'failed'); assert.equal(plus4.rows[0].ok, true); assert.equal(plus4.rows[1].ok, false); assert.match(plus4.message, /lightning\(2\): жду 7, получил 6/);
  const memorized = runOrder(ORDERS.spark, { spark: metal => metal === 1 ? 10 : metal === 2 ? 20 : 30 }, '');
  assert.equal(memorized.status, 'failed'); assert.match(memorized.message, /Проверка на другом числе — spark\(6\): жду 60, получил 30. Формула должна работать для любого числа/);
  assert.ok(memorized.rows.at(-1).hidden);
});
test('заказ объясняет, чего не хватает: функции нет, опечатка, без export, не функция', () => {
  assert.match(runOrder(ORDERS.armor, {}, '').message, /Жду функцию armor в student\/forge.js: export function armor\(metal\)/);
  assert.match(runOrder(ORDERS.armor, { armr: metal => metal * 2 }, '').message, /Жду функцию armor, а в файле есть armr. Проверь буквы/);
  assert.match(runOrder(ORDERS.armor, {}, 'function armor(metal) {\n  return metal * 2;\n}').message, /есть в файле, но игра её не видит: нужен export перед function/);
  assert.match(runOrder(ORDERS.armor, {}, '// function armor(metal)').message, /Жду функцию armor в student/);
  assert.equal(runOrder(ORDERS.armor, { armor: 42 }, '').status, 'invalid');
  assert.equal(nearestName('armor', ['forge', 'spark']), null); assert.equal(nearestName('lightning', ['lightnng', 'spark']), 'lightnng');
});
test('заказ объясняет неверный ответ: нет return, NaN, текст вместо числа, ошибка внутри функции', () => {
  const noReturn = runOrder(ORDERS.armor, { armor: metal => { metal * 2; } }, '');
  assert.equal(noReturn.rows[0].got, 'ничего'); assert.match(noReturn.message, /armor\(1\): функция ничего не вернула — где return\?/);
  const nan = runOrder(ORDERS.armor, { armor: () => undefined * 2 }, '');
  assert.match(nan.message, /получилось NaN: в вычислении не число/);
  const text = runOrder(ORDERS.armor, { armor: metal => String(metal * 2) }, '');
  assert.match(text.message, /получился текст "2" — а нужно число. Убери кавычки/);
  const thrown = runOrder(ORDERS.armor, { armor: () => { throw new ReferenceError('metl is not defined'); } }, '');
  assert.equal(thrown.status, 'error'); assert.match(thrown.message, /armor\(1\) остановилась с ошибкой: имя metl не найдено. Оно написано в скобках функции\?/);
  const title = runOrder(EXTRA_ORDERS.weaponTitle, { weaponTitle: name => 'Меч' + name }, '');
  assert.match(title.message, /жду "Меч Гром", получил "МечГром"/);
  assert.equal(runOrder(EXTRA_ORDERS.weaponTitle, { weaponTitle: name => 'Меч ' + name + ' ' }, '').status, 'passed');
  assert.equal(runOrder(EXTRA_ORDERS.healthAfterHit, solved, '').status, 'passed');
  assert.equal(runOrder(EXTRA_ORDERS.healthAfterHit, { healthAfterHit: (h, d) => h - d }, '').rows[1].note, 'жду 0, получил -5');
});
test('счёт ударов: число в конце ответа, память снаружи функции, let внутри функции не считает', () => {
  assert.equal(trailingNumber('Удар 3'), 3); assert.equal(trailingNumber(3), 3); assert.equal(trailingNumber('3 удара'), 3); assert.equal(trailingNumber('Ай!'), null); assert.equal(trailingNumber(undefined), null);
  assert.match(checkHits({}, '', []).message, /Жду функцию onHit/);
  const waiting = checkHits({ onHit: () => 1 }, '', []);
  assert.equal(waiting.status, 'waiting'); assert.match(waiting.message, /Ударь манекен три раза/); assert.equal(waiting.rows[0].got, '…');
  assert.equal(checkHits({ onHit: () => 1 }, '', [1]).status, 'waiting');
  const forgetful = checkHits({ onHit: () => 1 }, '', [1, 1]);
  assert.equal(forgetful.status, 'failed'); assert.match(forgetful.message, /удар 2: счётчик не запомнил удар. Коробка hits создаётся заново/);
  assert.match(checkHits({ onHit: () => 'Ай!' }, '', ['Ай!']).message, /в ответе нет числа/);
  assert.match(checkHits({ onHit: () => {} }, '', [undefined]).message, /ничего не вернула/);
  const passed = checkHits({ onHit: () => 1 }, '', ['Удар 1', 'Удар 2', 'Удар 3']);
  assert.equal(passed.status, 'passed'); assert.ok(passed.rows.every(row => row.ok));
  assert.equal(checkHits({ onHit: () => 1 }, '', [1, 2, 3, 4]).status, 'passed');
});
test('рецепт кузнеца: своя функция без export, вызванная трижды; комментарии не считаются', () => {
  const recipe = 'function forge(metal) {\n  return metal * 4 + 2;\n}\nexport const swordDamage = forge(2);\nexport const axeDamage = forge(5);\nexport const hammerDamage = forge(9);';
  assert.deepEqual(recipeFunction(recipe), { name: 'forge', calls: 3 });
  assert.deepEqual(recipeFunction(recipe.replace('forge', 'recipe').replaceAll('forge(', 'recipe(')), { name: 'recipe', calls: 3 });
  assert.equal(recipeFunction('function forge(metal) { return metal; }\nexport const swordDamage = forge(2);\nexport const axeDamage = 22;'), null);
  assert.equal(recipeFunction('// function forge(metal) {}\n// forge(1) forge(2) forge(3)'), null);
  const results = evaluateOrders(solved, '', ['Удар 1']);
  assert.equal(results.armor.status, 'passed'); assert.equal(results.hits.status, 'missing'); assert.equal(results.secret, null);
  assert.deepEqual(secretTable({ secretRecipe: metal => metal * 3 })[4], { input: 5, output: '15' });
});
test('кузница открывает тропу и ставит постройки на пути; без кузницы остров прежний', () => {
  assert.equal(isForgeOpen(), false); assert.equal(tileAt(13, 3), '.'); assert.ok(canStand(FORGE_SITE.hut.x, FORGE_SITE.hut.y - 30));
  const g = workshop();
  assert.equal(isForgeOpen(), true); assert.equal(tileAt(13, 3), '='); assert.equal(tileAt(13, 2), '.');
  assert.equal(canStand(FORGE_SITE.hut.x, FORGE_SITE.hut.y - 30), false); assert.equal(canStand(FORGE_SITE.dummy.x, FORGE_SITE.dummy.y), false);
  assert.ok(canStand(540, 150)); assert.ok(canStand(FORGE_SITE.smith.x, FORGE_SITE.smith.y + 24));
  // Манекен и кузнец достижимы из лагеря обычной ходьбой.
  const step = 8, seen = new Set([`${spawn.x},${spawn.y}`]), queue = [{ ...spawn }];
  for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
    const x = queue[i].x + dx, y = queue[i].y + dy, key = `${x},${y}`;
    if (!seen.has(key) && canStand(x, y)) { seen.add(key); queue.push({ x, y }); }
  }
  for (const p of [FORGE_SITE.dummy, FORGE_SITE.smith, FORGE_SITE.anvil]) assert.ok(queue.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 40), `Недостижимо: ${JSON.stringify(p)}`);
  assert.ok(g.smith && g.dummy); assert.equal(g.weapon, 'sword');
  removeForge(g);
  assert.equal(isForgeOpen(), false); assert.equal(g.smith, null); assert.equal(g.forgeSettings, null); assert.equal(tileAt(13, 3), '.');
});
test('кузнец выдаёт оружие при первой встрече; до этого удар — импульс хранителя; ↻ сохраняет выдачу', () => {
  const g = workshop(FORGE_DEFAULTS, { pulseDamage: 15 }, false);
  g.weapon = 'hammer';
  g.player.x = g.guardian.x - 40; g.player.y = g.guardian.y; g.player.invincible = 10; updateGame(g, { pulse: true }, 1 / 60);
  assert.equal(g.guardian.health, 45, 'Без оружия бьёт pulseDamage из guardian.js'); assert.ok(g.events.includes('pulse')); assert.equal(g.pulseWeapon, null);
  g.player.x = FORGE_SITE.smith.x + 30; g.player.y = FORGE_SITE.smith.y + 30; updateGame(g, {}, 1 / 60);
  assert.equal(g.weaponsReceived, true); assert.ok(g.events.includes('weapons-received')); assert.ok(g.texts.some(t => t.text.includes('Держи')));
  for (let i = 0; i < 60; i++) updateGame(g, {}, 1 / 60);
  g.player.x = g.guardian.x - 40; g.player.y = g.guardian.y; g.player.invincible = 10; updateGame(g, { pulse: true }, 1 / 60);
  assert.equal(g.guardian.health, 7); assert.equal(g.pulseWeapon, 'hammer');
  assert.equal(restartGame(g).weaponsReceived, true);
});
test('во дворе кузницы перемирие: слизень не преследует героя и не бьёт его', () => {
  const g = workshop();
  const slime = g.monsters[0]; slime.stun = 0; slime.home = { x: 500, y: 230 }; slime.x = 500; slime.y = 230;
  g.player.x = 500; g.player.y = 160; g.player.invincible = 0;
  for (let i = 0; i < 120; i++) updateGame(g, {}, 1 / 60);
  assert.equal(slime.chasing, false); assert.ok(slime.y > 190, 'Слизень остаётся за двором'); assert.equal(g.player.health, 100);
  slime.x = g.player.x; slime.y = g.player.y + 12; updateGame(g, {}, 1 / 60);
  assert.equal(g.player.health, 100, 'Касание во дворе не ранит');
  g.player.x = 500; g.player.y = 260; slime.x = 500; slime.y = 300;
  for (let i = 0; i < 30; i++) updateGame(g, {}, 1 / 60);
  assert.equal(slime.chasing, true, 'За двором слизень преследует как обычно');
});
test('оружие: клавиши меняют урон удара по хранителю и слизням; без кузницы бьёт pulseDamage хранителя', () => {
  const g = workshop();
  g.player.x = g.guardian.x - 40; g.player.y = g.guardian.y; g.player.invincible = 10;
  updateGame(g, { pulse: true }, 1 / 60);
  assert.equal(g.guardian.health, 50); assert.ok(g.events.some(e => e.type === 'pulse' && e.weapon === 'sword'));
  for (let i = 0; i < 60; i++) updateGame(g, {}, 1 / 60);
  selectWeapon(g, 'hammer'); assert.ok(g.events.some(e => e.type === 'weapon' && e.weapon === 'hammer'));
  updateGame(g, { pulse: true }, 1 / 60);
  assert.equal(g.guardian.health, 12); assert.ok(g.texts.some(t => t.text === '-38')); assert.ok(g.shake > 0);
  selectWeapon(g, 'dragon'); assert.equal(g.weapon, 'hammer');
  const axe = workshop(); selectWeapon(axe, 'axe');
  const slime = axe.monsters[0]; slime.stun = 0; axe.player.x = slime.x - 30; axe.player.y = slime.y; axe.player.invincible = 10;
  updateGame(axe, { pulse: true }, 1 / 60);
  assert.equal(slime.health, 8); assert.ok(axe.events.some(e => e.type === 'monster-hit' && e.damage === 22));
  const plain = createGame(config); setGuardian(plain, { ...GUARDIAN_DEFAULTS, pulseDamage: 15 }); startGame(plain);
  plain.player.x = plain.guardian.x - 40; plain.player.y = plain.guardian.y; plain.player.invincible = 10; updateGame(plain, { pulse: true }, 1 / 60);
  assert.equal(plain.guardian.health, 45); assert.ok(plain.events.includes('pulse')); assert.ok(Math.abs(plain.pulseCooldown - 0.85) < 0.02);
});
test('характер оружия: меч быстрый и короткий, молот медленный, дальний, сильнее отбрасывает и дольше оглушает', () => {
  const sword = workshop();
  sword.player.x = sword.guardian.x - 100; sword.player.y = sword.guardian.y; sword.player.invincible = 10;
  updateGame(sword, { pulse: true }, 1 / 60);
  assert.equal(sword.guardian.hits, 0, 'Меч не достаёт с 100 пикселей'); assert.ok(Math.abs(sword.pulseCooldown - 0.55) < 0.02);
  const hammer = workshop(); selectWeapon(hammer, 'hammer');
  hammer.player.x = hammer.guardian.x - 100; hammer.player.y = hammer.guardian.y; hammer.player.invincible = 10;
  const before = hammer.guardian.x;
  updateGame(hammer, { pulse: true }, 1 / 60);
  assert.equal(hammer.guardian.hits, 1, 'Молот достаёт со 100 пикселей'); assert.ok(Math.abs(hammer.pulseCooldown - 1.3) < 0.02);
  assert.ok(Math.abs(hammer.guardian.stun - 0.9 * 1.6) < 0.05); assert.ok(hammer.guardian.x - before > 24, 'Молот отбрасывает дальше обычных 24');
  const slimeGame = workshop(); selectWeapon(slimeGame, 'hammer');
  const slime = slimeGame.monsters[0]; slime.stun = 0; slimeGame.player.x = slime.x - 30; slimeGame.player.y = slime.y; slimeGame.player.invincible = 10;
  updateGame(slimeGame, { pulse: true }, 1 / 60);
  assert.ok(Math.abs(slime.stun - 2.2 * 1.6) < 0.05);
});
test('перековка ждёт возвращения в игру, потом: раскалённый металл, удары с искрами, пар, строки заказа и стойка', () => {
  const g = workshop(); g.status = 'paused';
  startForging(g, { trials: [{ text: 'armor(1) → 2 ✔', ok: true }], item: 'Щит', ok: true, after: { rack: { shield: true }, lightning: true, says: 'Готово' } });
  assert.equal(forgePending(g), true); assert.equal(g.rack.shield, undefined, 'Стойка ждёт конца перековки');
  for (let i = 0; i < 120; i++) updateGame(g, {}, 1 / 60);
  assert.equal(forgePending(g), true, 'На паузе кузнец ждёт'); assert.equal(g.forging.time, 0); assert.equal(g.events.some(e => e.type === 'forging'), false);
  startGame(g);
  for (let i = 0; i < 90; i++) updateGame(g, {}, 1 / 60);
  assert.equal(forgePending(g), false); assert.ok(g.events.some(e => e.type === 'forging'));
  assert.ok(g.forging && g.forging.time > 1.4); assert.ok(g.events.filter(e => e.type === 'anvil').length >= 2, 'Кузнец бьёт в ритме');
  for (let i = 0; i < 80; i++) updateGame(g, {}, 1 / 60);
  assert.equal(g.forging, null); assert.ok(g.events.some(e => e.type === 'forged' && e.ok));
  assert.equal(g.rack.shield, true); assert.equal(g.lightning, true); assert.equal(g.smith.says, 'Готово'); assert.equal(g.smith.mood, 'happy');
  assert.ok(g.events.some(e => e.type === 'order-done' && e.item === 'Щит'));
  updateGame(g, {}, 1 / 60);
  assert.ok(g.texts.some(t => t.text === 'armor(1) → 2 ✔'), 'После перековки строки проверки идут над манекеном');
  const sad = workshop();
  startForging(sad, { ok: false, after: { mood: 'sad', says: 'Не сходится' } });
  for (let i = 0; i < 170; i++) updateGame(sad, {}, 1 / 60);
  assert.equal(sad.forging, null); assert.equal(sad.smith.mood, 'sad'); assert.ok(sad.events.some(e => e.type === 'forged' && e.ok === false));
  const plain = createGame(config); plain.status = 'paused'; plain.particles.push({ x: 0, y: 0, vx: 0, vy: 0, life: 1, color: '#fff' });
  updateGame(plain, {}, 1 / 60);
  assert.equal(plain.particles[0].life, 1, 'Пауза ничего не двигает');
});
test('манекен вызывает onHit с уроном оружия, запоминает ответы и не бьёт в ответ', () => {
  const calls = [];
  let hits = 0;
  const g = workshop({ ...FORGE_DEFAULTS, onHit: damage => { calls.push(damage); hits += 1; return 'Удар ' + hits; } });
  hitDummy(g, 3);
  assert.deepEqual(calls, [10, 10, 10]); assert.deepEqual(g.dummy.returns, ['Удар 1', 'Удар 2', 'Удар 3']);
  assert.ok(g.texts.some(t => t.text === '"Удар 3"')); assert.equal(g.player.health, 100); assert.equal(g.dummyWarning, '');
  assert.equal(g.events.filter(e => e.type === 'dummy-hit').length, 3);
  assert.equal(checkHits(g.forgeFunctions, '', g.dummy.returns).status, 'passed');
  const silent = workshop(); hitDummy(silent);
  assert.ok(silent.texts.some(t => t.text === '…')); assert.ok(silent.events.some(e => e.type === 'dummy-hit' && e.missing));
  const broken = workshop({ ...FORGE_DEFAULTS, onHit: () => { throw new ReferenceError('hit is not defined'); } }); hitDummy(broken);
  assert.match(broken.dummyWarning, /Не удалось выполнить onHit.*имя hit не найдено/); assert.deepEqual(broken.dummy.returns, []);
  const far = workshop({ ...FORGE_DEFAULTS, onHit: () => 1 }); far.player.x = 208; far.player.y = 306; updateGame(far, { pulse: true }, 1 / 60);
  assert.deepEqual(far.dummy.returns, []);
  setForge(g, { ...FORGE_DEFAULTS, onHit: () => 1 });
  assert.deepEqual(g.dummy.returns, [], 'Новое сохранение начинает счёт заново');
});
test('проверка заказа показывается над манекеном по строкам, кузнец бьёт по наковальне', () => {
  const g = workshop();
  queueTrials(g, [{ text: 'armor(1) → 2 ✔', ok: true }, { text: 'armor(5) → 11 ✘', ok: false }]);
  updateGame(g, {}, 1 / 60);
  assert.ok(g.texts.some(t => t.text === 'armor(1) → 2 ✔')); assert.equal(g.texts.some(t => t.text.includes('✘')), false); assert.ok(g.smith.strike > 0);
  for (let i = 0; i < 45; i++) updateGame(g, {}, 1 / 60);
  assert.ok(g.texts.some(t => t.text === 'armor(5) → 11 ✘')); assert.equal(g.trials.length, 0);
  smithStrike(g, false); assert.equal(g.smith.mood, 'sad'); assert.ok(g.events.some(e => e.type === 'anvil' && e.ok === false));
  setForgeStatus(g, { rack: { sword: true, shield: true }, lightning: true, says: 'Готово', mood: 'idle' });
  assert.deepEqual(g.rack, { sword: true, shield: true }); assert.equal(g.lightning, true); assert.equal(g.smith.says, 'Готово'); assert.equal(g.smith.mood, 'idle');
  const next = restartGame(g);
  assert.equal(next.weapon, g.weapon); assert.equal(next.lightning, true); assert.deepEqual(next.rack, g.rack); assert.equal(next.smith.says, 'Готово'); assert.equal(next.forgeSettings.hammerDamage, 38);
});
// Герой стоит у паука и бьёт; между ударами ждём откат и возвращаемся на место после отбрасывания.
function fightSpider(g, done, limit = 60) {
  let pulses = 0;
  while (!done() && pulses < limit) {
    g.player.x = g.spider.x - 60; g.player.y = g.spider.y; g.player.invincible = 10;
    updateGame(g, { pulse: true }, 1 / 60); pulses++;
    for (let i = 0; i < 90 && g.pulseCooldown > 0; i++) updateGame(g, {}, 1 / 60);
  }
  return pulses;
}
test('паук у ворот появляется с кузницей, стоит на суше у ворот и исчезает без неё', () => {
  assert.equal(createGame(config).spider, null);
  const g = workshop();
  assert.ok(g.spider && !g.spider.defeated); assert.equal(g.spider.health, 120); assert.ok(canStand(SPIDER_HOME.x, SPIDER_HOME.y, 13));
  assert.ok(Math.hypot(SPIDER_HOME.x - FORGE_SITE.gate.x, SPIDER_HOME.y - FORGE_SITE.gate.y) < 80, 'Паук рядом с воротами');
  removeForge(g); assert.equal(g.spider, null); assert.deepEqual(g.webs, []); assert.equal(g.gateKey, false);
  const far = workshop(); far.player.x = 208; far.player.y = 306;
  for (let i = 0; i < 600; i++) { far.player.invincible = 10; updateGame(far, {}, 1 / 60); }
  assert.ok(Math.hypot(far.spider.x - SPIDER_HOME.x, far.spider.y - SPIDER_HOME.y) < 60, 'Без героя паук патрулирует у ворот');
});
test('панцирь паука: меч и импульс вполсилы, топор и молот в полную; молот побеждает за 4 удара и даёт ключ', () => {
  assert.equal(spiderDamage(10, 'sword'), 5); assert.equal(spiderDamage(22, 'axe'), 22); assert.equal(spiderDamage(38, 'hammer'), 38); assert.equal(spiderDamage(10, null), 5);
  const sword = workshop(); fightSpider(sword, () => sword.spider.hits >= 1);
  assert.equal(sword.spider.health, 115); assert.ok(sword.texts.some(t => t.text === '-5 · панцирь'));
  const pulse = workshop(FORGE_DEFAULTS, { pulseDamage: 20 }, false); fightSpider(pulse, () => pulse.spider.hits >= 1);
  assert.equal(pulse.spider.health, 110, 'Обычный импульс тоже скользит по панцирю');
  const hammer = workshop(); selectWeapon(hammer, 'hammer');
  const pulses = fightSpider(hammer, () => hammer.spider.defeated);
  assert.equal(pulses, 4); assert.equal(hammer.spider.hits, 4); assert.equal(hammer.gateKey, true);
  assert.ok(hammer.events.includes('gate-key')); assert.ok(hammer.events.some(e => e.type === 'spider-defeated' && e.hits === 4));
  assert.ok(hammer.texts.some(t => t.text.startsWith('Ключ от ворот')));
  // Удары молота разбудили слизня рядом с воротами: герой неуязвим, пока ждём возвращения паука.
  for (let i = 0; i < 60 * 26; i++) { hammer.player.invincible = 10; updateGame(hammer, {}, 1 / 60); }
  assert.equal(hammer.spider.defeated, false); assert.equal(hammer.spider.health, 120, 'Паук возвращается через 25 секунд');
  hammer.events.length = 0;
  fightSpider(hammer, () => hammer.spider.defeated);
  assert.equal(hammer.events.includes('gate-key'), false, 'Ключ выдаётся один раз'); assert.equal(hammer.gateKey, true);
  assert.equal(restartGame(hammer).gateKey, true);
});
test('паук рвётся к герою и плюёт паутиной; паутина замедляет, рывок рвёт её; касание бьёт на 25', () => {
  const g = workshop(); g.player.x = g.spider.x - 120; g.player.y = g.spider.y; g.player.invincible = 99;
  let lunged = false, webbed = false;
  for (let i = 0; i < 600 && !(lunged && webbed); i++) {
    updateGame(g, {}, 1 / 60);
    if (g.events.includes('spider-lunge')) lunged = true;
    if (g.player.webbed > 0) webbed = true;
    g.events.length = 0; g.player.x = g.spider.x - 120; g.player.y = g.spider.y;
  }
  assert.ok(lunged, 'Паук сделал рывок'); assert.ok(webbed, 'Паутина долетела');
  const slow = workshop(); slow.player.x = 400; slow.player.y = 500; slow.player.webbed = 5;
  const startX = slow.player.x; for (let i = 0; i < 60; i++) updateGame(slow, { right: true }, 1 / 60);
  const webbedDistance = slow.player.x - startX;
  const free = workshop(); free.player.x = 400; free.player.y = 500;
  for (let i = 0; i < 60; i++) updateGame(free, { right: true }, 1 / 60);
  assert.ok(webbedDistance < (free.player.x - 400) * 0.6, `В паутине медленнее: ${webbedDistance} против ${free.player.x - 400}`);
  updateGame(slow, { right: true, dash: true }, 1 / 60);
  assert.equal(slow.player.webbed, 0); assert.ok(slow.texts.some(t => t.text === 'Вырвался!'));
  const touch = workshop(); touch.player.x = touch.spider.x - 10; touch.player.y = touch.spider.y; touch.player.invincible = 0; updateGame(touch, {}, 1 / 60);
  assert.equal(touch.player.health, 75);
});
test('маршруты урока 03 смотрят на рецепт, заказы и удары', () => {
  const fresh = freshForgeEvidence();
  const recipe = 'function forge(metal) { return metal * 4 + 2; }\nexport const swordDamage = forge(2);\nexport const axeDamage = forge(5);\nexport const hammerDamage = forge(9);';
  const none = forgeState('', evaluateOrders({}, '', []));
  assert.deepEqual(evaluateForgeMission('easy', none, fresh), { configured: false, tested: false });
  const made = forgeState(recipe, evaluateOrders({}, recipe, []));
  assert.deepEqual(evaluateForgeMission('easy', made, fresh), { configured: true, tested: false });
  assert.equal(evaluateForgeMission('easy', made, { ...fresh, weaponHits: 1 }).tested, true);
  assert.equal(evaluateForgeMission('easy', made, { ...fresh, weaponHits: 1 }, ['warning']).tested, false);
  assert.equal(evaluateForgeMission('normal', made, fresh).configured, false);
  const half = forgeState(recipe, evaluateOrders({ armor: m => m * 2, spark: m => m + 9 }, recipe, []));
  assert.deepEqual(evaluateForgeMission('normal', half, fresh), { configured: true, tested: false });
  const done = forgeState(recipe, evaluateOrders(solved, recipe, []));
  assert.equal(evaluateForgeMission('normal', done, fresh).tested, true);
  assert.equal(evaluateForgeMission('challenge', done, fresh).configured, false, 'Без onHit испытание не начато');
  const counted = forgeState(recipe, evaluateOrders({ ...solved, onHit: () => 1 }, recipe, [1, 2, 3]));
  assert.deepEqual(evaluateForgeMission('challenge', counted, fresh), { configured: true, tested: true });
  const stuck = forgeState(recipe, evaluateOrders({ ...solved, onHit: () => 1 }, recipe, [1, 1]));
  assert.deepEqual(evaluateForgeMission('challenge', stuck, fresh), { configured: true, tested: false });
  assert.deepEqual(Object.keys(forgeMissions), ['easy', 'normal', 'challenge']);
  assert.deepEqual(LESSONS, [1, 2, 3]); assert.equal(parseCurrentLesson('[урок 03](lesson-03.md)'), 3);
});
test('сброс кузницы возвращает заготовку и сохраняет копию в lesson-03; полный сброс включает forge.js', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'blockquest-forge-reset-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'student')); await mkdir(resolve(root, 'scripts/templates'), { recursive: true });
  for (const name of ['config', 'rules', 'forge']) {
    await writeFile(resolve(root, `scripts/templates/${name}.js`), `template ${name}`);
    await writeFile(resolve(root, `student/${name}.js`), `my ${name}`);
  }
  const backup = await resetLesson(root, { confirmed: true, exercise: 'forge' });
  assert.match(backup, /lesson-03-/);
  assert.equal(await readFile(resolve(root, 'student/forge.js'), 'utf8'), 'template forge');
  assert.equal(await readFile(resolve(root, 'student/config.js'), 'utf8'), 'my config');
  assert.equal(await readFile(resolve(backup, 'forge.js'), 'utf8'), 'my forge');
  await writeFile(resolve(root, 'student/forge.js'), 'again');
  await resetLesson(root, { confirmed: true });
  assert.equal(await readFile(resolve(root, 'student/forge.js'), 'utf8'), 'template forge');
  assert.equal(await readFile(resolve(root, 'student/rules.js'), 'utf8'), 'template rules');
});
