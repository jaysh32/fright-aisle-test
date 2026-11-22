"use strict";
/* ================= helpers ================= */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const S = (t, a, b) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
const env = (t, a, b, c, d) => S(t, a, b) * (1 - S(t, c, d));   // rise a→b, hold, fall c→d
const PI = Math.PI;

// fine grain used as a bump map so plastic/fabric surfaces catch the light
const noiseTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), d = x.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) { const v = 90 + Math.random() * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t; })();
// physically based material; colours are authored in sRGB and converted to linear for the HDR pipeline
function M(color, opts = {}) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .78, metalness: 0, bumpMap: noiseTex, bumpScale: .012, envMapIntensity: .6 }, opts));
  m.color.convertSRGBToLinear(); if (opts.emissive !== undefined) m.emissive.convertSRGBToLinear(); return m;
}
const B = (color) => { const m = new THREE.MeshBasicMaterial({ color }); m.color.convertSRGBToLinear(); return m; };
function add(mesh, parent, x = 0, y = 0, z = 0) { mesh.position.set(x, y, z); if (parent) parent.add(mesh); return mesh; }
const box = (w, h, d, mat, parent, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), parent, x, y, z);
const sph = (r, mat, parent, x, y, z) => add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat), parent, x, y, z);
const cyl = (rt, rb, h, mat, parent, x, y, z, segs = 24) => add(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat), parent, x, y, z);
const grp = (parent, x, y, z) => add(new THREE.Group(), parent, x, y, z);
// segment that hangs DOWN from its origin (good for limbs you rotate at the joint)
function seg(len, r, mat, parent, rEnd) {
  const g = new THREE.CylinderGeometry(r, rEnd === undefined ? r : rEnd, len, 14); g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat); if (parent) parent.add(m); return m;
}
function arm(parent, x, y, z, mat, l1, l2, r, handMat) {
  const sh = grp(parent, x, y, z); seg(l1, r, mat, sh);
  const el = grp(sh, 0, -l1, 0); seg(l2, r * .9, mat, el, r * .7);
  sph(r * 1.5, handMat || mat, el, 0, -l2, 0);
  return { sh, el };
}
function glow(mat, hex, k) { k = clamp(k, .03, 1); mat.color.set(hex).convertSRGBToLinear().multiplyScalar(k * (1 + 4 * k)); }  // >1 = HDR, picked up by bloom
function textTex(lines, w, h, bg, fg, size) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    let s = size; x.font = `bold ${s}px Impact, "Arial Black", sans-serif`;
    while (x.measureText(ln).width > w * .92 && s > 10) { s -= 2; x.font = `bold ${s}px Impact, "Arial Black", sans-serif`; }
    x.fillText(ln, w / 2, h * (i + 1) / (lines.length + 1));
  });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

/* ================= audio ================= */
let ctx = null, master = null, noiseBuf = null, sink = null;   // sink = 3D panner of the animatronic currently being scheduled
function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // big-empty-store echo
  try { const len = Math.floor(ctx.sampleRate * 2.4), ib = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const b = ib.getChannelData(c); for (let i = 0; i < len; i++) b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    const conv = ctx.createConvolver(), wet = ctx.createGain(); conv.buffer = ib; wet.gain.value = .3; master.connect(conv); conv.connect(wet); wet.connect(ctx.destination); } catch (e) { }
  // ambience: low drone + wind
  for (const f of [55, 58.3]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.value = .035; o.connect(g); g.connect(master); o.start(); }
  const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = .6;
  const g = ctx.createGain(); g.gain.value = .035;
  const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = .13; lg.gain.value = .025; l.connect(lg); lg.connect(g.gain);
  const l2 = ctx.createOscillator(), lg2 = ctx.createGain(); l2.frequency.value = .07; lg2.gain.value = 200; l2.connect(lg2); lg2.connect(f.frequency);
  n.connect(f); f.connect(g); g.connect(master); n.start(); l.start(); l2.start();
}
function shape(gn, t0, d, g, a, pluck) {
  gn.gain.setValueAtTime(0.0001, t0);
  gn.gain.linearRampToValueAtTime(g, t0 + a);
  if (pluck) gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  else { gn.gain.setValueAtTime(g, t0 + Math.max(a, d * .75)); gn.gain.linearRampToValueAtTime(0.0001, t0 + d); }
}
// o: {f, t, d, type, g, a, pluck, f2, fs:[[time,freq]], vib, vibF, lp}
function tone(o) {
  if (!ctx) return;
  if (tsc !== 1) o = Object.assign({}, o, { t: (o.t || 0) / tsc, d: o.d / tsc, f: o.f * 1.3, f2: o.f2 && o.f2 * 1.3, fs: o.fs && o.fs.map(([a, b]) => [a / tsc, b * 1.3]) });   // glitch mode: faster + higher
  const t0 = ctx.currentTime + (o.t || 0), osc = ctx.createOscillator(), gn = ctx.createGain();
  osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t0);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
  if (o.fs) for (const [tt, ff] of o.fs) osc.frequency.linearRampToValueAtTime(ff, t0 + tt);
  if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vibF || 6; lg.gain.value = o.vib; l.connect(lg); lg.connect(osc.frequency); l.start(t0); l.stop(t0 + o.d); }
  shape(gn, t0, o.d, o.g || .15, o.a || .02, o.pluck);
  let out = osc;
  if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); out = f; }
  out.connect(gn); gn.connect(sink || master); osc.start(t0); osc.stop(t0 + o.d + .05);
}
// o: {t, d, g, a, pluck, ft, ff, ff2, q}
function noise(o) {
  if (!ctx) return;
  if (tsc !== 1) o = Object.assign({}, o, { t: (o.t || 0) / tsc, d: o.d / tsc });
  const t0 = ctx.currentTime + (o.t || 0), n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
  const f = ctx.createBiquadFilter(); f.type = o.ft || 'lowpass'; f.frequency.setValueAtTime(o.ff || 800, t0); f.Q.value = o.q || 1;
  if (o.ff2) f.frequency.exponentialRampToValueAtTime(o.ff2, t0 + o.d);
  const gn = ctx.createGain(); shape(gn, t0, o.d, o.g || .2, o.a || .01, o.pluck);
  n.connect(f); f.connect(gn); gn.connect(sink || master); n.start(t0, Math.random()); n.stop(t0 + o.d + .05);
}
function melody(notes, t, type, g, mult = 1) {
  for (const [f, d] of notes) { if (f) { tone({ f: f * mult, t, d: d * 2.2, type, g, pluck: true, a: .005 }); tone({ f: f * mult * 2.01, t, d: d * 1.5, type: 'sine', g: g * .4, pluck: true, a: .005 }); } t += d; }
  return t;
}
function laugh(t, f, n, type, g, step = .2) {
  for (let i = 0; i < n; i++) tone({ f: f * (1 - i * .045), f2: f * (1 - i * .045) * .8, t: t + i * step, d: step * .8, type, g, lp: 2400 });
}
const speechTimers = [];
function speak(text, pitch, rate, delay) {
  if (!('speechSynthesis' in window)) return;
  const k = tsc;
  speechTimers.push(setTimeout(() => {
    try { const u = new SpeechSynthesisUtterance(text); u.pitch = Math.min(2, pitch * (k > 1 ? 1.5 : 1)); u.rate = rate * k; u.volume = 1; speechSynthesis.speak(u); } catch (e) { }
  }, delay * 1000 / k));
}

