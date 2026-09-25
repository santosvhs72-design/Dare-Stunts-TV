import { quat, v3, clamp } from '../core/math.js';
import { MeshData, hex, shade } from '../core/mesh.js';
import { expand } from './pieces.js';
import { GROUND_Y } from './scenery.js';

export const DS = 1.0;              // metres between frames
export const ROAD_HALF = 5.6;       // full-grip half-width
export const WALL_U = 6.2;          // barrier face the car bounces off
const CURB_OUT = 6.35;
const CURB_H = 0.22;
const WALL_H = 0.8;
const WALL_OUT = 6.85;
const APRON = 0.75;
const MESH_STEP = 2;
const CHUNK_SEGMENTS = 30;

const COL = {
  asphaltA: hex('#5b6270'), asphaltB: hex('#525966'),
  line: hex('#e2e8ef'), curbA: hex('#c4423b'), curbB: hex('#eceff2'),
  apron: hex('#98a1ac'), pillar: hex('#9aa3ae'), rail: hex('#c3cad3'),
  tunnel: hex('#8b929c'), tunnelRib: hex('#6f767f'), tunnelLight: hex('#fff6e2'),
  portal: hex('#c9d0d8'), portalEdge: hex('#3a4048'),
  gateStart: hex('#4fbf7a'), gateCp: hex('#ffb43a'), gateEnd: hex('#e8ecf1'),
  gateDark: hex('#22262c'), post: hex('#5b636e'),
};

// Walks the piece list, integrating intrinsic rotations to produce surface frames.
function walk(segments) {
  const frames = [];
  const checkpoints = [];
  let q = quat.id();
  let pos = [0, 0, 0];
  let s = 0;

  for (const sg of segments) {
    if (sg.cp) { checkpoints.push(s); continue; }
    const steps = Math.max(1, Math.round(sg.len / DS));
    const ds = sg.len / steps;
    for (let i = 0; i < steps; i++) {
      frames.push({ q, pos, s, bank: sg.bank, gap: sg.gap, pi: sg.pi, tunnel: sg.tunnel, ds });
      // Pitch is nose-up positive, which is a negative rotation about local X.
      if (sg.yaw) q = quat.mul(q, quat.axisAngle([0, 1, 0], sg.yaw * ds));
      if (sg.pitch) q = quat.mul(q, quat.axisAngle([1, 0, 0], -sg.pitch * ds));
      if (sg.roll) q = quat.mul(q, quat.axisAngle([0, 0, 1], sg.roll * ds));
      q = quat.norm(q);
      pos = v3.mad(pos, quat.fwd(q), ds);
      s += ds;
    }
  }
  frames.push({ q, pos, s, bank: 0, gap: false, pi: -1, ds: DS });
  return { frames, checkpoints, length: s };
}

// Box-blur the bank targets so transitions into and out of banking are gradual.
function smoothBank(frames, passes = 3, radius = 9) {
  let bank = frames.map(f => f.bank);
  for (let p = 0; p < passes; p++) {
    const out = new Array(bank.length);
    for (let i = 0; i < bank.length; i++) {
      let sum = 0, n = 0;
      for (let k = -radius; k <= radius; k++) {
        const j = i + k;
        if (j >= 0 && j < bank.length) { sum += bank[j]; n++; }
      }
      out[i] = sum / n;
    }
    bank = out;
  }
  frames.forEach((f, i) => { f.bank = bank[i]; });
}

function finalise(frames) {
  // Lift the whole ribbon so nothing dips below the ground plane.
  let minY = Infinity;
  for (const f of frames) minY = Math.min(minY, f.pos[1]);
  const lift = -minY + 0.05;

  for (const f of frames) {
    f.pos = [f.pos[0], f.pos[1] + lift, f.pos[2]];
    f.sq = f.bank ? quat.norm(quat.mul(f.q, quat.axisAngle([0, 0, 1], f.bank))) : f.q;
    f.fwd = quat.fwd(f.sq);
    f.up = quat.up(f.sq);
    f.right = quat.right(f.sq);
  }

  // Path curvature, resolved onto the surface axes.
  for (let i = 0; i < frames.length; i++) {
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    const d = Math.max(a.ds, 1e-4);
    const dF = v3.scale(v3.sub(b.fwd, a.fwd), 1 / d);
    a.kUp = v3.dot(dF, a.up);
    a.kRight = v3.dot(dF, a.right);
  }
  return frames;
}

