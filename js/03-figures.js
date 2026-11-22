"use strict";
/* ================= animatronic builders =================
   Each builder gets a group facing local +Z (toward the aisle) and returns
   { dur, update(t, dt, time), sound() }.  Idle is t = 999 so every pose
   expressed as env(...) naturally returns to rest.  update() only sets TARGET
   poses; the servo pass in the main loop adds motor lag, overshoot and wobble. */

/* ---------- sculpting kit ---------- */
function lathe(pts, mat, parent, x, y, z, segs = 36) {       // smooth surface of revolution from [radius, y] points
  const sm = new THREE.SplineCurve(pts.map(p => new THREE.Vector2(p[0], p[1]))).getPoints(pts.length * 6); sm.forEach(p => p.x = Math.max(0.0001, p.x));
  mat.side = THREE.DoubleSide; return add(new THREE.Mesh(new THREE.LatheGeometry(sm, segs), mat), parent, x, y, z);
}
function warp(mesh, fn) { const p = mesh.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); } mesh.geometry.computeVertexNormals(); return mesh; }
// folds / ribs around the vertical axis, strongest at y0 and fading out by y1
const pleat = (mesh, n, amt, y0, y1) => warp(mesh, v => { const k = y0 === y1 ? 1 : clamp((y1 - v.y) / (y1 - y0)), s = 1 + Math.sin(Math.atan2(v.z, v.x) * n) * amt * k; v.x *= s; v.z *= s; });
const lump = (mesh, amt, f = 5) => warp(mesh, v => { const n = Math.sin(v.x * f * 1.7 + v.y * f * 2.3) * Math.cos(v.z * f * 1.9 - v.y * f) * amt, l = v.length() || 1; v.multiplyScalar(1 + n / l); });
function limb(len, r1, r2, mat, parent) { sph(r1 * 1.1, mat, parent, 0, 0, 0); return seg(len, r1, mat, parent, r2); }
function hand(parent, mat, s, style) {
  const h = grp(parent, 0, 0, 0), palm = sph(s * .55, mat, h, 0, -s * .45, 0); palm.scale.set(1, 1.15, .45);
  for (let i = 0; i < 4; i++) { const f = grp(h, (i - 1.5) * s * .27, -s * .9, 0); f.rotation.x = style === 'claw' ? -.55 : -.25; f.rotation.z = (i - 1.5) * .13;
    seg(s * .55, s * .1, mat, f, s * .085); sph(s * .1, mat, f, 0, -s * .55, 0); const t = grp(f, 0, -s * .55, 0); t.rotation.x = -.6; seg(s * .55, s * .085, mat, t, style ? s * .012 : s * .06); }
  const th = grp(h, s * .5, -s * .3, 0); th.rotation.z = .9; th.rotation.x = -.4; seg(s * .6, s * .1, mat, th, style ? s * .02 : s * .06); return h;
}
function arm2(parent, x, y, z, mat, l1, l2, r, hm, style, hs) {
  const sh = grp(parent, x, y, z); limb(l1, r, r * .8, mat, sh); const el = grp(sh, 0, -l1, 0); limb(l2, r * .8, r * .6, mat, el);
  const h = hand(el, hm || mat, hs || r * 1.7, style); h.position.y = -l2; return { sh, el, hand: h };
}
function skull(parent, bone, eye, s) {
  const h = grp(parent, 0, 0, 0), dark = B(0x000000); h.scale.setScalar(s);
  const cr = sph(.2, bone, h, 0, .06, -.02); cr.scale.set(1, 1.05, 1.18);
  const face = cyl(.15, .115, .2, bone, h, 0, -.1, .06, 24); face.scale.z = .9;
  for (const k of [-1, 1]) { const so = sph(.064, dark, h, k * .08, .04, .168); so.scale.z = .55; sph(.03, eye, h, k * .08, .04, .178); sph(.05, bone, h, k * .135, -.06, .1);
    const br = sph(.07, bone, h, k * .08, .105, .165); br.scale.set(1.25, .4, .6); br.rotation.z = -k * .2; }
  const nose = add(new THREE.Mesh(new THREE.ConeGeometry(.034, .075, 3), dark), h, 0, -.07, .197); nose.rotation.y = PI;
  for (let i = 0; i < 8; i++) { const a = (i - 3.5) * .2; box(.026, .05, .02, bone, h, Math.sin(a) * .118, -.218, .06 + Math.cos(a) * .1).rotation.y = a; }
  const jaw = grp(h, 0, -.16, -.03);
  const jb = add(new THREE.Mesh(new THREE.TorusGeometry(.112, .03, 8, 22, PI), bone), jaw, 0, -.115, .08); jb.rotation.x = PI / 2;
  box(.1, .06, .05, bone, jaw, 0, -.125, .19);
  for (let i = 0; i < 8; i++) { const a = (i - 3.5) * .2; box(.024, .045, .02, bone, jaw, Math.sin(a) * .105, -.075, .08 + Math.cos(a) * .1).rotation.y = a; }
  for (const k of [-1, 1]) box(.03, .15, .055, bone, jaw, k * .112, -.05, .07);
  return { h, jaw };
}
// lots of little cones scattered over an ellipsoid: fur tufts, straw, hair
function spikes(parent, mat, n, rx, ry, rz, len, r, cx = 0, cy = 0, cz = 0, droop = .5) {
  const geo = new THREE.ConeGeometry(r, len, 4); geo.translate(0, len / 2, 0);
  const im = new THREE.InstancedMesh(geo, mat, n), d = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.set(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(); d.position.set(cx + v.x * rx, cy + v.y * ry, cz + v.z * rz);
    v.y -= droop; d.quaternion.setFromUnitVectors(up, v.normalize()); d.scale.setScalar(.6 + Math.random() * .8); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
  parent.add(im); return im;
}
// ragged strips hanging round a hem; they sway (see servo pass)
function tatters(parent, mat, n, r, y, len, w) {
  mat.side = THREE.DoubleSide; const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w * .15, -len); sh.lineTo(-w * .2, -len * .65); sh.closePath(); const geo = new THREE.ShapeGeometry(sh);
  for (let i = 0; i < n; i++) { const a = i / n * PI * 2, p = grp(parent, Math.cos(a) * r, y, Math.sin(a) * r); p.rotation.y = PI / 2 - a; const q = grp(p, 0, 0, 0); q.userData.sway = .08 + Math.random() * .14;
    const m = new THREE.Mesh(geo, mat); m.scale.y = .6 + Math.random() * .8; q.add(m); }
}
function strokeTex(base, passes, rep = 2) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (const [n, len, ang, spread, w, cols] of passes) for (let i = 0; i < n; i++) { const a = ang + (Math.random() - .5) * spread, px = Math.random() * 256, py = Math.random() * 256, l = len * (.5 + Math.random());
    x.strokeStyle = cols[i % cols.length]; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}
const _tx = {}, memo = (k, f) => _tx[k] || (_tx[k] = f());
const TEX = {
  bone: () => memo('bone', () => strokeTex('#e6dfc8', [[500, 22, PI / 2, 1.5, 1.5, ['rgba(120,100,60,.18)', 'rgba(255,255,245,.25)']], [70, 60, PI / 2, .8, 1, ['rgba(80,60,30,.28)']]])),
  fur: (b = '#3a2a1c') => memo('fur' + b, () => strokeTex(b, [[2600, 16, PI / 2, .5, 1.4, ['rgba(15,10,5,.5)', 'rgba(125,95,60,.4)', 'rgba(70,50,30,.5)']]])),
  burlap: () => memo('burlap', () => strokeTex('#b8975a', [[150, 256, 0, .02, 2, ['rgba(90,65,30,.35)', 'rgba(232,205,145,.3)']], [150, 256, PI / 2, .02, 2, ['rgba(90,65,30,.35)', 'rgba(232,205,145,.3)']]], 3)),
  wood: () => memo('wood', () => strokeTex('#3f2a18', [[260, 150, PI / 2, .06, 2, ['rgba(18,10,5,.45)', 'rgba(115,78,42,.3)']]])),
  cloth: (b, k = b) => memo('cloth' + k, () => strokeTex(b, [[900, 30, PI / 2, .3, 2, ['rgba(255,255,255,.05)', 'rgba(0,0,0,.3)']], [120, 256, 0, .01, 1, ['rgba(0,0,0,.12)']]])),
  skin: () => memo('skin', () => strokeTex('#6f8a5c', [[400, 26, 0, 6, 5, ['rgba(40,60,30,.22)', 'rgba(125,60,60,.16)', 'rgba(150,170,120,.2)']]])),
  pumpkin: () => memo('pumpkin', () => strokeTex('#d4640e', [[500, 120, PI / 2, .08, 2, ['rgba(150,60,0,.25)', 'rgba(255,160,50,.22)']]], 1)),
  stone: () => memo('stone', () => strokeTex('#74747c', [[900, 8, 0, 6, 3, ['rgba(40,40,45,.3)', 'rgba(170,170,175,.25)']], [14, 90, 1, 2, 1, ['rgba(25,25,28,.6)']]], 1)),
  straw: () => memo('straw', () => strokeTex('#d2b24a', [[700, 60, PI / 2, .25, 2, ['rgba(120,90,20,.4)', 'rgba(255,235,150,.35)']]])),
  plaid: () => memo('plaid', () => strokeTex('#7a1f1f', [[14, 256, 0, 0, 14, ['rgba(20,10,10,.45)']], [14, 256, PI / 2, 0, 14, ['rgba(20,10,10,.45)']], [20, 256, 0, 0, 2, ['rgba(230,200,120,.4)']], [20, 256, PI / 2, 0, 2, ['rgba(230,200,120,.4)']]], 2)),
};
const TX = (tex, o = {}) => M(0xffffff, Object.assign({ map: tex, bumpMap: tex, bumpScale: .035 }, o));
class Helix extends THREE.Curve { constructor(r, n) { super(); this.r = r; this.n = n; } getPoint(t, o = new THREE.Vector3()) { const a = t * this.n * PI * 2; return o.set(Math.cos(a) * this.r, t, Math.sin(a) * this.r); } }

/* ---------- the figures ---------- */
function buildSkeleton(g) {             // towering ~12 ft skeleton
  const bone = TX(TEX.bone(), { roughness: .38, bumpScale: .02 }), eye = B(0x000000);
  for (const s of [-1, 1]) {
    const L = grp(g, s * .25, 1.82, 0); limb(.9, .075, .05, bone, L); const K = grp(L, 0, -.9, 0); sph(.09, bone, K, 0, 0, .02).scale.z = 1.2; limb(.86, .055, .04, bone, K); seg(.84, .028, bone, K).position.x = s * .065;
    const f = sph(.11, bone, K, 0, -.88, .13); f.scale.set(.8, .4, 2.1); for (let i = 0; i < 4; i++) cyl(.02, .012, .13, bone, K, (i - 1.5) * .048, -.9, .4, 6).rotation.x = PI / 2;
    const w = sph(.27, bone, g, s * .2, 1.93, -.02); w.scale.set(1, .8, .4); w.rotation.y = s * .5;
  }
  box(.2, .3, .16, bone, g, 0, 1.87, -.04);
  const torso = grp(g, 0, 2.0, 0);
  for (let i = 0; i < 11; i++) cyl(.055, .055, .085, bone, torso, 0, .04 + i * .125, -.08, 10);
  [.3, .37, .42, .45, .45, .42, .36].forEach((r, i) => { const rib = new THREE.Mesh(new THREE.TorusGeometry(r, .032, 8, 30), bone); rib.rotation.x = PI / 2 - .22; rib.scale.y = .72; add(rib, torso, 0, .38 + i * .13, .04); });
  box(.11, .62, .04, bone, torso, 0, .86, .34).rotation.x = -.1;
  for (const s of [-1, 1]) { cyl(.03, .035, .64, bone, torso, s * .34, 1.3, .1, 8).rotation.z = PI / 2 + s * .12; const sc = sph(.2, bone, torso, s * .42, 1.08, -.22); sc.scale.set(.9, 1.1, .2); }
  const aL = arm2(torso, -.68, 1.28, 0, bone, .9, .85, .055, bone, 'bone', .2), aR = arm2(torso, .68, 1.28, 0, bone, .9, .85, .055, bone, 'bone', .2);
  seg(.83, .026, bone, aL.el).position.z = .05; seg(.83, .026, bone, aR.el).position.z = .05;
  const sk = skull(torso, bone, eye, 1.7), head = sk.h, jaw = sk.jaw; head.position.set(0, 1.98, .04);
  return {
    dur: 14,
    update(t) {
      const on = env(t, 0, .4, 13, 14), scan = env(t, .6, 1.5, 6, 7), look = env(t, 6.5, 7.6, 12.6, 13.6), reach = env(t, 7.2, 8.8, 12, 13.5);
      eye.color.setHSL((t * .12) % 1, 1, .55 * on).convertSRGBToLinear().multiplyScalar(1 + 5 * on);
      head.rotation.y = Math.sin(t * 1.3) * .8 * scan; head.rotation.x = .5 * look;
      torso.rotation.y = Math.sin(t * .65) * .18 * on; torso.rotation.x = .12 * look;
      jaw.rotation.x = (env(t, 1.5, 1.6, 5.3, 5.5) + env(t, 8, 8.1, 12, 12.2)) * Math.abs(Math.sin(t * 11)) * .45;
      aR.sh.rotation.x = -1.0 * reach; aR.el.rotation.x = -.35 * reach + Math.sin(t * 3) * .2 * reach; aR.hand.rotation.x = -.4 * reach;
      aL.sh.rotation.z = -.5 * on; aL.sh.rotation.x = Math.sin(t * 1.3) * .3 * on; aL.el.rotation.x = -.3 * on;
    },
    sound() {
      tone({ f: 40, d: 13, type: 'sawtooth', g: .09, lp: 160, a: 1 });
      for (let i = 0; i < 22; i++) noise({ t: .2 + i * .09 + Math.random() * .05, d: .05, g: .1, ft: 'bandpass', ff: 1800 + Math.random() * 1500, q: 6, pluck: true });
      laugh(1.6, 150, 9, 'sawtooth', .13, .38);
      speak("I can see you... way down there. Welcome... to my aisle!", .1, .7, 7.6);
    }
  };
}

