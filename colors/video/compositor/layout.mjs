// Composicion por formato, en px de diseno (9:16 = 1080x1920, 1:1 = 1080x1080) y unidades de mundo
// (pantalla del telefono = 3.9 x 8.44). Camara: orbita alrededor de `look` (yaw/pitch en grados).
import { T } from '../timeline/timeline.mjs';

export function layoutFor(format) { return format === '11' ? square() : vertical(); }

function vertical() {
  return {
    id: '916', W: 1080, H: 1920, fov: 26, safe: { top: 250, bottom: 340 },
    cam: [
      [0, { yaw: 0, pitch: 0, dist: 30, look: [0, 0, 0] }],
      [T.irisPhone[1], { yaw: 0, pitch: 0, dist: 30, look: [0, 0, 0] }],
      [T.camIso, { yaw: -24, pitch: 15, dist: 32, look: [0, 0.1, 0] }],
      [T.camPanels[0], { yaw: -31, pitch: 19, dist: 33, look: [0, 0.1, 0] }],
      [T.camPanels[1] + 0.3, { yaw: -14, pitch: 6, dist: 30, look: [9.2, 0.2, 0] }],
      [T.camBack[0], { yaw: -4, pitch: 4, dist: 30, look: [12.6, 0.2, 0] }],
      [T.camBack[1], { yaw: 9, pitch: 3, dist: 30, look: [0, 2.2, 0] }],
      [T.camEvents[0], { yaw: 3, pitch: 2, dist: 29.4, look: [0, 2.2, 0] }],
      [T.camEvents[1], { yaw: 20, pitch: 18, dist: 40, look: [0, 1.0, 0] }],
      [T.camWa[0], { yaw: 33, pitch: 21, dist: 40, look: [0, 1.0, 0] }],
      [T.camWa[1], { yaw: 0, pitch: 0, dist: 26, look: [0, -2.4, 0] }],
      [T.pull[0], { yaw: 0, pitch: 0, dist: 25.4, look: [0, -2.4, 0] }],
      [T.pull[1], { yaw: 0, pitch: 0, dist: 50, look: [0, -2.2, 0] }],
      [19, { yaw: 0, pitch: 0, dist: 50, look: [0, -2.2, 0] }],
    ],
    stem: { w: 9, slashIdx: 2, rootIdx: 4,
      path: [[-80, 1180], [600, 1330], [1010, 1500], [900, 1700], [600, 1772], [520, 1500], [560, 1280], [540, 1100]],
      leaves: [{ t: 0.88, w: 25, path: [[524, 1500], [450, 1452], [368, 1436]] }, { t: 1.02, w: 22, path: [[556, 1292], [638, 1254], [708, 1250]] }] },
    flower: { c: [540, 900], r: 218, sun: [338, 244], logoC: [540, 900], logoR: 238, closeC: [540, 770], closeR: 215 },
    cards: [{ i: 0, x: -1.7, y: 2.55, z: 0.55, rz: -4 }, { i: 1, x: 1.75, y: 0.05, z: 0.95, rz: 3 }, { i: 2, x: -1.55, y: -2.6, z: 0.7, rz: -2 }],
    panels: [{ w: 4.4, x: 7.2, y: 3.0, z: -4, ry: -10, rz: -2 }, { w: 4.9, x: 11.0, y: 0.8, z: 2.0, ry: -6, rz: 1.5 }, { w: 4.5, x: 15.2, y: 3.3, z: -1.5, ry: -12, rz: -1 }],
    events: [{ w: 4.3, a: -40, rad: 5.0, y: 3.0, rz: -3 }, { w: 3.9, a: 40, rad: 5.2, y: 0.3, rz: 2 }, { w: 4.4, a: -12, rad: 5.4, y: -3.0, rz: -1.5 }],
    chips: [{ cx: 330, cy: 770, w: 400, h: 112 }, { cx: 730, cy: 910, w: 400, h: 112 }, { cx: 480, cy: 1050, w: 560, h: 112 }],
    ribbon: [[-90, 700], [250, 790], [560, 930], [820, 1040], [1170, 1010]], ribbonW: 15,
    wa: { cx: 540, cy: 800, w: 860, h: 176 },
    kinetic: {
      'k-algo': { cx: 540, cy: 480, size: 118 },
      'k-dia': { cx: 540, cy: 470, size: 84 },
      'k-flores': { align: 'left', x: 84, cy: 1370, size: 104 },
      'k-calidad': { align: 'left', x: 84, cy: 1370, size: 104 },
      'k-pagina': { cx: 540, cy: 440, size: 96 },
      'k-centros': { cx: 540, cy: 420, size: 100 },
      'k-eventos': { cx: 540, cy: 420, size: 100 },
      'k-marca': { cx: 540, cy: 1240, size: 96 },
    },
    end: { logoC: [540, 470], logoR: 128, y1: 760, s1: 46, yPrice: 935, sPrice: 170, y2: 1015, pillY: 1165, pillW: 900, pillH: 98, s2: 36, ySig: 1335, sSig: 30, yDisc: 1425, sDisc: 29 },
  };
}

