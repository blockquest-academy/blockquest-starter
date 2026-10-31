import { spawn, portal, crystalSpawns, monsterSpawns, beetleSpawns, moveBody, FORGE_SITE, setForgeOpen, inForgeYard } from '../world/island.js';
import { validateConfig } from './config.js';
import { validateGuardian, spawnGuardian, GUARDIAN_DEFAULTS } from './guardian.js';
import { validateMonsters } from './monsters.js';
import { validateForge, WEAPONS, PULSE_STATS, FORGING_TIME, explainCall, describeShort } from './forge.js';
import { SPIDER, spawnSpider, spiderDamage } from './spider.js';

export function createGame(rawConfig, crystalRule) {
  const { config, warnings } = validateConfig(rawConfig);
  return {
    config, warnings, crystalRule, ruleWarning: '',
    reward: { used: false, action: null, at: null, fromStart: true, count: 0 },
    status: 'ready', time: 0, score: 0, collected: 0,
    player: { ...spawn, radius: 9, health: config.playerHealth, shield: false, shieldRewardId: null, invincible: 0, facing: 1, moving: false, webbed: 0 },
    monsters: [
      ...monsterSpawns.map((p, id) => ({ ...p, home: { ...p }, id, type: 'slime', radius: 10, stun: 0, phase: id * 1.7, health: null, maxHealth: null, dead: false, respawn: 0 })),
      ...beetleSpawns.map((p, index) => ({ ...p, home: { ...p }, id: monsterSpawns.length + index, type: 'beetle', radius: 11, stun: 0, phase: (monsterSpawns.length + index) * 1.7, health: null, maxHealth: null, dead: false, respawn: 0 })),
    ],
    crystals: crystalSpawns.map((p, id) => ({ ...p, id, taken: false })),
    particles: [], texts: [], events: [], pulse: 0, pulseCooldown: 0, dashCooldown: 0, dashTime: 0,
    dashDirection: { x: 1, y: 0 }, shake: 0, damageFlash: 0,
    guardian: null, guardianSettings: null, guardianWarnings: [], guardianMood: null, moodWarning: '', secret: null,
    monsterSettings: null, monsterWarnings: [],
    // Урок 03: оружие из кузницы, кузнец, манекен и очередь проверок заказов.
    forgeModule: null, forgeSettings: null, forgeWarnings: [], forgeFunctions: null, weapon: 'sword', weaponsReceived: false, pulseWeapon: null, pulseHits: [],
    lightning: false, rack: {}, smith: null, dummy: null, dummyWarning: '', trials: [], trialTimer: 0, forging: null,
    spider: null, webs: [], gateKey: false,
  };
}

