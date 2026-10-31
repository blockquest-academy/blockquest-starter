import { WIDTH, HEIGHT, TILE, COLS, ROWS, tileAt, obstacles, portal, FORGE_SITE, isForgeOpen } from '../world/island.js';

const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
const rect = (ctx, color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
function shadow(ctx, x, y, w, h = 8) {
  ctx.fillStyle = '#122e3048'; ctx.beginPath(); ctx.ellipse(x, y + 3, w, h, 0, 0, Math.PI * 2); ctx.fill();
}

function tree(ctx, o) {
  const { x, y } = o;
  const pine = hash(x, y) > 0.48;
  shadow(ctx, x + 3, y, 23);
  rect(ctx, '#523f36', x - 5, y - 27, 10, 30);
  rect(ctx, '#8d6e48', x - 4, y - 24, 3, 25);
  if (pine) {
    for (let i = 0; i < 3; i++) {
      const w = 48 - i * 12; const top = y - 29 - i * 17;
      rect(ctx, '#214c41', x - w / 2, top, w, 18);
      rect(ctx, '#28634a', x - w / 2 + 4, top - 6, w - 8, 20);
      rect(ctx, '#3a8056', x - w / 2 + 8, top - 8, w - 16, 8);
      rect(ctx, '#52935d', x - w / 2 + 8, top - 8, 6, 5);
    }
  } else {
    rect(ctx, '#1e4e3c', x - 24, y - 48, 48, 26);
    rect(ctx, '#2c6847', x - 29, y - 60, 54, 25);
    rect(ctx, '#33794b', x - 23, y - 73, 45, 34);
    rect(ctx, '#478c51', x - 17, y - 78, 32, 17);
    rect(ctx, '#62a461', x - 15, y - 75, 15, 6);
    rect(ctx, '#539457', x - 24, y - 59, 14, 8);
    rect(ctx, '#3f8250', x + 9, y - 52, 12, 12);
    rect(ctx, '#94b973', x - 12, y - 74, 5, 3);
  }
}

function rock(ctx, o) {
  const { x, y } = o;
  shadow(ctx, x, y + 1, 17, 5);
  rect(ctx, '#485b5e', x - 16, y - 12, 32, 13);
  rect(ctx, '#748584', x - 13, y - 22, 23, 19);
  rect(ctx, '#9aa6a0', x - 9, y - 25, 16, 8);
  rect(ctx, '#586b6b', x + 4, y - 16, 10, 13);
  rect(ctx, '#acb6a8', x - 9, y - 23, 9, 3);
  rect(ctx, '#91ad65', x - 13, y - 5, 9, 4);
}

export function drawCrystal(ctx, x, y, time, id = 0, small = false) {
  const bob = Math.sin(time * 3 + id) * 3;
  const cy = y - 15 + bob;
  shadow(ctx, x, y + 1, 9, 3);
  const gradient = ctx.createRadialGradient(x, cy, 0, x, cy, 25);
  gradient.addColorStop(0, '#6effd432'); gradient.addColorStop(1, '#6effd400');
  ctx.fillStyle = gradient; ctx.fillRect(x - 25, cy - 25, 50, 50);
  ctx.beginPath(); ctx.moveTo(x, cy - 12); ctx.lineTo(x + 8, cy - 3); ctx.lineTo(x + 6, cy + 7);
  ctx.lineTo(x, cy + 13); ctx.lineTo(x - 7, cy + 5); ctx.lineTo(x - 8, cy - 3); ctx.closePath();
  ctx.fillStyle = '#367a7a'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, cy - 10); ctx.lineTo(x + 6, cy - 2); ctx.lineTo(x, cy + 10); ctx.closePath();
  ctx.fillStyle = '#66e7cf'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, cy - 10); ctx.lineTo(x - 6, cy - 2); ctx.lineTo(x, cy + 10); ctx.closePath();
  ctx.fillStyle = '#bcffe3'; ctx.fill();
  rect(ctx, '#f1fff2', x - 2, cy - 8, 2, 6);
  if (!small && Math.sin(time * 2 + id * 2) > 0.8) {
    rect(ctx, '#edffda', x + 13, cy - 14, 2, 6); rect(ctx, '#edffda', x + 11, cy - 12, 6, 2);
  }
}

// Оружие в руке: меч поднят вперёд, топор и молот лежат на плече. Удар — замах назад, быстрый взмах вперёд, возврат.
const WEAPON_REST = { sword: 0.45, axe: -0.75, hammer: -0.8 };
function swingAngle(weapon, s) {
  const rest = WEAPON_REST[weapon];
  if (s <= 0) return rest;
  if (s < 0.22) return rest + (-1.15 - rest) * (s / 0.22);
  if (s < 0.55) return -1.15 + 3.2 * ((s - 0.22) / 0.33);
  return 2.05 + (rest - 2.05) * ((s - 0.55) / 0.45);
}
function drawWeapon(ctx, p, weapon, swing, time) {
  const reach = swing > 0 ? Math.sin(Math.min(1, Math.max(0, (swing - 0.22) / 0.33)) * Math.PI) * 7 : 0;
  const bob = p.moving && swing === 0 ? Math.sin(time * 17) * 0.06 : 0;
  ctx.save();
  ctx.translate(Math.round(p.x) + p.facing * (11 + reach), Math.round(p.y) - 16);
  ctx.scale(p.facing, 1); ctx.rotate(swingAngle(weapon, swing) + bob);
  rect(ctx, '#3b2a20', -2, -1, 5, 9); rect(ctx, '#8a6a3a', -1, 0, 3, 7);
  if (weapon === 'sword') {
    rect(ctx, '#2b3340', -7, -4, 14, 4); rect(ctx, '#c9a35c', -6, -3, 12, 2);
    rect(ctx, '#2b3340', -2, -25, 5, 22); rect(ctx, '#dfe6ee', -1, -24, 3, 20); rect(ctx, '#ffffff', 0, -23, 1, 16);
  } else if (weapon === 'axe') {
    rect(ctx, '#3b2a20', -2, -23, 5, 24); rect(ctx, '#8a6a3a', -1, -22, 3, 22);
    rect(ctx, '#2b3340', 0, -24, 13, 14); rect(ctx, '#c7ced6', 1, -23, 11, 12); rect(ctx, '#f0f4f7', 9, -22, 2, 10); rect(ctx, '#9aa4ad', 1, -16, 11, 2);
  } else {
    rect(ctx, '#3b2a20', -2, -25, 5, 27); rect(ctx, '#8a6a3a', -1, -24, 3, 25);
    rect(ctx, '#2b3340', -10, -31, 20, 13); rect(ctx, '#9fb1c4', -9, -30, 18, 11); rect(ctx, '#7d8d9e', -9, -22, 18, 3); rect(ctx, '#d8f1ff', -7, -29, 5, 3);
  }
  ctx.restore();
}

