import { missing, wrongType, stripComments } from './guardian.js';

// Урок 03: кузнец куёт оружие героя из student/forge.js и проверяет функции ученика по заказам.
// Кроме урона оружие отличается характером: откат между ударами, дальность, отбрасывание и оглушение.
export const WEAPONS = {
  sword: { key: 'swordDamage', name: 'Меч', metal: 'железо', power: 2, slot: 1, cooldown: 0.55, reach: 80, push: 24, stun: 1, pace: 'быстрый' },
  axe: { key: 'axeDamage', name: 'Топор', metal: 'сталь', power: 5, slot: 2, cooldown: 0.85, reach: 96, push: 36, stun: 1, pace: 'обычный' },
  hammer: { key: 'hammerDamage', name: 'Молот', metal: 'кристалл', power: 9, slot: 3, cooldown: 1.3, reach: 112, push: 52, stun: 1.6, pace: 'медленный' },
};
export const PULSE_STATS = { cooldown: 0.85, reach: 96, push: 34, stun: 1 };
export const FORGING_TIME = 2.6;
export const WEAPON_ORDER = ['sword', 'axe', 'hammer'];
export const FORGE_DEFAULTS = { swordDamage: 10, axeDamage: 22, hammerDamage: 38 };
export const FORGE_LIMITS = { swordDamage: [0, 100_000], axeDamage: [0, 100_000], hammerDamage: [0, 100_000] };
export const FORGE_RECOMMENDED = { swordDamage: '5–50', axeDamage: '10–80', hammerDamage: '20–120' };

