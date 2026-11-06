// Todos los botones terminan en WhatsApp con un mensaje ya armado.
// ?wa=52XXXXXXXXXX manda las pruebas a otro número sin escribirle al cliente.
const DEFAULT = '524492128627';
const override = new URLSearchParams(location.search).get('wa');
export const WA_NUMBER = override && /^\d{10,15}$/.test(override) ? override : DEFAULT;

export const waLink = (text) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

export const messages = {
  general: () => 'Hola DIPROLASER, quiero cotizar gorras personalizadas para mi negocio. ¿Me ayudan?',
  cfg: ({ model, crown, visor, under, tech, hasLogo }) =>
    `Hola DIPROLASER, quiero cotizar esta gorra: Modelo: ${model} · Corona: ${crown} · Visera: ${visor} · Abajo de la visera: ${under} · Técnica: ${tech} · Logo: ${hasLogo ? 'lo adjunto' : 'te lo mando por aquí'}. ¿Me ayudan?`,
  placa: (name) => (name
    ? `Hola, quiero una gorra con Placa Águila de México con el nombre: ${name}.`
    : 'Hola, quiero una gorra con Placa Águila de México con mi nombre.'),
  gift: ({ product, color }) =>
    `Hola, quiero cotizar promocionales para regalar a mis clientes: ${product}${color ? ` color ${color}` : ''} con mi logo grabado a láser.`,
};

/** Actualiza el href de todos los enlaces [data-wa="tipo"] con el mensaje del momento. */
export function setWa(kind, text) {
  document.querySelectorAll(`[data-wa="${kind}"]`).forEach((a) => { a.href = waLink(text); });
}

export function initWhatsApp() {
  setWa('general', messages.general());
  setWa('placa', messages.placa(''));
}
