"use strict";
/* ================= stations ================= */
const DEFS = [
  { name: 'Gourd Ghoul', build: buildPumpkin, light: 0xff7a1a, side: -1, z: 24,
    does: 'Bends at the waist and lunges at you three times while its carved face flickers.',
    real: 'Inspired by: pumpkin-headed lunging stalkers — a pop-up Halloween store staple year after year.' },
  { name: 'Cranky the Clown', build: buildJack, light: 0xc060ff, side: 1, z: 24,
    does: 'The crank turns, the music box plays... then POP — out springs a cackling clown.',
    real: 'Inspired by: jack-in-the-box and wind-up clowns. Clowns are among the most common animatronic themes every season.' },
  { name: 'Leaping Widow', build: buildSpider, light: 0xff3030, side: -1, z: 12,
    does: 'Sits perfectly still... then leaps straight at whoever steps on the pad.',
    real: 'Inspired by: jumping-spider props — a simple, reliable jump scare that has sold for well over a decade.' },
  { name: 'Grave Grabber', build: buildZombie, light: 0x6fb850, side: 1, z: 12,
    does: 'Claws its way up out of the dirt in front of its tombstone, groaning for brains.',
    real: 'Inspired by: zombie "groundbreaker" props — budget best-sellers because they need no stand.' },
  { name: 'Hagatha & Her Cauldron', build: buildWitch, light: 0x40ff60, side: -1, z: 0,
    does: 'Stirs the bubbling brew, then turns to you and cackles out a spell.',
    real: 'Inspired by: cauldron witches — 2026 lineups added witches that can even answer back when you talk.' },
  { name: 'Lullaby Lily', build: buildDoll, light: 0xff80c0, side: 1, z: 0,
    does: 'Swings to a music-box tune... until her head spins all the way around.',
    real: 'Inspired by: swinging dolls and haunted-child props, fan favorites for their slow, creepy build-up.' },
  { name: 'Moon Howler', build: buildWolf, light: 0x8ab4ff, side: -1, z: -12,
    does: 'Rears back for a long howl at the moon, then snarls and slashes at you.',
    real: 'Inspired by: 7-ft towering werewolves, a big-box store hit since the early 2020s.' },
  { name: 'The Soul Collector', build: buildReaper, light: 0xff2020, side: 1, z: -12,
    does: 'Crouches low, then shoots up to full height and lunges with his scythe.',
    real: 'Inspired by: rising grim reapers — "lunge-and-rise" reapers are some of the most-loved store originals.' },
  { name: 'Big Bones', build: buildSkeleton, light: 0xb0c8ff, side: -1, z: -24,
    does: 'A 12-foot skeleton whose glowing eyes change color as he scans the yard, spots you, and reaches down.',
    real: 'Inspired by: the 12-ft giant yard skeleton — the viral #1 Halloween decoration since 2020, sold out every year.' },
  { name: 'Old Stitchface', build: buildScarecrow, light: 0xffa030, side: 1, z: -24,
    does: 'A 15-foot scarecrow lifts his head, twists on his post and leans over you while his crow flaps.',
    real: 'Inspired by: the 15-ft giant scarecrows that joined the "giants" craze in 2025.' },
  { name: 'Pharaoh Phil', build: buildMummy, light: 0x40d0ff, side: -1, z: -36,
    does: 'An 11-foot mummy wakes, lumbers with both arms out, then leans down over you.',
    real: 'Inspired by: the 11-ft LED mummy that joined the giant lineup in 2026.' },
  { name: 'Snapdragon', build: buildPlant, light: 0xa0ff40, side: 1, z: -36,
    does: 'An 8-foot plant sways on its stalk, then lunges and snaps its jaws three times.',
    real: 'Inspired by: the 8-ft plant monster with motion-triggered head movement, new for 2026.' },
  { name: 'Captain Squawk', build: buildParrot, light: 0xffc040, side: -1, z: 36,
    does: 'Ask a yes-or-no question out loud, then step on the pad. He squawks a different answer each time.',
    real: 'Inspired by: the 2026 undead pirate parrot that answers yes/no questions.' },
  { name: 'The Crawler', build: buildGhost, light: 0xa0c0ff, side: 1, z: 36,
    does: 'Drags herself across the platform toward you, then lifts her head and reaches out.',
    real: 'Inspired by: crawling ghost props that actually move across the ground, a top-reviewed budget pick.' },
  { name: 'Stiltz', build: buildStilt, light: 0xff60d0, side: -1, z: -48,
    does: 'A 10-foot stilt clown waves, honks, then bends all the way down to offer you his balloon... until it pops.',
    real: 'Inspired by: towering clowns — tall, thin and slow-moving, a staple of every season\'s clown lineup.' },
  { name: 'The Last Ride', build: buildHearse, light: 0xb060ff, side: 1, z: -48,
    does: 'The hearse rocks on its wheels, the coffin lid creaks open, and the passenger sits up and waves.',
    real: 'Inspired by: the animated LED hearse set piece from the 2026 big-box lineup.' },
  { name: 'The Graveyard Gang', build: buildGang, light: 0xffe0a0, side: 0, z: -51.6,
    does: 'Five little ghouls wave, march forward, kick, punch and jump in formation, then all drop dead.',
    real: 'These five are real downloaded 3D models with built-in animations (Kenney Graveyard Kit, public domain).' },
];
const stations = [];
const padGeo = new THREE.CircleGeometry(.9, 40), padTex = textTex(['STEP', 'HERE'], 256, 256, '#ffffff', '#1a0a00', 92);
const PRICES = { 'Gourd Ghoul': 199, 'Cranky the Clown': 179, 'Leaping Widow': 149, 'Grave Grabber': 99, 'Hagatha & Her Cauldron': 249, 'Lullaby Lily': 169, 'Moon Howler': 279, 'The Soul Collector': 229, 'Big Bones': 299, 'Old Stitchface': 349,
  'Pharaoh Phil': 299, 'Snapdragon': 249, 'Captain Squawk': 129, 'The Crawler': 89, 'Stiltz': 329, 'The Last Ride': 279, 'The Graveyard Gang': 149 };