function buildSpider(g) {               // leaping spider
  const fur = TX(TEX.fur('#1c1612'), { roughness: .9 }), shell = M(0x120e0c, { roughness: .25, bumpMap: null, envMapIntensity: 1.2 }), eye = B(0x000000), fang = M(0xe8e0c8, { roughness: .2 });
  const web = new THREE.LineBasicMaterial({ color: 0x9a9aaa }), pts = [];
  for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; pts.push(0, 1.7, -1, Math.cos(a) * 1.8, 1.7 + Math.sin(a) * 1.8, -1); }
  for (let r = .3; r < 1.85; r += .25) for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2, b = (i + 1) / 12 * PI * 2, k = r * .93; pts.push(Math.cos(a) * r, 1.7 + Math.sin(a) * r, -1, Math.cos((a + b) / 2) * k, 1.7 + Math.sin((a + b) / 2) * k, -1, Math.cos((a + b) / 2) * k, 1.7 + Math.sin((a + b) / 2) * k, -1, Math.cos(b) * r, 1.7 + Math.sin(b) * r, -1); }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.add(new THREE.LineSegments(wg, web));
  const sp = grp(g, 0, .55, 0);
  const ab = lump(sph(.55, fur, sp, 0, .12, -.6), .03, 6); ab.scale.set(1, .85, 1.25);
  spikes(sp, fur, 420, .56, .48, .7, .14, .012, 0, .12, -.6, .2);
  const ct = sph(.36, shell, sp, 0, 0, .12); ct.scale.set(1, .7, 1.1); spikes(sp, fur, 120, .36, .26, .4, .09, .01, 0, 0, .12, .1);
  const mark = add(new THREE.Mesh(new THREE.CircleGeometry(.16, 4), B(0xc01010)), sp, 0, .6, -.62); mark.rotation.x = -PI / 2; mark.scale.y = 1.8;
  for (const s of [-1, 1]) { sph(.075, eye, sp, s * .11, .13, .43); sph(.05, eye, sp, s * .23, .15, .36); sph(.035, eye, sp, s * .07, .22, .37); sph(.03, eye, sp, s * .19, .22, .3);
    const ch = grp(sp, s * .1, -.05, .45); ch.rotation.x = -.3; seg(.2, .07, shell, ch, .05); const fg = seg(.24, .035, fang, ch, .003); fg.position.y = -.2; fg.rotation.x = .5;
    const pp = grp(sp, s * .22, -.06, .4); pp.rotation.x = -1.1; pp.rotation.z = s * .3; limb(.3, .04, .03, fur, pp); }
  const legs = [];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const p = grp(sp, s * .28, 0, .32 - i * .2); p.rotation.y = -s * (i - 1.5) * .42;
    const up = grp(p, 0, 0, 0); up.rotation.z = s * (PI - .95); limb(.85, .065, .05, shell, up); spikes(up, fur, 26, .07, .4, .07, .07, .008, 0, -.42, 0, 0);
    const lo = grp(up, 0, -.85, 0); lo.rotation.z = s * 1.75; limb(.75, .05, .035, shell, lo);
    const tip = grp(lo, 0, -.75, 0); tip.rotation.z = s * .55; limb(.5, .035, .006, shell, tip);
    legs.push({ p, up, s, i });
  }
  return {
    dur: 5.5,
    update(t) {
      const twitch = env(t, 0, .1, .3, .35), out = env(t, .3, .62, 2.8, 5), on = env(t, 0, .2, 4.6, 5.4);
      const hop = Math.sin(clamp((t - .3) / .32) * PI) * 1.5 * (t < .7 ? 1 : 0);
      sp.position.z = 2.9 * out; sp.position.y = .55 + hop + .55 * out + twitch * .1;
      sp.rotation.x = -.75 * out;
      glow(eye, 0xff1010, on);
      for (const L of legs) { L.up.rotation.z = L.s * (PI - .95 - .55 * out) + Math.sin(t * 22 + L.i * 2) * .14 * out + twitch * Math.sin(t * 60) * .1; L.p.rotation.x = Math.sin(t * 18 + L.i) * .2 * out; }
    },
    sound() {
      noise({ t: 0, d: .3, g: .12, ft: 'highpass', ff: 3000, pluck: true });
      tone({ f: 900, f2: 2600, t: .3, d: .5, type: 'sawtooth', g: .2, vib: 180, vibF: 30 });
      noise({ t: .3, d: .9, g: .28, ft: 'bandpass', ff: 3200, ff2: 1200, q: 2 });
      for (let i = 0; i < 16; i++) noise({ t: 1 + i * .11, d: .04, g: .12, ft: 'bandpass', ff: 4200, q: 8, pluck: true });
      tone({ f: 70, f2: 40, t: .32, d: .5, type: 'sine', g: .4, pluck: true });
    }
  };
}

function buildReaper(g) {               // rising, lunging reaper
  const robe = TX(TEX.cloth('#0d0d13'), { roughness: .95 }), bone = TX(TEX.bone(), { roughness: .45 }), eye = B(0x000000),
    steel = M(0xc8d0d8, { metalness: .95, roughness: .22, bumpMap: null, envMapIntensity: 1.4 }), wood = TX(TEX.wood());
  const body = grp(g, 0, 0, 0);
  pleat(lathe([[.78, 0], [.7, .25], [.5, .9], [.34, 1.5], [.3, 1.9], [.2, 2.05]], robe, body, 0, 0, 0), 11, .16, 0, 1.7);
  tatters(body, robe, 16, .72, .1, .5, .3);
  const up = grp(body, 0, 1.9, 0);
  pleat(lathe([[.56, -.3], [.5, -.1], [.3, .08], [.12, .16]], robe, up, 0, 0, 0), 9, .08, -.3, .1).scale.z = .7;
  const hood = add(new THREE.Mesh(new THREE.SphereGeometry(.36, 32, 24, PI / 2 + .8, PI * 2 - 1.6), robe), up, 0, .3, -.04); hood.scale.set(.95, 1.2, 1.15);
  const peak = cyl(0, .2, .35, robe, up, 0, .72, -.2, 16); peak.rotation.x = -.9;
  const sk = skull(up, bone, eye, 1.05), jaw = sk.jaw; sk.h.position.set(0, .3, .08);
  const aL = arm2(up, -.45, 0, 0, robe, .65, .7, .1, bone, 'bone', .2), aR = arm2(up, .45, 0, 0, robe, .65, .7, .1, bone, 'bone', .2);
  for (const a of [aL, aR]) { const sl = seg(.62, .09, robe, a.el, .2); tatters(a.el, robe, 7, .17, -.58, .3, .14); }
  const scy = grp(aR.el, 0, -.72, .06); const pole = cyl(.03, .035, 2.6, wood, scy, 0, .2, 0, 10); pole.rotation.x = PI / 2;
  const bs = new THREE.Shape(); bs.moveTo(0, 0); bs.quadraticCurveTo(.5, .12, 1.15, -.5); bs.quadraticCurveTo(.55, -.12, 0, -.2); bs.closePath();
  const blade = add(new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: .012, bevelEnabled: true, bevelSize: .012, bevelThickness: .012, bevelSegments: 1 }), steel), scy, 0, .1, 1.45); blade.rotation.y = -PI / 2; blade.rotation.x = PI / 2; blade.rotation.order = 'YXZ';
  cyl(.045, .045, .12, steel, scy, 0, .2, 1.42, 10).rotation.x = PI / 2;
  return {
    dur: 8.5,
    update(t) {
      const rise = env(t, .2, .7, 7, 8.4), lunge = env(t, .5, .9, 2.2, 3) + env(t, 4, 4.3, 6, 7), on = env(t, 0, .2, 7.5, 8.4);
      body.scale.y = .58 + .72 * rise; body.rotation.x = .55 * (1 - rise) + .28 * lunge;
      body.position.z = 1.2 * Math.min(1, lunge); body.position.x = Math.sin(t * 31) * .025 * rise;
      aL.sh.rotation.z = -1.9 * rise; aL.el.rotation.z = -.5 * rise + Math.sin(t * 7) * .2 * rise;
      aR.sh.rotation.z = 1.5 * rise; aR.sh.rotation.x = -.6 * rise + Math.sin(t * 2.2) * .5 * rise;
      up.rotation.y = Math.sin(t * 1.7) * .3 * rise;
      jaw.rotation.x = .5 * Math.abs(Math.sin(t * 10)) * env(t, 3, 3.1, 6, 6.2) + .35 * env(t, .4, .6, 1.8, 2.2);
      glow(eye, 0xff0000, on * (.7 + .3 * Math.sin(t * 20)));
    },
    sound() {
      tone({ f: 200, f2: 1400, t: .2, d: .6, type: 'sawtooth', g: .22, lp: 3000 });
      noise({ t: .2, d: 1.6, g: .25, ft: 'bandpass', ff: 600, ff2: 2400, q: 1.5 });
      tone({ f: 62, d: 8, type: 'sawtooth', g: .12, lp: 220, vib: 4, vibF: 5, a: .4 });
      tone({ f: 1100, f2: 500, t: 4, d: 1.2, type: 'sawtooth', g: .12, vib: 60, vibF: 11, lp: 2600 });
      speak("Your time... has come.", .1, .6, 2.8);
    }
  };
}

function buildJack(g) {                 // wind-up jack-in-the-box clown
  const gold = M(0xe0b020, { metalness: .85, roughness: .3, envMapIntensity: 1.3 }), white = M(0xf2f0ea, { roughness: .35, bumpScale: .006 }), red = M(0xd01818, { roughness: .4 }),
    green = M(0x1fae3a, { roughness: .9 }), eye = B(0x000000), dark = B(0x050505), steel = M(0xa8adb5, { metalness: .9, roughness: .3, bumpMap: null }), suit = TX(TEX.cloth('#b01515', 'suit'), { roughness: .7 });
  const pc = document.createElement('canvas'); pc.width = pc.height = 256; const px = pc.getContext('2d');
  px.fillStyle = '#4a1878'; px.fillRect(0, 0, 256, 256); px.strokeStyle = '#e0b020'; px.lineWidth = 10; px.strokeRect(14, 14, 228, 228);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { px.fillStyle = (i + j) % 2 ? '#6a2aa0' : '#3a1060'; px.beginPath(); px.moveTo(60 + i * 45, 38 + j * 45); px.lineTo(82 + i * 45, 60 + j * 45); px.lineTo(60 + i * 45, 82 + j * 45); px.lineTo(38 + i * 45, 60 + j * 45); px.fill(); }
  px.fillStyle = '#ffd23a'; px.font = 'bold 150px Impact'; px.textAlign = 'center'; px.textBaseline = 'middle'; px.fillText('?', 128, 136);
  const pt = new THREE.CanvasTexture(pc); pt.encoding = THREE.sRGBEncoding;
  box(1.15, 1.1, 1.15, M(0xffffff, { map: pt, roughness: .5 }), g, 0, .55, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(.09, 1.13, .09, gold, g, sx * .575, .565, sz * .575); sph(.07, gold, g, sx * .575, 1.13, sz * .575); }
  const crank = grp(g, .6, .6, 0); cyl(.03, .03, .25, steel, crank, .12, 0, 0, 8).rotation.z = PI / 2; cyl(.03, .03, .3, steel, crank, .25, .15, 0, 8); sph(.08, red, crank, .25, .32, 0);
  const lid = grp(g, 0, 1.1, -.575); box(1.15, .08, 1.15, gold, lid, 0, .04, .575);
  const spring = add(new THREE.Mesh(new THREE.TubeGeometry(new Helix(.17, 8), 180, .022, 6), steel), g, 0, .25, 0);
  const cl = grp(g, 0, .3, 0);
  pleat(lathe([[.44, 0], [.4, .12], [.24, .5], [.16, .8], [.1, .86]], suit, cl, 0, 0, 0), 8, .07, 0, .5);
  for (let i = 0; i < 3; i++) sph(.07, gold, cl, 0, .2 + i * .2, .33 - i * .085);
  for (let i = 0; i < 2; i++) pleat(lathe([[.1, 0], [.34, .02], [.36, .05], [.12, .08]], white, cl, 0, .8 + i * .06, 0), 14, .14, 0, 0).scale.setScalar(1 - i * .2);
  const head = grp(cl, 0, 1.2, 0); lump(sph(.3, white, head, 0, 0, 0), .012, 7).scale.set(1, 1.08, 1);
  sph(.085, red, head, 0, -.02, .3); for (const s of [-1, 1]) { spikes(head, green, 90, .17, .17, .17, .18, .03, s * .3, .12, -.03, -.3);
    sph(.062, dark, head, s * .11, .1, .255).scale.z = .5; sph(.036, eye, head, s * .11, .1, .268);
    const dia = add(new THREE.Mesh(new THREE.CircleGeometry(.1, 4), B(0x1a1a9a)), head, s * .11, .1, .262); dia.scale.x = .45; dia.position.z = .25 + .012; dia.rotation.y = s * .35;
    const br = box(.14, .025, .02, dark, head, s * .11, .2, .26); br.rotation.z = -s * .45; sph(.07, red, head, s * .2, -.07, .2).scale.set(1, .6, .5); }
  const ms = new THREE.Shape(); ms.moveTo(-.2, .03); ms.quadraticCurveTo(0, -.2, .2, .03); ms.quadraticCurveTo(0, -.06, -.2, .03);
  add(new THREE.Mesh(new THREE.ShapeGeometry(ms), dark), head, 0, -.1, .275).rotation.x = -.25;
  for (let i = 0; i < 7; i++) { const a = (i - 3) * .05; cyl(.014, 0, .05, white, head, a, -.115 - Math.abs(i - 3) * -.012 - .0, .285, 4).rotation.x = PI; }
  lathe([[.21, 0], [.19, .03], [.1, .3], [.03, .52], [.0, .58]], TX(TEX.cloth('#4a1878', 'hat')), head, 0, .24, -.02).rotation.z = -.12; sph(.07, gold, head, .07, .84, -.02);
  const aL = arm2(cl, -.22, .75, 0, suit, .4, .4, .07, white, null, .16), aR = arm2(cl, .22, .75, 0, suit, .4, .4, .07, white, null, .16);
  return {
    dur: 10.5,
    update(t) {
      const tau = t - 4.05, close = 1 - S(t, 8.8, 9.8);
      const pop = (tau < 0 ? 0 : 1 - Math.exp(-5 * tau) * Math.cos(15 * tau)) * close;
      const open = S(t, 3.98, 4.1) * (1 - S(t, 9.6, 10.3)), on = env(t, 4, 4.1, 8.8, 9.6);
      crank.rotation.x = Math.min(t, 4) * 5;
      lid.rotation.x = -1.95 * open;
      cl.position.y = .2 + .95 * pop; cl.scale.y = .2 + .8 * Math.min(1.15, pop);
      spring.scale.y = .02 + .95 * pop;
      cl.rotation.z = Math.sin(t * 6) * .16 * on; cl.rotation.y = Math.sin(t * 2.3) * .5 * on;
      head.rotation.z = Math.sin(t * 9) * .2 * on;
      aL.sh.rotation.z = -(.6 + 1.8 * on) + Math.sin(t * 8) * .3 * on; aR.sh.rotation.z = (.6 + 1.8 * on) + Math.sin(t * 8 + 1) * .3 * on;
      glow(eye, 0xffe000, on);
    },
    sound() {
      const C = 261.6, D = 293.7, E = 329.6, G = 392, Gl = 196;
      melody([[C, .3], [C, .15], [D, .3], [D, .15], [E, .15], [G, .15], [E, .15], [C, .45], [Gl, .15], [C, .3], [C, .15], [D, .3], [D, .15], [E, .45], [C, .45]], .1, 'triangle', .16, 1.96);
      for (let i = 0; i < 26; i++) noise({ t: .1 + i * .15, d: .03, g: .05, ft: 'bandpass', ff: 2500, q: 5, pluck: true });
      tone({ f: 880, f2: 1760, t: 4.05, d: .25, type: 'square', g: .2 }); noise({ t: 4.05, d: .35, g: .4, ff: 1500, pluck: true });
      tone({ f: 60, f2: 35, t: 4.05, d: .4, g: .4, pluck: true });
      for (let i = 0; i < 8; i++) tone({ f: 180 + i * 40, f2: 120, t: 4.1 + i * .09, d: .12, type: 'sine', g: .1 });
      laugh(4.7, 620, 8, 'sawtooth', .13, .17); laugh(6.5, 520, 10, 'sawtooth', .13, .15);
    }
  };
}

