// Composicion por formato. Coordenadas de diseno en px del cuadro (9:16 = 1080x1920, 1:1 = 1080x1080).
// El celular se encuadra con: ancla (punto de la pantalla en px CSS), posicion del ancla en el cuadro,
// escala s (px de video por px CSS) y giros. Asi un push-in deja la interfaz al tamano real.
import { T } from '../timeline/timeline.mjs';

const C = [195, 422];          // centro de la pantalla (px CSS)

export function layoutFor(format) {
  if (format === '11') return square();
  return vertical();
}

function vertical() {
  const W = 1080, H = 1920;
  const base = 1.386;
  return {
    id: '916', W, H, fov: 26, safe: { top: 250, bottom: 340, side: 60 },
    // [t, {anchor, pos, s, yaw, pitch, roll, op}] — se interpola con easing entre llaves
    phone: [
      [T.phoneIn[0], { anchor: C, pos: [540, 960], s: 1.30, yaw: 12, pitch: -6, roll: -2, op: 0 }],
      [T.phoneIn[1], { anchor: C, pos: [540, 960], s: 1.34, yaw: 12, pitch: -5, roll: -1.5, op: 1 }],
      [T.phoneSettle[1], { anchor: C, pos: [540, 960], s: base, yaw: 0, pitch: 0, roll: 0, op: 1, ease: 'spring' }],
      [T.pushTitle[0], { anchor: C, pos: [540, 960], s: base, yaw: 0, pitch: 0, roll: 0 }],
      [T.pushTitle[1], { anchor: 'heroTitle', pos: [540, 880], s: 2.25, yaw: 0, pitch: 0, roll: 0 }],
      [T.pullHero[0], { anchor: 'heroTitle', pos: [540, 880], s: 2.25, yaw: 0, pitch: 0, roll: 0 }],
      [T.pullHero[1], { anchor: C, pos: [560, 960], s: base, yaw: -3, pitch: 0, roll: 0 }],
      [T.scrollGallery[1], { anchor: [195, 470], pos: [690, 955], s: 1.30, yaw: -12, pitch: 3, roll: 0 }],
      [T.cardsOut[1], { anchor: [195, 470], pos: [700, 950], s: 1.27, yaw: -19, pitch: 5, roll: 0.5 }],
      [T.cardsBack[1], { anchor: [195, 470], pos: [690, 955], s: 1.32, yaw: -8, pitch: 2, roll: 0 }],
      [T.inkCircleCta[1], { anchor: [195, 470], pos: [690, 955], s: 1.34, yaw: -6, pitch: 1, roll: 0 }],
      [T.scrollForm[1], { anchor: [195, 470], pos: [395, 955], s: 1.32, yaw: 9, pitch: 2, roll: 0 }],
      [T.tapSubmit, { anchor: [195, 470], pos: [395, 955], s: 1.33, yaw: 11, pitch: 0, roll: 0 }],
      [T.waLift[1], { anchor: [195, 470], pos: [405, 965], s: 1.27, yaw: 17, pitch: -8, roll: -0.5 }],
      [T.waBack[1], { anchor: [195, 470], pos: [400, 960], s: 1.31, yaw: 11, pitch: -2, roll: 0 }],
      [T.orbit[0], { anchor: [195, 470], pos: [400, 960], s: 1.32, yaw: 14, pitch: -3, roll: 0 }],
      [T.orbit[1], { anchor: [195, 470], pos: [410, 955], s: 1.42, yaw: -9, pitch: 3, roll: 0, ease: 'sine' }],
      [T.scrollCare[0], { anchor: C, pos: [540, 960], s: base, yaw: 0, pitch: 0, roll: 0 }],
      [T.pushCare[0], { anchor: C, pos: [540, 960], s: base, yaw: 0, pitch: 0, roll: 0 }],
      // 1220 (no 990): asi el titulo "Cuidados despues de tu tatuaje" queda debajo de los 250 px superiores
      [T.pushCare[1], { anchor: 'careSteps', pos: [540, 1220], s: 1.95, yaw: 0, pitch: 0, roll: 0 }],
      [T.scrollVisit[1], { anchor: [195, 440], pos: [540, 960], s: 1.55, yaw: 0, pitch: 0, roll: 0 }],
      [T.inkCirclePin[1], { anchor: 'pin', pos: [540, 880], s: 1.72, yaw: 0, pitch: 0, roll: 0 }],
      [T.pullBack[0], { anchor: 'pin', pos: [540, 880], s: 1.72, yaw: 0, pitch: 0, roll: 0 }],
      [T.pullBack[1], { anchor: C, pos: [800, 1235], s: 0.72, yaw: -16, pitch: 6, roll: 2 }],
      [T.outroFade[0], { anchor: C, pos: [805, 1240], s: 0.70, yaw: -18, pitch: 6, roll: 2, op: 1 }],
      [T.outroFade[1], { anchor: C, pos: [830, 1290], s: 0.56, yaw: -26, pitch: 8, roll: 3, op: 0 }],
    ],
    search: { cx: 540, cy: 900, w: 940, h: 128, font: 46, textX: 176 },
    // columnas de tipografia cinetica por escena (fuera de la pantalla del celular)
    kinetic: {
      'k-trabajo': { x: 60, w: 330, cy: 900, max: 96, align: 'left' },
      'k-cotiza': { x: 690, w: 330, cy: 770, max: 72, align: 'left' },
      'k-whatsapp': { x: 690, w: 330, cy: 1010, max: 72, align: 'left' },
      'k-ingles': { x: 690, w: 330, cy: 900, max: 104, align: 'left' },
    },
    written: { x: 64, w: 560, y: 410, max: 168, gap: 0.98 },
    end: { plateCy: 880, logoW: 760, taglineY: 1150, taglineSize: 40, disclaimerY: 1505, disclaimerSize: 27 },
  };
}

