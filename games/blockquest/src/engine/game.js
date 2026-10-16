import { spawn, portal, crystalSpawns, monsterSpawns, beetleSpawns, moveBody } from '../world/island.js';
import { validateConfig } from './config.js';

export function createGame(rawConfig, crystalRule) {
  const { config, warnings } = validateConfig(rawConfig);
  return {
    config, warnings, crystalRule, ruleWarning: '',
    reward: { used: false, action: null, at: null, fromStart: true, count: 0 },
    status: 'ready', time: 0, score: 0, collected: 0,
    player: { ...spawn, radius: 9, health: config.playerHealth, shield: false, shieldRewardId: null, invincible: 0, facing: 1, moving: false },
    monsters: [
      ...monsterSpawns.map((p, id) => ({ ...p, home: { ...p }, id, type: 'slime', radius: 10, stun: 0, phase: id * 1.7 })),
      ...beetleSpawns.map((p, index) => ({ ...p, home: { ...p }, id: monsterSpawns.length + index, type: 'beetle', radius: 11, stun: 0, phase: (monsterSpawns.length + index) * 1.7 })),
    ],
    crystals: crystalSpawns.map((p, id) => ({ ...p, id, taken: false })),
    particles: [], texts: [], events: [], pulse: 0, pulseCooldown: 0, dashCooldown: 0, dashTime: 0,
    dashDirection: { x: 1, y: 0 }, shake: 0, damageFlash: 0,
  };
}

export function restartGame(game) { return createGame(game.config, game.crystalRule); }
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
    for (const m of game.monsters) if (distance(p, m) < 96) {
      m.stun = 2.2;
      const d = distance(p, m) || 1;
      moveBody(m, (m.x - p.x) / d * 34, (m.y - p.y) / d * 34);
      burst(game, m.x, m.y, '#d9ffae', 6);
    }
  }
  if (game.dashTime > 0) {
    x = game.dashDirection.x; y = game.dashDirection.y;
  }
  const speed = game.config.playerSpeed * 60 * (game.dashTime > 0 ? 2.8 : 1);
  moveBody(p, x * speed * dt, y * speed * dt);

  for (const c of game.crystals) if (!c.taken && distance(p, c) < 23) collectCrystal(game, c);
  for (const m of game.monsters) {
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