export function restartGame(game) {
  const next = createGame(game.config, game.crystalRule);
  if (game.guardianSettings) setGuardian(next, { ...game.guardianSettings, guardianMood: game.guardianMood });
  if (game.monsterSettings) setMonsters(next, game.monsterSettings);
  if (game.forgeSettings) { setForge(next, game.forgeModule); Object.assign(next, { weapon: game.weapon, weaponsReceived: game.weaponsReceived, lightning: game.lightning, rack: { ...game.rack }, gateKey: game.gateKey }); next.smith.says = game.smith.says; }
  return next;
}
// Урок 03: каждое сохранение student/forge.js перековывает оружие и открывает тропу к кузнице.
export function setForge(game, raw) {
  const { settings, warnings } = validateForge(raw);
  const forgeFunctions = Object.fromEntries(Object.entries(raw || {}).filter(([, value]) => typeof value === 'function'));
  Object.assign(game, { forgeModule: raw, forgeSettings: settings, forgeWarnings: warnings, forgeFunctions, dummyWarning: '' });
  game.smith ??= { ...FORGE_SITE.smith, strike: 0, mood: 'idle', says: '', celebrate: 0 };
  game.dummy ??= { ...FORGE_SITE.dummy, wobble: 0, returns: [] };
  game.dummy.returns = [];
  // Вместе с кузницей на острове появляется паук у ворот в лес: сильное оружие получает цель.
  game.spider ??= spawnSpider();
  setForgeOpen(true);
  return warnings;
}
export function removeForge(game) {
  Object.assign(game, { forgeModule: null, forgeSettings: null, forgeWarnings: [], forgeFunctions: null, pulseWeapon: null, lightning: false, rack: {}, smith: null, dummy: null, dummyWarning: '', trials: [], forging: null, spider: null, webs: [], gateKey: false });
  game.player.webbed = 0;
  setForgeOpen(false);
}
// Перековка: кузнец раскаляет металл, бьёт в ритме и закаляет его — около 2,6 секунды.
// Сохранение файла только передаёт заказ: кузнец ждёт, пока ученик вернётся в игру и нажмёт «Продолжить», —
// так перековку точно увидят, а не пропустят на паузе за редактором.
export function startForging(game, { trials = [], item = null, ok = true, after = null } = {}) {
  if (!game.smith) return;
  game.forging = { started: false, time: 0, duration: FORGING_TIME, nextStrike: 0.7, trials, item, ok, after };
  game.trials = []; game.smith.mood = 'idle';
}
function finishForging(game) {
  const job = game.forging; game.forging = null;
  const anvil = FORGE_SITE.anvil;
  for (let i = 0; i < 14; i++) game.particles.push({ x: anvil.x - 10 + Math.random() * 20, y: anvil.y - 20, vx: (Math.random() - 0.5) * 18, vy: -30 - Math.random() * 30, life: 0.9, color: '#e9f1f4' });
  game.events.push({ type: 'forged', ok: job.ok });
  if (job.after) setForgeStatus(game, job.after);
  if (job.trials.length) queueTrials(game, job.trials);
  if (job.item) smithCelebrate(game, job.item); else smithStrike(game, job.ok);
}
export function selectWeapon(game, weapon) {
  if (!WEAPONS[weapon] || game.weapon === weapon) return;
  game.weapon = weapon;
  game.events.push({ type: 'weapon', weapon });
}
// Кузнец отвечает на сохранение файла ударом по наковальне; при ошибке горн мигает красным.
export function smithStrike(game, ok = true) {
  const s = game.smith; if (!s) return;
  s.strike = 0.45; s.mood = ok ? 'idle' : 'sad';
  burst(game, FORGE_SITE.anvil.x, FORGE_SITE.anvil.y - 18, ok ? '#ffd36e' : '#ff7a5a', ok ? 14 : 8);
  game.events.push({ type: 'anvil', ok });
}
export function smithCelebrate(game, item) {
  const s = game.smith; if (!s) return;
  s.strike = 0.45; s.mood = 'happy'; s.celebrate = 1.6;
  burst(game, FORGE_SITE.anvil.x, FORGE_SITE.anvil.y - 24, '#ffe28a', 34);
  game.texts.push({ x: FORGE_SITE.hut.x, y: FORGE_SITE.hut.y - 70, text: `Заказ выполнен: ${item}!`, life: 2.4, color: '#ffe7a3' });
  game.events.push({ type: 'order-done', item });
}
// Строки проверки заказа показываются над манекеном по одной, с ударом кузнеца на каждую.
export function queueTrials(game, rows) {
  if (!game.dummy) return;
  game.trials = rows.map(row => ({ text: row.text, ok: row.ok }));
  game.trialTimer = 0;
}
export const forgePending = game => Boolean(game.forging && !game.forging.started);
export function setForgeStatus(game, { rack, lightning, says, mood } = {}) {
  if (rack) game.rack = { ...rack };
  if (lightning !== undefined) game.lightning = lightning;
  if (game.smith) { if (says !== undefined) game.smith.says = says; if (mood && game.smith.celebrate <= 0) game.smith.mood = mood; }
}
// Урон удара: оружие, выданное кузнецом (урок 03), иначе pulseDamage хранителя (урок 02) или 10.
const armed = game => Boolean(game.forgeSettings && game.weaponsReceived);
function pulseDamage(game) {
  if (armed(game)) return game.forgeSettings[WEAPONS[game.weapon].key];
  return game.guardianSettings?.pulseDamage ?? GUARDIAN_DEFAULTS.pulseDamage;
}
const weaponStats = game => armed(game) ? WEAPONS[game.weapon] : PULSE_STATS;
// Каждое сохранение student/guardian.js возрождает хранителя с новыми свойствами.
export function setGuardian(game, raw) {
  const { settings, warnings } = validateGuardian(raw);
  const guardianMood = typeof raw.guardianMood === 'function' ? raw.guardianMood : null;
  Object.assign(game, { guardianSettings: settings, guardianWarnings: warnings, guardianMood, moodWarning: '', guardian: spawnGuardian(settings), secret: null });
  checkGuardianMood(game);
  return warnings;
}
export function removeGuardian(game) {
  Object.assign(game, { guardianSettings: null, guardianWarnings: [], guardianMood: null, moodWarning: '', guardian: null, secret: null });
}
// Урок 02: здоровье слизней и жуков из student/monsters.js. Без него они бессмертны, как в уроке 01.
export function setMonsters(game, raw) {
  const { settings, warnings } = validateMonsters(raw);
  Object.assign(game, { monsterSettings: settings, monsterWarnings: warnings });
  setMonsterHealth(game, settings.monsterHealth);
  return warnings;
}
export function removeMonsters(game) {
  Object.assign(game, { monsterSettings: null, monsterWarnings: [] });
  setMonsterHealth(game, null);
}
function setMonsterHealth(game, health) {
  for (const m of game.monsters) {
    if (m.dead) Object.assign(m, { x: m.home.x, y: m.home.y });
    Object.assign(m, { health, maxHealth: health, dead: false, respawn: 0 });
  }
}
function hurtMonster(game, m) {
  const damage = pulseDamage(game);
  m.health = Math.max(0, m.health - damage);
  game.pulseHits.push({ x: m.x, y: m.y - 14 });
  if (damage) game.texts.push({ x: m.x, y: m.y - 30, text: `-${damage}`, life: 0.9, color: '#ffd0a0' });
  game.events.push({ type: 'monster-hit', monster: m.type, damage });
  if (m.health > 0) return;
  // Побеждённый монстр возвращается домой через 8 секунд: остров не пустеет.
  m.dead = true; m.respawn = 8;
  burst(game, m.x, m.y - 8, m.type === 'beetle' ? '#e68b53' : '#a18ac9', 22);
  game.texts.push({ x: m.x, y: m.y - 44, text: m.type === 'beetle' ? 'Жук побеждён' : 'Слизень побеждён', life: 1.4, color: '#e9dcff' });
  game.events.push({ type: 'monster-defeated', monster: m.type });
}
// Бонус урока 02: правило ученика guardianMood(health) решает, злится ли хранитель.
// Проверяется при появлении и каждый раз, когда меняется здоровье: удар или регенерация.
function checkGuardianMood(game) {
  const g = game.guardian;
  game.moodWarning = '';
  if (!g || g.defeated || !game.guardianMood) return;
  let mood;
  try { mood = game.guardianMood(g.health); }
  catch {
    game.moodWarning = 'Не удалось выполнить guardianMood в student/guardian.js. Проверь имя health, кавычки у "rage" и запись условия.';
    return;
  }
  if (mood !== undefined && mood !== 'rage') {
    game.moodWarning = 'Правило guardianMood может вернуть только "rage" в кавычках. Пока условие не выполнено — ничего не возвращай.';
    return;
  }
  const rage = mood === 'rage';
  if (rage === g.rage) return;
  g.rage = rage;
  burst(game, g.x, g.y - 20 * g.size, rage ? '#ff6b5a' : '#9fd8ff', rage ? 30 : 12);
  game.texts.push({ x: g.x, y: g.y - 40 * g.size - 26, text: rage ? 'ЯРОСТЬ!' : 'Хранитель успокоился', life: 1.8, color: rage ? '#ff8f7a' : '#bfe6ff' });
  game.events.push({ type: rage ? 'guardian-rage' : 'guardian-calm', health: g.health });
}
export function applyRule(game, crystalRule) {
  game.crystalRule = crystalRule;
  game.ruleWarning = typeof crystalRule === 'function' ? '' : 'В student/rules.js нужна готовая оболочка export function crystalRule(crystals).';
  game.reward.fromStart = game.collected === 0 && !game.reward.used;
}

