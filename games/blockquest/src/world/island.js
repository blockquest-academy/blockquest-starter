export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;

// # — океан; . — трава; = — дорожка. Все игровые объекты стоят на суше.
const MAP = [
  '##############################',
  '##########.........###########',
  '######..................######',
  '####......................####',
  '###........=====...........###',
  '##.........=...=............##',
  '##....======...=====........##',
  '##....=...........=..........#',
  '#.....=...........=..........#',
  '#.....======......=====......#',
  '#..........=..........=......#',
  '#..........=..........=......#',
  '##.........======.....=.....##',
  '##..............=.....=.....##',
  '###.............=======...####',
  '####.....................#####',
  '#####...................######',
  '#######..............#########',
  '###########......#############',
  '##############################',
];

// Урок 03: на северном берегу открывается тропа к кузнице. Пока кузница закрыта, остров прежний.
const FORGE_PATH = new Set(['12,3', '13,3', '14,3', '15,3']);
let forgeOpen = false;
export function setForgeOpen(open) { forgeOpen = Boolean(open); }
export const isForgeOpen = () => forgeOpen;
export const tileAt = (col, row) => {
  const t = MAP[row]?.[col] ?? '#';
  return forgeOpen && t === '.' && FORGE_PATH.has(`${col},${row}`) ? '=' : t;
};
export const terrainAt = (x, y) => tileAt(Math.floor(x / TILE), Math.floor(y / TILE));
// Кузница стоит между двумя деревьями северной поляны; манекен — восточнее, у тропы.
export const FORGE_SITE = {
  hut: { x: 448, y: 96 }, smith: { x: 448, y: 124 }, anvil: { x: 412, y: 122 }, board: { x: 372, y: 118 },
  dummy: { x: 580, y: 124 }, sign: { x: 338, y: 182 }, gate: { x: 906, y: 346 },
};
// Двор кузницы — перемирие: слизни и жуки не заходят туда и не преследуют героя рядом с кузнецом.
export const FORGE_YARD = { left: 330, right: 640, bottom: 190 };
export const inForgeYard = p => forgeOpen && p.x > FORGE_YARD.left && p.x < FORGE_YARD.right && p.y < FORGE_YARD.bottom;
export const forgeObstacles = [
  { x: 448, y: 58, radius: 40, kind: 'hut' }, { x: 410, y: 70, radius: 26, kind: 'hut' }, { x: 486, y: 70, radius: 26, kind: 'hut' },
  { ...FORGE_SITE.anvil, radius: 9, kind: 'anvil' }, { ...FORGE_SITE.smith, radius: 10, kind: 'smith' },
  { ...FORGE_SITE.board, radius: 10, kind: 'board' }, { ...FORGE_SITE.dummy, radius: 9, kind: 'dummy' },
  { x: FORGE_SITE.gate.x, y: FORGE_SITE.gate.y - 6, radius: 16, kind: 'gate' },
];
export const spawn = { x: 208, y: 306 };
export const portal = { x: 208, y: 256 };

const at = ([x, y]) => ({ x: x * TILE + 16, y: y * TILE + 16 });
export const crystalSpawns = [
  [7, 9], [9, 9], [11, 8], [11, 6], [13, 4], [16, 4],
  [19, 6], [22, 7], [25, 8], [26, 10], [23, 11], [22, 14],
  [19, 14], [17, 13], [15, 12], [12, 13], [9, 15], [7, 14],
  [5, 11], [15, 16], [20, 16], [24, 4],
].map(at);
export const monsterSpawns = [[13, 7], [23, 8], [21, 13], [11, 15], [24, 5]].map(at);
export const beetleSpawns = [[18, 12]].map(at);
export const obstacles = [
  ...[[7, 3], [9, 3], [11, 2], [16, 2], [19, 3], [22, 3], [25, 5],
    [4, 5], [3, 8], [8, 7], [14, 6], [16, 8], [19, 9], [27, 8],
    [3, 12], [6, 13], [9, 12], [13, 14], [17, 15], [23, 15], [12, 17],
    [18, 17], [25, 13]].map(p => ({ ...at(p), radius: 12, kind: 'tree' })),
  ...[[9, 5], [17, 6], [5, 9], [14, 10], [25, 12], [8, 16], [20, 11]]
    .map(p => ({ ...at(p), radius: 11, kind: 'rock' })),
];

export function canStand(x, y, radius = 9) {
  for (const [dx, dy] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
    if (terrainAt(x + dx, y + dy) === '#') return false;
  }
  if (obstacles.some(o => Math.hypot(x - o.x, y - o.y) < radius + o.radius)) return false;
  return !forgeOpen || !forgeObstacles.some(o => Math.hypot(x - o.x, y - o.y) < radius + o.radius);
}

export function moveBody(body, dx, dy) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  const largest = Math.max(Math.abs(dx), Math.abs(dy));
  if (largest > 1280) { const ratio = 1280 / largest; dx *= ratio; dy *= ratio; }
  // Малые шаги не позволяют пройти сквозь дерево даже при максимальной скорости.
  const steps = Math.min(256, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5)));
  for (let i = 0; i < steps; i++) {
    if (canStand(body.x + dx / steps, body.y, body.radius)) body.x += dx / steps;
    if (canStand(body.x, body.y + dy / steps, body.radius)) body.y += dy / steps;
  }
}