function drawPlayer(ctx, p, time, dash, weapon = null, swing = 0) {
  const x = Math.round(p.x), y = Math.round(p.y);
  const step = p.moving ? Math.sin(time * 17) * 2 : 0;
  shadow(ctx, x, y, 12, 4);
  ctx.strokeStyle = '#e1f4a4'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(x, y + 1, 14, 6, 0, 0, Math.PI * 2); ctx.stroke();
  if (p.invincible > 0 && Math.floor(time * 15) % 2 === 0) ctx.globalAlpha = 0.45;
  if (dash > 0) {
    rect(ctx, '#d1ffac55', x - p.facing * 21 - 8, y - 22, 16, 20);
    rect(ctx, '#d1ffac33', x - p.facing * 35 - 8, y - 20, 16, 16);
  }
  // Шарф, ботинки, рюкзак и шляпа — авторский спрайт исследователя.
  rect(ctx, '#d56950', x - 11 - p.facing * 3, y - 26, 14, 19);
  rect(ctx, '#293b39', x - 7, y - 8 + step, 6, 10);
  rect(ctx, '#293b39', x + 2, y - 8 - step, 6, 10);
  rect(ctx, '#d9c48a', x - 9, y - 22, 19, 15);
  rect(ctx, '#738568', x - 9, y - 9, 19, 4);
  rect(ctx, '#ffe2af', x - 11, y - 21 - step, 4, 9);
  rect(ctx, '#ffe2af', x + 8, y - 21 + step, 4, 9);
  rect(ctx, '#593e35', x - 8, y - 35, 17, 14);
  rect(ctx, '#efc997', x - 6, y - 33, 14, 12);
  rect(ctx, '#263e37', x + (p.facing > 0 ? 3 : -4), y - 29, 3, 3);
  rect(ctx, '#b4c088', x - 10, y - 39, 21, 9);
  rect(ctx, '#e5daa6', x - 7, y - 42, 15, 7);
  rect(ctx, '#667954', x - 14, y - 33, 29, 4);
  rect(ctx, '#ed9670', x - 6, y - 23, 13, 4);
  if (weapon) drawWeapon(ctx, p, weapon, swing, time);
  ctx.globalAlpha = 1;
  if (p.shield) {
    const glow = 0.7 + Math.sin(time * 3) * 0.15;
    ctx.save();
    ctx.fillStyle = '#70d8ff20'; ctx.strokeStyle = `rgba(138,226,255,${glow})`; ctx.lineWidth = 2;
    ctx.shadowColor = '#6fd8ff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.ellipse(x, y - 20, 26, 31, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#d7f8ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 17, y - 27); ctx.lineTo(x - 14, y - 37); ctx.lineTo(x - 8, y - 42); ctx.stroke();
    ctx.restore();
  }
}

function slime(ctx, m, time) {
  const { x, y } = m;
  const bounce = Math.sin(time * 5 + m.phase) * 2;
  shadow(ctx, x, y + 2, 14, 5);
  const dark = m.stun ? '#61727c' : '#675597';
  const light = m.stun ? '#9aadb2' : '#a18ac9';
  rect(ctx, dark, x - 14, y - 14 - bounce, 28, 15 + Math.round(bounce));
  rect(ctx, light, x - 11, y - 22 - bounce, 22, 17);
  rect(ctx, m.stun ? '#c1d0ca' : '#c5ade6', x - 7, y - 25 - bounce, 14, 8);
  rect(ctx, '#f2ead9', x - 8, y - 14 - bounce, 5, 5);
  rect(ctx, '#f2ead9', x + 4, y - 14 - bounce, 5, 5);
  rect(ctx, '#382e4d', x - 6, y - 13 - bounce, 2, 3);
  rect(ctx, '#382e4d', x + 5, y - 13 - bounce, 2, 3);
  if (m.chasing && !m.stun) {
    rect(ctx, '#ffc396', x - 1, y - 41, 3, 7); rect(ctx, '#ffc396', x - 1, y - 32, 3, 3);
  }
  if (m.stun) {
    const sx = x + Math.cos(time * 5) * 14;
    rect(ctx, '#f6e2a3', sx - 2, y - 35, 5, 3);
    rect(ctx, '#f6e2a3', x - (sx - x) - 2, y - 32, 5, 3);
  }
}

function beetle(ctx, m, time) {
  const { x, y } = m;
  const bounce = Math.sin(time * 8 + m.phase) * 1.5;
  shadow(ctx, x, y + 2, 16, 5);
  const shell = m.stun ? '#778b83' : '#a34f3d';
  const shine = m.stun ? '#b8c7b2' : '#e68b53';
  // A wide shell and small legs make the faster enemy easy to recognize.
  rect(ctx, '#342e36', x - 15, y - 8 + bounce, 5, 4);
  rect(ctx, '#342e36', x + 10, y - 8 + bounce, 5, 4);
  rect(ctx, '#342e36', x - 13, y - 2 + bounce, 5, 4);
  rect(ctx, '#342e36', x + 8, y - 2 + bounce, 5, 4);
  rect(ctx, shell, x - 12, y - 17 - bounce, 24, 16);
  rect(ctx, shine, x - 8, y - 20 - bounce, 16, 8);
  rect(ctx, '#583638', x - 2, y - 16 - bounce, 2, 14);
  rect(ctx, '#f3e6bd', x - 8, y - 16 - bounce, 4, 4);
  rect(ctx, '#f3e6bd', x + 4, y - 16 - bounce, 4, 4);
  rect(ctx, '#302c36', x - 7, y - 15 - bounce, 2, 3);
  rect(ctx, '#302c36', x + 5, y - 15 - bounce, 2, 3);
  rect(ctx, '#342e36', x - 7, y - 23 - bounce, 2, 6);
  rect(ctx, '#342e36', x + 5, y - 23 - bounce, 2, 6);
  if (m.chasing && !m.stun) {
    rect(ctx, '#ffc396', x - 1, y - 37, 3, 6);
    rect(ctx, '#ffc396', x - 1, y - 29, 3, 3);
  }
  if (m.stun) {
    rect(ctx, '#f6e2a3', x - 2, y - 33, 4, 3);
    rect(ctx, '#f6e2a3', x + 10, y - 29, 4, 3);
  }
}

