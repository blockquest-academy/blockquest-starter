const paths = {
  crystal: '<path d="m12 2 8 8-8 12-8-12Z"/><path d="m12 2-3 8 3 12 3-12Z"/><path d="M4 10h16"/>',
  play: '<path d="m9 5 11 7-11 7Z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  book: '<path d="M12 5C7 2 3 4 3 4v15s4-2 9 1c5-3 9-1 9-1V4s-4-2-9 1Zm0 0v15"/>',
  code: '<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  flag: '<path d="M5 22V3m0 1c5-5 9 5 15 0v11c-6 5-10-5-15 0"/>',
  sound: '<path d="M11 4 6 8H3v8h3l5 4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="M11 4 6 8H3v8h3l5 4Zm5 5 6 6m0-6-6 6"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 4m0 3v1"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.crystal}</svg>`;
