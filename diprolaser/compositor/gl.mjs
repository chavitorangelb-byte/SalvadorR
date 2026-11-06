// Capa WebGL2: texturas, FBOs flotantes, programas y todos los shaders del video.
// Todo es determinista: nada depende del reloj, solo de los uniformes que manda frame(t).

export function createGL(canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, antialias: false, preserveDrawingBuffer: true, alpha: false });
  if (!gl) throw new Error('sin WebGL2');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return gl;
}

export function texFromSource(gl, src, { mip = true, clamp = true } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  const w = clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
  else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  t.w = src.width; t.h = src.height;
  return t;
}

export function updateTex(gl, t, src) {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
}

export function createFBO(gl, w, h, float = true) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('FBO incompleto ' + st);
  return { fb, tex, w, h };
}

const VS = `#version 300 es
layout(location=0) in vec2 aP;
uniform vec4 uRect;      // x, y, w, h en pixeles del lienzo (y hacia abajo)
uniform vec2 uRes;
uniform float uRot;      // rotacion alrededor del centro del rect (rad)
uniform vec2 uSkew;      // inclinacion (para planos isometricos)
out vec2 vUV;
out vec2 vPx;
void main(){
  vUV = aP;
  vec2 c = uRect.xy + 0.5*uRect.zw;
  vec2 p = (aP - 0.5) * uRect.zw;
  p += vec2(uSkew.x * p.y, uSkew.y * p.x);
  float cs = cos(uRot), sn = sin(uRot);
  p = vec2(cs*p.x - sn*p.y, sn*p.x + cs*p.y) + c;
  vPx = p;
  vec2 ndc = p / uRes * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

const COMMON = `#version 300 es
precision highp float;
in vec2 vUV; in vec2 vPx;
uniform vec2 uRes;
out vec4 o;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
float luma(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
vec2 fboUV(){ return vec2(vPx.x/uRes.x, 1.0 - vPx.y/uRes.y); }  // los FBO guardan y hacia arriba
float sdRoundBox(vec2 p, vec2 b, float r){ vec2 q = abs(p)-b+r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
`;

// --- fondo: negro profundo, resplandor rojo que respira, piso de cristal negro ---------------
const FS_BG = COMMON + `
uniform vec2 uGlow; uniform float uGlowR; uniform float uGlowI; uniform vec3 uGlowCol;
uniform vec2 uGlow2; uniform float uGlow2R; uniform float uGlow2I; uniform vec3 uGlow2Col;
uniform float uFloorY; uniform float uFloorI; uniform float uT;
void main(){
  vec2 p = vPx;
  vec3 top = vec3(0.027,0.016,0.020), bot = vec3(0.071,0.027,0.035);
  vec3 c = mix(top, bot, smoothstep(0.0, uRes.y, p.y)*0.6);
  float d = length((p-uGlow)/vec2(1.0,0.82))/uGlowR;
  c += uGlowCol * uGlowI * exp(-d*d*2.2) ;
  c += uGlowCol * uGlowI * 0.18 * exp(-d*0.9);
  float d2 = length(p-uGlow2)/uGlow2R;
  c += uGlow2Col * uGlow2I * exp(-d2*d2*2.0);
  // piso de cristal negro: un poco mas claro, linea de horizonte suave
  float fy = (p.y - uFloorY);
  float fl = smoothstep(-2.0, 30.0, fy);
  c = mix(c, c*0.55 + vec3(0.010,0.006,0.007), fl*uFloorI);
  c += vec3(0.30,0.08,0.09) * uFloorI * exp(-abs(fy)/3.0) * 0.18 * smoothstep(0.0,1.0, 1.0-abs(p.x/uRes.x-0.5)*1.6);
  // humo muy tenue que deriva
  c += vec3(0.05,0.012,0.016) * fbm(p/420.0 + vec2(uT*0.03, -uT*0.02)) * 0.55;
  o = vec4(c, 1.0);
}`;

// --- producto: recorte con recolor, grabado envuelto al cilindro, impresion CMYK, DOF ---------
const FS_PROD = COMMON + `
uniform sampler2D uTex; uniform sampler2D uMask; uniform sampler2D uLabel; uniform sampler2D uLabel2; uniform sampler2D uPrint;
uniform vec2 uTexSize; uniform float uOpacity; uniform float uBlur; uniform float uSharpen;
uniform float uHasMask; uniform float uLumMed;
uniform vec3 uColA; uniform vec3 uColB; uniform float uColAMode; uniform float uColBMode; // mode: 0 original, 1 tinta, 2 negro, 3 dorado/metal
uniform float uSweep;          // posicion del barrido de color (pixeles del lienzo, eje del barrido)
uniform vec2 uSweepDir;        // direccion del barrido en el lienzo
uniform vec4 uEng;             // cx, cy, hw, alto (pixeles del recorte)
uniform float uEngOn; uniform float uEngPhase; uniform float uEngAng; uniform float uEngAspect; uniform float uEngAspect2;
uniform float uEngReveal;      // 0..1 de izquierda a derecha (laser escribiendo)
uniform float uEngWipe;        // 0..1 barrido de luz que borra
uniform float uEngWhich;       // 0: label, 1: label2
uniform float uEngRaster;      // 1: revela linea por linea (de arriba a abajo)
uniform float uEngKind;        // 0: acero sobre pintura, 1: grabado oscuro
uniform float uPrintOn; uniform vec4 uPrintCMYK; uniform float uPrintAng; uniform float uPrintAspect;
uniform vec3 uTint; uniform float uWarm; uniform float uRim; uniform float uRimY; uniform vec3 uRimCol;
uniform float uSpecX; uniform float uSpecI;
uniform float uFlip;           // 1: reflejo en el piso (se invierte en y y se desvanece)
uniform float uReflFade;
uniform float uSquash;         // giro hacia camara: compresion horizontal ya aplicada en el rect; aqui solo luz
vec4 samp(vec2 uv, float lod){ return textureLod(uTex, uv, lod); }
vec4 blurSamp(vec2 uv, float r){
  if (r < 0.6) return texture(uTex, uv);
  float lod = log2(max(r*0.6,1.0));
  vec4 s = vec4(0.0); float wsum = 0.0;
  for (int i=0;i<12;i++){
    float a = float(i)*2.39996; float rr = sqrt((float(i)+0.5)/12.0) * r;
    vec2 off = vec2(cos(a), sin(a)) * rr / uTexSize;
    s += textureLod(uTex, uv+off, lod); wsum += 1.0;
  }
  return s/wsum;
}
vec3 recolor(vec3 src, float mode, vec3 tgt){
  float L = luma(src);
  float sh = clamp(L / max(uLumMed,0.02), 0.0, 3.0);
  if (mode < 0.5) return src;
  if (mode < 1.5) { // tinta: albedo objetivo x sombreado de la foto
    float s2 = pow(sh, 0.85);
    vec3 c = tgt * s2;
    c += vec3(max(sh-1.35,0.0))*0.35*luma(tgt+0.2); // brillos de la foto
    return c;
  }
  if (mode < 2.5) { // negro: remapeo de niveles, conserva brillos
    float s2 = pow(sh, 0.7);
    return vec3(0.030,0.028,0.030)*s2 + vec3(max(sh-1.25,0.0))*0.08;
  }
  // crema: remapeo de niveles hacia claro
  float s2 = pow(sh, 0.45);
  return tgt * (0.80 + 0.22*s2) * smoothstep(0.0, 0.6, s2+0.3);
}
void main(){
  vec2 uv = vUV;
  if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec4 c = blurSamp(uv, uBlur);
  if (uSharpen > 0.0 && uBlur < 0.6) {
    vec4 b = textureLod(uTex, uv, 1.2);
    c.rgb = max(c.rgb + uSharpen*(c.rgb - b.rgb), 0.0);
  }
  if (c.a < 0.002) discard;
  vec3 col = c.rgb / c.a;
  vec2 px = uv * uTexSize;
  // recolor
  if (uHasMask > 0.5) {
    float m = textureLod(uMask, uv, uBlur > 0.6 ? 2.0 : 0.0).r;
    vec3 a = recolor(col, uColAMode, uColA);
    vec3 b = recolor(col, uColBMode, uColB);
    float s = dot(vPx, uSweepDir) - uSweep;          // <0: ya paso el barrido
    float edge = 26.0 + 10.0*sin(vPx.x*0.031 + vPx.y*0.017);
    float k = smoothstep(edge, -edge, s);
    vec3 rc = mix(a, b, k);
    float lip = exp(-pow(s/16.0, 2.0)) * (uColAMode != uColBMode || uColA != uColB ? 1.0 : 0.0);
    rc += vec3(1.0,0.92,0.88) * lip * 0.28;        // filo de luz liquida
    col = mix(col, rc, m);
  }
  // grabado envuelto al cilindro
  if (uEngOn > 0.5) {
    float u = (px.x - uEng.x) / uEng.z;
    if (abs(u) < 0.985) {
      float th = asin(u);
      float aspect = uEngWhich < 0.5 ? uEngAspect : uEngAspect2;
      float lx = (th - uEngPhase) / uEngAng + 0.5;
      float lh = uEngAng * uEng.z / aspect;              // alto del letrero en px del recorte
      float ly = (px.y - uEng.y) / lh + 0.5;
      if (lx > 0.0 && lx < 1.0 && ly > 0.0 && ly < 1.0) {
        vec4 L = uEngWhich < 0.5 ? texture(uLabel, vec2(lx, ly)) : texture(uLabel2, vec2(lx, ly));
        float a = L.a;
        float rev = uEngRaster > 0.5 ? step(ly, uEngReveal) : step(lx, uEngReveal);
        a *= rev;
        a *= 1.0 - step(lx, uEngWipe);
        a *= smoothstep(1.32, 1.05, abs(th));
        float m = uHasMask > 0.5 ? textureLod(uMask, uv, 0.0).r : 1.0;
        a *= m;
        // acero cepillado: luz que sigue la curva + brillo de la foto (sombreado suave)
        float shade = clamp(luma(textureLod(uTex, uv, 3.0).rgb/max(textureLod(uTex,uv,3.0).a,0.01)) / max(uLumMed,0.03), 0.55, 1.5);
        float brush = 0.92 + 0.08*noise(vec2(px.x*0.2, px.y*9.0));
        float lam = 0.35 + 0.65*pow(max(cos(th - 0.35), 0.0), 1.6);
        float spec = pow(max(cos(th - uSpecX), 0.0), 40.0) * 0.32;
        vec3 steel = vec3(0.70,0.71,0.73) * lam * brush * mix(1.0, shade, 0.35) + spec;
        vec3 dark = col * 0.35;
        vec3 eng = uEngKind < 0.5 ? steel : dark;
        // micro bisel: la pintura del borde proyecta una sombra fina sobre el acero (se lee en tonos claros)
        vec2 lo = vec2(0.0035, 0.012);
        float aS = (uEngWhich < 0.5 ? texture(uLabel, vec2(lx, ly) - lo).a : texture(uLabel2, vec2(lx, ly) - lo).a) * rev;
        float bev = clamp(a - aS, 0.0, 1.0);
        float lumC = luma(col);
        eng *= 1.0 - bev * 0.55;
        eng = mix(eng, eng * 0.78, smoothstep(0.35, 0.8, lumC));   // en pintura clara el acero se ve mas oscuro
        col = mix(col, eng, a);
        // luz del barrido que borra
        float wl = exp(-pow((lx - uEngWipe)*14.0, 2.0)) * step(0.001, uEngWipe) * step(uEngWipe, 0.999);
        col += vec3(1.0,0.95,0.9) * wl * 0.9 * m * smoothstep(1.3,1.0,abs(th)) * step(0.0, ly) * step(ly, 1.0);
      }
    }
  }
  // impresion UV a todo color (CMYK por pasadas)
  if (uPrintOn > 0.5) {
    float u = (px.x - uEng.x) / uEng.z;
    if (abs(u) < 0.985) {
      float th = asin(u);
      float lx = th / uPrintAng + 0.5;
      float lh = uPrintAng * uEng.z / uPrintAspect;
      float ly = (px.y - uEng.y) / lh + 0.5;
      if (lx > 0.0 && lx < 1.0 && ly > 0.0 && ly < 1.0) {
        vec4 L = texture(uPrint, vec2(lx, ly));
        vec3 rgb = L.a > 0.001 ? L.rgb / L.a : vec3(0.0);
        float k = 1.0 - max(max(rgb.r, rgb.g), rgb.b);
        vec3 cmy = (1.0 - rgb - k) / max(1.0 - k, 0.001);
        // cada canal solo existe donde ya paso su pasada (uPrintCMYK = frente de cada pasada en lx)
        float pc = step(lx, uPrintCMYK.x), pm = step(lx, uPrintCMYK.y), py = step(lx, uPrintCMYK.z), pk = step(lx, uPrintCMYK.w);
        vec3 ink = (1.0 - vec3(cmy.x*pc, cmy.y*pm, cmy.z*py)) * (1.0 - k*pk);
        ink = pow(ink, vec3(1.35));                                 // tinta saturada
        float cov = smoothstep(0.32, 0.75, L.a) * smoothstep(1.3, 1.05, abs(th)) * max(max(pc,pm),max(py,pk));
        float m = uHasMask > 0.5 ? textureLod(uMask, uv, 0.0).r : 1.0;
        vec3 printed = col * ink * 1.06 + pow(max(cos(th - uSpecX),0.0), 30.0)*0.12;  // tinta brillante, micro relieve
        col = mix(col, printed, cov * m);
      }
    }
  }
  // luz: calidez, borde rojo que recorre, especular que se desliza (giro lento)
  col *= uTint;
  col = mix(col, col*vec3(1.18,1.0,0.78) + vec3(0.03,0.018,0.0), uWarm);
  if (uRim > 0.0) {
    float ax = textureLod(uTex, uv + vec2(5.0/uTexSize.x, 0.0), 0.0).a;
    float axl = textureLod(uTex, uv - vec2(5.0/uTexSize.x, 0.0), 0.0).a;
    float edge = clamp((c.a - min(ax, axl))*1.4, 0.0, 1.0);
    float band = exp(-pow((uv.y - uRimY)*7.0, 2.0));
    col += uRimCol * edge * (0.25 + band*1.6) * uRim;
  }
  if (uSpecI > 0.0) {
    float sx = exp(-pow((uv.x - uSpecX)*9.0, 2.0));
    col += vec3(1.0) * sx * uSpecI * 0.10 * (uHasMask > 0.5 ? textureLod(uMask, uv, 1.0).r : 0.4);
  }
  float a = c.a * uOpacity;
  if (uFlip > 0.5) a *= uReflFade * smoothstep(0.55, 1.0, vUV.y) ;
  o = vec4(col * a, a);
}`;

// --- sombra de contacto / elipse suave ----------------------------------------------------
const FS_ELLIPSE = COMMON + `
uniform vec4 uCol; uniform float uSoft;
void main(){ vec2 p = vUV*2.0-1.0; float d = length(p); float a = smoothstep(1.0, 1.0-uSoft, d) * uCol.a; o = vec4(uCol.rgb*a, a); }`;

// --- capa de lienzo 2D (premultiplicada) ----------------------------------------------------
const FS_LAYER = COMMON + `
uniform sampler2D uTex; uniform float uOpacity;
void main(){ vec4 c = texture(uTex, vec2(vUV.x, vUV.y)); o = c * uOpacity; }`;

// --- campo liquido rojo: UNA sola funcion SDF (metaballs + formas destino) ---------------------
const FS_LIQUID = COMMON + `
uniform vec4 uBalls[16]; uniform int uNB;     // x, y, r, peso
uniform float uK;                              // suavidad de la union
uniform vec4 uShapeA; uniform float uShapeAKind; uniform float uShapeAW;   // forma destino A
uniform vec4 uShapeB; uniform float uShapeBKind; uniform float uShapeBW;   // forma destino B
uniform float uOpacity; uniform float uT; uniform vec3 uLight;
float smin(float a, float b, float k){ float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0); return mix(b,a,h) - k*h*(1.0-h); }
float sdSeg(vec2 p, vec2 a, vec2 b, float r){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h)-r; }
float sdBar(vec2 p, vec2 c, float ang, vec2 hb){ float cs=cos(ang), sn=sin(ang); vec2 q = p-c; q = vec2(cs*q.x+sn*q.y, -sn*q.x+cs*q.y); return sdRoundBox(q, hb, min(hb.y,hb.x)*0.25); }
// formas: 1 caja isometrica (hexagono de punta arriba), 2 mono, 3 X del logo
float sdHex(vec2 p, float r){ const vec3 k = vec3(-0.866025404,0.5,0.577350269); p = abs(p); p -= 2.0*min(dot(k.xy,p),0.0)*k.xy; p -= vec2(clamp(p.x, -k.z*r, k.z*r), r); return length(p)*sign(p.y); }
float shape(vec2 p, vec4 s, float kind){
  vec2 c = s.xy; float sz = s.z;
  if (kind < 0.5) return 1e5;
  if (kind < 1.5) return sdHex((p - c).yx, 0.866*sz) - 0.04*sz;
  if (kind < 2.5) { // mono: dos lazos + nudo + dos colas
    vec2 q = p - c;
    float l1 = abs(length((q - vec2(-0.40,-0.16)*sz)/vec2(1.0,0.62)) - 0.28*sz) - 0.075*sz;
    float l2 = abs(length((q - vec2( 0.40,-0.16)*sz)/vec2(1.0,0.62)) - 0.28*sz) - 0.075*sz;
    float kn = length(q/vec2(1.0,0.8)) - 0.13*sz;
    float t1 = sdSeg(q, vec2(-0.05,0.05)*sz, vec2(-0.33,0.52)*sz, 0.075*sz);
    float t2 = sdSeg(q, vec2( 0.05,0.05)*sz, vec2( 0.36,0.50)*sz, 0.075*sz);
    return min(min(min(l1,l2),kn),min(t1,t2));
  }
  // X del logo: dos barras cruzadas
  // medidas de la X del logo actual: brazos a 43 grados, largo 1.11, grueso 0.126 (en unidades de medio ancho)
  float a = sdBar(p, c + vec2(0.0, 0.022*sz), 0.75, vec2(1.11*sz, 0.126*sz));
  float b = sdBar(p, c + vec2(0.0, 0.022*sz), -0.75, vec2(1.11*sz, 0.126*sz));
  return min(a,b);
}
float field(vec2 p){
  float d = 1e5;
  for (int i=0;i<16;i++){ if (i>=uNB) break; vec4 b = uBalls[i]; d = smin(d, length(p-b.xy)-b.z, uK); }
  float w = max(uShapeAW, uShapeBW);
  float s = d;
  if (w > 0.0) {
    float sA = shape(p, uShapeA, uShapeAKind), sB = shape(p, uShapeB, uShapeBKind);
    float tgt = uShapeAW <= 0.0 ? sB : (uShapeBW <= 0.0 ? sA : mix(sA, sB, uShapeBW/(uShapeAW+uShapeBW)));
    s = mix(d, tgt, w);
  }
  s += (noise(p*0.012 + uT*0.6) - 0.5) * 6.0;   // ondulacion organica
  return s;
}
void main(){
  vec2 p = vPx;
  float d = field(p);
  if (d > 40.0) discard;
  float e = 1.5;
  vec2 g = vec2(field(p+vec2(e,0.0)) - field(p-vec2(e,0.0)), field(p+vec2(0.0,e)) - field(p-vec2(0.0,e)));
  float a = smoothstep(1.2, -1.2, d) * uOpacity;
  if (a < 0.001) discard;
  // normal 3D aproximada: borde inclinado, centro plano
  float h = clamp(-d/38.0, 0.0, 1.0);
  vec3 n = normalize(vec3(-g*(1.0-h)*0.9, 0.35 + h));
  vec3 L = normalize(uLight);
  float dif = max(dot(n, L), 0.0);
  float spec = pow(max(dot(reflect(-L, n), vec3(0,0,1)), 0.0), 60.0);
  float fres = pow(1.0 - n.z, 3.0);
  vec3 base = vec3(0.89,0.149,0.184);
  vec3 col = base*(0.35 + 0.75*dif) * mix(0.55, 1.0, h) + vec3(1.0,0.85,0.85)*spec*0.65 + vec3(1.0,0.35,0.35)*fres*0.25;
  col *= 0.85 + 0.15*fbm(p*0.02 + uT*0.3);
  o = vec4(col*a, a);
}`;

// --- desenfoque gaussiano separable (para el cristal y el bloom) ---------------------------
const FS_BLUR = COMMON + `
uniform sampler2D uTex; uniform vec2 uDir; uniform float uSigma; uniform vec2 uTexel;
void main(){
  vec2 uv = fboUV();
  vec4 s = vec4(0.0); float ws = 0.0;
  for (int i=-12;i<=12;i++){ float x = float(i); float w = exp(-x*x/(2.0*uSigma*uSigma)); s += texture(uTex, uv + uDir*uTexel*x*1.0) * w; ws += w; }
  o = s/ws;
}`;

// --- copia / composicion final con bloom ---------------------------------------------------
const FS_COPY = COMMON + `
uniform sampler2D uTex; uniform sampler2D uBloom; uniform float uBloomI;
void main(){ vec2 uv = fboUV(); vec4 c = texture(uTex, uv); vec3 b = texture(uBloom, uv).rgb; c.rgb += max(b - 0.30, 0.0) * uBloomI; o = vec4(c.rgb, 1.0); }`;

// --- panel de cristal oscuro (glassmorphism real: muestrea el fondo desenfocado) ---------------
const FS_GLASS = COMMON + `
uniform sampler2D uBlur; uniform vec2 uHalf; uniform float uRadius; uniform float uOpacity;
uniform vec3 uTintC; uniform float uTintA; uniform float uSpec; uniform float uShadow; uniform float uBorder;
uniform float uRotG;
void main(){
  // vPx esta en el espacio del lienzo; el rect se dibuja con margen para la sombra
  vec2 c = uRes*0.0;
  vec2 q = (vUV - 0.5) * (uHalf*2.0 + 160.0);   // coordenadas locales (sin rotar)
  float d = sdRoundBox(q, uHalf, uRadius);
  // sombra amplia
  float sh = (1.0 - smoothstep(-20.0, 70.0, d)) * uShadow * step(0.0, d);
  float inside = smoothstep(0.75, -0.75, d);
  vec2 uv = fboUV();
  // refraccion leve hacia el borde
  float edgeK = smoothstep(-26.0, 0.0, d);
  vec2 nrm = normalize(vec2(dFdx(d), dFdy(d)) + 1e-5);
  vec3 bg = texture(uBlur, uv - vec2(nrm.x, -nrm.y)*edgeK*6.0/uRes).rgb;
  vec3 col = mix(bg, uTintC, uTintA);
  col *= 0.86;
  // borde interior de 1 px y brillo superior
  float rim = exp(-pow((d + 1.5)/0.9, 2.0));
  float topLight = smoothstep(uHalf.y, -uHalf.y, q.y);
  col += vec3(1.0) * rim * (0.10 + 0.22*topLight) * uBorder;
  // barrido especular lento (banda diagonal)
  float band = exp(-pow((q.x + q.y*0.6 - uSpec)/38.0, 2.0));
  col += vec3(1.0) * band * 0.06 * inside;
  // reflejo superior suave
  col += vec3(1.0) * 0.035 * smoothstep(-uHalf.y, -uHalf.y*0.2, -q.y) * inside;
  float a = inside * uOpacity;
  vec4 glass = vec4(col*a, a);
  vec4 shadow = vec4(0.0,0.0,0.0, sh*0.55*uOpacity);
  o = glass + shadow*(1.0-glass.a);
}`;

// --- acumulacion de subcuadros y salida final (grano + vineta) -----------------------------
const FS_ACC = COMMON + `
uniform sampler2D uTex; uniform float uW;
void main(){ vec2 uv = fboUV(); o = vec4(texture(uTex, uv).rgb * uW, uW); }`;
const FS_OUT = COMMON + `
uniform sampler2D uTex; uniform float uFrame; uniform float uVig; uniform float uGrain; uniform float uFade;
void main(){
  vec2 uv = fboUV();
  vec3 c = texture(uTex, uv).rgb;
  vec2 q = (uv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
  c *= 1.0 - uVig * smoothstep(0.35, 0.95, length(q*vec2(1.25,1.0)));
  // tono: hombro suave para que el rojo y los brillos no se quemen
  c = c / (1.0 + max(c - 0.82, 0.0)*0.9);
  float g = hash(floor(vPx) + uFrame*17.31) - 0.5;
  c += g * uGrain * (0.6 + 0.4*(1.0 - luma(c)));
  c *= uFade;
  o = vec4(clamp(c,0.0,1.0), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    throw new Error('shader: ' + log + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n').slice(0, 4000));
  }
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); p.u = {};
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); p.u[nm] = gl.getUniformLocation(p, info.name); }
  return p;
}