// Цвет хранителя выбирает ученик: [камень, блик, тень].
const GUARDIAN_PALETTES = {
  stone: ['#55597a', '#7e83a8', '#363952'], red: ['#8a3f3f', '#c0605a', '#552626'], blue: ['#3d5f9a', '#6d8fd0', '#263c66'],
  green: ['#3f7a4f', '#6db07a', '#28503a'], gold: ['#9a7a2f', '#d4b15a', '#5e4a1c'], purple: ['#6a3f8a', '#9a6dc0', '#3f2656'],
};

// Хранитель — каменный страж с золотым кристаллом. Размер ученика масштабирует весь спрайт.
function guardian(ctx, g, time) {
  const bounce = Math.sin(time * 3 + g.phase) * 1.5;
  shadow(ctx, g.x, g.y + 2, 16 * g.size, 5 * g.size);
  ctx.save();
  ctx.translate(Math.round(g.x), Math.round(g.y)); ctx.scale(g.size, g.size);
  if (g.rage && !g.stun) {
    const aura = ctx.createRadialGradient(g.x, g.y - 22 * g.size, 2, g.x, g.y - 22 * g.size, 40 * g.size);
    aura.addColorStop(0, `rgba(255,90,70,${0.28 + Math.sin(time * 9) * 0.08})`); aura.addColorStop(1, 'rgba(255,90,70,0)');
    ctx.fillStyle = aura; ctx.fillRect(g.x - 40 * g.size, g.y - 62 * g.size, 80 * g.size, 80 * g.size);
  }
  const palette = GUARDIAN_PALETTES[g.color] || GUARDIAN_PALETTES.stone;
  const stone = g.stun ? '#6f7a7e' : g.rage ? '#7a4652' : palette[0], light = g.stun ? '#a3adae' : g.rage ? '#b0646c' : palette[1], dark = g.rage ? '#4a2a33' : palette[2];
  const sway = Math.sin(time * 4) * 2;
  rect(ctx, dark, -10, -9, 8, 10); rect(ctx, dark, 3, -9, 8, 10);
  rect(ctx, stone, -14, -30 - bounce, 28, 22);
  rect(ctx, light, -12, -32 - bounce, 24, 6);
  rect(ctx, stone, -21, -28 - bounce + sway, 7, 15); rect(ctx, stone, 14, -28 - bounce - sway, 7, 15);
  rect(ctx, light, -21, -28 - bounce + sway, 7, 3); rect(ctx, light, 14, -28 - bounce - sway, 7, 3);
  rect(ctx, stone, -9, -44 - bounce, 18, 13);
  rect(ctx, light, -9, -46 - bounce, 18, 4);
  const eyes = g.stun ? '#c9d2cd' : g.rage ? '#ff4a3d' : g.chasing ? '#ffa071' : '#ffe9a8';
  rect(ctx, eyes, -6, -39 - bounce, 4, 3); rect(ctx, eyes, 3, -39 - bounce, 4, 3);
  ctx.beginPath(); ctx.moveTo(0, -27 - bounce); ctx.lineTo(5, -21 - bounce); ctx.lineTo(0, -14 - bounce); ctx.lineTo(-5, -21 - bounce); ctx.closePath();
  ctx.fillStyle = g.stun ? '#d6d0b0' : '#ffd36e'; ctx.fill();
  rect(ctx, '#fff6cf', -1, -24 - bounce, 2, 4);
  if (g.flash > 0) { ctx.globalAlpha = g.flash * 3; rect(ctx, '#fff3d6', -21, -46 - bounce, 42, 47); ctx.globalAlpha = 1; }
  if (g.stun) { const sx = Math.cos(time * 5) * 12; rect(ctx, '#f6e2a3', sx - 2, -54, 5, 3); rect(ctx, '#f6e2a3', -sx - 2, -51, 5, 3); }
  ctx.restore();
}

// Имя и полоса здоровья рисуются поверх деревьев, чтобы ученик всегда видел результат своего кода.
function wrapWords(ctx, text, width) {
  const lines = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.at(-1);
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= width) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, 3);
}
// Фраза хранителя появляется в облачке, когда герой подходит к логову.
function speechBubble(ctx, g, top) {
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
  const lines = wrapWords(ctx, g.says, 190);
  const width = Math.max(...lines.map(line => ctx.measureText(line).width)) + 16, height = lines.length * 13 + 9;
  const x = Math.min(WIDTH - width / 2 - 4, Math.max(width / 2 + 4, g.x)), bottom = top - 20;
  ctx.fillStyle = '#f7f1dcee'; ctx.fillRect(Math.round(x - width / 2), Math.round(bottom - height), Math.round(width), height);
  ctx.beginPath(); ctx.moveTo(g.x - 5, bottom); ctx.lineTo(g.x + 5, bottom); ctx.lineTo(g.x, bottom + 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2b2620';
  lines.forEach((line, i) => ctx.fillText(line, x, bottom - height + 15 + i * 13));
}

function guardianLabel(ctx, g, player) {
  const top = g.y - 48 * g.size - 10;
  const width = 56, filled = g.maxHealth ? Math.round(width * g.health / g.maxHealth) : 0;
  rect(ctx, '#1b2228cc', g.x - width / 2 - 2, top - 2, width + 4, 8);
  rect(ctx, '#3d2b2b', g.x - width / 2, top, width, 4);
  rect(ctx, g.rage ? '#ff5a4a' : '#ffb86b', g.x - width / 2, top, filled, 4);
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#1b2228'; ctx.fillText(g.name, g.x + 1, top - 5);
  ctx.fillStyle = '#ffe9b8'; ctx.fillText(g.name, g.x, top - 6);
  if (g.says && Math.hypot(player.x - g.x, player.y - g.y) < 180) speechBubble(ctx, g, top);
}

function drawSecret(ctx, secret, time) {
  const { x } = secret, cy = secret.y - 18 + Math.sin(time * 3) * 3;
  shadow(ctx, x, secret.y + 1, 11, 4);
  const glow = ctx.createRadialGradient(x, cy, 0, x, cy, 34);
  glow.addColorStop(0, '#ffe08a55'); glow.addColorStop(1, '#ffe08a00');
  ctx.fillStyle = glow; ctx.fillRect(x - 34, cy - 34, 68, 68);
  ctx.beginPath(); ctx.moveTo(x, cy - 15); ctx.lineTo(x + 10, cy - 3); ctx.lineTo(x, cy + 15); ctx.lineTo(x - 10, cy - 3); ctx.closePath();
  ctx.fillStyle = '#c98a2c'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, cy - 12); ctx.lineTo(x + 7, cy - 3); ctx.lineTo(x, cy + 12); ctx.closePath();
  ctx.fillStyle = '#ffd36e'; ctx.fill();
  rect(ctx, '#fff6cf', x - 3, cy - 8, 2, 7);
}