// Light inside a bore, worked out once and baked into the colours.
//
// The world never moves and the sun never sets, so light that does not change
// does not have to be computed sixty times a second: it can be mixed into the
// vertex colours while the track is being built and cost nothing at all
// afterwards. That is the whole trick here, and it is what makes real tunnel
// lighting affordable on a television that could not carry a single extra
// per-pixel light.
//
// Three things are baked. Daylight gives out over the first stretch of bore
// rather than at the mouth, or driving in is a jump cut. Deep inside, what is
// left is the strip lights, which are warm and much weaker than the sun. And
// the strips are spaced, so the light between them dips -- a ripple that is
// what actually reads as lamps rather than as a dimmer switch.
const TUNNEL_DARK = 0.44;     // how much daylight survives deep in a bore
const TUNNEL_FADE = 22;       // metres over which it gives out
const TUNNEL_WARM = [1.0, 0.9, 0.72];   // the colour a sodium strip lends
const LAMP_SPACING = 3 * MESH_STEP;     // frames between strip lights
const LAMP_RIPPLE = 0.12;

// Distance from each frame to the nearest daylight, in metres. Two sweeps: one
// forward, one back, each carrying the best answer it has seen.
function bright(frames) {
  const n = frames.length;
  const d = new Array(n);
  let run = Infinity;
  for (let i = 0; i < n; i++) { run = frames[i].tunnel ? run + DS : 0; d[i] = run; }
  run = Infinity;
  for (let i = n - 1; i >= 0; i--) { run = frames[i].tunnel ? run + DS : 0; d[i] = Math.min(d[i], run); }
  return d.map((metres, i) => {
    if (!frames[i].tunnel) return 1;
    const day = Math.min(1, metres / TUNNEL_FADE);              // 0 at the mouth
    const lamp = 1 + LAMP_RIPPLE * Math.cos(2 * Math.PI * i / LAMP_SPACING);
    return (1 - day) + day * TUNNEL_DARK * lamp;
  });
}

// Darkened, and tinted towards the lamps as the daylight goes.
function lit(col, f) {
  if (f >= 0.999) return col;
  const w = Math.min(1, (1 - f) / (1 - TUNNEL_DARK * (1 + LAMP_RIPPLE)));
  return [
    Math.min(1, col[0] * f * (1 + w * (TUNNEL_WARM[0] - 1))),
    Math.min(1, col[1] * f * (1 + w * (TUNNEL_WARM[1] - 1))),
    Math.min(1, col[2] * f * (1 + w * (TUNNEL_WARM[2] - 1))),
  ];
}

// Cross-section point: lateral offset u, height h above the surface.
const P = (f, u, h) => [
  f.pos[0] + f.right[0] * u + f.up[0] * h,
  f.pos[1] + f.right[1] * u + f.up[1] * h,
  f.pos[2] + f.right[2] * u + f.up[2] * h,
];

function strip(md, a, b, u0, h0, u1, h1, col, flip = false) {
  const p0 = P(a, u0, h0), p1 = P(b, u0, h0), p2 = P(b, u1, h1), p3 = P(a, u1, h1);
  if (flip) md.quad(p3, p2, p1, p0, col);
  else md.quad(p0, p1, p2, p3, col);
}

