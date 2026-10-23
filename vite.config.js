import { defineConfig, transformWithEsbuild } from 'vite';

export default defineConfig({
  server: { hmr: { overlay: false } },
  plugins: [{
    name: 'student-config-syntax-feedback',
    enforce: 'pre',
    async transform(code, id) {
      // Vite не всегда разбирает синтаксис обычного JS до отправки браузеру.
      // Здесь обеспечиваем стандартный экран ошибки с точной строкой для новичка.
      const file = !id.includes('?') && /\/student\/(config|rules|guardian|monsters)\.js$/.exec(id)?.[1];
      if (!file) return;
      const result = await transformWithEsbuild(code, id, { loader: 'js' }).catch(error => {
        const location = error.errors?.[0]?.location;
        error.message = `Проверь запись в student/${file}.js.`;
        if (location) error.loc = { file: id, line: location.line, column: location.column };
        throw error;
      });
      // Изменение const падает только при запуске; сообщаем заранее и с номером строки.
      const constant = result.warnings?.find(warning => warning.id === 'assign-to-constant');
      if (constant) {
        const name = /"([^"]+)"/.exec(constant.text)?.[1] ?? '';
        const error = new Error(`В student/${file}.js имя ${name} объявлено через const, его нельзя изменить.`);
        error.pluginCode = `BQ_CONST:${name}`;
        if (constant.location) error.loc = { file: id, line: constant.location.line, column: constant.location.column };
        throw error;
      }
      // Исходный код идёт в браузер без изменений: номера строк в ошибках совпадают с файлом ученика.
      return null;
    },
  }],
});
