/**
 * Tabler Icons v3.51.0 outline subset, MIT, Copyright (c) 2020-2026 Paweł Kuna.
 * Official geometry is retained; only whitespace and the SVG wrapper are normalized.
 * Source: https://github.com/tabler/tabler-icons/tree/v3.51.0/icons/outline
 * License: ./vendor/tabler/LICENSE. See ../THIRD-PARTY.md for the subset and aliases.
 */
export const TABLER_VERSION = '3.51.0';
const paths = Object.freeze({
  "adjustments-horizontal": "<path d=\"M12 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M4 6l8 0\" /><path d=\"M16 6l4 0\" /><path d=\"M6 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M4 12l2 0\" /><path d=\"M10 12l10 0\" /><path d=\"M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" /><path d=\"M4 18l11 0\" /><path d=\"M19 18l1 0\" />",
  "arrow-back-up": "<path d=\"M9 14l-4 -4l4 -4\" /><path d=\"M5 10h11a4 4 0 1 1 0 8h-1\" />",
  "arrow-bar-to-up": "<path d=\"M12 10l0 10\" /><path d=\"M12 10l4 4\" /><path d=\"M12 10l-4 4\" /><path d=\"M4 4l16 0\" />",
  "arrow-forward-up": "<path d=\"M15 14l4 -4l-4 -4\" /><path d=\"M19 10h-11a4 4 0 1 0 0 8h1\" />",
  "arrow-right": "<path d=\"M5 12l14 0\" /><path d=\"M13 18l6 -6\" /><path d=\"M13 6l6 6\" />",
  "arrows-move": "<path d=\"M18 9l3 3l-3 3\" /><path d=\"M15 12h6\" /><path d=\"M6 9l-3 3l3 3\" /><path d=\"M3 12h6\" /><path d=\"M9 18l3 3l3 -3\" /><path d=\"M12 15v6\" /><path d=\"M15 6l-3 -3l-3 3\" /><path d=\"M12 3v6\" />",
  "backpack": "<path d=\"M5 18v-6a6 6 0 0 1 6 -6h2a6 6 0 0 1 6 6v6a3 3 0 0 1 -3 3h-8a3 3 0 0 1 -3 -3\" /><path d=\"M10 6v-1a2 2 0 1 1 4 0v1\" /><path d=\"M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4\" /><path d=\"M11 10h2\" />",
  "bookmark": "<path d=\"M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4\" />",
  "camera": "<path d=\"M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2\" /><path d=\"M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" />",
  "check": "<path d=\"M5 12l5 5l10 -10\" />",
  "chevron-down": "<path d=\"M6 9l6 6l6 -6\" />",
  "clock": "<path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" /><path d=\"M12 7v5l3 3\" />",
  "device-vision-pro": "<path d=\"M12 7c1.143 0 2.235 .035 3.275 .104c1.017 .068 1.95 .207 2.798 .42c.813 .203 1.52 .505 2.119 .909a3.903 3.903 0 0 1 1.328 1.531c.326 .657 .48 1.48 .48 2.466c0 1.006 -.189 1.91 -.574 2.707c-.375 .779 -.886 1.396 -1.537 1.848a3.696 3.696 0 0 1 -2.16 .66c-.509 0 -.97 -.068 -1.382 -.21a5.84 5.84 0 0 1 -1.17 -.548a18.45 18.45 0 0 1 -1.045 -.695a9.104 9.104 0 0 0 -1.001 -.63a2.376 2.376 0 0 0 -1.13 -.301c-.373 0 -.75 .097 -1.132 .3c-.316 .17 -.65 .38 -1 .63c-.322 .23 -.67 .462 -1.047 .695a5.78 5.78 0 0 1 -1.168 .548c-.413 .142 -.872 .21 -1.378 .21a3.706 3.706 0 0 1 -2.165 -.659c-.651 -.452 -1.162 -1.07 -1.537 -1.848c-.385 -.798 -.574 -1.7 -.574 -2.709c-.004 -.98 .15 -1.802 .477 -2.46a3.897 3.897 0 0 1 1.33 -1.531c.6 -.403 1.307 -.704 2.12 -.907a16.088 16.088 0 0 1 2.8 -.423c1.04 -.071 2.13 -.107 3.273 -.107\" />",
  "dots": "<path d=\"M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" /><path d=\"M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0\" />",
  "download": "<path d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2\" /><path d=\"M7 11l5 5l5 -5\" /><path d=\"M12 4l0 12\" />",
  "hanger": "<path d=\"M14 6a2 2 0 1 0 -4 0c0 1.667 .67 3 2 4h-.008l7.971 4.428a2 2 0 0 1 1.029 1.749v.823a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-.823a2 2 0 0 1 1.029 -1.749l7.971 -4.428\" />",
  "hanger-2": "<path d=\"M12 9l-7.971 4.428a2 2 0 0 0 -1.029 1.749v.823a2 2 0 0 0 2 2h1\" /><path d=\"M18 18h1a2 2 0 0 0 2 -2v-.823a2 2 0 0 0 -1.029 -1.749l-7.971 -4.428c-1.457 -.81 -1.993 -2.333 -2 -4a2 2 0 1 1 4 0\" /><path d=\"M6 18a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v1a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -1\" />",
  "helmet": "<path d=\"M12 4a9 9 0 0 1 5.656 16h-11.312a9 9 0 0 1 5.656 -16\" /><path d=\"M20 9h-8.8a1 1 0 0 0 -.968 1.246c.507 2 1.596 3.418 3.268 4.254c2 1 4.333 1.5 7 1.5\" />",
  "jacket": "<path d=\"M16 3l-4 5l-4 -5\" /><path d=\"M12 19a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2v-8.172a2 2 0 0 1 .586 -1.414l.828 -.828a2 2 0 0 0 .586 -1.414v-2.172a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v2.172a2 2 0 0 0 .586 1.414l.828 .828a2 2 0 0 1 .586 1.414v8.172a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2\" /><path d=\"M20 13h-3a1 1 0 0 0 -1 1v2a1 1 0 0 0 1 1h3\" /><path d=\"M4 17h3a1 1 0 0 0 1 -1v-2a1 1 0 0 0 -1 -1h-3\" /><path d=\"M12 19v-11\" />",
  "layout-grid": "<path d=\"M4 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\" /><path d=\"M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\" /><path d=\"M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\" /><path d=\"M14 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4\" />",
  "list-check": "<path d=\"M3.5 5.5l1.5 1.5l2.5 -2.5\" /><path d=\"M3.5 11.5l1.5 1.5l2.5 -2.5\" /><path d=\"M3.5 17.5l1.5 1.5l2.5 -2.5\" /><path d=\"M11 6l9 0\" /><path d=\"M11 12l9 0\" /><path d=\"M11 18l9 0\" />",
  "map-pin": "<path d=\"M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" /><path d=\"M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0\" />",
  "maximize": "<path d=\"M4 8v-2a2 2 0 0 1 2 -2h2\" /><path d=\"M4 16v2a2 2 0 0 0 2 2h2\" /><path d=\"M16 4h2a2 2 0 0 1 2 2v2\" /><path d=\"M16 20h2a2 2 0 0 0 2 -2v-2\" />",
  "minus": "<path d=\"M5 12l14 0\" />",
  "moon": "<path d=\"M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008\" />",
  "mountain": "<path d=\"M3 20h18l-6.921 -14.612a2.3 2.3 0 0 0 -4.158 0l-6.921 14.612\" /><path d=\"M7.5 11l2 2.5l2.5 -2.5l2 3l2.5 -2\" />",
  "pencil": "<path d=\"M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4\" /><path d=\"M13.5 6.5l4 4\" />",
  "photo": "<path d=\"M15 8h.01\" /><path d=\"M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12\" /><path d=\"M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5\" /><path d=\"M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3\" />",
  "photo-plus": "<path d=\"M15 8h.01\" /><path d=\"M12.5 21h-6.5a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v6.5\" /><path d=\"M3 16l5 -5c.928 -.893 2.072 -.893 3 0l4 4\" /><path d=\"M14 14l1 -1c.67 -.644 1.45 -.824 2.182 -.54\" /><path d=\"M16 19h6\" /><path d=\"M19 16v6\" />",
  "plus": "<path d=\"M12 5l0 14\" /><path d=\"M5 12l14 0\" />",
  "refresh": "<path d=\"M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4\" /><path d=\"M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4\" />",
  "route": "<path d=\"M3 19a2 2 0 1 0 4 0a2 2 0 0 0 -4 0\" /><path d=\"M19 7a2 2 0 1 0 0 -4a2 2 0 0 0 0 4\" /><path d=\"M11 19h5.5a3.5 3.5 0 0 0 0 -7h-8a3.5 3.5 0 0 1 0 -7h4.5\" />",
  "select-all": "<path d=\"M8 9a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1l0 -6\" /><path d=\"M12 20v.01\" /><path d=\"M16 20v.01\" /><path d=\"M8 20v.01\" /><path d=\"M4 20v.01\" /><path d=\"M4 16v.01\" /><path d=\"M4 12v.01\" /><path d=\"M4 8v.01\" /><path d=\"M4 4v.01\" /><path d=\"M8 4v.01\" /><path d=\"M12 4v.01\" /><path d=\"M16 4v.01\" /><path d=\"M20 4v.01\" /><path d=\"M20 8v.01\" /><path d=\"M20 12v.01\" /><path d=\"M20 16v.01\" /><path d=\"M20 20v.01\" />",
  "shield-check": "<path d=\"M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06\" /><path d=\"M15 19l2 2l4 -4\" />",
  "shirt": "<path d=\"M15 4l6 2v5h-3v8a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-8h-3v-5l6 -2a3 3 0 0 0 6 0\" />",
  "shoe": "<path d=\"M4 6h5.426a1 1 0 0 1 .863 .496l1.064 1.823a3 3 0 0 0 1.896 1.407l4.677 1.114a4 4 0 0 1 3.074 3.89v2.27a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1\" /><path d=\"M14 13l1 -2\" /><path d=\"M8 18v-1a4 4 0 0 0 -4 -4h-1\" /><path d=\"M10 12l1.5 -3\" />",
  "ski-jumping": "<path d=\"M17 17.5l-5 -4.5v-6l5 4\" /><path d=\"M7 17.5l5 -4.5\" /><path d=\"M15.103 21.58l6.762 -14.502a2 2 0 0 0 -.968 -2.657\" /><path d=\"M8.897 21.58l-6.762 -14.503a2 2 0 0 1 .968 -2.657\" /><path d=\"M7 11l5 -4\" /><path d=\"M10.007 4a2 2 0 1 0 4 0a2 2 0 1 0 -4 0\" />",
  "snowboarding": "<path d=\"M15 3a1 1 0 1 0 2 0a1 1 0 0 0 -2 0\" /><path d=\"M7 19l4 -2.5l-.5 -1.5\" /><path d=\"M16 21l-1 -6l-4.5 -3l3.5 -6\" /><path d=\"M7 9l1.5 -3h5.5l2 4l3 1\" /><path d=\"M3 17c.399 1.154 .899 1.805 1.5 1.951c6 1.464 10.772 2.262 13.5 2.927c1.333 .325 2.333 0 3 -.976\" />",
  "snowflake": "<path d=\"M10 4l2 1l2 -1\" /><path d=\"M12 2v6.5l3 1.72\" /><path d=\"M17.928 6.268l.134 2.232l1.866 1.232\" /><path d=\"M20.66 7l-5.629 3.25l.01 3.458\" /><path d=\"M19.928 14.268l-1.866 1.232l-.134 2.232\" /><path d=\"M20.66 17l-5.629 -3.25l-2.99 1.738\" /><path d=\"M14 20l-2 -1l-2 1\" /><path d=\"M12 22v-6.5l-3 -1.72\" /><path d=\"M6.072 17.732l-.134 -2.232l-1.866 -1.232\" /><path d=\"M3.34 17l5.629 -3.25l-.01 -3.458\" /><path d=\"M4.072 9.732l1.866 -1.232l.134 -2.232\" /><path d=\"M3.34 7l5.629 3.25l2.99 -1.738\" />",
  "sock": "<path d=\"M13 3v6l4.798 5.142a4 4 0 0 1 -5.441 5.86l-6.736 -6.41a2 2 0 0 1 -.621 -1.451v-9.141h8\" /><path d=\"M7.895 15.768c.708 -.721 1.105 -1.677 1.105 -2.768a4 4 0 0 0 -4 -4\" />",
  "sparkles": "<path d=\"M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m0 -12a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2m-7 12a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6\" />",
  "sun": "<path d=\"M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0\" /><path d=\"M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7\" />",
  "ticket": "<path d=\"M15 5l0 2\" /><path d=\"M15 11l0 2\" /><path d=\"M15 17l0 2\" /><path d=\"M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2\" />",
  "trash": "<path d=\"M4 7l16 0\" /><path d=\"M10 11l0 6\" /><path d=\"M14 11l0 6\" /><path d=\"M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12\" /><path d=\"M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3\" />",
  "upload": "<path d=\"M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2\" /><path d=\"M7 9l5 -5l5 5\" /><path d=\"M12 4l0 12\" />",
  "x": "<path d=\"M18 6l-12 12\" /><path d=\"M6 6l12 12\" />"
});

