// Урок 02: хранитель секретного кристалла. Свойства задаёт student/guardian.js.
export const GUARDIAN_HOME = { x: 528, y: 336 };
export const GUARDIAN_DEFAULTS = { guardianName: 'Хранитель', guardianColor: 'stone', guardianSays: 'Кто посмел войти в моё логово?', guardianHealth: 60, guardianSize: 1, pulseDamage: 10, guardianReward: 50, guardianDamage: 20, guardianStunnable: true, guardianRegen: 0, rageDamage: 20 };
export const GUARDIAN_COLORS = ['stone', 'red', 'blue', 'green', 'gold', 'purple'];
// Ученики пишут цвет по-английски, как в коде, но понимаем и русские слова.
const COLOR_ALIASES = { каменный: 'stone', серый: 'stone', красный: 'red', синий: 'blue', голубой: 'blue', зелёный: 'green', зеленый: 'green', золотой: 'gold', жёлтый: 'gold', желтый: 'gold', фиолетовый: 'purple' };
const SAYS_LENGTH = 60;
export const GUARDIAN_LIMITS = {
  guardianHealth: [1, 100_000],
  guardianSize: [0.5, 3],
  pulseDamage: [0, 100_000],
  guardianReward: [0, 1_000_000],
  guardianDamage: [0, 100_000],
  guardianRegen: [0, 10_000],
  rageDamage: [0, 100_000],
};
const DECIMAL = ['guardianSize', 'guardianRegen'];
export const GUARDIAN_RECOMMENDED = { guardianColor: GUARDIAN_COLORS.join(', '), guardianSays: `текст до ${SAYS_LENGTH} символов`, guardianHealth: '20–300', guardianSize: '0.5–3', pulseDamage: '5–50', guardianReward: '10–500', guardianDamage: '5–50', guardianStunnable: 'true или false', guardianRegen: '0–10', rageDamage: '5–100' };
const shown = value => typeof value === 'string' ? `«${value}»` : String(value);
export const missing = (key, fallback) => `${key}: игра не видит это имя. Проверь export перед const и буквы имени. Пока игра берёт ${shown(fallback)}.`;
// Урок 02 про типы данных: называем тип того, что написал ученик.
export function describeValue(value) {
  if (typeof value === 'string') return `текст "${value}"`;
  if (typeof value === 'number') return `число ${value}`;
  if (typeof value === 'boolean') return `да/нет ${value}`;
  if (typeof value === 'function') return 'функция';
  return 'непонятное значение';
}
export const wrongType = (key, value, need, fallback) => `${key}: ${describeValue(value)} — а здесь нужно ${need}. Пока игра берёт ${shown(fallback)}.`;
const NAME_LENGTH = 24;

