// Урок 03: паук стережёт ворота в лес. Панцирь делает оружие осмысленным: меч скользит, молот пробивает.
export const SPIDER_HOME = { x: 850, y: 326 };
export const SPIDER = {
  name: 'Паук у ворот', says: 'Ворота мои. Уходи.', health: 120, damage: 25, radius: 15, bodyRadius: 13,
  territory: 200, sight: 170, webRange: 230, lungeRange: 150,
  lungeCooldown: 2.6, lungeTime: 0.32, lungeSpeed: 3.6, webCooldown: 4.2, webSpeed: 250, webbedTime: 2.4, webbedSlow: 0.45,
  respawn: 25,
};
// Панцирь: меч и обычный импульс бьют вполсилы, топор и молот — в полную.
export const CARAPACE = { sword: 0.5, pulse: 0.5, axe: 1, hammer: 1 };
export const spiderDamage = (damage, weapon) => Math.floor(damage * (CARAPACE[weapon ?? 'pulse'] ?? 1));

export function spawnSpider() {
  return {
    ...SPIDER_HOME, home: { ...SPIDER_HOME }, name: SPIDER.name, says: SPIDER.says, radius: SPIDER.radius, bodyRadius: SPIDER.bodyRadius,
    health: SPIDER.health, maxHealth: SPIDER.health, hits: 0, defeated: false, respawn: 0,
    stun: 0, flash: 0, chasing: false, facing: -1, phase: 1.3, lunge: 0, lungeCooldown: 1.2, lungeDirection: { x: 0, y: 0 }, webCooldown: 2.5,
  };
}
