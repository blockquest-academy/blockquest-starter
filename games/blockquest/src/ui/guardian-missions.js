import { GUARDIAN_DEFAULTS, hasHelperName, hasLetReassignment } from '../engine/guardian.js';

export const guardianMissions = {
  easy: {
    label: 'Easy', title: 'Создай хранителя', tag: '12–28 минут', file: 'guardian.js',
    story: 'В центре острова живёт Хранитель секретного кристалла. Сегодня его создаёшь ты.',
    goal: 'Дай хранителю своё имя и измени его здоровье. Предскажи, что увидишь, сохрани файл и ударь хранителя импульсом (пробел).',
    purpose: 'Слева от = имя, справа значение. Три типа значений: текст в кавычках — "Огненный страж", число без кавычек — 80, да/нет — true или false без кавычек. Имена слева не меняй: по ним игра находит значения.',
    hints: ['Имя и здоровье хранителя — две строки в одном файле. Найди их по словам guardianName и guardianHealth.', 'Открой student/guardian.js. Справа от = у guardianName стоит текст в кавычках, у guardianHealth — число.', 'Замени "Хранитель" на своё имя в кавычках и 60 на другое число. Сохрани (Ctrl+S или ⌘S), нажми «Продолжить», подойди к хранителю и нажми пробел.'],
    check: 'Чем значение "Страж" отличается от значения 80? Какого типа значение true у guardianStunnable? Что будет, если убрать кавычки у имени? Проверь и верни их.',
    success: 'Твой хранитель создан и проверен ударом.',
    testInstruction: 'Хранитель возродился с новыми свойствами. Подойди к нему и нажми пробел.',
    waiting: 'Жду нового имени и здоровья в student/guardian.js.',
    matches: settings => settings.guardianName !== GUARDIAN_DEFAULTS.guardianName && settings.guardianHealth !== GUARDIAN_DEFAULTS.guardianHealth,
    tested: evidence => evidence.hits > 0,
  },
  normal: {
    label: 'Normal', title: 'Посчитай удары', tag: '28–45 минут', file: 'guardian.js',
    story: 'Импульс — твоё оружие. Рассчитай его силу и предскажи, сколько ударов выдержит хранитель.',
    goal: 'Создай имя для силы кристалла: const crystalPower = 5; и посчитай урон: pulseDamage = crystalPower * 3. Запиши прогноз ударов ниже, затем победи хранителя.',
    purpose: 'const создаёт новое имя для значения. Имя можно использовать в вычислениях: + сложить, - вычесть, * умножить, / разделить. Без export имя видит только твой файл, игра получает результат.',
    hints: ['Сначала посчитай словами: здоровье хранителя разделить на урон одного удара — столько ударов нужно.', 'Над строкой pulseDamage добавь свою строку const crystalPower = 5; Затем справа от = у pulseDamage используй это имя.', 'Нужны две строки: const crystalPower = 5; и export const pulseDamage = crystalPower * 3; Сохрани и проверь в лаборатории, какой урон получила игра.'],
    check: 'Сколько ударов ты предсказал и сколько понадобилось? Что изменится, если crystalPower станет 10? Почему у crystalPower нет export?',
    success: 'Урон посчитан твоим кодом, хранитель побеждён.',
    testInstruction: 'Урон посчитан. Запиши прогноз и победи хранителя импульсом.',
    waiting: 'Жду своей строки const и нового урона pulseDamage.',
    prediction: true,
    matches: (settings, source) => hasHelperName(source) && settings.pulseDamage !== GUARDIAN_DEFAULTS.pulseDamage,
    tested: evidence => evidence.defeated,
  },
  challenge: {
    label: 'Challenge', title: 'Секрет награды', tag: '50–75 минут', file: 'guardian.js',
    story: 'Сильный хранитель — большая награда. Пусть твой код сам считает награду из его здоровья.',
    goal: 'Создай let reward = guardianHealth; на следующей строке измени её: reward = reward * 2; и передай игре: export const guardianReward = reward; Победи хранителя и забери секретный кристалл.',
    purpose: 'let — имя, значение которого можно менять. reward = reward * 2 читаем справа налево: взять старое значение, умножить на 2 и положить обратно в reward. Значение const изменить нельзя — игра покажет ошибку.',
    hints: ['Какая награда честная? Чем больше здоровья у хранителя, тем больше очков. Прикинь число до кода.', 'Перед строкой guardianReward создай let reward = guardianHealth; и строку, которая меняет reward. Новое имя должно быть объявлено выше, чем используется.', 'Три строки: let reward = guardianHealth; reward = reward * 2; export const guardianReward = reward; Старую строку guardianReward замени последней. Сохрани, победи хранителя и забери секрет.'],
    check: 'Чему равна награда и почему? Чем let отличается от const? Дай другу прочитать твой файл: сможет ли он предсказать удары и награду до боя?',
    success: 'Награда посчитана через let, секретный кристалл найден.',
    testInstruction: 'Награда считается через let. Победи хранителя и подбери секретный кристалл.',
    waiting: 'Жду let reward, изменения reward и новой награды guardianReward.',
    matches: (settings, source) => hasLetReassignment(source) && settings.guardianReward !== GUARDIAN_DEFAULTS.guardianReward,
    tested: evidence => evidence.secret,
  },
};

export const freshGuardianEvidence = () => ({ hits: 0, defeated: false, secret: false, reward: 0, rageAt: null });

// Бонус Challenge: первое правило поведения монстра — то же if из урока 01, но для здоровья хранителя.
export const rageBonus = {
  goal: 'Пусть раненый хранитель злится и бьёт вдвое сильнее. Внутри готовой оболочки guardianMood напиши условие: если здоровья мало — return "rage";. Затем посчитай урон ярости: rageDamage = guardianDamage * 2. Сначала предскажи, после какого удара он разозлится.',
  hints: ['Скажи правило словами: если у хранителя осталось мало здоровья, он впадает в ярость. Сколько это «мало»?', 'Внутри оболочки guardianMood нужны if, сравнение health <= 20 и команда return "rage";. Знак <= читается «меньше или равно».', 'Напечатай внутри скобок: if (health <= 20) { return "rage"; }. Строку rageDamage замени на export const rageDamage = guardianDamage * 2; Сохрани и бей хранителя, пока его здоровье не станет 20 или меньше. Сравни урон до и после ярости.'],
};

export function evaluateGuardianMission(level, settings, source, evidence, warnings = []) {
  const mission = guardianMissions[level];
  const configured = warnings.length === 0 && Boolean(settings) && Boolean(mission.matches(settings, source));
  return { configured, tested: configured && Boolean(mission.tested(evidence)) };
}

// Урок по умолчанию задаёт преподаватель ссылкой в teacher/lessons/current.md.
export const LESSONS = [1, 2, 3];
export function parseCurrentLesson(text = '') {
  const lesson = Number(/lesson-(\d+)\.md/.exec(text)?.[1]);
  return LESSONS.includes(lesson) ? lesson : 1;
}