function signTex(name, price) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 352; const x = c.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 512, 352); x.fillStyle = '#e8590c'; x.fillRect(0, 0, 512, 64); x.fillStyle = '#111'; x.fillRect(0, 286, 512, 66);
  x.textAlign = 'center'; x.textBaseline = 'middle'; const F = 'Impact, "Arial Black", sans-serif';
  x.fillStyle = '#fff'; x.font = `bold 34px ${F}`; x.fillText('HALLOWEEN ANIMATRONIC', 256, 34);
  let s = 62; x.font = `bold ${s}px ${F}`; while (x.measureText(name).width > 480) { s -= 2; x.font = `bold ${s}px ${F}`; }
  x.fillStyle = '#111'; x.fillText(name, 256, 106);
  x.fillStyle = '#e8590c'; x.font = `bold 118px ${F}`; x.fillText('$' + price, 256, 208);
  x.fillStyle = '#ffd400'; x.font = `bold 36px ${F}`; x.fillText('TRY ME!  STEP ON THE PAD', 256, 320);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}
// soft blob used for the fog-machine haze
const fogTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const SM = { plat: M(0x101012, { roughness: .9 }), trim: M(0xe8590c, { roughness: .5, bumpMap: null }), rubber: M(0x0a0a0a, { roughness: .95 }), hay: M(0xc9a646, { roughness: 1, bumpScale: .05 }),
  fix: M(0x0a0a0b, { roughness: .35, metalness: .7, bumpMap: null }), pole: M(0x9a9da2, { roughness: .35, metalness: .8, bumpMap: null }) };