// Полоса здоровья появляется у раненого слизня или жука в уроке 02.
function monsterHealthBar(ctx, m) {
  if (!m.maxHealth || m.health >= m.maxHealth) return;
  rect(ctx, '#1b2228cc', m.x - 13, m.y - 34, 26, 5);
  rect(ctx, '#ff9b7a', m.x - 12, m.y - 33, Math.round(24 * m.health / m.maxHealth), 3);
}

function drawPortal(ctx, active, time) {
  const { x, y } = portal;
  shadow(ctx, x, y + 5, 32, 10);
  rect(ctx, '#657a71', x - 33, y - 2, 66, 8);
  rect(ctx, '#a4af90', x - 28, y - 5, 56, 5);
  if (active) {
    const g = ctx.createRadialGradient(x, y - 28, 1, x, y - 28, 65);
    g.addColorStop(0, '#a1ffcc66'); g.addColorStop(1, '#7dffcf00');
    ctx.fillStyle = g; ctx.fillRect(x - 65, y - 93, 130, 130);
    rect(ctx, '#7ce0b8aa', x - 17, y - 54, 34, 51);
    rect(ctx, '#b5ffd066', x - 13, y - 53, 26, 49);
    for (let i = 0; i < 5; i++) rect(ctx, '#e0ffd4', x - 12 + i * 6, y - 7 - ((time * 25 + i * 11) % 43), 2, 4);
  } else rect(ctx, '#23444766', x - 17, y - 54, 34, 51);
  for (const side of [-1, 1]) {
    rect(ctx, '#4e6661', x + side * 24 - 7, y - 54, 14, 51);
    rect(ctx, '#839282', x + side * 24 - 7, y - 54, 5, 48);
    for (let i = 0; i < 3; i++) rect(ctx, '#364f4c', x + side * 24 - 7, y - 44 + i * 15, 14, 2);
    rect(ctx, '#91ab75', x + side * 24 - 7, y - 54, 14, 4);
  }
  rect(ctx, '#74877b', x - 26, y - 63, 52, 13);
  rect(ctx, '#b0b998', x - 22, y - 66, 44, 6);
  rect(ctx, active ? '#b9ffc9' : '#86a298', x - 4, y - 62, 8, 8);
  ctx.fillStyle = active ? '#d5ffbd' : '#e1e3ba'; ctx.textAlign = 'center'; ctx.font = 'bold 9px monospace';
  ctx.fillText(active ? 'ПОРТАЛ ОТКРЫТ' : 'ЛАГЕРЬ', x, y + 27);
}

