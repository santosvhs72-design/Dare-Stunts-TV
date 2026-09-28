// The car, seen from outside: the ghost you race against and the replay of the
// lap you just drove.
//
// It used to be eight axis-aligned boxes, and looked it. The problem with boxes
// is not the polygon count -- a car this size is nothing next to a kilometre of
// road -- it is that a box has no taper and no shoulder, so every one of its
// faces is turned exactly as one of the world's own faces, and the whole thing
// reads as luggage. A car is a shape that narrows towards both ends and rolls
// over at the top, and the light is what says so.
//
// So the body is lofted: a handful of cross-sections along its length, each a
// six-sided outline with a bevelled shoulder, joined face by face. Nothing here
// is curved, in keeping with the rest of the world -- but the faces point in
// enough different directions that the same shader that lights the track picks
// out a nose, a flank and a roof without being told which is which.
import { MeshData, hex, shade } from '../core/mesh.js';
import { v3 } from '../core/math.js';

// Cross-sections along the car, nose first: half a width at the waist, a floor,
// a roof, the two bevels that round the shoulder off, and the height of the
// waist itself. The proportions are a 1990 wedge -- low and narrow at the nose,
// tail cut short -- with a station either side of each axle so the body swells
// into a haunch over the wheel and pulls back in between. That swelling is what
// a wheel arch is. Without it the wheels were wider than the bodywork they were
// supposed to be under, and the car read as four tyres with a wedge balanced on
// top of them.
//        z      hw     yb     yt    bx     by    yw
const BODY = [
  [ 2.02,  0.52,  0.26,  0.48, 0.14, 0.07, 0.38],
  [ 1.62,  0.84,  0.22,  0.58, 0.18, 0.10, 0.40],   // arch opens
  [ 1.30,  0.90,  0.22,  0.63, 0.20, 0.11, 0.43],   // haunch, front axle
  [ 0.98,  0.86,  0.22,  0.70, 0.22, 0.12, 0.42],   // arch closes
  [ 0.50,  0.78,  0.22,  0.80, 0.24, 0.14, 0.42],   // waist
  [-0.40,  0.78,  0.22,  0.84, 0.24, 0.14, 0.43],
  [-0.96,  0.86,  0.22,  0.82, 0.22, 0.12, 0.44],
  [-1.30,  0.92,  0.23,  0.78, 0.20, 0.11, 0.45],   // haunch, rear axle
  [-1.64,  0.86,  0.24,  0.74, 0.18, 0.10, 0.44],
  [-2.04,  0.66,  0.34,  0.68, 0.14, 0.09, 0.48],
];

// The greenhouse, sitting on the body's roof. The first segment's top face is
// the windscreen, the last one's is the rear screen, and the one in between is
// the roof itself -- which is why the glass is chosen per segment and not per
// station.
const CABIN = [
  [ 0.64,  0.70,  0.78,  0.84, 0.14, 0.04, 0.83],
  [ 0.00,  0.64,  0.78,  1.24, 0.16, 0.10, 0.88],
  [-0.68,  0.62,  0.78,  1.24, 0.16, 0.10, 0.88],
  [-1.14,  0.70,  0.78,  0.86, 0.14, 0.04, 0.85],
];

// Tucked just inside the widest part of the body: a wheel standing proud of
// its own bodywork is a go-kart, not a car.
const WHEEL = { x: 0.71, y: 0.33, r: 0.33, half: 0.11, sides: 10 };
const AXLES = [1.30, -1.30];

// How far in the floor is pulled from the waist. A rocker that leans inwards
// as it goes down turns its own face towards the ground, which is enough for
// the same shader to shade it darker than the flank above it -- and a car with
// a light upper body over a dark lower one is a car, where a slab of one colour
// from roof to road is a brick.
const TUCK = 0.86;

// Edge numbering used by loft() and by the colour callbacks below, going round
// a section counter-clockwise from the floor: 0 floor, 1 right rocker, 2 right
// flank, 3 right shoulder, 4 roof, 5 left shoulder, 6 left flank, 7 left rocker.
const SIDES = 8;
const FLOOR = 0, ROOF = 4;
const ROCKERS = [1, 7], FLANKS = [2, 6], SHOULDERS = [3, 5];

// The outline of one cross-section, counter-clockwise seen from the nose.
function station([z, hw, yb, yt, bx, by, yw]) {
  const fb = hw * TUCK;
  return [
    [-fb, yb, z], [fb, yb, z],
    [hw, yw, z], [hw, yt - by, z], [hw - bx, yt, z],
    [-hw + bx, yt, z], [-hw, yt - by, z], [-hw, yw, z],
  ];
}

