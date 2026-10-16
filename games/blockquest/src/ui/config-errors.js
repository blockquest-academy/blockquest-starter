import './config-errors.css';

// Подключается раньше игры: подсказка работает даже при ошибке в первом запуске.
const panel = document.querySelector('#config-error');
export function showConfigError(err) {
  const match = /student[/\\](config|rules)\.js/.exec(`${err.id || ''} ${err.message} ${err.loc?.file || ''}`);
  const studentFile = match?.[0].replaceAll('\\', '/');
  const isRule = match?.[1] === 'rules';
  panel.replaceChildren();
  const title = document.createElement('strong');
  title.textContent = err.initial ? 'Игра ещё не загрузилась' : studentFile ? 'Давай поправим настройку' : 'В файле есть ошибка';
  const message = document.createElement('p');
  message.textContent = studentFile
    ? `Открой ${studentFile}${err.loc?.line ? `, строка ${err.loc.line}` : ''}. ${isRule ? 'Проверь скобки условия, имя crystals и кавычки команды.' : 'Проверь знак =, число и точку с запятой.'} Сохрани файл ещё раз.`
    : 'Проверь последнюю изменённую строку в student/config.js или student/rules.js и сохрани файл. Если не получается, покажи ошибку преподавателю в терминале VS Code.';
  const note = document.createElement('p');
  note.textContent = document.documentElement.dataset.gameReady
    ? 'Игра на паузе и хранит последние применённые правила. После исправления можно продолжить.'
    : 'После исправления игра загрузится. Если не загрузилась — обнови страницу.';
  const example = document.createElement('code'); example.textContent = isRule ? 'crystals — число собранных кристаллов; команды: "shield" или "heal".' : 'export const playerSpeed = 3;';
  panel.append(title, message, ...(studentFile ? [example] : []), note);
  panel.hidden = false;
  window.dispatchEvent(new CustomEvent('blockquest:config-error', { detail: { file: studentFile || 'unknown' } }));
}

export function showLoadError() {
  if (panel.hidden) showConfigError({ initial: true });
}
if (import.meta.hot) {
  import.meta.hot.on('vite:error', ({ err }) => showConfigError(err));
  window.addEventListener('blockquest:config-applied', () => { panel.hidden = true; });
}
