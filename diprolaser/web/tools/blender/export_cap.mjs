// Exporta la geometría de la gorra (la misma de la página) a glTF para Blender.
// TEXCOORD_0 = uv propio de la pieza, TEXCOORD_1 = (dist. a costura, a lo largo), TEXCOORD_2 = (dist. al borde, arco)
import * as THREE from 'three';
import fs from 'node:fs';
import { buildCap } from '../../src/configurator/cap.js';
const M = new Proxy({}, { get: () => new THREE.MeshBasicMaterial() });
const { cap } = buildCap(M);
cap.updateMatrixWorld(true);
const meshes = []; cap.traverse((o) => { if (o.isMesh) meshes.push(o); });
const chunks = []; let offset = 0;
const gl = { asset: { version: '2.0', generator: 'diprolaser' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [] };
function addAccessor(arr, type, count, comp = 5126, target) {
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const pad = (4 - (buf.length % 4)) % 4;
  gl.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, ...(target ? { target } : {}) });
  chunks.push(buf, Buffer.alloc(pad)); offset += buf.length + pad;
  const acc = { bufferView: gl.bufferViews.length - 1, componentType: comp, count, type };
  if (type === 'VEC3' && comp === 5126) { const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity]; for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], arr[i * 3 + k]); mx[k] = Math.max(mx[k], arr[i * 3 + k]); } acc.min = mn; acc.max = mx; }
  gl.accessors.push(acc); return gl.accessors.length - 1;
}
const names = new Map(); let i = 0;
for (const m of meshes) {
  let g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld);
  if (!g.index) g = g.toNonIndexed();
  const n = g.attributes.position.count;
  const attrs = {
    POSITION: addAccessor(new Float32Array(g.attributes.position.array), 'VEC3', n, 5126, 34962),
    NORMAL: addAccessor(new Float32Array(g.attributes.normal.array), 'VEC3', n, 5126, 34962),
  };
  const uv = g.attributes.uv ? new Float32Array(g.attributes.uv.array) : new Float32Array(n * 2);
  attrs.TEXCOORD_0 = addAccessor(uv, 'VEC2', n, 5126, 34962);
  const st = g.attributes.aSt ? g.attributes.aSt.array : new Float32Array(n * 4);
  const a = new Float32Array(n * 2), b = new Float32Array(n * 2);
  for (let k = 0; k < n; k++) { a[k * 2] = st[k * 4]; a[k * 2 + 1] = st[k * 4 + 1]; b[k * 2] = st[k * 4 + 2]; b[k * 2 + 1] = st[k * 4 + 3]; }
  attrs.TEXCOORD_1 = addAccessor(a, 'VEC2', n, 5126, 34962);
  attrs.TEXCOORD_2 = addAccessor(b, 'VEC2', n, 5126, 34962);
  const idx = g.index ? new Uint32Array(g.index.array) : null;
  const prim = { attributes: attrs, mode: 4 };
  if (idx) prim.indices = addAccessor(idx, 'SCALAR', idx.length, 5125, 34963);
  let name = m.name || (m.parent?.name ? `${m.parent.name}_${i}` : `part_${i}`);
  if (!m.name) name = m.geometry.type === 'TorusGeometry' ? `eyelet_${i}` : m.geometry.type === 'CircleGeometry' ? `hole_${i}` : `snap_${i}`;
  names.set(name, (names.get(name) || 0) + 1);
  gl.meshes.push({ name, primitives: [prim] });
  gl.nodes.push({ name, mesh: gl.meshes.length - 1 });
  gl.scenes[0].nodes.push(gl.nodes.length - 1); i++;
}
const bin = Buffer.concat(chunks);
gl.buffers.push({ byteLength: bin.length, uri: `data:application/octet-stream;base64,${bin.toString('base64')}` });
const out = process.argv[2] || 'build/cap.gltf';
fs.writeFileSync(out, JSON.stringify(gl));
console.log('ok', gl.meshes.length, 'mallas', (bin.length / 1e6).toFixed(1), 'MB', gl.meshes.map((m) => m.name).join(','));