// Неверный тип и пропавший export — ошибки: урок 02 показывает, что тип данных важен.
// Пределы, длина текста и незнакомый цвет — мягкие предупреждения с безопасным значением.
export function validateGuardian(raw = {}) {
  const settings = {};
  const warnings = [];
  const errors = [];
  const fail = (key, text) => errors.push({ key, text });
  const name = raw.guardianName;
  if (name === undefined) {
    settings.guardianName = GUARDIAN_DEFAULTS.guardianName;
    fail('guardianName', missing('guardianName', GUARDIAN_DEFAULTS.guardianName));
  } else if (typeof name !== 'string' || !name.trim()) {
    settings.guardianName = GUARDIAN_DEFAULTS.guardianName;
    if (typeof name === 'string') warnings.push(`guardianName: пустой текст. Напиши имя в кавычках, например "Огненный страж". Пока игра берёт «${GUARDIAN_DEFAULTS.guardianName}».`);
    else fail('guardianName', wrongType('guardianName', name, 'текст в кавычках, например "Огненный страж"', GUARDIAN_DEFAULTS.guardianName));
  } else {
    settings.guardianName = name.trim().slice(0, NAME_LENGTH);
    if (name.trim().length > NAME_LENGTH) warnings.push(`guardianName: имя длиннее ${NAME_LENGTH} символов, над хранителем показано начало.`);
  }
  for (const [key, [min, max]] of Object.entries(GUARDIAN_LIMITS)) {
    const value = raw[key];
    const fallback = GUARDIAN_DEFAULTS[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      settings[key] = fallback;
      fail(key, value === undefined ? missing(key, fallback)
        : wrongType(key, value, typeof value === 'string' ? 'число: убери кавычки' : 'число', fallback));
      continue;
    }
    settings[key] = Math.min(max, Math.max(min, value));
    if (!DECIMAL.includes(key)) settings[key] = Math.round(settings[key]);
    if (settings[key] !== value) warnings.push(`${key}: применено ${settings[key]} вместо ${value}. Технические пределы ${min}–${max}${DECIMAL.includes(key) ? '' : ', целое число'}.`);
  }
  const color = raw.guardianColor;
  const colorKey = typeof color === 'string' ? color.trim().toLowerCase() : '';
  settings.guardianColor = GUARDIAN_COLORS.includes(colorKey) ? colorKey : COLOR_ALIASES[colorKey] ?? GUARDIAN_DEFAULTS.guardianColor;
  if (color === undefined) fail('guardianColor', missing('guardianColor', GUARDIAN_DEFAULTS.guardianColor));
  else if (typeof color !== 'string') fail('guardianColor', wrongType('guardianColor', color, 'текст в кавычках, например "red"', 'stone'));
  else if (!GUARDIAN_COLORS.includes(colorKey) && !COLOR_ALIASES[colorKey]) warnings.push(`guardianColor: игра не знает цвет «${color}». Можно: ${GUARDIAN_COLORS.map(c => `"${c}"`).join(', ')}.`);
  // Склейка: "Я " + guardianName даёт текст, а 60 + 20 — число. Фразе нужен текст.
  const says = raw.guardianSays;
  settings.guardianSays = typeof says === 'string' ? says.trim().slice(0, SAYS_LENGTH) : GUARDIAN_DEFAULTS.guardianSays;
  if (says === undefined) fail('guardianSays', missing('guardianSays', GUARDIAN_DEFAULTS.guardianSays));
  else if (typeof says !== 'string') fail('guardianSays', wrongType('guardianSays', says, 'текст: возьми слова в кавычки', GUARDIAN_DEFAULTS.guardianSays));
  else if (says.trim().length > SAYS_LENGTH) warnings.push(`guardianSays: фраза длиннее ${SAYS_LENGTH} символов, хранитель скажет только начало.`);
  // Третий вид значения урока: да или нет — true или false без кавычек.
  const stunnable = raw.guardianStunnable;
  settings.guardianStunnable = typeof stunnable === 'boolean' ? stunnable : GUARDIAN_DEFAULTS.guardianStunnable;
  if (stunnable === undefined) fail('guardianStunnable', missing('guardianStunnable', true));
  else if (typeof stunnable !== 'boolean') fail('guardianStunnable', wrongType('guardianStunnable', stunnable, typeof stunnable === 'string' && /^(true|false)$/.test(stunnable.trim())
    ? 'да/нет: true и false пишутся без кавычек' : 'да/нет: true или false без кавычек', true));
  return { settings, warnings, errors };
}

export function spawnGuardian(settings) {
  const radius = 13 * settings.guardianSize;
  return {
    ...GUARDIAN_HOME, home: { ...GUARDIAN_HOME }, name: settings.guardianName,
    radius, bodyRadius: Math.min(radius, 14), size: settings.guardianSize,
    health: settings.guardianHealth, maxHealth: settings.guardianHealth,
    color: settings.guardianColor, says: settings.guardianSays, regenPool: 0,
    hits: 0, defeated: false, rage: false, stun: 0, flash: 0, chasing: false, phase: 0.6,
  };
}

// Точная проверка текста ученика: нужен собственный помощник без export и изменение let.
export function stripComments(source = '') {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'])\/\/.*$/gm, '$1');
}
export function hasHelperName(source) {
  return /^\s*(?:const|let)\s+[A-Za-z_$][\w$]*\s*=/m.test(stripComments(source));
}
export function hasLetReassignment(source) {
  const code = stripComments(source);
  const names = [...code.matchAll(/^\s*let\s+([A-Za-z_$][\w$]*)\s*=/gm)].map(match => match[1]);
  return names.some(name => new RegExp(`^\\s*${name.replace('$', '\\$')}\\s*[-+*/]?=(?!=)`, 'm').test(code));
}

// Строка, где ученик объявил имя: для панели ошибки «открой файл, строка N».
export function findLine(source = '', key) {
  const lines = source.split('\n');
  const exact = lines.findIndex(line => new RegExp(`^\\s*export\\s+(?:const|let)\\s+${key}\\b`).test(line));
  const loose = exact >= 0 ? exact : lines.findIndex(line => !line.trimStart().startsWith('//') && new RegExp(`\\b${key}\\b`).test(line));
  return loose >= 0 ? loose + 1 : null;
}