function buildWitch(g) {                // witch stirring a bubbling cauldron
  const robe = TX(TEX.cloth('#2a1642', 'witch'), { roughness: .9 }), skin = M(0x5fae4a, { roughness: .55, bumpScale: .025 }), iron = M(0x1c1c22, { metalness: .8, roughness: .45, envMapIntensity: 1.2 }),
    eye = B(0x000000), wood = TX(TEX.wood()), hairM = M(0xb9b9c4, { roughness: .8 }), brew = B(0x103a10);
  lathe([[.0, .16], [.3, .18], [.52, .34], [.64, .62], [.6, .9], [.5, 1.0], [.56, 1.04], [.5, 1.06]], iron, g, 0, 0, 1);
  const top = add(new THREE.Mesh(new THREE.CircleGeometry(.49, 28), brew), g, 0, .99, 1); top.rotation.x = -PI / 2;
  for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + .5; cyl(.06, .04, .22, iron, g, Math.cos(a) * .36, .11, 1 + Math.sin(a) * .36, 8); }
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(.1, .02, 6, 14), iron), g, s * .64, .86, 1).rotation.y = PI / 2;
  const fire = B(0xff5a00); for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; cyl(0, .08, .22 + (i % 3) * .1, fire, g, Math.cos(a) * .3, .13, 1 + Math.sin(a) * .3, 5); }
  for (let i = 0; i < 4; i++) { const lg = cyl(.05, .05, .8, wood, g, 0, .05, 1, 8); lg.rotation.z = PI / 2; lg.rotation.y = i * .8; }
  const bubbles = []; for (let i = 0; i < 12; i++) bubbles.push(sph(.06, brew, g, (Math.random() - .5) * .7, 1, 1 + (Math.random() - .5) * .7));
  const stir = grp(g, 0, 1.05, 1); const stick = cyl(.03, .035, 1.6, wood, stir, .25, .45, 0, 8); stick.rotation.z = -.45;
  const w = grp(g, 0, 0, 0);
  pleat(lathe([[.68, 0], [.6, .2], [.38, .8], [.24, 1.3], [.2, 1.5]], robe, w, 0, 0, 0), 10, .15, 0, 1.2); tatters(w, robe, 14, .62, .08, .35, .28);
  const up = grp(w, 0, 1.45, 0); pleat(lathe([[.42, -.25], [.36, -.05], [.2, .1], [.08, .16]], robe, up, 0, 0, 0), 8, .08, -.25, .1).scale.z = .75;
  const head = grp(up, 0, .32, .05); lump(sph(.22, skin, head, 0, 0, 0), .02, 9).scale.set(.92, 1.1, 1);
  lathe([[.06, 0], [.055, .08], [.045, .2], [.02, .3], [.0, .34]], skin, head, 0, -.02, .19).rotation.x = PI / 2 + .45;
  sph(.03, M(0x2f6a22), head, .045, -.1, .4); sph(.022, M(0x2f6a22), head, -.1, -.12, .16);
  lathe([[.07, 0], [.05, .1], [.0, .2]], skin, head, 0, -.2, .12).rotation.x = PI - .7;
  const mouth = box(.14, .02, .02, B(0x150505), head, 0, -.13, .2); cyl(.012, 0, .04, M(0xd8d0a0), head, .03, -.115, .21, 4);
  for (const s of [-1, 1]) { sph(.05, B(0x000000), head, s * .09, .05, .175).scale.z = .5; sph(.028, eye, head, s * .09, .05, .19); const br = box(.11, .025, .03, hairM, head, s * .09, .12, .2); br.rotation.z = -s * .4; sph(.05, skin, head, s * .2, 0, 0).scale.set(.4, 1, .7); }
  for (let i = 0; i < 16; i++) { const a = PI * .15 + i / 15 * PI * 1.7, h = grp(head, Math.sin(a) * .2, .1, -Math.cos(a) * .2 * .9); h.rotation.z = Math.sin(a) * .25; h.rotation.x = Math.cos(a) * .2; h.userData.sway = .06; seg(.5 + Math.random() * .35, .022, hairM, h, .004); }
  const brim = lathe([[.0, .02], [.2, .03], [.44, 0], [.46, -.02]], robe, head, 0, .18, 0); pleat(brim, 5, .05, 0, 0);
  const hat = grp(head, 0, .2, 0); hat.rotation.x = -.12; lathe([[.22, 0], [.2, .06], [.13, .32], [.07, .55]], robe, hat, 0, 0, 0);
  const tip = grp(hat, 0, .55, 0); tip.rotation.x = -.7; tip.userData.sway = .2; lathe([[.07, 0], [.04, .14], [.0, .3]], robe, tip, 0, 0, 0);
  const band = cyl(.215, .225, .07, M(0x0a0a0a), hat, 0, .05, 0, 24); box(.1, .09, .02, M(0xe0b020, { metalness: .85, roughness: .3 }), hat, 0, .05, .22);
  const aL = arm2(up, -.33, 0, 0, robe, .45, .45, .075, skin, 'claw', .17), aR = arm2(up, .33, 0, 0, robe, .45, .45, .075, skin, 'claw', .17);
  for (const a of [aL, aR]) seg(.42, .07, robe, a.el, .15);
  let ang = 0;
  return {
    dur: 11,
    update(t, dt, time) {
      const on = env(t, 0, .5, 10, 11), look = env(t, 3, 3.6, 9.5, 10.4);
      ang += dt * (1 + 5 * on) * .6; stir.rotation.y = ang;
      head.rotation.y = Math.sin(t * 1.5) * .25 * on; head.rotation.x = .35 * (1 - look) - .15 * look * Math.abs(Math.sin(t * 7));
      mouth.scale.y = 1 + 5 * look * Math.abs(Math.sin(t * 7));
      up.rotation.x = .3 - .12 * look; w.rotation.z = Math.sin(t * 2.2) * .06 * on;
      aL.sh.rotation.x = -1.2 + Math.sin(ang) * .3; aR.sh.rotation.x = -1.2 + Math.cos(ang) * .3;
      aL.sh.rotation.z = -.2 - .9 * look; aR.sh.rotation.z = .2 + Math.sin(ang) * .2;
      glow(brew, 0x40ff40, .25 + .75 * on * (.7 + .3 * Math.sin(time * 9))); glow(eye, 0xb0ff30, on);
      fire.color.setHSL(.06 + .03 * Math.sin(time * 13), 1, .4 + .1 * Math.sin(time * 17)).convertSRGBToLinear().multiplyScalar(4);
      bubbles.forEach((b, i) => { const p = (time * (.35 + on * .5) + i * .37) % 1; b.position.y = 1 + p * (.3 + 1.3 * on); b.scale.setScalar((1 - p) * (.6 + on)); });
    },
    sound() {
      for (let i = 0; i < 34; i++) tone({ f: 180 + Math.random() * 380, f2: 600 + Math.random() * 500, t: Math.random() * 10, d: .09, g: .09, pluck: true });
      noise({ d: 10.5, g: .05, ft: 'lowpass', ff: 500, a: .5 });
      for (const t0 of [3.1, 8.2]) for (let i = 0; i < 9; i++) tone({ f: 1050 - i * 45 + (i % 2) * 180, f2: 700, t: t0 + i * .14, d: .12, type: 'sawtooth', g: .12, lp: 3500 });
      speak("Double, double, toil and trouble. Fire burn, and cauldron bubble!", 1.7, .85, 4.6);
    }
  };
}

function buildScarecrow(g) {            // giant 15 ft scarecrow with a crow
  const wood = TX(TEX.wood()), burlap = TX(TEX.burlap(), { roughness: 1, bumpScale: .05 }), shirt = TX(TEX.plaid(), { roughness: .9 }), straw = TX(TEX.straw(), { roughness: 1 }),
    eye = B(0x000000), black = M(0x0a0a0e, { roughness: .5 }), denim = TX(TEX.cloth('#2a3050', 'denim'), { roughness: .9 }), dark = B(0x050302);
  cyl(.12, .16, 4.5, wood, g, 0, 2.25, -.14, 12);
  const up = grp(g, 0, 2.3, 0);
  pleat(lathe([[.5, 0], [.56, .2], [.58, .8], [.5, 1.2], [.3, 1.36], [.16, 1.42]], shirt, up, 0, .05, 0), 7, .05, 0, 1.4).scale.z = .6;
  cyl(.52, .52, .1, M(0x1a120a), up, 0, .1, 0, 24).scale.z = .62; box(.12, .12, .03, M(0xc8a020, { metalness: .8, roughness: .4 }), up, 0, .1, .33);
  spikes(up, straw, 60, .45, .05, .28, .4, .03, 0, .02, 0, 2.5); spikes(up, straw, 40, .16, .05, .14, .3, .025, 0, 1.46, 0, -1.5);
  for (const s of [-1, 1]) { const l = grp(up, s * .26, .05, 0); l.userData.sway = .05; seg(1.9, .16, denim, l, .13); spikes(l, straw, 30, .12, .05, .12, .4, .03, 0, -1.88, 0, 2.5); box(.2, .2, .02, TX(TEX.burlap()), l, 0, -.9, .15); }
  const beam = cyl(.07, .07, 3.6, wood, up, 0, 1.3, -.12, 10); beam.rotation.z = PI / 2;
  const arms = [];
  for (const s of [-1, 1]) {
    const a = grp(up, s * .5, 1.3, 0); const sl = seg(1.25, .15, shirt, a, .13); sl.rotation.z = s * PI / 2;
    const fore = grp(a, s * 1.25, 0, 0); seg(.8, .12, shirt, fore, .14); spikes(fore, straw, 46, .12, .05, .12, .5, .03, 0, -.8, 0, 2.5);
    arms.push({ a, fore, s });
  }
  const head = grp(up, 0, 1.85, .05); const sk = lump(sph(.42, burlap, head, 0, 0, 0), .035, 6); sk.scale.set(1, 1.12, 1);
  pleat(lathe([[.3, 0], [.2, .06], [.24, .14]], burlap, head, 0, -.5, 0), 9, .2, 0, .14);
  for (const s of [-1, 1]) { const e = add(new THREE.Mesh(new THREE.CircleGeometry(.11, 3), dark), head, s * .16, .08, .39); e.rotation.z = -PI / 2 + s * .3; e.rotation.y = s * .35; e.scale.y = 1.2;
    const e2 = add(new THREE.Mesh(new THREE.CircleGeometry(.06, 3), eye), head, s * .16, .07, .4); e2.rotation.z = -PI / 2 + s * .3; e2.rotation.y = s * .35; }
  add(new THREE.Mesh(new THREE.CircleGeometry(.05, 3), dark), head, 0, -.05, .425).rotation.z = PI / 2;
  const ms = new THREE.Shape(); ms.moveTo(-.25, .04); for (let i = 1; i <= 10; i++) ms.lineTo(-.25 + i * .05, (i % 2 ? -.07 : -.02) - Math.sin(i / 10 * PI) * .05); ms.lineTo(.25, .04); for (let i = 9; i >= 1; i--) ms.lineTo(-.25 + i * .05, (i % 2 ? .0 : .03) - Math.sin(i / 10 * PI) * .03);
  const mouth = add(new THREE.Mesh(new THREE.ShapeGeometry(ms), dark), head, 0, -.18, .4); mouth.rotation.x = .25;
  for (let i = 0; i < 7; i++) box(.012, .11, .012, black, head, -.21 + i * .07, -.2 - Math.sin((i + .5) / 7 * PI) * .04, .41).rotation.x = .25;
  const hat = grp(head, 0, .3, 0); hat.rotation.z = .12; pleat(lathe([[.0, .5], [.14, .46], [.3, .1], [.36, .02], [.7, 0], [.76, -.05]], straw, hat, 0, 0, 0), 6, .05, -.05, -.05); cyl(.345, .365, .08, M(0x6a1818), hat, 0, .08, 0, 24);
  const crow = grp(up, 1.3, 1.52, 0); lump(sph(.14, black, crow, 0, 0, 0), .01, 20).scale.set(.9, .9, 1.5); sph(.09, black, crow, 0, .13, .17);
  const beak = cyl(0, .03, .14, M(0x30302c, { roughness: .3 }), crow, 0, .12, .3, 6); beak.rotation.x = PI / 2; for (const s of [-1, 1]) sph(.015, B(0xd0d0d0), crow, s * .05, .15, .23);
  const tail = box(.12, .015, .26, black, crow, 0, .0, -.3); tail.rotation.x = .3; for (const s of [-1, 1]) seg(.14, .01, M(0x30302c), crow).position.set(s * .04, -.1, 0);
  const ws = new THREE.Shape(); ws.moveTo(0, -.1); ws.lineTo(.42, -.04); ws.lineTo(.5, .06); ws.lineTo(.36, .05); ws.lineTo(.4, .14); ws.lineTo(.24, .1); ws.lineTo(.26, .18); ws.lineTo(0, .12); const wgeo = new THREE.ShapeGeometry(ws); black.side = THREE.DoubleSide;
  const wings = [-1, 1].map(s => { const wg = grp(crow, s * .08, .05, 0); const m = new THREE.Mesh(wgeo, black); m.rotation.x = -PI / 2; m.scale.x = s; wg.add(m); return wg; });
  return {
    dur: 12.5,
    update(t) {
      const on = env(t, 0, .5, 11.4, 12.4), wake = env(t, .4, 1.6, 11, 12.2), lean = env(t, 5, 6, 10.5, 11.5), flap = env(t, 1.2, 1.4, 3.8, 4) + env(t, 7.8, 8, 9.8, 10);
      head.rotation.x = .75 * (1 - wake) + .3 * lean; head.rotation.z = .25 * (1 - wake) + Math.sin(t * 1.9) * .2 * wake; head.rotation.y = Math.sin(t * 1.1) * .5 * wake;
      up.rotation.y = Math.sin(t * .9) * .35 * wake; up.rotation.x = .28 * lean; up.rotation.z = Math.sin(t * 1.4) * .05 * wake;
      for (const A of arms) { A.a.rotation.z = A.s * Math.sin(t * 2.4 + A.s) * .22 * wake; A.fore.rotation.x = -(.9 * lean) + Math.sin(t * 3 + A.s) * .3 * wake; A.fore.rotation.z = A.s * .4 * wake; }
      glow(eye, 0xff7a00, on * (.75 + .25 * Math.sin(t * 14)));
      wings.forEach((wg, i) => wg.rotation.z = (i ? 1 : -1) * (1.2 * (1 - Math.min(1, flap)) + Math.sin(t * 26) * .9 * flap));
      crow.position.y = 1.52 + .12 * flap * Math.abs(Math.sin(t * 13)); crow.rotation.y = Math.sin(t * 2) * .6 * on;
    },
    sound() {
      tone({ f: 48, d: 12, type: 'sawtooth', g: .09, lp: 180, a: 1 });
      for (let i = 0; i < 12; i++) noise({ t: .4 + i * .9 + Math.random() * .3, d: .5, g: .07, ft: 'bandpass', ff: 300 + Math.random() * 300, q: 8 });
      for (const t0 of [1.3, 1.9, 2.5, 8, 8.6, 9.2]) { tone({ f: 620, f2: 420, t: t0, d: .32, type: 'sawtooth', g: .14, vib: 50, vibF: 38, lp: 2600 }); noise({ t: t0, d: .3, g: .09, ft: 'bandpass', ff: 1700, q: 3 }); }
      speak("Who dares wander into my field? The crows are hungry tonight.", .35, .7, 4);
    }
  };
}