function square() {
  return {
    id: '11', W: 1080, H: 1080, fov: 26, safe: { top: 0, bottom: 0 },
    cam: [
      [0, { yaw: 0, pitch: 0, dist: 30, look: [0, 0, 0] }],
      [T.irisPhone[1], { yaw: 0, pitch: 0, dist: 30, look: [0, 0, 0] }],
      [T.camIso, { yaw: -24, pitch: 15, dist: 35, look: [0, 0.1, 0] }],
      [T.camPanels[0], { yaw: -31, pitch: 19, dist: 36, look: [0, 0.1, 0] }],
      [T.camPanels[1] + 0.3, { yaw: -14, pitch: 6, dist: 30, look: [9.2, 0.2, 0] }],
      [T.camBack[0], { yaw: -4, pitch: 4, dist: 30, look: [12.6, 0.2, 0] }],
      [T.camBack[1], { yaw: 9, pitch: 3, dist: 30, look: [-2.7, 0.7, 0] }],
      [T.camEvents[0], { yaw: 3, pitch: 2, dist: 29.4, look: [-2.7, 0.7, 0] }],
      [T.camEvents[1], { yaw: 20, pitch: 16, dist: 33, look: [0, 1.1, 0] }],
      [T.camWa[0], { yaw: 33, pitch: 19, dist: 33, look: [0, 1.1, 0] }],
      [T.camWa[1], { yaw: 0, pitch: 0, dist: 26, look: [0, -2.4, 0] }],
      [T.pull[0], { yaw: 0, pitch: 0, dist: 25.4, look: [0, -2.4, 0] }],
      [T.pull[1], { yaw: 0, pitch: 0, dist: 50, look: [0, -1.7, 0] }],
      [19, { yaw: 0, pitch: 0, dist: 50, look: [0, -1.7, 0] }],
    ],
    stem: { w: 8, slashIdx: 2, rootIdx: 4,
      path: [[-80, 700], [500, 790], [960, 880], [900, 1010], [640, 1056], [530, 900], [556, 770], [540, 650]],
      leaves: [{ t: 0.88, w: 21, path: [[533, 905], [470, 866], [404, 856]] }, { t: 1.02, w: 19, path: [[554, 775], [620, 745], [680, 742]] }] },
    flower: { c: [540, 505], r: 152, sun: [252, 182], logoC: [540, 505], logoR: 172, closeC: [540, 430], closeR: 156 },
    cards: [{ i: 0, x: -1.7, y: 2.55, z: 0.55, rz: -4 }, { i: 1, x: 1.75, y: 0.05, z: 0.95, rz: 3 }, { i: 2, x: -1.55, y: -2.6, z: 0.7, rz: -2 }],
    panels: [{ w: 4.3, x: 7.2, y: 2.2, z: -4, ry: -10, rz: -2 }, { w: 4.6, x: 11.0, y: 1.2, z: 2.0, ry: -6, rz: 1.5 }, { w: 4.3, x: 15.2, y: 2.3, z: -1.5, ry: -12, rz: -1 }],
    events: [{ w: 4.0, a: -42, rad: 4.8, y: 2.9, rz: -3 }, { w: 3.7, a: 42, rad: 5.0, y: 0.9, rz: 2 }, { w: 4.0, a: -14, rad: 5.2, y: -1.6, rz: -1.5 }],
    chips: [{ cx: 270, cy: 560, w: 330, h: 92 }, { cx: 400, cy: 680, w: 330, h: 92 }, { cx: 320, cy: 800, w: 470, h: 92 }],
    ribbon: [[-90, 500], [200, 590], [420, 690], [620, 780], [1170, 760]], ribbonW: 13,
    wa: { cx: 540, cy: 400, w: 800, h: 152 },
    kinetic: {
      'k-algo': { cx: 540, cy: 190, size: 96 },
      'k-dia': { cx: 540, cy: 185, size: 66 },
      'k-flores': { align: 'left', x: 64, cy: 850, size: 86 },
      'k-calidad': { align: 'left', x: 64, cy: 850, size: 86 },
      'k-pagina': { align: 'left', x: 70, cy: 330, size: 80 },
      'k-centros': { cx: 540, cy: 150, size: 68, lh: 1.0 },
      'k-eventos': { cx: 540, cy: 150, size: 68, lh: 1.0 },
      'k-marca': { cx: 540, cy: 760, size: 82 },
    },
    end: { logoC: [540, 172], logoR: 84, y1: 350, s1: 38, yPrice: 505, sPrice: 140, y2: 575, pillY: 690, pillW: 800, pillH: 84, s2: 32, ySig: 820, sSig: 26, yDisc: 890, sDisc: 25 },
  };
}
