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

// Cross-sections along the car, nose first. Each is half a width, a floor, a
// roof and the two bevels that round the shoulder off. The proportions are a
// 1990 wedge: wide at the waist, low and narrow at the nose, tail cut short.
//        z      hw     yb     yt    bx     by
const BODY = [
  [ 2.02,  0.50,  0.30,  0.48, 0.13, 0.08],
  [ 1.46,  0.80,  0.26,  0.60, 0.20, 0.12],
  [ 0.58,  0.86,  0.26,  0.80, 0.24, 0.14],
  [-0.58,  0.86,  0.26,  0.84, 0.24, 0.14],
  [-1.56,  0.82,  0.30,  0.76, 0.20, 0.12],
  [-2.04,  0.64,  0.38,  0.68, 0.14, 0.09],
];

// The greenhouse, sitting on the body's roof. The first segment's top face is
// the windscreen, the last one's is the rear screen, and the one in between is
// the roof itself -- which is why the glass is chosen per segment and not per
// station.
const CABIN = [
  [ 0.64,  0.70,  0.78,  0.80, 0.14, 0.04],
  [ 0.00,  0.62,  0.78,  1.24, 0.16, 0.10],
  [-0.68,  0.60,  0.78,  1.24, 0.16, 0.10],
  [-1.14,  0.68,  0.78,  0.84, 0.14, 0.04],
];

// Tucked just inside the widest part of the body: a wheel standing proud of
// its own bodywork is a go-kart, not a car.
const WHEEL = { x: 0.76, y: 0.33, r: 0.33, half: 0.115, sides: 10 };
const AXLES = [1.30, -1.30];

// Edge numbering used by loft() and by the colour callbacks below: 0 floor,
// 1 right flank, 2 right shoulder, 3 roof, 4 left shoulder, 5 left flank.
const FLOOR = 0, ROOF = 3;
const FLANKS = [1, 5], SHOULDERS = [2, 4];

// The outline of one cross-section, counter-clockwise seen from the nose.
function station([z, hw, yb, yt, bx, by]) {
  return [
    [-hw, yb, z], [hw, yb, z],
    [hw, yt - by, z], [hw - bx, yt, z],
    [-hw + bx, yt, z], [-hw, yt - by, z],
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
    for (let e = 0; e < 6; e++) {
      const col = colFor(e, i);
      if (!col) continue;
      const f = (e + 1) % 6;
      shell(m, A[e], A[f], B[f], B[e], col, inside);
    }
  }
  return rings;
}

// Closes an end of a loft: a hexagon, as two quads rather than a fan, because
// a fan of six triangles all with the same normal is five triangles wasted.
function cap(m, ring, col, inside) {
  shell(m, ring[0], ring[1], ring[2], ring[3], col, inside);
  shell(m, ring[0], ring[3], ring[4], ring[5], col, inside);
}