function checkCrystalRule(game) {
  if (!game.crystalRule) return;
  let action;
  try {
    if (typeof game.crystalRule !== 'function') throw new Error();
    action = game.crystalRule(game.collected);
    if (action !== undefined && action !== 'shield' && action !== 'heal') {
      game.ruleWarning = 'Правило в student/rules.js может вернуть "shield" или "heal" в кавычках. Пока условие не выполнено — ничего не возвращай.';
      return;
    }
    game.ruleWarning = '';
  } catch {
    game.ruleWarning = 'Не удалось выполнить student/rules.js. Проверь имя crystals, кавычки у команды и запись условия. Остров сохранён.';
    return;
  }
  if (action === undefined) return;
  const p = game.player;
  // Повтор решает ученическое условие. Уже надетый щит не складывается и не перезапускается.
  if (action === 'shield' && p.shield) return;
  Object.assign(game.reward, { used: true, action, at: game.collected, count: game.reward.count + 1 });
  if (action === 'shield') {
    p.shield = true; p.shieldRewardId = game.reward.count;
  }
  const healed = action === 'heal' ? Math.max(0, Math.min(40, game.config.playerHealth - p.health)) : 0;
  p.health += healed;
  burst(game, p.x, p.y - 18, action === 'shield' ? '#80deff' : '#a8ffbd', 24);
  game.texts.push({ x: p.x, y: p.y - 52, text: action === 'shield' ? 'ЩИТ СОЗДАН!' : healed ? `+${healed} здоровья` : 'Здоровье полное', life: 2, color: action === 'shield' ? '#a3eaff' : '#adffc4' });
  game.events.push({ type: action, reward: { id: game.reward.count, action, at: game.collected, fromStart: game.reward.fromStart, blocked: false } });
}
export function startGame(game) { if (game.status === 'ready' || game.status === 'paused') game.status = 'playing'; }
export function togglePause(game) {
  if (game.status === 'playing') game.status = 'paused';
  else if (game.status === 'paused') game.status = 'playing';
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function applyConfig(game, raw) {
  const { config, warnings } = validateConfig(raw);
  const changes = Object.keys(config).filter(key => config[key] !== game.config[key]);
  const portalWasOpen = game.collected >= game.config.crystalsToWin;
  game.config = config; game.warnings = warnings;
  if (changes.includes('playerHealth')) game.player.health = config.playerHealth;
  if (!portalWasOpen && game.collected >= config.crystalsToWin) game.events.push('portal');
  return changes;
}

function burst(game, x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const speed = 25 + (i % 4) * 17;
    game.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 20, life: 0.7, color });
  }
}