function buildPumpkin(g) {              // lunging pumpkin-head stalker
  const vine = TX(TEX.wood(), { color: 0x8aa860, roughness: .8 }), cloth = TX(TEX.cloth('#17120e', 'rag'), { roughness: 1 }), pump = TX(TEX.pumpkin(), { emissive: 0xff4a00, emissiveIntensity: .1, roughness: .45 }),
    face = B(0x000000), leaf = M(0x2f5a1c, { roughness: .7 });
  for (const s of [-1, 1]) { const L = grp(g, s * .2, 1.05, 0); L.rotation.z = s * .08; limb(.55, .09, .07, vine, L); const K = grp(L, 0, -.55, 0); K.rotation.z = -s * .08; limb(.5, .07, .05, vine, K);
    for (let i = 0; i < 3; i++) { const r = seg(.3, .04, vine, K, .008); r.position.y = -.47; r.rotation.x = PI / 2 - .2; r.rotation.z = (i - 1) * .6; r.rotation.order = 'ZXY'; } }
  const up = grp(g, 0, 1.05, 0);
  pleat(lathe([[.36, -.5], [.32, -.2], [.24, .3], [.3, .7], [.2, .9], [.1, .96]], cloth, up, 0, 0, 0), 9, .16, -.5, .5); tatters(up, cloth, 13, .34, -.45, .45, .24);
  for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2, lf = add(new THREE.Mesh(new THREE.CircleGeometry(.2, 5), leaf), up, Math.cos(a) * .22, .95, Math.sin(a) * .22); lf.rotation.x = -PI / 2 + .5; lf.rotation.z = a; lf.rotation.order = 'ZXY'; leaf.side = THREE.DoubleSide; }
  const head = grp(up, 0, 1.28, .05);
  const pk = pleat(lathe([[.0, -.33], [.2, -.32], [.4, -.18], [.47, .02], [.4, .22], [.2, .33], [.06, .31]], pump, head, 0, 0, 0, 60), 10, .07, 0, 0); pk.scale.z = .95;
  const stem = grp(head, 0, .3, 0); stem.rotation.z = .35; lathe([[.07, 0], [.045, .1], [.04, .22], [.055, .26]], vine, stem, 0, 0, 0, 8);
  const curl = add(new THREE.Mesh(new THREE.TubeGeometry(new Helix(.05, 3), 40, .01, 5), vine), head, .1, .3, 0); curl.scale.y = .35; curl.rotation.z = -1;
  const F = grp(head, 0, 0, 0);
  for (const s of [-1, 1]) { const es = new THREE.Shape(); es.moveTo(-.11, -.03); es.lineTo(.1, .1); es.lineTo(.07, -.06); es.closePath(); const e = add(new THREE.Mesh(new THREE.ShapeGeometry(es), face), F, s * .17, .06, .44); e.scale.x = -s; e.rotation.y = s * .38; }
  add(new THREE.Mesh(new THREE.CircleGeometry(.045, 3), face), F, 0, -.03, .475).rotation.z = PI / 2;
  const ms = new THREE.Shape(); ms.moveTo(-.28, .0); for (let i = 1; i <= 8; i++) ms.lineTo(-.28 + i * .07, -.06 - Math.sin(i / 8 * PI) * .1 + (i % 2 ? .05 : 0)); for (let i = 7; i >= 1; i--) ms.lineTo(-.28 + i * .07, -.0 - Math.sin(i / 8 * PI) * .03 - (i % 2 ? .05 : 0)); ms.closePath();
  const mouth = add(new THREE.Mesh(new THREE.ShapeGeometry(ms), face), F, 0, -.12, .455); mouth.rotation.x = .2;
  const aL = arm2(up, -.3, .8, 0, vine, .7, .75, .05, vine, 'claw', .22), aR = arm2(up, .3, .8, 0, vine, .7, .75, .05, vine, 'claw', .22);
  for (const a of [aL, aR]) { tatters(a.sh, cloth, 6, .09, -.05, .5, .14); const lf = add(new THREE.Mesh(new THREE.CircleGeometry(.1, 5), leaf), a.el, .05, -.3, 0); lf.rotation.y = .6; }
  return {
    dur: 9.5,
    update(t) {
      const on = env(t, 0, .3, 8.6, 9.4);
      const l = Math.pow(Math.max(0, Math.sin((t - .4) * 2.4)), .6) * env(t, .4, .5, 7.6, 8.2);
      up.rotation.x = 1.0 * l; up.position.z = .7 * l; up.rotation.y = Math.sin(t * 1.3) * .25 * on;
      head.rotation.z = Math.sin(t * 4) * .25 * on; head.rotation.x = -.5 * l;
      aL.sh.rotation.x = -(.3 + 1.5 * l) * on; aR.sh.rotation.x = -(.3 + 1.5 * l) * on;
      aL.sh.rotation.z = -.35 * on + Math.sin(t * 5) * .15 * on; aR.sh.rotation.z = .35 * on + Math.sin(t * 5 + 2) * .15 * on;
      aL.el.rotation.x = -.6 * on; aR.el.rotation.x = -.6 * on;
      const fl = on * (.65 + .35 * Math.sin(t * 23) * Math.sin(t * 7.1));
      glow(face, 0xffd040, fl); pump.emissiveIntensity = .1 + 1.2 * fl; mouth.scale.y = 1 + .8 * l;
    },
    sound() {
      for (const t0 of [.4, 3, 5.6]) { tone({ f: 85, f2: 140, t: t0, d: 1.2, type: 'sawtooth', g: .2, vib: 14, vibF: 26, lp: 700 }); noise({ t: t0, d: 1.1, g: .12, ft: 'lowpass', ff: 900 }); }
      tone({ f: 52, d: 9, type: 'triangle', g: .12, a: .5 });
      speak("Trick... or TREAT!", .3, .7, 1.7); speak("Ha ha ha ha ha!", .2, 1.1, 6.2);
    }
  };
}

function buildZombie(g) {               // zombie clawing out of the grave
  const stone = TX(TEX.stone(), { roughness: .95, bumpScale: .06 }), dirt = M(0x2e2016, { roughness: 1, bumpScale: .06 }), skin = TX(TEX.skin(), { roughness: .6 }), shirt = TX(TEX.cloth('#4a3a2a', 'zshirt'), { roughness: 1 }),
    eye = B(0x000000), bone = TX(TEX.bone()), gore = M(0x5a1010, { roughness: .3 });
  const ts = new THREE.Shape(); ts.moveTo(-.5, 0); ts.lineTo(-.5, .95); ts.absarc(0, .95, .5, PI, 0, true); ts.lineTo(.5, 0); ts.closePath();
  const tomb = add(new THREE.Mesh(new THREE.ExtrudeGeometry(ts, { depth: .2, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 2 }), stone), g, 0, 0, -1.05); tomb.rotation.z = .06; tomb.rotation.x = -.06;
  const rt = textTex(['R.I.P.', 'HERE LIES', 'A. SHOPPER'], 256, 256, '#74747c', '#202024', 70); const rip = new THREE.Mesh(new THREE.PlaneGeometry(.75, .75), new THREE.MeshStandardMaterial({ map: rt, roughness: .95, transparent: true, opacity: .85 })); add(rip, g, 0, .85, -.81).rotation.x = -.06;
  const mound = lump(sph(1, dirt, g, 0, 0, .1), .12, 4); mound.scale.set(1.05, .2, 1.25);
  for (let i = 0; i < 14; i++) lump(sph(.08 + Math.random() * .12, dirt, g, Math.cos(i * 1.3) * (.7 + Math.random() * .6), .05, .1 + Math.sin(i * 1.3) * (.8 + Math.random() * .6)), .03, 14);
  spikes(g, M(0x35501c), 50, 1.1, .02, 1.3, .2, .012, 0, .08, .1, -2);
  g.children.forEach(c => c.userData.prop = true);   // tombstone, mound, clods and grass survive a body swap
  const z = grp(g, 0, -1.6, .2);
  pleat(lathe([[.26, 0], [.3, .2], [.36, .6], [.3, .82], [.12, .9]], shirt, z, 0, .08, 0), 7, .05, 0, .9).scale.z = .6; tatters(z, shirt, 9, .25, .12, .3, .18);
  for (let i = 0; i < 3; i++) { const rb = add(new THREE.Mesh(new THREE.TorusGeometry(.1, .014, 5, 10, 2.2), bone), z, .16, .5 + i * .07, .16); rb.rotation.y = -.5; } sph(.1, gore, z, .16, .56, .12).scale.z = .4;
  cyl(.08, .1, .16, skin, z, 0, 1.0, 0, 12);
  const head = grp(z, 0, 1.2, .03); lump(sph(.22, skin, head, 0, 0, 0), .02, 9).scale.set(.95, 1.15, 1);
  const patch = sph(.12, bone, head, -.1, .15, .08); patch.scale.set(1, 1, .9);
  for (const s of [-1, 1]) { sph(.06, B(0x050505), head, s * .085, .04, .165).scale.z = .5; sph(.07, skin, head, s * .2, -.02, 0).scale.set(.35, 1, .6); const br = sph(.07, skin, head, s * .085, .1, .17); br.scale.set(1.2, .35, .6); }
  sph(.034, eye, head, -.085, .04, .18); sph(.02, B(0x302010), head, .085, .03, .175);
  sph(.035, skin, head, 0, -.04, .22).scale.set(.9, 1.3, 1); box(.15, .04, .02, B(0x100404), head, 0, -.135, .19);
  for (let i = 0; i < 6; i++) box(.02, .035, .015, bone, head, -.055 + i * .022, -.12, .2);
  const jaw = grp(head, 0, -.1, .02); const jm = sph(.13, skin, jaw, 0, -.08, .08); jm.scale.set(1, .5, 1); for (let i = 0; i < 5; i++) box(.02, .03, .015, bone, jaw, -.045 + i * .022, -.045, .19);
  spikes(head, M(0x1a1a14), 60, .2, .22, .2, .14, .012, 0, .08, -.04, .8);
  const aL = arm2(z, -.4, .85, 0, shirt, .45, .45, .075, skin, 'claw', .17), aR = arm2(z, .4, .85, 0, skin, .45, .45, .065, skin, 'claw', .17);
  tatters(aL.el, shirt, 6, .07, -.1, .25, .1); tatters(aR.sh, shirt, 6, .08, -.15, .22, .1);
  return {
    dur: 10.5,
    update(t) {
      const up = env(t, .4, 2.4, 8.8, 10.3), on = env(t, 0, .3, 9.5, 10.4);
      z.position.y = -1.6 + 1.65 * up + Math.sin(t * 17) * .02 * up; z.rotation.x = .5 * up + Math.sin(t * 2.1) * .12 * up; z.rotation.z = Math.sin(t * 3.3) * .12 * up;
      aL.sh.rotation.x = -1.9 + Math.sin(t * 4.5) * .55 * on; aR.sh.rotation.x = -1.9 + Math.sin(t * 4.5 + PI) * .55 * on;
      aL.el.rotation.x = -.4 - Math.sin(t * 4.5) * .4 * on; aR.el.rotation.x = -.4 - Math.sin(t * 4.5 + PI) * .4 * on;
      head.rotation.z = Math.sin(t * 6) * .3 * up; head.rotation.x = -.4 * up;
      jaw.rotation.x = .1 + .5 * Math.abs(Math.sin(t * 5)) * up;
      glow(eye, 0xe8ff20, on);
      mound.position.y = Math.sin(t * 40) * .015 * env(t, 0, .2, 2.2, 2.6);
    },
    sound() {
      noise({ t: 0, d: 2.4, g: .22, ft: 'lowpass', ff: 300, ff2: 900, a: .3 });
      for (let i = 0; i < 10; i++) noise({ t: .2 + i * .22, d: .12, g: .16, ft: 'bandpass', ff: 500 + Math.random() * 600, q: 2, pluck: true });
      for (const t0 of [1.2, 4.2, 7]) tone({ f: 75, fs: [[.8, 105], [1.9, 62]], t: t0, d: 2, type: 'sawtooth', g: .2, vib: 6, vibF: 17, lp: 600, a: .3 });
      speak("Braaaains... Fresh... braaaains.", .1, .5, 2.8);
    }
  };
}

function buildDoll(g) {                 // creepy doll on a swing
  const wood = TX(TEX.wood()), rope = TX(TEX.straw(), { roughness: 1 }), dress = TX(TEX.cloth('#c98aa6', 'dress'), { roughness: .85 }), lace = M(0xf2ece4, { roughness: .9 }),
    skin = M(0xf0e6dc, { roughness: .18, bumpMap: null, envMapIntensity: 1.2 }), hair = M(0x14100c, { roughness: .35 }), eye = B(0x000000), glass = M(0x101018, { roughness: .05, bumpMap: null, envMapIntensity: 2 }), shoe = M(0x0c0c0c, { roughness: .15, bumpMap: null, envMapIntensity: 1.5 });
  for (const s of [-1, 1]) { for (const f of [-1, 1]) { const p = grp(g, s * 1.1, 2.7, 0); p.rotation.x = f * .28; p.rotation.z = -s * .04; seg(2.85, .065, wood, p, .075); } box(.08, .08, 1.0, wood, g, s * 1.07, 1.1, 0); }
  cyl(.065, .065, 2.5, wood, g, 0, 2.7, 0, 12).rotation.z = PI / 2;
  const sw = grp(g, 0, 2.7, 0);
  for (const s of [-1, 1]) { seg(1.75, .022, rope, sw).position.x = s * .36; add(new THREE.Mesh(new THREE.TorusGeometry(.05, .012, 6, 12), M(0x50545a, { metalness: .9, roughness: .4 })), sw, s * .36, -.04, 0).rotation.y = PI / 2; }
  box(.9, .05, .32, wood, sw, 0, -1.75, 0);
  const d = grp(sw, 0, -1.72, 0);
  pleat(lathe([[.4, 0], [.37, .06], [.2, .32], [.13, .5], [.14, .62], [.1, .68]], dress, d, 0, 0, 0), 12, .14, 0, .4);
  pleat(lathe([[.34, 0], [.43, -.02], [.44, -.05]], lace, d, 0, .02, 0), 18, .06, 0, 0);
  cyl(.135, .14, .05, M(0x8a1838, { roughness: .5 }), d, 0, .5, 0, 20); pleat(lathe([[.06, 0], [.17, .01], [.18, .03]], lace, d, 0, .68, 0), 12, .1, 0, 0);
  const legs = [-1, 1].map(s => { const l = grp(d, s * .1, .06, .22); limb(.4, .045, .04, lace, l); const sh = sph(.06, shoe, l, 0, -.43, .04); sh.scale.set(.9, .7, 1.6); box(.1, .015, .02, shoe, l, 0, -.37, .0); return l; });
  const aL = arm2(d, -.15, .6, 0, skin, .22, .22, .04, skin, null, .09), aR = arm2(d, .15, .6, 0, skin, .22, .22, .04, skin, null, .09);
  for (const a of [aL, aR]) lump(sph(.085, dress, a.sh, 0, -.03, 0), .01, 20);
  aL.sh.rotation.z = -.9; aR.sh.rotation.z = .9; aL.el.rotation.z = -1.2; aR.el.rotation.z = 1.2;
  cyl(.04, .05, .08, skin, d, 0, .72, 0, 12);
  const head = grp(d, 0, .92, 0); sph(.22, skin, head, 0, 0, 0).scale.set(1, 1.05, .98);
  const hr = add(new THREE.Mesh(new THREE.SphereGeometry(.235, 32, 24, 0, PI * 2, 0, PI * .62), hair), head, 0, .02, -.03); hr.rotation.x = -.5;
  for (let i = 0; i < 7; i++) sph(.05, hair, head, -.15 + i * .05, .16 - Math.abs(i - 3) * .012, .15);
  for (const s of [-1, 1]) { const pig = grp(head, s * .23, .06, -.02); pig.rotation.z = s * .5; pig.userData.sway = .15; for (let i = 0; i < 5; i++) sph(.065 - i * .008, hair, pig, 0, -.06 - i * .085, 0); sph(.04, M(0xb01030, { roughness: .4 }), pig, 0, 0, .03);
    sph(.06, B(0xf4f4f4), head, s * .085, .02, .17); sph(.04, glass, head, s * .085, .02, .2); sph(.022, eye, head, s * .085, .02, .225);
    for (let i = 0; i < 4; i++) { const ls = box(.006, .04, .006, hair, head, s * .085 + (i - 1.5) * .025, .085, .2); ls.rotation.z = -(i - 1.5) * .25; }
    sph(.045, M(0xe8a8a8, { roughness: .6 }), head, s * .13, -.07, .15).scale.z = .3; }
  sph(.02, skin, head, 0, -.03, .22); const lips = sph(.035, M(0x8a1020, { roughness: .3 }), head, 0, -.1, .195); lips.scale.set(1.2, .45, .5);
  const cr = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([.05, .21, .06, .09, .13, .17, .09, .13, .17, .06, .08, .2, .09, .13, .17, .15, .1, .15, .15, .1, .15, .14, .02, .17, .06, .08, .2, .1, .0, .2], 3)), new THREE.LineBasicMaterial({ color: 0x1a1414 })); head.add(cr);
  return {
    dur: 12.5,
    update(t, dt, time) {
      const on = env(t, 0, 1.5, 10.5, 12.4), eyes = env(t, 4.6, 5, 11, 12);
      sw.rotation.x = Math.sin(t * 2.3) * .62 * on + Math.sin(time * .9) * .03;
      head.rotation.y = 2 * PI * S(t, 5, 6.6) + Math.sin(t * 1.4) * .3 * env(t, .5, 1, 4.6, 5);
      head.rotation.z = .35 * env(t, 6.8, 7.2, 10.5, 11.5);
      glow(eye, 0xff1020, eyes);
      for (const l of legs) l.rotation.x = -.5 - Math.sin(t * 2.3 + .6) * .5 * on;
    },
    sound() {
      const G = 392, E = 329.6, A = 440, F = 349.2, C = 261.6;
      melody([[G, .34], [G, .17], [E, .34], [A, .17], [G, .5], [E, .5], [F, .34], [G, .17], [G, .34], [E, .17], [A, .17], [G, .34], [E, .5], [G, .5], [E, .5], [G, .5], [E, .5], [E, .25], [G, .25], [G, .25], [C, .9]], .2, 'sine', .15, 2.02);
      for (let i = 0; i < 9; i++) tone({ f: 190, f2: 230, t: .3 + i * 1.365, d: .5, type: 'sawtooth', g: .035, lp: 900 });
      for (const t0 of [1.6, 7.4]) for (let i = 0; i < 6; i++) tone({ f: 1500 - i * 60 + (i % 2) * 250, t: t0 + i * .11, d: .09, type: 'triangle', g: .12 });
      tone({ f: 300, f2: 2200, t: 5, d: 1.6, type: 'sawtooth', g: .07, lp: 3000 });
      for (let i = 0; i < 12; i++) noise({ t: 5 + i * .13, d: .03, g: .12, ft: 'bandpass', ff: 3000, q: 6, pluck: true });
      speak("Will you play with me?", 2, .8, 3); speak("Forever... and ever?", 2, .6, 7.9);
    }
  };
}

