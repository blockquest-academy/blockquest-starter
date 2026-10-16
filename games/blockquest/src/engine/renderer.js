import { WIDTH, HEIGHT, TILE, COLS, ROWS, tileAt, obstacles, portal } from '../world/island.js';

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

function drawPlayer(ctx, p, time, dash) {
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
  const terrain = makeTerrain();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  return function render(game, realTime) {
    const ambientTime = motionPreference.matches ? 0 : realTime;
    const time = game.status === 'ready' ? ambientTime * 0.25 : game.time;
    ctx.save();
    if (game.shake > 0 && !motionPreference.matches) ctx.translate(Math.sin(realTime * 83) * 3, Math.cos(realTime * 71) * 3);
    ctx.drawImage(terrain, 0, 0);
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
      ...game.monsters.map(m => ({ y: m.y, draw: () => m.type === 'beetle' ? beetle(ctx, m, time) : slime(ctx, m, time) })),
      { y: game.player.y, draw: () => drawPlayer(ctx, game.player, time, game.dashTime) },
    ];
    drawables.sort((a, b) => a.y - b.y).forEach(o => o.draw());
    if (game.pulse > 0) {
      const progress = 1 - game.pulse / 0.38;
      ctx.strokeStyle = `rgba(225,255,182,${1 - progress})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(game.player.x, game.player.y - 8, 96 * progress, 64 * progress, 0, 0, Math.PI * 2); ctx.stroke();
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