function buildRoad(frames) {
  const chunks = [];
  let md = new MeshData();
  let segInChunk = 0;
  let curbToggle = 0;
  // How much light reaches each frame. Outside a bore this is all ones and
  // lit() hands every colour straight back, so an open track is untouched.
  const light = bright(frames);

  for (let i = 0; i + MESH_STEP < frames.length; i += MESH_STEP) {
    const a = frames[i], b = frames[i + MESH_STEP];
    if (!a.gap) {
      const L = light[i];
      const tone = lit(Math.floor(i / 16) % 2 ? COL.asphaltB : COL.asphaltA, L);

      strip(md, a, b, -ROAD_HALF, 0, -0.22, 0, tone);
      strip(md, a, b, 0.22, 0, ROAD_HALF, 0, tone);
      // Dashed centre line.
      const dash = Math.floor(i / (MESH_STEP * 4)) % 2 === 0;
      strip(md, a, b, -0.22, 0, 0.22, 0, dash ? lit(COL.line, L) : tone);

      const curb = lit(curbToggle % 2 ? COL.curbA : COL.curbB, L);
      // Alternating shade reads as structural ribs, which is what makes a loop
      // legible as a concrete tube rather than a flat mass.
      const rib = lit(shade(COL.apron, curbToggle % 4 < 2 ? 1 : 0.86), L);
      const rail = lit(shade(COL.rail, curbToggle % 6 < 3 ? 1 : 0.9), L);
      for (const sgn of [-1, 1]) {
        const inner = sgn * ROAD_HALF, outer = sgn * CURB_OUT, wall = sgn * WALL_OUT;
        strip(md, a, b, inner, CURB_H, outer, CURB_H, curb, sgn < 0);
        strip(md, a, b, inner, 0, inner, CURB_H, shade(curb, 0.8), sgn < 0);
        // Barrier: the car bounces off this instead of leaving the track.
        strip(md, a, b, outer, CURB_H, outer, WALL_H, rail, sgn < 0);
        strip(md, a, b, outer, WALL_H, wall, WALL_H, shade(rail, 1.08), sgn < 0);
        // Striped on the outside too. These two faces are the rims of a loop seen
        // from head-on, and plain grey made a loop read as an anonymous wall.
        strip(md, a, b, wall, WALL_H, wall, 0, shade(curb, 0.92), sgn < 0);
        strip(md, a, b, wall, 0, wall, -APRON, rib, sgn < 0);
      }
      // Banded underside: this is the outer skin of a loop, so it needs rhythm.
      strip(md, a, b, -WALL_OUT, -APRON, WALL_OUT, -APRON,
            lit(shade(COL.apron, curbToggle % 4 < 2 ? 0.74 : 0.6), L), true);
      curbToggle++;
    }

    if (++segInChunk >= CHUNK_SEGMENTS) {
      if (md.vertexCount) chunks.push(md);
      md = new MeshData();
      segInChunk = 0;
    }
  }
  if (md.vertexCount) chunks.push(md);
  return chunks;
}

// The bore is described in the surface frame, so it rolls and pitches with the
// road: enclose a loop and the tunnel goes over the top with it.
// Vertical side walls carrying an arch, which is what a road tunnel actually is.
// A pure dome springs from near road level and leaves a slot at each side that
// you can see the landscape through.
const BORE_HALF = 7.4;    // just outside the barriers at 6.85
const BORE_SPRING = 2.6;  // where the side wall becomes the arch
const BORE_CROWN = 6.4;
const BORE_FOOT = -0.9;   // tucked below the road apron
const ARCH_FACETS = 10;
const FACADE_W = 12;
const FACADE_H = 7.5;
const FACADE_CY = 2.2;    // rays fan out from here to square off the facade

// Cross-section as an explicit polyline: right foot, up the wall, over the arch,
// down the far wall to the left foot.
const BORE_SECTION = (() => {
  const pts = [[BORE_HALF, BORE_FOOT]];
  for (let i = 0; i <= ARCH_FACETS; i++) {
    const t = (i / ARCH_FACETS) * Math.PI;
    pts.push([Math.cos(t) * BORE_HALF, BORE_SPRING + Math.sin(t) * (BORE_CROWN - BORE_SPRING)]);
  }
  pts.push([-BORE_HALF, BORE_FOOT]);
  return pts;
})();

// Same direction, pushed out to a rectangle: the mouth then sits in a flat wall
// rather than ending at a zero-width cut.
function facadeOut(u, h) {
  const du = u, dh = h - FACADE_CY;
  const ku = Math.abs(du) > 1e-6 ? FACADE_W / Math.abs(du) : Infinity;
  const kh = Math.abs(dh) > 1e-6 ? FACADE_H / Math.abs(dh) : Infinity;
  const k = Math.min(ku, kh);
  return [du * k, FACADE_CY + dh * k];
}

