/**
 * VISUALS — ambient WebGL backdrop + dot-matrix scoreboard marquee.
 */
import type { Vibe } from '@ballclub/engine';
import { reduceMotion } from './ux.js';

const VS = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const FS = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uBg;
uniform vec3  uBulb;
uniform vec3  uTeam;
uniform float uGrain;
uniform float uBloom;
uniform float uSweep;
uniform float uPulse;
uniform float uPulseHue;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}

/* a light tower: hot core, soft halo, lens streaks */
float tower(vec2 uv, vec2 c, float s, float t){
  float d = length((uv-c)*vec2(1.0,1.25));
  float core = exp(-d*d*260.0/s);
  float halo = exp(-d*7.5/s) * 0.42;
  float flick = 0.94 + 0.06*sin(t*2.3 + c.x*40.0) + 0.03*noise(vec2(t*1.7, c.y*20.0));
  vec2 q = uv-c;
  float streak = exp(-abs(q.y)*130.0) * exp(-abs(q.x)*4.2) * 0.28;
  streak += exp(-abs(q.x)*150.0) * exp(-abs(q.y)*4.2) * 0.20;
  return (core + halo + streak) * flick;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 asp = vec2(uRes.x/uRes.y, 1.0);
  vec2 suv = uv * asp;

  /* base: dugout enamel, darker toward the floor */
  vec3 col = uBg * (0.72 + 0.55*pow(uv.y, 1.55));

  /* faint outfield-grass mow pattern low in the frame */
  float mow = sin(uv.x*46.0 + uv.y*3.0)*0.5+0.5;
  float grassMask = smoothstep(0.42, 0.0, uv.y);
  col += vec3(0.010,0.026,0.016) * mow * grassMask;

  /* light towers, warm and slightly alive */
  float t = uTime;
  float lt = 0.0;
  lt += tower(suv, vec2(0.13*asp.x, 0.955), 1.0, t);
  lt += tower(suv, vec2(0.87*asp.x, 0.955), 1.0, t+2.1);
  lt += tower(suv, vec2(0.50*asp.x, 1.035), 1.7, t+4.7) * 0.85;
  col += uBulb * lt * 0.30 * uBloom;

  /* team-colour wash sweeping slowly across the plate */
  float sweep = sin(uv.y*2.3 - t*0.16) * 0.5 + 0.5;
  float band = exp(-pow((uv.y-0.34-0.10*sin(t*0.21)),2.0)*7.0);
  col += uTeam * band * sweep * 0.115 * uSweep;
  col += uTeam * smoothstep(0.75,0.0,uv.y) * 0.030 * uSweep;

  /* the bulb matrix, barely there — the scoreboard behind everything */
  vec2 gridUv = uv * vec2(uRes.x/6.4, uRes.y/6.4);
  vec2 gf = fract(gridUv) - 0.5;
  float bulbDot = smoothstep(0.34, 0.13, length(gf));
  float gridLife = noise(floor(gridUv)*0.11 + vec2(t*0.10, 0.0));
  col += uBulb * bulbDot * (0.014 + 0.030*gridLife) * uBloom;

  /* event pulse: a flare from the plate */
  if (uPulse > 0.001){
    vec2 pc = vec2(0.5*asp.x, 0.22);
    float d = length(suv-pc);
    float ring = exp(-pow((d - (1.0-uPulse)*1.15)*7.0, 2.0));
    vec3 pcol = mix(uTeam, uBulb, uPulseHue);
    col += pcol * ring * uPulse * 0.85;
    col += pcol * exp(-d*2.2) * uPulse * 0.30;
  }

  /* broadcast scanlines */
  float scan = sin(uv.y*uRes.y*1.5708)*0.5+0.5;
  col *= 1.0 - uGrain*0.42*scan;

  /* film grain */
  float gn = hash(gl_FragCoord.xy + fract(t)*137.0);
  col += (gn-0.5) * uGrain * 0.13;

  /* vignette */
  vec2 vv = uv-0.5;
  col *= 1.0 - dot(vv,vv)*0.92;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('BALLCLUB shader: ' + gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

interface BackdropState {
  bg: number[];
  bulb: number[];
  team: number[];
  grain: number;
  bloom: number;
  sweep: number;
}

export class Backdrop {
  ok = false;
  state: BackdropState = { bg: [0.035, 0.055, 0.05], bulb: [1, 0.72, 0.3], team: [0.23, 0.65, 0.84], grain: 0.1, bloom: 1, sweep: 0.35 };
  pulse = 0;
  pulseHue = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = (canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    this.ok = !!gl;
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) {
      this.ok = false;
      return;
    }
    const pr = gl.createProgram()!;
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      this.ok = false;
      return;
    }
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U: Record<string, WebGLUniformLocation | null> = {};
    ['uRes', 'uTime', 'uBg', 'uBulb', 'uTeam', 'uGrain', 'uBloom', 'uSweep', 'uPulse', 'uPulseHue'].forEach(
      (n) => (U[n] = gl.getUniformLocation(pr, n))
    );

    const self = this;
    const t0 = performance.now();
    let vis = true;
    let last = 0;

    function size(): void {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || 390;
      const h = canvas.clientHeight || 800;
      const W = Math.round(w * dpr);
      const H = Math.round(h * dpr);
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
        gl!.viewport(0, 0, W, H);
      }
    }
    function frame(now: number): void {
      requestAnimationFrame(frame);
      if (!vis) return;
      if (now - last < 33) return; /* cap ~30fps: this is ambience, not the show */
      last = now;
      size();
      const s = self.state;
      gl!.uniform2f(U.uRes, canvas.width, canvas.height);
      gl!.uniform1f(U.uTime, (now - t0) / 1000);
      gl!.uniform3fv(U.uBg, s.bg);
      gl!.uniform3fv(U.uBulb, s.bulb);
      gl!.uniform3fv(U.uTeam, s.team);
      gl!.uniform1f(U.uGrain, s.grain);
      gl!.uniform1f(U.uBloom, s.bloom);
      gl!.uniform1f(U.uSweep, s.sweep);
      gl!.uniform1f(U.uPulse, self.pulse);
      gl!.uniform1f(U.uPulseHue, self.pulseHue);
      self.pulse *= 0.935;
      if (self.pulse < 0.002) self.pulse = 0;
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }
    document.addEventListener('visibilitychange', () => {
      vis = !document.hidden;
    });
    requestAnimationFrame(frame);
  }

  flare(amount?: number, hue?: number): void {
    this.pulse = Math.min(1.4, this.pulse + (amount || 1));
    this.pulseHue = hue == null ? 0 : hue;
  }

  setVibe(v: Vibe, teamRgb?: number[]): void {
    this.state.bg = v.bg.slice();
    this.state.bulb = v.bulb.slice();
    this.state.grain = v.grain;
    this.state.bloom = v.bloom;
    this.state.sweep = v.sweep;
    if (teamRgb) this.state.team = teamRgb;
  }

  setTeam(rgb: number[]): void {
    this.state.team = rgb;
  }
}

