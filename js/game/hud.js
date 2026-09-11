export function formatTime(ms) {
  if (ms == null) return '--:--.--';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000);
  const s = Math.floor(t / 1000) % 60;
  const c = Math.floor(t / 10) % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

// Interior defaults. Each car overrides the trim, accents and proportions via
// st.theme, so the three cockpits feel like different cars.
const BASE = {
  pillar: '#171b21', pillarEdge: '#333b46', roof: '#0e1116',
  dashHi: '#232833', dashMid: '#14181f', dashLow: '#070910',
  seam: '#4a535f', screen: '#0a0d13', screenEdge: '#29313d',
  rim: '#1c2128', rimHi: '#39424e', rimLow: '#0d1015',
  accent: '#ffb43a', accent2: '#7fd0ff', ambient: '255,180,58',
  dashScale: 1, wheelScale: 1,
};

const C = {
  amber: '#ffb43a', green: '#5fd894', red: '#ff7a7a',
  text: '#eef3f9', dim: 'rgba(198,214,236,.52)',
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

  // One place decides the geometry, so the vents, cluster and wheel can never
  // drift into each other.
  layout(w, h, t) {
    const dashH = Math.min(196, h * 0.29) * t.dashScale;
    const dashTop = h - dashH;
    const cw = Math.min(660, w * 0.58);
    const ch = dashH * 0.44;
    return {
      dashH, dashTop, cw, ch,
      cx: (w - cw) / 2,
      cy: dashTop + dashH * 0.045,
      wheelRx: dashH * 1.32 * t.wheelScale,
      wheelRy: dashH * 0.82 * t.wheelScale,
      wheelCy: h + dashH * 0.34 * t.wheelScale,
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

    this.drawGlass(ctx, w, h, lay.dashH);
    this.drawFrame(ctx, w, h, lay.dashH, t);
    this.drawDash(ctx, w, h, lay, t);
    this.drawCluster(ctx, w, h, lay, st, t);
    this.drawWheel(ctx, w, h, lay, st, t);
    this.drawTop(ctx, w, h, st);
    if (st.message) this.drawMessage(ctx, w, h, st);
  }

  // Sun strip along the top of the screen plus a soft corner falloff.
  drawGlass(ctx, w, h, dashH) {
    const glass = h - dashH;
    const tint = ctx.createLinearGradient(0, 0, 0, glass * 0.34);
    tint.addColorStop(0, 'rgba(18,30,52,.62)');
    tint.addColorStop(1, 'rgba(18,30,52,0)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, glass * 0.34);

    const vig = ctx.createRadialGradient(w / 2, glass * 0.52, glass * 0.34, w / 2, glass * 0.52, glass * 1.05);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,.38)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, glass);
  }

  drawFrame(ctx, w, h, dashH, t) {
    const glass = h - dashH;
    const pw = Math.max(24, w * 0.042);
    const roof = Math.max(12, h * 0.024);

    for (const side of [-1, 1]) {
      const x = side < 0 ? 0 : w;
      const dir = side < 0 ? 1 : -1;
      ctx.fillStyle = t.pillar;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + dir * pw * 0.62, 0);
      ctx.quadraticCurveTo(x + dir * pw * 1.5, glass * 0.62, x + dir * pw * 1.28, glass);
      ctx.lineTo(x, glass);
      ctx.closePath();
      ctx.fill();

      // Inner trim highlight, so the pillar reads as a moulded edge.
      ctx.strokeStyle = t.pillarEdge;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + dir * pw * 0.62, 0);
      ctx.quadraticCurveTo(x + dir * pw * 1.5, glass * 0.62, x + dir * pw * 1.28, glass);
      ctx.stroke();
    }

    const head = ctx.createLinearGradient(0, 0, 0, roof * 1.8);
    head.addColorStop(0, t.roof);
    head.addColorStop(1, 'rgba(14,17,22,0)');
    ctx.fillStyle = head;
    ctx.fillRect(0, 0, w, roof * 1.8);
    ctx.fillStyle = t.roof;
    ctx.fillRect(0, 0, w, roof);

    // Rear-view mirror
    const mw = Math.min(132, w * 0.13), mh = Math.max(20, mw * 0.28);
    const mx = w / 2 - mw / 2, my = roof * 0.55;
    ctx.fillStyle = '#1a1e25';
    this.roundRect(ctx, mx, my, mw, mh, mh * 0.42);
    ctx.fill();
    const glassG = ctx.createLinearGradient(0, my, 0, my + mh);
    glassG.addColorStop(0, 'rgba(120,150,190,.30)');
    glassG.addColorStop(1, 'rgba(40,55,80,.16)');
    ctx.fillStyle = glassG;
    this.roundRect(ctx, mx + 3, my + 3, mw - 6, mh - 6, (mh - 6) * 0.4);
    ctx.fill();
  }

  dashCurve(ctx, w, y, dashH) {
    ctx.beginPath();
    ctx.moveTo(0, y + dashH * 0.14);
    ctx.quadraticCurveTo(w / 2, y - dashH * 0.09, w, y + dashH * 0.14);
  }

  drawDash(ctx, w, h, lay, t) {
    const { dashH, cx, cw, cy, ch } = lay;
    const y = h - dashH;

    const g = ctx.createLinearGradient(0, y - dashH * 0.09, 0, h);
    g.addColorStop(0, t.dashHi);
    g.addColorStop(0.14, t.dashMid);
    g.addColorStop(1, t.dashLow);
    ctx.fillStyle = g;
    this.dashCurve(ctx, w, y, dashH);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // Ambient light strip: several widening passes instead of shadowBlur.
    for (const [width, alpha] of [[7, 0.05], [4, 0.09], [2, 0.2], [1.1, 0.5]]) {
      ctx.strokeStyle = `rgba(${t.ambient},${alpha})`;
      ctx.lineWidth = width;
      this.dashCurve(ctx, w, y, dashH);
      ctx.stroke();
    }

    // Stitched seam below the top edge
    ctx.strokeStyle = t.seam;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(0, y + dashH * 0.28);
    ctx.quadraticCurveTo(w / 2, y + dashH * 0.05, w, y + dashH * 0.28);
    ctx.stroke();
    ctx.setLineDash([]);

    const vw = Math.min(190, (cx - w * 0.045) * 0.82);
    if (vw > 60) {
      this.vent(ctx, cx - 26 - vw, cy + ch * 0.18, vw, ch * 0.62);
      this.vent(ctx, cx + cw + 26, cy + ch * 0.18, vw, ch * 0.62);
    }
  }

  // Slim horizontal air vent: fills the dash without competing with the dials.
  vent(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(4,6,10,.55)';
    this.roundRect(ctx, x, y, w, h, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,175,215,.13)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, w, h, 7);
    ctx.stroke();

    const slats = 4;
    for (let i = 0; i < slats; i++) {
      const sy = y + h * (i + 0.62) / (slats + 0.25);
      ctx.strokeStyle = i % 2 ? 'rgba(150,175,205,.10)' : 'rgba(150,175,205,.17)';
      ctx.lineWidth = Math.max(2, h * 0.09);
      ctx.beginPath();
      ctx.moveTo(x + 7, sy);
      ctx.lineTo(x + w - 7, sy);
      ctx.stroke();
    }
  }

  drawCluster(ctx, w, h, lay, st, t) {
    const { cx, cy, cw, ch } = lay;
    const r = ch * 0.36;

    ctx.fillStyle = t.screen;
    this.roundRect(ctx, cx, cy, cw, ch, 14);
    ctx.fill();

    // Gloss sweep across the cluster glass
    ctx.save();
    this.roundRect(ctx, cx, cy, cw, ch, 14);
    ctx.clip();
    const gloss = ctx.createLinearGradient(cx, cy, cx + cw * 0.55, cy + ch);
    gloss.addColorStop(0, 'rgba(255,255,255,.055)');
    gloss.addColorStop(0.55, 'rgba(255,255,255,.012)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.restore();

    ctx.strokeStyle = t.screenEdge;
    ctx.lineWidth = 1.2;
    this.roundRect(ctx, cx, cy, cw, ch, 14);
    ctx.stroke();

    const mid = cy + ch / 2;
    const slipping = st.slip > 0.35;
    this.dial(ctx, cx + cw * 0.19, mid, r, st.speedKmh / (st.topKmh || 240),
              Math.round(st.speedKmh), 'km/h', slipping ? C.red : t.accent);
    this.dial(ctx, cx + cw * 0.81, mid, r, st.rpm, st.gear, 'mudança', t.accent2);

    // Pedal readouts between the dials
    const bw = 9, gap = 17;
    this.pedal(ctx, w / 2 - gap - bw, mid - r * 0.78, bw, r * 1.35, st.brake, C.red);
    this.pedal(ctx, w / 2 + gap, mid - r * 0.78, bw, r * 1.35, st.throttle, C.green);

    ctx.textAlign = 'center';
    ctx.fillStyle = C.dim;
    ctx.font = `600 10px ${FONT}`;
    ctx.fillText('TRAV', w / 2 - gap - bw / 2, mid + r * 1.0);
    ctx.fillText('ACEL', w / 2 + gap + bw / 2, mid + r * 1.0);
  }

  // Thin arc with a digital readout: no needle, modern instrument style.
  dial(ctx, cx, cy, r, frac, value, label, col) {
    frac = Math.max(0, Math.min(1, frac));
    const a0 = Math.PI * 0.72, a1 = Math.PI * 2.28;

    ctx.lineWidth = Math.max(3, r * 0.13);
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * (i / 10);
      const c = Math.cos(a), s = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(cx + c * r * 1.12, cy + s * r * 1.12);
      ctx.lineTo(cx + c * r * (i % 5 === 0 ? 1.24 : 1.19), cy + s * r * (i % 5 === 0 ? 1.24 : 1.19));
      ctx.stroke();
    }

    if (frac > 0.001) {
      const end = a0 + (a1 - a0) * frac;
      ctx.lineCap = 'round';
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(3, r * 0.13);
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, end); ctx.stroke();
      ctx.lineCap = 'butt';

      const dx = cx + Math.cos(end) * r, dy = cy + Math.sin(end) * r;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(dx, dy, r * 0.115, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath(); ctx.arc(dx, dy, r * 0.05, 0, Math.PI * 2); ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = C.text;
    ctx.font = `700 ${Math.round(r * 0.68)}px ${MONO}`;
    ctx.fillText(value, cx, cy + r * 0.16);
    ctx.fillStyle = C.dim;
    ctx.font = `600 ${Math.round(r * 0.26)}px ${FONT}`;
    ctx.fillText(label, cx, cy + r * 0.58);
  }

  // Segmented bar, so it reads as an instrument rather than a progress meter.
  pedal(ctx, x, y, w, h, v, col) {
    const n = 9, seg = h / n, pad = 2.4;
    const lit = Math.round(Math.max(0, Math.min(1, v)) * n);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i < lit ? col : 'rgba(255,255,255,.08)';
      ctx.fillRect(x, y + h - (i + 1) * seg, w, seg - pad);
    }
  }

  // Seen from the driver's seat the rim is a foreshortened ellipse, so the shape
  // holds still and the grips travel along it to show the steering angle.
  drawWheel(ctx, w, h, lay, st, t) {
    const { dashH, wheelRx: rx, wheelRy: ry, wheelCy: cy } = lay;
    const cx = w / 2;
    const thick = Math.max(12, dashH * 0.095);
    const turn = st.steer * 0.85;

    ctx.save();
    ctx.lineWidth = thick;
    ctx.strokeStyle = t.rim;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

    ctx.lineWidth = thick * 0.30;
    ctx.strokeStyle = t.rimHi;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry - thick * 0.34, 0, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();

    ctx.lineWidth = thick * 0.22;
    ctx.strokeStyle = t.rimLow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry + thick * 0.32, 0, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();

    const at = a => [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
    const top = -Math.PI / 2 + turn;

    // Centre marker
    ctx.lineWidth = thick * 0.86;
    ctx.strokeStyle = t.accent;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, top - 0.055, top + 0.055);
    ctx.stroke();

    // Thumb grips
    ctx.strokeStyle = t.rimHi;
    ctx.lineWidth = thick * 1.22;
    for (const off of [-0.62, 0.62]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, top + off - 0.15, top + off + 0.15);
      ctx.stroke();
    }

    // Spokes reaching down to the hub below the frame
    ctx.strokeStyle = t.rim;
    ctx.lineWidth = thick * 0.7;
    for (const off of [-1.5, 1.5]) {
      const [px, py] = at(top + off);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(cx + (px - cx) * 0.18, cy);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTop(ctx, w, h, st) {
    const pad = Math.max(14, w * 0.02);
    const top = Math.max(16, h * 0.035);
    const panel = (x, y, pw, ph) => {
      ctx.fillStyle = 'rgba(8,11,17,.62)';
      this.roundRect(ctx, x, y, pw, ph, 11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,175,215,.16)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, x, y, pw, ph, 11);
      ctx.stroke();
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
    this.roundRect(ctx, bx, top + 34, bw, 6, 3);
    ctx.fill();
    ctx.fillStyle = C.green;
    this.roundRect(ctx, bx, top + 34, Math.max(3, bw * st.progress), 6, 3);
    ctx.fill();
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
    const y = h * 0.34;
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

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