export function collectCrystal(game, crystal) {
  if (game.status !== 'playing' || crystal.taken) return;
  crystal.taken = true;
  game.collected++;
  game.score += game.config.crystalPoints;
  burst(game, crystal.x, crystal.y, '#a4ffdf');
  game.texts.push({ x: crystal.x, y: crystal.y - 20, text: `+${game.config.crystalPoints}`, life: 1.1, color: '#c5ffe8' });
  game.events.push('collect');
  checkCrystalRule(game);
  if (game.collected === game.config.crystalsToWin) game.events.push('portal');
}

export function damagePlayer(game, amount) {
  if (game.status !== 'playing' || game.player.invincible > 0 || game.dashTime > 0) return;
  if (game.player.shield) {
    game.player.shield = false;
    game.player.invincible = 1.2;
    burst(game, game.player.x, game.player.y - 18, '#80deff', 18);
    game.texts.push({ x: game.player.x, y: game.player.y - 50, text: 'Щит принял удар', life: 1.5, color: '#a3eaff' });
    game.events.push({ type: 'shield-break', rewardId: game.player.shieldRewardId });
    game.player.shieldRewardId = null;
    return;
  }
  game.player.health = Math.max(0, game.player.health - amount);
  game.player.invincible = 1.2;
  game.shake = 0.22;
  game.damageFlash = 0.35;
  burst(game, game.player.x, game.player.y, '#ff967e', 8);
  game.events.push('damage');
  if (game.player.health === 0) { game.status = 'lost'; game.events.push('lost'); }
}

export function updateGame(game, input, delta) {
  if (!Number.isFinite(delta) || game.status !== 'playing') return;
  const dt = Math.min(Math.max(delta, 0), 0.05);
  // Подшаги проверяют подбор и урон: на скорости 50 нельзя проскочить кристалл.
  const steps = Math.min(96, Math.max(1, Math.ceil(Math.max(game.config.playerSpeed * 2.8, game.config.monsterSpeed) * 60 * dt / 10)));
  for (let i = 0; i < steps && game.status === 'playing'; i++) stepGame(game, input, dt / steps);
}

