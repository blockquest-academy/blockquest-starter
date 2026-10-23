import { missing, wrongType } from './guardian.js';

// Урок 02: обычные враги острова — слизни и жуки. Настройки в student/monsters.js.
export const MONSTER_DEFAULTS = { monsterHealth: 30 };
export const MONSTER_LIMITS = { monsterHealth: [1, 100_000] };
export const MONSTER_RECOMMENDED = { monsterHealth: '10–100' };

export function validateMonsters(raw = {}) {
  const settings = {};
  const warnings = [];
  const errors = [];
  for (const [key, [min, max]] of Object.entries(MONSTER_LIMITS)) {
    const value = raw[key], fallback = MONSTER_DEFAULTS[key];
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
