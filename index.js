import * as THREE from "three";
import getLayer from "./getLayer.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
// added imports for postprocessing bloom
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";


const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 5;
// make canvas transparent
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(w, h);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.7;
// ensure clear color is fully transparent
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);
// ensure page background is transparent
document.documentElement.style.background = 'transparent';
document.body.style.background = 'transparent';

// enable shadows and use a soft shadow algorithm
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const ctrls = new OrbitControls(camera, renderer.domElement);
ctrls.enableDamping = true;

// use Vite to resolve the glb URL
// import AstronautUrl from './assets/Astronaut.glb?url';
const gltfLoader = new GLTFLoader();
// import ChinatownUrl from './assets/chinatown.glb?url';
// const chinatownGlb = await gltfLoader.loadAsync(ChinatownUrl);
const bellPayphoneGlb = await gltfLoader.loadAsync(
  `${import.meta.env.BASE_URL}Day 11 - Bell Payphone.glb`
);
const bellPayphone = bellPayphoneGlb.scene;

bellPayphone.traverse((child) => {
  if (child.isMesh) {
    child.castShadow = true;
    child.receiveShadow = true;
  }
});

// ensure world matrices are correct before measuring
bellPayphone.updateMatrixWorld(true);

// compute bounds and scale so the model's largest dimension equals `targetSize`
let box = new THREE.Box3().setFromObject(bellPayphone);
const size = box.getSize(new THREE.Vector3());
const maxDim = Math.max(size.x, size.y, size.z);
const targetSize = 4; // world units you want the model to fit in
if (maxDim > 0) {
  const scale = targetSize / maxDim;
  bellPayphone.scale.setScalar(scale);
  bellPayphone.updateMatrixWorld(true); // update after scaling
}

// recompute bounds and get center
box = new THREE.Box3().setFromObject(bellPayphone);
const center = box.getCenter(new THREE.Vector3());

// create a pivot at the world origin and add the model offset so its center is at pivot
const pivot = new THREE.Group();
scene.add(pivot);
bellPayphone.position.sub(center); // move model so its center is at (0,0,0) relative to pivot
pivot.add(bellPayphone);

// start rotated 270 degrees around Y
pivot.rotation.y = 3 * Math.PI / 2.2; // 270deg
pivot.rotation.x = 0.15;
// bounce setup: 180° total (min = 270° - 180° = 90°, max = 270°)
const clock = new THREE.Clock();
const rotationSpeed = 0.3; // radians per second (~0.005 per frame at 60fps)
const startAngle = pivot.rotation.y; // 270deg
const fullRange = 0.8 * Math.PI; // 180° in radians
const minAngle = startAngle - fullRange; // 90deg
const maxAngle = startAngle; // 270deg
let rotationDirection = -1; // start moving away from 270° in the same direction as before

// update controls target to the pivot center
ctrls.target.set(0, 0, 0);
ctrls.update();

// stop / resume auto-rotation on pointer press/release
let isRotating = true;
const canvas = renderer.domElement;

// stop rotation while pointer is down on the canvas
canvas.addEventListener('pointerdown', () => {
  isRotating = false;
}, { passive: true });

// resume rotation when pointer is released
canvas.addEventListener('pointerup', () => {
  isRotating = true;
}, { passive: true });

// handle cancel/leave to ensure rotation resumes
canvas.addEventListener('pointercancel', () => { isRotating = true; }, { passive: true });
canvas.addEventListener('pointerout', () => { isRotating = true; }, { passive: true });
canvas.addEventListener('pointerleave', () => { isRotating = true; }, { passive: true });

const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshStandardMaterial({
  color: 0xffff00,
});
const cube = new THREE.Mesh(geometry, material);
// scene.add(cube);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x666666, 1);
scene.add(hemiLight);
// add ambient fill light (no directional light)
const ambient = new THREE.AmbientLight(0xffffff, 1);
// scene.add(ambient);

// Natural key light that casts shadows
const keyLight = new THREE.DirectionalLight(0xfff3ea, 1.0); // warm key
keyLight.position.set(5, 8, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 30;
const d = 8;
keyLight.shadow.camera.left = -d;
keyLight.shadow.camera.right = d;
keyLight.shadow.camera.top = d;
keyLight.shadow.camera.bottom = -d;
// soften shadow edges (works with PCFSoftShadowMap)
keyLight.shadow.radius = 6;
scene.add(keyLight);
// ensure the light targets the model pivot so shadows are oriented to the object
keyLight.target = pivot;
scene.add(keyLight.target);

// subtle fill from opposite side so shadows remain soft and natural
const fillLight = new THREE.DirectionalLight(0x88aaff, 0.25);
fillLight.position.set(-4, 3, -3);
scene.add(fillLight);

// ground / contact shadow receiver positioned just under the model
// use existing `box` from earlier to find model bottom; fall back to -2
const groundY = (typeof box !== "undefined" && box.min) ? box.min.y - 0.01 : -2;
const groundGeo = new THREE.PlaneGeometry(40, 40);
const groundMat = new THREE.ShadowMaterial({ opacity: 0.4 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = groundY;
ground.receiveShadow = true;
scene.add(ground);

// Sprites BG
// const gradientBackground = getLayer({
//   hue: 0.5,
//   numSprites: 8,
//   opacity: 0.2,
//   radius: 10,
//   size: 24,
//   z: -15.5,
// });
// scene.add(gradientBackground);

// Setup postprocessing composer with a slight bloom
const composer = new EffectComposer(renderer);
composer.setSize(w, h);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// tweak these for a subtle effect
const bloomStrength = 0.19;
const bloomRadius = 0.4;
const bloomThreshold = 0.35;
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), bloomStrength, bloomRadius, bloomThreshold);
composer.addPass(bloomPass);

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // bounce between minAngle and maxAngle when allowed
  if (isRotating) {
    pivot.rotation.y += rotationDirection * rotationSpeed * delta;

    if (pivot.rotation.y <= minAngle) {
      pivot.rotation.y = minAngle;
      rotationDirection = 1;
    } else if (pivot.rotation.y >= maxAngle) {
      pivot.rotation.y = maxAngle;
      rotationDirection = -1;
    }
  }

  // update controls (damping) before render
  ctrls.update();
  // render using composer to apply bloom
  composer.render(delta);
}

animate();

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  // keep composer in sync
  composer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', handleWindowResize, false);