// A quad with its normal turned to point away from the middle of the car, so
// that the order the corners happen to be listed in cannot quietly light a
// flank as if it faced inwards.
function shell(m, a, b, c, d, col, inside) {
  const mid = [(a[0] + b[0] + c[0] + d[0]) / 4,
               (a[1] + b[1] + c[1] + d[1]) / 4,
               (a[2] + b[2] + c[2] + d[2]) / 4];
  const n = v3.cross(v3.sub(b, a), v3.sub(d, a));
  if (v3.dot(n, v3.sub(mid, inside)) < 0) m.quad(d, c, b, a, col);
  else m.quad(a, b, c, d, col);
}

// Joins consecutive cross-sections face by face. `colFor(edge, segment)`
// returns the colour of one strip, or null to leave it out -- which is how the
// cabin's floor is skipped, since it is buried in the body it stands on.
function loft(m, sections, colFor, inside) {
  const rings = sections.map(station);
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let e = 0; e < SIDES; e++) {
      const col = colFor(e, i);
      if (!col) continue;
      const f = (e + 1) % SIDES;
      shell(m, A[e], A[f], B[f], B[e], col, inside);
    }
  }
  return rings;
}

// Closes an end of a loft: an octagon, as three quads rather than a fan,
// because a fan of triangles all sharing one normal is triangles wasted.
function cap(m, ring, col, inside) {
  shell(m, ring[0], ring[1], ring[2], ring[3], col, inside);
  shell(m, ring[0], ring[3], ring[4], ring[7], col, inside);
  shell(m, ring[4], ring[5], ring[6], ring[7], col, inside);
}

// A wheel, as a prism lying on its side with something in the middle of it.
//
// A dark disc with a paler dot in it reads as a wheel at fifty metres and as
// nothing at all at five, and five is where the replay watches from. So the
// face is built in three rings -- tyre wall, rim, hub -- and the rim ring
// alternates its colour segment by segment. Ten segments alternating is five
// spokes, for no triangles beyond the ones the ring already needed.
function wheel(m, cx, z, P) {
  const { y, r, half, sides } = WHEEL;
  const sx = Math.sign(cx);
  const WALL = 0.74, RIM = 0.34;      // where the tyre ends and the hub begins
  const ring = a => [Math.cos(a) * r, Math.sin(a) * r];
  const ox = cx + sx * (half + 0.004);
  const at = (f, y0, z0) => [ox, y + y0 * f, z + z0 * f];
  for (let i = 0; i < sides; i++) {
    const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
    const [y0, z0] = ring(a0), [y1, z1] = ring(a1);
    // Tread. Its outward normal is radial, and comes out of the winding here
    // without help: the strip runs around the wheel the same way every time.
    shell(m, [cx - sx * half, y + y0, z + z0], [cx + sx * half, y + y0, z + z0],
          [cx + sx * half, y + y1, z + z1], [cx - sx * half, y + y1, z + z1],
          P.tyre, [cx, y, z]);
    const n = [sx, 0, 0];
    m.quad(at(1, y0, z0), at(1, y1, z1), at(WALL, y1, z1), at(WALL, y0, z0), P.tyre, n);
    m.quad(at(WALL, y0, z0), at(WALL, y1, z1), at(RIM, y1, z1), at(RIM, y0, z0),
           i % 2 ? P.hub : P.disc, n);
    m.tri([ox, y, z], at(RIM, y0, z0), at(RIM, y1, z1), P.spoke, n);
  }
}

// An axis-aligned slab, for the parts that really are slabs: the wing, the
// splitter, the mirrors, the lamps.
const slab = (m, x, y, z, sx, sy, sz, col) => m.box(x, y, z, sx, sy, sz, col);

// The paint. A ghost is one colour throughout -- it is somebody else's lap, and
// the point of it is to be read at a glance as not-your-car -- so every tone it
// uses is a shade of the same hue. The replay is your own car, and gets the
// whole theme.
function palette(theme, ghost) {
  const body = hex(theme.body || '#a8843c');
  const accent = hex(theme.accent || '#ffb43a');
  const rim = hex(theme.rim || '#5b626d');
  if (ghost) {
    return {
      body: accent, roof: shade(accent, 0.82), glass: shade(accent, 0.55),
      accent: shade(accent, 1.25), tyre: shade(accent, 0.34),
      hub: shade(accent, 0.62), disc: shade(accent, 0.9), spoke: shade(accent, 1.1),
      rocker: shade(accent, 0.6), trim: shade(accent, 0.48),
      dark: shade(accent, 0.42), lamp: shade(accent, 1.3), tail: shade(accent, 1.1),
    };
  }
  return {
    body, roof: body, glass: hex('#3a5570'), accent,
    tyre: hex('#1d2126'), hub: hex('#343a42'), disc: shade(rim, 1.25),
    spoke: shade(rim, 1.5), rocker: shade(body, 0.52), trim: hex('#262b33'),
    dark: hex('#2b3038'), lamp: hex('#e8eef5'), tail: hex('#c4423b'),
  };
}

