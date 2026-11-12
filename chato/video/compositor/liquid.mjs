// Campo líquido: un solo shader para el vaso, la columna de la página y la pantalla del teléfono.
// El contenedor es la mezcla de dos campos de distancia (vaso trapezoidal <-> rectángulo redondeado);
// dentro viven las capas de líquido, con interfaces que ondulan y se difuminan, y el cristal refracta
// de verdad lo que ya está dibujado detrás (textura uBack).
const VS = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;
const FS = `
precision highp float;
uniform vec2 uRes; uniform float uScale;
uniform vec3 uMi; uniform vec2 uPiv;
uniform sampler2D uBack;
uniform vec3 uCupA; uniform vec3 uCupR;
uniform vec4 uRect; uniform float uRectR; uniform float uK;
uniform float uWall; uniform vec3 uMap; uniform float uScroll;
uniform float uIf[5]; uniform float uAmp[5]; uniform float uSoft[5];
uniform vec3 uCol[6];
uniform float uSurf, uSurfAmp, uFront, uFrontAmp, uT, uGlass;

float sdTrap(vec2 p, float r1, float r2, float he){
  vec2 k1 = vec2(r2, he); vec2 k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(p.x - min(p.x, (p.y < 0.0) ? r1 : r2), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float cont(vec2 p){
  float he = (uCupA.z - uCupA.y) * 0.5; vec2 c = vec2(uCupA.x, (uCupA.y + uCupA.z) * 0.5);
  vec2 q = p - c; q.y = -q.y;
  float rr = 26.0;
  float dA = sdTrap(q, uCupR.y - rr, uCupR.x - rr, he - rr) - rr;
  float dB = sdBox(p - uRect.xy, uRect.zw, uRectR);
  return mix(dA, dB, uK);
}
void main(){
  vec2 pix = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uScale;
  vec2 r = pix - uPiv; vec2 p; p.x = r.x / uMi.x; p.y = (r.y - uMi.y * p.x) / uMi.z; p += uPiv;
  float d = cont(p);
  if (d > 1.5) { gl_FragColor = vec4(0.0); return; }
  vec2 e = vec2(1.5, 0.0);
  vec2 n = normalize(vec2(cont(p + e.xy) - cont(p - e.xy), cont(p + e.yx) - cont(p - e.yx)) + 1e-5);
  float depth = clamp(-d / 64.0, 0.0, 1.0);
  float bend = (1.0 - depth); bend *= bend;
  // refracción: el borde del cristal dobla lo que hay detrás
  vec2 uv = (pix - n * bend * 40.0) * uScale / uRes; uv.y = 1.0 - uv.y;
  vec3 col = texture2D(uBack, uv).rgb;
  col = col * 0.92 + vec3(0.040, 0.040, 0.035) * (0.35 + 0.65 * bend);

  float cx = mix(uCupA.x, uRect.x, uK);
  float tcup = clamp((p.y - uCupA.y) / (uCupA.z - uCupA.y), 0.0, 1.0);
  float hw = mix(mix(uCupR.x, uCupR.y, tcup), uRect.z, uK);
  float xn = clamp((p.x - cx) / hw, -1.0, 1.0);
  float arc = sqrt(1.0 - xn * xn);
  vec2 c = (p - uMap.xy) / uMap.z; c.y += uScroll;
  float ry = hw * uCupR.z * (1.0 - uK) / uMap.z;
  float wv = sin(c.x * 0.011 + uT * 2.1) + 0.5 * sin(c.x * 0.027 - uT * 1.7 + 1.3);
  float surfF = uSurf + ry * arc + uSurfAmp * wv;
  float surfB = uSurf - ry * arc + uSurfAmp * wv * 0.6;
  float fr = uFront + uFrontAmp * (sin(c.x * 0.008 + uT * 1.1) + 0.6 * sin(c.x * 0.021 + uT * 2.3) + 0.5 * sin(c.x * 0.047 - uT * 3.1));
  float inner = smoothstep(-uWall + 1.0, -uWall - 1.0, d);
  float body = inner * smoothstep(-1.0, 1.0, (c.y - surfB) * uMap.z) * smoothstep(1.0, -1.0, (c.y - fr) * uMap.z);
  if (body > 0.0) {
    vec3 lc = uCol[0];
    for (int i = 0; i < 5; i++) {
      float fi = float(i);
      float yi = uIf[i] + ry * arc + uAmp[i] * (sin(c.x * (0.009 + 0.002 * fi) + uT * (1.2 + 0.3 * fi) + fi * 1.7) + 0.4 * sin(c.x * 0.031 - uT * 2.0 + fi));
      lc = mix(lc, uCol[i + 1], smoothstep(-uSoft[i], uSoft[i], c.y - yi));
    }
    lc *= mix(1.0, 0.60 + 0.40 * arc, 1.0 - uK);             // volumen cilíndrico en modo vaso
    lc *= 1.0 + 0.045 * sin(c.y * 0.0046 + c.x * 0.0031 + uT * 0.6);
    float top = smoothstep(1.0, -1.0, c.y - surfF) * step(0.5, ry);
    lc = mix(lc, lc * 1.22 + 0.045, top);                       // la superficie vista desde arriba
    float men = exp(-abs(c.y - surfF) * 0.22) * step(0.5, ry);
    lc += vec3(0.10) * men;
    float edgeF = exp(-abs(c.y - fr) * uMap.z * 0.09);          // frente del líquido que baja
    lc += vec3(0.07) * edgeF;
    col = mix(col, lc, body * 0.95);
  }
  float rim = smoothstep(2.4, 0.0, abs(d + 1.4));
  float rimIn = smoothstep(1.8, 0.0, abs(d + uWall));
  col += vec3(0.95, 0.93, 0.86) * (rim * 0.46 + rimIn * 0.13) * uGlass;
  col += vec3(0.90, 0.90, 0.85) * smoothstep(-uWall - 1.0, -uWall + 1.0, d) * 0.055 * uGlass;
  float st = exp(-pow((xn + 0.66) / 0.07, 2.0)) * 0.20 + exp(-pow((xn + 0.50) / 0.018, 2.0)) * 0.10 + exp(-pow((xn - 0.80) / 0.035, 2.0)) * 0.07;
  col += vec3(1.0, 0.98, 0.92) * st * inner * uGlass * mix(1.0, 0.30, uK);
  float a = smoothstep(1.0, -1.0, d);
  gl_FragColor = vec4(col * a, a);
}`;

