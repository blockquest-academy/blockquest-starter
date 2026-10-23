const tiers = ['easy', 'normal', 'challenge'];
export function createLearningState(raw = {}, legacy = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {};
  const state = {
    phase: ['intro', 'play', 'lab'].includes(raw.phase) ? raw.phase : 'intro',
    level: tiers.includes(raw.level) ? raw.level : 'easy',
    discovered: raw.discovered === true,
    experimentOpen: raw.experimentOpen === true,
    aiNotes: Object.fromEntries(['idea', 'suggestion', 'test'].map(key => [key, typeof raw.aiNotes?.[key] === 'string' ? raw.aiNotes[key].slice(0, 2000) : ''])),
    prediction: typeof raw.prediction === 'string' ? raw.prediction.slice(0, 6) : '',
    hints: {}, progress: {},
  };
  for (const tier of tiers) {
    const hints = raw.hints?.[tier];
    state.hints[tier] = Number.isInteger(hints) ? Math.min(3, Math.max(0, hints)) : 0;
    state.progress[tier] = {
      done: raw.progress?.[tier]?.done === true,
      understood: raw.progress?.[tier]?.understood === true || legacy?.[tier] === true,
    };
  }
  return state;
}
export const nextHint = count => Math.min(3, Math.max(0, count) + 1);
export const freshEvidence = () => ({ distance: 0, picked: false, won: false, reward: null });

// Старые маршруты были про числа: сохраняем Easy, но новые задания требуют новой проверки.
export function migrateNumberLesson(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { phase: raw.phase, discovered: raw.discovered, experimentOpen: raw.experimentOpen,
    hints: { easy: raw.hints?.easy }, progress: { easy: raw.progress?.easy } };
}
