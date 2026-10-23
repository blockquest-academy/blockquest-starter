import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import * as template from '../scripts/templates/guardian.js';
import { LIMITS } from '../games/blockquest/src/engine/config.js';
import { createGame, startGame, updateGame, restartGame, setGuardian, removeGuardian, collectCrystal, setMonsters, removeMonsters } from '../games/blockquest/src/engine/game.js';
import { validateMonsters } from '../games/blockquest/src/engine/monsters.js';
import * as monstersTemplate from '../scripts/templates/monsters.js';
import { validateGuardian, GUARDIAN_DEFAULTS, GUARDIAN_HOME, hasHelperName, hasLetReassignment, stripComments, findLine } from '../games/blockquest/src/engine/guardian.js';
import { canStand } from '../games/blockquest/src/world/island.js';
import { evaluateGuardianMission, freshGuardianEvidence, parseCurrentLesson } from '../games/blockquest/src/ui/guardian-missions.js';
import { resetLesson } from '../scripts/reset-lesson.js';

const config = Object.fromEntries(Object.entries(LIMITS).map(([k, v]) => [k, v[2]]));
function arena(guardian = {}, extra = {}) {
  const g = createGame({ ...config, ...extra });
  setGuardian(g, { ...GUARDIAN_DEFAULTS, ...guardian });
  startGame(g);
  for (const m of g.monsters) m.stun = 1e6;
  return g;
}
// Герой стоит рядом с хранителем; импульс по кнопке, между ударами — откат.
function pulseUntil(g, done, limit = 200) {
  let pulses = 0;
  while (!done() && pulses < limit) {
    g.player.x = g.guardian.x - 40; g.player.y = g.guardian.y; g.player.invincible = 10;
    updateGame(g, { pulse: true }, 1 / 60); pulses++;
    for (let i = 0; i < 60 && g.pulseCooldown > 0; i++) updateGame(g, {}, 1 / 60);
  }
}