/* ---------- 5x7 dot-matrix font ---------- */
const FONT_SRC: Record<string, string> = {
  A: '01110100011000111111100011000110001',
  B: '11110100011000111110100011000111110',
  C: '01110100011000010000100001000101110',
  D: '11100100101000110001100011001011100',
  E: '11111100001000011110100001000011111',
  F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111',
  H: '10001100011000111111100011000110001',
  I: '11111001000010000100001000010011111',
  J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001',
  L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001',
  N: '10001110011010110011100011000110001',
  O: '01110100011000110001100011000101110',
  P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101',
  R: '11110100011000111110101001001010001',
  S: '01111100001000001110000010000111110',
  T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110',
  V: '10001100011000110001100010101000100',
  W: '10001100011000110101101011010101010',
  X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100',
  Z: '11111000010001000100010001000011111',
  '0': '01110100011001110101110011000101110',
  '1': '00100011000010000100001000010001110',
  '2': '01110100010000100010001000100011111',
  '3': '11111000100010000010000011000101110',
  '4': '00010001100101010010111110001000010',
  '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110',
  '7': '11111000010001000100010000100001000',
  '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100',
  ' ': '00000000000000000000000000000000000',
  '-': '00000000000000011111000000000000000',
  '.': '00000000000000000000000000110001100',
  ':': '00000011000110000000011000110000000',
  '/': '00001000100001000100010000100010000',
  "'": '00100001000010000000000000000000000',
  ',': '00000000000000000000000000110000100',
  $: '00100011111010001110001011111000100',
  '%': '11001110100001000100010000101110011',
  '+': '00000001000010011111001000010000000',
  '·': '00000000000110001100000000000000000',
  '!': '00100001000010000100001000000000100',
  '&': '01100100101001001100101011001001101',
  '(': '00010001000100001000010000010000010',
  ')': '01000001000001000010000100010001000'
};

const FONT: Record<string, string[]> = {};
Object.keys(FONT_SRC).forEach((ch) => {
  let s = FONT_SRC[ch];
  while (s.length < 35) s += '0';
  const rows: string[] = [];
  for (let r = 0; r < 7; r++) rows.push(s.substr(r * 5, 5));
  FONT[ch] = rows;
});

export function textBitmap(str: string): boolean[][] {
  const chars = String(str).toUpperCase().split('');
  const cols: boolean[][] = [];
  chars.forEach((ch, ci) => {
    const gph = FONT[ch] || FONT[' '];
    for (let c = 0; c < 5; c++) {
      const col: boolean[] = [];
      for (let r = 0; r < 7; r++) col.push(gph[r][c] === '1');
      cols.push(col);
    }
    if (ci < chars.length - 1) cols.push([false, false, false, false, false, false, false]);
  });
  return cols;
}

