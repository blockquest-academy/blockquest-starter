import { defineConfig, transformWithEsbuild } from 'vite';

export default defineConfig({
  server: { hmr: { overlay: false } },
  plugins: [{
    name: 'student-config-syntax-feedback',
    enforce: 'pre',
    transform(code, id) {
      // Vite не всегда разбирает синтаксис обычного JS до отправки браузеру.
      // Здесь обеспечиваем стандартный экран ошибки с точной строкой для новичка.
      if (!id.includes('?') && /\/student\/(config|rules)\.js$/.test(id)) {
        return transformWithEsbuild(code, id, { loader: 'js' }).catch(error => {
          const location = error.errors?.[0]?.location;
          error.message = `Проверь запись в student/${id.endsWith('/rules.js') ? 'rules' : 'config'}.js.`;
          if (location) error.loc = { file: id, line: location.line, column: location.column };
          throw error;
        });
      }
    },
  }],
});
