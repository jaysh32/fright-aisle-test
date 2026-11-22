"use strict";
/* ================= player ================= */
const player = { x: 0, z: 44.5, yaw: 0, pitch: 0, bob: 0 };
const keys = {};
let started = false;
addEventListener('keydown', e => { keys[e.code] = true; if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => keys[e.code] = false);
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
const canvas = renderer.domElement;
function begin() {
  if (!started) { started = true; $('overlay').style.display = 'none'; initAudio(); }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
function lock() { try { const p = canvas.requestPointerLock && canvas.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (e) { } }
$('overlay').addEventListener('click', () => { if (!window.gameReady) return; begin(); if (!('ontouchstart' in window)) lock(); $('hint').innerHTML = 'Click to look around<br>(or drag / arrow keys)'; });
canvas.addEventListener('click', () => { if (document.pointerLockElement !== canvas) lock(); });
// fallback when the mouse can't be captured: hold the button and drag to look
addEventListener('mousemove', e => { if (document.pointerLockElement === canvas || !(e.buttons & 1) || !started) return; player.yaw -= e.movementX * .004; player.pitch = clamp(player.pitch - e.movementY * .004, -1.3, 1.3); });
document.addEventListener('pointerlockchange', () => { $('hint').innerHTML = document.pointerLockElement === canvas ? 'Esc to free the mouse' : (started ? 'Click to look around<br>(or use arrow keys)' : ''); });
addEventListener('mousemove', e => { if (document.pointerLockElement !== canvas) return; player.yaw -= e.movementX * .0023; player.pitch = clamp(player.pitch - e.movementY * .0023, -1.3, 1.3); });
// touch: left half = walk, right half = look
const touch = { mx: 0, mz: 0, ids: {} };
canvas.addEventListener('touchstart', e => { begin(); for (const t of e.changedTouches) touch.ids[t.identifier] = { x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, left: t.clientX < innerWidth / 2 }; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchmove', e => {
  for (const t of e.changedTouches) { const o = touch.ids[t.identifier]; if (!o) continue;
    if (o.left) { touch.mx = clamp((t.clientX - o.x0) / 60, -1, 1); touch.mz = clamp((o.y0 - t.clientY) / 60, -1, 1); }
    else { player.yaw -= (t.clientX - o.x) * .005; player.pitch = clamp(player.pitch - (t.clientY - o.y) * .005, -1.3, 1.3); }
    o.x = t.clientX; o.y = t.clientY; }
  e.preventDefault(); }, { passive: false });
const touchEnd = e => { for (const t of e.changedTouches) { const o = touch.ids[t.identifier]; if (o && o.left) touch.mx = touch.mz = 0; delete touch.ids[t.identifier]; } };
canvas.addEventListener('touchend', touchEnd); canvas.addEventListener('touchcancel', touchEnd);

/* ---------- touch screens: visible thumbstick on the left, drag-to-look on the right ---------- */
// "touch device" = the main pointer is a finger (tablets, phones). A touchscreen laptop with a mouse or trackpad still counts as a PC.
const IS_TOUCH = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || (('ontouchstart' in window || navigator.maxTouchPoints > 0) && !(window.matchMedia && matchMedia('(any-pointer: fine)').matches));
if (IS_TOUCH) document.body.classList.add('touch');
// opt-in on touch devices for the heavy realistic characters; remembered on the device, takes effect after a reload
function wantRealistic() { try { return localStorage.getItem('frightAisle.realistic') === '1'; } catch (e) { return false; } }
{ const rb = document.querySelector('#btns button[data-k="Real"]');
  if (rb) { rb.textContent = wantRealistic() ? '🧟 Realistic: on' : '🧟 Realistic: off';
    // copies of the game that ship without replacement models (the public one) have nothing to turn on, so hide the button there
    const hide = () => { rb.style.display = 'none'; };
    if (/^http/.test(location.protocol)) fetch('models/custom/manifest.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).then(m => { if (!Object.keys(m).some(k => k[0] !== '_')) hide(); }).catch(hide); else hide(); } }
{ const stick = document.getElementById('stick'), knob = document.getElementById('knob'), lookHint = document.getElementById('lookHint'); let stickId = null, sx0 = 0, sy0 = 0;
  canvas.addEventListener('touchstart', e => { for (const t of e.changedTouches) {
    if (t.clientX >= innerWidth / 2) { lookHint.classList.add('used'); continue; }
    if (stickId !== null) continue; stickId = t.identifier; sx0 = t.clientX; sy0 = t.clientY;
    stick.style.left = sx0 + 'px'; stick.style.top = sy0 + 'px'; stick.classList.add('on'); knob.style.transform = 'translate(-50%, -50%)'; } }, { passive: true });
  canvas.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === stickId) {
    let dx = t.clientX - sx0, dy = t.clientY - sy0; const l = Math.hypot(dx, dy); touch.run = l > 88; if (l > 60) { dx *= 60 / l; dy *= 60 / l; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; } }, { passive: true });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; touch.run = false; stick.classList.remove('on'); stick.style.left = ''; stick.style.top = ''; knob.style.transform = 'translate(-50%, -50%)'; } };
  canvas.addEventListener('touchend', end); canvas.addEventListener('touchcancel', end); }

/* ================= loop ================= */
// Servo pass: update() wrote target poses; every joint chases its target on a springy
// motor, which gives the lag, overshoot and settle-wobble of a real animatronic.
const AX = ['x', 'y', 'z'];
function servo(st, dt, time, act) {
  for (const s of st.sways) s.rotation.x = Math.sin(time * 2.2 + s.id) * s.userData.sway * (.5 + 2.2 * act);
  const K = 900, D = 30, n = Math.max(1, Math.ceil(dt / .008)), h = dt / n;
  for (const j of st.joints) {
    const o = j.o;
    if (!j.init) { j.r.set(o.rotation.x, o.rotation.y, o.rotation.z); j.p.copy(o.position); j.init = true; continue; }
    for (const a of AX) {
      const tr = o.rotation[a], tp = o.position[a];
      for (let k = 0; k < n; k++) { j.rv[a] += ((tr - j.r[a]) * K - j.rv[a] * D) * h; j.r[a] += j.rv[a] * h; j.pv[a] += ((tp - j.p[a]) * K - j.pv[a] * D) * h; j.p[a] += j.pv[a] * h; }
      o.rotation[a] = j.r[a]; o.position[a] = j.p[a];
    }
  }
}
function servoWhine(dur) { for (let i = 0; i < 4 + dur * .6; i++) { const f = 240 + Math.random() * 380; tone({ f, f2: f * (Math.random() < .5 ? 1.5 : .7), t: Math.random() * (dur - 1), d: .18 + Math.random() * .3, type: 'sawtooth', g: .022, lp: 2200 }); } }

/* ---------- shopping cart you can push, and load with the ones you like ---------- */
let mode = 'store', nearSt = null;
const cartItems = [], MAXCART = 6;
const cart = grp(scene, 2.4, 0, 41), cartLoad = grp(cart, 0, .63, 0); cart.vx = 0; cart.vz = 0; cart.rotation.y = PI;
{ const or = M(0xe8590c, { roughness: .45, metalness: .3, bumpMap: null }), wire = new THREE.MeshStandardMaterial({ color: 0xb0b6be, metalness: .8, roughness: .35, wireframe: true }), bl = M(0x111111);
  const bk = new THREE.Mesh(new THREE.BoxGeometry(.72, .5, 1.05, 7, 5, 10), wire); bk.position.y = .86; cart.add(bk);
  box(.74, .03, 1.07, or, cart, 0, .6, 0).castShadow = true; box(.78, .04, .04, or, cart, 0, 1.14, -.62); box(.74, .03, .03, or, cart, 0, 1.11, .53);
  for (const s of [-1, 1]) { box(.03, .6, .03, or, cart, s * .35, .3, -.45); box(.03, .6, .03, or, cart, s * .35, .3, .45); box(.03, .1, .16, or, cart, s * .36, 1.1, -.56);
    for (const z of [-.45, .45]) cyl(.06, .06, .04, bl, cart, s * .35, .06, z, 12).rotation.z = PI / 2; } }
function pushCart(dt) {
  const dx = cart.position.x - player.x, dz = cart.position.z - player.z, d = Math.hypot(dx, dz) || 1;
  if (d < 1.15) { const nx = dx / d, nz = dz / d, push = 1.15 - d; cart.position.x += nx * push; cart.position.z += nz * push; cart.vx = nx * 2.4; cart.vz = nz * 2.4;
    let da = Math.atan2(nx, nz) - cart.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); cart.rotation.y += da * Math.min(1, dt * 6); }
  const sp = Math.hypot(cart.vx, cart.vz); if (sp > .4 && Math.random() < dt * 16) noise({ d: .03, g: .05 * Math.min(1, sp), ft: 'bandpass', ff: 2400 + Math.random() * 1500, q: 5, pluck: true });
  cart.position.x = clamp(cart.position.x + cart.vx * dt, -6, 6); cart.position.z = clamp(cart.position.z + cart.vz * dt, -46, 45.6);
  const k = Math.exp(-3 * dt); cart.vx *= k; cart.vz *= k;
}
function showCart() { $('cartList').textContent = cartItems.length ? fixKeys('🛒 ' + cartItems.map(d => d.name).join(', ') + (mode === 'yard' ? '  —  press Y to go back to the store' : '  —  press Y to set up your yard')) : ''; }
// on touch devices, messages name the on-screen buttons instead of keyboard keys
function fixKeys(s) {
  if (!IS_TOUCH) return s;
  const tap = (word) => m => (m[0] === 'P' ? 'Tap ' : 'tap ') + word;
  return String(s).replace(/\b[Pp]ress E\b/g, tap('Add')).replace(/\b[Pp]ress Y\b/g, tap('Yard')).replace(/\b[Pp]ress G\b/g, tap('Quality'))
    .replace('P takes a photo', 'Photo takes a picture').replace('L switches', 'Lights switches').replace('G changes', 'Quality changes')
    .replace('(H to show)', '(tap Info to show)').replace('(E to remove)', '(tap Add to remove)');
}
function addToCart() {
  if (mode !== 'store' || !nearSt) return;
  if (!nearSt.found) { toast('Try it first!<br>Step on the pad, then add it', 2.5); return; }
  const k = cartItems.indexOf(nearSt.def);
  if (k >= 0) { cartItems.splice(k, 1); toast(nearSt.def.name + ' put back on the shelf', 2); }
  else if (cartItems.length >= MAXCART) { toast('Cart is full (' + MAXCART + ')<br>Press E again at one to put it back', 3); return; }
  else { cartItems.push(nearSt.def); toast('🛒 ' + nearSt.def.name + ' added (' + cartItems.length + '/' + MAXCART + ')<br>Press Y to set up your yard', 3);
    tone({ f: 1320, d: .12, type: 'square', g: .08 }); tone({ f: 1760, t: .1, d: .25, type: 'square', g: .08, pluck: true }); }
  refreshCart(); cardState = ''; save(); if (cartItems.length) tip('yard', 'Press Y to set your picks up in your own yard.');
}

/* ---------- trick-or-treat yard: your picks set up outside a house at night ---------- */
const YX = 1000, yard = grp(scene, YX, 0, 0); yard.visible = false; let yardBuilt = false, yardStations = [], yardDone = false;
function buildYard() {
  yardBuilt = true;
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), TX(memo('grass', () => strokeTex('#17301a', [[3000, 10, PI / 2, .8, 1.5, ['rgba(60,110,50,.35)', 'rgba(5,20,8,.5)']]], 30)), { roughness: 1 })); lawn.rotation.x = -PI / 2; lawn.position.z = 18; yard.add(lawn);
  const stone = TX(TEX.stone(), { roughness: .9 });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(3, 38), stone); p1.rotation.x = -PI / 2; p1.position.set(0, .01, 21); yard.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(90, 3.4), stone); p2.rotation.x = -PI / 2; p2.position.set(0, .012, 41.6); yard.add(p2);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 14), M(0x0c0c0e, { roughness: .8 })); road.rotation.x = -PI / 2; road.position.set(0, .011, 50.3); yard.add(road);
  // the house
  const wall = TX(TEX.cloth('#3a3444', 'siding'), { roughness: .9 }), roofM = M(0x18141c, { roughness: .8 }), trim = M(0xd8d2c8, { roughness: .6 }), lit = B(0xffc860); lit.color.multiplyScalar(1.15);
  box(15, 6.5, 7, wall, yard, 0, 3.25, -4.6);
  const roof = add(new THREE.Mesh(new THREE.ConeGeometry(11.5, 4.5, 4), roofM), yard, 0, 8.75, -4.6); roof.rotation.y = PI / 4; roof.scale.z = .62;
  box(1.2, 3.5, 1.2, wall, yard, 4.5, 9, -5.5);
  box(5, .3, 2.6, trim, yard, 0, .15, .1); box(5.4, .2, 2.9, roofM, yard, 0, 3.2, .1); for (const x of [-2.3, 2.3]) cyl(.1, .1, 2.9, trim, yard, x, 1.75, 1.2, 10);
  box(1.4, 2.5, .12, M(0x5a1a12, { roughness: .5 }), yard, 0, 1.55, -1.06); box(1.7, 2.75, .08, trim, yard, 0, 1.6, -1.1); sph(.05, M(0xd8a820, { metalness: .9, roughness: .3 }), yard, .5, 1.5, -.98);
  for (const [x, y] of [[-4.6, 1.9], [4.6, 1.9], [-4.6, 4.9], [4.6, 4.9], [0, 4.9]]) { box(1.5, 1.7, .06, lit, yard, x, y, -1.09); box(1.7, 1.9, .05, trim, yard, x, y, -1.1); box(.06, 1.7, .08, trim, yard, x, y, -1.07); box(1.5, .06, .08, trim, yard, x, y, -1.07); }
  sph(.12, lit, yard, 1.25, 2.75, -.9); const pl = new THREE.PointLight(new THREE.Color(0xffb060).convertSRGBToLinear(), 1.6, 16, 1.5); pl.position.set(0, 2.7, .6); yard.add(pl);
  const bowl = lathe([[.0, 0], [.2, .02], [.3, .22], [.32, .26]], M(0xe8590c, { roughness: .4 }), yard, 1.6, .3, .4); for (let i = 0; i < 16; i++) sph(.05, M([0xd01818, 0xe0b020, 0x1fae3a, 0x5a2a8a][i % 4], { roughness: .3 }), yard, 1.6 + (Math.random() - .5) * .35, .5 + Math.random() * .08, .4 + (Math.random() - .5) * .35);
  pumpkinProp(yard, -1.7, .3, .9, .2); pumpkinProp(yard, -1.1, .3, .5, -.2);
  for (let z = 6; z <= 36; z += 6) for (const s of [-1, 1]) pumpkinProp(yard, s * 1.9, 0, z, -s * PI / 2);
  // picket fence, bare trees, moon and stars
  const d = new THREE.Object3D(), pk = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, 1.05, .04), trim, 300); let n = 0;
  for (let x = -30; x <= 30; x += .22) if (Math.abs(x) > 1.8) { d.position.set(x, .55, 39.6); d.updateMatrix(); pk.setMatrixAt(n++, d.matrix); } pk.count = n; yard.add(pk);
  for (const y of [.35, .85]) for (const s of [-1, 1]) box(28.2, .07, .05, trim, yard, s * 15.9, y, 39.56);
  const bark = TX(TEX.wood(), { roughness: 1 }); let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 12; i++) { const s = i % 2 ? 1 : -1, t = grp(yard, s * (11 + rnd() * 16), 0, rnd() * 36), h = 4 + rnd() * 4; cyl(.12, .3, h, bark, t, 0, h / 2, 0, 8);
    for (let j = 0; j < 5; j++) { const b = grp(t, 0, h * (.45 + rnd() * .5), 0); b.rotation.set(0, rnd() * 6.3, .5 + rnd() * .9); b.userData.sway = .03; seg(1.2 + rnd() * 1.8, .07, bark, b, .015).rotation.z = PI; } }
  const mm = B(0xfff2c0); mm.color.multiplyScalar(1.6); mm.fog = false; sph(9, mm, yard, -50, 70, -150);
  const sg = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 500; i++) { const a = Math.random() * PI * 2, e = Math.random() * 1.3 + .1; sp.push(Math.cos(a) * Math.cos(e) * 260, Math.sin(e) * 260, Math.sin(a) * Math.cos(e) * 260); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); yard.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, fog: false, sizeAttenuation: false })));
}
function enterYard() {
  if (!cartItems.length) { toast('Your cart is empty<br>Try a display, then press E to add it', 3.5); return; }
  if (!yardBuilt) { buildYard(); whenModels(dressYard); }
  whenModels(spawnKids);
  cartItems.forEach((def, k) => { const s = k % 2 ? 1 : -1; yardStations.push(makeStation(def, -1, YX + s * 5, 31 - k * 5, s < 0 ? PI / 2 : -PI / 2, true)); });
  yard.visible = true; mode = 'yard'; yardScares = 0; yardDone = false; cardState = '';
  player.x = YX; player.z = 41.5; player.yaw = 0; player.pitch = 0;
  setStore(.3); hemi.color.setRGB(.2, .28, .6); scene.fog.color.setRGB(.012, .016, .04); scene.fog.density = .02; scene.background = new THREE.Color(.004, .006, .02);
  $('hud').querySelector('h1').textContent = 'YOUR YARD'; showCart();
  toast('🎃 TRICK OR TREAT 🎃<br>Walk up to the front door... if you dare', 4.5);
}
function leaveYard() {
  for (const st of yardStations) scene.remove(st.g); yardStations = []; yard.visible = false; mode = 'store'; cardState = '';
  player.x = 0; player.z = 44.5; player.yaw = 0; player.pitch = 0;
  setStore(showMode ? .22 : 1); hemi.color.setHex(0xe6ecff); scene.fog.color.setHex(0x06060a); scene.fog.density = .008; scene.background = new THREE.Color(0x020203);
  $('hud').querySelector('h1').textContent = 'FRIGHT AISLE'; showCart();
}

