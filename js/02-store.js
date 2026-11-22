"use strict";
/* ================= scene: big-box store aisle ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x020203);
scene.fog = new THREE.FogExp2(0x06060a, .008);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .1, 300);
camera.rotation.order = 'YXZ';

// store lighting: skylight-ish fill + one shadow-casting "high bay" key light
const hemi = new THREE.HemisphereLight(0xe6ecff, 0x40382e, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dc, 1); sun.position.set(0, 30, 7); sun.target.position.set(0, 0, -3); scene.add(sun, sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 4096);
{ const c = sun.shadow.camera; c.left = -19; c.right = 19; c.top = 56; c.bottom = -56; c.near = 1; c.far = 60; sun.shadow.bias = -.0004; sun.shadow.normalBias = .04; }
const bayMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
let storeLevel = .22, showMode = true;
function setStore(l) { storeLevel = l; hemi.intensity = .85 * l; sun.intensity = 1.5 * l; bayMat.color.setRGB(1, .96, .88).multiplyScalar(.25 + 3.2 * l); }

// polished concrete floor
{ const c = document.createElement('canvas'); c.width = c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = '#8b8882'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) { const g = 110 + Math.random() * 50; x.fillStyle = `rgba(${g},${g},${g - 4},.07)`; x.beginPath(); x.ellipse(Math.random() * 1024, Math.random() * 1024, 30 + Math.random() * 140, 20 + Math.random() * 90, Math.random() * 3, 0, 7); x.fill(); }
  for (let i = 0; i < 9000; i++) { const g = Math.random() < .5 ? 60 : 190; x.fillStyle = `rgba(${g},${g},${g},${.05 + Math.random() * .12})`; x.fillRect(Math.random() * 1024, Math.random() * 1024, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  x.strokeStyle = 'rgba(40,40,40,.55)'; x.lineWidth = 3; x.strokeRect(0, 0, 1024, 1024);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 22); t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 104), M(0xffffff, { map: t, roughness: .32, bumpMap: null, envMapIntensity: .9 }));
  floor.rotation.x = -PI / 2; floor.position.z = -3; floor.receiveShadow = true; scene.add(floor);
  const tape = M(0xe2c200, { roughness: .6, bumpMap: null });
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(.1, 96), tape); l.rotation.x = -PI / 2; l.position.set(s * 3.3, .004, -3); l.receiveShadow = true; scene.add(l); } }
// walls, ceiling, trusses, high-bay lights
{ const wall = M(0x77726a, { roughness: .95 }), steelM = M(0x4a4e55, { roughness: .6, metalness: .5, bumpMap: null }), orange = M(0xe8590c, { roughness: .55, bumpMap: null });
  for (const s of [-1, 1]) box(.3, 11, 104, wall, scene, s * 18, 5.5, -3);
  box(36, 11, .3, wall, scene, 0, 5.5, -55); box(36, 11, .3, wall, scene, 0, 5.5, 48);
  box(36, 1.3, .34, orange, scene, 0, 8.6, -54.9); box(36, 1.3, .34, orange, scene, 0, 8.6, 47.9);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(36, 104), M(0x24262a, { roughness: 1 })); ceil.rotation.x = PI / 2; ceil.position.set(0, 11, -3); scene.add(ceil);
  const d = new THREE.Object3D();
  const truss = new THREE.InstancedMesh(new THREE.BoxGeometry(36, .45, .16), steelM, 27), bays = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, .07, .45), bayMat, 42);
  for (let k = 0; k < 27; k++) { d.position.set(0, 10.5 - (k % 2) * .5, -55 + k * 4); d.updateMatrix(); truss.setMatrixAt(k, d.matrix); }
  let n = 0; for (let k = 0; k < 14; k++) for (const x of [-9, 0, 9]) { d.position.set(x, 9.7, -53 + k * 7.5); d.updateMatrix(); bays.setMatrixAt(n++, d.matrix); }
  scene.add(truss, bays);
  // show-lighting pipes over both sides of the aisle
  const black = M(0x0b0b0c, { roughness: .4, metalness: .7, bumpMap: null });
  for (const s of [-1, 1]) { const p = cyl(.05, .05, 100, black, scene, s * 5.5, 6.9, -3, 8); p.rotation.x = PI / 2; for (let z = -48; z <= 42; z += 10) cyl(.015, .015, 3.4, black, scene, s * 5.5, 8.6, z, 4); } }
// pallet racking loaded with boxes behind the displays
{ let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const orange = M(0xe8590c, { roughness: .5, metalness: .2, bumpMap: null }), deck = M(0x8a8d92, { roughness: .5, metalness: .6, bumpMap: null });
  const d = new THREE.Object3D(), col = new THREE.Color();
  const ups = new THREE.InstancedMesh(new THREE.BoxGeometry(.1, 8.8, .1), orange, 136); let n = 0;
  for (const s of [-1, 1]) for (let k = 0; k < 34; k++) for (const dx of [-.6, .6]) { d.position.set(s * 15.5 + dx, 4.4, -53 + k * 3); d.updateMatrix(); ups.setMatrixAt(n++, d.matrix); }
  scene.add(ups);
  for (const s of [-1, 1]) for (const y of [2.2, 4.4, 6.6]) { for (const dx of [-.6, .6]) box(.07, .14, 99, orange, scene, s * 15.5 + dx, y, -3.5); box(1.25, .04, 99, deck, scene, s * 15.5, y + .09, -3.5); }
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M(0xffffff, { roughness: .92, bumpMap: null }), 1000); n = 0;
  const brand = [0x16161a, 0xe8590c, 0x55278a, 0x2a6a2a, 0x8a1818];
  for (const s of [-1, 1]) for (let k = 0; k < 33; k++) for (const y0 of [0, 2.31, 4.51, 6.71]) {
    let cur = .2; const z0 = -53 + k * 3;
    while (n < 1000) { const w = .7 + rnd() * .8; if (cur + w > 2.8) break; const h = Math.min(.5 + rnd() * 1.4, 1.95);
      d.position.set(s * 15.5, y0 + h / 2, z0 + cur + w / 2); d.scale.set(1.05, h, w); d.updateMatrix(); boxes.setMatrixAt(n, d.matrix);
      if (rnd() < .28) col.setHex(brand[Math.floor(rnd() * brand.length)]); else col.setHSL(.075 + rnd() * .02, .42, .36 + rnd() * .14);
      boxes.setColorAt(n++, col.convertSRGBToLinear()); cur += w + .08; } }
  boxes.count = n; boxes.instanceColor.needsUpdate = true; boxes.receiveShadow = true; scene.add(boxes); }
// hanging banners
function litSign(tex, w, h) { tex.anisotropy = 8; return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .35, roughness: .8, side: THREE.DoubleSide })); }
{ const b = litSign(textTex(['HALLOWEEN', 'ANIMATRONICS  ·  AISLE 13  ·  TRY ME!'], 1024, 300, '#120a06', '#ff7a14', 170), 11, 3.2); b.position.set(0, 7.6, 42); scene.add(b);
  const wire = M(0x222222, { bumpMap: null }); for (const x of [-5, 5]) cyl(.012, .012, 1.9, wire, scene, x, 10.1, 42, 4);
  const e = litSign(textTex(['THANK YOU FOR SHOPPING', '...if you make it out'], 1024, 300, '#e8590c', '#ffffff', 120), 14, 4); e.position.set(0, 4.6, -54.7); scene.add(e); }

// decorative pumpkins (placed on the display platforms below)
const lanternMats = [];
function pumpkinProp(parent, x, y, z, ry) {
  const m = M(0xd2600c, { emissive: 0xff5a00, emissiveIntensity: .45, roughness: .5 }); lanternMats.push(m);
  const g = grp(parent, x, y, z); g.rotation.y = ry || 0;
  for (let i = 0; i < 6; i++) { const l = sph(.2, m, g, Math.cos(i / 6 * PI * 2) * .13, .25, Math.sin(i / 6 * PI * 2) * .13); l.scale.y = 1.15; l.castShadow = true; }
  cyl(.03, .05, .14, M(0x2e4a1c), g, 0, .52, 0, 6);
  const face = B(0xffe066); face.color.multiplyScalar(2.5);
  for (const e of [-1, 1]) add(new THREE.Mesh(new THREE.CircleGeometry(.06, 3), face), g, e * .1, .32, .325).rotation.z = PI / 2;
  box(.2, .045, .01, face, g, 0, .19, .325);
}

// reflections: bake the store itself into an environment map
setStore(.7);
{ const pm = new THREE.PMREMGenerator(renderer); scene.position.y = -3; scene.updateMatrixWorld(true);
  scene.environment = pm.fromScene(scene, 0, .1, 200).texture; scene.position.y = 0; scene.updateMatrixWorld(true); pm.dispose(); }
setStore(.22);

// post-processing: HDR render -> bloom -> filmic tone map
let composer = null;
try {
  if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.ShaderPass && renderer.capabilities.isWebGL2) {
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLMultisampleRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, format: THREE.RGBAFormat }); rt.samples = 4;
    composer = new THREE.EffectComposer(renderer, rt);
    composer.addPass(new THREE.RenderPass(scene, camera));
    composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(sz.x, sz.y), .8, .6, 1.0));
    composer.addPass(new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null }, exposure: { value: 1.15 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D tDiffuse; uniform float exposure; varying vec2 vUv;' +
        'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }' +
        'void main(){ vec3 c = aces(texture2D(tDiffuse, vUv).rgb * exposure); c = pow(c, vec3(1.0/2.2));' +
        ' float v = smoothstep(1.2, 0.35, length(vUv - 0.5) * 1.5); gl_FragColor = vec4(c * mix(0.7, 1.0, v), 1.0); }'
    }));
  }
} catch (e) { console.warn('post-processing unavailable', e); composer = null; }
if (!composer) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputEncoding = THREE.sRGBEncoding; }
// plainRender skips the HDR/bloom chain entirely (Tablet graphics mode): far cheaper, and safe on mobile GPUs that lack float render targets
let plainRender = false;
function setPlain(on) {
  if (!composer || on === plainRender) return; plainRender = on;
  renderer.toneMapping = on ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; renderer.outputEncoding = on ? THREE.sRGBEncoding : THREE.LinearEncoding;
  scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
}
function draw() { if (composer && !plainRender) composer.render(); else renderer.render(scene, camera); }
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  if (composer) { const sz = renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setSize(sz.x, sz.y); }
});
addEventListener('keydown', e => { if (e.code === 'KeyL') { showMode = !showMode; setStore(showMode ? .22 : 1); } });