// Урок 03: кузница на северном берегу. Горн дышит, из трубы идёт дым, на стене — стойка с выкованным.
function drawHut(ctx, game, time) {
  const { x, y } = FORGE_SITE.hut, sad = game.smith.mood === 'sad';
  shadow(ctx, x, y + 2, 46, 7);
  const glow = ctx.createRadialGradient(x - 20, y + 4, 2, x - 20, y + 4, 60);
  const forging = game.forging?.started;
  const warmth = sad ? 0.1 + Math.abs(Math.sin(time * 18)) * 0.12 : forging ? 0.3 + Math.sin(time * 12) * 0.08 : 0.14 + Math.sin(time * 3) * 0.05;
  glow.addColorStop(0, `rgba(255,${sad ? 90 : 170},70,${warmth})`); glow.addColorStop(1, 'rgba(255,160,70,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 80, y - 56, 120, 70);
  rect(ctx, '#5a4030', x - 38, y - 52, 76, 52);
  for (let i = 0; i < 5; i++) rect(ctx, '#6d4d3a', x - 36, y - 48 + i * 10, 72, 2);
  rect(ctx, '#6d7474', x - 40, y - 10, 80, 10); rect(ctx, '#8a9494', x - 38, y - 9, 20, 3); rect(ctx, '#8a9494', x + 6, y - 6, 16, 3);
  const roof = [[92, -52], [78, -60], [62, -68], [44, -76], [24, -84]];
  for (const [w, top] of roof) { rect(ctx, '#8a3b2f', x - w / 2, y + top, w, 9); rect(ctx, '#a84c3b', x - w / 2 + 2, y + top, w - 4, 3); }
  rect(ctx, '#4f4a4a', x + 20, y - 96, 12, 28); rect(ctx, '#6a6464', x + 18, y - 98, 16, 4);
  for (let i = 0; i < 4; i++) {
    const t = (time * 0.45 + i * 0.29) % 1;
    ctx.globalAlpha = (1 - t) * 0.55;
    rect(ctx, sad ? '#3d3a3a' : '#d9d9d2', x + 23 + Math.sin(t * 7 + i) * 7 - t * 3, y - 104 - t * 40, 6 + t * 8, 5 + t * 5);
  }
  ctx.globalAlpha = 1;
  rect(ctx, '#2a1c14', x - 10, y - 32, 20, 32); rect(ctx, '#3a2a20', x - 8, y - 30, 16, 30); rect(ctx, '#c9a35c', x + 3, y - 16, 2, 3);
  // Окно горна: оранжевое дыхание, при ошибке в файле — красное мигание.
  rect(ctx, '#2a1c14', x - 32, y - 40, 20, 18);
  const fire = sad ? (Math.floor(time * 12) % 2 ? '#ff5a3a' : '#7a2a1a') : forging ? (Math.floor(time * 10) % 2 ? '#fff0b0' : '#ffb24a') : Math.sin(time * 3) > 0 ? '#ffa54a' : '#ff8c3a';
  rect(ctx, fire, x - 30, y - 38, 16, 14); rect(ctx, '#ffe08a', x - 27, y - 33 + Math.sin(time * 9) * 2, 5, 4);
  rect(ctx, '#2a1c14', x - 23, y - 38, 2, 14); rect(ctx, '#2a1c14', x - 30, y - 32, 16, 2);
  // Стойка на стене: каждый готовый рецепт вешает на неё предмет.
  rect(ctx, '#3f2d20', x + 12, y - 46, 26, 34); rect(ctx, '#5c4330', x + 14, y - 44, 22, 30);
  const r = game.rack;
  if (r.sword) { rect(ctx, '#dfe6ee', x + 16, y - 42, 2, 11); rect(ctx, '#c9a35c', x + 14, y - 32, 6, 2); }
  if (r.axe) { rect(ctx, '#8a6a3a', x + 23, y - 43, 2, 13); rect(ctx, '#c7ced6', x + 25, y - 43, 5, 6); }
  if (r.hammer) { rect(ctx, '#8a6a3a', x + 32, y - 42, 2, 12); rect(ctx, '#9fb1c4', x + 29, y - 44, 8, 5); }
  if (r.shield) { rect(ctx, '#c9a35c', x + 15, y - 27, 7, 9); rect(ctx, '#f0dcb2', x + 17, y - 25, 3, 5); }
  if (r.spark) { const s = Math.sin(time * 8) > 0 ? 1 : 0; rect(ctx, '#ffe08a', x + 25, y - 24 - s, 3, 3); rect(ctx, '#fff6cf', x + 23, y - 23, 7, 1); }
  if (r.lightning) { rect(ctx, '#9fe8ff', x + 33, y - 28, 2, 4); rect(ctx, '#9fe8ff', x + 31, y - 25, 4, 2); rect(ctx, '#9fe8ff', x + 32, y - 23, 2, 5); }
}
function drawAnvil(ctx, forging, time) {
  const { x, y } = FORGE_SITE.anvil;
  shadow(ctx, x, y + 1, 14, 4);
  rect(ctx, '#4a4f55', x - 9, y - 8, 18, 8); rect(ctx, '#3b4045', x - 12, y - 2, 24, 3);
  rect(ctx, '#6f7a84', x - 13, y - 18, 26, 10); rect(ctx, '#8a95a0', x - 21, y - 16, 10, 6); rect(ctx, '#aab4bd', x - 13, y - 18, 26, 2);
  if (!forging?.started) return;
  // Раскалённая заготовка на наковальне: белая в начале, остывает к закалке.
  const heat = Math.max(0, 1 - forging.time / forging.duration), flicker = Math.sin(time * 22) * 0.08;
  const glow = ctx.createRadialGradient(x, y - 20, 2, x, y - 20, 34);
  glow.addColorStop(0, `rgba(255,160,70,${0.35 * heat + flicker})`); glow.addColorStop(1, 'rgba(255,160,70,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 34, y - 54, 68, 68);
  const metal = heat > 0.66 ? '#fff0b0' : heat > 0.33 ? '#ff9a3a' : heat > 0.1 ? '#c0503a' : '#8d98a3';
  rect(ctx, '#3b2a20', x - 11, y - 23, 22, 7); rect(ctx, metal, x - 10, y - 22, 20, 5);
  if (heat > 0.33) rect(ctx, '#ffffff', x - 7, y - 21, 6, 1);
}
// Кузнец бьёт по наковальне: в покое изредка, после сохранения файла — сразу, со снопом искр.
function drawSmith(ctx, s, time) {
  const x = Math.round(s.x), y = Math.round(s.y);
  const bounce = s.mood === 'happy' ? Math.abs(Math.sin(time * 10)) * 3 : 0, shake = s.mood === 'sad' ? Math.sin(time * 14) * 2 : 0;
  shadow(ctx, x, y, 13, 4);
  rect(ctx, '#2d2a2a', x - 8, y - 8, 6, 8); rect(ctx, '#2d2a2a', x + 2, y - 8, 6, 8);
  rect(ctx, '#4a3d3d', x - 9, y - 16 - bounce, 18, 9);
  rect(ctx, '#8a4a3a', x - 11, y - 30 - bounce, 22, 16); rect(ctx, '#7a5c3a', x - 7, y - 26 - bounce, 14, 18); rect(ctx, '#8f6c45', x - 5, y - 22 - bounce, 10, 2);
  rect(ctx, '#efc997', x + 9, y - 28 - bounce, 4, 9);
  rect(ctx, '#efc997', x - 7 + shake, y - 42 - bounce, 14, 12); rect(ctx, '#3a3a3a', x - 8 + shake, y - 45 - bounce, 16, 5); rect(ctx, '#c9452f', x - 8 + shake, y - 41 - bounce, 16, 2);
  rect(ctx, '#6b4a35', x - 6 + shake, y - 33 - bounce, 12, 5); rect(ctx, '#263e37', x - 4 + shake, y - 38 - bounce, 2, 2); rect(ctx, '#263e37', x + 2 + shake, y - 38 - bounce, 2, 2);
  const idle = Math.max(0, Math.sin(time * 1.9)) ** 8;
  const swing = s.strike > 0 ? Math.sin((1 - s.strike / 0.45) * Math.PI) : idle;
  ctx.save(); ctx.translate(x - 9, y - 26 - bounce); ctx.rotate(-2.3 + swing * 1.9);
  rect(ctx, '#efc997', -2, -2, 5, 5); rect(ctx, '#8a6a3a', 0, -2, 24, 4); rect(ctx, '#9aa4ad', 20, -7, 9, 14); rect(ctx, '#c7ced6', 21, -6, 3, 12);
  ctx.restore();
}
// Манекен: качается от удара; над ним появляется ответ функции onHit и строки проверки заказов.
function drawDummy(ctx, d, time) {
  const x = Math.round(d.x), y = Math.round(d.y);
  shadow(ctx, x, y + 1, 11, 4);
  ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time * 26) * d.wobble * 0.5);
  rect(ctx, '#6b4a35', -2, -18, 4, 18); rect(ctx, '#7d5a40', -8, -4, 16, 4);
  rect(ctx, '#cdb37a', -11, -42, 22, 26); rect(ctx, '#b89d64', -11, -42, 22, 3); rect(ctx, '#a88e5a', -9, -31, 18, 1); rect(ctx, '#a88e5a', -9, -22, 18, 1);
  rect(ctx, '#b34a3a', -6, -34, 12, 12); rect(ctx, '#f1e6c8', -3, -31, 6, 6); rect(ctx, '#b34a3a', -1, -29, 2, 2);
  rect(ctx, '#6b4a35', -16, -39, 32, 3);
  rect(ctx, '#d8c08a', -7, -56, 14, 14); rect(ctx, '#b89d64', -7, -56, 14, 3); rect(ctx, '#5a4a30', -4, -50, 2, 2); rect(ctx, '#5a4a30', 2, -50, 2, 2); rect(ctx, '#5a4a30', -2, -46, 4, 1);
  ctx.restore();
}
function drawBoard(ctx, game) {
  const { x, y } = FORGE_SITE.board, r = game.rack;
  shadow(ctx, x, y + 1, 14, 4);
  rect(ctx, '#6b4a35', x - 12, y - 28, 4, 28); rect(ctx, '#6b4a35', x + 8, y - 28, 4, 28);
  rect(ctx, '#8a6a46', x - 17, y - 38, 34, 24); rect(ctx, '#efe6c8', x - 14, y - 35, 28, 18);
  ctx.fillStyle = '#2b2620'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
  ctx.fillText('ЗАКАЗЫ', x, y - 27); ctx.font = 'bold 9px monospace'; ctx.fillText(`${r.ordersDone ?? 0}/${r.ordersTotal ?? 4}`, x, y - 19);
}
function drawSign(ctx) {
  const { x, y } = FORGE_SITE.sign;
  shadow(ctx, x, y + 1, 8, 3);
  rect(ctx, '#6b4a35', x - 2, y - 24, 4, 24); rect(ctx, '#a07a4a', x - 24, y - 34, 48, 13); rect(ctx, '#c49a62', x - 22, y - 32, 44, 2);
  ctx.fillStyle = '#2b2620'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('КУЗНИЦА ↑', x, y - 24);
}
// Паук у ворот: тёмное тело с красной меткой, восемь лап, четыре горящих глаза. В рывке вытягивается.
function drawSpider(ctx, s, time) {
  const x = Math.round(s.x), y = Math.round(s.y), moving = s.chasing || s.lunge > 0;
  shadow(ctx, x, y + 2, 17, 5);
  ctx.save(); ctx.translate(x, y); ctx.scale(s.lunge > 0 ? 1.25 : 1, s.lunge > 0 ? 0.9 : 1);
  ctx.strokeStyle = s.stun ? '#6b6378' : '#2e2438'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const wiggle = Math.sin(time * (moving ? 14 : 3) + i * 1.3 + side) * (moving ? 3 : 1);
    ctx.beginPath(); ctx.moveTo(side * 7, -12 + i * 2);
    ctx.lineTo(side * (17 + i), -22 + i * 5 + wiggle); ctx.lineTo(side * (24 - i * 2), -1 + i * 2 + wiggle * 0.4); ctx.stroke();
  }
  const dark = s.stun ? '#5a5366' : '#2e2438', mid = s.stun ? '#7d7589' : '#3a2c48', light = s.stun ? '#9a92a6' : '#52407a';
  rect(ctx, dark, -13, -24, 26, 17); rect(ctx, mid, -11, -23, 22, 13); rect(ctx, light, -8, -22, 16, 5);
  rect(ctx, '#c9452f', -3, -20, 6, 9); rect(ctx, '#ff6b5a', -1, -19, 2, 3);
  const f = s.facing;
  rect(ctx, dark, f * 2 - 7, -11, 14, 10); rect(ctx, mid, f * 2 - 5, -10, 10, 4);
  const eye = s.stun ? '#c9d2cd' : '#ff4a3d';
  rect(ctx, eye, f * 6 - 1, -9, 2, 2); rect(ctx, eye, f * 3 - 1, -9, 2, 2); rect(ctx, eye, f * 6 - 1, -6, 2, 2); rect(ctx, eye, f * 3 - 1, -6, 2, 2);
  rect(ctx, '#e9e2f0', f * 7 - 1, -2, 2, 3); rect(ctx, '#e9e2f0', f * 3 - 1, -2, 2, 3);
  if (s.flash > 0) { ctx.globalAlpha = s.flash * 3; rect(ctx, '#fff3d6', -24, -28, 48, 30); ctx.globalAlpha = 1; }
  if (s.stun) { const sx = Math.cos(time * 5) * 12; rect(ctx, '#f6e2a3', sx - 2, -34, 5, 3); rect(ctx, '#f6e2a3', -sx - 2, -31, 5, 3); }
  ctx.restore();
}
function spiderLabel(ctx, s, player) {
  const top = s.y - 38;
  const width = 56, filled = Math.round(width * s.health / s.maxHealth);
  rect(ctx, '#1b2228cc', s.x - width / 2 - 2, top - 2, width + 4, 8);
  rect(ctx, '#3d2b2b', s.x - width / 2, top, width, 4);
  rect(ctx, '#c9a6ff', s.x - width / 2, top, filled, 4);
  ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#1b2228'; ctx.fillText(s.name, s.x + 1, top - 5);
  ctx.fillStyle = '#e9dcff'; ctx.fillText(s.name, s.x, top - 6);
  if (s.says && Math.hypot(player.x - s.x, player.y - s.y) < 180) speechBubble(ctx, s, top);
}
function drawWeb(ctx, w) {
  ctx.save(); ctx.globalAlpha = Math.min(1, w.life * 2); ctx.strokeStyle = '#e9f1f4'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI; ctx.moveTo(w.x - Math.cos(a) * 6, w.y - Math.sin(a) * 6); ctx.lineTo(w.x + Math.cos(a) * 6, w.y + Math.sin(a) * 6); }
  ctx.stroke(); ctx.beginPath(); ctx.arc(w.x, w.y, 3.5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}
