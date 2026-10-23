import { spawn, portal, crystalSpawns, monsterSpawns, beetleSpawns, moveBody } from '../world/island.js';
import { validateConfig } from './config.js';
import { validateGuardian, spawnGuardian, GUARDIAN_DEFAULTS } from './guardian.js';
import { validateMonsters } from './monsters.js';

export function createGame(rawConfig, crystalRule) {
  const { config, warnings } = validateConfig(rawConfig);
  return {
    config, warnings, crystalRule, ruleWarning: '',
    reward: { used: false, action: null, at: null, fromStart: true, count: 0 },
    status: 'ready', time: 0, score: 0, collected: 0,
    player: { ...spawn, radius: 9, health: config.playerHealth, shield: false, shieldRewardId: null, invincible: 0, facing: 1, moving: false },
    monsters: [
      ...monsterSpawns.map((p, id) => ({ ...p, home: { ...p }, id, type: 'slime', radius: 10, stun: 0, phase: id * 1.7, health: null, maxHealth: null, dead: false, respawn: 0 })),
      ...beetleSpawns.map((p, index) => ({ ...p, home: { ...p }, id: monsterSpawns.length + index, type: 'beetle', radius: 11, stun: 0, phase: (monsterSpawns.length + index) * 1.7, health: null, maxHealth: null, dead: false, respawn: 0 })),
    ],
    crystals: crystalSpawns.map((p, id) => ({ ...p, id, taken: false })),
    particles: [], texts: [], events: [], pulse: 0, pulseCooldown: 0, dashCooldown: 0, dashTime: 0,
    dashDirection: { x: 1, y: 0 }, shake: 0, damageFlash: 0,
    guardian: null, guardianSettings: null, guardianWarnings: [], guardianMood: null, moodWarning: '', secret: null,
    monsterSettings: null, monsterWarnings: [],
  };
}

export function restartGame(game) {
  const next = createGame(game.config, game.crystalRule);
  if (game.guardianSettings) setGuardian(next, { ...game.guardianSettings, guardianMood: game.guardianMood });
  if (game.monsterSettings) setMonsters(next, game.monsterSettings);
  return next;
}
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
  // Импульс героя бьёт с силой pulseDamage из урока 02; без хранителя — обычные 10.
  const damage = game.guardianSettings?.pulseDamage ?? GUARDIAN_DEFAULTS.pulseDamage;
  m.health = Math.max(0, m.health - damage);
  if (damage) game.texts.push({ x: m.x, y: m.y - 30, text: `-${damage}`, life: 0.9, color: '#ffd0a0' });
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
  }
  if (input.pulse && game.pulseCooldown === 0) {
    game.pulse = 0.38;
    game.pulseCooldown = 0.85;
    game.events.push('pulse');
    for (const m of game.monsters) if (!m.dead && distance(p, m) < 96) {
      m.stun = 2.2;
      const d = distance(p, m) || 1;
      moveBody(m, (m.x - p.x) / d * 34, (m.y - p.y) / d * 34);
      burst(game, m.x, m.y, '#d9ffae', 6);
      if (m.maxHealth) hurtMonster(game, m);
    }
    hitGuardian(game);
  }
  if (game.dashTime > 0) {
    x = game.dashDirection.x; y = game.dashDirection.y;
  }
  const speed = game.config.playerSpeed * 60 * (game.dashTime > 0 ? 2.8 : 1);
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
    const chasing = d < 145;
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
    if (distance(p, m) < p.radius + m.radius + 2) {
      damagePlayer(game, 20);
      const nd = distance(p, m) || 1;
      moveBody(m, (m.x - p.x) / nd * 18, (m.y - p.y) / nd * 18);
    }
  }
  updateGuardian(game, dt);
  if (game.secret && !game.secret.taken && distance(p, game.secret) < 26) takeSecret(game);
  if (game.status === 'playing' && game.collected >= game.config.crystalsToWin && distance(p, portal) < 30) {
    game.status = 'won'; game.events.push('won');
    burst(game, p.x, p.y, '#d7ff9e', 40);
  }
  for (const part of game.particles) {
    part.x += part.vx * dt; part.y += part.vy * dt; part.vy += 55 * dt; part.life -= dt;
  }
  game.particles = game.particles.filter(part => part.life > 0);
  for (const label of game.texts) { label.y -= dt * 22; label.life -= dt; }
  game.texts = game.texts.filter(label => label.life > 0);
}

function hitGuardian(game) {
  const g = game.guardian, p = game.player;
  if (!g || g.defeated || distance(p, g) >= 96 + g.radius) return;
  const damage = game.guardianSettings.pulseDamage;
  g.health = Math.max(0, g.health - damage); g.hits++; g.flash = 0.2;
  g.stun = game.guardianSettings.guardianStunnable ? (g.rage ? 0.5 : 0.9) : 0;
  const d = distance(p, g) || 1;
  moveGuardian(g, (g.x - p.x) / d * 24, (g.y - p.y) / d * 24);
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
