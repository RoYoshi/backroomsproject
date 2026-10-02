const assert = require('assert');
const path = require('path');
const fs = require('fs');

const policy = require(path.join(__dirname, '..', '..', 'camera_policy.js'));

const EPS = 1e-7;
const maxW = policy.MAX_WORLD_WIDTH;
const maxH = policy.MAX_WORLD_HEIGHT;

function near(a, b, eps = 1e-6) {
  return Math.abs(a - b) <= eps;
}

function checkViewport(w, h, label) {
  const v = policy.visibleWorld(w, h);
  assert(Number.isFinite(v.scale) && v.scale > 0, `${label}: invalid scale`);
  assert(v.width <= maxW + EPS, `${label}: horizontal FOV exceeds canonical (${v.width} > ${maxW})`);
  assert(v.height <= maxH + EPS, `${label}: vertical FOV exceeds canonical (${v.height} > ${maxH})`);
  return v;
}

// Canonical desktop keeps the exact established feel.
const ref = checkViewport(1920, 1080, '1080p');
assert(near(ref.scale, 1.18), `1080p scale changed: ${ref.scale}`);
assert(near(ref.width, maxW) && near(ref.height, maxH), '1080p world view changed');

// Same-aspect resolutions get the same logical gameplay view.
for (const [w, h, label] of [
  [1280, 720, '720p'],
  [2560, 1440, '1440p'],
  [3840, 2160, '4K']
]) {
  const v = checkViewport(w, h, label);
  assert(near(v.width, maxW, 1e-5), `${label}: logical width differs`);
  assert(near(v.height, maxH, 1e-5), `${label}: logical height differs`);
}

// Aspect-ratio changes may crop but never reveal extra world.
for (const [w, h, label] of [
  [2560, 1080, '21:9'],
  [5120, 1440, '32:9'],
  [1280, 1024, '5:4'],
  [1024, 1366, 'portrait'],
  [390, 844, 'phone portrait'],
  [844, 390, 'phone landscape'],
  [900, 600, 'small window']
]) checkViewport(w, h, label);

// Larger same-aspect monitors gain pixels, not world awareness.
const a = policy.visibleWorld(1920, 1080);
const b = policy.visibleWorld(3840, 2160);
assert(near(a.width, b.width, 1e-5) && near(a.height, b.height, 1e-5), '4K gains gameplay FOV');

// The shipped page must load the policy before the application module and
// the application must actually call it in its resize path.
const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const bundle = fs.readFileSync(path.join(root, 'assets', 'index-DKbV5Nv9.js'), 'utf8');
assert(html.indexOf('./camera_policy.js') >= 0, 'camera policy script missing from index.html');
assert(html.indexOf('./camera_policy.js') < html.indexOf('./assets/index-DKbV5Nv9.js'), 'camera policy must load before app module');
assert(bundle.includes('__cameraPolicy.baseScale(innerWidth,innerHeight)'), 'renderer resize path is not using fair camera policy');

console.log('CAMERA FAIRNESS: 12/12 PASS');
console.log(`Canonical world view: ${maxW.toFixed(3)} x ${maxH.toFixed(3)} units`);
