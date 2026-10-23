import './config-errors.css';

// Подключается раньше игры: подсказка работает даже при ошибке в первом запуске.
const panel = document.querySelector('#config-error');
const FILE = /student[/\\](config|rules|guardian|monsters)\.js/;
const advice = {
  config: ['Проверь знак =, число и точку с запятой.', 'export const playerSpeed = 3;'],
  rules: ['Проверь скобки условия, имя crystals и кавычки команды.', 'crystals — число собранных кристаллов; команды: "shield" или "heal".'],
  guardian: ['Проверь кавычки у текста, знак = и точку с запятой.', 'export const guardianName = "Огненный страж";'],
  monsters: ['Проверь число, знак = и точку с запятой.', 'export const monsterHealth = 30;'],
};
const constantAdvice = name => [`Имя ${name || 'с const'} объявлено через const: его значение нельзя изменить. Если значение должно меняться, объяви его через let.`, `let ${name || 'reward'} = 10;\n${name || 'reward'} = ${name || 'reward'} * 2;`];

function showPanel({ title, message, example, file }) {
  panel.replaceChildren();
  const heading = document.createElement('strong'); heading.textContent = title;
  const text = document.createElement('p'); text.textContent = message;
  const note = document.createElement('p');
  note.textContent = document.documentElement.dataset.gameReady
    ? 'Игра на паузе и хранит последние применённые правила. После исправления можно продолжить.'
    : 'После исправления игра загрузится. Если не загрузилась — обнови страницу.';
  const code = document.createElement('code'); code.textContent = example ?? '';
  panel.append(heading, text, ...(example ? [code] : []), note);
  panel.hidden = false;
  window.dispatchEvent(new CustomEvent('blockquest:config-error', { detail: { file: file || 'unknown' } }));
}

export function showConfigError(err) {
  const match = FILE.exec(`${err.id || ''} ${err.message} ${err.loc?.file || ''}`);
  const studentFile = match?.[0].replaceAll('\\', '/');
  const kind = match?.[1];
  const constant = /^BQ_CONST:(.*)$/.exec(err.pluginCode || '');
  const [hint, example] = constant ? constantAdvice(constant[1]) : advice[kind] || [];
  showPanel({
    title: err.initial ? 'Игра ещё не загрузилась' : constant ? 'const нельзя изменить' : !studentFile ? 'В файле есть ошибка' : kind === 'guardian' ? 'Давай поправим хранителя' : 'Давай поправим настройку',
    message: studentFile
      ? `Открой ${studentFile}${err.loc?.line ? `, строка ${err.loc.line}` : ''}. ${hint} Сохрани файл ещё раз.`
      : 'Проверь последнюю изменённую строку в student/ и сохрани файл. Если не получается, покажи ошибку преподавателю в терминале VS Code.',
    example: studentFile ? example : null,
    file: studentFile,
  });
}

// Ошибки выполнения: синтаксис верный, но имя не найдено или const изменён.
export function explainRuntimeError(error) {
  const message = String(error?.message || '');
  const missing = /^(\S+) is not defined/.exec(message) || /Can't find variable: (\S+)/.exec(message);
  // Русское слово без кавычек JavaScript принимает за имя: подсказываем про текст.
  if (missing && /[А-Яа-яЁё]/.test(missing[1])) return [`Слово ${missing[1]} без кавычек игра считает именем и не находит. Похоже, это текст — возьми его в кавычки.`, `export const guardianName = "${missing[1]}";`];
  if (missing) return [`Имя ${missing[1]} не найдено. Проверь буквы: имя должно совпадать с объявленным выше через const или let. Если это текст — возьми его в кавычки.`, `const crystalPower = 5;\nexport const pulseDamage = crystalPower * 3;`];
  const early = /access (?:lexical declaration )?'([^']+)' before initialization/i.exec(message);
  if (early || /uninitialized variable/.test(message)) return [`Имя ${early?.[1] ?? ''} используется раньше, чем объявлено. Перенеси строку с его объявлением выше.`.replace('Имя  ', 'Имя '), null];
  const constant = /assignment to const(?:ant variable| '([^']+)')/i.exec(message);
  if (constant) return constantAdvice(constant[1] ?? '');
  return [`Код остановился с сообщением: ${message || 'неизвестная ошибка'}.`, null];
}

// Сбой загрузки модуля означает ошибку разбора: её уже показал обработчик vite:error со строкой.
const isLoadFailure = error => /dynamically imported module|Importing a module script failed/i.test(String(error?.message || ''));
export function showRuntimeError(file, error) {
  if (isLoadFailure(error)) return;
  const base = file.replace('student/', '').replace('.js', '');
  const line = new RegExp(`student/${base}\\.js(?:\\?[^:\\s)]*)?:(\\d+):\\d+`).exec(String(error?.stack || ''))?.[1];
  const [hint, example] = explainRuntimeError(error);
  showPanel({ title: 'Код не выполнился', message: `Открой ${file}${line ? `, строка ${line}` : ''}. ${hint} Сохрани файл ещё раз.`, example, file });
}

// Урок 02: неверный тип значения останавливает игру так же, как ошибка в записи.
export function showTypeError(file, errors, line, example) {
  const [first, ...rest] = errors;
  const others = rest.length ? ` Ещё ${rest.length === 1 ? 'одна ошибка' : `ошибок: ${rest.length}`}: ${rest.map(error => error.key).join(', ')}.` : '';
  showPanel({ title: 'Тип значения не подходит', message: `Открой ${file}${line ? `, строка ${line}` : ''}. ${first.text.replace(/ Пока игра берёт .*$/, '')}${others} Сохрани файл ещё раз.`, example, file });
}

export function showLoadError(error) {
  if (!panel.hidden) return;
  const file = FILE.exec(String(error?.stack || ''))?.[0].replaceAll('\\', '/');
  if (file && error instanceof Error && !(error instanceof SyntaxError) && !isLoadFailure(error)) showRuntimeError(file, error);
  else showConfigError({ initial: true });
}
if (import.meta.hot) {
  import.meta.hot.on('vite:error', ({ err }) => showConfigError(err));
  window.addEventListener('blockquest:config-applied', () => { panel.hidden = true; });
}
