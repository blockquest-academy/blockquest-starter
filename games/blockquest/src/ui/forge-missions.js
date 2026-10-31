import { ORDERS, EXTRA_ORDERS, HITS_ORDER, recipeFunction } from '../engine/forge.js';

export const forgeMissions = {
  easy: {
    label: 'Easy', title: 'Рецепт кузнеца', tag: '18–35 минут', file: 'forge.js',
    story: 'Кузнец куёт меч, топор и молот по одной формуле. Пока она написана три раза подряд.',
    goal: 'Напиши функцию forge(metal), которая считает урон один раз: return metal * 4 + 2; Замени три вычисления вызовами forge(2), forge(5) и forge(9). Сохрани, выбери оружие клавишей 1, 2 или 3 и ударь им хранителя, слизня или манекен.',
    purpose: 'Функция — рецепт с именем: function forge(metal) { ... }. metal — что кладём в рецепт при вызове, return — что рецепт отдаёт обратно. Вызов forge(5) кладёт 5 в metal и даёт ответ. Рецепт без export видит только твой файл, игра получает результат — число урона.',
    hints: ['Три строки считают одно и то же разными числами. Что в них одинаковое, а что меняется?', 'Над оружием напиши function forge(metal) { return metal * 4 + 2; } — четыре строки со скобками. Затем справа от = у swordDamage напиши forge(2).', 'function forge(metal) {\n  return metal * 4 + 2;\n}\nexport const swordDamage = forge(2);\nexport const axeDamage = forge(5);\nexport const hammerDamage = forge(9);\nСохрани: «Игра получила» покажет 10, 22, 38.'],
    check: 'Что получает forge и что возвращает? Что будет, если убрать return? А если вызвать forge() без числа? Поменяй + 2 на + 5 в одном месте: что изменилось у всех трёх?',
    success: 'Оружие посчитано твоей функцией и проверено ударом.',
    testInstruction: 'Функция готова. Выбери оружие клавишей 1, 2 или 3 и ударь им кого-нибудь.',
    waiting: 'Жду функцию с тремя вызовами в student/forge.js.',
    matches: state => Boolean(state.recipe),
    tested: evidence => evidence.weaponHits > 0,
  },
  normal: {
    label: 'Normal', title: 'Заказы кузнеца', tag: '62–72 минуты', file: 'forge.js',
    story: 'На доске два заказа. Кузнец сам проверит твои функции на манекене.',
    goal: 'Заказ «Броня»: функция armor(metal) возвращает силу × 2. Заказ «Потерянный рецепт искры»: по таблице ответов угадай формулу и напиши функцию spark(metal). Сохрани файл и смотри на манекен.',
    purpose: 'export function — функция, которую вызывает игра, а не ты. Игра кладёт свои числа в скобки и сравнивает ответ с заказом. Таблица «вызов → ждём → получили» показывает каждый вызов.',
    hints: ['Обе функции устроены как forge: имя, скобки с metal, return с вычислением.', 'export function armor(metal) { return metal * 2; } — и такая же по форме spark. Чтобы найти формулу искры, сравни вход и ответ в таблице.', 'Подсказки к каждому заказу — в его карточке ниже. Сохраняй после каждой функции: кузнец проверит её сразу.'],
    check: 'Чем armor отличается от forge? Почему у заказов есть export, а у forge нет? Как ты нашёл формулу искры?',
    success: 'Оба заказа выполнены: щит и искра на стойке.',
    testInstruction: 'Функции есть. Исправь строки с ✘ по подсказке кузнеца и сохрани снова.',
    waiting: 'Жду функции armor и spark в student/forge.js.',
    matches: state => ['armor', 'spark'].every(key => !['missing', 'invalid'].includes(state.results[key].status)),
    tested: (evidence, state) => ['armor', 'spark'].every(key => state.results[key].status === 'passed'),
  },
  challenge: {
    label: 'Challenge', title: 'Молния и счётчик', tag: '72–85 минут', file: 'forge.js',
    story: 'Самый ценный рецепт и функция с памятью. Манекен вызывает onHit при каждом ударе.',
    goal: 'Заказ «Потерянный рецепт молнии»: найди формулу по четырём ответам и напиши lightning(metal). Заказ «Счёт ударов»: функция onHit() должна считать удары по манекену — после трёх ударов вернуть 1, 2 и 3.',
    purpose: 'Функция забывает всё после return. Чтобы помнить удары, коробка let hits = 0 должна стоять снаружи функции, выше неё. hits = hits + 1 меняет коробку при каждом вызове — поэтому нужен let, а не const.',
    hints: ['Молния: на сколько растёт ответ, когда metal растёт на 1? Счётчик: сначала верни любой текст и посмотри на манекен.', 'Молния: metal × 2 даёт 2, 4, 6 — сколько не хватает до 5, 7, 9? Счётчик: let hits = 0; выше функции, внутри hits = hits + 1; и return hits;', 'Подсказки к каждому заказу — в карточках ниже. После счётчика попробуй const вместо let и let внутри функции: объясни, что увидел.'],
    check: 'Почему let hits стоит снаружи функции? Что скажет игра, если написать const hits? Что покажет манекен, если перенести let hits внутрь функции? Почему?',
    success: 'Молния выкована, манекен досчитал до трёх.',
    testInstruction: 'Функции есть. Молнию проверит кузнец, счётчик — три удара по манекену.',
    waiting: 'Жду функции lightning и onHit в student/forge.js.',
    matches: state => ['lightning', 'hits'].every(key => !['missing', 'invalid'].includes(state.results[key].status)),
    tested: (evidence, state) => state.results.lightning.status === 'passed' && state.results.hits.status === 'passed',
  },
};

export const freshForgeEvidence = () => ({ weaponHits: 0, dummyHits: 0 });
export const forgeState = (source, results) => ({ recipe: recipeFunction(source), results });
export function evaluateForgeMission(level, state, evidence, warnings = []) {
  const mission = forgeMissions[level];
  const configured = warnings.length === 0 && Boolean(state?.results) && Boolean(mission.matches(state));
  return { configured, tested: configured && Boolean(mission.tested(evidence, state)) };
}
// Карточки заказов по вкладкам; «для быстрых» — отдельно во вкладке Challenge.
export const tierOrders = { easy: [], normal: ['armor', 'spark'], challenge: ['lightning', 'hits'] };
export const ORDER_CARDS = { ...ORDERS, hits: HITS_ORDER };
export const EXTRA_CARDS = EXTRA_ORDERS;
export const MAIN_ORDERS = ['armor', 'spark', 'lightning', 'hits'];