function stepGame(game, input, dt) {
  if (game.status !== 'playing') return;
  game.time += dt;
  for (const key of ['pulse', 'pulseCooldown', 'dashCooldown', 'dashTime', 'shake', 'damageFlash']) game[key] = Math.max(0, game[key] - dt);
  const p = game.player;
  p.invincible = Math.max(0, p.invincible - dt);
  p.webbed = Math.max(0, p.webbed - dt);
  let x = Number(input.right || false) - Number(input.left || false);
  let y = Number(input.down || false) - Number(input.up || false);
  const magnitude = Math.hypot(x, y);
  if (magnitude) { x /= magnitude; y /= magnitude; }
  p.moving = magnitude > 0;
  if (x) p.facing = Math.sign(x);

  if (input.dash && game.dashCooldown === 0 && magnitude) {
    game.dashTime = 0.17;
    game.dashCooldown = 2;
    game.dashDirection = { x, y };
    burst(game, p.x, p.y, '#d4f89b', 6);
    game.events.push('dash');
    // Рывок рвёт паутину паука.
    if (p.webbed > 0) { p.webbed = 0; game.texts.push({ x: p.x, y: p.y - 50, text: 'Вырвался!', life: 1.2, color: '#e9f1f4' }); }
  }
  if (input.pulse && game.pulseCooldown === 0) {
    const stats = weaponStats(game);
    game.pulse = 0.38;
    game.pulseCooldown = stats.cooldown;
    game.pulseHits = [];
    game.pulseWeapon = armed(game) ? game.weapon : null;
    game.events.push(game.pulseWeapon ? { type: 'pulse', weapon: game.pulseWeapon } : 'pulse');
    // Оружие из кузницы отличается на вид: топор рубит с щепками, молот сотрясает землю.
    if (game.pulseWeapon === 'axe') burst(game, p.x + p.facing * 30, p.y + 2, '#8a6a3a', 8);
    if (game.pulseWeapon === 'hammer') { game.shake = Math.max(game.shake, 0.14); burst(game, p.x, p.y + 4, '#c9b98a', 12); }
    if (game.rack.spark) burst(game, p.x + p.facing * 20, p.y - 16, '#ffe08a', 10);
    for (const m of game.monsters) if (!m.dead && distance(p, m) < stats.reach) {
      m.stun = 2.2 * stats.stun;
      const d = distance(p, m) || 1;
      moveBody(m, (m.x - p.x) / d * stats.push, (m.y - p.y) / d * stats.push);
      burst(game, m.x, m.y, '#d9ffae', 6);
      if (m.maxHealth) hurtMonster(game, m);
    }
    hitGuardian(game, stats);
    hitSpider(game, stats);
    hitDummy(game, stats);
  }
  receiveWeapons(game);
  tickForge(game, dt);
  if (game.dashTime > 0) {
    x = game.dashDirection.x; y = game.dashDirection.y;
  }
  const speed = game.config.playerSpeed * 60 * (game.dashTime > 0 ? 2.8 : p.webbed > 0 ? SPIDER.webbedSlow : 1);
  moveBody(p, x * speed * dt, y * speed * dt);

  for (const c of game.crystals) if (!c.taken && distance(p, c) < 23) collectCrystal(game, c);
  for (const m of game.monsters) {
    if (m.dead) {
      m.respawn -= dt;
      if (m.respawn <= 0) Object.assign(m, { dead: false, x: m.home.x, y: m.home.y, health: m.maxHealth, stun: 1 });
      continue;
    }
    m.stun = Math.max(0, m.stun - dt);
    if (m.stun > 0) continue;
    const d = distance(p, m);
    // Во дворе кузницы перемирие: герой спокойно пишет функции и бьёт манекен.
    const truce = inForgeYard(p);
    const chasing = d < 145 && !truce;
    m.chasing = chasing;
    const target = chasing ? p : {
      x: m.home.x + Math.cos(game.time * 0.6 + m.phase) * 38,
      y: m.home.y + Math.sin(game.time * 0.7 + m.phase) * 32,
    };
    const td = distance(m, target);
    if (td > 3) {
      const typeSpeed = m.type === 'beetle' ? 1.4 : 1;
      const s = game.config.monsterSpeed * typeSpeed * 60 * (chasing ? 0.8 : 0.32) * dt;
      moveBody(m, (target.x - m.x) / td * s, (target.y - m.y) / td * s);
    }
    if (!truce && distance(p, m) < p.radius + m.radius + 2) {
      damagePlayer(game, 20);
      const nd = distance(p, m) || 1;
      moveBody(m, (m.x - p.x) / nd * 18, (m.y - p.y) / nd * 18);
    }
  }
  updateGuardian(game, dt);
  updateSpider(game, dt);
  if (game.secret && !game.secret.taken && distance(p, game.secret) < 26) takeSecret(game);
  if (game.status === 'playing' && game.collected >= game.config.crystalsToWin && distance(p, portal) < 30) {
    game.status = 'won'; game.events.push('won');
    burst(game, p.x, p.y, '#d7ff9e', 40);
  }
  updateEffects(game, dt);
}
function updateEffects(game, dt) {
  for (const part of game.particles) {
    part.x += part.vx * dt; part.y += part.vy * dt; part.vy += 55 * dt; part.life -= dt;
  }
  game.particles = game.particles.filter(part => part.life > 0);
  for (const label of game.texts) { label.y -= dt * 22; label.life -= dt; }
  game.texts = game.texts.filter(label => label.life > 0);
}