function buildWolf(g) {                 // howling, lunging werewolf
  const fur = TX(TEX.fur(), { roughness: .95, bumpScale: .05 }), dark = M(0x15100b, { roughness: .4 }), eye = B(0x000000), tooth = M(0xf0ead8, { roughness: .2 }), pants = TX(TEX.cloth('#2a3050', 'denim'), { roughness: .9 }), gum = M(0x5a1418, { roughness: .3 });
  for (const s of [-1, 1]) { const th = grp(g, s * .22, 1.05, 0); th.rotation.x = -.6; limb(.55, .15, .11, pants, th); tatters(th, pants, 7, .11, -.5, .2, .1);
    const sh = grp(th, 0, -.55, 0); sh.rotation.x = 1.25; limb(.45, .09, .06, fur, sh); spikes(sh, fur, 40, .09, .2, .09, .1, .012, 0, -.2, 0, 1);
    const ft = grp(sh, 0, -.45, 0); ft.rotation.x = -1.05; limb(.38, .06, .07, fur, ft); const paw = sph(.1, fur, ft, 0, -.38, .06); paw.scale.set(1, .5, 1.6); for (let i = 0; i < 3; i++) cyl(.016, 0, .08, tooth, ft, (i - 1) * .05, -.4, .2, 5).rotation.x = PI / 2 + .3; }
  const up = grp(g, 0, 1.0, 0);
  const chest = lathe([[.2, -.05], [.26, .1], [.3, .4], [.44, .75], [.42, .95], [.2, 1.08], [.1, 1.1]], fur, up, 0, 0, 0); chest.scale.z = .78;
  spikes(up, fur, 520, .4, .5, .32, .16, .014, 0, .6, 0, 1.2); spikes(up, fur, 120, .3, .2, .28, .22, .018, 0, 1.0, -.05, .9);
  const head = grp(up, 0, 1.2, .14); lump(sph(.24, fur, head, 0, 0, 0), .015, 9).scale.set(1, .95, 1.05);
  spikes(head, fur, 220, .24, .23, .24, .1, .012, 0, 0, -.03, .7); for (const s of [-1, 1]) spikes(head, fur, 40, .06, .1, .08, .16, .014, s * .2, -.1, .02, 1.5);
  const snout = lathe([[.13, 0], [.115, .12], [.085, .28], [.06, .36], [.0, .38]], fur, head, 0, -.02, .16, 20); snout.rotation.x = PI / 2 - .05; snout.scale.z = .8;
  sph(.05, dark, head, 0, .01, .54).scale.set(1.2, .8, 1);
  for (const s of [-1, 1]) { const e = lathe([[.085, 0], [.06, .12], [.0, .26]], fur, head, s * .15, .15, -.04, 10); e.rotation.z = -s * .3; e.scale.z = .5; const ei = cyl(0, .04, .16, gum, head, s * .15, .21, -.02, 6); ei.rotation.z = -s * .3; ei.scale.z = .3; ei.position.z = .0;
    sph(.045, B(0x050505), head, s * .1, .07, .2).scale.z = .5; sph(.028, eye, head, s * .1, .07, .21); const br = sph(.07, fur, head, s * .1, .12, .2); br.scale.set(1.2, .4, .7); br.rotation.z = -s * .45;
    for (let i = 0; i < 4; i++) cyl(.012, 0, i === 1 ? .09 : .045, tooth, head, s * (.075 - i * .012), -.085, .28 + i * .06, 5).rotation.x = PI; }
  const jaw = grp(head, 0, -.1, .14); const jm = lathe([[.1, 0], [.085, .14], [.055, .3], [.0, .34]], dark, jaw, 0, -.03, 0, 16); jm.rotation.x = PI / 2; jm.scale.z = .45;
  const tongue = sph(.05, gum, jaw, 0, -.005, .2); tongue.scale.set(1, .25, 2.2);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) cyl(0, .011, i === 1 ? .08 : .04, tooth, jaw, s * (.065 - i * .012), .02, .12 + i * .06, 5);
  const aL = arm2(up, -.5, .9, 0, fur, .6, .6, .11, dark, 'claw', .26), aR = arm2(up, .5, .9, 0, fur, .6, .6, .11, dark, 'claw', .26);
  for (const a of [aL, aR]) { spikes(a.sh, fur, 90, .12, .3, .12, .12, .012, 0, -.3, 0, 1.2); spikes(a.el, fur, 80, .1, .28, .1, .12, .012, 0, -.28, 0, 1.2); sph(.17, fur, a.sh, 0, .02, 0); }
  return {
    dur: 9.5,
    update(t, dt, time) {
      const on = env(t, 0, .4, 8.6, 9.4), howl = env(t, .5, 1.3, 4.4, 5), lunge = env(t, 5.2, 5.5, 7.8, 8.8);
      const breathe = Math.sin(time * 2) * .03;
      up.rotation.x = .85 - 1.15 * howl - .15 * lunge + breathe; up.position.z = 1.1 * lunge + Math.sin(t * 9) * .08 * lunge;
      up.rotation.y = Math.sin(t * 5) * .25 * lunge;
      head.rotation.x = -.4 - .75 * howl + .3 * lunge; head.rotation.z = Math.sin(t * 13) * .15 * lunge;
      jaw.rotation.x = .1 + .6 * howl + .55 * lunge * Math.abs(Math.sin(t * 8));
      aL.sh.rotation.z = -.25 - .9 * howl; aR.sh.rotation.z = .25 + .9 * howl;
      aL.sh.rotation.x = -.5 + .9 * howl - (1.1 + Math.sin(t * 9) * .7) * lunge; aR.sh.rotation.x = -.5 + .9 * howl - (1.1 + Math.sin(t * 9 + PI) * .7) * lunge;
      aL.el.rotation.x = -.7 * (1 - howl); aR.el.rotation.x = -.7 * (1 - howl);
      chest.scale.x = 1 + .06 * Math.sin(t * 6) * on;
      glow(eye, 0xffd000, on);
    },
    sound() {
      for (const [m, gg] of [[1, .22], [2, .07], [3, .03]]) tone({ f: 290 * m, fs: [[.7, 560 * m], [2.6, 590 * m], [3.8, 330 * m]], t: .6, d: 3.9, type: m === 1 ? 'triangle' : 'sine', g: gg, vib: 9 * m, vibF: 5.5, a: .3 });
      tone({ f: 70, d: .6, t: 0, type: 'sawtooth', g: .16, vib: 12, vibF: 30, lp: 500 });
      for (const t0 of [5.2, 6.1, 7]) { tone({ f: 95, f2: 60, t: t0, d: .85, type: 'sawtooth', g: .26, vib: 22, vibF: 34, lp: 900 }); noise({ t: t0, d: .8, g: .2, ft: 'bandpass', ff: 700, q: 1.2 }); noise({ t: t0 + .55, d: .08, g: .3, ft: 'highpass', ff: 2500, pluck: true }); }
    }
  };
}

function buildMummy(g) {                // 11 ft lumbering mummy
  const wrap = TX(memo('wrap', () => strokeTex('#cbbf9c', [[70, 256, .06, .12, 3, ['rgba(70,55,30,.45)']], [600, 30, 0, .4, 2, ['rgba(120,100,60,.2)', 'rgba(240,235,210,.25)']], [40, 30, 1, 3, 6, ['rgba(90,70,30,.2)']]])), { roughness: 1, bumpScale: .06 }),
    eye = B(0x000000), dark = B(0x050403), gold = M(0xd8a820, { metalness: .9, roughness: .3, envMapIntensity: 1.3 }), lapis = M(0x1a3a9a, { roughness: .3 });
  const legs = [-1, 1].map(s => { const L = grp(g, s * .3, 1.55, 0); limb(.8, .2, .15, wrap, L); const K = grp(L, 0, -.8, 0); limb(.72, .15, .12, wrap, K); sph(.16, wrap, K, 0, -.7, .1).scale.set(.9, .5, 1.8); tatters(K, wrap, 4, .13, -.2, .4, .09); return L; });
  sph(.42, wrap, g, 0, 1.6, 0).scale.set(1, .6, .7);
  const up = grp(g, 0, 1.65, 0);
  lump(lathe([[.36, 0], [.4, .3], [.52, .8], [.5, 1.05], [.26, 1.2], [.14, 1.26]], wrap, up, 0, 0, 0), .02, 7).scale.z = .65;
  tatters(up, wrap, 9, .4, .35, .75, .12); tatters(up, wrap, 6, .46, .9, .5, .1);
  const collar = add(new THREE.Mesh(new THREE.TorusGeometry(.3, .07, 8, 28), gold), up, 0, 1.17, .02); collar.rotation.x = PI / 2 + .25; collar.scale.y = .75;
  for (let i = 0; i < 7; i++) { const a = (i - 3) * .32; sph(.035, lapis, up, Math.sin(a) * .3, 1.14 - Math.cos(a) * .05, .02 + Math.cos(a) * .25); }
  cyl(.13, .15, .2, wrap, up, 0, 1.3, 0, 14);
  const head = grp(up, 0, 1.55, .03); lump(sph(.3, wrap, head, 0, 0, 0), .015, 8).scale.set(.9, 1.15, 1);
  box(.4, .1, .06, dark, head, 0, .05, .26); for (const s of [-1, 1]) sph(.04, eye, head, s * .1, .05, .27);
  const mouth = box(.16, .03, .04, dark, head, 0, -.16, .27);
  tatters(head, wrap, 5, .22, -.15, .55, .1);
  const aL = arm2(up, -.6, 1.05, 0, wrap, .85, .8, .13, wrap, null, .3), aR = arm2(up, .6, 1.05, 0, wrap, .85, .8, .13, wrap, null, .3);
  for (const a of [aL, aR]) { tatters(a.el, wrap, 5, .1, -.3, .6, .1); tatters(a.sh, wrap, 4, .13, -.4, .4, .1); }
  return {
    dur: 12,
    update(t) {
      const on = env(t, 0, .4, 11, 12), wake = env(t, .3, 1.6, 10.6, 11.9), lean = env(t, 5, 6.2, 10, 11), w = Math.sin(t * 1.7);
      aL.sh.rotation.x = -(1.45 + w * .16) * wake; aR.sh.rotation.x = -(1.45 - w * .16) * wake; aL.el.rotation.x = -.25 * wake; aR.el.rotation.x = -.25 * wake;
      aL.hand.rotation.x = -.5 * lean; aR.hand.rotation.x = -.5 * lean;
      head.rotation.y = Math.sin(t * .9) * .6 * wake * (1 - lean); head.rotation.x = .2 * (1 - wake) + .4 * lean; head.rotation.z = w * .08 * wake;
      up.rotation.z = w * .09 * wake; up.rotation.x = .26 * lean; up.rotation.y = w * .12 * wake;
      legs[0].rotation.x = w * .22 * wake; legs[1].rotation.x = -w * .22 * wake;
      mouth.scale.y = 1 + 5 * env(t, 3, 3.2, 6.4, 6.8) * Math.abs(Math.sin(t * 5));
      glow(eye, 0x40e0ff, on * (.8 + .2 * Math.sin(t * 9)));
    },
    sound() {
      tone({ f: 44, d: 11.5, type: 'sawtooth', g: .1, lp: 170, a: 1 });
      noise({ d: 11, g: .05, ft: 'highpass', ff: 3500, a: 1.5 });
      for (const t0 of [.6, 5, 8.2]) tone({ f: 68, fs: [[1, 92], [2.2, 58]], t: t0, d: 2.4, type: 'sawtooth', g: .2, vib: 5, vibF: 13, lp: 520, a: .4 });
      for (let i = 0; i < 7; i++) { noise({ t: .9 + i * 1.5, d: .25, g: .2, ft: 'lowpass', ff: 220, pluck: true }); tone({ f: 52, f2: 34, t: .9 + i * 1.5, d: .3, g: .3, pluck: true }); }
      speak("Who... disturbs... my slumber?", .1, .55, 3);
    }
  };
}