/* ---------- downloaded models in the yard: graveyard dressing + three little trick-or-treaters ---------- */
function dressYard() {
  let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const G = ['gravestone-cross', 'gravestone-round', 'gravestone-bevel', 'gravestone-broken', 'gravestone-wide', 'gravestone-cross-large', 'gravestone-roof'];
  for (let i = 0; i < 28; i++) { const s = i % 2 ? 1 : -1; glbClone(G[i % G.length], .8 + rnd() * .7, yard, s * (9.5 + rnd() * 12), 0, 4 + rnd() * 32, (rnd() - .5) * .7); }
  glbClone('crypt-small', 3.4, yard, -16, 0, 9, .5); glbClone('crypt-small', 3.4, yard, 17, 0, 25, -.6);
  for (const s of [-1, 1]) { glbClone('lightpost-single', 3.6, yard, s * 2.7, 0, 39.2, s > 0 ? PI : 0); glbClone('fire-basket', 1.1, yard, s * 2.6, 0, 3.6); glbClone('iron-fence-border-gate', 1.5, yard, s * 1.9, 0, 39.6, 0); }
  for (let i = 0; i < 10; i++) glbClone(i % 2 ? 'pine-crooked' : 'pine-fall-crooked', 5 + rnd() * 3.5, yard, (i % 2 ? 1 : -1) * (21 + rnd() * 10), 0, rnd() * 38, rnd() * 6);
  glbClone('coffin-old', .6, yard, -10.5, 0, 20, .4); glbClone('shovel-dirt', .9, yard, -11.8, 0, 21.2); glbClone('grave', .3, yard, 11, 0, 14, .1); glbClone('altar-stone', .9, yard, 12.5, 0, 31, -.3); glbClone('rocks-tall', 1.4, yard, -13, 0, 30, 1);
  for (let i = 0; i < 8; i++) glbClone(i % 2 ? 'pumpkin-carved' : 'pumpkin-tall-carved', .45 + rnd() * .25, yard, (i % 2 ? 1 : -1) * (8.6 + rnd() * 4), 0, 5 + rnd() * 30, rnd() * 6);
}
const kids = [], kidTrail = []; let kidsJump = 0;
function spawnKids() {
  if (!kids.length) ['character-keeper', 'character-zombie', 'character-skeleton'].forEach((n, k) => { const w = glbClone(n, 1.05, yard); if (!w) return; const a = glbActor(w); a.k = k; kids.push(a); });
  kidTrail.length = 0; for (const kd of kids) kd.w.position.set((kd.k - 1) * .8, 0, 43 + kd.k * .5);
}
function kidsScare() { if (!kids.length) return; kidsJump = 1.1; for (let i = 0; i < 3; i++) tone({ f: 1200 + i * 250, f2: 1700 + i * 250, t: .12 + i * .09, d: .18, type: 'triangle', g: .07 }); }
function updateKids(dt) {
  kidsJump = Math.max(0, kidsJump - dt);
  // they trail along the path you actually walked, so you can turn round and see them
  const last = kidTrail[kidTrail.length - 1], px = player.x - YX;
  if (!last || Math.hypot(px - last[0], player.z - last[1]) > .35) { kidTrail.push([px, player.z]); if (kidTrail.length > 40) kidTrail.shift(); }
  for (const kd of kids) {
    const tp = kidTrail[Math.max(0, kidTrail.length - 5 - kd.k * 3)], side = (kd.k - 1) * .55, tx = tp[0] + side, tz = tp[1] + (kidTrail.length < 6 ? 1.5 + kd.k : 0);
    const dx = tx - kd.w.position.x, dz = tz - kd.w.position.z, d = Math.hypot(dx, dz), sp = Math.min(d * 3, 7), mv = d > .15;
    if (mv) { kd.w.position.x += dx / d * sp * dt; kd.w.position.z += dz / d * sp * dt; let da = Math.atan2(dx, dz) - kd.w.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); kd.w.rotation.y += da * Math.min(1, dt * 8); }
    glbPlay(kd, kidsJump > 0 ? 'jump' : mv && sp > .5 ? (sp > 4.5 ? 'sprint' : 'walk') : 'idle'); kd.mixer.update(dt);
  }
}