export const iconAliases = Object.freeze({
  "list": "list-check",
  "hanger": "hanger",
  "spark": "sparkles",
  "plus": "plus",
  "close": "x",
  "check": "check",
  "more": "dots",
  "settings": "adjustments-horizontal",
  "arrow": "arrow-right",
  "down": "chevron-down",
  "clock": "clock",
  "bag": "backpack",
  "jacket": "jacket",
  "pants": "hanger-2",
  "helmet": "helmet",
  "goggles": "device-vision-pro",
  "camera": "camera",
  "download": "download",
  "upload": "upload",
  "trash": "trash",
  "shield": "shield-check",
  "refresh": "refresh",
  "minus": "minus",
  "fit": "maximize",
  "grid": "layout-grid",
  "move": "arrows-move",
  "up": "arrow-bar-to-up",
  "edit": "pencil",
  "photo": "photo",
  "undo": "arrow-back-up",
  "redo": "arrow-forward-up",
  "ski": "ski-jumping",
  "snowboard": "snowboarding",
  "mountain": "mountain",
  "snowflake": "snowflake",
  "ticket": "ticket",
  "route": "route",
  "sun": "sun",
  "moon": "moon",
  "shirt": "shirt",
  "shoe": "shoe",
  "sock": "sock",
  "photo-plus": "photo-plus",
  "select": "select-all",
  "save": "bookmark",
  "map": "map-pin"
});
export const iconNames = Object.freeze(Object.keys(paths));
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

// Unknown names keep the previous generic equipment fallback. Attributes only use
// known icon names, a finite numeric size and a restricted CSS class alphabet.
export function resolveIconName(name) {
  return owns(iconAliases, name) ? iconAliases[name] : owns(paths, name) ? name : 'hanger';
}
export function icon(name, size = 20, className = '') {
  const sourceName = resolveIconName(name);
  const semanticName = owns(iconAliases, name) || owns(paths, name) ? name : 'hanger';
  const numericSize = Number(size);
  const safeSize = Number.isFinite(numericSize) && numericSize > 0 ? Math.min(1024, numericSize) : 20;
  const safeClass = typeof className === 'string' && /^[A-Za-z0-9_\- ]{0,160}$/.test(className) ? className.trim() : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="snow-icon${safeClass ? ` ${safeClass}` : ''}" data-icon="${semanticName}" data-icon-source="${sourceName}" width="${safeSize}" height="${safeSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[sourceName]}</svg>`;
}
