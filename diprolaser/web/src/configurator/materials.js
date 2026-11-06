// Materiales de tela hechos en el navegador (sin texturas pesadas): normales de sarga, gamuza, poliéster,
// malla trucker y perforaciones; barrido líquido de color, pespuntes, interior y calcomanía del logo.
import * as THREE from 'three';

export const shared = { uTime: { value: 0 }, uWob: { value: 0 }, uBand: { value: -9 } };

function heightToNormal(h, size, strength) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const d = x.createImageData(size, size);
  const at = (i, j) => h[((j + size) % size) * size + ((i + size) % size)];
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const dx = (at(i + 1, j) - at(i - 1, j)) * strength, dy = (at(i, j + 1) - at(i, j - 1)) * strength;
    const l = Math.hypot(dx, dy, 1); const k = (j * size + i) * 4;
    d.data[k] = (-dx / l * .5 + .5) * 255; d.data[k + 1] = (dy / l * .5 + .5) * 255; d.data[k + 2] = (1 / l * .5 + .5) * 255; d.data[k + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
  return t;
}
function valueNoise(size, cells, seed = 1) {
  const g = []; let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < cells * cells; i++) g.push(rnd());
  const out = new Float32Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = i / size * cells, y = j / size * cells; const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const v = (a, b) => g[((b % cells) * cells) + (a % cells)];
    out[j * size + i] = (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
  }
  return out;
}
const TEX = {};
export function textures() {
  if (TEX.tela) return TEX;
  const N = 256;
  { // sarga diagonal (gabardina de algodón)
    const h = new Float32Array(N * N); const n = valueNoise(N, 32, 7);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const d = (i + j) / N * 16; h[j * N + i] = .5 + .5 * Math.sin(d * Math.PI * 2) * (.7 + .3 * Math.sin(j / N * Math.PI * 64)) + n[j * N + i] * .4; }
    TEX.tela = heightToNormal(h, N, 1.6);
  }
  { // gamuza: pelo fino con dirección
    const a = valueNoise(N, 64, 3), b = valueNoise(N, 16, 9), h = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) h[k] = a[k] * .7 + b[k] * .5;
    TEX.gamuza = heightToNormal(h, N, 2.2);
  }
  { // poliéster impermeable: tejido muy fino y liso
    const h = new Float32Array(N * N); const n = valueNoise(N, 64, 5);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = (.5 + .5 * Math.sin(i / N * Math.PI * 2 * 48) * Math.sin(j / N * Math.PI * 2 * 48)) * .3 + n[j * N + i] * .2;
    TEX.poly = heightToNormal(h, N, .8);
  }
  { // piel del parche
    const a = valueNoise(N, 24, 11), b = valueNoise(N, 96, 13), h = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) h[k] = Math.abs(a[k] - .5) * 1.4 + b[k] * .3;
    TEX.piel = heightToNormal(h, N, 2.4);
  }
  // perforaciones (micro y láser) y malla trucker como alphaMap
  const dots = (cells, r) => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#000';
    const step = 128 / cells;
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) { const ox = (j % 2) * step / 2; x.beginPath(); x.arc(i * step + ox + step / 2, j * step + step / 2, r * step, 0, 7); x.fill(); if (i === 0 && j % 2) { x.beginPath(); x.arc(cells * step + ox - step / 2 + step / 2 - step, j * step + step / 2, r * step, 0, 7); x.fill(); } }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t;
  };
  TEX.perf = dots(4, .16);
  {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#000';
    const hexR = 13, w = Math.sqrt(3) * hexR * 1.18, hh = hexR * 1.5 * 1.18;
    for (let j = -1; j < 128 / hh + 1; j++) for (let i = -1; i < 128 / w + 1; i++) {
      const cx = i * w + (j % 2 ? w / 2 : 0), cy = j * hh; x.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; x.lineTo(cx + Math.cos(a) * hexR * .82, cy + Math.sin(a) * hexR * .82); }
      x.closePath(); x.fill();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; TEX.mesh = t;
  }
  return TEX;
}