/* ---------- photo mode ---------- */
function photo() {
  draw();
  try { renderer.domElement.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'fright-aisle-' + Date.now() + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png'); } catch (e) { }
  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = .9; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; });
  noise({ d: .06, g: .3, ft: 'highpass', ff: 3000, pluck: true }); noise({ t: .09, d: .08, g: .25, ft: 'bandpass', ff: 1800, q: 2, pluck: true });
  toast('📷 Photo saved', 1.5);
}
addEventListener('keydown', e => {
  if (!started || e.repeat) return;
  if (e.code === 'KeyH') { cardOff = !cardOff; cardState = null; toast(cardOff ? 'Descriptions hidden (H to show)' : 'Descriptions shown', 1.6); }
  else if (e.code === 'KeyG') setQuality((quality + 1) % 4); else if (e.code === 'Reset') resetSave();
  else if (e.code === 'KeyE') addToCart(); else if (e.code === 'KeyP') photo(); else if (e.code === 'KeyY') { if (mode === 'yard') leaveYard(); else enterYard(); }
});
for (const b of document.querySelectorAll('#btns button')) b.addEventListener('click', ev => { ev.stopPropagation(); begin();
  if (b.dataset.k === 'Real') {
    const on = !wantRealistic(); if (on && !confirm('Load the 4 realistic characters? This downloads about 60 MB and can be slow or crash on older tablets. The game will reload.')) return;
    try { localStorage.setItem('frightAisle.realistic', on ? '1' : '0'); } catch (e) { } location.reload(); return; }
  if (b.dataset.k === 'Full') { const d = document, el = d.documentElement; try { if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d); else (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (e) { toast('Full screen is not available here', 2); } return; }
  dispatchEvent(new KeyboardEvent('keydown', { code: b.dataset.k })); });

/* ---------- store intercom ---------- */
const PA = ["Attention shoppers. The store closes at midnight. The animatronics do not.", "Clean up in aisle thirteen. Bring a mop... and a priest.",
  "Would the owner of a black hearse please move it. It is blocking the exit... and it looks hungry.", "Reminder. Please do not feed the plant.",
  "Lost child at the front desk. He says his name is... right behind you.", "Attention shoppers. If an animatronic follows you home, all sales are final.",
  "Price check on aisle thirteen. One soul. Slightly used."];
let paT = 28, paI = Math.floor(Math.random() * PA.length);
function intercom() { for (const [f, t] of [[660, 0], [554, .28], [440, .56]]) tone({ f, t, d: .9, type: 'sine', g: .1, pluck: true }); noise({ t: .9, d: .5, g: .03, ft: 'bandpass', ff: 1500, q: 2 }); speak(PA[paI++ % PA.length], .9, .92, 1.3); }

/* ---------- graphics quality, saved progress, walk-up tips ---------- */
const SAVE_KEY = 'frightAisle.v1', QNAMES = ['High', 'Medium', 'Low', 'Tablet'], tipsSeen = {}; let quality = 0, lightBudget = 0, qSet = false;
function setQuality(q, quiet) {
  if (!quiet) qSet = true;
  // Low and Tablet light only the nearest few displays; Tablet also drops the HDR/bloom chain and renders at lower resolution
  lightBudget = q >= 2 ? (q === 3 ? 3 : 5) : 0; setPlain(q === 3);
  if (!lightBudget) for (const s of stations.concat(yardStations)) s.light.visible = true;
  if (q === 3) { quality = q; renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25) * .75); renderer.setSize(innerWidth, innerHeight); sun.castShadow = false; if (!quiet) { toast('Graphics: Tablet', 1.8); save(); } return; }
  quality = q; renderer.setPixelRatio([Math.min(devicePixelRatio, 2), 1, .7][q]); renderer.setSize(innerWidth, innerHeight);
  if (composer) { const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setSize(sz.x, sz.y); if (composer.passes[1]) composer.passes[1].enabled = q === 0; }   // bloom only on High
  sun.castShadow = q < 2;                                                                                                                                                     // shadows off on Low
  if (!quiet) { toast('Graphics: ' + QNAMES[q], 1.8); save(); }
}
function refreshCart() {
  while (cartLoad.children.length) cartLoad.remove(cartLoad.children[0]);
  cartItems.forEach((d, i) => { const b = box(.3, .3 + (i % 3) * .06, .3, M(d.light, { roughness: .6 }), cartLoad, (i % 2 - .5) * .33, .16 + (i % 3) * .03, (Math.floor(i / 2) - 1) * .33); b.castShadow = true; });
  showCart();
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ found: stations.filter(s => s.found).map(s => s.def.name), secrets: stations.filter(s => s.secret).map(s => s.def.name), cart: cartItems.map(d => d.name), quality: qSet ? quality : null, tips: tipsSeen })); } catch (e) { }
}
function loadSave() {
  let d = null; try { d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { } if (!d) return;
  for (const s of stations) { if ((d.found || []).includes(s.def.name)) { s.found = true; dots[s.i].className = 'on'; } if ((d.secrets || []).includes(s.def.name)) { s.secret = true; secrets++; } }
  if (stations.every(s => s.found)) finale.unlocked = true;
  for (const n of d.cart || []) { const def = DEFS.find(x => x.name === n); if (def && cartItems.length < MAXCART) cartItems.push(def); }
  Object.assign(tipsSeen, d.tips || {}); refreshCart(); if (typeof d.quality === 'number') { qSet = true; setQuality(d.quality, true); }
}
function resetSave() { if (!confirm('Erase your progress, secrets and cart?')) return; try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); }
// one-time hints that appear when they become relevant, instead of a wall of keys up front
function tip(id, text) { if (tipsSeen[id] || !started) return; tipsSeen[id] = 1; const el = $('tip'); el.textContent = fixKeys(text); el.style.opacity = 1; clearTimeout(tip.t); tip.t = setTimeout(() => el.style.opacity = 0, 7000); save(); }
let fpsT0 = 0, fpsN = 0, fpsDone = false, cardOff = false;

