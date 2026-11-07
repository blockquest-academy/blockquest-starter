import { missing, wrongType, stripComments } from './guardian.js';
import { describeShort, explainCall, runOrder, recipeFunction } from './forge.js';
import { LANTERN_SITES, TREANT_HOME } from '../world/forest.js';

// Урок 04: лес за воротами. Фонари светят по числам из student/forest.js, Древень меняет фазу по функции ученика.
export const LANTERN_ORDER = ['lanternSmall', 'lanternMedium', 'lanternBig'];
export const FOREST_DEFAULTS = { lanternSmall: 50, lanternMedium: 90, lanternBig: 130 };
export const FOREST_LIMITS = { lanternSmall: [0, 1000], lanternMedium: [0, 1000], lanternBig: [0, 1000] };
export const FOREST_RECOMMENDED = { lanternSmall: '20–200', lanternMedium: '20–200', lanternBig: '20–300' };
export const FOREST_FILE = 'student/forest.js';

// Яркость фонаря — число, как урон в уроке 03: текст в кавычках останавливает игру.
export function validateForest(raw = {}) {
  const settings = {};
  const warnings = [];
  const errors = [];
  for (const [key, [min, max]] of Object.entries(FOREST_LIMITS)) {
    const value = raw[key], fallback = FOREST_DEFAULTS[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      settings[key] = fallback;
      errors.push({ key, text: value === undefined ? missing(key, fallback) : wrongType(key, value, typeof value === 'string' ? 'число: убери кавычки' : 'число', fallback) });
      continue;
    }
    settings[key] = Math.round(Math.min(max, Math.max(min, value)));
    if (settings[key] !== value) warnings.push(`${key}: применено ${settings[key]} вместо ${value}. Технические пределы ${min}–${max}, целое число.`);
  }
  return { settings, warnings, errors };
}
export const lanternsFrom = settings => LANTERN_ORDER.map(key => ({ key, ...LANTERN_SITES[key], radius: settings[key] }));
export const inLight = (lanterns, p) => lanterns.some(l => l.radius > 0 && Math.hypot(p.x - l.x, p.y - l.y) < l.radius);

// Фазы Древня: спокойный выше 60, злой выше 30, великан — 30 и ниже. Граница — главный опыт урока.
export const PHASES = ['calm', 'angry', 'giant'];
export const PHASE_LABEL = { calm: 'спокойный', angry: 'злой', giant: 'великан' };
export const PHASE_RULE = health => health > 60 ? 'calm' : health > 30 ? 'angry' : 'giant';
export const DEFAULT_SAYS = { calm: 'Кто шумит в моём лесу?', angry: 'Ты меня разозлил!', giant: 'Я РАСТУ!' };
// Характер фаз: speed — шаг на поляне (от monsterSpeed), chase — погоня (доля скорости героя), урон касания, размер.
// Погоня считается от скорости героя: убежать нельзя, спасает только круг фонаря. Удары Древня не оглушают.
export const PHASE_STATS = {
  calm: { speed: 0.7, chase: 0.85, damage: 1, scale: 1.15 },
  angry: { speed: 1.5, chase: 1.15, damage: 1.5, scale: 1.15 },
  giant: { speed: 0.9, chase: 0.95, damage: 2, scale: 1.65 },
};
// standoff — насколько дальше края круга света Древень держится, пока герой в свете: дальше любого оружия.
export const TREANT = { name: 'Древень', health: 140, damage: 16, radius: 16, bodyRadius: 14, sight: 170, standoff: 160, respawn: 20, reward: 80 };
// Ближайший фонарь, в круге которого стоит точка: от него Древень отступает.
export const lanternLighting = (lanterns, p) => lanterns.find(l => l.radius > 0 && Math.hypot(p.x - l.x, p.y - l.y) < l.radius) ?? null;
export function spawnTreant() {
  return {
    ...TREANT_HOME, home: { ...TREANT_HOME }, name: TREANT.name, says: DEFAULT_SAYS.calm, radius: TREANT.radius, bodyRadius: TREANT.bodyRadius,
    health: TREANT.health, maxHealth: TREANT.health, hits: 0, defeated: false, respawn: 0, phase: 'calm',
    stun: 0, flash: 0, chasing: false, waiting: false, facing: -1, wobble: 0, grow: 0,
  };
}