export interface MarqueeApi {
  set(list: string[]): void;
  flash(text: string, ms?: number): void;
  colors(bulb?: string | null, team?: string | null): void;
}

/* ---------- the marquee ---------- */
export function createMarquee(canvas: HTMLCanvasElement): MarqueeApi {
  const ctx = canvas.getContext('2d')!;
  let pages = ['BALLCLUB'];
  let bmp: boolean[][] = [];
  let scroll = 0;
  let W = 0, H = 0, pitch = 4;
  const rows = 7;
  let bulbCol = '#FFB43C';
  let teamCol = '#3BA7D6';
  let flashUntil = 0;
  let flashCols: boolean[][] | null = null;
  let last = 0;
  let vis = true;

  function rebuild(): void {
    const joined = pages.join('   ·   ') + '   ·   ';
    bmp = textBitmap(joined);
  }
  function size(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 200;
    const h = canvas.clientHeight || 34;
    const nw = Math.round(w * dpr);
    const nh = Math.round(h * dpr);
    if (canvas.width !== nw || canvas.height !== nh) {
      canvas.width = nw;
      canvas.height = nh;
    }
    W = canvas.width;
    H = canvas.height;
    pitch = H / (rows + 0.9);
  }
  function draw(now: number): void {
    requestAnimationFrame(draw);
    if (!vis) return;
    if (now - last < 33) return;
    const dt = Math.min(80, now - last);
    last = now;
    size();
    ctx.clearRect(0, 0, W, H);
    const src = flashCols && now < flashUntil ? flashCols : bmp;
    if (!src.length) return;
    if (!reduceMotion) scroll += (dt / 1000) * pitch * 13;
    const total = src.length * pitch;
    if (scroll > total) scroll -= total;
    const r = pitch * 0.34;
    const yOff = (H - rows * pitch) / 2 + pitch / 2;
    const nCols = Math.ceil(W / pitch) + 1;
    const startCol = Math.floor(scroll / pitch);
    const sub = scroll % pitch;
    ctx.shadowColor = bulbCol;
    for (let i = 0; i < nCols; i++) {
      const ci = (startCol + i) % src.length;
      const col = src[ci];
      const x = i * pitch - sub + pitch / 2;
      for (let rr = 0; rr < rows; rr++) {
        const on = col[rr];
        ctx.beginPath();
        ctx.arc(x, yOff + rr * pitch, r, 0, 6.2832);
        if (on) {
          ctx.shadowBlur = pitch * 1.5;
          ctx.fillStyle = bulbCol;
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.045)';
        }
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
  }
  document.addEventListener('visibilitychange', () => {
    vis = !document.hidden;
  });
  rebuild();
  requestAnimationFrame(draw);

  return {
    set(list: string[]) {
      pages = list && list.length ? list : ['BALLCLUB'];
      rebuild();
    },
    flash(text: string, ms?: number) {
      flashCols = textBitmap('   ' + text + '   ');
      flashUntil = performance.now() + (ms || 2600);
      scroll = 0;
    },
    colors(bulb?: string | null, team?: string | null) {
      bulbCol = bulb || bulbCol;
      teamCol = team || teamCol;
    }
  };
}

/** Small standalone vibe swatch used in onboarding and the park view. */
export function vibeSwatch(canvas: HTMLCanvasElement, vibe: Vibe, teamRgb: number[]): void {
  const c = canvas.getContext('2d')!;
  const w = (canvas.width = canvas.clientWidth * 2);
  const h = (canvas.height = canvas.clientHeight * 2);
  const grd = c.createLinearGradient(0, 0, 0, h);
  const rgb = (a: number[]) =>
    `rgb(${Math.round(a[0] * 255 * 2.4)},${Math.round(a[1] * 255 * 2.4)},${Math.round(a[2] * 255 * 2.4)})`;
  grd.addColorStop(0, rgb(vibe.bg.map((x) => x * 1.5)));
  grd.addColorStop(1, rgb(vibe.bg as unknown as number[]));
  c.fillStyle = grd;
  c.fillRect(0, 0, w, h);
  /* towers */
  ([[0.16, 0.06], [0.84, 0.06]] as const).forEach((p) => {
    const rg = c.createRadialGradient(p[0] * w, p[1] * h, 0, p[0] * w, p[1] * h, h * 0.85 * vibe.bloom);
    rg.addColorStop(0, `rgba(${vibe.bulb.map((x) => Math.round(x * 255)).join(',')},0.75)`);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg;
    c.fillRect(0, 0, w, h);
  });
  /* team band */
  const bg = c.createLinearGradient(0, h * 0.35, 0, h);
  bg.addColorStop(0, `rgba(${teamRgb.map((x) => Math.round(x * 255)).join(',')},${0.3 * vibe.sweep + 0.06})`);
  bg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  /* scanlines */
  c.fillStyle = `rgba(0,0,0,${vibe.grain * 0.9})`;
  for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 2);
}