export const KINDS = {
  tela: { normal: 'tela', rough: .92, sheen: .14, sheenRough: .8, nscale: .55, rep: 9 },
  gamuza: { normal: 'gamuza', rough: .97, sheen: .55, sheenRough: .55, nscale: .7, rep: 6 },
  poly: { normal: 'poly', rough: .5, sheen: .15, sheenRough: .6, nscale: .35, rep: 14, clearcoat: .2 },
  malla: { normal: 'poly', rough: .7, sheen: .2, sheenRough: .7, nscale: .4, rep: 14, alpha: 'mesh', arep: 6 },
};

const lin = (hex) => new THREE.Color(hex);

/** Tela con barrido líquido de color, pespuntes y (opcional) la calcomanía del logo. */
export function fabric({ kind = 'tela', color = '#111214', role = 'crown', perforated = false, decal = null }) {
  const K = KINDS[kind]; const T = textures();
  const m = new THREE.MeshPhysicalMaterial({
    color: lin(color), roughness: K.rough, metalness: 0,
    sheen: K.sheen, sheenRoughness: K.sheenRough, sheenColor: lin(color).lerp(new THREE.Color(.5, .5, .5), .35),
    normalMap: T[K.normal], normalScale: new THREE.Vector2(K.nscale, K.nscale),
    clearcoat: K.clearcoat || 0, clearcoatRoughness: .55,
    side: THREE.DoubleSide,
  });
  const alpha = perforated ? 'perf' : K.alpha;
  if (alpha) { m.alphaMap = T[alpha]; m.alphaTest = .5; }
  const u = {
    uOld: { value: lin(color) }, uNew: { value: lin(color) }, uSweep: { value: 99 }, uOrigin: { value: new THREE.Vector3(0, 1, 1) },
    uInner: { value: lin('#0b0b0d') }, uRep: { value: K.rep }, uARep: { value: perforated ? 5.5 : (K.arep || 6) },
    uRole: { value: { crown: 0, front: 1, visorTop: 2, visorBottom: 3, edge: 4, button: 5 }[role] ?? 0 },
    uLogo: { value: decal?.tex || null }, uLogoOn: { value: 0 }, uTech: { value: 0 },
    uDecal: { value: new THREE.Vector4(0, .58, .6, .6) }, uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
    ...shared,
  };
  m.userData.u = u; m.userData.kind = kind; m.userData.role = role;
  m.customProgramCacheKey = () => `fab-${role}-${alpha || 'x'}-${decal ? 'd' : 'n'}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.defines = { ...(sh.defines || {}), USE_UV: '' };
    if (decal) sh.defines.HAS_DECAL = '';
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aSt; varying vec4 vSt; varying vec3 vObj; varying vec2 vUv2;
        uniform float uRep; uniform float uARep; uniform float uWob; uniform float uTime; uniform float uBand;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        vUv2 = uv; vSt = aSt; vObj = position;
        #ifdef USE_NORMALMAP
          vNormalMapUv = uv * uRep;
        #endif
        #ifdef USE_ALPHAMAP
          vAlphaMapUv = uv * uARep;
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float wob = uWob * sin(position.y * 13. + position.x * 5. - uTime * 16.) * .022;
        transformed += normal * wob;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec4 vSt; varying vec3 vObj; varying vec2 vUv2;
        uniform vec3 uOld; uniform vec3 uNew; uniform float uSweep; uniform vec3 uOrigin; uniform vec3 uInner;
        uniform int uRole; uniform float uTime; uniform float uBand; uniform float uARep;
        uniform sampler2D uLogo; uniform float uLogoOn; uniform int uTech; uniform vec4 uDecal; uniform vec2 uTexel;
        float hsh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
          return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }
        float dash(float a, float per, float on){ return step(fract(a / per), on); }
        float row(float d, float c, float w){ return 1. - smoothstep(w * .5, w, abs(d - c)); }`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `vec4 diffuseColor = vec4( diffuse, opacity );
        // barrido líquido de color desde el punto tocado
        float dS = distance(vObj, uOrigin) + (vnoise(vObj * 7. + uTime * .6) - .5) * .16;
        float kS = smoothstep(uSweep - .07, uSweep, dS);
        vec3 baseC = mix(uNew, uOld, kS);
        float waveS = (1. - smoothstep(0., .06, abs(dS - uSweep))) * step(.0, uSweep) * (1. - step(6., uSweep));
        diffuseColor.rgb = baseC;
        float thread = 0.; float emb = 0.;
        if (uRole <= 1) {
          float sd = vSt.x, al = vSt.y, ed = vSt.z, ar = vSt.w;
          thread = max(row(sd, .016, .0026), row(sd, .03, .0026)) * dash(al, .034, .76) * step(.01, al);
          thread = max(thread, (row(ed, .035, .0028) + row(ed, .05, .0028)) * dash(ar, .034, .76));
        } else if (uRole == 2 || uRole == 3) {
          float t = vUv2.y; float al = vSt.y;
          for (int k = 0; k < 8; k++) { float tk = .955 - float(k) * .072; thread = max(thread, row(t, tk, .0056) * dash(al, .036, .78)); }
        }
        #ifdef HAS_DECAL
          vec2 duv = (vUv2 - uDecal.xy) / uDecal.zw + .5;
          if (uLogoOn > .5 && duv.x > 0. && duv.x < 1. && duv.y > 0. && duv.y < 1.) {
            vec4 lg = texture2D(uLogo, duv);
            float m = lg.a;
            if (uTech == 0) {
              // bordado: hilo satinado con relieve y brillo
              float stripe = sin((duv.x * .55 + duv.y) * 520.) * .5 + .5;
              vec3 th = lg.rgb * (.72 + .5 * stripe);
              diffuseColor.rgb = mix(diffuseColor.rgb, th, m);
              emb = m;
              float mE = texture2D(uLogo, duv + uTexel * 6.).a;
              diffuseColor.rgb *= 1. - .45 * clamp(mE - m, 0., 1.);
            } else if (uTech == 3) {
              // grabado láser: la tela se quema/aclara y se aplana
              float L = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
              vec3 burn = L < .08 ? vec3(.13, .12, .11) + diffuseColor.rgb * .8 : diffuseColor.rgb * vec3(.42, .36, .30);
              diffuseColor.rgb = mix(diffuseColor.rgb, burn, m * .92);
              emb = -m * .3;
            } else if (uTech == 4) {
              diffuseColor.rgb = mix(diffuseColor.rgb, lg.rgb, m);
              emb = m * .25;
            } else {
              // placa o parche: sombra de contacto alrededor de la pieza
              float dc = length((duv - .5) * vec2(1., 1.));
              diffuseColor.rgb *= 1. - .35 * smoothstep(.62, .45, dc) * (uTech == 1 ? 1. : .8);
            }
          }
        #endif
        float Lb = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + vec3(.006), thread * (Lb < .05 ? .85 : .45));
        if (!gl_FrontFacing) diffuseColor.rgb = uInner;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, .42, clamp(emb, 0., 1.));
        roughnessFactor = mix(roughnessFactor, .7, thread);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float hB = emb + thread * .35;
        normal = normalize(normal + vec3(-dFdx(hB), -dFdy(hB), 0.) * 2.2);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1., .22, .2) * waveS * .9;
        float band = 1. - smoothstep(0., .07, abs(vObj.y - uBand));
        totalEmissiveRadiance += vec3(1., .16, .18) * band * .8;`);
  };
  return m;
}

/** Cambia el color con el barrido líquido (origen en espacio local de la gorra). */
export function sweepTo(mat, hex, origin, gsapLike) {
  const u = mat.userData.u;
  u.uOld.value.copy(currentColor(mat));
  u.uNew.value.set(hex);
  mat.color.set(hex);
  if (mat.sheenColor) mat.sheenColor.set(hex).lerp(new THREE.Color(1, 1, 1), .25);
  u.uOrigin.value.copy(origin);
  u.uSweep.value = 0;
  return gsapLike(u.uSweep, 3.2);
}
function currentColor(mat) {
  const u = mat.userData.u;
  return u.uSweep.value >= 3 ? u.uNew.value.clone() : u.uOld.value.clone().lerp(u.uNew.value, Math.min(1, u.uSweep.value / 3));
}