// Pale concrete with a dark reveal at the opening, and built into its own mesh
// so it can be drawn with the brightly lit road group. The mouth only reads as a
// mouth when the wall is clearly lighter than the hole; matching their
// brightness is what turned the entrance into a flat slab.
function borePortal(md, f, flip) {
  for (let i = 0; i < BORE_SECTION.length - 1; i++) {
    const [u0, h0] = BORE_SECTION[i], [u1, h1] = BORE_SECTION[i + 1];
    const [ou0, oh0] = facadeOut(u0, h0), [ou1, oh1] = facadeOut(u1, h1);
    const mix = (a, b) => a + (b - a) * 0.13;

    const q0 = P(f, u0, h0), q1 = P(f, u1, h1);
    const r0 = P(f, mix(u0, ou0), mix(h0, oh0)), r1 = P(f, mix(u1, ou1), mix(h1, oh1));
    const s0 = P(f, ou0, oh0), s1 = P(f, ou1, oh1);
    const col = shade(COL.portal, i % 2 ? 1 : 0.93);

    if (flip) {
      md.quad(r0, r1, q1, q0, COL.portalEdge);
      md.quad(s0, s1, r1, r0, col);
    } else {
      md.quad(q0, q1, r1, r0, COL.portalEdge);
      md.quad(r0, r1, s1, s0, col);
    }
  }
}

function buildTunnels(frames) {
  const chunks = [];
  const portals = new MeshData();
  let md = new MeshData();
  let segInChunk = 0;
  let ring = 0;
  let inside = false;

  const flush = () => {
    if (md.vertexCount) chunks.push(md);
    md = new MeshData();
    segInChunk = 0;
  };

  for (let i = 0; i + MESH_STEP < frames.length; i += MESH_STEP) {
    const a = frames[i], b = frames[i + MESH_STEP];

    if (!a.tunnel) {
      if (inside) { borePortal(portals, a, false); inside = false; }
      flush();
      continue;
    }
    if (!inside) { borePortal(portals, a, true); inside = true; }

    // Ribs are colour only. Giving them a larger radius left an unclosed radial
    // slot at every rib boundary, which showed as sky through the crown.
    const base = ring % 4 === 0 ? COL.tunnelRib : COL.tunnel;

    for (let i = 0; i < BORE_SECTION.length - 1; i++) {
      const [u0, h0] = BORE_SECTION[i], [u1, h1] = BORE_SECTION[i + 1];
      // Strong facet-to-facet contrast so the shape of the bore is legible.
      const lift = (h0 + h1) / 2 / BORE_CROWN;
      const side = (u0 + u1) / 2 / BORE_HALF;
      const tone = 0.52 + 0.4 * lift + 0.14 * side;
      // The same ripple the road gets, so a strip lights its own stretch of
      // wall and the bore stops reading as one long grey pipe.
      const ripple = 1 + LAMP_RIPPLE * 1.6 * Math.cos(2 * Math.PI * i / LAMP_SPACING);
      strip(md, a, b, u0, h0, u1, h1, shade(base, tone * ripple));
    }

    // Recessed strip lights along the crown.
    if (ring % 3 === 0) {
      const y = BORE_CROWN - 0.3;
      strip(md, a, b, -1.7, y, 1.7, y, COL.tunnelLight, true);
    }

    ring++;
    if (++segInChunk >= CHUNK_SEGMENTS) flush();
  }
  if (inside) borePortal(portals, frames[frames.length - 1], false);
  flush();
  return { bore: chunks, portals: portals.vertexCount ? [portals] : [] };
}

// The shadow the road casts on the ground.
//
// Nothing in this world sits on anything: a viaduct, a hill, the top of a loop
// all float, because a flat-shaded scene with no shadows gives the eye nothing
// to put them on. A real shadow map is out of the question on a television --
// a second pass over the whole scene, every frame, and we have already learnt
// what that costs here. But the sun never moves and neither does the road, so
// the shadow can be worked out once and laid down as a strip of dark grass.
// It is a few thousand triangles that never change, and it costs nothing at
// all per frame.
//
// Each point of the road slides down the sun's own direction until it reaches
// the ground, which is what makes the shadow lean away as the road climbs --
// the single cue that says how high up something is.
//
// It is drawn wider than the road on purpose. The sun here stands 55 degrees
// up, which buys only two thirds of a metre of lean for every metre of height,
// and the carriageway is thirteen metres across: a shadow the width of the
// road would spend the whole track hidden underneath it and only ever appear
// beside a viaduct. The extra width shows either side as a band of darker
// grass -- the shading a thing picks up from being near the ground -- which is
// what makes the road look laid on the world rather than hovering over it.
const SUN = v3.norm([0.42, 0.82, 0.38]);      // Renderer.light
const SHADOW_LIFT = 0.12;                     // clear of the grass, and of its depth buffer
const SHADOW_WIDE = WALL_OUT + 2.6;
const SHADOW_COL = hex('#384a37');