const clock = new THREE.Clock();
let cardState = null, scareLvl = 0, lastFoot = 0;
function step(dt, time) {
  const yardM = mode === 'yard', list = yardM ? yardStations : stations;
  // movement
  if (started) {
    const turn = (keys.ArrowLeft || keys.KeyQ ? 1 : 0) - (keys.ArrowRight ? 1 : 0); player.yaw += turn * 2 * dt;
    let f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + touch.mz, s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + touch.mx;
    const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
    const run = keys.ShiftLeft || keys.ShiftRight || touch.run, sp = (run ? 8.5 : 4.6) * dt, sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    const bx = yardM ? [YX - 8, YX + 8, 2.4, 43] : [-6.4, 6.4, -49.4, 46];   // far limit sits past the last pair of pads (z = -48)
    player.x = clamp(player.x + (-sy * f + cy * s) * sp, bx[0], bx[1]);
    player.z = clamp(player.z + (-cy * f - sy * s) * sp, bx[2], bx[3]);
    if (len > .05) { player.bob += dt * (run ? 13 : 9); const k = Math.floor(player.bob / PI);
      if (k !== lastFoot) { lastFoot = k; noise({ d: .07, g: yardM ? .05 : .09, ft: 'lowpass', ff: yardM ? 900 : 420, pluck: true }); if (!yardM) tone({ f: 95, f2: 60, d: .06, g: .05, pluck: true }); } }
  }
  camera.position.set(player.x, 1.65 + Math.sin(player.bob) * .045, player.z);
  camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
  if (ctx && ctx.listener.setPosition) { ctx.listener.setPosition(player.x, 1.65, player.z); ctx.listener.setOrientation(-Math.sin(player.yaw), 0, -Math.cos(player.yaw), 0, 1, 0); }
  if (!yardM && started) pushCart(dt);
  if (started) {
    tip('walk', IS_TOUCH ? 'Left thumb walks, right thumb looks. Step on a glowing pad to set one off.' : 'Walk with W A S D and look with the mouse. Step on a glowing pad to set one off.');
    if (!yardM && Math.hypot(cart.position.x - player.x, cart.position.z - player.z) < 1.3) tip('push', 'You are pushing the cart. It carries whatever you pick with E.');
    // if the first few seconds run slowly, step the graphics down once
    if (!fpsDone && !document.hidden) { const now = performance.now(); if (!fpsT0) fpsT0 = now; fpsN++;
      if (now - fpsT0 > 5000) { fpsDone = true; if (fpsN / 5 < 26 && quality < 3) { setQuality(quality + 1); toast('Running slow, so graphics were lowered<br>Press G to change', 4); } } }
  }
  if (yardM) updateKids(dt);

  // displays
  let near = null, nd = 7.5, scare = 0;
  for (const st of list) {
    const d = Math.hypot(player.x - st.padPos.x, player.z - st.padPos.z);
    if (d < nd) { nd = d; near = st; }
    const onPad = d < .95;
    if (onPad && st.armed && st.t < 0 && started) { trigger(st); st.armed = false; }
    if (!onPad) st.armed = true;
    if (st.t >= 0) { st.t += dt * st.rate; if (st.t > st.api.dur) { st.t = -1; st.rate = 1; } }
    const t = st.t < 0 ? 999 : st.t, act = env(t, 0, .4, st.api.dur - 1, st.api.dur);
    st.api.update(t, dt, time); servo(st, dt, time, act);
    let L = 1.2 + 2.2 * act + (act > 0 ? Math.sin(time * 30) * .25 * act : 0), strobing = st.rate > 1 && st.t >= 0;
    const sw = STROBE[st.def.name]; if (sw && st.t >= 0) for (const [a, b] of sw) if (st.t > a && st.t < b) strobing = true;
    if (strobing) L = Math.sin(time * 75) > 0 ? 9 : .15;
    st.light.intensity = L;
    if (st.cone) st.cone.material.opacity = .006 + .028 * act;
    st.fog.visible = act > .01; if (st.fog.visible) { st.fog.material.opacity = .045 * act; st.fog.rotation.y += dt * .22; }
    if (st.t >= 0) st.padMat.color.setRGB(.2, 1, .2).multiplyScalar(2.2); else st.padMat.color.setRGB(1, .25, .03).multiplyScalar(.9 + .5 * Math.sin(time * 4 + d));
    scare = Math.max(scare, act * (SCARE[st.def.name] || 3) / 5 * clamp(1.5 - d / 14) * (strobing ? 1.25 : 1));
  }
  nearSt = near;
  if (lightBudget) {   // exactly `lightBudget` spotlights stay on (the nearest ones), so the shaders never need rebuilding as you walk
    const all = (yardM ? stations.concat(yardStations) : stations).map(s => [Math.hypot(player.x - s.padPos.x, player.z - s.padPos.z), s]).sort((a, b) => a[0] - b[0]);
    all.forEach(([, s], k) => s.light.visible = k < lightBudget);
  }
  scareLvl += (scare - scareLvl) * Math.min(1, dt * (scare > scareLvl ? 8 : 1.5)); $('scareFill').style.width = (clamp(scareLvl) * 100).toFixed(0) + '%';

  // grand finale pad (store) / front door (yard)
  const fd = Math.hypot(player.x - finale.pos.x, player.z - finale.pos.z);
  if (!yardM) {
    if (finale.unlocked) { finMat.color.setRGB(.2, 1, .2).multiplyScalar(1.3 + .8 * Math.sin(time * 5)); if (fd < 1.5 && finale.armed) { finale.armed = false; grandFinale(); } if (fd > 2) finale.armed = true; }
    if (finale.flash > 0) { finale.flash -= dt; setStore(Math.random() < .12 ? 2.2 : .03); if (finale.flash <= 0) setStore(showMode ? .22 : 1); }
    if (started) { paT -= dt; if (paT < 0) { paT = 55 + Math.random() * 35; intercom(); } }
  } else if (!yardDone && started && player.z < 3.3 && Math.abs(player.x - YX) < 2.4) {
    yardDone = true; for (const [f, t] of [[659, 0], [523, .45]]) tone({ f, t, d: 1.2, type: 'sine', g: .16, pluck: true });
    toast('🍬 TRICK OR TREAT! 🍬<br>You made it past ' + yardScares + ' scare' + (yardScares === 1 ? '' : 's') + '<br>Press Y to go back to the store', 9); speak("Happy Halloween!", 1.3, 1, .9);
  }
  lanternMats.forEach((m, i) => m.emissiveIntensity = .4 + .15 * Math.sin(time * 7 + i * 1.9) * Math.sin(time * 3.1 + i));

  // info card
  const target = started ? (near || (!yardM && fd < 6 ? finale : null)) : null;
  const state = !target ? '' : target.def ? [target.def.name, target.t >= 0, target.found, cartItems.includes(target.def), yardM].join() : 'fin' + finale.unlocked;
  if (state !== cardState) {
    cardState = state; $('card').className = !target || cardOff ? '' : target.def && target.t >= 0 ? 'show mini' : 'show';   // shrinks out of the way while the show plays
    if (target && target.def) {
      const d = target.def; $('cName').textContent = d.name; $('cDoes').textContent = d.does; $('cReal').textContent = 'Scare rating ' + '💀'.repeat(SCARE[d.name] || 3) + '   ·   ' + d.real;
      $('cGo').textContent = fixKeys((target.t >= 0 ? '● ACTIVATED — watch!' : '▶ Step on the glowing pad to activate') + (yardM ? '' : cartItems.includes(d) ? '   ·   🛒 in your cart (E to remove)' : target.found ? '   ·   press E to add to cart' : ''));
    } else if (target) { $('cName').textContent = 'Grand Finale'; $('cDoes').textContent = 'Sets off every animatronic in the aisle at once while the store lights flicker.'; $('cReal').textContent = '';
      $('cGo').textContent = finale.unlocked ? '▶ Step on the pad!' : '🔒 Locked — activate all ' + stations.length + ' animatronics first'; }
  }
}
function frame() { const dt = Math.min(clock.getDelta(), .05); step(dt, clock.elapsedTime); draw(); requestAnimationFrame(frame); }
loadSave(); if (IS_TOUCH && !qSet) setQuality(3, true);   // touch devices start in Tablet graphics unless the player picked another level
updateCount(); frame();
// hold the start button until the models are in, so the game never looks frozen mid-play
const startEl = document.querySelector('#overlay .start'); startEl.textContent = 'LOADING MODELS…';
Promise.race([Promise.all([new Promise(r => (window.MODELS && THREE.GLTFLoader) ? whenModels(r) : r()), loadCustom()]), new Promise(r => setTimeout(r, 40000))])
  .then(() => { window.gameReady = true; startEl.textContent = IS_TOUCH ? 'TAP TO ENTER' : 'CLICK TO ENTER'; });
// debug / test hook
window.sim = { player, stations, trigger, finale, step, render: draw, composer, setStore, cart, cartItems, addToCart, enterYard, leaveYard, get yardStations() { return yardStations; }, get mode() { return mode; }, get nearSt() { return nearSt; }, set nearSt(v) { nearSt = v; } };