export function makePrograms(gl) {
  return {
    bg: program(gl, FS_BG), prod: program(gl, FS_PROD), ellipse: program(gl, FS_ELLIPSE), layer: program(gl, FS_LAYER),
    liquid: program(gl, FS_LIQUID), blur: program(gl, FS_BLUR), copy: program(gl, FS_COPY), glass: program(gl, FS_GLASS),
    acc: program(gl, FS_ACC), out: program(gl, FS_OUT),
  };
}

// Dibuja un rect con un programa y un mapa de uniformes { nombre: valor }.
export function draw(gl, prog, rect, uniforms, res, { rot = 0, skew = [0, 0], textures = {} } = {}) {
  gl.useProgram(prog);
  const U = prog.u;
  if (U.uRect) gl.uniform4f(U.uRect, rect[0], rect[1], rect[2], rect[3]);
  if (U.uRes) gl.uniform2f(U.uRes, res[0], res[1]);
  if (U.uRot) gl.uniform1f(U.uRot, rot);
  if (U.uSkew) gl.uniform2f(U.uSkew, skew[0], skew[1]);
  let unit = 0;
  for (const [k, t] of Object.entries(textures)) {
    if (!U[k]) continue;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(U[k], unit); unit++;
  }
  for (const [k, v] of Object.entries(uniforms)) {
    const loc = U[k]; if (!loc) continue;
    if (typeof v === 'number') gl.uniform1f(loc, v);
    else if (v.int !== undefined) gl.uniform1i(loc, v.int);
    else if (v.length === 2) gl.uniform2fv(loc, v);
    else if (v.length === 3) gl.uniform3fv(loc, v);
    else if (v.length === 4) gl.uniform4fv(loc, v);
    else gl.uniform4fv(loc, v); // arreglos de vec4
  }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