// Урон оружия — число, как pulseDamage в уроке 02: текст в кавычках останавливает игру.
export function validateForge(raw = {}) {
  const settings = {};
  const warnings = [];
  const errors = [];
  for (const [key, [min, max]] of Object.entries(FORGE_LIMITS)) {
    const value = raw[key], fallback = FORGE_DEFAULTS[key];
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

const c = (args, expected) => ({ args: [].concat(args), expected });
// Заказы кузнеца: игра вызывает функцию ученика с этими числами. Скрытые случаи не дают подогнать ответ.
export const ORDERS = {
  armor: {
    title: 'Броня', fn: 'armor', params: 'metal', item: 'Щит', reward: 'shield',
    story: 'Кузнец просит рецепт брони: защита в два раза больше силы металла.',
    goal: 'Напиши функцию armor(metal), которая возвращает силу металла × 2. Кузнец проверит её на числах 1, 5 и 10.',
    cases: [c(1, 2), c(5, 10), c(10, 20)], hidden: [c(7, 14)],
    hints: ['Функция устроена как forge: получает metal, что-то считает и отдаёт ответ через return.', 'Начни со строки export function armor(metal) { и закрой скобку } ниже. Внутри нужна одна строка с return.', 'Три строки: export function armor(metal) { return metal * 2; } Сохрани — кузнец проверит заказ на манекене.'],
  },
  spark: {
    title: 'Потерянный рецепт искры', fn: 'spark', params: 'metal', item: 'Искра', reward: 'spark',
    story: 'Рецепт искры потерян. Осталась только таблица ответов кузнеца.',
    goal: 'Посмотри на таблицу: spark(1) → 10, spark(2) → 20, spark(3) → 30. Догадайся, что делает рецепт, и напиши функцию spark(metal), которая даёт такие же ответы.',
    cases: [c(1, 10), c(2, 20), c(3, 30)], hidden: [c(6, 60)],
    hints: ['Сравни вход и ответ: 1 → 10, 2 → 20, 3 → 30. Во сколько раз ответ больше входа?', 'Ответ всегда в 10 раз больше. Значит, внутри функции нужно умножить metal на 10.', 'export function spark(metal) { return metal * 10; } Сохрани и проверь таблицу.'],
  },
  lightning: {
    title: 'Потерянный рецепт молнии', fn: 'lightning', params: 'metal', item: 'Молния', reward: 'lightning',
    story: 'Самый ценный рецепт кузнеца. Угадаешь — импульс станет молнией.',
    goal: 'Таблица: lightning(1) → 5, lightning(2) → 7, lightning(3) → 9, lightning(10) → 23. Найди закономерность и напиши функцию lightning(metal). Подсказка: сначала посмотри, на сколько растёт ответ, когда metal растёт на 1.',
    cases: [c(1, 5), c(2, 7), c(3, 9), c(10, 23)], hidden: [c(7, 17)],
    hints: ['Когда metal растёт на 1, ответ растёт на 2. Значит, в формуле есть × 2.', 'metal × 2 даёт 2, 4, 6 — а нужно 5, 7, 9. Сколько не хватает каждый раз?', 'export function lightning(metal) { return metal * 2 + 3; } Проверь на 10: 20 + 3 = 23.'],
  },
};
// Для быстрых: текст и условие внутри функции.
export const EXTRA_ORDERS = {
  weaponTitle: {
    title: 'Имя оружия', fn: 'weaponTitle', params: 'name', item: 'Табличка',
    goal: 'Функция weaponTitle(name) получает имя и возвращает текст «Меч » + имя: weaponTitle("Гром") → "Меч Гром". Не забудь пробел внутри кавычек.',
    cases: [c('Гром', 'Меч Гром'), c('Искра', 'Меч Искра')], hidden: [c('Буря', 'Меч Буря')],
    hints: ['Плюс склеивает текст: "Меч " + name.', 'export function weaponTitle(name) { return "Меч " + name; }', 'Если получилось "МечГром" — пробела нет внутри кавычек.'],
  },
  healthAfterHit: {
    title: 'Здоровье не уходит в минус', fn: 'healthAfterHit', params: 'health, damage', item: 'Оберег',
    goal: 'Функция healthAfterHit(health, damage) возвращает здоровье после удара, но не меньше 0: healthAfterHit(50, 20) → 30, healthAfterHit(10, 15) → 0. Два входа и одно условие if.',
    cases: [c([50, 20], 30), c([10, 15], 0), c([20, 20], 0)], hidden: [c([7, 100], 0), c([100, 1], 99)],
    hints: ['Обычно ответ health - damage. Когда он меньше нуля, нужно вернуть 0.', 'Внутри функции: if (health - damage < 0) { return 0; } и ниже return health - damage;', 'export function healthAfterHit(health, damage) { if (health - damage < 0) { return 0; } return health - damage; }'],
  },
};
// Манекен: игра вызывает onHit при каждом ударе по нему. Три удара подряд должны дать 1, 2, 3.
export const HITS_ORDER = {
  title: 'Счёт ударов', fn: 'onHit', params: '', item: 'Счётчик', expected: [1, 2, 3],
  story: 'Манекен у кузницы вызывает твою функцию onHit при каждом ударе. То, что она вернёт, появится над манекеном.',
  goal: 'Напиши функцию onHit(), которая считает удары: после трёх ударов подряд она должна вернуть 1, 2 и 3. Для памяти между ударами нужна коробка let hits = 0 выше функции.',
  hints: ['Сначала верни любой текст: return "Ай!"; — ударь манекен и посмотри, что появилось над ним.', 'Чтобы считать, нужна память: let hits = 0; выше функции. Внутри: hits = hits + 1; и return hits;', 'let hits = 0;\nexport function onHit() {\n  hits = hits + 1;\n  return hits;\n}\nПопробуй заменить let на const или перенести let hits внутрь функции — и объясни, что изменилось.'],
};
export const SECRET_RECIPE = { fn: 'secretRecipe', params: 'metal', inputs: [1, 2, 3, 4, 5] };

export const describeShort = value => {
  if (value === undefined) return 'ничего';
  if (typeof value === 'number') return Number.isNaN(value) ? 'NaN' : String(value);
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'function') return 'функция';
  return 'непонятное значение';
};
const call = (fn, args) => `${fn}(${args.map(describeShort).join(', ')})`;
// Ошибка внутри функции ученика — своими словами, как подсказки урока 02.
export function explainCall(error) {
  const message = String(error?.message || '');
  const undefinedName = /^(\S+) is not defined/.exec(message) || /Can't find variable: (\S+)/.exec(message);
  if (undefinedName) return `имя ${undefinedName[1]} не найдено. Оно написано в скобках функции?`;
  if (/assignment to const/i.test(message)) return 'const нельзя изменить: объяви это имя через let.';
  if (/is not a function/.test(message)) return 'вызов не функции: проверь имя перед скобками.';
  return `ошибка: ${message || 'неизвестная'}`;
}
function distance(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return dp[b.length];
}
// Опечатка в имени функции: «жду armor, а в файле есть armr».
export function nearestName(name, candidates) {
  const lower = name.toLowerCase();
  let best = null, bestDistance = 3;
  for (const candidate of candidates) {
    if (candidate === name) continue;
    const d = distance(lower, candidate.toLowerCase());
    if (d < bestDistance) { best = candidate; bestDistance = d; }
  }
  return best;
}
const definedInSource = (source, fn) => new RegExp(`\\bfunction\\s+${fn}\\s*\\(`).test(stripComments(source));
function exportedFunctions(module) {
  return Object.entries(module || {}).filter(([, value]) => typeof value === 'function').map(([name]) => name);
}
function missingMessage(order, module, source) {
  const { fn, params } = order;
  if (definedInSource(source, fn)) return `Функция ${fn} есть в файле, но игра её не видит: нужен export перед function.`;
  const near = nearestName(fn, exportedFunctions(module));
  if (near) return `Жду функцию ${fn}, а в файле есть ${near}. Проверь буквы.`;
  return `Жду функцию ${fn} в student/forge.js: export function ${fn}(${params}) { ... }`;
}
function noteFor(got, expected) {
  if (got === undefined) return 'функция ничего не вернула — где return?';
  if (typeof got === 'number' && Number.isNaN(got)) return 'получилось NaN: в вычислении не число. Имя из скобок функции написано без ошибок?';
  if (typeof expected === 'number' && typeof got === 'string') return `получился текст ${describeShort(got)} — а нужно число. Убери кавычки у результата.`;
  if (typeof expected === 'string' && typeof got === 'number') return `получилось число ${got} — а нужно текст в кавычках.`;
  return `жду ${describeShort(expected)}, получил ${describeShort(got)}`;
}
function runCase(order, fn, { args, expected }) {
  const row = { call: call(order.fn, args), expected: describeShort(expected), got: '', ok: false, note: '', error: false };
  let got;
  try { got = fn(...args); }
  catch (error) { row.error = true; row.got = 'ошибка'; row.note = explainCall(error); return row; }
  row.got = describeShort(got);
  row.ok = Object.is(got, expected) || typeof got === 'string' && typeof expected === 'string' && got.trim() === expected;
  if (!row.ok) row.note = noteFor(got, expected);
  return row;
}
// Результат заказа: статус для карточки, строки «дали → ждём → получили» и одна фраза кузнеца.
export function runOrder(order, module, source = '') {
  const fn = module?.[order.fn];
  if (fn === undefined) return { status: 'missing', message: missingMessage(order, module, source), rows: [] };
  if (typeof fn !== 'function') return { status: 'invalid', message: `${order.fn} — не функция. Нужно: export function ${order.fn}(${order.params}) { ... }`, rows: [] };
  const rows = order.cases.map(testCase => runCase(order, fn, testCase));
  const hidden = order.hidden.map(testCase => ({ ...runCase(order, fn, testCase), hidden: true }));
  const failed = [...rows, ...hidden].find(row => !row.ok);
  if (!failed) return { status: 'passed', message: `Заказ выполнен: ${order.item.toLowerCase()} на стойке.`, rows };
  const message = failed.error ? `${failed.call} остановилась с ошибкой: ${failed.note}`
    : failed.hidden ? `Проверка на другом числе — ${failed.call}: ${failed.note}. Формула должна работать для любого числа.`
    : `${failed.call}: ${failed.note}`;
  return { status: failed.error ? 'error' : 'failed', message, rows: failed.hidden ? [...rows, failed] : rows };
}
// Число в конце ответа: 3, "Удар 3" и "3 удара" — для счёта ударов считаются тройкой.
export function trailingNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = /(-?\d+)\s*[^\d]*$/.exec(value);
  return match ? Number(match[1]) : null;
}
export function checkHits(module, source = '', returns = []) {
  const fn = module?.onHit;
  if (fn === undefined) return { status: 'missing', message: missingMessage(HITS_ORDER, module, source), rows: [] };
  if (typeof fn !== 'function') return { status: 'invalid', message: 'onHit — не функция. Нужно: export function onHit() { ... }', rows: [] };
  const rows = HITS_ORDER.expected.map((expected, i) => {
    const row = { call: `удар ${i + 1}`, expected: String(expected), got: '…', ok: false, note: '' };
    if (i >= returns.length) return row;
    const got = returns[i];
    row.got = describeShort(got); row.ok = trailingNumber(got) === expected;
    if (!row.ok) {
      row.note = got === undefined ? 'функция ничего не вернула — где return?'
        : trailingNumber(got) === null ? 'в ответе нет числа: верни hits или "Удар " + hits'
        : i > 0 && trailingNumber(got) === trailingNumber(returns[i - 1]) ? 'счётчик не запомнил удар. Коробка hits создаётся заново при каждом вызове? Вынеси let hits = 0 выше функции.'
        : `жду ${expected}, получил ${describeShort(got)}`;
    }
    return row;
  });
  const failed = rows.find(row => row.got !== '…' && !row.ok);
  if (failed) return { status: 'failed', message: `${failed.call}: ${failed.note}`, rows };
  if (returns.length >= HITS_ORDER.expected.length) return { status: 'passed', message: 'Манекен досчитал до трёх: счётчик помнит удары.', rows };
  return { status: 'waiting', message: returns.length ? `Пока верно. Ударь манекен ещё ${HITS_ORDER.expected.length - returns.length} раз(а).` : 'Функция есть. Ударь манекен три раза: пробел рядом с ним.', rows };
}
// Таблица чужого рецепта для дуэли: сосед видит только ответы и угадывает формулу.
export function secretTable(module) {
  const fn = module?.[SECRET_RECIPE.fn];
  if (typeof fn !== 'function') return null;
  return SECRET_RECIPE.inputs.map(input => {
    try { return { input, output: describeShort(fn(input)) }; } catch { return { input, output: 'ошибка' }; }
  });
}
export function evaluateOrders(module, source = '', returns = []) {
  const results = {};
  for (const [key, order] of Object.entries({ ...ORDERS, ...EXTRA_ORDERS })) results[key] = runOrder(order, module, source);
  results.hits = checkHits(module, source, returns);
  results.secret = secretTable(module);
  return results;
}
// Рецепт кузнеца: своя функция без export, вызванная не меньше трёх раз (меч, топор, молот).
export function recipeFunction(source = '') {
  const code = stripComments(source);
  for (const match of code.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    const name = match[1];
    const calls = [...code.matchAll(new RegExp(`\\b${name.replace('$', '\\$')}\\s*\\(`, 'g'))].length - 1;
    if (calls >= 3) return { name, calls };
  }
  return null;
}