const c = (args, expected) => ({ args: [].concat(args), expected });
// Заказ леса: игра вызывает treantPhase с этими числами. Скрытые случаи не дают подогнать ответы по одному.
export const PHASE_ORDER = {
  title: 'Фазы Древня', fn: 'treantPhase', params: 'health', item: 'Фазы', file: FOREST_FILE,
  done: 'Фазы сходятся на всех числах: Древень слушает твою функцию.',
  story: 'Древень спрашивает у твоей функции, в какой он фазе. Он зовёт её при каждом ударе и передаёт своё здоровье.',
  goal: 'Напиши функцию treantPhase(health): выше 60 здоровья — "calm", выше 30 — "angry", иначе — "giant". Игра проверит её на числах 100, 61, 60, 31, 30 и 1.',
  cases: [c(100, 'calm'), c(61, 'calm'), c(60, 'angry'), c(31, 'angry'), c(30, 'giant'), c(1, 'giant')], hidden: [c(80, 'calm'), c(45, 'angry'), c(10, 'giant')],
  hints: ['Устроена как onHit из урока 03: export function treantPhase(health) { ... } — её вызывает игра. Сначала верни одно слово: return "calm";', 'Два случая — if и else: if (health > 60) { return "calm"; } else { return "angry"; } Проверь строки 61 и 60 в таблице.', 'Три случая: if (health > 60) { return "calm"; } else if (health > 30) { return "angry"; } else { return "giant"; }'],
};
export const describePhase = value => PHASES.includes(value) ? `"${value}"` : describeShort(value);
// Слова Древня для быстрых: своя фраза на каждую фазу. Проверяем только тип: текст в кавычках на каждое слово.
export const SAYS_ORDER = { title: 'Слова Древня', fn: 'treantSays', params: 'phase', item: 'Слова', file: FOREST_FILE,
  goal: 'Функция treantSays(phase) получает слово фазы и возвращает, что скажет Древень: сравнение текста пишется так: phase === "giant".',
  hints: ['Текст сравнивают через ===: if (phase === "giant") { return "Я ВЫРОС!"; }', 'Три фазы — три if или цепочка if / else if / else, как в treantPhase, только сравниваем слово, а не число.', 'export function treantSays(phase) { if (phase === "giant") { return "Я ВЫРОС!"; } else if (phase === "angry") { return "Уходи из леса!"; } else { return "Тише..."; } }'],
};
export function checkSays(module, source = '') {
  const fn = module?.treantSays;
  if (fn === undefined) return { status: 'missing', message: definedInSource(source, 'treantSays') ? 'Функция treantSays есть в файле, но игра её не видит: нужен export перед function.' : `Жду функцию treantSays в ${FOREST_FILE}: export function treantSays(phase) { ... }`, rows: [] };
  if (typeof fn !== 'function') return { status: 'invalid', message: 'treantSays — не функция. Нужно: export function treantSays(phase) { ... }', rows: [] };
  const rows = PHASES.map(phase => {
    const row = { call: `treantSays("${phase}")`, expected: 'текст', got: '', ok: false, note: '' };
    try {
      const got = fn(phase); row.got = describeShort(got);
      row.ok = typeof got === 'string' && got.trim().length > 0;
      if (!row.ok) row.note = got === undefined ? 'функция ничего не вернула — где return?' : 'нужен текст в кавычках';
    } catch (error) { row.got = 'ошибка'; row.note = explainCall(error); }
    return row;
  });
  const failed = rows.find(row => !row.ok);
  if (failed) return { status: 'failed', message: `${failed.call}: ${failed.note}`, rows };
  return { status: 'passed', message: 'У Древня есть слова на каждую фазу. Подойди к нему и послушай.', rows };
}
const definedInSource = (source, fn) => new RegExp(`\\bfunction\\s+${fn}\\s*\\(`).test(stripComments(source));
// Помощник внутри: своя функция без export, которую ученик вызывает внутри treantPhase. Так условие получает имя.
export function helperInside(source = '', fn = 'treantPhase') {
  const code = stripComments(source);
  const start = new RegExp(`\\bfunction\\s+${fn}\\s*\\([^)]*\\)\\s*\\{`).exec(code);
  if (!start) return null;
  let depth = 0, i = start.index + start[0].length - 1;
  for (; i < code.length; i++) { if (code[i] === '{') depth++; else if (code[i] === '}' && --depth === 0) break; }
  const body = code.slice(start.index + start[0].length, i);
  for (const match of code.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const name = match[1];
    if (name !== fn && new RegExp(`\\b${name.replace('$', '\\$')}\\s*\\(`).test(body)) return name;
  }
  return null;
}
// Текущая фаза по функции ученика. Без функции Древень всегда спокоен; неверный ответ — предупреждение и покой.
export function phaseFor(module, health) {
  const fn = module?.treantPhase;
  if (typeof fn !== 'function') return { phase: 'calm', warning: '' };
  let value;
  try { value = fn(health); }
  catch (error) { return { phase: 'calm', warning: `Не удалось выполнить treantPhase в ${FOREST_FILE}: ${explainCall(error)}` }; }
  if (PHASES.includes(value)) return { phase: value, warning: '' };
  if (value === undefined) return { phase: 'calm', warning: `treantPhase(${health}) ничего не вернула — где return? Древень остался спокойным.` };
  return { phase: 'calm', warning: `treantPhase(${health}) вернула ${describeShort(value)}, а Древень понимает только "calm", "angry" или "giant" в кавычках.` };
}
export function saysFor(module, phase) {
  const fn = module?.treantSays;
  if (typeof fn === 'function') {
    try { const value = fn(phase); if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 60); } catch { /* слова по умолчанию */ }
  }
  return DEFAULT_SAYS[phase] ?? DEFAULT_SAYS.calm;
}
// Состояние файла для карточек: рецепт фонарей, таблица фаз, слова и помощник внутри.
export function evaluateForest(module, source = '') {
  return { glow: recipeFunction(source), phase: runOrder(PHASE_ORDER, module, source), says: checkSays(module, source), helper: helperInside(source) };
}