// Герой в паутине: белые нити вокруг тела, пока он не вырвется рывком.
function drawWebbed(ctx, p, time) {
  const x = Math.round(p.x), y = Math.round(p.y);
  ctx.save(); ctx.strokeStyle = `rgba(233,241,244,${0.75 + Math.sin(time * 6) * 0.15})`; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const dy of [-30, -22, -14, -6]) { ctx.moveTo(x - 15, y + dy); ctx.lineTo(x + 15, y + dy + 3); }
  ctx.moveTo(x - 12, y - 36); ctx.lineTo(x + 12, y - 2); ctx.moveTo(x + 12, y - 36); ctx.lineTo(x - 12, y - 2);
  ctx.stroke(); ctx.restore();
}
// Закрытые ворота на восточном берегу: видно, куда пойдём в уроке 04. С ключом от паука замок светится.
function drawGate(ctx, time, hasKey = false) {
  const { x, y } = FORGE_SITE.gate;
  shadow(ctx, x, y + 3, 26, 6);
  rect(ctx, '#3a2a20', x - 14, y - 40, 28, 40);
  for (let i = 0; i < 4; i++) rect(ctx, '#5a4030', x - 12 + i * 7, y - 38, 5, 38);
  rect(ctx, '#3a3a3a', x - 14, y - 30, 28, 3); rect(ctx, '#3a3a3a', x - 14, y - 12, 28, 3);
  rect(ctx, hasKey ? (Math.sin(time * 4) > 0 ? '#ffd36e' : '#c9a35c') : '#8a8a8a', x - 3, y - 22, 6, 6);
  for (const side of [-1, 1]) { rect(ctx, '#4e6661', x + side * 20 - 6, y - 48, 12, 48); rect(ctx, '#839282', x + side * 20 - 6, y - 48, 4, 46); rect(ctx, '#91ab75', x + side * 20 - 7, y - 50, 14, 4); }
  rect(ctx, '#74877b', x - 28, y - 56, 56, 9); rect(ctx, '#b0b998', x - 24, y - 58, 48, 4);
  if (Math.sin(time * 1.3) > 0.6) rect(ctx, '#d2e3a6', x - 1, y - 54, 2, 2);
  ctx.fillStyle = '#e1e3ba'; ctx.textAlign = 'center'; ctx.font = 'bold 9px monospace'; ctx.fillText('ЛЕС · УРОК 04', x, y + 17);
}
// Эффекты оружия: росчерк меча, широкий взмах топора, волна молота и молния за потерянный рецепт.
function drawWeaponEffect(ctx, game, progress, time) {
  const p = game.player, cx = p.x, cy = p.y - 10, f = p.facing, w = game.pulseWeapon;
  // Росчерк появляется на взмахе, после замаха: эффект совпадает с движением оружия в руке.
  const s = Math.min(1, Math.max(0, (progress - 0.22) / 0.55)), fade = 1 - s;
  ctx.save(); ctx.lineCap = 'round';
  const arc = (r, a0, a1) => { ctx.beginPath(); if (f > 0) ctx.arc(cx, cy, r, a0, a1); else ctx.arc(cx, cy, r, Math.PI - a1, Math.PI - a0); ctx.stroke(); };
  if (s > 0 && w === 'sword') {
    ctx.strokeStyle = `rgba(223,233,255,${fade})`; ctx.lineWidth = 4 - s * 3; arc(30 + s * 26, -1.3, 0.9);
    ctx.strokeStyle = `rgba(255,255,255,${fade * 0.5})`; ctx.lineWidth = 1.5; arc(24 + s * 24, -1.1, 0.7);
  } else if (s > 0 && w === 'axe') {
    ctx.strokeStyle = `rgba(255,207,154,${fade})`; ctx.lineWidth = 7 - s * 5; arc(34 + s * 30, -1.9, 1.3);
    ctx.strokeStyle = `rgba(138,106,58,${fade})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx + f * 20, p.y + 4); ctx.lineTo(cx + f * (34 + s * 30), p.y + 6 + s * 4); ctx.stroke();
  } else if (s > 0 && w === 'hammer') {
    ctx.strokeStyle = `rgba(255,210,122,${fade})`; ctx.lineWidth = 5 - s * 4;
    ctx.beginPath(); ctx.ellipse(cx, p.y - 6, 96 * s, 64 * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(255,235,180,${fade * 0.6})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, p.y - 6, 60 * s, 40 * s, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(90,70,40,${fade})`; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.4, length = 14 + s * 26;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 8, p.y + 4 + Math.sin(a) * 4); ctx.lineTo(cx + Math.cos(a) * length, p.y + 4 + Math.sin(a) * length * 0.5); ctx.stroke();
    }
  }
  if (game.lightning && s > 0 && s < 0.85) {
    const alpha = 1 - s / 0.85;
    const targets = game.pulseHits.length ? game.pulseHits : [{ x: cx + f * 70, y: cy - 30 }];
    const bolt = (target, index) => {
      ctx.beginPath(); ctx.moveTo(cx, cy - 6);
      for (let i = 1; i <= 6; i++) {
        const t = i / 6, jitter = i < 6 ? (hash(index + i, Math.floor(time * 30)) - 0.5) * 26 : 0;
        ctx.lineTo(cx + (target.x - cx) * t + jitter, cy - 6 + (target.y - cy + 6) * t + jitter * 0.6);
      }
      ctx.stroke();
    };
    ctx.shadowColor = '#6fd8ff'; ctx.shadowBlur = 14;
    ctx.strokeStyle = `rgba(111,216,255,${alpha * 0.9})`; ctx.lineWidth = 5; targets.forEach(bolt);
    ctx.strokeStyle = `rgba(240,252,255,${alpha})`; ctx.lineWidth = 2; targets.forEach(bolt);
    ctx.shadowBlur = 0;
    for (const target of targets) { ctx.fillStyle = `rgba(200,240,255,${alpha * 0.8})`; ctx.fillRect(Math.round(target.x) - 4, Math.round(target.y) - 4, 8, 8); }
    if (s < 0.3) { ctx.fillStyle = `rgba(170,230,255,${(0.3 - s) * 0.5})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
  }
  ctx.restore();
}

function makeTerrain() {
  const layer = document.createElement('canvas'); layer.width = WIDTH; layer.height = HEIGHT;
  const ctx = layer.getContext('2d');
  ctx.fillStyle = '#204d59'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const x = col * TILE, y = row * TILE, t = tileAt(col, row), h = hash(col, row);
    if (t === '#') {
      if (h > 0.52) {
        rect(ctx, '#2b5e66', x + 4, y + 14, 14, 2); rect(ctx, '#2b5e66', x + 17, y + 12, 7, 2);
      }
      continue;
    }
    const coastal = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => tileAt(col + dx, row + dy) === '#');
    rect(ctx, coastal ? '#bcba80' : ['#668c58', '#6c915b', '#71955e'][Math.floor(h * 3)], x, y, TILE, TILE);
    if (coastal) {
      rect(ctx, '#829861', x + 5, y + 5, 22, 22);
      if (tileAt(col, row + 1) === '#') { rect(ctx, '#6a8060', x, y + 28, 32, 4); rect(ctx, '#7cb4aa', x, y + 33, 32, 3); }
      if (tileAt(col - 1, row) === '#') rect(ctx, '#80b4ac', x - 4, y + 4, 3, 24);
      if (tileAt(col + 1, row) === '#') rect(ctx, '#80b4ac', x + 33, y + 4, 3, 24);
      if (tileAt(col, row - 1) === '#') rect(ctx, '#80b4ac', x + 3, y - 4, 26, 3);
    }
    if (t === '=') {
      rect(ctx, '#a6a16e', x, y, TILE, TILE);
      rect(ctx, '#bbb383', x + 2, y + 2, 28, 28);
      rect(ctx, '#d1c498', x + 5 + h * 12, y + 7, 7, 3);
      rect(ctx, '#989668', x + 19, y + 24, 5, 2);
    } else {
      for (let i = 0; i < 3; i++) {
        const gx = x + 4 + hash(col + i, row * 2) * 22, gy = y + 4 + hash(col, row + i + 4) * 22;
        rect(ctx, '#557d4f', gx, gy, 2, 4); rect(ctx, '#87a76a', gx + 2, gy - 2, 2, 3);
      }
      if (h > 0.82 && !coastal) {
        rect(ctx, h > 0.94 ? '#e2c2af' : '#e4d58c', x + 10, y + 14, 4, 4);
        rect(ctx, '#d2e3a6', x + 23, y + 24, 3, 3);
      }
    }
  }
  // Каменные фрагменты и грибы — декоративные детали острова.
  for (const [x, y] of [[330, 380], [514, 180], [780, 460], [398, 530], [104, 295], [590, 350]]) {
    rect(ctx, '#c6b584', x, y, 9, 3); rect(ctx, '#b56e57', x - 3, y - 5, 13, 6); rect(ctx, '#f5d8a6', x, y - 4, 3, 2);
  }
  for (const o of obstacles) if (o.kind === 'rock') rock(ctx, o);
  return layer;
}

export function createRenderer(canvas) {
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  // Тропа к кузнице меняет рельеф: слой земли строится отдельно для открытой и закрытой кузницы.
  const terrains = {};
  const terrain = () => terrains[isForgeOpen()] ??= makeTerrain();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  return function render(game, realTime) {
    const ambientTime = motionPreference.matches ? 0 : realTime;
    const time = game.status === 'ready' ? ambientTime * 0.25 : game.time;
    ctx.save();
    if (game.shake > 0 && !motionPreference.matches) ctx.translate(Math.sin(realTime * 83) * 3, Math.cos(realTime * 71) * 3);
    ctx.drawImage(terrain(), 0, 0);
    // Течение воды и пылинки создают движение даже в спокойной сцене.
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 25; i++) {
      const x = (i * 137 + ambientTime * 5) % WIDTH, y = (i * 79) % HEIGHT;
      if (tileAt(Math.floor(x / TILE), Math.floor(y / TILE)) === '#') rect(ctx, '#8abbbb', x, y, 12, 1);
    }
    ctx.globalAlpha = 1;
    const drawables = [
      { y: portal.y, draw: () => drawPortal(ctx, game.collected >= game.config.crystalsToWin, time) },
      ...obstacles.filter(o => o.kind === 'tree').map(o => ({ y: o.y, draw: () => tree(ctx, o) })),
      ...game.crystals.filter(c => !c.taken).map(c => ({ y: c.y, draw: () => drawCrystal(ctx, c.x, c.y, motionPreference.matches ? 0 : time, c.id) })),
      ...game.monsters.filter(m => !m.dead).map(m => ({ y: m.y, draw: () => { m.type === 'beetle' ? beetle(ctx, m, time) : slime(ctx, m, time); monsterHealthBar(ctx, m); } })),
      ...(game.guardian && !game.guardian.defeated ? [{ y: game.guardian.y, draw: () => guardian(ctx, game.guardian, time) }] : []),
      ...(game.secret && !game.secret.taken ? [{ y: game.secret.y, draw: () => drawSecret(ctx, game.secret, motionPreference.matches ? 0 : time) }] : []),
      ...(game.smith ? [
        { y: FORGE_SITE.hut.y, draw: () => drawHut(ctx, game, ambientTime) },
        { y: FORGE_SITE.board.y, draw: () => drawBoard(ctx, game) },
        { y: FORGE_SITE.anvil.y, draw: () => drawAnvil(ctx, game.forging, ambientTime) },
        { y: game.smith.y, draw: () => drawSmith(ctx, game.smith, ambientTime) },
        { y: game.dummy.y, draw: () => drawDummy(ctx, game.dummy, ambientTime) },
        { y: FORGE_SITE.sign.y, draw: () => drawSign(ctx) },
        { y: FORGE_SITE.gate.y, draw: () => drawGate(ctx, ambientTime, game.gateKey) },
        ...(game.spider && !game.spider.defeated ? [{ y: game.spider.y, draw: () => drawSpider(ctx, game.spider, time) }] : []),
      ] : []),
      { y: game.player.y, draw: () => drawPlayer(ctx, game.player, time, game.dashTime, game.forgeSettings && game.weaponsReceived ? game.weapon : null, game.pulseWeapon && game.pulse > 0 ? 1 - game.pulse / 0.38 : 0) },
    ];
    drawables.sort((a, b) => a.y - b.y).forEach(o => o.draw());
    if (game.player.webbed > 0) drawWebbed(ctx, game.player, time);
    for (const web of game.webs) drawWeb(ctx, web);
    if (game.guardian && !game.guardian.defeated) guardianLabel(ctx, game.guardian, game.player);
    if (game.spider && !game.spider.defeated) spiderLabel(ctx, game.spider, game.player);
    // Новый файл: кузнец ждёт возвращения в игру; во время перековки говорит о работе. Обе фразы видны издалека.
    if (game.forging) speechBubble(ctx, { x: game.smith.x, says: game.forging.started ? 'Перековываю… сейчас проверю.' : 'Новый файл! Нажми «Продолжить» — перекую.' }, game.smith.y - 56);
    else if (game.smith?.says && Math.hypot(game.player.x - game.smith.x, game.player.y - game.smith.y) < 180) speechBubble(ctx, game.smith, game.smith.y - 56);
    if (game.pulse > 0) {
      const progress = 1 - game.pulse / 0.38;
      if (game.pulseWeapon) drawWeaponEffect(ctx, game, progress, realTime);
      else {
        ctx.strokeStyle = `rgba(225,255,182,${1 - progress})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(game.player.x, game.player.y - 8, 96 * progress, 64 * progress, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    for (const part of game.particles) { ctx.globalAlpha = Math.max(0, part.life / 0.7); rect(ctx, part.color, part.x, part.y, 3, 3); }
    ctx.globalAlpha = 1;
    for (const label of game.texts) {
      ctx.globalAlpha = Math.min(1, label.life * 3); ctx.fillStyle = label.color; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText(label.text, label.x, label.y);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 18; i++) {
      const x = (hash(i, 33) * WIDTH + Math.sin(ambientTime * 0.3 + i) * 12);
      const y = (hash(i, 72) * HEIGHT - ambientTime * 3 + HEIGHT * 20) % HEIGHT;
      ctx.globalAlpha = (Math.sin(ambientTime + i) + 1) * 0.18;
      rect(ctx, '#fff4ba', x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 180, WIDTH / 2, HEIGHT / 2, 620);
    vignette.addColorStop(0, '#071f2600'); vignette.addColorStop(1, '#082a315c');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (game.damageFlash > 0) { ctx.fillStyle = `rgba(237,105,79,${game.damageFlash * 0.4})`; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
    ctx.restore();
  };
}
