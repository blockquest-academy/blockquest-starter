import { showLoadError } from './ui/config-errors.js';

// Обработчик ошибок готов до импорта ученического файла, включая первый запуск.
import('./main.js').catch(() => showLoadError());
