import { Renderer } from '../core/renderer.js';
import { buildTrack } from '../world/track.js';
import { buildSky, buildGround, buildScenery } from '../world/scenery.js';
import { Car, MODE, gearFor } from './car.js';
import { CARS } from './cars.js';
import { Hud } from './hud.js';
import { clamp } from '../core/math.js';
import { GhostRecorder, GhostPlayer, buildGhostMesh, ghostModelMatrix,
         loadGhost, saveGhost, clearGhost,
         GHOST_ALPHA, GHOST_AMBIENT } from './ghost.js';

const bestKey = id => `velocidadecega.best.${id}`;

// Records are per track, not per car: picking the right car for the circuit is
// part of the game, so the record names the car that set it. Older records were
// stored as a bare number, and those are real user data worth keeping.
export function getBest(id) {
  let v = null;
  try { v = localStorage.getItem(bestKey(id)); } catch { return null; }
  if (v == null) return null;
  if (/^\d+$/.test(v)) return { ms: Number(v), car: null };
  try { return JSON.parse(v); } catch { return null; }
}

function saveBest(id, ms, car) {
  try {
    localStorage.setItem(bestKey(id), JSON.stringify({ ms: Math.round(ms), car }));
  } catch { /* private mode */ }
}

export const STATE = {
  IDLE: 'idle', COUNTDOWN: 'countdown', RACING: 'racing',
  PAUSED: 'paused', FINISHED: 'finished',
};

export class Game {
  constructor(glCanvas, hudCanvas, input, sound = null) {
    this.renderer = new Renderer(glCanvas);
    this.hud = new Hud(hudCanvas);
    this.input = input;
    this.sound = sound;
    this.state = STATE.IDLE;
    this.car0 = CARS[1];   // selected model; the middle one by default
    this.chunks = { sky: null, ground: [], scenery: [], road: [], tunnel: [], gates: [] };
    this.msg = null;
    this.onFinish = () => {};
    // Laps are always recorded -- it costs nothing and a record set anywhere
    // should be raceable anywhere -- but the ghost is only drawn where the
    // interface asks for it, so the desktop game stays exactly as it was.
    this.showGhost = false;
    this.ghost = null;
    this.ghostChunk = null;
    this.ghostRec = null;
    this.ghostDelta = null;
    this.lastTime = 0;
    this.fov = 70;
    this.raf = null;
  }

  load(def) {
    const r = this.renderer;
    for (const k of ['ground', 'scenery', 'road', 'tunnel', 'gates']) r.dispose(this.chunks[k]);
    if (this.chunks.sky) r.dispose([this.chunks.sky]);

    const track = buildTrack(def);
    this.track = track;
    this.chunks = {
      sky: r.upload(buildSky()),
      ground: buildGround(track.bounds).map(m => r.upload(m)),
      scenery: buildScenery(track).map(m => r.upload(m)),
      road: track.roadMeshes.map(m => r.upload(m)),
      tunnel: track.tunnelMeshes.map(m => r.upload(m)),
      gates: track.gateMeshes.map(m => r.upload(m)),
    };
    this.car = new Car(track, this.car0.phys);
    this.def = def;
    this.best = getBest(def.id);
    this.loadGhostFor(def.id);
    this.restart();
  }

  loadGhostFor(id) {
    const r = this.renderer;
    if (this.ghostChunk) { r.dispose([this.ghostChunk]); this.ghostChunk = null; }
    this.ghost = null;
    const data = loadGhost(id);
    if (!data) return;
    // A ghost whose lap is slower than the stored record is stale -- the record
    // was set elsewhere, or the ghost failed to save -- so it is not shown.
    const best = getBest(id);
    if (best && data.ms > best.ms + 1) return;
    this.ghost = new GhostPlayer(data, this.track);
    const car = CARS.find(c => c.id === data.car);
    this.ghostChunk = r.upload(buildGhostMesh(car && car.theme.accent));
  }

  restart() {
    this.car.respawnS = 0;
    this.car.reset(0);
    this.timeMs = 0;
    this.cpIndex = 0;
    this.state = STATE.COUNTDOWN;
    this.countdown = 3.6;
    this.msg = null;
    this.finalTime = null;
    this.newRecord = false;
    this.lastBeep = null;
    this.ghostRec = new GhostRecorder(this.track);
    this.ghostDelta = null;
    if (this.ghost) this.ghost.reset();
  }

  setMessage(text, sub = '', color = '#ffb43a', time = 1.4) {
    this.msg = { text, sub, color, time };
  }

  pause() { if (this.state === STATE.RACING || this.state === STATE.COUNTDOWN) this.state = STATE.PAUSED; }
  resume() { if (this.state === STATE.PAUSED) this.state = this.countdown > 0 ? STATE.COUNTDOWN : STATE.RACING; }

  start() {
    if (this.raf) return;
    this.lastTime = performance.now();
    const tick = now => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  frame(dt) {
    const input = this.input.poll();
    const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false };

    if (this.state === STATE.COUNTDOWN) {
      this.countdown -= dt;
      this.car.update(dt, idle);
      if (this.countdown <= 0) {
        this.state = STATE.RACING;
        this.setMessage('JÁ!', '', '#5fd894', 0.8);
      }
    } else if (this.state === STATE.RACING) {
      this.timeMs += dt * 1000;
      this.car.update(dt, input);
      this.ghostRec.sample(this.car, this.timeMs);
      this.updateGhostDelta();
      this.checkProgress();
    } else if (this.state === STATE.FINISHED) {
      this.car.update(dt, idle);
    } else {
      this.car.updateCamera(dt);
    }

    if (this.msg) {
      this.msg.time -= dt;
      if (this.msg.time <= 0) this.msg = null;
    }

    this.render(dt);
  }