// Манекен у кузницы не бьёт в ответ: удар по нему вызывает функцию ученика onHit и показывает её ответ.
function hitDummy(game, stats) {
  const d = game.dummy, p = game.player;
  if (!d || distance(p, d) >= Math.max(64, stats.reach - 16)) return;
  d.wobble = 0.5;
  game.pulseHits.push({ x: d.x, y: d.y - 20 });
  burst(game, d.x, d.y - 16, '#e8d79a', 8);
  const fn = game.forgeFunctions?.onHit;
  let value, failed = false;
  if (fn) {
    try { value = fn(pulseDamage(game)); }
    catch (error) { failed = true; game.dummyWarning = `Не удалось выполнить onHit в student/forge.js: ${explainCall(error)}`; }
  }
  if (fn && !failed) { game.dummyWarning = ''; d.returns.push(value); if (d.returns.length > 20) d.returns.shift(); }
  const shown = !fn || value === undefined ? '…' : failed ? 'ошибка' : describeShort(value);
  game.texts.push({ x: d.x, y: d.y - 46, text: shown, life: 1.4, color: shown === '…' || failed ? '#d8dccf' : '#ffe7a3' });
  game.events.push({ type: 'dummy-hit', value, missing: !fn, failed });
}
// Кузнец выдаёт оружие при первой встрече: до этого удар — обычный импульс.
function receiveWeapons(game) {
  const s = game.smith;
  if (!s || game.weaponsReceived || distance(game.player, s) >= 64) return;
  game.weaponsReceived = true; s.strike = 0.45;
  burst(game, s.x, s.y - 30, '#ffe28a', 24);
  game.texts.push({ x: s.x, y: s.y - 66, text: 'Держи: меч, топор, молот!', life: 2.4, color: '#ffe7a3' });
  game.events.push('weapons-received');
}
// Жизнь кузницы: перековка, замах кузнеца, качание манекена и строки проверки. Идёт только пока игра идёт.
export function tickForge(game, dt) {
  const s = game.smith, d = game.dummy;
  if (!s) return;
  const job = game.forging;
  if (job) {
    if (!job.started) { job.started = true; game.events.push({ type: 'forging' }); }
    job.time += dt;
    if (job.time >= job.nextStrike && job.time < job.duration - 0.35) {
      job.nextStrike += 0.38; s.strike = 0.38;
      burst(game, FORGE_SITE.anvil.x, FORGE_SITE.anvil.y - 18, '#ffd36e', 10);
      game.events.push({ type: 'anvil', ok: true });
    }
    if (job.time >= job.duration) finishForging(game);
  }
  s.strike = Math.max(0, s.strike - dt); s.celebrate = Math.max(0, s.celebrate - dt);
  if (s.celebrate === 0 && s.mood === 'happy') s.mood = 'idle';
  d.wobble = Math.max(0, d.wobble - dt);
  if (!game.trials.length) return;
  game.trialTimer -= dt;
  if (game.trialTimer > 0) return;
  const row = game.trials.shift();
  game.trialTimer = 0.65; s.strike = 0.3; d.wobble = 0.35;
  burst(game, FORGE_SITE.anvil.x, FORGE_SITE.anvil.y - 18, row.ok ? '#ffd36e' : '#ff7a5a', 6);
  game.texts.push({ x: d.x, y: d.y - 46, text: row.text, life: 1.7, color: row.ok ? '#c8ffb0' : '#ff9c8a' });
}

function hitGuardian(game, stats = PULSE_STATS) {
  const g = game.guardian, p = game.player;
  if (!g || g.defeated || distance(p, g) >= stats.reach + g.radius) return;
  const damage = pulseDamage(game);
  game.pulseHits.push({ x: g.x, y: g.y - 22 * g.size });
  g.health = Math.max(0, g.health - damage); g.hits++; g.flash = 0.2;
  g.stun = game.guardianSettings.guardianStunnable ? (g.rage ? 0.5 : 0.9) * stats.stun : 0;
  const d = distance(p, g) || 1, push = 24 * stats.push / PULSE_STATS.push;
  moveGuardian(g, (g.x - p.x) / d * push, (g.y - p.y) / d * push);
  burst(game, g.x, g.y - 20 * g.size, '#ffd27a', 10);
  game.texts.push({ x: g.x, y: g.y - 40 * g.size - 12, text: damage ? `-${damage}` : '0 урона', life: 1.2, color: damage ? '#ffb27a' : '#d8dccf' });
  game.events.push({ type: 'guardian-hit', hits: g.hits, health: g.health });
  if (g.health > 0) { checkGuardianMood(game); return; }
  g.defeated = true;
  burst(game, g.x, g.y - 20 * g.size, '#ffe28a', 40);
  game.texts.push({ x: g.x, y: g.y - 40 * g.size - 30, text: `${g.name} побеждён!`, life: 2.2, color: '#ffe7a3' });
  game.secret = { x: g.x, y: g.y, taken: false };
  game.events.push({ type: 'guardian-defeated', hits: g.hits });
}