test('заготовка хранителя: пять значений без предупреждений, пустое правило ярости, хранитель в логове на суше', () => {
  assert.deepEqual(Object.keys(template).sort(), [...Object.keys(GUARDIAN_DEFAULTS), 'guardianMood'].sort());
  assert.equal(template.guardianMood(1), undefined);
  const { settings, warnings, errors } = validateGuardian(template);
  assert.deepEqual(warnings, []); assert.deepEqual(errors, []); assert.deepEqual(settings, GUARDIAN_DEFAULTS);
  assert.ok(canStand(GUARDIAN_HOME.x, GUARDIAN_HOME.y, 14));
  const g = arena();
  assert.equal(g.guardian.health, 60); assert.equal(g.guardian.name, 'Хранитель'); assert.equal(g.monsters.length, 6);
});
test('без урока 02 хранителя нет; removeGuardian убирает его и секрет', () => {
  const plain = createGame(config); assert.equal(plain.guardian, null);
  const g = arena(); removeGuardian(g);
  assert.equal(g.guardian, null); assert.equal(g.secret, null); assert.deepEqual(g.guardianWarnings, []);
});
test('проверка значений: неверный тип — ошибка с названием типа, пределы — мягкое предупреждение', () => {
  const quoted = validateGuardian({ ...GUARDIAN_DEFAULTS, guardianName: 42, guardianHealth: '80' });
  assert.equal(quoted.settings.guardianName, 'Хранитель'); assert.equal(quoted.settings.guardianHealth, 60);
  assert.deepEqual(quoted.errors.map(e => e.key), ['guardianName', 'guardianHealth']); assert.deepEqual(quoted.warnings, []);
  assert.match(quoted.errors[0].text, /число 42 — а здесь нужно текст в кавычках/); assert.match(quoted.errors[1].text, /текст "80" — а здесь нужно число: убери кавычки/);
  const clamped = validateGuardian({ ...GUARDIAN_DEFAULTS, guardianName: '  Огненный страж  ', guardianHealth: 12.6, guardianSize: 9, pulseDamage: -3, guardianReward: 2e9 });
  assert.deepEqual(clamped.settings, { ...GUARDIAN_DEFAULTS, guardianName: 'Огненный страж', guardianHealth: 13, guardianSize: 3, pulseDamage: 0, guardianReward: 1_000_000 });
  assert.equal(clamped.warnings.length, 4); assert.deepEqual(clamped.errors, []);
  assert.equal(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianSize: 1.5 }).settings.guardianSize, 1.5);
  assert.equal(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianName: 'Очень-очень длинное имя стража' }).settings.guardianName.length, 24);
  const empty = validateGuardian({});
  assert.equal(empty.errors.length, 11); assert.deepEqual(empty.settings, GUARDIAN_DEFAULTS);
  assert.match(empty.errors[0].text, /игра не видит это имя. Проверь export/);
});
test('да/нет: guardianStunnable принимает только true или false без кавычек', () => {
  assert.equal(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianStunnable: false }).settings.guardianStunnable, false);
  const quoted = validateGuardian({ ...GUARDIAN_DEFAULTS, guardianStunnable: 'false' });
  assert.equal(quoted.settings.guardianStunnable, true); assert.match(quoted.errors[0].text, /текст "false" — а здесь нужно да\/нет: true и false пишутся без кавычек/);
  assert.match(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianStunnable: 31 }).errors[0].text, /число 31 — а здесь нужно да\/нет/);
});
test('без оглушения импульс отнимает здоровье, но хранитель не останавливается', () => {
  const g = arena({ guardianStunnable: false });
  g.player.x = g.guardian.x; g.player.y = g.guardian.y + 45; updateGame(g, { pulse: true }, 1 / 60);
  assert.equal(g.guardian.health, 50); assert.equal(g.guardian.stun, 0);
});
test('урон касания: guardianDamage обычно, rageDamage в ярости; число урона видно над героем', () => {
  const calm = arena({ guardianDamage: 15 });
  calm.player.x = calm.guardian.x - 10; calm.player.y = calm.guardian.y; updateGame(calm, {}, 1 / 60);
  assert.equal(calm.player.health, 85); assert.ok(calm.texts.some(t => t.text === '-15'));
  const angry = arena({ guardianDamage: 15, rageDamage: 30, guardianMood: () => 'rage' });
  angry.player.x = angry.guardian.x - 10; angry.player.y = angry.guardian.y; updateGame(angry, {}, 1 / 60);
  assert.equal(angry.player.health, 70); assert.ok(angry.texts.some(t => t.text === '-30'));
  const kind = arena({ guardianDamage: 0 });
  kind.player.x = kind.guardian.x - 10; kind.player.y = kind.guardian.y; updateGame(kind, {}, 1 / 60);
  assert.equal(kind.player.health, 100); assert.ok(!kind.texts.some(t => t.text.startsWith('-')));
});
test('60 здоровья и урон 15: ровно 4 удара, затем секретный кристалл даёт награду один раз', () => {
  const g = arena({ guardianHealth: 60, pulseDamage: 15, guardianReward: 120 });
  pulseUntil(g, () => g.guardian.defeated);
  assert.equal(g.guardian.hits, 4); assert.equal(g.guardian.health, 0);
  assert.ok(g.events.some(e => e.type === 'guardian-defeated' && e.hits === 4));
  assert.ok(g.secret && !g.secret.taken);
  const score = g.score;
  g.player.x = g.secret.x; g.player.y = g.secret.y; updateGame(g, {}, 1 / 60); updateGame(g, {}, 1 / 60);
  assert.equal(g.secret.taken, true); assert.equal(g.score, score + 120);
  assert.equal(g.events.filter(e => e.type === 'secret').length, 1);
});
test('урон не делится нацело: 50 здоровья и урон 20 — три удара; урон 0 не побеждает', () => {
  const uneven = arena({ guardianHealth: 50, pulseDamage: 20 });
  pulseUntil(uneven, () => uneven.guardian.defeated);
  assert.equal(uneven.guardian.hits, 3);
  const harmless = arena({ pulseDamage: 0 });
  pulseUntil(harmless, () => harmless.guardian.defeated, 5);
  assert.equal(harmless.guardian.defeated, false); assert.equal(harmless.guardian.hits, 5); assert.equal(harmless.guardian.health, 60);
  assert.ok(harmless.texts.some(t => t.text === '0 урона'));
});
test('импульс вдали от хранителя не засчитывается ударом', () => {
  const g = arena();
  g.player.x = 208; g.player.y = 306; updateGame(g, { pulse: true }, 1 / 60);
  assert.equal(g.guardian.hits, 0);
});
test('касание хранителя наносит 20 урона, щит его поглощает, оглушённый не бьёт', () => {
  const g = arena();
  g.player.x = g.guardian.x - 10; g.player.y = g.guardian.y; updateGame(g, {}, 1 / 60);
  assert.equal(g.player.health, 80);
  const shielded = arena(); shielded.player.shield = true;
  shielded.player.x = shielded.guardian.x - 10; shielded.player.y = shielded.guardian.y; updateGame(shielded, {}, 1 / 60);
  assert.equal(shielded.player.health, 100); assert.equal(shielded.player.shield, false);
  const stunned = arena(); stunned.guardian.stun = 5;
  stunned.player.x = stunned.guardian.x - 10; stunned.player.y = stunned.guardian.y; updateGame(stunned, {}, 1 / 60);
  assert.equal(stunned.player.health, 100);
});
test('размер меняет зону касания, хранитель не уходит далеко от логова', () => {
  const big = arena({ guardianSize: 3 });
  assert.equal(big.guardian.radius, 39); assert.equal(big.guardian.bodyRadius, 14);
  big.player.x = big.guardian.x - 45; big.player.y = big.guardian.y; updateGame(big, {}, 1 / 60);
  assert.equal(big.player.health, 80);
  const g = arena({}, { monsterSpeed: 5 });
  g.player.x = 208; g.player.y = 306;
  for (let i = 0; i < 600; i++) { g.player.invincible = 10; updateGame(g, {}, 1 / 60); }
  assert.ok(Math.hypot(g.guardian.x - GUARDIAN_HOME.x, g.guardian.y - GUARDIAN_HOME.y) < 60);
});
test('новое сохранение и ↻ возрождают хранителя с полным здоровьем', () => {
  const g = arena({ guardianHealth: 30, pulseDamage: 30 });
  pulseUntil(g, () => g.guardian.defeated);
  setGuardian(g, { ...GUARDIAN_DEFAULTS, guardianHealth: 90 });
  assert.equal(g.guardian.defeated, false); assert.equal(g.guardian.health, 90); assert.equal(g.secret, null);
  collectCrystal(g, g.crystals[0]);
  const next = restartGame(g);
  assert.equal(next.collected, 0); assert.equal(next.guardian.health, 90); assert.equal(next.guardianSettings.guardianHealth, 90);
});
test('проверка кода: своё имя без export и изменение let, комментарии не считаются', () => {
  const base = 'export const guardianName = "Страж";\nexport const pulseDamage = 10;\n';
  assert.equal(hasHelperName(base), false);
  assert.equal(hasHelperName('// const crystalPower = 5;\n' + base), false);
  assert.equal(hasHelperName('const crystalPower = 5;\nexport const pulseDamage = crystalPower * 3;'), true);
  assert.equal(hasLetReassignment('let reward = 60;\nexport const guardianReward = reward;'), false);
  assert.equal(hasLetReassignment('let reward = 60;\nreward = reward * 2;\nexport const guardianReward = reward;'), true);
  assert.equal(hasLetReassignment('let reward = 60;\nreward += 10;'), true);
  assert.equal(hasLetReassignment('let reward = 60;\n/* reward = 2; */\nif (reward == 2) {}'), false);
  assert.equal(stripComments('export const guardianName = "Страж"; // имя').trim(), 'export const guardianName = "Страж";');
});
test('маршруты урока 02 смотрят на значения, код и бой', () => {
  const fresh = freshGuardianEvidence();
  const named = { ...GUARDIAN_DEFAULTS, guardianName: 'Страж', guardianHealth: 80 };
  assert.deepEqual(evaluateGuardianMission('easy', named, '', fresh), { configured: true, tested: false });
  assert.deepEqual(evaluateGuardianMission('easy', named, '', { ...fresh, hits: 1 }), { configured: true, tested: true });
  assert.equal(evaluateGuardianMission('easy', named, '', { ...fresh, hits: 1 }, ['warning']).tested, false);
  const source = 'const crystalPower = 5;\nexport const pulseDamage = crystalPower * 3;';
  assert.equal(evaluateGuardianMission('normal', { ...named, pulseDamage: 10 }, source, fresh).configured, false);
  assert.deepEqual(evaluateGuardianMission('normal', { ...named, pulseDamage: 15 }, source, { ...fresh, defeated: true }), { configured: true, tested: true });
  const letSource = 'let reward = guardianHealth;\nreward = reward * 2;\nexport const guardianReward = reward;';
  assert.deepEqual(evaluateGuardianMission('challenge', { ...named, guardianReward: 160 }, letSource, { ...fresh, defeated: true }), { configured: true, tested: false });
  assert.equal(evaluateGuardianMission('challenge', { ...named, guardianReward: 160 }, letSource, { ...fresh, secret: true }).tested, true);
  assert.equal(evaluateGuardianMission('challenge', null, letSource, fresh).configured, false);
});
test('урок по умолчанию берётся из teacher/lessons/current.md', () => {
  assert.equal(parseCurrentLesson('Сейчас изучаем [урок 02](lesson-02.md).'), 2);
  assert.equal(parseCurrentLesson('Сейчас изучаем [урок 01](lesson-01.md).'), 1);
  assert.equal(parseCurrentLesson('[урок 07](lesson-07.md)'), 1);
  assert.equal(parseCurrentLesson(''), 1);
});
test('сброс хранителя сохраняет числа и правило, полный сброс возвращает все три файла', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'blockquest-guardian-reset-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'student')); await mkdir(resolve(root, 'scripts/templates'), { recursive: true });
  for (const name of ['config', 'rules', 'guardian']) {
    await writeFile(resolve(root, `scripts/templates/${name}.js`), `template ${name}`);
    await writeFile(resolve(root, `student/${name}.js`), `my ${name}`);
  }
  const backup = await resetLesson(root, { confirmed: true, exercise: 'guardian' });
  assert.match(backup, /lesson-02-/);
  assert.equal(await readFile(resolve(root, 'student/guardian.js'), 'utf8'), 'template guardian');
  assert.equal(await readFile(resolve(root, 'student/rules.js'), 'utf8'), 'my rules');
  assert.equal(await readFile(resolve(backup, 'guardian.js'), 'utf8'), 'my guardian');
  await rm(resolve(root, 'student/guardian.js'));
  const all = await resetLesson(root, { confirmed: true });
  assert.deepEqual((await readdir(all)).sort(), ['config.js', 'rules.js']);
  for (const name of ['config', 'rules', 'guardian']) assert.equal(await readFile(resolve(root, `student/${name}.js`), 'utf8'), `template ${name}`);
  await assert.rejects(access(resolve(root, 'student/guardian.js.tmp')));
});

