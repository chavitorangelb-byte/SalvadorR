// Estado compartido entre secciones (el logo que sube el visitante aparece en el configurador y en regalos).
const listeners = new Map();
export const state = {
  logo: null,          // { canvas, dataURL, name } ya procesado (sin fondo, centrado)
  sound: false,
};
export function on(evt, fn) {
  if (!listeners.has(evt)) listeners.set(evt, new Set());
  listeners.get(evt).add(fn);
  return () => listeners.get(evt).delete(fn);
}
export function emit(evt, payload) {
  listeners.get(evt)?.forEach((fn) => fn(payload));
}

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
export const isMobile = () => matchMedia('(max-width: 959px)').matches;