export function makeLiquid(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true });
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const U = (n) => gl.getUniformLocation(pr, n);
  const u = {}; for (const n of ['uRes', 'uScale', 'uMi', 'uPiv', 'uBack', 'uCupA', 'uCupR', 'uRect', 'uRectR', 'uK', 'uWall', 'uMap', 'uScroll',
    'uIf', 'uAmp', 'uSoft', 'uCol', 'uSurf', 'uSurfAmp', 'uFront', 'uFrontAmp', 'uT', 'uGlass']) u[n] = U(n);
  return function draw(back, st, scale, t) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, back);
    gl.uniform2f(u.uRes, canvas.width, canvas.height); gl.uniform1f(u.uScale, scale);
    gl.uniform3f(u.uMi, st.M.a, st.M.b, st.M.d); gl.uniform2f(u.uPiv, st.M.px, st.M.py);
    gl.uniform1i(u.uBack, 0);
    gl.uniform3f(u.uCupA, st.cup.cx, st.cup.top, st.cup.bot); gl.uniform3f(u.uCupR, st.cup.rT, st.cup.rB, st.cup.tilt);
    gl.uniform4f(u.uRect, st.rect.cx, st.rect.cy, st.rect.hw, st.rect.hh); gl.uniform1f(u.uRectR, st.rect.r); gl.uniform1f(u.uK, st.k);
    gl.uniform1f(u.uWall, st.wall); gl.uniform3f(u.uMap, st.Ox, st.Oy, st.s); gl.uniform1f(u.uScroll, st.S);
    gl.uniform1fv(u.uIf, st.I); gl.uniform1fv(u.uAmp, st.amp); gl.uniform1fv(u.uSoft, st.soft);
    gl.uniform3fv(u.uCol, st.cols);
    gl.uniform1f(u.uSurf, st.surf); gl.uniform1f(u.uSurfAmp, st.surfAmp); gl.uniform1f(u.uFront, st.front); gl.uniform1f(u.uFrontAmp, st.frontAmp);
    gl.uniform1f(u.uT, t); gl.uniform1f(u.uGlass, st.glass);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
}