function buildPlant(g) {                // 8 ft snapping plant monster
  const green = TX(memo('plant', () => strokeTex('#2f6a22', [[400, 120, PI / 2, .1, 2, ['rgba(15,45,10,.4)', 'rgba(120,180,60,.3)']], [200, 12, 0, 6, 4, ['rgba(110,30,60,.25)']]])), { roughness: .5 }),
    inner = M(0x8a1030, { roughness: .3 }), tooth = M(0xf0ead0, { roughness: .2 }), pot = M(0xa8522a, { roughness: .85, bumpScale: .04 }), soil = M(0x1c120a, { roughness: 1 }), eye = B(0x000000), leafM = M(0x2a7a24, { roughness: .55 }); leafM.side = THREE.DoubleSide;
  lathe([[.0, 0], [.42, 0], [.5, .1], [.62, .75], [.68, .8], [.66, .9], [.58, .86]], pot, g, 0, 0, 0);
  const so = add(new THREE.Mesh(new THREE.CircleGeometry(.58, 24), soil), g, 0, .84, 0); so.rotation.x = -PI / 2;
  const ls = new THREE.Shape(); ls.moveTo(0, 0); ls.quadraticCurveTo(.3, .3, .12, .95); ls.lineTo(0, 1.1); ls.lineTo(-.12, .95); ls.quadraticCurveTo(-.3, .3, 0, 0); const lgeo = new THREE.ShapeGeometry(ls);
  for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2 + .3, p = grp(g, Math.cos(a) * .35, .84, Math.sin(a) * .35); p.rotation.y = PI / 2 - a; const q = grp(p, 0, 0, 0); q.rotation.x = .9 + (i % 2) * .3; q.userData.sway = .08; q.add(new THREE.Mesh(lgeo, leafM)); }
  const nodes = []; let par = grp(g, 0, .8, 0);
  for (let i = 0; i < 7; i++) { const n = grp(par, 0, i ? .3 : 0, 0); cyl(.1 - i * .006, .11 - i * .006, .32, green, n, 0, .15, 0, 14); sph(.115 - i * .006, green, n, 0, 0, 0); if (i % 2) for (const s of [-1, 1]) cyl(0, .03, .14, green, n, s * .12, .1, 0, 5).rotation.z = -s * 1.2; nodes.push(n); par = n; }
  const vines = [-1, 1].map(s => { const segs = []; let p = grp(nodes[3], s * .1, .1, 0); p.rotation.z = -s * 1.1;
    for (let i = 0; i < 4; i++) { const n = grp(p, 0, i ? .32 : 0, 0); cyl(.035, .045, .34, green, n, 0, .16, 0, 8); segs.push(n); p = n; }
    const lf = new THREE.Mesh(lgeo, leafM); lf.scale.setScalar(.45); lf.position.y = .32; p.add(lf); return { segs, s }; });
  const head = grp(par, 0, .34, 0); head.rotation.x = .9;
  const dome = (r, mat, parent, flip) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, PI * 2, 0, PI / 2), mat); mat.side = THREE.DoubleSide; m.scale.set(.85, .55, 1.3); m.position.z = .5; if (flip) m.rotation.z = PI; parent.add(m); return m; };
  const upper = grp(head, 0, .02, -.12), lower = grp(head, 0, -.02, -.12);
  lump(dome(.45, green, upper), .02, 9); dome(.43, inner, upper); lump(dome(.45, green, lower, true), .02, 9); dome(.43, inner, lower, true);
  for (let i = 0; i < 15; i++) { const a = (i - 7) * .27, x = Math.sin(a) * .37, z = .5 + Math.cos(a) * .56, L = .12 + (i % 2) * .07;
    cyl(.028, 0, L, tooth, upper, x, -L / 2, z, 6); cyl(0, .028, L, tooth, lower, x * .96, L / 2, z * .98, 6); }
  for (let i = 0; i < 9; i++) sph(.035, M(0xd8c020, { roughness: .4 }), upper, (Math.random() - .5) * .5, .2 + Math.random() * .04, .3 + Math.random() * .6);
  const tongue = grp(lower, 0, -.08, .2); lathe([[.09, 0], [.1, .3], [.06, .6], [.0, .7]], M(0xc02050, { roughness: .25 }), tongue, 0, 0, 0, 12).rotation.x = PI / 2 - .2; tongue.userData.sway = .12;
  for (const s of [-1, 1]) { const st = grp(upper, s * .2, .2, .25); st.rotation.z = -s * .4; st.userData.sway = .1; seg(.001, .001, green, st); cyl(.02, .03, .25, green, st, 0, .12, 0, 6); sph(.07, B(0x050505), st, 0, .28, 0); sph(.045, eye, st, 0, .28, .04); }
  const collar = grp(head, 0, 0, -.1); for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2, m = new THREE.Mesh(lgeo, leafM); m.scale.setScalar(.5); m.rotation.z = a; collar.add(m); }
  return {
    dur: 10,
    update(t) {
      const on = env(t, 0, .5, 9, 10), ph = (t - .5) * 2.2, l = Math.pow(Math.max(0, Math.sin(ph)), .5) * env(t, .5, .7, 8, 8.6);
      nodes.forEach((n, i) => { n.rotation.z = Math.sin(t * 2 + i * .6) * .12 * on + (i ? 0 : 0); n.rotation.x = (i ? .17 * l : 0) - .03 * (1 - on); });
      const open = on * (.25 + .75 * Math.abs(Math.cos(ph))) * (1 - .9 * S(l, .85, 1));
      upper.rotation.x = -(.08 + .75 * open); lower.rotation.x = .08 + .5 * open;
      head.rotation.x = .9 - .5 * on + .2 * l; head.rotation.z = Math.sin(t * 3.1) * .25 * on;
      for (const v of vines) v.segs.forEach((n, i) => { n.rotation.z = v.s * (i ? .35 : 0) * (1 - .8 * on) + Math.sin(t * 3 + i + v.s) * .25 * on; n.rotation.x = -.35 * l * (i ? 1 : 0); });
      glow(eye, 0xc8ff20, on);
    },
    sound() {
      tone({ f: 58, d: 9.5, type: 'sawtooth', g: .1, lp: 240, vib: 5, vibF: 7, a: .5 });
      for (let i = 0; i < 26; i++) noise({ t: Math.random() * 9, d: .18, g: .06, ft: 'highpass', ff: 2500 + Math.random() * 2000 });
      for (const t0 of [1.2, 4.07, 6.93]) { noise({ t: t0, d: .12, g: .5, ft: 'bandpass', ff: 1400, q: 1, pluck: true }); tone({ f: 160, f2: 60, t: t0, d: .25, type: 'square', g: .25, pluck: true, lp: 1200 });
        tone({ f: 90, f2: 150, t: t0 - .7, d: .7, type: 'sawtooth', g: .16, vib: 16, vibF: 24, lp: 800 }); }
      speak("So hungry... come a little closer!", .5, .75, 2);
    }
  };
}

function buildParrot(g) {               // undead pirate parrot that answers yes/no questions
  const wood = TX(TEX.wood()), steel = M(0x60646a, { metalness: .9, roughness: .4, bumpMap: null }), red = M(0xb81818, { roughness: .7 }), blue = M(0x1a3ab0, { roughness: .6 }), yel = M(0xd8b020, { roughness: .6 }),
    beakM = M(0x2a2620, { roughness: .2, bumpMap: null, envMapIntensity: 1.3 }), bone = TX(TEX.bone()), eye = B(0x000000), black = M(0x0a0a0c, { roughness: .7 }); blue.side = red.side = yel.side = THREE.DoubleSide;
  pleat(lathe([[.0, 0], [.4, 0], [.47, .3], [.48, .55], [.41, .9], [.0, .9]], wood, g, 0, 0, 0), 14, .012, 0, 0);
  for (const y of [.12, .45, .8]) { const h = add(new THREE.Mesh(new THREE.TorusGeometry(y === .45 ? .485 : .44, .018, 6, 32), steel), g, 0, y, 0); h.rotation.x = PI / 2; }
  cyl(.04, .05, .9, wood, g, 0, 1.35, 0, 10); cyl(.035, .035, 1.0, wood, g, 0, 1.8, 0, 10).rotation.z = PI / 2;
  const sk = skull(g, bone, B(0x000000), .7); sk.h.position.set(.25, 1.02, .22); sk.h.rotation.set(-.3, -.4, .2);
  const bird = grp(g, 0, 1.84, 0); bird.scale.setScalar(1.7);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const c = seg(.07, .012, beakM, bird, .003); c.position.set(s * .05 + (i - 1) * .018, .03, .02); c.rotation.x = -.9; }
  const body = grp(bird, 0, .05, 0); body.rotation.x = .25;
  lump(lathe([[.0, 0], [.1, .04], [.16, .22], [.14, .42], [.09, .54], [.06, .58]], red, body, 0, 0, 0, 20), .01, 14);
  spikes(body, red, 160, .15, .25, .15, .09, .016, 0, .27, 0, 1.6); spikes(body, yel, 30, .1, .06, .1, .07, .014, 0, .5, .04, 1.4);
  for (let i = 0; i < 3; i++) { const rb = add(new THREE.Mesh(new THREE.TorusGeometry(.07, .008, 4, 10, 2), bone), body, .1, .2 + i * .045, .08); rb.rotation.y = -.7; }
  const fs = new THREE.Shape(); fs.moveTo(-.03, 0); fs.lineTo(.03, 0); fs.lineTo(.04, -.5); fs.lineTo(0, -.58); fs.lineTo(-.04, -.5); fs.closePath(); const fgeo = new THREE.ShapeGeometry(fs);
  [blue, red, blue, yel].forEach((m, i) => { const f = grp(body, (i - 1.5) * .035, .06, -.1); f.rotation.x = .5; f.rotation.z = (i - 1.5) * .09; f.userData.sway = .1; f.add(new THREE.Mesh(fgeo, m)); });
  const ws = new THREE.Shape(); ws.moveTo(0, .1); ws.lineTo(.1, .05); ws.lineTo(.13, -.2); ws.lineTo(.09, -.42); ws.lineTo(.05, -.3); ws.lineTo(.03, -.46); ws.lineTo(0, -.3); ws.lineTo(-.04, -.4); ws.lineTo(-.05, 0); ws.closePath(); const wgeo = new THREE.ShapeGeometry(ws);
  const wings = [-1, 1].map(s => { const w = grp(body, s * .15, .42, 0); w.rotation.y = s * PI / 2; const m = new THREE.Mesh(wgeo, s < 0 ? blue : red); const m2 = new THREE.Mesh(wgeo, yel); m2.scale.setScalar(.6); m2.position.z = .01; w.add(m, m2); return w; });
  const head = grp(body, 0, .64, .02); head.rotation.x = -.25; lump(sph(.105, red, head, 0, 0, 0), .006, 20); spikes(head, red, 40, .1, .1, .1, .06, .012, 0, .02, -.02, .5);
  const ub = lathe([[.058, 0], [.05, .06], [.03, .13], [.0, .17]], beakM, head, 0, -.005, .075, 12); ub.rotation.x = PI / 2 + .35; ub.scale.z = 1.25;
  const jaw = grp(head, 0, -.045, .06); const lb = lathe([[.045, 0], [.03, .06], [.0, .09]], beakM, jaw, 0, 0, 0, 12); lb.rotation.x = PI / 2 + .1; lb.scale.z = .6;
  sph(.035, B(0xf0f0e0), head, -.085, .02, .045).scale.x = .4; sph(.02, eye, head, -.095, .02, .05);
  const patch = add(new THREE.Mesh(new THREE.CircleGeometry(.04, 16), black), head, .104, .02, .045); patch.rotation.y = PI / 2; black.side = THREE.DoubleSide;
  const strap = add(new THREE.Mesh(new THREE.TorusGeometry(.106, .006, 4, 24), black), head, 0, .03, 0); strap.rotation.y = PI / 2; strap.rotation.x = .5;
  const hat = grp(head, 0, .09, -.01); hat.rotation.z = .12; cyl(.15, .15, .018, black, hat, 0, 0, 0, 3).rotation.y = PI; lathe([[.085, 0], [.08, .05], [.03, .09], [.0, .095]], black, hat, 0, 0, 0, 16);
  const sm = skull(hat, bone, B(0x000000), .13); sm.h.position.set(0, .045, .078);
  return {
    dur: 7.5,
    update(t, dt, time) {
      const on = env(t, 0, .3, 6.8, 7.5), flap = env(t, .15, .3, 1.2, 1.6) + env(t, 5.6, 5.8, 6.3, 6.7), talk = env(t, 1.7, 1.8, 5.2, 5.5);
      bird.position.y = 1.84 + Math.abs(Math.sin(t * 9)) * .05 * (flap + talk * .4);
      body.rotation.x = .25 - .25 * flap + Math.sin(t * 4) * .06 * on; body.rotation.z = Math.sin(t * 2.3) * .1 * on;
      head.rotation.z = Math.sin(t * 2.6) * .5 * on; head.rotation.y = Math.sin(t * 1.9 + 1) * .5 * on + Math.sin(time * .7) * .15; head.rotation.x = -.25 + talk * Math.sin(t * 12) * .12;
      jaw.rotation.x = .1 + (.55 * talk + .5 * flap) * Math.abs(Math.sin(t * 12));
      wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (-.15 - (1.2 + Math.sin(t * 24) * .7) * Math.min(1, flap)); });
      glow(eye, 0x30ff60, on);
    },
    sound() {
      for (const t0 of [.2, .55, 5.7]) { tone({ f: 2100, f2: 1100, t: t0, d: .28, type: 'sawtooth', g: .16, vib: 220, vibF: 42, lp: 4200 }); noise({ t: t0, d: .25, g: .1, ft: 'bandpass', ff: 3000, q: 2 }); }
      for (let i = 0; i < 8; i++) noise({ t: .2 + i * .12, d: .07, g: .12, ft: 'lowpass', ff: 700, pluck: true });
      const A = ["Aye aye! That be a yes!", "Nay! Not a chance, matey!", "Arrr... ask me again!", "Aye! As sure as the tide!", "Nay! Walk the plank!", "Aye... but it will cost ye!"];
      speak(A[Math.floor(Math.random() * A.length)], 1.9, 1.05, 1.8);
    }
  };
}

function buildGhost(g) {                // crawling ghost that drags itself across the floor
  const shroud = TX(TEX.cloth('#c9cfd6', 'shroud'), { roughness: .9, emissive: 0x8fb0ff, emissiveIntensity: .04 }), skin = M(0xb8c2c8, { roughness: .5 }), hair = M(0x08080a, { roughness: .3 }), eye = B(0x000000), dark = B(0x020203);
  const gh = grp(g, 0, 0, -1.6);
  const gown = pleat(lathe([[.06, 0], [.2, .08], [.27, .5], [.32, 1.0], [.46, 1.7]], shroud, gh, 0, .22, .15), 9, .2, 1.7, .2); gown.rotation.x = -PI / 2; gown.scale.z = .55;
  const hem = grp(gh, 0, .12, -1.5); hem.rotation.x = -PI / 2; tatters(hem, shroud, 12, .4, 0, .55, .22);
  const chest = grp(gh, 0, .24, .1);
  const head = grp(chest, 0, .1, .2); lump(sph(.19, skin, head, 0, 0, 0), .012, 9).scale.set(.9, 1.1, 1);
  for (const s of [-1, 1]) { sph(.055, dark, head, s * .07, .03, .145).scale.z = .5; sph(.02, eye, head, s * .07, .03, .165); }
  const mouth = sph(.05, dark, head, 0, -.09, .15); mouth.scale.set(.8, 1.3, .4);
  const cap = add(new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 16, 0, PI * 2, 0, PI * .55), hair), head, 0, .02, -.02); cap.rotation.x = -.35;
  for (let i = 0; i < 22; i++) { const a = -1.9 + i / 21 * 3.8, h = grp(head, Math.sin(a) * .18, .1, Math.cos(a) * .17); h.userData.sway = .1 + Math.random() * .1; seg(.35 + Math.random() * .3, .012, hair, h, .003); }
  const aL = arm2(chest, -.24, .02, .05, shroud, .42, .42, .05, skin, 'claw', .15), aR = arm2(chest, .24, .02, .05, shroud, .42, .42, .05, skin, 'claw', .15);
  for (const a of [aL, aR]) tatters(a.sh, shroud, 5, .06, -.1, .3, .1);
  return {
    dur: 9.5,
    update(t, dt, time) {
      const on = env(t, 0, .4, 8.6, 9.5), crawl = env(t, .5, 4.6, 6.6, 9), reach = env(t, 4.2, 4.8, 6.4, 6.9), drag = Math.sin(t * 5);
      gh.position.z = -1.6 + 3.5 * crawl + (drag > 0 ? drag * .06 : 0) * on; gh.rotation.z = drag * .13 * on; gh.position.y = Math.abs(drag) * .04 * on;
      chest.rotation.x = -.35 * on - .4 * reach; head.rotation.x = -.5 * on + Math.sin(t * 31) * .08 * reach; head.rotation.z = Math.sin(t * 1.7) * .35 * on;
      aL.sh.rotation.x = -1.15 + .35 * on + drag * .5 * on * (1 - reach) - 1.0 * reach; aR.sh.rotation.x = -1.15 + .35 * on - drag * .5 * on * (1 - reach);
      aL.el.rotation.x = -.35 + drag * .3 * on; aR.el.rotation.x = -.35 - drag * .3 * on; aL.sh.rotation.z = -.3; aR.sh.rotation.z = .3;
      mouth.scale.y = 1.3 + 1.4 * reach;
      glow(eye, 0xbfe0ff, on); shroud.emissiveIntensity = .04 + .14 * on * (.8 + .2 * Math.sin(time * 11));
    },
    sound() {
      for (let i = 0; i < 9; i++) noise({ t: .5 + i * .63, d: .4, g: .16, ft: 'bandpass', ff: 420, ff2: 900, q: 1.5 });
      tone({ f: 880, fs: [[4, 1320], [8.5, 700]], d: 9, type: 'sine', g: .05, vib: 14, vibF: 5, a: 1 }); tone({ f: 1320, fs: [[4, 1980], [8.5, 1040]], d: 9, type: 'sine', g: .02, vib: 20, vibF: 5.3, a: 1.5 });
      noise({ d: 9, g: .045, ft: 'bandpass', ff: 2600, q: 3, a: 2 });
      tone({ f: 500, f2: 1500, t: 4.3, d: 1.6, type: 'sawtooth', g: .1, vib: 60, vibF: 9, lp: 3200, a: .3 });
      speak("Don't... leave... me...", 1.7, .5, 2);
    }
  };
}