function buildShadow(frames) {
  const md = new MeshData();
  const onGround = (f, u) => {
    const p = P(f, u, 0);
    const drop = (p[1] - GROUND_Y) / SUN[1];
    return [p[0] - SUN[0] * drop, GROUND_Y + SHADOW_LIFT, p[2] - SUN[2] * drop];
  };
  for (let i = 0; i + MESH_STEP < frames.length; i += MESH_STEP) {
    const a = frames[i], b = frames[i + MESH_STEP];
    // No sun inside a bore, nothing to cast over a gap, and a wall standing on
    // its edge casts a sliver nobody would read as a shadow.
    if (a.gap || a.tunnel || a.up[1] < 0.3) continue;
    md.quad(onGround(a, -SHADOW_WIDE), onGround(b, -SHADOW_WIDE),
            onGround(b, SHADOW_WIDE), onGround(a, SHADOW_WIDE), SHADOW_COL, [0, 1, 0]);
  }
  return md.vertexCount ? [md] : [];
}

function buildSupports(frames) {
  const md = new MeshData();
  for (let i = 0; i < frames.length; i += 14) {
    const f = frames[i];
    if (f.gap || f.up[1] < 0.55) continue;
    const base = P(f, 0, -APRON);
    const h = base[1];
    if (h < 3.2) continue;
    // A pillar goes straight down to the ground, so where the road it is
    // holding up passes over another piece of road, that pillar would come
    // down through it. Nothing holding the viaduct up there looks better than
    // a column through the carriageway.
    if (throughRoad(frames, i, base)) continue;
    md.box(base[0], h / 2, base[2], 0.8, h / 2, 0.8, COL.pillar);
  }
  return md.vertexCount ? [md] : [];
}

// Is there road below this pillar's foot, belonging to some other part of the
// track? Only the stretch under it matters, so the search is a plain scan with
// an early skip on arc length -- pillars are rare enough for that to be cheap.
function throughRoad(frames, at, base) {
  const me = frames[at];
  for (let j = 0; j < frames.length; j += 2) {
    const g = frames[j];
    if (Math.abs(g.s - me.s) < 40) continue;
    if (g.pos[1] > base[1] - 1.5) continue;          // not below the deck
    if (Math.hypot(g.pos[0] - base[0], g.pos[2] - base[2]) < WALL_OUT + 1) return true;
  }
  return false;
}

function gate(md, f, kind) {
  const colTop = kind === 'start' ? COL.gateStart : kind === 'end' ? COL.gateEnd : COL.gateCp;
  const postW = 0.42, height = 7.2, span = CURB_OUT + 1.1;

  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 9; k++) {
      const y0 = k / 9 * height, y1 = (k + 1) / 9 * height;
      const c = k % 2 ? COL.gateDark : COL.post;
      const lo = P(f, sgn * span, y0), hi = P(f, sgn * span, y1);
      const mid = v3.scale(v3.add(lo, hi), 0.5);
      md.box(mid[0], mid[1], mid[2], postW, (y1 - y0) / 2 + 0.01, postW, c);
    }
  }
  // Banner across the top, split into blocks so it reads as striped.
  const blocks = 12;
  for (let k = 0; k < blocks; k++) {
    const u0 = -span + (2 * span) * k / blocks, u1 = -span + (2 * span) * (k + 1) / blocks;
    const c = k % 2 ? colTop : COL.gateDark;
    const p0 = P(f, u0, height), p1 = P(f, u1, height);
    const p2 = P(f, u1, height + 1.5), p3 = P(f, u0, height + 1.5);
    const back = v3.mad([0, 0, 0], f.fwd, 0.22);
    const q0 = v3.add(p0, back), q1 = v3.add(p1, back), q2 = v3.add(p2, back), q3 = v3.add(p3, back);
    md.quad(p0, p1, p2, p3, c);
    md.quad(q1, q0, q3, q2, shade(c, 0.7));
    md.quad(p3, p2, q2, q3, shade(c, 0.9));
  }
}