function updateGuardian(game, dt) {
  const g = game.guardian, p = game.player;
  if (!g || g.defeated) return;
  g.flash = Math.max(0, g.flash - dt);
  // Регенерация копит доли здоровья и прибавляет целые единицы, не выше полного запаса.
  const regen = game.guardianSettings.guardianRegen;
  if (regen > 0 && g.health < g.maxHealth) {
    g.regenPool += regen * dt;
    const healed = Math.min(Math.floor(g.regenPool), g.maxHealth - g.health);
    if (healed > 0) { g.health += healed; g.regenPool -= healed; checkGuardianMood(game); }
  } else g.regenPool = 0;
  g.stun = Math.max(0, g.stun - dt);
  if (g.stun > 0) return;
  // Хранитель защищает своё логово: преследует рядом с ним и возвращается обратно.
  g.chasing = distance(p, g) < 130 && distance(p, g.home) < 190;
  const target = g.chasing ? p : { x: g.home.x + Math.cos(game.time * 0.5 + g.phase) * 24, y: g.home.y + Math.sin(game.time * 0.5 + g.phase) * 18 };
  const td = distance(g, target);
  if (td > 3) {
    const s = game.config.monsterSpeed * 0.75 * (g.rage ? 1.7 : 1) * 60 * (g.chasing ? 0.8 : 0.3) * dt;
    moveGuardian(g, (target.x - g.x) / td * s, (target.y - g.y) / td * s);
  }
  if (distance(p, g) < p.radius + g.radius + 2) {
    // Урон касания задаёт ученик: обычный guardianDamage или rageDamage в ярости.
    const damage = g.rage ? game.guardianSettings.rageDamage : game.guardianSettings.guardianDamage;
    const before = p.health;
    damagePlayer(game, damage);
    if (p.health < before) game.texts.push({ x: p.x, y: p.y - 46, text: `-${before - p.health}`, life: 1.1, color: g.rage ? '#ff8f7a' : '#ffc0a8' });
    const nd = distance(p, g) || 1;
    moveGuardian(g, (g.x - p.x) / nd * 18, (g.y - p.y) / nd * 18);
  }
}