const rageAt20 = health => { if (health <= 20) { return 'rage'; } };
test('ярость: правило проверяется после каждого удара, хранитель злится на пороге', () => {
  const g = arena({ guardianHealth: 60, pulseDamage: 20, guardianMood: rageAt20 });
  assert.equal(g.guardian.rage, false); assert.equal(g.moodWarning, '');
  pulseUntil(g, () => g.guardian.hits >= 1);
  assert.equal(g.guardian.health, 40); assert.equal(g.guardian.rage, false);
  pulseUntil(g, () => g.guardian.hits >= 2);
  assert.equal(g.guardian.health, 20); assert.equal(g.guardian.rage, true);
  assert.ok(g.events.some(e => e.type === 'guardian-rage' && e.health === 20));
  assert.ok(g.texts.some(t => t.text === 'ЯРОСТЬ!'));
  pulseUntil(g, () => g.guardian.defeated);
  assert.equal(g.guardian.hits, 3);
});
test('в ярости хранитель быстрее и оглушается на 0,5 секунды вместо 0,9', () => {
  function chase(mood) {
    const g = arena({ guardianMood: mood }, { monsterSpeed: 2 });
    g.player.x = g.guardian.x + 100; g.player.y = g.guardian.y; g.player.invincible = 99;
    const start = g.guardian.x;
    for (let i = 0; i < 20; i++) updateGame(g, {}, 1 / 60);
    return g.guardian.x - start;
  }
  assert.ok(chase(() => 'rage') > chase(() => undefined) * 1.6);
  const g = arena({ guardianMood: () => 'rage' });
  g.player.x = g.guardian.x; g.player.y = g.guardian.y + 45; updateGame(g, { pulse: true }, 1 / 60);
  assert.ok(g.guardian.stun > 0.45 && g.guardian.stun <= 0.5);
});
test('ярость с самого начала и успокоение по правилу; ответ проверяется при каждом ударе', () => {
  const g = arena({ guardianHealth: 60, pulseDamage: 20, guardianMood: health => { if (health >= 50) { return 'rage'; } } });
  assert.equal(g.guardian.rage, true);
  pulseUntil(g, () => g.guardian.hits >= 1);
  assert.equal(g.guardian.rage, false);
  assert.ok(g.events.some(e => e.type === 'guardian-calm' && e.health === 40));
});
test('неизвестная команда и ошибка в правиле ярости дают подсказку, хранитель остаётся спокойным', () => {
  const unknown = arena({ guardianMood: () => 'angry' });
  assert.match(unknown.moodWarning, /только "rage"/); assert.equal(unknown.guardian.rage, false);
  const broken = arena({ guardianMood: () => { throw new ReferenceError('helth is not defined'); } });
  assert.match(broken.moodWarning, /Не удалось выполнить guardianMood/);
  const none = arena(); assert.equal(none.moodWarning, ''); assert.equal(none.guardianMood, null);
});
test('↻ сохраняет правило ярости, removeGuardian убирает его', () => {
  const g = arena({ guardianMood: () => 'rage' });
  const next = restartGame(g);
  assert.equal(next.guardian.rage, true); assert.equal(typeof next.guardianMood, 'function');
  removeGuardian(next); assert.equal(next.guardianMood, null);
});

