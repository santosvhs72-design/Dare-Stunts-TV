import { hex, shade } from '../core/mesh.js';
import { SLIP_WARN } from './car.js';

export function formatTime(ms) {
  if (ms == null) return '--:--.--';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor(t / 1000) % 60;
  const c = Math.floor(t / 10) % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

// The cockpit, built out of the same parts as the world outside it.
//
// The 3D world is flat-shaded polygons: one colour per face, lit in three fixed
// steps -- MeshData.box paints its top at x1.12, its sides at x0.78 and the
// faces turned away at x0.6 -- in a deliberately desaturated palette where
// nothing is pure black and nothing is photographic. A cockpit drawn any other
// way reads as a picture pasted over the game rather than the inside of a car
// standing in it, however good it looks on its own.
//
// So every surface here is a flat shape, shaded with that same `shade()` in
// those same steps, in colours lifted from js/world/track.js and
// js/world/scenery.js. No gradients, no chrome, no dithering, no black: the
// world has none of them.
const css = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

// The world's three light levels, by name, so a panel is shaded exactly the way
// a box in the scenery is.
const TOP = c => css(shade(hex(c), 1.12));
const SIDE = c => css(shade(hex(c), 0.78));
const LOW = c => css(shade(hex(c), 0.6));
const DIM = c => css(shade(hex(c), 0.45));

// Straight from the world's own palette: the road's rails and lines, the kerbs,
// the gates. The instruments are made of track furniture.
const STEEL = '#c3cad3';    // rail
const SLATE = '#3a4048';    // portal edge
const DARKEST = '#22262c';  // gate frame -- the darkest colour in the world
const PRINT = '#e2e8ef';    // road line
const AMBER = '#ffb43a';    // checkpoint gate
const GREEN = '#4fbf7a';    // start gate
const RED = '#c4423b';      // kerb

// Interior defaults. A car supplies only its paint and its proportions; every
// other tone is derived from those, the way the world derives a box's faces.
const BASE = {
  dash: '#8b929c', body: '#c3cad3',
  accent: AMBER, accent2: PRINT,
  dashScale: 1, wheelScale: 1,
};

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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

  // One place decides the geometry, so the bonnet, instruments and wheel can
  // never drift into each other.
  layout(w, h, t) {
    const dashH = Math.min(330, h * 0.32) * t.dashScale;
    const dashTop = h - dashH;
    const bonnetH = dashH * 0.2;
    const sideR = dashH * 0.24;
    return {
      dashH, dashTop, bonnetH, bonnetTop: dashTop - bonnetH,
      // The dash stands highest in the middle and falls away towards the doors,
      // and the bonnet narrows as it goes away from the driver. Both are what a
      // car looks like from the seat, and both matter here for a second reason:
      // the world behind is drawn in perspective, and a cockpit of rectangles
      // laid straight across it belongs to a different picture.
      dashSide: dashTop + dashH * 0.13,
      shoulder: w * 0.27,
      noseInset: w * 0.17,
      bandY: dashTop + dashH * 0.14,
      bandH: dashH * 0.66,
      bigR: dashH * 0.36,
      bigCy: dashTop + dashH * 0.47,
      sideR,
      // Far enough out to clear the wheel, never off the edge of a narrow
      // screen: the side dials are instruments, not decoration.
      sideDx: Math.min(w * 0.5 - sideR * 1.5 - w * 0.035,
                       Math.max(dashH * 1.2, w * 0.25)),
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

  // Pillars and roof: body panels turned away from the light, which in this
  // world means the same colour at x0.45.
  drawFrame(ctx, w, h, lay, t) {
    const foot = lay.dashSide;
    const pw = Math.max(14, w * 0.024);
    const roof = Math.max(9, h * 0.02);

    ctx.fillStyle = DIM(t.dash);
    ctx.fillRect(0, 0, w, roof);

    for (const side of [-1, 1]) {
      const x = side < 0 ? 0 : w;
      const dir = side < 0 ? 1 : -1;
      ctx.fillStyle = LOW(t.dash);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + dir * pw * 0.55, 0);
      ctx.lineTo(x + dir * pw * 1.9, foot);
      ctx.lineTo(x, foot);
      ctx.closePath();
      ctx.fill();
    }
  }

  // The nose of the car, seen over the dash: one flat panel with its top face
  // catching the light, exactly as a box in the scenery would.
  drawBonnet(ctx, w, lay, t) {
    // The panel runs down to where the dash is *lowest*, so that the dash --
    // drawn next, and shaped -- covers the join everywhere. Stopping at the
    // dash's high point instead left a sliver of road showing through between
    // the two, which reads as a hole rather than as bodywork.
    const { bonnetTop: y, dashSide: y1, noseInset: ins } = lay;
    const nose = (a, b) => {
      ctx.beginPath();
      ctx.moveTo(ins, a);
      ctx.lineTo(w - ins, a);
      ctx.lineTo(w, b);
      ctx.lineTo(0, b);
      ctx.closePath();
    };
    ctx.fillStyle = SIDE(t.body);
    nose(y, y1); ctx.fill();
    // The near edge of the panel turns up towards the driver and catches the
    // light; the far edge falls away.
    ctx.fillStyle = TOP(t.body);
    nose(y + (y1 - y) * 0.6, y1); ctx.fill();
    ctx.fillStyle = LOW(t.body);
    ctx.lineWidth = Math.max(3, (y1 - y) * 0.12);
    ctx.strokeStyle = LOW(t.body);
    ctx.beginPath();
    ctx.moveTo(ins, y);
    ctx.lineTo(w - ins, y);
    ctx.stroke();
  }

  // The outline of the moulding, used both to fill it and to keep everything
  // mounted on it from hanging over the edge.
  dashPath(ctx, w, h, lay, drop = 0) {
    const { dashTop: y, dashSide: ys, shoulder: sh } = lay;
    ctx.beginPath();
    ctx.moveTo(0, ys + drop);
    ctx.lineTo(sh, y + drop);
    ctx.lineTo(w - sh, y + drop);
    ctx.lineTo(w, ys + drop);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
  }

  drawDash(ctx, w, h, lay, t) {
    const { dashTop: y, dashH: dh, bandY, bandH } = lay;
    // Four flat faces of one moulding, in the world's own light steps: the roll
    // that faces the sky, the binnacle sunk into it that carries the
    // instruments, the face below that, and the part that turns under towards
    // the floor. Without the binnacle the dash reads as a grey bar rather than
    // as something moulded.
    ctx.fillStyle = TOP(t.dash);
    this.dashPath(ctx, w, h, lay); ctx.fill();
    ctx.fillStyle = SIDE(t.dash);
    this.dashPath(ctx, w, h, lay, Math.max(6, dh * 0.09)); ctx.fill();

    // Everything below is mounted on the moulding, so it is cut to its shape.
    ctx.save();
    this.dashPath(ctx, w, h, lay); ctx.clip();

    // The binnacle is one polygon that rises over the instruments and falls
    // away at the sides -- a shape, not a stripe. It is the only thing that
    // stops a dashboard reading as a grey bar, and a single flat polygon is
    // exactly how the world outside would have built it.
    const rise = dh * 0.13;
    const hood = () => {
      ctx.beginPath();
      ctx.moveTo(0, bandY + rise);
      ctx.lineTo(w * 0.13, bandY + rise * 0.12);
      ctx.lineTo(w * 0.87, bandY + rise * 0.12);
      ctx.lineTo(w, bandY + rise);
      ctx.lineTo(w, bandY + bandH);
      ctx.lineTo(0, bandY + bandH);
      ctx.closePath();
    };
    ctx.fillStyle = LOW(t.dash);
    hood(); ctx.fill();
    ctx.strokeStyle = DIM(t.dash);
    ctx.lineWidth = Math.max(3, dh * 0.022);
    hood(); ctx.stroke();
    ctx.fillStyle = TOP(t.dash);
    ctx.fillRect(0, bandY + bandH, w, Math.max(3, dh * 0.02));

    ctx.fillStyle = LOW(t.dash);
    ctx.fillRect(0, h - dh * 0.1, w, dh * 0.1);
    ctx.restore();
  }

  // A panel sunk into the moulding: the recess is simply the same colour with
  // the light taken off it.
  recess(ctx, x, y, w, h, t) {
    ctx.fillStyle = DIM(t.dash);
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = TOP(t.dash);
    ctx.fillRect(x, y + h, w, Math.max(2, h * 0.05));
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
      needle: slipping ? RED : t.accent,
    });

    // Tachometer, with the gear in a window under the spindle.
    this.gauge(ctx, w / 2 - sideDx, bigCy, sideR, Math.max(0, Math.min(1, st.rpm)), t, {
      ticks: 8, step: 1, every: 4, label: 'RPM x1000', redline: 0.82,
      value: st.gear, valueCol: t.accent2,
    });

    // Distance covered, read like a fuel gauge: the one thing a driver wants at
    // a glance that the top of the screen only states in numbers.
    this.gauge(ctx, w / 2 + sideDx, bigCy, sideR, st.progress, t, {
      ticks: 4, marks: ['0', '', '1/2', '', '1'], label: 'PISTA', needle: GREEN,
    });

    this.drawLeft(ctx, w, lay, st, t, slipping);
    this.drawVent(ctx, w, lay, t);
  }

  // Left panel: the speed in figures and three warning lamps. Big, flat and few,
  // because the world outside is made of big flat shapes and a cockpit of small
  // busy ones would not belong to it.
  drawLeft(ctx, w, lay, st, t, slipping) {
    const { dashTop, dashH, sideDx, sideR } = lay;
    const bw = Math.min(dashH * 1.2, w / 2 - sideDx - sideR * 1.35 - 26);
    if (bw < 64) return;
    const x = Math.max(10, w / 2 - sideDx - sideR * 1.3 - bw - 14);
    const y = dashTop + dashH * 0.2;
    const bh = dashH * 0.54;
    this.recess(ctx, x, y, bw, bh, t);

    const wh = bh * 0.52;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = slipping ? RED : PRINT;
    ctx.font = `700 ${Math.round(wh * 0.82)}px ${MONO}`;
    ctx.fillText(String(Math.round(st.speedKmh)), x + bw * 0.5, y + wh);
    ctx.fillStyle = DIM(PRINT);
    ctx.font = `700 ${Math.round(bh * 0.13)}px ${FONT}`;
    ctx.fillText('KM/H', x + bw * 0.5, y + wh + bh * 0.17);

    const lamps = [
      [st.throttle > 0.05, GREEN],
      [st.brake > 0.05, RED],
      [slipping, AMBER],
    ];
    const r = Math.max(6, bh * 0.1);
    lamps.forEach(([on, col], i) => {
      const lx = x + bw * (0.26 + i * 0.24);
      const ly = y + bh * 0.84;
      ctx.fillStyle = on ? col : DIM(t.dash);
      ctx.beginPath(); ctx.arc(lx, ly, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? css(shade(hex(col), 1.25)) : LOW(t.dash);
      ctx.beginPath(); ctx.arc(lx, ly - r * 0.3, r * 0.42, 0, Math.PI * 2); ctx.fill();
    });
  }

  // Air vent: three slats, and nothing else. The right of the dash needs mass,
  // not detail.
  drawVent(ctx, w, lay, t) {
    const { dashTop, dashH, sideDx, sideR } = lay;
    const bw = Math.min(dashH * 1.2, w / 2 - sideDx - sideR * 1.35 - 26);
    if (bw < 64) return;
    const x = Math.min(w - bw - 10, w / 2 + sideDx + sideR * 1.3 + 14);
    const y = dashTop + dashH * 0.2;
    const bh = dashH * 0.54;
    this.recess(ctx, x, y, bw, bh, t);

    const n = 3, gap = bh * 0.08, sh = (bh - gap * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const sy = y + gap + i * (sh + gap);
      ctx.fillStyle = SIDE(t.dash);
      ctx.fillRect(x + bw * 0.08, sy, bw * 0.84, sh);
      ctx.fillStyle = LOW(t.dash);
      ctx.fillRect(x + bw * 0.08, sy + sh * 0.62, bw * 0.84, sh * 0.38);
    }
  }

  // A round instrument, made the way the world makes a cylinder: a flat ring
  // lit from above, a flat face, and hard marks printed on it.
  gauge(ctx, cx, cy, r, frac, t, o = {}) {
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    const ang = a0 + (a1 - a0) * Math.max(0, Math.min(1, frac || 0));

    const ring = r * 1.16;
    ctx.fillStyle = SIDE(STEEL);
    ctx.beginPath(); ctx.arc(cx, cy, ring, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = TOP(STEEL);
    ctx.beginPath(); ctx.arc(cx, cy, ring, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SLATE;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = DARKEST;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    if (o.redline != null) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(4, r * 0.1);
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.86, a0 + (a1 - a0) * o.redline, a1);
      ctx.stroke();
    }

    const n = o.ticks || 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      const c = Math.cos(a), s = Math.sin(a);
      ctx.strokeStyle = PRINT;
      ctx.lineWidth = Math.max(2.5, r * 0.075);
      ctx.beginPath();
      ctx.moveTo(cx + c * r * 0.97, cy + s * r * 0.97);
      ctx.lineTo(cx + c * r * 0.82, cy + s * r * 0.82);
      ctx.stroke();

      // A dial this size cannot print every number legibly, so a busy face
      // prints every other one and lets the marks carry the rest.
      const mark = i % (o.every || 1) !== 0 ? null
        : (o.marks ? o.marks[i] : (o.step != null ? String(i * o.step) : null));
      if (mark) {
        ctx.fillStyle = PRINT;
        ctx.font = `700 ${Math.round(r * 0.24)}px ${MONO}`;
        ctx.fillText(mark, cx + c * r * 0.6, cy + s * r * 0.6);
      }
    }

    if (o.label) {
      ctx.fillStyle = DIM(PRINT);
      ctx.font = `700 ${Math.round(r * 0.17)}px ${FONT}`;
      ctx.fillText(o.label, cx, cy + r * 0.72);
    }

    if (o.value != null) {
      const fs = Math.round(r * 0.34);
      const vy = cy + r * 0.42;
      ctx.font = `700 ${fs}px ${MONO}`;
      const bw = Math.max(fs * 1.7, ctx.measureText(o.value).width + fs * 0.8);
      ctx.fillStyle = SLATE;
      ctx.fillRect(cx - bw / 2, vy - fs * 0.7, bw, fs * 1.4);
      ctx.fillStyle = o.valueCol || PRINT;
      ctx.fillText(o.value, cx, vy);
    }

    // Needle: a flat wedge with a stub behind the spindle, in one colour.
    const c = Math.cos(ang), s = Math.sin(ang);
    const hub = r * 0.08;
    ctx.fillStyle = o.needle || t.accent;
    ctx.beginPath();
    ctx.moveTo(cx + c * r * 0.92, cy + s * r * 0.92);
    ctx.lineTo(cx - s * hub, cy + c * hub);
    ctx.lineTo(cx - c * r * 0.18, cy - s * r * 0.18);
    ctx.lineTo(cx + s * hub, cy - c * hub);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = TOP(STEEL);
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.textBaseline = 'alphabetic';
  }

  // Seen from the driver's seat the rim is a foreshortened ellipse. It turns
  // with the lock and passes in front of the instruments, because that is where
  // a steering wheel is. Two tones, lit from above, like every other round thing
  // in this world.
  drawWheel(ctx, w, h, lay, st, t) {
    const { dashH, wheelRx: rx, wheelRy: ry, wheelCy: cy } = lay;
    const cx = w / 2;
    const thick = Math.max(16, dashH * 0.13);
    const turn = st.steer * 0.85;
    const top = -Math.PI / 2 + turn;
    const at = a => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];

    ctx.save();
    ctx.strokeStyle = SIDE(SLATE);
    ctx.lineWidth = thick * 0.45;
    for (const off of [-1.5, 1.5]) {
      const [px, py] = at(top + off);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(cx + (px - cx) * 0.1, cy + (py - cy) * 0.1);
      ctx.stroke();
    }

    ctx.lineWidth = thick;
    ctx.strokeStyle = SIDE(SLATE);
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = TOP(SLATE);
    ctx.lineWidth = thick * 0.42;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry - thick * 0.29, 0, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();

    // The mark that says where straight ahead is.
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = thick * 0.9;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, top - 0.045, top + 0.045);
    ctx.stroke();
    ctx.restore();
  }

  drawTop(ctx, w, h, st) {
    const pad = Math.max(14, w * 0.02);
    const top = Math.max(16, h * 0.035);
    // Flat plates in the gates' own colours, so the readouts belong to the same
    // world as the track furniture they are reporting on.
    const panel = (x, y, pw, ph) => {
      ctx.fillStyle = 'rgba(34,38,44,.82)';
      ctx.fillRect(x, y, pw, ph);
      ctx.fillStyle = SIDE(STEEL);
      ctx.fillRect(x, y, pw, 2);
    };

    ctx.textAlign = 'center';
    panel(w / 2 - 108, top, 216, 56);
    ctx.fillStyle = AMBER;
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
      ctx.fillStyle = ahead ? GREEN : RED;
      ctx.fillText(label, w / 2, top + 84);
    }

    ctx.textAlign = 'left';
    panel(pad, top, 172, 62);
    ctx.fillStyle = DIM(PRINT);
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText('CHECKPOINTS', pad + 14, top + 20);
    ctx.fillStyle = PRINT;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`${st.cpDone} / ${st.cpTotal}`, pad + 14, top + 46);

    const bx = pad + 92, bw = 66;
    ctx.fillStyle = SLATE;
    ctx.fillRect(bx, top + 34, bw, 6);
    ctx.fillStyle = GREEN;
    ctx.fillRect(bx, top + 34, Math.max(3, bw * st.progress), 6);
    ctx.fillStyle = DIM(PRINT);
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText(`${Math.round(st.progress * 100)}%`, bx, top + 22);

    ctx.textAlign = 'right';
    panel(w - pad - 172, top, 172, 62);
    ctx.fillStyle = DIM(PRINT);
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText('MELHOR', w - pad - 14, top + 20);
    ctx.fillStyle = st.bestMs == null ? DIM(PRINT) : GREEN;
    ctx.font = `700 20px ${MONO}`;
    ctx.fillText(formatTime(st.bestMs), w - pad - 14, top + 46);
  }

  drawMessage(ctx, w, h, st) {
    const y = h * 0.32;
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(Math.min(72, w * 0.09))}px ${FONT}`;
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(34,38,44,.85)';
    ctx.strokeText(st.message, w / 2, y);
    ctx.fillStyle = st.messageColor || AMBER;
    ctx.fillText(st.message, w / 2, y);
    if (st.submessage) {
      ctx.font = `600 ${Math.round(Math.min(22, w * 0.028))}px ${FONT}`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(34,38,44,.85)';
      ctx.strokeText(st.submessage, w / 2, y + 38);
      ctx.fillStyle = PRINT;
      ctx.fillText(st.submessage, w / 2, y + 38);
    }
  }
}