const DOWN = new THREE.Vector3(0, -1, 0);
// One display: figure + spotlight + foot pad (+ riser, sign and dressing in the store; bare ground in the yard)
function makeStation(def, i, x, z, rotY, yard) {
  const g = grp(scene, x, 0, z); g.rotation.y = rotY; const base = yard ? 0 : .26;
  if (!yard) {
    const plat = box(5.6, .25, 5.2, SM.plat, g, 0, .125, 0); plat.receiveShadow = true; plat.castShadow = true;
    box(5.66, .07, 5.26, SM.trim, g, 0, .035, 0); box(5.62, .03, 5.22, SM.trim, g, 0, .215, 0);
    const bale = box(1.1, .55, .6, SM.hay, g, -2.1, .53, -1.9); bale.rotation.y = .25; bale.castShadow = bale.receiveShadow = true;
    pumpkinProp(g, -2.1, .8, -1.9, .3); pumpkinProp(g, 2.2, .26, 1.9, -.3); pumpkinProp(g, -2.3, .26, 2.0, .2);
    const sign = litSign(signTex(def.name.toUpperCase(), PRICES[def.name] || 199), 1.5, 1.03); sign.material.side = THREE.FrontSide;
    add(sign, g, 3.1, 1.35, 3.0); sign.rotation.y = -.45; sign.rotation.x = -.1; sign.castShadow = true;
    cyl(.025, .025, 1.35, SM.pole, g, 3.1, .68, 2.97, 8).castShadow = true; cyl(.28, .3, .04, SM.pole, g, 3.1, .02, 2.97, 20);
  }
  const fig = grp(g, 0, base, 0), api = def.build(fig);
  const joints = [], sways = [];
  fig.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    if (o.userData.sway) sways.push(o); else if (o.type === 'Group' && o !== fig) joints.push({ o, r: new THREE.Vector3(), rv: new THREE.Vector3(), p: new THREE.Vector3(), pv: new THREE.Vector3(), init: false }); });
  const lc = new THREE.Color(def.light).convertSRGBToLinear();
  const spot = new THREE.SpotLight(lc, 1.3, 18, .52, .65, 1.1); spot.position.set(0, 6.8, 4); spot.target.position.set(0, 1.7, 0); g.add(spot, spot.target);
  let cone = null;
  if (!yard) {
    const can = cyl(.13, .2, .45, SM.fix, g, 0, 6.72, 3.95, 16); can.rotation.x = -.68;
    const lens = add(new THREE.Mesh(new THREE.CircleGeometry(.17, 20), new THREE.MeshBasicMaterial({ color: lc.clone().multiplyScalar(3) })), g, 0, 6.54, 3.8); lens.rotation.x = PI / 2 + .68;
    const dir = new THREE.Vector3(0, 1.4 - 6.6, -4), len = dir.length() + .6; dir.normalize();
    const cg = new THREE.ConeGeometry(2.6, len, 32, 1, true); cg.translate(0, -len / 2, 0);
    cone = add(new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: lc, transparent: true, opacity: .012, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), g, 0, 6.6, 3.85);
    cone.quaternion.setFromUnitVectors(DOWN, dir);
  }
  // fog-machine haze that rolls off the display while it runs
  const fp = []; for (let k = 0; k < 44; k++) fp.push((Math.random() - .5) * 5.2, base + .1 + Math.random() * .55, (Math.random() - .5) * 5);
  const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  const fog = new THREE.Points(fgeo, new THREE.PointsMaterial({ map: fogTex, size: 3.2, transparent: true, opacity: 0, depthWrite: false, color: lc.clone().lerp(new THREE.Color(1, 1, 1), .5) })); fog.visible = false; g.add(fog);
  box(2.1, .035, 2.1, SM.rubber, g, 0, .018, 5).receiveShadow = true; if (!yard) box(.05, .02, 1.4, SM.rubber, g, .3, .01, 3.3);
  const padMat = new THREE.MeshBasicMaterial({ map: padTex });
  const pad = add(new THREE.Mesh(padGeo, padMat), g, 0, .04, 5); pad.rotation.x = -PI / 2;
  g.updateMatrixWorld(true);
  const st = { def, api, g, fig, light: spot, cone, fog, padMat, padPos: pad.getWorldPosition(new THREE.Vector3()), joints, sways, figPos: g.getWorldPosition(new THREE.Vector3()).setY(1.7), t: -1, rate: 1, plays: 0, armed: true, found: false, yard: !!yard, i };
  if (CUSTOM[def.name]) applyCustom(st);
  st.api.update(999, 0, 0); return st;
}
DEFS.forEach((def, i) => stations.push(makeStation(def, i, def.side * 9.5, def.z, def.side ? (def.side < 0 ? PI / 2 : -PI / 2) : 0, false)));
box(3.4, .035, 3.4, SM.rubber, scene, 0, .018, -40).receiveShadow = true;
// grand finale pad
const finale = { pos: new THREE.Vector3(0, 0, -40), unlocked: false, armed: true, flash: 0 };
const finMat = new THREE.MeshBasicMaterial({ map: textTex(['GRAND', 'FINALE'], 256, 256, '#ffffff', '#001a00', 80), color: 0x333333 });
const finPad = add(new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), finMat), scene, 0, .03, -40); finPad.rotation.x = -PI / 2;

