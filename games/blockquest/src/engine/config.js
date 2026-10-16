export const LIMITS = {
  playerSpeed: [0, 100, 3],
  playerHealth: [1, 1_000_000, 100],
  monsterSpeed: [0, 100, 2],
  crystalPoints: [0, 1_000_000, 10],
  crystalsToWin: [1, 22, 15],
};

export const DEFAULT_CONFIG = Object.fromEntries(Object.entries(LIMITS).map(([key, values]) => [key, values[2]]));
export const RECOMMENDED = { playerSpeed: '1–8', playerHealth: '20–300', monsterSpeed: '0–5', crystalPoints: '1–100', crystalsToWin: '1–22' };

export function validateConfig(raw) {
  const config = {};
  const warnings = [];
  for (const [name, [min, max, fallback]] of Object.entries(LIMITS)) {
    const value = raw[name];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      config[name] = fallback;
      warnings.push(`${name}: нужно число. Пока используется ${fallback}.`);
    } else {
      config[name] = Math.min(max, Math.max(min, value));
      if (name !== 'playerSpeed' && name !== 'monsterSpeed') config[name] = Math.round(config[name]);
      if (config[name] !== value) warnings.push(name === 'crystalsToWin' && value > 22
        ? `crystalsToWin: на острове 22 кристалла. Применена цель 22 вместо ${value}.`
        : `${name}: применено ${config[name]} вместо ${value}. Технические пределы ${min}–${max}${name.includes('Speed') ? '' : ', целое число'}.`);
    }
  }
  return { config, warnings };
}