function buildGates(frames, checkpoints, length, closed) {
  const md = new MeshData();
  const at = s => frames[clamp(Math.round(s / DS), 0, frames.length - 1)];
  gate(md, at(6), 'start');
  for (const s of checkpoints) gate(md, at(s), 'cp');
  // On a circuit the finish *is* the start, so the two would be built in the
  // same place, one inside the other.
  if (!closed) gate(md, at(length - 8), 'end');
  return md.vertexCount ? [md] : [];
}

// Geometry only, no meshes: cheap enough for the editor to call on every edit.
export function walkTrack(pieces) {
  const { frames, checkpoints, length } = walk(expand(pieces));
  smoothBank(frames);
  finalise(frames);

  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of frames) {
    x0 = Math.min(x0, f.pos[0]); x1 = Math.max(x1, f.pos[0]);
    z0 = Math.min(z0, f.pos[2]); z1 = Math.max(z1, f.pos[2]);
    y0 = Math.min(y0, f.pos[1]); y1 = Math.max(y1, f.pos[1]);
  }

  return {
    frames, length,
    closed: closes(frames),
    rawCheckpoints: checkpoints,
    checkpoints: checkpoints.filter(s => s > 12 && s < length - 20),
    bounds: { x0, x1, z0, z1, y0, y1 },
  };
}

// A circuit is a track whose end meets its own beginning -- same place, same
// height, same way round. Nothing in a piece list forces that, so it is
// measured rather than declared: build something that happens to come back and
// it can be driven in laps, build something that does not and it stays the
// sprint it always was.
//
// The tolerances are tight on purpose. The seam is driven across at speed with
// the geometry wrapping underneath, so anything the frames do not agree on
// there is a sideways jolt in the picture -- half a metre is already the width
// of the painted line.
const CLOSE_GAP = 0.6;              // metres between the two ends
const CLOSE_RISE = 0.4;             // metres of step in height
const CLOSE_TURN = 2 * Math.PI / 180;

// The width the road really takes up on the ground: the rails, not the tarmac.
// Two centrelines closer together than this have their barriers inside each
// other, which is what a crossing looks like when it goes wrong.
export const ROAD_WIDE = WALL_OUT * 2;

// Where the track lies on top of itself.
//
// Not every meeting is a fault -- a loop passes over its own entry and a
// corkscrew over its own start, and both are the point of the piece. What is a
// fault is two pieces of road at the same height in the same place: they fight
// over the same ground and neither reads as a road. So a clash is close in
// plan *and* close in height, and far enough apart along the track that it is
// two different pieces of road rather than the same one.
//
// Frames are a metre apart, so a pairwise search is millions of tests on a long
// track. They go into a coarse grid first and only the nine squares around each
// frame are looked at.
export function crossings(walk, { near = ROAD_WIDE, rise = 5, apart = 70 } = {}) {
  const F = walk.frames, len = walk.length, closed = walk.closed;
  const CELL = Math.ceil(near) + 4;
  const key = (a, b) => a + ',' + b;
  const grid = new Map();
  for (let i = 0; i < F.length; i++) {
    const k = key(Math.floor(F[i].pos[0] / CELL), Math.floor(F[i].pos[2] / CELL));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const spots = [];
  let run = null;
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    const cx = Math.floor(f.pos[0] / CELL), cz = Math.floor(f.pos[2] / CELL);
    let hit = -1;
    for (let dx = -1; dx <= 1 && hit < 0; dx++) {
      for (let dz = -1; dz <= 1 && hit < 0; dz++) {
        for (const j of grid.get(key(cx + dx, cz + dz)) || []) {
          let ds = Math.abs(F[j].s - f.s);
          if (closed) ds = Math.min(ds, len - ds);
          if (ds < apart) continue;
          if (Math.abs(F[j].pos[1] - f.pos[1]) > rise) continue;
          if (Math.hypot(F[j].pos[0] - f.pos[0], F[j].pos[2] - f.pos[2]) < near) { hit = j; break; }
        }
      }
    }
    if (hit < 0) { run = null; continue; }
    // A crossing is a stretch, not a point: neighbouring frames that clash are
    // the same fault seen again and belong in one entry.
    if (run && i - run.i <= 3) { run.i = i; run.to = f.s; run.metres++; }
    else { run = { from: f.s, to: f.s, i, metres: 1 }; spots.push(run); }
  }
  return spots;
}