  // How far ahead or behind the record holder you are, in milliseconds:
  // positive means the ghost reached this point sooner, so you are losing.
  updateGhostDelta() {
    if (!this.showGhost || !this.ghost) { this.ghostDelta = null; return; }
    const tg = this.ghost.timeAt(this.car.s);
    this.ghostDelta = tg == null ? null : this.timeMs - tg;
  }

  checkProgress() {
    const car = this.car;
    const cps = this.track.checkpoints;

    if (this.cpIndex < cps.length && car.s >= cps[this.cpIndex]) {
      car.respawnS = Math.max(0, cps[this.cpIndex] - 4);
      this.cpIndex++;
      this.setMessage('CHECKPOINT', `${this.cpIndex} / ${cps.length}`, '#5fd894', 1.1);
      if (this.sound) this.sound.checkpoint();
    }

    if (car.mode === MODE.CRASHED && !this.crashShown) {
      this.crashShown = true;
      this.setMessage('FORA!', car.crashReason || '', '#ff7a7a', 1.2);
      if (this.sound) this.sound.crash();
    }
    if (car.mode !== MODE.CRASHED) this.crashShown = false;

    if (this.cpIndex >= cps.length && car.s >= this.track.length - 12) {
      this.finish();
    }
  }

  finish() {
    this.state = STATE.FINISHED;
    this.finalTime = this.timeMs;
    const prev = getBest(this.def.id);
    this.newRecord = prev == null || this.finalTime < prev.ms;
    if (this.newRecord) {
      saveBest(this.def.id, this.finalTime, this.car0.id);
      this.best = { ms: Math.round(this.finalTime), car: this.car0.id };
      // The lap just driven becomes the ghost to beat. If storage refuses it,
      // drop any older ghost rather than leave one that no longer matches the
      // record it claims to be.
      if (saveGhost(this.def.id, this.ghostRec, this.car0.id, this.finalTime)) {
        this.loadGhostFor(this.def.id);
      } else {
        clearGhost(this.def.id);
        this.loadGhostFor(this.def.id);
      }
    }
    if (this.sound) this.sound.finish(this.newRecord);
    this.onFinish({ time: this.finalTime, best: this.best, record: this.newRecord });
  }

  render(dt) {
    const car = this.car;
    const targetFov = 68 + clamp(Math.abs(car.v), 0, 63) * 0.27;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 5);

    const r = this.renderer;
    r.beginFrame(car.camQuat, car.camPos, this.fov);
    r.drawSky(this.chunks.sky);
    r.draw(this.chunks.ground, 0.66);
    r.draw(this.chunks.scenery, 0.58);
    r.draw(this.chunks.road, 0.72);
    r.draw(this.chunks.tunnel, 0.5);   // darker, so a bore feels enclosed
    r.draw(this.chunks.gates, 0.66);

    // Drawn last, over the finished scene, because it is blended.
    if (this.showGhost && this.ghost && this.ghostChunk
        && this.state !== STATE.COUNTDOWN) {
      const pose = this.ghost.at(this.timeMs);
      if (pose) r.drawGhost(this.ghostChunk, ghostModelMatrix(pose), GHOST_AMBIENT, GHOST_ALPHA);
    }

    let message = '', sub = '', color = '#ffb43a';
    if (this.state === STATE.COUNTDOWN) {
      const n = Math.ceil(this.countdown - 0.6);
      message = n > 0 ? String(n) : 'JÁ!';
      sub = n > 0 ? 'Prepara-te' : '';
      color = n > 0 ? '#ffb43a' : '#5fd894';
      if (n !== this.lastBeep) {
        this.lastBeep = n;
        if (this.sound) this.sound.countdown(n);
      }
    } else if (this.msg) {
      message = this.msg.text; sub = this.msg.sub; color = this.msg.color;
    } else if (car.mode === MODE.ROAD && car.gForce < 0.4) {
      const f = this.track.frameAt(car.s);
      if (f.up[1] < 0.45) { message = 'ACELERA!'; color = '#ff7a7a'; }
    }

    const speed = car.speedKmh;
    const topKmh = this.car0.phys.vmax * 3.6;
    const { gear, rpm } = gearFor(speed, topKmh);

    if (this.sound) {
      this.sound.update({
        active: this.state === STATE.COUNTDOWN || this.state === STATE.RACING,
        rpm,
        throttle: this.input.throttle,
        speedKmh: speed,
        squeal: Math.max(car.slip - 0.12, car.onCurb ? 0.3 : 0),
        // Only the road can lose grip: airborne, car.slip still holds whatever
        // it read at take-off, and the tyres are not touching anything.
        slip: car.mode === MODE.ROAD ? car.slip : 0,
      });
      this.sound.follow(car);
    }

    this.hud.draw({
      speedKmh: speed,
      topKmh,
      theme: this.car0.theme,
      rpm,
      gear: car.v < -0.5 ? 'R' : String(gear),
      steer: car.steer / this.car0.phys.maxSteer,
      throttle: this.input.throttle,
      brake: this.input.brake,
      slip: car.slip,
      timeMs: this.timeMs,
      bestMs: this.best ? this.best.ms : null,
      cpDone: this.cpIndex,
      cpTotal: this.track.checkpoints.length,
      progress: clamp(car.s / this.track.length, 0, 1),
      ghostDelta: this.ghostDelta,
      message, submessage: sub, messageColor: color,
    });
  }
}
