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

export const terrainAt = (x, y) => MAP[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? '#';
export const tileAt = (col, row) => MAP[row]?.[col] ?? '#';
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
  return !obstacles.some(o => Math.hypot(x - o.x, y - o.y) < radius + o.radius);
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