/* ================= HUD ================= */
const $ = id => document.getElementById(id);
const dots = DEFS.map(() => $('dots').appendChild(document.createElement('i')));
let toastTimer = 0;
function toast(msg, secs = 3.5) { $('toast').innerHTML = msg; $('toast').style.opacity = 1; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').style.opacity = 0, secs * 1000); }
// how scary each one is (1-5 skulls) and when its show light strobes
const SCARE = { 'Gourd Ghoul': 3, 'Cranky the Clown': 4, 'Leaping Widow': 5, 'Grave Grabber': 3, 'Hagatha & Her Cauldron': 2, 'Lullaby Lily': 4, 'Moon Howler': 4, 'The Soul Collector': 5, 'Big Bones': 3, 'Old Stitchface': 3,
  'Pharaoh Phil': 3, 'Snapdragon': 4, 'Captain Squawk': 1, 'The Crawler': 5, 'Stiltz': 4, 'The Last Ride': 3, 'The Graveyard Gang': 1 };
const STROBE = { 'Leaping Widow': [[.3, 1.5]], 'The Soul Collector': [[.2, 1.6], [4, 5]], 'Cranky the Clown': [[4.05, 5.2]], 'Moon Howler': [[5.2, 7.6]], 'Snapdragon': [[1, 1.5], [3.85, 4.35], [6.7, 7.2]], 'The Crawler': [[4.3, 5.6]], 'Stiltz': [[9, 9.5]] };
let secrets = 0, tsc = 1, yardScares = 0;
function updateCount() { const n = stations.filter(s => s.found).length; $('count').textContent = `Activated: ${n} / ${stations.length}   ·   Secrets: ${secrets} / ${stations.length}`; }
function trigger(st, quiet) {
  if (st.t >= 0) return;
  st.t = 0; st.plays++;
  // SECRET: every third time a figure is set off it malfunctions (fast, glitchy, strobing)
  const glitch = !quiet && st.plays % 3 === 0; st.rate = glitch ? 1.7 : 1;
  if (ctx) { // route this animatronic's sound through a 3D panner at its spot
    if (!st.pan) { try { const p = ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 5; p.rolloffFactor = 1.5; p.setPosition(st.figPos.x, st.figPos.y, st.figPos.z); p.connect(master); st.pan = p; } catch (e) { } }
    sink = st.pan || null;
  }
  tsc = st.rate; st.api.sound(); servoWhine(st.api.dur); tsc = 1; sink = null;
  if (glitch) { toast('⚠ MALFUNCTION ⚠<br>' + st.def.name + ' is glitching!', 3); if (!st.yard && !st.secret) { st.secret = true; secrets++; } }
  if (st.yard) { yardScares++; kidsScare(); }
  else if (!st.found) {
    st.found = true; dots[st.i].className = 'on';
    if (stations.every(s => s.found) && !finale.unlocked) { finale.unlocked = true; if (!quiet) setTimeout(() => toast('ALL ' + stations.length + ' FOUND!<br>Grand Finale pad unlocked at the far end of the aisle'), 2500); }
  }
  updateCount(); save();
  if (!st.yard && !quiet) { const n = stations.filter(s => s.found).length;
    if (n === 1) tip('cart', 'Liked it? Press E to load this one into your cart.'); else if (n === 2) tip('keys', 'P takes a photo. L switches the store lights. G changes graphics quality.'); else if (n >= 4) tip('secret', 'Secret: set the same one off three times.'); }
}
function grandFinale() {
  toast('⚡ GRAND FINALE ⚡', 4); finale.flash = 7;
  stations.forEach((s, i) => setTimeout(() => { s.t = -1; trigger(s, true); }, i * 300));
  for (const t0 of [0, 2.2, 4.6]) { noise({ t: t0, d: 2.4, g: .5, ft: 'lowpass', ff: 1400, ff2: 80, pluck: true }); tone({ f: 60, f2: 28, t: t0, d: 2, g: .4, pluck: true }); }
}