export function closes(frames) {
  const a = frames[0], b = frames[frames.length - 1];
  if (Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]) > CLOSE_GAP) return false;
  if (Math.abs(b.pos[1] - a.pos[1]) > CLOSE_RISE) return false;
  const fa = quat.fwd(a.sq || a.q), fb = quat.fwd(b.sq || b.q);
  let turn = Math.atan2(fb[0], fb[2]) - Math.atan2(fa[0], fa[2]);
  while (turn > Math.PI) turn -= 2 * Math.PI;
  while (turn < -Math.PI) turn += 2 * Math.PI;
  return Math.abs(turn) <= CLOSE_TURN;
}

export function buildTrack(def) {
  const base = walkTrack(def.pieces);
  const { frames, length } = base;
  const tunnels = buildTunnels(frames);

  return {
    ...base,
    def,
    roadMeshes: [...buildShadow(frames), ...buildRoad(frames),
                 ...buildSupports(frames), ...tunnels.portals],
    tunnelMeshes: tunnels.bore,
    gateMeshes: buildGates(frames, base.rawCheckpoints, length, base.closed),

    // On a circuit only the *geometry* comes back around: a lap's worth of
    // distance is added to the reading, never taken off it. Everything that
    // counts distance -- the ghost, the checkpoints, the lap counter -- can
    // then go on assuming it only ever grows, which is what all of it was
    // written to assume. `base` is the lap this reading belongs to, and it
    // goes back onto the frame's own `s` on the way out, so a caller that
    // stores what it is handed does not quietly fall back a lap.
    frameAt(s) {
      const n = this.frames.length;
      const base = this.closed ? Math.floor(s / this.length) * this.length : 0;
      const x = clamp((s - base) / DS, 0, n - 1.0001);
      const i = Math.floor(x), t = x - i;
      const a = this.frames[i], b = this.frames[i + 1] || a;
      const sq = quat.nlerp(a.sq, b.sq, t);
      return {
        pos: v3.lerp(a.pos, b.pos, t),
        sq,
        fwd: quat.fwd(sq), up: quat.up(sq), right: quat.right(sq),
        kUp: a.kUp + (b.kUp - a.kUp) * t,
        kRight: a.kRight + (b.kRight - a.kRight) * t,
        gap: a.gap, tunnel: a.tunnel,
        bank: a.bank + (b.bank - a.bank) * t,
        s: base + a.s + (b.s - a.s) * t,
      };
    },

    // Nearest frame within a window, used to detect landings after a jump.
    nearest(worldPos, aroundS, window = 90) {
      const n = this.frames.length;
      const len = this.length;
      const base = this.closed ? Math.floor(aroundS / len) * len : 0;
      const mid = Math.round((aroundS - base) / DS);
      const half = Math.round(window / DS);
      let best = null, bestD = Infinity;
      for (let k = -half; k <= half; k += 2) {
        // A jump can take off before the line and land after it, so on a
        // circuit the window has to run past the end of the array and come
        // back in at the front.
        const i = this.closed ? ((mid + k) % n + n) % n : clamp(mid + k, 0, n - 1);
        const d = v3.dist(this.frames[i].pos, worldPos);
        if (d < bestD) { bestD = d; best = this.frames[i]; }
      }
      if (!this.closed) return best;
      // Hand back a distance in the same lap the caller is already in, rather
      // than one that has silently wrapped to the start of the track.
      let s = base + best.s;
      if (s - aroundS > len / 2) s -= len;
      if (aroundS - s > len / 2) s += len;
      return { ...best, s };
    },
  };
}
