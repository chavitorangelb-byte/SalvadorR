// Placa redonda y parche de piel conformados al frente (mismas medidas que el configurador).
import * as THREE from 'three';
import fs from 'node:fs';
import { conformGeometry, conformRim } from '../../src/configurator/cap.js';
const parts = {
  plate: conformGeometry('disc', 0, .68, .62, .62, .006, .012),
  plateRim: conformRim('disc', 0, .68, .62, .62, .006, .012),
  patch: conformGeometry('rect', 0, .68, .7, .5, .004, .008),
  patchRim: conformRim('rect', 0, .68, .7, .5, .004, .008),
};
// misma pose que la gorra (cap.position.y = -.5, rotación x = -.09)
const m = new THREE.Matrix4().makeTranslation(0, -.5, 0).multiply(new THREE.Matrix4().makeRotationX(-.09));
const chunks = []; let off = 0;
const gl = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [] };
const acc = (arr, type, count, comp = 5126) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - b.length % 4) % 4; gl.bufferViews.push({ buffer: 0, byteOffset: off, byteLength: b.length }); chunks.push(b, Buffer.alloc(pad)); off += b.length + pad; const a = { bufferView: gl.bufferViews.length - 1, componentType: comp, count, type }; if (type === 'VEC3') { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], arr[i * 3 + k]); mx[k] = Math.max(mx[k], arr[i * 3 + k]); } a.min = mn; a.max = mx; } gl.accessors.push(a); return gl.accessors.length - 1; };
for (const [name, g0] of Object.entries(parts)) {
  const g = g0.clone(); g.applyMatrix4(m); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const n = g.attributes.position.count;
  const prim = { attributes: { POSITION: acc(new Float32Array(g.attributes.position.array), 'VEC3', n), NORMAL: acc(new Float32Array(g.attributes.normal.array), 'VEC3', n), TEXCOORD_0: acc(new Float32Array(g.attributes.uv.array), 'VEC2', n) }, indices: acc(new Uint32Array(g.index.array), 'SCALAR', g.index.count, 5125), mode: 4 };
  gl.meshes.push({ name, primitives: [prim] }); gl.nodes.push({ name, mesh: gl.meshes.length - 1 }); gl.scenes[0].nodes.push(gl.nodes.length - 1);
}
const bin = Buffer.concat(chunks); gl.buffers.push({ byteLength: bin.length, uri: `data:application/octet-stream;base64,${bin.toString('base64')}` });
fs.writeFileSync(process.argv[2] || 'build/overlays.gltf', JSON.stringify(gl)); console.log('ok overlays');