export function buildCarMesh(theme = {}, { ghost = false } = {}) {
  const P = palette(theme, ghost);
  const m = new MeshData();
  const inside = [0, 0.62, 0];

  // Body. The floor is drawn too: a car gets airborne here, and the underside
  // is the first thing anybody watching a replay of a jump sees.
  const bodyRings = loft(m, BODY, (e, seg) => {
    if (e === ROOF) return P.body;
    if (SHOULDERS.includes(e)) return shade(P.body, 1.04);
    if (FLANKS.includes(e)) return P.body;
    // The rocker is painted darker as well as turned downwards: between the
    // two, the bottom third of the car reads as a separate piece of it, and
    // the wheels stop looking like they are hanging off a slab. The one place
    // it is left in body colour is the tail, where there is no wheel under it
    // and a dark band would only look like a shadow that missed.
    if (ROCKERS.includes(e)) return seg >= BODY.length - 2 ? P.body : P.rocker;
    return P.dark;                                   // floor
  }, inside);
  cap(m, bodyRings[0], shade(P.body, 0.9), inside);                    // nose
  cap(m, bodyRings[bodyRings.length - 1], shade(P.body, 0.86), inside); // tail

  // Greenhouse. Glass everywhere except the roof panel between the two screens
  // -- and a dark band running round the bottom of it, which is what stops the
  // whole cabin reading as one lump set on the deck: glass sits *in* something,
  // and this is the something.
  loft(m, CABIN, (e, seg) => {
    if (e === FLOOR) return null;                    // sits on the body
    if (ROCKERS.includes(e)) return P.trim;          // belt line under the glass
    if (e === ROOF) return seg === 1 ? P.roof : P.glass;
    if (SHOULDERS.includes(e)) return seg === 1 ? P.roof : P.glass;
    return P.glass;                                  // side windows
  }, [0, 0.95, -0.2]);

  // A stripe over the nose and the roof. Two quads, and the single cheapest
  // thing that turns a shape into a car somebody built to race.
  const stripe = (z0, z1, y0, y1, w) => m.quad(
    [-w, y0, z0], [w, y0, z0], [w, y1, z1], [-w, y1, z1], P.accent);
  stripe(1.94, 0.62, 0.50, 0.815, 0.14);             // over the bonnet
  stripe(0.00, -0.66, 1.255, 1.255, 0.13);           // over the roof

  // Lamps, sunk into the nose and the tail rather than stuck on. The tail bar
  // is what tells one end from the other at the distance the replay watches
  // from, so it runs most of the width rather than being a token.
  for (const sx of [-1, 1]) {
    slab(m, sx * 0.38, 0.555, 1.66, 0.14, 0.022, 0.10, P.lamp);
    slab(m, sx * 0.42, 0.57, -2.03, 0.16, 0.045, 0.03, P.tail);
  }
  slab(m, 0, 0.57, -2.03, 0.20, 0.028, 0.025, shade(P.tail, 0.7));

  // A diffuser under the tail, and an intake in each flank. Neither does
  // anything; both are the shapes a car of this shape had, and between them
  // they stop the back half being one uninterrupted panel.
  slab(m, 0, 0.31, -1.90, 0.58, 0.035, 0.15, P.dark);
  for (const fx of [-0.42, 0, 0.42]) slab(m, fx, 0.33, -1.90, 0.022, 0.07, 0.15, P.trim);
  for (const sx of [-1, 1]) {
    const x = sx * 0.806;
    m.quad([x, 0.50, -0.55], [x, 0.50, -0.92], [x, 0.69, -0.92], [x, 0.69, -0.55],
           P.trim, [sx, 0, 0]);
  }

  // Wing, on two posts and between two end plates, and the splitter under the
  // nose. Both are what a wedge from this decade had instead of bodywork that
  // made downforce by itself.
  slab(m, 0, 0.97, -1.84, 0.62, 0.032, 0.19, P.dark);
  for (const sx of [-1, 1]) {
    slab(m, sx * 0.62, 0.92, -1.84, 0.024, 0.085, 0.19, P.dark);   // end plate
    slab(m, sx * 0.34, 0.86, -1.84, 0.05, 0.12, 0.045, P.trim);    // post
  }
  slab(m, 0, 0.27, 1.94, 0.58, 0.032, 0.13, P.dark);

  // Sills, mirrors and exhausts. The sill matters more than it sounds: it runs
  // the eye from one wheel to the other and hides the seam where the wheels
  // meet the bodywork, which is the join a flat-shaded car has no way to hide.
  for (const sx of [-1, 1]) {
    slab(m, sx * 0.80, 0.27, -0.10, 0.03, 0.075, 0.95, P.trim);
    slab(m, sx * 0.88, 0.90, 0.44, 0.07, 0.038, 0.06, P.dark);
    slab(m, sx * 0.28, 0.42, -2.08, 0.075, 0.05, 0.05, P.hub);
    for (const z of AXLES) wheel(m, sx * WHEEL.x, z, P);
  }
  return m;
}