test('цвет: английские слова из списка и русские синонимы; чужое слово получает подсказку', () => {
  assert.equal(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianColor: 'Gold' }).settings.guardianColor, 'gold');
  assert.equal(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianColor: 'красный' }).settings.guardianColor, 'red');
  const unknown = validateGuardian({ ...GUARDIAN_DEFAULTS, guardianColor: 'pink' });
  assert.equal(unknown.settings.guardianColor, 'stone'); assert.match(unknown.warnings[0], /не знает цвет «pink».*"purple"/);
  assert.match(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianColor: 5 }).errors[0].text, /число 5 — а здесь нужно текст в кавычках/);
  assert.equal(arena({ guardianColor: 'blue' }).guardian.color, 'blue');
});
test('фраза: склейка текста и чисел даёт текст, число вместо текста получает подсказку', () => {
  const name = 'Страж', health = 80;
  const glued = validateGuardian({ ...GUARDIAN_DEFAULTS, guardianSays: 'Я ' + name + '! У меня ' + health + ' жизней' });
  assert.deepEqual(glued.warnings, []); assert.equal(glued.settings.guardianSays, 'Я Страж! У меня 80 жизней');
  const number = validateGuardian({ ...GUARDIAN_DEFAULTS, guardianSays: 60 + 20 });
  assert.equal(number.settings.guardianSays, GUARDIAN_DEFAULTS.guardianSays); assert.match(number.errors[0].text, /число 80 — а здесь нужно текст/);
  assert.deepEqual(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianSays: '' }).warnings, []);
  assert.equal(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianSays: 'а'.repeat(80) }).settings.guardianSays.length, 60);
  // Тот же знак +: текст склеивается, числа складываются.
  assert.match(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianHealth: '60' + 20 }).errors[0].text, /текст "6020"/);
  assert.equal(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianHealth: 60 + 20 }).settings.guardianHealth, 80);
});
test('регенерация: хранитель лечится целыми единицами, не выше полного запаса, и пересчитывает ярость', () => {
  const g = arena({ guardianRegen: 2.5, guardianMood: health => { if (health <= 50) { return 'rage'; } } });
  g.player.x = 208; g.player.y = 306;
  g.guardian.health = 50; g.guardian.rage = true;
  for (let i = 0; i < 60; i++) { g.player.invincible = 99; updateGame(g, {}, 1 / 60); }
  assert.equal(g.guardian.health, 52); assert.equal(g.guardian.rage, false);
  for (let i = 0; i < 60 * 20; i++) { g.player.invincible = 99; updateGame(g, {}, 1 / 60); }
  assert.equal(g.guardian.health, 60);
  assert.equal(validateGuardian({ ...GUARDIAN_DEFAULTS, guardianRegen: 0.5 }).settings.guardianRegen, 0.5);
});
test('регенерация сильнее импульса: хранителя не победить, слабее — победить можно', () => {
  const strong = arena({ guardianHealth: 30, pulseDamage: 10, guardianRegen: 20 });
  pulseUntil(strong, () => strong.guardian.defeated, 30);
  assert.equal(strong.guardian.defeated, false);
  const weak = arena({ guardianHealth: 30, pulseDamage: 10, guardianRegen: 2 });
  pulseUntil(weak, () => weak.guardian.defeated, 30);
  assert.equal(weak.guardian.defeated, true); assert.ok(weak.guardian.hits > 3);
});

