// Escena 3D del configurador: render bajo demanda, controles táctiles con inercia, vistas, modelos,
// colores con barrido líquido, logo con 5 técnicas, gotas de agua y captura de "mi diseño".
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCap, conformGeometry, conformRim, CAP, crownPoint, visorPoint, PANELS } from './cap.js';
import { fabric, shared, textures } from './materials.js';

export const MODELS = {
  tela: { crown: 'tela', front: 'tela', visor: 'tela' },
  gamuza: { crown: 'gamuza', front: 'gamuza', visor: 'gamuza' },
  micro: { crown: 'gamuza', front: 'gamuza', visor: 'gamuza', perf: true, lining: '#a89890' },
  impermeable: { crown: 'poly', front: 'poly', visor: 'poly', perf: true, lining: '#ff9a8a' },
  trucker: { crown: 'malla', front: 'gamuza', visor: 'gamuza', mesh: true },
  bicolor: { crown: 'tela', front: 'tela', visor: 'gamuza' },
};
const TECH = { bordado: 0, placa: 1, parche: 2, laser: 3, color: 4 };
const DECAL = { cx: 0, cy: .6, w: .64, h: .64 };

const easeOut = (t) => 1 - Math.pow(1 - t, 3);
function tween(obj, key, to, dur = .9, ease = easeOut) {
  const from = obj[key]; const t0 = performance.now();
  return new Promise((res) => {
    const step = (now) => { const k = Math.min(1, (now - t0) / (dur * 1000)); obj[key] = from + (to - from) * ease(k); if (k < 1) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
}

export async function createScene(host, { reduced = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  if (!renderer.getContext()) throw new Error('sin webgl');
  let dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = .92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environmentIntensity = .38;
  const camera = new THREE.PerspectiveCamera(27, 1, .1, 50);
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(-2.2, 3.2, 3.4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe9e2, .35); fill.position.set(3, .8, 2.2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff4d55, 2.0); rim.position.set(2.6, 2.2, -3.4); scene.add(rim);
  const rim2 = new THREE.DirectionalLight(0xffd6d6, .7); rim2.position.set(-3, .6, -2.5); scene.add(rim2);

  // sombra de contacto
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  { const x = sc.getContext('2d'); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(.5, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, opacity: .7 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -.86, .35); shadow.scale.set(1, 1.15, 1); scene.add(shadow);

  textures();
  const loader = new THREE.TextureLoader();
  const labelTex = await loader.loadAsync('img/brand/label.webp'); labelTex.colorSpace = THREE.SRGBColorSpace; labelTex.anisotropy = 8;

  const st = { model: 'tela', colors: { crown: '#141416', visor: '#141416', under: '#c81e28' }, tech: 'bordado', logo: null };
  const logoCanvas0 = document.createElement('canvas'); logoCanvas0.width = logoCanvas0.height = 1024;
  const logoTex = new THREE.CanvasTexture(logoCanvas0); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 8;

  const statics = {
    sweat: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: .85, side: THREE.DoubleSide }),
    hole: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    plastic: new THREE.MeshPhysicalMaterial({ color: 0x0d0d0f, roughness: .35, clearcoat: .6, side: THREE.DoubleSide }),
    label: new THREE.MeshPhysicalMaterial({ map: labelTex, metalness: .45, roughness: .32, clearcoat: .7, clearcoatRoughness: .15, alphaTest: .5, side: THREE.DoubleSide, envMapIntensity: 1.8, emissive: 0xffffff, emissiveMap: labelTex, emissiveIntensity: .18 }),
    lining: new THREE.MeshStandardMaterial({ color: 0x060606, roughness: .9, emissive: 0xffd2c8, emissiveIntensity: .22, side: THREE.DoubleSide }),
  };
  const cache = new Map();
  const getFab = (kind, role, color, opts = {}) => {
    const k = `${kind}-${role}-${opts.perforated ? 'p' : ''}-${opts.decal ? 'd' : ''}`;
    if (!cache.has(k)) cache.set(k, fabric({ kind, color, role, ...opts }));
    const m = cache.get(k); m.color.set(color); m.userData.u.uOld.value.set(color); m.userData.u.uNew.value.set(color); m.userData.u.uSweep.value = 99;
    return m;
  };
  const eyeletMat = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: .7 });
  const mats = () => {
    const M = MODELS[st.model];
    return {
      front: getFab(M.front, 'front', st.colors.crown, { decal: { tex: logoTex } }),
      crown: getFab(M.crown, 'crown', st.colors.crown, { perforated: !!M.perf }),
      visorTop: getFab(M.visor, 'visorTop', st.colors.visor),
      visorBottom: getFab(M.visor, 'visorBottom', st.colors.under),
      edge: getFab(M.visor, 'edge', st.colors.visor),
      button: getFab(M.front, 'button', st.colors.crown),
      eyelet: eyeletMat, ...statics,
    };
  };
  const { cap, parts } = buildCap(mats());
  scene.add(cap);
  // forro interior detrás de las perforaciones ("luz que pasa")
  const linings = [];
  for (const k of ['sideL', 'sideR', 'backL', 'backR']) {
    const g = parts[k].geometry.clone(); const pos = g.attributes.position, nor = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) - nor.getX(i) * .012, pos.getY(i) - nor.getY(i) * .012, pos.getZ(i) - nor.getZ(i) * .012);
    const m = new THREE.Mesh(g, statics.lining); m.visible = false; cap.add(m); linings.push(m);
  }

  // placa metálica redonda y parche de piel, conformados a la curva del frente
  const metalCanvas = document.createElement('canvas'); metalCanvas.width = metalCanvas.height = 1024;
  const metalTex = new THREE.CanvasTexture(metalCanvas); metalTex.colorSpace = THREE.SRGBColorSpace; metalTex.anisotropy = 8;
  const leatherCanvas = document.createElement('canvas'); leatherCanvas.width = 1024; leatherCanvas.height = 720;
  const leatherTex = new THREE.CanvasTexture(leatherCanvas); leatherTex.colorSpace = THREE.SRGBColorSpace; leatherTex.anisotropy = 8;
  const plateMat = new THREE.MeshPhysicalMaterial({ map: metalTex, metalness: .55, roughness: .46, clearcoat: .35, clearcoatRoughness: .4, envMapIntensity: .55 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3b40, metalness: .8, roughness: .35, envMapIntensity: .7 });
  const leatherMat = new THREE.MeshPhysicalMaterial({ map: leatherTex, roughness: .7, sheen: .4, sheenColor: new THREE.Color(0xc89a6a), normalMap: textures().piel, normalScale: new THREE.Vector2(.5, .5) });
  const pw = .62;
  const plate = new THREE.Group();
  plate.add(new THREE.Mesh(conformGeometry('disc', DECAL.cx, DECAL.cy, pw, pw, .006, .012), plateMat));
  plate.add(new THREE.Mesh(conformRim('disc', DECAL.cx, DECAL.cy, pw, pw, .006, .012), rimMat));
  const patch = new THREE.Group();
  patch.add(new THREE.Mesh(conformGeometry('rect', DECAL.cx, DECAL.cy, .7, .5, .004, .008), leatherMat));
  patch.add(new THREE.Mesh(conformRim('rect', DECAL.cx, DECAL.cy, .7, .5, .004, .008), new THREE.MeshStandardMaterial({ color: 0x5a3519, roughness: .8 })));
  plate.visible = patch.visible = false; cap.add(plate, patch);

  function paintMetal(logo) {
    const x = metalCanvas.getContext('2d'); const S = 1024;
    const g = x.createRadialGradient(S * .35, S * .3, 40, S / 2, S / 2, S * .7); g.addColorStop(0, '#2f3035'); g.addColorStop(1, '#141417');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 2600; i++) { x.strokeStyle = `rgba(255,255,255,${Math.random() * .035})`; const r = Math.random() * S * .5; x.beginPath(); x.arc(S / 2, S / 2, r, Math.random() * 6, Math.random() * 6 + .4); x.stroke(); }
    x.strokeStyle = 'rgba(150,154,160,.55)'; x.lineWidth = 9; x.beginPath(); x.arc(S / 2, S / 2, S * .455, 0, 7); x.stroke();
    if (logo) {
      const t = document.createElement('canvas'); t.width = t.height = S; const tx = t.getContext('2d');
      tx.drawImage(logo.mask, S * .15, S * .15, S * .7, S * .7);
      tx.globalCompositeOperation = 'source-in'; const lg = tx.createLinearGradient(0, 0, 0, S); lg.addColorStop(0, '#a7aab0'); lg.addColorStop(1, '#7e8187'); tx.fillStyle = lg; tx.fillRect(0, 0, S, S);
      x.drawImage(t, 0, 0);
    }
    metalTex.needsUpdate = true;
  }
  function paintLeather(logo) {
    const x = leatherCanvas.getContext('2d'); const W = 1024, H = 720;
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#a87446'); g.addColorStop(1, '#7c4f2b'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '40,20,8' : '255,220,180'},${Math.random() * .05})`; x.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
    const v = x.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, 620); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,18,4,.55)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
    x.setLineDash([26, 16]); x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,.35)';
    const rr = (o) => { const r = 70; x.beginPath(); x.roundRect(o + 34, o + 34, W - 68 - o * 0, H - 68 - o * 0, r); };
    rr(2); x.stroke(); x.strokeStyle = '#efdfc2'; x.lineWidth = 5.5; rr(0); x.stroke(); x.setLineDash([]);
    if (logo) {
      const t = document.createElement('canvas'); t.width = W; t.height = H; const tx = t.getContext('2d');
      const s = Math.min(W * .74, H * .74); tx.drawImage(logo.mask, (W - s) / 2, (H - s) / 2, s, s);
      tx.globalCompositeOperation = 'source-in'; tx.fillStyle = 'rgba(38,16,4,.97)'; tx.fillRect(0, 0, W, H);
      x.drawImage(t, 0, 0);
    }
    leatherTex.needsUpdate = true;
  }

  function applyMaterials() {
    const m = mats();
    parts.front.material = m.front;
    for (const k of ['sideL', 'sideR', 'backL', 'backR']) parts[k].material = m.crown;
    parts.visorTop.material = m.visorTop; parts.visorBottom.material = m.visorBottom; parts.visorEdge.material = m.edge;
    parts.button.material = m.button;
    eyeletMat.color.set(st.colors.crown).multiplyScalar(.75);
    const M = MODELS[st.model];
    linings.forEach((l) => { l.visible = !!M.perf; });
    statics.lining.emissive.set(M.lining || '#ffd2c8');
    parts.eyelets.visible = !M.mesh;
    applyTech();
  }
  function applyTech() {
    const u = parts.front.material.userData.u;
    u.uTech.value = TECH[st.tech]; u.uLogoOn.value = st.logo ? 1 : 0;
    u.uDecal.value.set(DECAL.cx, DECAL.cy, DECAL.w, DECAL.h);
    plate.visible = st.tech === 'placa'; patch.visible = st.tech === 'parche';
    if (st.logo) {
      logoTex.image = st.tech === 'bordado' ? st.logo.thread : st.logo.canvas; logoTex.needsUpdate = true;
      if (st.tech === 'placa') paintMetal(st.logo);
      if (st.tech === 'parche') paintLeather(st.logo);
    }
    invalidate();
  }

  /* ---------- cámara y controles ---------- */
  const target = new THREE.Vector3(0, -.04, .3);
  const view = { yaw: -.55, pitch: .2, dist: 6.7 };
  const goal = { ...view };
  const VIEWS = { front: { yaw: 0, pitch: .14, dist: 6.5 }, side: { yaw: -Math.PI / 2, pitch: .1, dist: 6.9 }, back: { yaw: Math.PI, pitch: .2, dist: 6.7 }, visor: { yaw: -.35, pitch: .95, dist: 7.0 }, under: { yaw: -.5, pitch: -.24, dist: 6 } };
  let vel = 0, lastInput = 0, autoRot = !reduced, dirty = true;
  const invalidate = () => { dirty = true; };
  function placeCamera() {
    const cp = Math.cos(view.pitch);
    camera.position.set(target.x + Math.sin(view.yaw) * cp * view.dist, target.y + Math.sin(view.pitch) * view.dist, target.z + Math.cos(view.yaw) * cp * view.dist);
    camera.lookAt(target);
  }
  const el = renderer.domElement;
  const pointers = new Map(); let pinch0 = 0, dist0 = 0, lastTap = 0, moved = 0;
  el.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture(e.pointerId); moved = 0;
    lastInput = performance.now(); vel = 0;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = goal.dist; }
  });
  el.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (pointers.size === 1) {
      goal.yaw -= dx * .0085; view.yaw = goal.yaw; vel = -dx * .0085;
      if (e.pointerType === 'mouse' || Math.abs(dy) > Math.abs(dx)) { goal.pitch = Math.max(-.25, Math.min(1.25, goal.pitch + dy * .006)); }
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      goal.dist = Math.max(3.6, Math.min(9, dist0 * pinch0 / Math.max(d, 1)));
    }
    lastInput = performance.now(); invalidate();
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    const now = performance.now();
    if (moved < 6 && e.pointerType !== 'mouse') { if (now - lastTap < 320) setView('front'); lastTap = now; }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
  el.addEventListener('dblclick', () => setView('front'));
  el.addEventListener('wheel', (e) => { if (!e.ctrlKey) return; e.preventDefault(); goal.dist = Math.max(3.6, Math.min(9, goal.dist * (1 + e.deltaY * .01))); lastInput = performance.now(); invalidate(); }, { passive: false });
  host.tabIndex = 0;
  host.addEventListener('keydown', (e) => {
    const k = e.key; let h = true;
    if (k === 'ArrowLeft') goal.yaw += .25; else if (k === 'ArrowRight') goal.yaw -= .25;
    else if (k === 'ArrowUp') goal.pitch = Math.min(1.25, goal.pitch + .15); else if (k === 'ArrowDown') goal.pitch = Math.max(-.25, goal.pitch - .15);
    else if (k === '+' || k === '=') goal.dist = Math.max(3.6, goal.dist - .5); else if (k === '-') goal.dist = Math.min(9, goal.dist + .5);
    else if (k === 'Home' || k === '0') setView('front'); else h = false;
    if (h) { e.preventDefault(); lastInput = performance.now(); invalidate(); }
  });
  function setView(name) {
    const v = VIEWS[name]; if (!v) return;
    // camino corto en el giro
    let y = v.yaw; while (y - goal.yaw > Math.PI) y -= Math.PI * 2; while (y - goal.yaw < -Math.PI) y += Math.PI * 2;
    Object.assign(goal, { ...v, yaw: y }); vel = 0; lastInput = performance.now(); invalidate();
  }

  /* ---------- gotas de agua (Impermeable) ---------- */
  const DROPS = 90;
  const dropMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2430, roughness: .03, metalness: .1, transparent: true, opacity: .82, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 3.2, specularIntensity: 1, ior: 1.33 });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), dropMat, DROPS);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); drops.count = 0; drops.frustumCulled = false; cap.add(drops);
  const D = Array.from({ length: DROPS }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0, on: 0, alive: false }));
  // tabla de radio de la copa por ángulo y altura
  const RT = 64, RH = 48; const radTab = new Float32Array(RT * RH);
  { const P = new THREE.Vector3();
    for (let i = 0; i < RT; i++) { const th = -Math.PI + (i / RT) * Math.PI * 2; const ys = [], rs = [];
      for (let k = 0; k <= 80; k++) { crownPoint(th, k / 80, P); ys.push(P.y); rs.push(Math.hypot(P.x, P.z - CAP.zA)); }
      for (let j = 0; j < RH; j++) { const y = j / (RH - 1) * CAP.H; let r = 0; for (let k = 1; k <= 80; k++) if (ys[k] >= y) { const f = (y - ys[k - 1]) / Math.max(1e-5, ys[k] - ys[k - 1]); r = rs[k - 1] + (rs[k] - rs[k - 1]) * f; break; } radTab[i * RH + j] = r; } } }
  const crownR = (th, y) => { if (y < 0 || y > CAP.H) return 0; const i = Math.floor(((th + Math.PI) / (Math.PI * 2)) * RT) % RT; const j = Math.min(RH - 1, Math.round(y / CAP.H * (RH - 1))); return radTab[i * RH + j]; };
  // altura de la visera en una rejilla (x,z)
  const VX = 56, VZ = 40, vxMin = -1.1, vxMax = 1.1, vzMin = .25, vzMax = 1.92; const visTab = new Float32Array(VX * VZ).fill(NaN);
  { const P = new THREE.Vector3(); for (let i = 0; i <= 220; i++) for (let j = 0; j <= 60; j++) { visorPoint(-1 + 2 * i / 220, j / 60, P); const gx = Math.round((P.x - vxMin) / (vxMax - vxMin) * (VX - 1)), gz = Math.round((P.z - vzMin) / (vzMax - vzMin) * (VZ - 1)); if (gx >= 0 && gx < VX && gz >= 0 && gz < VZ) { const k = gz * VX + gx; visTab[k] = Number.isNaN(visTab[k]) ? P.y : Math.max(visTab[k], P.y); } } }
  const visorY = (x, z) => { const gx = Math.round((x - vxMin) / (vxMax - vxMin) * (VX - 1)), gz = Math.round((z - vzMin) / (vzMax - vzMin) * (VZ - 1)); if (gx < 0 || gx >= VX || gz < 0 || gz >= VZ) return NaN; return visTab[gz * VX + gx]; };
  let rainUntil = 0, spawnAcc = 0;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), up3 = new THREE.Vector3(0, 1, 0);
  function stepDrops(dt, now) {
    let alive = 0;
    if (now < rainUntil) {
      spawnAcc += dt * 34;
      for (; spawnAcc >= 1; spawnAcc--) { const d = D.find((x) => !x.alive); if (!d) break;
        const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
        d.p.set(Math.sin(ang) * rr * .9, 2.0 + Math.random() * .5, CAP.zA + Math.cos(ang) * rr * 1.4 + .4); d.v.set(0, -2.2, 0); d.r = .022 + Math.random() * .03; d.on = 0; d.alive = true; }
    }
    for (const d of D) {
      if (!d.alive) continue;
      d.v.y -= 9.8 * .55 * dt; d.p.addScaledVector(d.v, dt);
      const th = Math.atan2(d.p.x, d.p.z - CAP.zA); const hr = Math.hypot(d.p.x, d.p.z - CAP.zA);
      const rc = crownR(th, d.p.y);
      if (rc > 0 && hr < rc + d.r) { // choca con la copa: hace perla y resbala
        const nx = d.p.x / (hr || 1), nz = (d.p.z - CAP.zA) / (hr || 1);
        const slope = (crownR(th, d.p.y + .02) - crownR(th, d.p.y - .02)) / .04;
        const n = new THREE.Vector3(nx, -slope, nz).normalize();
        d.p.x = nx * (rc + d.r); d.p.z = CAP.zA + nz * (rc + d.r);
        const vn = d.v.dot(n); if (vn < 0) d.v.addScaledVector(n, -vn * (d.on ? 1 : 1.35));
        d.v.multiplyScalar(d.on ? .9 : .5); d.on = 1;
      }
      const vy = visorY(d.p.x, d.p.z);
      if (!Number.isNaN(vy) && d.p.y < vy + d.r && d.p.y > vy - .08) {
        d.p.y = vy + d.r; const vn = d.v.y; if (vn < 0) d.v.y = -vn * (d.on ? 0 : .3);
        const gx = (visorY(d.p.x + .03, d.p.z) - visorY(d.p.x - .03, d.p.z)) / .06 || 0, gz = (visorY(d.p.x, d.p.z + .03) - visorY(d.p.x, d.p.z - .03)) / .06 || 0;
        d.v.x -= gx * 4 * dt * 9.8 * .3; d.v.z -= gz * 4 * dt * 9.8 * .3 - .15 * dt; d.v.multiplyScalar(.93); d.on = 1;
      }
      if (d.p.y < -1.4) { d.alive = false; continue; }
      const sp = d.v.length(); const stretch = d.on ? 1 : 1 + Math.min(.8, sp * .12);
      Q.setFromUnitVectors(up3, sp > .01 ? d.v.clone().normalize().negate() : up3);
      S.set(d.r * (d.on ? 1.15 : .85), d.r * stretch * (d.on ? .78 : 1), d.r * (d.on ? 1.15 : .85));
      M4.compose(d.p, Q, S); drops.setMatrixAt(alive++, M4);
    }
    drops.count = alive; drops.instanceMatrix.needsUpdate = true;
    return alive > 0;
  }

  /* ---------- loop ---------- */
  let W = 1, H = 1, visible = true, raf = 0, last = performance.now(), slow = 0;
  const resize = () => { const r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); invalidate(); };
  new ResizeObserver(resize).observe(host); resize();
  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    shared.uTime.value += dt;
    const idle = now - lastInput > 2600;
    if (autoRot && idle && pointers.size === 0) { goal.yaw -= dt * .32; view.yaw = goal.yaw; invalidate(); }
    else if (pointers.size === 0 && Math.abs(vel) > 1e-4) { goal.yaw += vel; view.yaw = goal.yaw; vel *= .93; invalidate(); }
    const k = 1 - Math.pow(.0015, dt);
    for (const p of ['yaw', 'pitch', 'dist']) { const d = goal[p] - view[p]; if (Math.abs(d) > 1e-4) { view[p] += d * k; invalidate(); } }
    const rain = stepDrops(dt, now);
    const anim = shared.uWob.value > .001 || shared.uBand.value > -1 || rain || [...cache.values()].some((m) => m.userData.u.uSweep.value < 3.2);
    if (dirty || anim) {
      const r0 = performance.now(); placeCamera(); renderer.render(scene, camera); dirty = false;
      frameTimes.push(dt * 1000); if (frameTimes.length > 60) frameTimes.shift(); void r0;
      // baja la resolución si el celular no alcanza
      if (dt > .024) { if (++slow > 40 && dpr > 1) { dpr = Math.max(1, dpr - .25); renderer.setPixelRatio(dpr); resize(); slow = 0; } } else slow = Math.max(0, slow - 1);
    }
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }, { rootMargin: '120px' }).observe(host);
  document.addEventListener('visibilitychange', kick);
  placeCamera(); applyMaterials(); renderer.compile(scene, camera); kick();

  /* ---------- horneado para el visor sin WebGL ---------- */
  // Pasada de id: 1 corona, 2 visera, 3 abajo de la visera, 4 corona dentro del área del logo (G,B = coordenadas del logo)
  const idMat = (id, decal = false) => new THREE.ShaderMaterial({
    uniforms: { uId: { value: id }, uDecal: { value: new THREE.Vector4(DECAL.cx, DECAL.cy, DECAL.w, DECAL.h) } },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uId; uniform vec4 uDecal; varying vec2 vU;
      void main(){ float id = uId; vec2 d = vec2(0.);
        ${decal ? 'd = (vU - uDecal.xy) / uDecal.zw + .5; if (d.x > 0. && d.x < 1. && d.y > 0. && d.y < 1.) id = 4.; else d = vec2(0.);' : ''}
        gl_FragColor = vec4(id * 60. / 255., d.x, d.y, 1.); }`,
    side: THREE.DoubleSide,
  });
  function bake(yaw, pitch = .14, size = 480) {
    const prev = { W, H, dpr, yaw: view.yaw, pitch: view.pitch, dist: view.dist };
    const hidden = [plate.visible, patch.visible, drops.visible, shadow.visible];
    plate.visible = patch.visible = false; drops.visible = false; shadow.visible = false;
    renderer.setPixelRatio(1); renderer.setSize(size, size, false); camera.aspect = 1; camera.updateProjectionMatrix();
    Object.assign(view, { yaw, pitch, dist: 6.5 }); Object.assign(goal, { yaw, pitch, dist: 6.5 }); placeCamera();
    // 1) sombreado con la gorra en gris neutro y sin logo
    const saved = { ...st.colors }; const logoOn = parts.front.material.userData.u.uLogoOn.value;
    const gray = '#7a7a7a';
    [parts.front, parts.sideL, parts.sideR, parts.backL, parts.backR, parts.button, parts.visorTop, parts.visorEdge, parts.visorBottom].forEach((m) => { m.material.color.set(gray); const u = m.material.userData.u; u.uOld.value.set(gray); u.uNew.value.set(gray); u.uSweep.value = 99; });
    parts.front.material.userData.u.uLogoOn.value = 0;
    renderer.setClearColor(0x000000, 0); renderer.render(scene, camera);
    const shade = renderer.domElement.toDataURL('image/png');
    // 2) ids y coordenadas del logo
    const mats = new Map();
    const ids = { front: [1, true], sideL: [1], sideR: [1], backL: [1], backR: [1], button: [1], visorTop: [2], visorEdge: [2], visorBottom: [3] };
    cap.traverse((o) => { if (o.isMesh) { mats.set(o, o.material); const k = Object.entries(parts).find(([, v]) => v === o)?.[0]; const def = ids[k]; o.material = def ? idMat(def[0], !!def[1]) : (o === drops ? o.material : idMat(0)); } });
    const tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping;
    renderer.render(scene, camera);
    const id = renderer.domElement.toDataURL('image/png');
    renderer.toneMapping = tm;
    mats.forEach((m, o) => { o.material = m; });
    // restaura
    parts.front.material.userData.u.uLogoOn.value = logoOn;
    for (const [k, v] of Object.entries(saved)) st.colors[k] = v;
    applyMaterials();
    [plate.visible, patch.visible, drops.visible, shadow.visible] = hidden;
    renderer.setPixelRatio(prev.dpr); renderer.setSize(prev.W, prev.H, false); camera.aspect = prev.W / prev.H; camera.updateProjectionMatrix();
    Object.assign(view, { yaw: prev.yaw, pitch: prev.pitch, dist: prev.dist }); Object.assign(goal, { yaw: prev.yaw, pitch: prev.pitch, dist: prev.dist });
    invalidate(); kick();
    return { shade, id };
  }
  // rendimiento: tiempo medio por cuadro de los últimos cuadros dibujados
  const frameTimes = [];

  /* ---------- API ---------- */
  const worldOrigin = (part) => {
    // punto de inicio del barrido: lo más cercano a la cámara de esa parte
    const camLocal = cap.worldToLocal(camera.position.clone());
    if (part === 'crown') return crownPoint(Math.atan2(camLocal.x, camLocal.z - CAP.zA), .55);
    return visorPoint(Math.max(-1, Math.min(1, camLocal.x / 1.2)), part === 'under' ? .9 : .7);
  };
  const sweep = (m, hex, origin) => {
    const u = m.userData.u;
    u.uOld.value.copy(u.uSweep.value >= 3.2 ? u.uNew.value : u.uOld.value.clone().lerp(u.uNew.value, u.uSweep.value / 3.2));
    u.uNew.value.set(hex); m.color.set(hex);
    if (m.sheenColor) m.sheenColor.set(hex).lerp(new THREE.Color(1, 1, 1), .25);
    u.uOrigin.value.copy(origin); u.uSweep.value = reduced ? 3.2 : 0;
    if (!reduced) tween(u.uSweep, 'value', 3.2, 1.25, (t) => t);
    kick();
  };
  return {
    setColor(part, hex) {
      st.colors[part] = hex;
      const o = worldOrigin(part);
      const list = part === 'crown' ? [parts.front.material, parts.sideL.material, parts.button.material] : part === 'visor' ? [parts.visorTop.material, parts.visorEdge.material] : [parts.visorBottom.material];
      [...new Set(list)].forEach((m) => sweep(m, hex, o));
      if (part === 'crown') eyeletMat.color.set(hex).multiplyScalar(.75);
      invalidate(); kick();
    },
    async setModel(model, colors) {
      if (colors) Object.assign(st.colors, colors);
      if (reduced) { st.model = model; applyMaterials(); kick(); return; }
      shared.uBand.value = 1.35; shared.uWob.value = 1; kick();
      tween(shared.uBand, 'value', -.35, 1.1, (t) => t);
      await new Promise((r) => setTimeout(r, 380));
      st.model = model; applyMaterials();
      await tween(shared.uWob, 'value', 0, 1.2);
      shared.uBand.value = -9; invalidate(); kick();
    },
    setTech(t) { st.tech = t; applyTech(); kick(); },
    setLogo(logo) { st.logo = logo; applyTech(); kick(); },
    setView(v) { setView(v); kick(); },
    setClear(hex, a = 1) { renderer.setClearColor(hex, a); shadow.visible = a < 1; invalidate(); kick(); },
    setTarget(x, y, z) { target.set(x, y, z); invalidate(); kick(); },
    setCamera({ yaw, pitch, dist, fov } = {}) { // para QA y para el hero
      if (yaw != null) view.yaw = goal.yaw = yaw; if (pitch != null) view.pitch = goal.pitch = pitch; if (dist != null) view.dist = goal.dist = dist;
      if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); } invalidate(); kick();
    },
    water() { rainUntil = performance.now() + 4200; setView('front'); goal.pitch = .38; kick(); },
    stopAuto() { autoRot = false; },
    bake,
    perf() { return frameTimes.length ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0; },
    _simWater(sec) { // QA: simula la lluvia en pasos de 1/60 s sin depender de los fps
      const t0 = performance.now(); rainUntil = t0 + 4200;
      for (let k = 0; k < sec * 60; k++) stepDrops(1 / 60, t0 + k * 1000 / 60);
      rainUntil = 0; placeCamera(); renderer.render(scene, camera); return drops.count;
    },
    snapshot(w = 1080, h = 1350) {
      const prev = { W, H, dpr };
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      placeCamera(); renderer.render(scene, camera);
      const out = document.createElement('canvas'); out.width = w; out.height = h; out.getContext('2d').drawImage(renderer.domElement, 0, 0);
      renderer.setPixelRatio(prev.dpr); renderer.setSize(prev.W, prev.H, false); camera.aspect = prev.W / prev.H; camera.updateProjectionMatrix(); invalidate(); kick();
      return out;
    },
    get state() { return st; },
    renderer,
  };
}