// Паук у ворот: панцирь режет урон меча вдвое, оглушается коротко, рвётся к герою рывком и плюётся паутиной.
function hitSpider(game, stats) {
  const s = game.spider, p = game.player;
  if (!s || s.defeated || distance(p, s) >= stats.reach + s.radius) return;
  const raw = pulseDamage(game), weapon = game.pulseWeapon, damage = spiderDamage(raw, weapon);
  game.pulseHits.push({ x: s.x, y: s.y - 14 });
  s.health = Math.max(0, s.health - damage); s.hits++; s.flash = 0.2;
  s.stun = (weapon === 'hammer' ? 0.8 : 0.4) * stats.stun; s.lunge = 0;
  const d = distance(p, s) || 1, push = 18 * stats.push / PULSE_STATS.push;
  moveGuardian(s, (s.x - p.x) / d * push, (s.y - p.y) / d * push);
  burst(game, s.x, s.y - 12, '#c9a6ff', 10);
  const glanced = damage < raw;
  game.texts.push({ x: s.x, y: s.y - 44, text: damage ? `-${damage}${glanced ? ' · панцирь' : ''}` : 'панцирь', life: 1.2, color: glanced ? '#d8dccf' : '#ffb27a' });
  game.events.push({ type: 'spider-hit', hits: s.hits, health: s.health, damage, weapon });
  if (s.health > 0) return;
  s.defeated = true; s.respawn = SPIDER.respawn;
  burst(game, s.x, s.y - 12, '#c9a6ff', 36);
  game.texts.push({ x: s.x, y: s.y - 56, text: 'Паук побеждён!', life: 2.2, color: '#e9dcff' });
  if (!game.gateKey) {
    game.gateKey = true;
    game.texts.push({ x: s.x, y: s.y - 76, text: 'Ключ от ворот! Пригодится в лесу', life: 2.8, color: '#ffe7a3' });
    game.events.push('gate-key');
  }
  game.events.push({ type: 'spider-defeated', hits: s.hits });
}
function updateSpider(game, dt) {
  const s = game.spider, p = game.player;
  if (!s) return;
  if (s.defeated) {
    // Паук возвращается к воротам через 25 секунд: бой можно повторить с другим оружием.
    s.respawn -= dt;
    if (s.respawn <= 0) Object.assign(s, { defeated: false, health: s.maxHealth, hits: 0, x: s.home.x, y: s.home.y, stun: 1, lungeCooldown: 1.5, webCooldown: 3 });
    return;
  }
  s.flash = Math.max(0, s.flash - dt); s.lungeCooldown = Math.max(0, s.lungeCooldown - dt); s.webCooldown = Math.max(0, s.webCooldown - dt);
  s.stun = Math.max(0, s.stun - dt);
  if (s.stun > 0) return;
  const d = distance(p, s);
  s.chasing = d < SPIDER.sight && distance(p, s.home) < SPIDER.territory + 40;
  if (s.chasing && Math.abs(p.x - s.x) > 4) s.facing = p.x > s.x ? 1 : -1;
  if (s.lunge > 0) {
    s.lunge = Math.max(0, s.lunge - dt);
    const v = game.config.monsterSpeed * SPIDER.lungeSpeed * 60 * dt;
    moveGuardian(s, s.lungeDirection.x * v, s.lungeDirection.y * v);
  } else if (s.chasing) {
    if (s.lungeCooldown === 0 && d < SPIDER.lungeRange && d > 30) {
      s.lunge = SPIDER.lungeTime; s.lungeCooldown = SPIDER.lungeCooldown;
      s.lungeDirection = { x: (p.x - s.x) / d, y: (p.y - s.y) / d };
      game.events.push('spider-lunge');
    } else {
      const v = game.config.monsterSpeed * 1.1 * 60 * 0.8 * dt;
      if (d > 3) moveGuardian(s, (p.x - s.x) / d * v, (p.y - s.y) / d * v);
    }
    if (s.webCooldown === 0 && d < SPIDER.webRange && d > 60) {
      s.webCooldown = SPIDER.webCooldown;
      game.webs.push({ x: s.x, y: s.y - 10, vx: (p.x - s.x) / d * SPIDER.webSpeed, vy: (p.y - 10 - s.y) / d * SPIDER.webSpeed, life: 1.4 });
      game.events.push('web');
    }
  } else {
    const target = { x: s.home.x + Math.cos(game.time * 0.7 + s.phase) * 30, y: s.home.y + Math.sin(game.time * 0.9 + s.phase) * 22 };
    const td = distance(s, target);
    if (td > 3) { const v = game.config.monsterSpeed * 60 * 0.3 * dt; moveGuardian(s, (target.x - s.x) / td * v, (target.y - s.y) / td * v); }
  }
  if (distance(p, s) < p.radius + s.radius + 2) {
    const before = p.health;
    damagePlayer(game, SPIDER.damage);
    if (p.health < before) game.texts.push({ x: p.x, y: p.y - 46, text: `-${before - p.health}`, life: 1.1, color: '#d9b8ff' });
    const nd = distance(p, s) || 1;
    moveGuardian(s, (s.x - p.x) / nd * 22, (s.y - p.y) / nd * 22);
  }
  for (const web of game.webs) {
    web.x += web.vx * dt; web.y += web.vy * dt; web.life -= dt;
    if (web.life > 0 && Math.hypot(web.x - p.x, web.y - (p.y - 10)) < 16 && game.dashTime === 0) {
      web.life = 0;
      if (p.webbed === 0) game.texts.push({ x: p.x, y: p.y - 52, text: 'Паутина! Shift — вырваться', life: 1.6, color: '#e9f1f4' });
      p.webbed = SPIDER.webbedTime;
      game.events.push('webbed');
    }
  }
  game.webs = game.webs.filter(web => web.life > 0);
}

// Большой хранитель сталкивается с деревьями как обычный: размер меняет вид и зону касания.
function moveGuardian(g, dx, dy) {
  const body = { x: g.x, y: g.y, radius: g.bodyRadius };
  moveBody(body, dx, dy);
  g.x = body.x; g.y = body.y;
}

function takeSecret(game) {
  const reward = game.guardianSettings.guardianReward;
  game.secret.taken = true;
  game.score += reward;
  burst(game, game.secret.x, game.secret.y, '#ffe28a', 28);
  game.texts.push({ x: game.secret.x, y: game.secret.y - 30, text: `+${reward} · секрет!`, life: 2, color: '#ffe7a3' });
  game.events.push({ type: 'secret', reward });
}
