// Prueba de estilo (fase 4): 4.6 s, 30 fps de salida, la página capturada a 60 fps.
// Celular de cristal 3D con la portada real y una tarjeta de "De la casa" que sale al espacio 3D.
// La gota hace tres de sus papeles del video: dibuja el contorno, rebota con brillo y subraya.
export const STYLE = {
  DUR: 4.6,
  FPS: 30,
  PAGE_FPS: 60,
  CARD: '#feat-jamon-serrano',
  T: {
    outline: [0.04, 0.74],     // la gota se estira y dibuja el contorno del celular
    phoneIn: [0.30, 0.78],     // el cristal 3D aparece sobre el contorno
    settle: [0.42, 1.40],      // gira 12° y se asienta
    screenOn: 0.56,
    intro: 0.60,               // carga la portada real
    scroll: [2.02, 2.72],      // scroll con inercia a "De la casa"
    hop: [2.56, 2.90],         // la gota rebota a la tarjeta
    glint: [2.84, 3.18],       // brillo sobre la tarjeta
    lift: [2.92, 3.42],        // la tarjeta sale al espacio 3D
    float: [3.42, 3.96],
    back: [3.96, 4.44],        // regresa a su lugar
    camShift: [2.70, 3.30],    // el celular se corre: espacio para el texto
    camBack: [4.00, 4.58],
    slide: [3.02, 3.38],       // la gota baja de la tarjeta al texto
    underline: [3.40, 3.78],   // subraya "DE YUCA"
    textOut: [4.10, 4.30],
  },
  KINETIC: [
    { text: 'WAFFLES', land: 3.06 },
    { text: 'DE YUCA', land: 3.22 },
  ],
};