test('строка ошибки: export-строка имени, а без export — строка, где имя встречается', () => {
  const source = '// guardianDamage в комментарии\nexport const guardianName = "Страж";\nconst guardianDamage = 5;\nexport const guardianStunnable = 31;';
  assert.equal(findLine(source, 'guardianStunnable'), 4);
  assert.equal(findLine(source, 'guardianDamage'), 3);
  assert.equal(findLine(source, 'guardianRegen'), null);
});
test('monsters.js: импульс отнимает pulseDamage, побеждённый слизень возвращается через 8 секунд', () => {
  const g = arena({ pulseDamage: 10 });
  setMonsters(g, { monsterHealth: 30 });
  const slime = g.monsters[0];
  assert.equal(slime.health, 30);
  for (let i = 0; i < 3; i++) {
    slime.stun = 0; g.player.x = slime.x + 30; g.player.y = slime.y; g.player.invincible = 99; g.pulseCooldown = 0;
    updateGame(g, { pulse: true }, 1 / 60);
  }
  assert.equal(slime.dead, true); assert.equal(slime.health, 0);
  assert.ok(g.events.some(e => e.type === 'monster-defeated' && e.monster === 'slime'));
  assert.ok(g.texts.some(t => t.text === 'Слизень побеждён'));
  g.player.x = slime.x; g.player.y = slime.y; updateGame(g, {}, 1 / 60);
  assert.equal(g.player.health, 100, 'побеждённый слизень не наносит урон');
  for (let i = 0; i < 60 * 8; i++) { g.player.invincible = 99; updateGame(g, {}, 1 / 60); }
  assert.equal(slime.dead, false); assert.equal(slime.health, 30);
  assert.deepEqual({ x: slime.x, y: slime.y }, slime.home);
});
test('без monsters.js слизни бессмертны; ↻ сохраняет здоровье; removeMonsters оживляет и делает бессмертными', () => {
  const plain = createGame(config); startGame(plain);
  const slime = plain.monsters[0];
  for (let i = 0; i < 5; i++) { slime.stun = 0; plain.player.x = slime.x + 30; plain.player.y = slime.y; plain.player.invincible = 99; plain.pulseCooldown = 0; updateGame(plain, { pulse: true }, 1 / 60); }
  assert.equal(slime.dead, false); assert.equal(slime.health, null);
  const g = arena({ pulseDamage: 25 }); setMonsters(g, { monsterHealth: 20 });
  const beetle = g.monsters.find(m => m.type === 'beetle');
  beetle.stun = 0; g.player.x = beetle.x + 30; g.player.y = beetle.y; updateGame(g, { pulse: true }, 1 / 60);
  assert.equal(beetle.dead, true); assert.ok(g.texts.some(t => t.text === 'Жук побеждён'));
  const again = restartGame(g);
  assert.equal(again.monsters[0].health, 20); assert.equal(again.monsterSettings.monsterHealth, 20);
  removeMonsters(g);
  assert.equal(beetle.dead, false); assert.equal(beetle.health, null); assert.deepEqual({ x: beetle.x, y: beetle.y }, beetle.home);
});
test('проверка monsters.js: текст вместо числа — ошибка, пределы — предупреждение', () => {
  assert.deepEqual(validateMonsters({ monsterHealth: 30 }), { settings: { monsterHealth: 30 }, warnings: [], errors: [] });
  assert.match(validateMonsters({ monsterHealth: '30' }).errors[0].text, /текст "30" — а здесь нужно число: убери кавычки/);
  assert.match(validateMonsters({}).errors[0].text, /игра не видит это имя/);
  assert.equal(validateMonsters({ monsterHealth: 0 }).settings.monsterHealth, 1);
  assert.equal(validateMonsters({ monsterHealth: 0 }).warnings.length, 1);
  assert.deepEqual(validateMonsters(monstersTemplate).errors, []);
});