function buildStilt(g) {                // 10 ft towering stilt clown with a balloon
  const stripe = TX(memo('stripe', () => strokeTex('#e8e4d8', [[10, 256, PI / 2, 0, 13, ['rgba(165,20,20,.95)']]], 1)), { roughness: .8 }), coat = TX(TEX.cloth('#3a1466', 'coat'), { roughness: .85 }),
    white = M(0xf2f0ea, { roughness: .35, bumpScale: .006 }), red = M(0xd01818, { roughness: .2, bumpMap: null, envMapIntensity: 1.5 }), hairM = M(0xe86a10, { roughness: .9 }), eye = B(0x000000), dark = B(0x050505), gold = M(0xe0b020, { metalness: .85, roughness: .3 });
  const legs = [-1, 1].map(s => { const L = grp(g, s * .16, 1.78, 0); limb(.92, .075, .06, stripe, L); const K = grp(L, 0, -.92, 0); limb(.84, .06, .05, stripe, K); sph(.13, red, K, 0, -.8, .14).scale.set(1, .6, 2.2); return L; });
  sph(.24, stripe, g, 0, 1.8, 0).scale.set(1, .7, .8);
  const up = grp(g, 0, 1.8, 0);
  pleat(lathe([[.2, 0], [.25, .15], [.2, .5], [.27, .75], [.12, .86]], coat, up, 0, 0, 0), 6, .05, 0, .86).scale.z = .75; tatters(up, coat, 9, .22, .05, .55, .16);
  for (let i = 0; i < 4; i++) sph(.035, gold, up, 0, .18 + i * .15, .17 + (i === 3 ? .03 : 0));
  for (let i = 0; i < 2; i++) pleat(lathe([[.08, 0], [.3, .02], [.32, .05], [.1, .08]], white, up, 0, .84 + i * .05, 0), 14, .14, 0, 0).scale.setScalar(1 - i * .2);
  cyl(.045, .055, .3, white, up, 0, 1.0, 0, 12);
  const head = grp(up, 0, 1.28, 0); lump(sph(.2, white, head, 0, 0, 0), .01, 9).scale.set(.9, 1.2, .95);
  sph(.06, red, head, 0, -.01, .2);
  for (const s of [-1, 1]) { spikes(head, hairM, 80, .1, .13, .1, .2, .025, s * .2, .05, -.02, -.4); sph(.045, dark, head, s * .075, .08, .165).scale.z = .5; sph(.025, eye, head, s * .075, .08, .178);
    const tri = add(new THREE.Mesh(new THREE.CircleGeometry(.07, 3), B(0x101080)), head, s * .075, .08, .172); tri.rotation.z = PI / 2; tri.scale.y = .5; tri.position.y = .15; const br = box(.1, .02, .02, dark, head, s * .075, .21, .16); br.rotation.z = s * .5; }
  const ms = new THREE.Shape(); ms.moveTo(-.16, .05); ms.quadraticCurveTo(0, -.2, .16, .05); ms.quadraticCurveTo(0, -.05, -.16, .05);
  const grin = add(new THREE.Mesh(new THREE.ShapeGeometry(ms), dark), head, 0, -.1, .178); grin.rotation.x = -.15;
  for (let i = 0; i < 6; i++) cyl(.012, 0, .045, white, head, -.075 + i * .03, -.085 - Math.sin((i + .5) / 6 * PI) * .012, .19, 4).rotation.x = PI;
  const hat = grp(head, 0, .2, 0); hat.rotation.z = -.2; hat.userData.sway = .08; cyl(.2, .2, .02, coat, hat, 0, 0, 0, 24); lathe([[.12, 0], [.11, .2], [.14, .42], [.0, .43]], coat, hat, 0, 0, 0, 20); cyl(.125, .125, .05, red, hat, 0, .04, 0, 20);
  const aL = arm2(up, -.26, .76, 0, coat, .75, .75, .05, white, null, .24), aR = arm2(up, .26, .76, 0, coat, .75, .75, .05, white, null, .24);
  const bal = grp(up, -1.0, 1.75, .1); bal.userData.sway = .16; bal.userData.prop = true; const bl = sph(.26, red, bal, 0, 0, 0); bl.scale.y = 1.18; cyl(.0, .03, .05, red, bal, 0, -.33, 0, 8); seg(1.4, .004, M(0xdddddd), bal).position.y = -.34;
  return {
    dur: 11,
    update(t) {
      const on = env(t, 0, .5, 10, 11), lean = env(t, 3, 4.3, 8.6, 9.7), wave = env(t, .5, 1, 2.7, 3.2), popped = S(t, 9, 9.03) * (1 - S(t, 10.6, 10.95)), w = Math.sin(t * 1.5);
      up.rotation.z = w * .13 * on; up.rotation.x = .8 * lean; up.rotation.y = Math.sin(t * .8) * .2 * on * (1 - lean);
      legs[0].rotation.z = w * .05 * on; legs[1].rotation.z = w * .05 * on; legs[0].rotation.x = -w * .06 * on; legs[1].rotation.x = w * .06 * on;
      head.rotation.x = -.55 * lean; head.rotation.z = Math.sin(t * 5) * .3 * on; head.rotation.y = Math.sin(t * 2.1) * .3 * on;
      aR.sh.rotation.z = 2.5 * wave + Math.sin(t * 9) * .25 * wave + .15 * on; aR.sh.rotation.x = -1.3 * lean; aR.el.rotation.x = -.4 * lean;
      aL.sh.rotation.z = -.9 * on * (1 - lean); aL.sh.rotation.x = -1.2 * lean; aL.el.rotation.z = -.6 * on;
      grin.scale.y = 1 + .7 * lean * Math.abs(Math.sin(t * 8));
      bal.scale.setScalar(Math.max(.001, 1 - popped)); bal.position.y = 1.75 + Math.sin(t * 2) * .06;
      glow(eye, 0x40ff30, on);
    },
    sound() {
      const n = [659, 622, 587, 554, 523, 494, 523, 494, 466, 440, 415, 392];
      melody(n.map(f => [f, .15]), .2, 'square', .05, 1); melody(n.map(f => [f * .75, .15]), 2.1, 'square', .05, 1); melody(n.map(f => [f, .13]), 6.6, 'square', .045, 1);
      for (const t0 of [1.1, 1.45, 5.2]) { tone({ f: 310, t: t0, d: .22, type: 'sawtooth', g: .14, lp: 1800 }); tone({ f: 372, t: t0, d: .22, type: 'sawtooth', g: .1, lp: 1800 }); }
      laugh(4.4, 300, 9, 'sawtooth', .14, .2);
      noise({ t: 9, d: .25, g: .7, ft: 'bandpass', ff: 1800, q: .7, pluck: true }); tone({ f: 200, f2: 60, t: 9, d: .2, g: .4, pluck: true });
      speak("Want a balloon? Come up here and get it!", .6, .8, 3.4);
    }
  };
}

function buildHearse(g) {               // haunted hearse carriage with a passenger
  const paint = M(0x0a0a0d, { roughness: .12, bumpMap: null, envMapIntensity: 1.8 }), gold = M(0xd8a820, { metalness: .9, roughness: .3, envMapIntensity: 1.3 }), wood = TX(TEX.wood(), { roughness: .5 }),
    velvet = TX(TEX.cloth('#5a0a1a', 'velvet'), { roughness: 1 }), bone = TX(TEX.bone(), { roughness: .45 }), eye = B(0x000000), lamp = B(0x000000), tire = M(0x111111, { roughness: .8 }); velvet.side = THREE.DoubleSide;
  const body = grp(g, 0, 0, -.3);
  box(3.3, .14, 1.25, paint, body, 0, .7, 0); box(2.3, .1, 1.3, paint, body, -.45, 1.95, 0);
  const dome = cyl(.65, .65, 2.3, paint, body, -.45, 2.0, 0, 28); dome.rotation.z = PI / 2; dome.scale.set(.3, 1, 1);
  for (const x of [-1.55, .65]) { for (const z of [-.6, .6]) { cyl(.04, .04, 1.2, gold, body, x, 1.35, z, 10); sph(.07, gold, body, x, 2.12, z); } box(.03, 1.15, 1.2, paint, body, x, 1.35, 0); }
  box(2.2, 1.15, .03, paint, body, -.45, 1.35, -.62);
  for (let i = 0; i < 9; i++) { const q = grp(body, -1.45 + i * .25, 1.9, .63); q.userData.sway = .06; add(new THREE.Mesh(new THREE.CircleGeometry(.17, 3), velvet), q, 0, -.1, 0).rotation.z = -PI / 2; }
  box(.8, .45, 1.15, paint, body, 1.2, 1.0, 0); box(.1, .7, 1.15, paint, body, .86, 1.3, 0); box(.5, .06, 1.1, paint, body, 1.75, .88, 0).rotation.z = .5;
  for (const z of [-.62, .62]) { cyl(.08, .06, .2, gold, body, .95, 1.85, z, 8); sph(.06, lamp, body, .95, 1.85, z); cyl(0, .09, .1, gold, body, .95, 2.0, z, 8); }
  const wheels = []; for (const x of [-1.1, 1.15]) for (const z of [-.72, .72]) { const w = grp(body, x, .45, z); w.add(new THREE.Mesh(new THREE.TorusGeometry(.42, .045, 8, 30), tire)); cyl(.07, .07, .12, gold, w, 0, 0, 0, 12).rotation.x = PI / 2;
    for (let i = 0; i < 4; i++) cyl(.015, .015, .82, gold, w, 0, 0, 0, 6).rotation.z = i * PI / 4; wheels.push(w); }
  box(1.9, .42, .62, wood, body, -.45, .99, 0); for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.TorusGeometry(.06, .012, 6, 14, PI), gold), body, -1.1 + i * .65, .98, .32).rotation.z = PI;
  const lid = grp(body, -.45, 1.2, -.31); box(1.9, .06, .62, wood, lid, 0, .03, .31); box(.5, .012, .08, gold, lid, 0, .066, .31); box(.1, .012, .34, gold, lid, .1, .066, .31);
  const sk = grp(body, .25, 1.05, 0); cyl(.03, .03, .5, bone, sk, 0, .25, 0, 8);
  for (let i = 0; i < 4; i++) { const r = add(new THREE.Mesh(new THREE.TorusGeometry(.13 - Math.abs(i - 1.5) * .012, .015, 6, 18), bone), sk, 0, .24 + i * .075, .02); r.rotation.x = PI / 2; r.scale.y = .7; }
  box(.42, .04, .05, bone, sk, 0, .54, 0);
  const sh = skull(sk, bone, eye, .75), jaw = sh.jaw; sh.h.position.set(0, .78, .02);
  const arm = arm2(sk, .21, .54, 0, bone, .3, .28, .024, bone, 'bone', .11), arm0 = arm2(sk, -.21, .54, 0, bone, .3, .28, .024, bone, 'bone', .11);
  const hatb = grp(sh.h, 0, .27, 0); cyl(.26, .26, .02, paint, hatb, 0, 0, 0, 24); cyl(.16, .17, .3, paint, hatb, 0, .16, 0, 24);
  return {
    dur: 12,
    update(t) {
      const on = env(t, 0, .5, 11, 12), open = env(t, 1.4, 2.6, 10, 11.4), sit = env(t, 2.8, 3.7, 9, 10.2), wave = env(t, 4.2, 4.8, 8.3, 8.9);
      lid.rotation.x = -1.3 * open; sk.rotation.z = PI / 2 * (1 - sit);
      sh.h.rotation.y = Math.sin(t * 2) * .6 * sit; sh.h.rotation.z = Math.sin(t * 3.3) * .15 * sit; jaw.rotation.x = .45 * Math.abs(Math.sin(t * 9)) * env(t, 5, 5.1, 7.6, 7.9);
      arm.sh.rotation.z = 2.5 * wave + Math.sin(t * 8) * .3 * wave; arm.el.rotation.z = .5 * wave; arm0.sh.rotation.x = -.9 * sit; arm0.el.rotation.x = -.8 * sit;
      body.rotation.z = Math.sin(t * 6) * .012 * on; body.position.y = Math.abs(Math.sin(t * 6)) * .012 * on;
      wheels.forEach((w, i) => w.rotation.z = Math.sin(t * 1.1 + (i > 1 ? .4 : 0)) * .5 * on);
      glow(lamp, 0xffa030, .3 + .7 * on * (.7 + .3 * Math.sin(t * 17))); glow(eye, 0xb040ff, on * sit);
    },
    sound() {
      const Bb = 233.1, Db = 277.2, C = 261.6, A = 220;
      melody([[Bb, .6], [Bb, .45], [Bb, .15], [Bb, .6], [Db, .45], [C, .15], [C, .45], [Bb, .15], [Bb, .45], [A, .15], [Bb, .9]], .2, 'triangle', .13, .5);
      melody([[Bb, .6], [Bb, .45], [Bb, .15], [Bb, .6], [Db, .45], [C, .15], [C, .45], [Bb, .15], [Bb, .45], [A, .15], [Bb, .9]], 6.2, 'triangle', .1, .5);
      tone({ f: 190, fs: [[.5, 260], [1.2, 150]], t: 1.4, d: 1.3, type: 'sawtooth', g: .09, vib: 30, vibF: 23, lp: 1500 });
      tone({ f: 150, fs: [[.5, 250], [1.2, 180]], t: 10, d: 1.3, type: 'sawtooth', g: .08, vib: 30, vibF: 21, lp: 1500 });
      for (let i = 0; i < 10; i++) noise({ t: 2.8 + i * .09, d: .05, g: .1, ft: 'bandpass', ff: 2200 + Math.random() * 1200, q: 6, pluck: true });
      tone({ f: 40, d: 11.5, type: 'sawtooth', g: .08, lp: 150, a: 1 });
      speak("Room... for one more.", .15, .65, 5.1);
    }
  };
}

