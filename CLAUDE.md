# Cómo trabajar en este repo

Aquí Salvador (Elevate Negocios) hace páginas y videos para negocios locales.

## Entrega final de cada proyecto (página y/o video)

Al terminar, mándale a Salvador los archivos con SendUserFile, no solo la ruta:

1. **El video renderizado**: el master y, si existe, la versión ligera para WhatsApp.
2. **Una imagen para el cliente** de cómo se ve la página por dentro:
   - Capturas reales de la página (no recreaciones) dentro de un celular, con un encabezado,
     una etiqueta corta por pantalla y, si es pieza spec, "Demo de cortesía de Elevate Negocios · pieza no oficial".
   - Vertical, JPG, pensada para mandarse por WhatsApp.
   - Es para el cliente: sin guías de zona segura, tiempos, cuadros ni notas internas
     (las hojas de revisión son aparte y no sustituyen a esta imagen).
   - Nada inventado: cada etiqueta describe algo que la página de verdad hace.
   - Revisarla a resolución real antes de mandarla: textos coherentes entre sí
     (la idea escrita coincide con la foto de referencia, por ejemplo) y nada importante cortado.
3. **El texto de WhatsApp** que Salvador le manda al cliente antes del video y la imagen, listo para copiar
   en el chat y guardado junto a los entregables (`video/out/mensaje_whatsapp.txt` o el equivalente del proyecto):
   - Corto: cuatro párrafos breves que se lean bien en el celular.
   - Mismo trato que las piezas (tú o usted) y sin nombres de personas que no estén confirmados.
   - Qué es y qué incluye la página (solo lo que de verdad hace), y una invitación sin presión.
   - Si es pieza spec: decir que es una demo de cortesía, no oficial y no publicada.
   - Nada inventado: ni precios, ni resultados prometidos, ni datos del negocio sin confirmar.
   - Decir el orden de envío: texto, luego el video (versión para WhatsApp) y luego la imagen en HD.

Base para la siguiente: `tools/client_board.js` (Siniestro Tattoo) captura la página real y arma la lámina,
y `video/out/mensaje_whatsapp.txt` es un ejemplo del mensaje.