function square() {
  const W = 1080, H = 1080;
  const base = 0.80;
  return {
    id: '11', W, H, fov: 26, safe: { top: 60, bottom: 60, side: 60 },
    phone: [
      [T.phoneIn[0], { anchor: C, pos: [540, 540], s: 0.74, yaw: 12, pitch: -6, roll: -2, op: 0 }],
      [T.phoneIn[1], { anchor: C, pos: [540, 540], s: 0.77, yaw: 12, pitch: -5, roll: -1.5, op: 1 }],
      [T.phoneSettle[1], { anchor: C, pos: [540, 540], s: base, yaw: 0, pitch: 0, roll: 0, op: 1, ease: 'spring' }],
      [T.pushTitle[0], { anchor: C, pos: [540, 540], s: base, yaw: 0, pitch: 0, roll: 0 }],
      [T.pushTitle[1], { anchor: 'heroTitle', pos: [540, 470], s: 1.30, yaw: 0, pitch: 0, roll: 0 }],
      [T.pullHero[0], { anchor: 'heroTitle', pos: [540, 470], s: 1.30, yaw: 0, pitch: 0, roll: 0 }],
      [T.pullHero[1], { anchor: C, pos: [560, 540], s: base, yaw: -3, pitch: 0, roll: 0 }],
      [T.scrollGallery[1], { anchor: [195, 470], pos: [775, 545], s: 0.78, yaw: -12, pitch: 3, roll: 0 }],
      [T.cardsOut[1], { anchor: [195, 470], pos: [780, 540], s: 0.76, yaw: -19, pitch: 5, roll: 0.5 }],
      [T.cardsBack[1], { anchor: [195, 470], pos: [775, 545], s: 0.79, yaw: -8, pitch: 2, roll: 0 }],
      [T.inkCircleCta[1], { anchor: [195, 470], pos: [775, 545], s: 0.80, yaw: -6, pitch: 1, roll: 0 }],
      [T.scrollForm[1], { anchor: [195, 470], pos: [305, 545], s: 0.79, yaw: 9, pitch: 2, roll: 0 }],
      [T.tapSubmit, { anchor: [195, 470], pos: [305, 545], s: 0.80, yaw: 11, pitch: 0, roll: 0 }],
      [T.waLift[1], { anchor: [195, 470], pos: [312, 550], s: 0.76, yaw: 17, pitch: -8, roll: -0.5 }],
      [T.waBack[1], { anchor: [195, 470], pos: [308, 548], s: 0.79, yaw: 11, pitch: -2, roll: 0 }],
      [T.orbit[0], { anchor: [195, 470], pos: [308, 548], s: 0.79, yaw: 14, pitch: -3, roll: 0 }],
      [T.orbit[1], { anchor: [195, 470], pos: [318, 545], s: 0.85, yaw: -9, pitch: 3, roll: 0, ease: 'sine' }],
      [T.scrollCare[0], { anchor: C, pos: [540, 540], s: base, yaw: 0, pitch: 0, roll: 0 }],
      [T.pushCare[0], { anchor: C, pos: [540, 540], s: base, yaw: 0, pitch: 0, roll: 0 }],
      [T.pushCare[1], { anchor: 'careSteps', pos: [540, 560], s: 1.12, yaw: 0, pitch: 0, roll: 0 }],
      [T.scrollVisit[1], { anchor: [195, 440], pos: [540, 540], s: 0.92, yaw: 0, pitch: 0, roll: 0 }],
      [T.inkCirclePin[1], { anchor: 'pin', pos: [540, 500], s: 1.05, yaw: 0, pitch: 0, roll: 0 }],
      [T.pullBack[0], { anchor: 'pin', pos: [540, 500], s: 1.05, yaw: 0, pitch: 0, roll: 0 }],
      [T.pullBack[1], { anchor: C, pos: [850, 600], s: 0.50, yaw: -16, pitch: 6, roll: 2 }],
      [T.outroFade[0], { anchor: C, pos: [855, 605], s: 0.49, yaw: -18, pitch: 6, roll: 2, op: 1 }],
      [T.outroFade[1], { anchor: C, pos: [880, 640], s: 0.40, yaw: -26, pitch: 8, roll: 3, op: 0 }],
    ],
    search: { cx: 540, cy: 540, w: 920, h: 124, font: 44, textX: 186 },
    kinetic: {
      'k-trabajo': { x: 60, w: 470, cy: 540, max: 112, align: 'left' },
      'k-cotiza': { x: 545, w: 470, cy: 420, max: 92, align: 'left' },
      'k-whatsapp': { x: 545, w: 470, cy: 640, max: 92, align: 'left' },
      'k-ingles': { x: 545, w: 470, cy: 540, max: 120, align: 'left' },
    },
    written: { x: 64, w: 600, y: 300, max: 150, gap: 0.98 },
    end: { plateCy: 460, logoW: 700, taglineY: 700, taglineSize: 38, disclaimerY: 975, disclaimerSize: 26 },
  };
}
