import { SLIP_WARN } from './car.js';

export function formatTime(ms) {
  if (ms == null) return '--:--.--';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor(t / 1000) % 60;
  const c = Math.floor(t / 10) % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

// The cockpit, drawn the way 1990 drew one.
//
// Stunts ran in 320x200 with a fixed palette and no alpha channel, so an
// interior was a handful of flat panels with hard edges, round instruments with
// printed numbers and a real needle, and dithering wherever a surface had to
// sit between two colours. None of the modern crutches -- gradients, gloss,
// drop shadows, blur -- existed, and leaving them out is most of what makes a
// cockpit read as that kind of car instead of a phone racing game.
//
// Interior defaults. Each car overrides the palette and a couple of proportions
// via st.theme, so the three cockpits feel like different cars.
const BASE = {
  dash: '#2e3a6e', dashLite: '#4a5796', dashDark: '#1a2247',
  body: '#c9a43a', bodyDark: '#8a6f1f',
  panel: '#0b0d14', panelLite: '#2b3246',
  pillar: '#171b21', pillarEdge: '#333b46', roof: '#0e1116',
  rim: '#31363f', rimHi: '#565d69', rimLow: '#15181e',
  face: '#06080d', bezel: '#b9bec9', needle: '#ef4a3c',
  accent: '#ffb43a', accent2: '#7fd0ff',
  dashScale: 1, wheelScale: 1,
};

const C = {
  amber: '#ffb43a', green: '#5fd894', red: '#ff5a4e',
  text: '#eef3f9', dim: 'rgba(198,214,236,.55)', print: '#cfd8e6',
};

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._dither = new Map();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
  }

  // A 2x2 checkerboard of two flat colours. With no alpha channel, a surface
  // halfway between two colours was drawn by mixing their pixels, and that
  // chequer is a large part of why the era looks the way it does. Cached,
  // because a pattern is rebuilt from a canvas each time otherwise.
  dither(a, b) {
    const key = a + b;
    let p = this._dither.get(key);
    if (p) return p;
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const x = c.getContext('2d');
    x.fillStyle = a; x.fillRect(0, 0, 2, 2);
    x.fillStyle = b; x.fillRect(0, 0, 1, 1); x.fillRect(1, 1, 1, 1);
    p = this.ctx.createPattern(c, 'repeat');
    this._dither.set(key, p);
    return p;
  }

  // One place decides the geometry, so the bonnet, instruments and wheel can
  // never drift into each other.
  layout(w, h, t) {
    // A television is watched from across a room, so the dash takes close to a
    // third of the screen: the instruments have to be readable from the sofa,
    // and Stunts gave its cockpit about as much.
    const dashH = Math.min(330, h * 0.32) * t.dashScale;
    const dashTop = h - dashH;
    const bonnetH = dashH * 0.21;
    const sideR = dashH * 0.26;
    return {
      dashH, dashTop, bonnetH, bonnetTop: dashTop - bonnetH,
      bigR: dashH * 0.38,
      bigCy: dashTop + dashH * 0.46,
      sideR,
      // Far enough out to clear the wheel, but never off the edge of a narrow
      // screen: the side dials are instruments, not decoration.
      sideDx: Math.min(w * 0.5 - sideR * 1.5 - w * 0.035,
                       Math.max(dashH * 1.18, w * 0.25)),
      wheelRx: dashH * 1.28 * t.wheelScale,
      wheelRy: dashH * 0.82 * t.wheelScale,
      wheelCy: h + dashH * 0.44 * t.wheelScale,
    };
  }

  draw(st) {
    this.resize();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const { w, h } = this;
    const t = { ...BASE, ...(st.theme || {}) };
    const lay = this.layout(w, h, t);

    this.drawFrame(ctx, w, h, lay, t);
    this.drawBonnet(ctx, w, lay, t);
    this.drawDash(ctx, w, h, lay, t);
    this.drawCluster(ctx, w, h, lay, st, t);
    this.drawWheel(ctx, w, h, lay, st, t);
    this.drawTop(ctx, w, h, st);
    if (st.message) this.drawMessage(ctx, w, h, st);
  }

  // Straight pillars and a flat roof band: the frame is body panels, and body
  // panels in this world are polygons.
  drawFrame(ctx, w, h, lay, t) {
    const glass = lay.bonnetTop;
    const pw = Math.max(16, w * 0.03);
    const roof = Math.max(10, h * 0.022);

    ctx.fillStyle = t.roof;
    ctx.fillRect(0, 0, w, roof);
    ctx.fillStyle = this.dither(t.roof, t.pillar);
    ctx.fillRect(0, roof, w, Math.max(3, roof * 0.35));

    for (const side of [-1, 1]) {
      const x = side < 0 ? 0 : w;
      const dir = side < 0 ? 1 : -1;
      ctx.fillStyle = t.pillar;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + dir * pw * 0.55, 0);
      ctx.lineTo(x + dir * pw * 1.25, glass);
      ctx.lineTo(x, glass);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = t.pillarEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + dir * pw * 0.55, 0);
      ctx.lineTo(x + dir * pw * 1.25, glass);
      ctx.stroke();
    }
  }

  // The nose of the car, seen over the dash. Stunts always kept a band of
  // bodywork in shot, and it is what places the driver behind the windscreen
  // rather than floating above the road.
  drawBonnet(ctx, w, lay, t) {
    const { bonnetTop: y, bonnetH: bh } = lay;
    ctx.fillStyle = t.body;
    ctx.fillRect(0, y, w, bh);
    ctx.fillStyle = this.dither(t.bodyDark, t.body);
    ctx.fillRect(0, y, w, Math.max(4, bh * 0.28));
    ctx.fillStyle = t.bodyDark;
    ctx.fillRect(0, y, w, 2);

    // Rivets along the shut line.
    ctx.fillStyle = t.bodyDark;
    const step = Math.max(24, w / 44);
    const ry = Math.round(y + bh * 0.58);
    for (let x = step * 0.5; x < w; x += step) ctx.fillRect(Math.round(x), ry, 3, 3);
  }

  drawDash(ctx, w, h, lay, t) {
    const { dashTop: y, dashH: dh } = lay;
    ctx.fillStyle = t.dash;
    ctx.fillRect(0, y, w, dh);

    // Top lip catching the light, then a chequer step down into the face.
    const lip = Math.max(5, dh * 0.05);
    ctx.fillStyle = t.dashLite;
    ctx.fillRect(0, y, w, lip);
    ctx.fillStyle = this.dither(t.dashLite, t.dash);
    ctx.fillRect(0, y + lip, w, lip * 0.8);

    // Where the moulding turns under, the same trick reversed.
    ctx.fillStyle = this.dither(t.dash, t.dashDark);
    ctx.fillRect(0, h - dh * 0.15, w, dh * 0.06);
    ctx.fillStyle = t.dashDark;
    ctx.fillRect(0, h - dh * 0.09, w, dh * 0.09);
  }

  // A panel let into the moulding: black face, hard bright edge on the top and
  // left, dark on the bottom and right. Two rectangles and no blur, which is
  // all a sunken panel ever was.
  inset(ctx, x, y, w, h, t) {
    ctx.fillStyle = t.panel;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = t.dashDark;
    ctx.fillRect(x - 2, y - 2, w + 4, 2);
    ctx.fillRect(x - 2, y - 2, 2, h + 4);
    ctx.fillStyle = t.dashLite;
    ctx.fillRect(x - 2, y + h, w + 4, 2);
    ctx.fillRect(x + w, y - 2, 2, h + 4);
  }

  drawCluster(ctx, w, h, lay, st, t) {
    const { bigR, bigCy, sideR, sideDx } = lay;
    const topKmh = st.topKmh || 240;
    const slipping = st.slip > SLIP_WARN;

    // Speedometer, centred over the hub, where the wheel rim crosses its lower
    // edge exactly as a real wheel hides the bottom of a real dial. Always eight
    // divisions with a number on every second one: an odd count would leave the
    // last mark unlabelled and the face lopsided.
    const kmhTicks = 8;
    const kmhStep = [10, 20, 25, 30, 40, 50, 60].find(v => v * kmhTicks >= topKmh) || 80;
    this.gauge(ctx, w / 2, bigCy, bigR, st.speedKmh / (kmhStep * kmhTicks), t, {
      ticks: kmhTicks, step: kmhStep, every: 2,
      needle: slipping ? C.red : t.needle,
    });

    // Tachometer on the left, with the gear in a window under the spindle.
    const rpm = Math.max(0, Math.min(1, st.rpm));
    this.gauge(ctx, w / 2 - sideDx, bigCy, sideR, rpm, t, {
      ticks: 8, step: 1, every: 4, label: 'RPM x1000', labelDy: 0.72, redline: 0.82,
      value: st.gear, valueDy: 0.44, valueCol: t.accent2,
    });

    // Distance covered, read like a fuel gauge: it is the one thing a driver
    // wants at a glance that the top of the screen states in numbers.
    this.gauge(ctx, w / 2 + sideDx, bigCy, sideR, st.progress, t, {
      ticks: 4, marks: ['0', '', '1/2', '', '1'], label: 'PISTA', labelDy: 0.72,
      needle: C.green,
    });

    this.drawLeft(ctx, w, lay, st, t, slipping);
    this.drawSwitches(ctx, w, lay, t, st);
  }

  // Left panel: the speed in figures, and the round bulbs a cockpit of the era
  // used for water and fuel. The number lives here rather than on the dial
  // face, where it would have sat on top of the printed scale.
  drawLeft(ctx, w, lay, st, t, slipping) {
    const { dashTop, dashH, sideDx, sideR } = lay;
    // Whatever the dials leave over, up to the width a panel should be. Below
    // the point where the readout would be unreadable there is no panel at all.
    const bw = Math.min(dashH * 1.15, w / 2 - sideDx - sideR * 1.35 - 26);
    if (bw < 64) return;
    const x = Math.max(12, w / 2 - sideDx - sideR * 1.3 - bw - 14);
    const y = dashTop + dashH * 0.18;
    const bh = dashH * 0.58;
    this.inset(ctx, x, y, bw, bh, t);

    const lamps = [
      ['ACEL', st.throttle > 0.05, C.green],
      ['TRAV', st.brake > 0.05, C.red],
      ['ADER', slipping, C.amber],
    ];
    const r = Math.max(5, bh * 0.085);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lamps.forEach(([label, on, col], i) => {
      const ly = y + bh * (0.2 + i * 0.3);
      ctx.fillStyle = on ? col : 'rgba(255,255,255,.09)';
      ctx.beginPath(); ctx.arc(x + bw * 0.13, ly, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x + bw * 0.13, ly, r, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = on ? C.text : C.dim;
      ctx.font = `700 ${Math.round(bh * 0.135)}px ${FONT}`;
      ctx.fillText(label, x + bw * 0.24, ly + 1);
    });

    // Speed in figures, in a window of its own.
    const ww = bw * 0.44, wh = bh * 0.46;
    const wx = x + bw - ww - bw * 0.05, wy = y + bh * 0.16;
    ctx.fillStyle = '#000';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = 'rgba(200,215,235,.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(wx + 1, wy + 1, ww - 2, wh - 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = slipping ? C.red : t.accent;
    ctx.font = `700 ${Math.round(wh * 0.62)}px ${MONO}`;
    ctx.fillText(String(Math.round(st.speedKmh)), wx + ww / 2, wy + wh * 0.54);
    ctx.fillStyle = C.dim;
    ctx.font = `700 ${Math.round(bh * 0.115)}px ${FONT}`;
    ctx.fillText('KM/H', wx + ww / 2, wy + wh + bh * 0.12);
    ctx.textBaseline = 'alphabetic';
  }

  // Switchgear: dead decoration, and the dash looks wrong without it. A 1990
  // interior was never a clean surface.
  drawSwitches(ctx, w, lay, t, st) {
    const { dashTop, dashH, sideDx, sideR } = lay;
    const bw = Math.min(dashH * 1.15, w / 2 - sideDx - sideR * 1.35 - 26);
    if (bw < 64) return;
    const x = Math.min(w - bw - 12, w / 2 + sideDx + sideR * 1.3 + 14);
    const y = dashTop + dashH * 0.18;
    const bh = dashH * 0.58;
    this.inset(ctx, x, y, bw, bh, t);

    // Three rocker switches, the middle one thrown.
    const sw = bw * 0.17, sh = bh * 0.3;
    for (let i = 0; i < 3; i++) {
      const sx = x + bw * (0.09 + i * 0.22), sy = y + bh * 0.16;
      ctx.fillStyle = '#20252e';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = '#9aa4b4';
      ctx.fillRect(sx + 2, i === 1 ? sy + 2 : sy + sh / 2, sw - 4, sh / 2 - 2);
    }
    // Two knobs.
    for (let i = 0; i < 2; i++) {
      const kx = x + bw * (0.72 + i * 0.17), ky = y + bh * 0.31;
      const kr = bh * 0.13;
      ctx.fillStyle = '#7e8797';
      ctx.beginPath(); ctx.arc(kx, ky, kr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0a0c11';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(kx + Math.cos(-2.2 + i) * kr, ky + Math.sin(-2.2 + i) * kr);
      ctx.stroke();
    }
    // Pedal bars, the one readout worth having down here.
    const py = y + bh * 0.66, ph = bh * 0.2;
    this.bar(ctx, x + bw * 0.09, py, bw * 0.38, ph, st.brake, C.red);
    this.bar(ctx, x + bw * 0.53, py, bw * 0.38, ph, st.throttle, C.green);
  }

  // Segmented bar, so it reads as an instrument rather than a progress meter.
  bar(ctx, x, y, w, h, v, col) {
    const n = 7, seg = w / n, pad = 2.4;
    const lit = Math.round(Math.max(0, Math.min(1, v)) * n);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < lit ? col : 'rgba(255,255,255,.10)';
      ctx.fillRect(x + i * seg, y, seg - pad, h);
    }
  }

  // A round instrument: chrome bezel, flat black face, printed numbers, a
  // straight needle. Arcs and polygons only -- there is not a gradient anywhere
  // in it, which is exactly why it reads as stamped metal rather than glass.
  gauge(ctx, cx, cy, r, frac, t, o = {}) {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const f = Math.max(0, Math.min(1, frac || 0));
    const ang = a0 + (a1 - a0) * f;

    ctx.fillStyle = t.bezel;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1d23';
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = o.face || t.face;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    if (o.redline != null) {
      ctx.strokeStyle = C.red;
      ctx.lineWidth = Math.max(3, r * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.88, a0 + (a1 - a0) * o.redline, a1);
      ctx.stroke();
    }

    const n = o.ticks || 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      const c = Math.cos(a), s = Math.sin(a);
      ctx.strokeStyle = C.print;
      ctx.lineWidth = Math.max(1.6, r * 0.055);
      ctx.beginPath();
      ctx.moveTo(cx + c * r * 0.97, cy + s * r * 0.97);
      ctx.lineTo(cx + c * r * 0.80, cy + s * r * 0.80);
      ctx.stroke();

      if (i < n) {   // minor tick between each pair
        const am = a0 + (a1 - a0) * ((i + 0.5) / n);
        ctx.lineWidth = Math.max(1, r * 0.03);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(am) * r * 0.97, cy + Math.sin(am) * r * 0.97);
        ctx.lineTo(cx + Math.cos(am) * r * 0.88, cy + Math.sin(am) * r * 0.88);
        ctx.stroke();
      }

      // A dial this size cannot print every number legibly, so a face with many
      // ticks prints every other one and lets the ticks carry the rest.
      const skip = i % (o.every || 1) !== 0;
      const mark = skip ? null
        : (o.marks ? o.marks[i] : (o.step != null ? String(i * o.step) : null));
      if (mark) {
        ctx.fillStyle = C.print;
        ctx.font = `700 ${Math.round(r * 0.22)}px ${MONO}`;
        ctx.fillText(mark, cx + c * r * 0.59, cy + s * r * 0.59);
      }
    }

    if (o.label) {
      ctx.fillStyle = C.dim;
      ctx.font = `700 ${Math.round(r * 0.17)}px ${FONT}`;
      ctx.fillText(o.label, cx, cy + r * (o.labelDy || 0.66));
    }

    if (o.value != null) {
      const fs = Math.round(r * 0.31);
      const vy = cy + r * (o.valueDy || 0.42);
      ctx.font = `700 ${fs}px ${MONO}`;
      const bw = Math.max(fs * 1.6, ctx.measureText(o.value).width + fs * 0.7);
      ctx.fillStyle = '#000';
      ctx.fillRect(cx - bw / 2, vy - fs * 0.68, bw, fs * 1.32);
      ctx.strokeStyle = 'rgba(200,215,235,.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - bw / 2, vy - fs * 0.68, bw, fs * 1.32);
      ctx.fillStyle = o.valueCol || C.text;
      ctx.fillText(o.value, cx, vy);
    }

    // Needle: a long spike one way, a stub counterweight the other.
    const c = Math.cos(ang), s = Math.sin(ang);
    const hub = r * 0.075;
    ctx.fillStyle = o.needle || t.needle;
    ctx.beginPath();
    ctx.moveTo(cx + c * r * 0.93, cy + s * r * 0.93);
    ctx.lineTo(cx - s * hub, cy + c * hub);
    ctx.lineTo(cx - c * r * 0.16, cy - s * r * 0.16);
    ctx.lineTo(cx + s * hub, cy - c * hub);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8dee8';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.09, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2f38';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.textBaseline = 'alphabetic';
  }

  // Seen from the driver's seat the rim is a foreshortened ellipse. It turns
  // with the lock, and it passes in front of the instruments, because that is
  // where a steering wheel is.
  drawWheel(ctx, w, h, lay, st, t) {
    const { dashH, wheelRx: rx, wheelRy: ry, wheelCy: cy } = lay;
    const cx = w / 2;
    const thick = Math.max(16, dashH * 0.135);
    const turn = st.steer * 0.85;
    const at = a => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    const top = -Math.PI / 2 + turn;

    ctx.save();

    // Spokes first, so the rim covers where they meet it.
    ctx.strokeStyle = t.rim;
    ctx.lineWidth = thick * 0.42;
    for (const off of [-1.5, 1.5]) {
      const [px, py] = at(top + off);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(cx + (px - cx) * 0.10, cy + (py - cy) * 0.10);
      ctx.stroke();
    }

    ctx.lineWidth = thick;
    ctx.strokeStyle = t.rim;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

    // Flat highlight along the top of the rim and shadow under it: two hard
    // strokes, no gradient.
    ctx.lineWidth = thick * 0.26;
    ctx.strokeStyle = t.rimHi;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry - thick * 0.36, 0, Math.PI * 1.10, Math.PI * 1.90);
    ctx.stroke();
    ctx.strokeStyle = t.rimLow;
    ctx.lineWidth = thick * 0.22;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry + thick * 0.34, 0, Math.PI * 1.16, Math.PI * 1.84);
    ctx.stroke();

    // Grips, and the marker that says where straight ahead is.
    ctx.strokeStyle = t.rimHi;
    ctx.lineWidth = thick * 1.05;
    for (const off of [-0.62, 0.62]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, top + off - 0.1, top + off + 0.1);
      ctx.stroke();
    }
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = thick * 0.9;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, top - 0.05, top + 0.05);
    ctx.stroke();

    // Hub with its bolts.
    const hr = Math.max(18, dashH * 0.16);
    ctx.fillStyle = t.rimHi;
    ctx.beginPath(); ctx.ellipse(cx, cy, hr, hr * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.rimLow;
    ctx.beginPath(); ctx.ellipse(cx, cy, hr * 0.62, hr * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.rim;
    for (let i = 0; i < 4; i++) {
      const a = top + Math.PI * 0.25 + i * Math.PI * 0.5;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * hr * 0.8, cy + Math.sin(a) * hr * 0.5, hr * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawTop(ctx, w, h, st) {
    const pad = Math.max(14, w * 0.02);
    const top = Math.max(16, h * 0.035);
    // Flat boxes with a hard border: the readouts belong to the same machine as
    // the dials below them.
    const panel = (x, y, pw, ph) => {
      ctx.fillStyle = 'rgba(6,8,12,.78)';
      ctx.fillRect(x, y, pw, ph);
      ctx.strokeStyle = 'rgba(180,200,225,.34)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
    };

    ctx.textAlign = 'center';
    panel(w / 2 - 108, top, 216, 56);
    ctx.fillStyle = C.amber;
    ctx.font = `700 32px ${MONO}`;
    ctx.fillText(formatTime(st.timeMs), w / 2, top + 38);

    // Gap to the record holder's ghost. Only drawn when there is a ghost, so
    // the cockpit is untouched in a plain time trial -- and it earns its space,
    // because for most of a lap the ghost is out of sight behind or ahead.
    if (st.ghostDelta != null) {
      const d = st.ghostDelta / 1000;
      const ahead = d < 0;
      const label = `${ahead ? '−' : '+'}${Math.abs(d).toFixed(2)}`;
      ctx.font = `700 20px ${MONO}`;
      const bw = Math.max(96, ctx.measureText(label).width + 30);
      panel(w / 2 - bw / 2, top + 62, bw, 32);
      ctx.fillStyle = ahead ? C.green : C.red;
      ctx.fillText(label, w / 2, top + 84);
    }

    ctx.textAlign = 'left';
    panel(pad, top, 172, 62);
    ctx.fillStyle = C.dim;
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText('CHECKPOINTS', pad + 14, top + 20);
    ctx.fillStyle = C.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`${st.cpDone} / ${st.cpTotal}`, pad + 14, top + 46);

    const bx = pad + 92, bw = 66;
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fillRect(bx, top + 34, bw, 6);
    ctx.fillStyle = C.green;
    ctx.fillRect(bx, top + 34, Math.max(3, bw * st.progress), 6);
    ctx.fillStyle = C.dim;
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText(`${Math.round(st.progress * 100)}%`, bx, top + 22);

    ctx.textAlign = 'right';
    panel(w - pad - 172, top, 172, 62);
    ctx.fillStyle = C.dim;
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText('MELHOR', w - pad - 14, top + 20);
    ctx.fillStyle = st.bestMs == null ? C.dim : C.green;
    ctx.font = `700 20px ${MONO}`;
    ctx.fillText(formatTime(st.bestMs), w - pad - 14, top + 46);
  }

  drawMessage(ctx, w, h, st) {
    const y = h * 0.32;
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(Math.min(72, w * 0.09))}px ${FONT}`;
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(5,8,13,.8)';
    ctx.strokeText(st.message, w / 2, y);
    ctx.fillStyle = st.messageColor || C.amber;
    ctx.fillText(st.message, w / 2, y);
    if (st.submessage) {
      ctx.font = `600 ${Math.round(Math.min(22, w * 0.028))}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(5,8,13,.8)';
      ctx.strokeText(st.submessage, w / 2, y + 38);
      ctx.fillStyle = '#dce6f2';
      ctx.fillText(st.submessage, w / 2, y + 38);
    }
  }
}