/* ---------- downloaded GLB models (Kenney Graveyard Kit, CC0), packed into models.js ---------- */
const GLB = {}, glbQueue = []; let glbReady = false;
function whenModels(cb) { if (glbReady) cb(); else glbQueue.push(cb); }   // runs cb once the models are parsed (never, if models.js is missing)
(function loadModels() {
  if (!window.MODELS || !THREE.GLTFLoader) return;
  const mgr = new THREE.LoadingManager(); mgr.setURLModifier(u => /colormap\.png$/i.test(u) ? MODELS.__colormap : u);
  const loader = new THREE.GLTFLoader(mgr), names = Object.keys(MODELS).filter(k => k[0] !== '_'); let left = names.length;
  const fin = () => { if (--left === 0) { glbReady = true; glbQueue.splice(0).forEach(f => { try { f(); } catch (e) { console.warn(e); } }); } };
  for (const n of names) {
    try { const bin = atob(MODELS[n]), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      loader.parse(buf.buffer, '', g => { GLB[n] = g; fin(); }, e => { console.warn('model failed', n, e); fin(); }); } catch (e) { console.warn('model failed', n, e); fin(); }
  }
})();
// a copy of a loaded model, scaled to `height` metres and standing on y = 0 of its wrapper group
function glbClone(name, height, parent, x = 0, y = 0, z = 0, ry = 0) {
  const src = GLB[name]; if (!src) return null;
  const o = src.scene.clone(true), bb = new THREE.Box3().setFromObject(o), s = height / Math.max(.001, bb.max.y - bb.min.y), w = new THREE.Group();
  o.scale.setScalar(s); o.position.y = -bb.min.y * s; w.add(o); w.position.set(x, y, z); w.rotation.y = ry;
  o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  w.userData.clips = src.animations; w.userData.model = o; if (parent) parent.add(w); return w;
}
function glbActor(w) { const mixer = new THREE.AnimationMixer(w.userData.model), acts = {}; for (const c of w.userData.clips) acts[c.name] = mixer.clipAction(c); return { w, mixer, acts, cur: null }; }
function glbPlay(a, name) {
  if (a.cur === name || !a.acts[name]) return; const prev = a.acts[a.cur], next = a.acts[name];
  next.reset(); next.setLoop(name === 'die' || (a.once && a.once.includes(name)) ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = true;
  if (prev) { prev.fadeOut(.15); next.fadeIn(.15); } next.play(); a.cur = name;
}

function buildGang(g) {                 // five downloaded, pre-animated characters putting on a show together
  const CAST = [['character-keeper', -2.0, .7], ['character-skeleton', -1.0, 1.3], ['character-vampire', 0, .6], ['character-zombie', 1.0, 1.3], ['character-ghost', 2.0, .7]];
  const SHOW = [[.3, 'emote-yes'], [1.6, 'walk'], [3.2, 'attack-melee-right'], [4.2, 'attack-kick-left'], [5.2, 'jump'], [6.2, 'attack-melee-left'], [7.2, 'emote-no'], [8.4, 'sprint'], [9.6, 'die'], [10.9, 'static']];
  const actors = [], flame = B(0x000000);
  for (const s of [-1, 1]) { const f = cyl(0, .12, .4, flame, g, s * 2.45, 1.05, -1.0, 6); f.userData.sway = .2; }
  whenModels(() => {
    glbClone('crypt-small', 2.7, g, 0, 0, -1.5); glbClone('iron-fence', 1.1, g, -1.9, 0, -2.2); glbClone('iron-fence-damaged', 1.1, g, 1.9, 0, -2.2);
    glbClone('gravestone-cross', 1.15, g, -2.3, 0, -.4, .25); glbClone('gravestone-round', 1.0, g, 2.3, 0, -.4, -.25); glbClone('gravestone-broken', .7, g, -1.3, 0, -1.2, .1); glbClone('gravestone-bevel', .9, g, 1.35, 0, -1.2, -.1);
    for (const s of [-1, 1]) { glbClone('fire-basket', .95, g, s * 2.45, 0, -1.0); glbClone('candle-multiple', .35, g, s * .9, 0, 2.1); }
    CAST.forEach(([n, x, z], i) => { const w = glbClone(n, 1.55, g, x, 0, z); if (!w) return; const a = glbActor(w); a.i = i; a.z = z; actors.push(a); });
  });
  return {
    dur: 11.5,
    update(t, dt, time) {
      const on = env(t, 0, .4, 10.6, 11.5);
      for (const a of actors) {
        const tt = t - a.i * .18; let name = 'static'; if (t < 900) for (const [s, n] of SHOW) if (tt >= s) name = n;
        glbPlay(a, name); a.mixer.update(dt);
        a.w.position.z = a.z + .9 * env(tt, 1.6, 3.2, 8.4, 9.6); a.w.rotation.y = Math.sin(tt * 2.2 + a.i) * .35 * on;
      }
      flame.color.setHSL(.07 + .03 * Math.sin(time * 13), 1, .45 + .1 * Math.sin(time * 17)).convertSRGBToLinear().multiplyScalar(1.5 + 3 * on);
    },
    sound() {
      const D = 587.3, E = 659.3, F = 698.5, A = 440, C = 523.3, Bb = 466.2;
      melody([[D, .3], [D, .15], [D, .15], [F, .3], [E, .3], [D, .3], [A, .6], [D, .3], [F, .3], [A * 2, .3], [F, .3], [E, .3], [C, .3], [D, .6], [Bb, .3], [A, .3], [Bb, .3], [C, .3], [D, .3], [E, .3], [F, .3], [E, .3], [D, .9]], .3, 'square', .05, .5);
      for (let i = 0; i < 16; i++) { tone({ f: 73.4, t: .3 + i * .6, d: .25, type: 'triangle', g: .14, pluck: true }); noise({ t: .6 + i * .6, d: .04, g: .1, ft: 'highpass', ff: 5000, pluck: true }); }
      for (const t0 of [5.2, 9.6]) for (let i = 0; i < 5; i++) tone({ f: 900 + i * 120, f2: 1300 + i * 100, t: t0 + i * .07, d: .12, type: 'triangle', g: .08 });
      speak("We are the graveyard gang!", 1.6, 1.05, 1);
    }
  };
}

/* ---------- drop-in replacement models: models/custom/manifest.json (only when run through the local server) ----------
   Each entry swaps one display's shape-built figure for a downloaded GLB / FBX model (e.g. Mixamo), keeping its pad,
   light, sounds and price sign.  See models/custom/README.txt for the manifest format. */
const CUSTOM = {};
// sounds written for specific replacement models (keyed by the model's file name); others keep the display's original sound
const CUSTOM_SOUND = {
  'pumpkinhulk.fbx'() {          // show: scream .4, fists 3.3, scream 6.2
    for (const t0 of [.5, 6.3]) { tone({ f: 70, fs: [[.5, 120], [2, 55]], t: t0, d: 2.3, type: 'sawtooth', g: .3, vib: 10, vibF: 21, lp: 650, a: .15 }); noise({ t: t0, d: 2.2, g: .2, ft: 'bandpass', ff: 450, ff2: 900, q: 1 }); tone({ f: 140, fs: [[.5, 235], [2, 110]], t: t0, d: 2.2, type: 'sawtooth', g: .1, vib: 14, vibF: 23, lp: 1200 }); }
    for (const t0 of [3.8, 4.5, 5.2]) { noise({ t: t0, d: .3, g: .22, ft: 'bandpass', ff: 500, ff2: 2200, q: 2 }); tone({ f: 55, f2: 30, t: t0 + .25, d: .4, g: .5, pluck: true }); noise({ t: t0 + .25, d: .2, g: .3, ft: 'lowpass', ff: 260, pluck: true }); }
    tone({ f: 42, d: 9, type: 'sawtooth', g: .09, lp: 160, a: .6 });
    speak("Who... carved... my face?", .1, .6, 2.6);
  },
  'survivor.fbx'() {             // show: stands up .4-5.2, scream 5.2, attack 8
    noise({ t: 0, d: 4.6, g: .16, ft: 'lowpass', ff: 320, ff2: 800, a: .4 });
    for (let i = 0; i < 12; i++) noise({ t: .3 + i * .36 + Math.random() * .1, d: .14, g: .15, ft: 'bandpass', ff: 450 + Math.random() * 700, q: 2, pluck: true });
    for (const t0 of [.8, 2.6]) tone({ f: 72, fs: [[.8, 100], [1.6, 60]], t: t0, d: 1.7, type: 'sawtooth', g: .17, vib: 6, vibF: 15, lp: 560, a: .3 });
    tone({ f: 240, fs: [[.3, 520], [1.6, 300]], t: 5.3, d: 1.9, type: 'sawtooth', g: .2, vib: 30, vibF: 27, lp: 2400, a: .08 }); noise({ t: 5.3, d: 1.8, g: .16, ft: 'bandpass', ff: 1500, q: 1.2 });
    for (const t0 of [8.2, 9.1]) { noise({ t: t0, d: .28, g: .22, ft: 'bandpass', ff: 600, ff2: 2400, q: 2 }); tone({ f: 100, f2: 62, t: t0, d: .6, type: 'sawtooth', g: .2, vib: 20, vibF: 30, lp: 800 }); }
    speak("Not... dead... yet.", .1, .55, 3.2);
  },
  'whiteclown.fbx'() {           // show: laugh .5, lunge 4.5, shriek 7.5, laugh 9.2
    const n = [659, 622, 587, 554, 523, 494, 523, 494, 466, 440, 415, 392];
    melody(n.map(f => [f, .3]), .2, 'triangle', .07, .5); melody(n.map(f => [f, .22]), 8.2, 'triangle', .06, .5);
    laugh(.7, 170, 8, 'sawtooth', .15, .34); laugh(9.3, 150, 5, 'sawtooth', .14, .3);
    for (const t0 of [4.9, 5.8]) { noise({ t: t0, d: .3, g: .22, ft: 'bandpass', ff: 500, ff2: 2600, q: 2 }); tone({ f: 60, f2: 34, t: t0 + .2, d: .35, g: .4, pluck: true }); }
    tone({ f: 500, fs: [[.25, 1500], [1.4, 800]], t: 7.5, d: 1.6, type: 'sawtooth', g: .17, vib: 70, vibF: 13, lp: 3400, a: .05 }); noise({ t: 7.5, d: 1.4, g: .12, ft: 'bandpass', ff: 2600, q: 1.5 });
    speak("Come closer. I don't bite... much.", .45, .75, 2.9);
  },
  'skeletonzombie.fbx'() {       // show: screech .5, claws 5.2
    for (const t0 of [.6, 2.7]) { tone({ f: 700, fs: [[.3, 1900], [1.5, 1100]], t: t0, d: 1.8, type: 'sawtooth', g: .15, vib: 120, vibF: 31, lp: 4200, a: .05 }); noise({ t: t0, d: 1.7, g: .16, ft: 'bandpass', ff: 3000, ff2: 1500, q: 1.5 }); tone({ f: 95, f2: 60, t: t0, d: 1.6, type: 'sawtooth', g: .12, vib: 18, vibF: 29, lp: 700 }); }
    for (let i = 0; i < 18; i++) noise({ t: Math.random() * 9, d: .04, g: .11, ft: 'bandpass', ff: 2600 + Math.random() * 1800, q: 7, pluck: true });
    for (const t0 of [5.5, 6.3, 7.1, 7.9]) { noise({ t: t0, d: .22, g: .28, ft: 'highpass', ff: 1800, pluck: true }); noise({ t: t0, d: .3, g: .16, ft: 'bandpass', ff: 700, ff2: 2800, q: 2 }); }
    tone({ f: 50, d: 9, type: 'sawtooth', g: .09, lp: 190, vib: 4, vibF: 6, a: .5 });
    speak("Fresh... meat.", .15, .6, 4.3);
  },
};
const anyCache = {};
function loadAny(url) {   // each file is fetched and parsed once, however many displays use it
  return anyCache[url] || (anyCache[url] = new Promise((res, rej) => {
    if (/\.fbx$/i.test(url)) { if (!THREE.FBXLoader) return rej('FBXLoader missing'); new THREE.FBXLoader().load(url, o => res({ scene: o, animations: o.animations || [] }), undefined, rej); }
    else new THREE.GLTFLoader().load(url, g => res({ scene: g.scene, animations: g.animations || [] }), undefined, rej);
  }).then(r => { r.scene.traverse(o => { if (r.hipY === undefined && /Hips$/i.test(o.name)) r.hipY = o.position.y; }); return r; }));
}
// a clip made for one Mixamo character, adjusted to another one's hip height so feet stay on the floor
function fitClip(clip, name, fromHip, toHip) {
  const c = clip.clone(); c.name = name;
  if (fromHip && toHip && Math.abs(fromHip - toHip) > .001) for (const t of c.tracks) if (/Hips\.position$/i.test(t.name)) { const k = toHip / fromHip; for (let i = 0; i < t.values.length; i++) t.values[i] *= k; }
  return c;
}
async function loadCustom() {
  if (!/^http/.test(location.protocol)) { const tip = document.getElementById('fileTip'); if (tip) tip.style.display = 'block'; return; }
  // Touch devices skip the big replacement models (about 61 MB to download and parse) unless the player turned on "Realistic"
  if (IS_TOUCH && !wantRealistic()) return;
  let man; try { const r = await fetch('models/custom/manifest.json', { cache: 'no-store' }); if (!r.ok) return; man = await r.json(); } catch (e) { return; }
  for (const name of Object.keys(man)) {
    if (name[0] === '_') continue; const cfg = man[name];
    try {
      const base = 'models/custom/', main = await loadAny(base + cfg.file), clips = {};
      for (const c of main.animations) clips[c.name] = c;
      if (cfg.clip && main.animations[0]) clips[cfg.clip] = fitClip(main.animations[0], cfg.clip);
      // "animations": ["file.fbx", ...] (clip named after the file) or {"clipName": "file.fbx", ...}
      const extra = Array.isArray(cfg.animations) ? cfg.animations.map(f => [f.replace(/^.*\//, '').replace(/\.\w+$/, ''), f]) : Object.entries(cfg.animations || {});
      for (const [cn, f] of extra) { const a = await loadAny(base + f); if (a.animations[0]) clips[cn] = fitClip(a.animations[0], cn, a.hipY, main.hipY); }
      main.scene.traverse(m => {
        if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
        const fix = mt => { if (mt.isMeshStandardMaterial) return mt;
          const n = new THREE.MeshStandardMaterial({ color: mt.color, map: mt.map || null, normalMap: mt.normalMap || null, roughness: cfg.roughness === undefined ? .75 : cfg.roughness, metalness: 0, skinning: !!m.isSkinnedMesh, alphaTest: cfg.alphaTest || 0, side: mt.side });
          if (n.map) n.map.encoding = THREE.sRGBEncoding; return n; };
        m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
      });
      const dd = DEFS.find(d => d.name === name); if (dd) { if (cfg.does) dd.does = cfg.does; if (cfg.credit) dd.real = cfg.credit; }
      CUSTOM[name] = { cfg, scene: main.scene, clips }; stations.filter(s => s.def.name === name).forEach(applyCustom); cardState = null;
      console.log('custom model loaded for', name, '- clips:', Object.keys(clips).join(', '));
    } catch (e) { console.warn('custom model failed:', name, e); }
  }
}
function applyCustom(st) {
  const C = CUSTOM[st.def.name]; if (!C || st.custom) return; st.custom = true;
  const cfg = C.cfg, o = THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(C.scene) : C.scene.clone(true), w = new THREE.Group();
  const bb = new THREE.Box3().setFromObject(o), s = (cfg.height || 1.8) / Math.max(.001, bb.max.y - bb.min.y);
  o.scale.multiplyScalar(s); o.position.multiplyScalar(s); o.position.y -= bb.min.y * s; w.add(o);
  const off = cfg.offset || [0, 0, 0]; w.position.set(off[0], off[1], off[2]); w.rotation.y = cfg.rotY || 0;
  // swap the body only: anything the builder marked as a prop (tombstone, balloon...) stays where it is
  const props = []; st.fig.traverse(c => { if (c.userData.prop) props.push(c); });
  for (const p of props) if (p.parent !== st.fig) st.fig.attach(p);
  if (!cfg.keepOriginal) st.fig.children.forEach(c => { if (!c.userData.prop) c.visible = false; });
  st.fig.add(w);
  const mixer = new THREE.AnimationMixer(o), acts = {}; for (const k in C.clips) acts[k] = mixer.clipAction(C.clips[k]);
  const a = { w, mixer, acts, cur: null, once: cfg.once || [] }, old = st.api, show = cfg.show || [], rest = cfg.rest || (show[0] && show[0][1]) || Object.keys(acts)[0];
  st.joints = []; st.sways = []; for (const p of props) p.traverse(c => { if (c.userData.sway) st.sways.push(c); });
  st.api = { dur: cfg.dur || old.dur, sound: CUSTOM_SOUND[String(cfg.file).replace(/^.*\//, '')] || old.sound,
    update(t, dt) { const live = t < 900; let name = rest; if (live) for (const [s0, n] of show) if (t >= s0) name = n;
      glbPlay(a, name); const act = a.acts[name]; if (act) { act.paused = !live; if (!live) act.time = 0; } mixer.update(dt); } };
}