// A wheel, as a prism lying on its side. The tread is what catches the light
// from underneath and the hub face is what says which way is out, so the two
// are different colours even on a car painted one colour all over.
function wheel(m, cx, z, tyre, hubCol, disc) {
  const { y, r, half, sides } = WHEEL;
  const sx = Math.sign(cx);
  const ring = a => [Math.cos(a) * r, Math.sin(a) * r];
  for (let i = 0; i < sides; i++) {
    const a0 = i / sides * Math.PI * 2, a1 = (i + 1) / sides * Math.PI * 2;
    const [y0, z0] = ring(a0), [y1, z1] = ring(a1);
    // Tread. The outward normal is radial, and comes out of the winding here
    // without help: the strip runs around the wheel the same way every time.
    const p = [
      [cx - sx * half, y + y0, z + z0], [cx + sx * half, y + y0, z + z0],
      [cx + sx * half, y + y1, z + z1], [cx - sx * half, y + y1, z + z1],
    ];
    shell(m, p[0], p[1], p[2], p[3], tyre, [cx, y, z]);
    // Outer face: a rim of tyre wall and then the hub itself, so the wheel has
    // something in it rather than being a flat disc of one colour.
    const ox = cx + sx * (half + 0.005);
    const inner = 0.56;
    m.quad([ox, y + y0, z + z0], [ox, y + y1, z + z1],
           [ox, y + y1 * inner, z + z1 * inner], [ox, y + y0 * inner, z + z0 * inner],
           hubCol, [sx, 0, 0]);
    m.tri([ox, y, z], [ox, y + y0 * inner, z + z0 * inner],
          [ox, y + y1 * inner, z + z1 * inner], disc, [sx, 0, 0]);
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
      hub: shade(accent, 0.62), disc: shade(accent, 0.9),
      dark: shade(accent, 0.42), lamp: shade(accent, 1.3), tail: shade(accent, 1.1),
    };
  }
  return {
    body, roof: body, glass: hex('#3a5570'), accent,
    tyre: hex('#22262c'), hub: hex('#3a4048'), disc: shade(rim, 1.1),
    dark: hex('#2b3038'), lamp: hex('#e8eef5'), tail: hex('#c4423b'),
  };
}

export function buildCarMesh(theme = {}, { ghost = false } = {}) {
  const P = palette(theme, ghost);
  const m = new MeshData();
  const inside = [0, 0.62, 0];

  // Body. The floor is drawn too: a car gets airborne here, and the underside
  // is the first thing anybody watching a replay of a jump sees.
  const bodyRings = loft(m, BODY, (e) => {
    if (e === ROOF) return P.body;
    if (SHOULDERS.includes(e)) return shade(P.body, 1.04);
    if (FLANKS.includes(e)) return P.body;
    return P.dark;                                   // floor
  }, inside);
  cap(m, bodyRings[0], shade(P.body, 0.9), inside);                    // nose
  cap(m, bodyRings[bodyRings.length - 1], shade(P.body, 0.86), inside); // tail

  // Greenhouse. Glass everywhere except the roof panel between the two screens.
  loft(m, CABIN, (e, seg) => {
    if (e === FLOOR) return null;                    // sits on the body
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

  // Lamps, sunk into the nose and the tail rather than stuck on.
  for (const sx of [-1, 1]) slab(m, sx * 0.38, 0.555, 1.66, 0.14, 0.022, 0.10, P.lamp);
  slab(m, 0, 0.58, -2.03, 0.46, 0.05, 0.03, P.tail);

  // Wing, on two posts and between two end plates, and the splitter under the
  // nose. Both are what a wedge from this decade had instead of bodywork that
  // made downforce by itself.
  slab(m, 0, 1.00, -1.86, 0.60, 0.030, 0.19, P.dark);
  for (const sx of [-1, 1]) {
    slab(m, sx * 0.60, 0.95, -1.86, 0.022, 0.085, 0.19, P.dark);   // end plate
    slab(m, sx * 0.32, 0.88, -1.86, 0.035, 0.13, 0.04, P.dark);    // post
  }
  slab(m, 0, 0.27, 1.94, 0.58, 0.032, 0.13, P.dark);

  // Sills, mirrors and exhausts. The sill matters more than it sounds: it runs
  // the eye from one wheel to the other and hides the seam where the wheels
  // meet the bodywork, which is the join a flat-shaded car has no way to hide.
  for (const sx of [-1, 1]) {
    slab(m, sx * 0.855, 0.33, -0.10, 0.028, 0.085, 1.12, P.dark);
    slab(m, sx * 0.88, 0.90, 0.44, 0.07, 0.038, 0.06, P.dark);
    slab(m, sx * 0.28, 0.42, -2.08, 0.075, 0.05, 0.05, P.hub);
    for (const z of AXLES) wheel(m, sx * WHEEL.x, z, P.tyre, P.hub, P.disc);
  }
  return m;
}
