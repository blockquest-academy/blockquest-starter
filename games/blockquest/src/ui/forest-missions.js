import { PHASE_ORDER, SAYS_ORDER } from '../engine/forest.js';

// Урок 04: вкладки лаборатории. Подробные шаги — в панели BlockQuest в VS Code; здесь коротко, что проверяет игра.
export const forestMissions = {
  easy: {
    label: 'Easy', title: 'Фонари леса', tag: '08–20 минут', file: 'forest.js',
    story: 'За воротами темно. Три фонаря светят кругами: Древень гонится по всему лесу, но в круг света не заходит. Яркость считается одной формулой три раза.',
    goal: 'Напиши функцию glow(size), которая считает яркость один раз: return size * 20 + 10; Замени три вычисления вызовами glow(2), glow(4), glow(6). Сохрани и войди в лес через восточные ворота.',
    purpose: 'Повтор урока 03: функция — рецепт с именем, size в скобках — что кладём, return — что получаем. glow вызываешь ты сам, поэтому export ей не нужен. Числа над фонарями и круги света берутся из твоего файла.',
    hints: ['Три строки lanternSmall, lanternMedium, lanternBig считают одно и то же разными числами. Что одинаковое, а что меняется?', 'Над фонарями напиши function glow(size) { return size * 20 + 10; } — четыре строки со скобками. Справа от = у lanternSmall напиши glow(2).', 'function glow(size) {\n  return size * 20 + 10;\n}\nexport const lanternSmall = glow(2);\nexport const lanternMedium = glow(4);\nexport const lanternBig = glow(6);\nСохрани: над фонарями 50, 90, 130.'],
    check: 'Что получает glow и что возвращает? Почему у неё нет export? Сделай большой фонарь glow(8): какой круг стал?',
    success: 'Фонари светят по твоей функции, лес открыт.',
    testInstruction: 'Функция готова. Пройди через восточные ворота в лес и посмотри на круги света.',
    waiting: 'Жду функцию с тремя вызовами в student/forest.js.',
    matches: state => Boolean(state.glow),
    tested: evidence => evidence.entered,
  },
  normal: {
    label: 'Normal', title: 'Фазы Древня', tag: '20–62 минуты', file: 'forest.js',
    story: 'Древень спрашивает у твоей функции, в какой он фазе. Он зовёт её при каждом ударе и передаёт своё здоровье.',
    goal: 'Напиши export function treantPhase(health): выше 60 — "calm", выше 30 — "angry", иначе — "giant". Сохрани и ударь Древня: смотри на цвет листвы, глаза и размер.',
    purpose: 'if / else if / else — цепочка: игра идёт сверху вниз и останавливается на первом верном условии. Граница важна: 61 — ещё спокойный, 60 — уже злой. Это разница между > и >=.',
    hints: ['Устроена как onHit из урока 03: export function treantPhase(health) { ... }. Сначала верни одно слово: return "calm"; — и посмотри на таблицу.', 'Два случая: if (health > 60) { return "calm"; } else { return "angry"; } Сравни строки 61 и 60 в таблице.', 'Три случая: if (health > 60) { return "calm"; } else if (health > 30) { return "angry"; } else { return "giant"; }'],
    check: 'Какая фаза при здоровье 61? А 60? Почему молотом Древень не злится, а сразу становится великаном? Что изменится, если написать >= вместо >?',
    success: 'Фазы сходятся на всех числах, Древень слушает твою функцию.',
    testInstruction: 'Функция есть. Исправь строки с ✘ по таблице и сохрани снова.',
    waiting: 'Жду функцию treantPhase в student/forest.js.',
    matches: state => !['missing', 'invalid'].includes(state.phase.status),
    tested: (evidence, state) => state.phase.status === 'passed',
  },
  challenge: {
    label: 'Challenge', title: 'Помощник внутри', tag: '68–85 минут', file: 'forest.js',
    story: 'Условие тоже можно назвать. Своя функция без export отвечает да или нет, а treantPhase спрашивает её.',
    goal: 'Напиши function isDanger(health) { return health <= 30; } и используй её внутри treantPhase: if (isDanger(health)) { return "giant"; }. Для быстрых: treantSays(phase) — слова Древня на каждую фазу.',
    purpose: 'Сравнение health <= 30 — это значение да/нет (true или false), как guardianStunnable в уроке 02. Функция может вернуть его, а if — проверить. Помощника вызываешь ты, внутри своей функции, поэтому export ему не нужен.',
    hints: ['Сначала напиши помощника отдельно: function isDanger(health) { return health <= 30; } — без export, выше treantPhase.', 'Внутри treantPhase замени сравнение на вызов: if (isDanger(health)) { return "giant"; }. Таблица фаз должна остаться зелёной.', 'Слова Древня: export function treantSays(phase) { if (phase === "giant") { return "Я ВЫРОС!"; } ... } — текст сравнивают через ===.'],
    check: 'Что возвращает isDanger(30)? А isDanger(31)? Какого это типа? Почему у isDanger нет export, а у treantPhase есть?',
    success: 'Помощник отвечает да или нет, фазы сходятся.',
    testInstruction: 'Помощник есть. Проверь, что таблица фаз снова вся ✔.',
    waiting: 'Жду свою функцию без export, вызванную внутри treantPhase.',
    matches: state => Boolean(state.helper),
    tested: (evidence, state) => Boolean(state.helper) && state.phase.status === 'passed',
  },
};

export const freshForestEvidence = () => ({ entered: false, treantHits: 0, phases: [], defeated: false });
export const forestState = results => results;
export function evaluateForestMission(level, state, evidence, warnings = []) {
  const mission = forestMissions[level];
  const configured = warnings.length === 0 && Boolean(state?.phase) && Boolean(mission.matches(state));
  return { configured, tested: configured && Boolean(mission.tested(evidence, state)) };
}
export const FOREST_CARDS = { phase: PHASE_ORDER, says: SAYS_ORDER };
