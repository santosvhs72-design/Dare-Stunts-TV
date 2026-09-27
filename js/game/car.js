import { quat, v3, clamp } from '../core/math.js';
import { ROAD_HALF, WALL_U } from '../world/track.js';
import { GROUND_Y } from '../world/scenery.js';

const G = 9.81;
const STEER_RATE = 4.6;     // rad/s of lock movement
const WALL_BOUNCE = 0.22;   // fraction of the sideways hit that comes back
const WALL_BITE = 0.95;     // speed lost per m/s of sideways impact
const WALL_SCRUB = 18;      // m/s^2 lost while held hard against the barrier
const GRIP_SHARE = 0.4;     // how much of the friction budget power steals
const BRAKE_SHARE = 0.15;   // ... and how much braking does, nose-down and loaded
// Stopping is not limited by the cornering figure. aLatMax is what one end of
// the car can hold sideways; braking is all four wheels pulling the same way,
// on a nose that has just dived onto them, with the engine helping. Capping the
// brake at 0.95 of the cornering limit made the per-car brake figure below dead
// letter -- every car stopped at whatever its grip allowed and the "Travagem"
// bars meant nothing. The cap still bites where grip really is gone: on the
// kerb, and over a crest where there is no weight on the wheels at all.
const BRAKE_GRIP = 1.35;
// How much harder the air pushes back on a car standing on its brakes than on
// one merely coasting. The friction part of a stop is the same at any speed, so
// on its own it takes speed out in a straight line and the first moment of a
// stop from the top of sixth feels like nothing is happening. This term is the
// one that grows with speed, and it is what makes the start of the stop bite.
const BRAKE_DRAG = 3;
const HANDBRAKE_HOLD = 0.5; // fraction of REAR grip left when it is pulled
const HANDBRAKE_YAW = 0.95; // rad/s of extra rotation as the rear is locked
const VU_DECAY = 3.2;       // how fast the tyres scrub a slide off
const SUBSTEP = 1 / 120;

// Weight transfer, and why the car has two ends instead of one.
//
// A single friction budget can only ever be spent or not spent: a car built on
// one can understeer, and it can slide bodily sideways, but it can never
// rotate, because there is nothing in it that knows the difference between the
// end that steers and the end that drives. Every corner therefore felt the
// same -- run out of grip and the nose washes wide, whatever you did with your
// feet -- and the handbrake needed a special case of its own to produce the
// one thing the model could not.
//
// So the load is split. `h/L` is the whole of the arithmetic: each metre per
// second squared of acceleration moves that fraction of the car's weight from
// one axle to the other, and everything a driver recognises falls out of it
// without being asked for. Braking loads the wheels that steer, so the car
// turns in. Power loads the ones that drive and unloads the ones that steer,
// so it washes wide. Lifting off mid-corner hands the front more than it had
// and takes it off the back, so the tail comes round. None of it is scripted.
const CG_H = 0.38;          // centre of mass above the road, m
const WEIGHT_F = 0.46;      // static share of the weight carried by the front
const BRAKE_BIAS = 0.64;    // share of the braking done by the front axle
// Rear excess turned into rotation: a rear axle past its limit does not just
// slide, it swings. Divided by speed, because the same sideways force turns a
// slow car much faster than a quick one.
const OVERSTEER_YAW = 1.45;
// How much of the rear's excess is left over to push the car bodily sideways
// once it has been spent rotating it. Understeer ploughs; oversteer pivots.
const REAR_SCRUB = 0.45;

// The gearbox, felt rather than merely heard. The revs have always swept and
// dropped for the engine note while the car went on pulling through all of it
// as though it had one infinitely long gear. Two things change that, and
// neither of them is allowed to make the car quicker or slower overall: a
// torque curve, best a little before the limiter and softer at both ends
// (`PULL`, which averages 1 across the range a gear actually uses), and the
// change itself, which is a real hole in the drive rather than a number.
// Scaled so that the curve *and* the five changes together come to the same
// work as the flat pull they replace: measured against the flat model over 0
// to 150 km/h, and trimmed until the two agree to a tenth of a second. A
// gearbox is meant to be felt, not to be a tax.
const PULL = [0.810, 0.628, -0.425];   // a + b*rpm + c*rpm^2, peak ~1.04 at 0.74
const SHIFT_CUT = 0.06;     // seconds of the change itself
const SHIFT_TORQUE = 0.35;  // what is left of the drive while it happens
const SHIFT_LOCK = 0.25;    // ... and the pause before another can be cut

// The body, on its springs. None of this moves the car: it is what sits on top
// of a path that is already decided, and it is most of what a driver actually
// feels. Three spring steps a frame, not four wheels' worth.
const ROLL_PER_A = 0.0055;  // rad of lean per m/s^2 sideways (~3.8 deg at 1.2g)
const PITCH_PER_A = 0.0022; // rad of dive per m/s^2 fore and aft
const W_ROLL = 2 * Math.PI * 1.5, Z_ROLL = 0.78;
const W_PITCH = 2 * Math.PI * 1.8, Z_PITCH = 0.85;
const W_HEAVE = 2 * Math.PI * 2.2, Z_HEAVE = 0.55;
// A kerb, as the body reads it. The ridges are counted per metre rather than
// per second, so the rumble rises with speed the way the real thing does --
// but at a spacing no real kerb has: three ridges to the metre is eighty hertz
// at racing speed, which is not something a picture at sixty frames can show
// at all. This is the frequency that reads as a kerb once the screen has had
// its say. It is also laid on top of the springs rather than fed into them: a
// suspension at 2 Hz swallows a rumble whole, which is exactly its job in a
// real car and exactly the wrong outcome here.
const CURB_RIDGE = 0.42;    // ridges per metre
const CURB_LIFT = 0.014;    // metres of shake at full chat
const CURB_LEAN = 0.009;    // ... and radians of it
const CURB_FADE = 9;        // how fast it dies once the wheels are back on

// One step of a damped spring, without allocating anything to do it.
const springV = (x, v, target, w, zeta, dt) =>
  v + ((target - x) * w * w - v * 2 * zeta * w) * dt;

// Per-car handling. Coast braking is weighted toward engine braking rather than
// aero drag: a big quadratic term would make coasting nearly as strong as the
// brake at top speed, since braking is grip-limited, and the pedal would stop
// mattering. Used when no car spec is supplied (autopilot probes, tests).
export const DEFAULT_PHYS = {
  vmax: 63,          // m/s asymptote under full throttle
  accel: 8.8,
  brake: 18.5,
  mu: 1.45,
  muCurb: 0.95,      // two wheels over the line, on the kerb
  maxSteer: 0.6,     // rad, standstill lock
  wheelbase: 2.75,
  coastBase: 3.2,
  coastDrag: 0.0011,
  assist: 0.85,      // gentle realignment with the track
};

export const MODE = { ROAD: 0, AIR: 1, CRASHED: 2 };

// Slip at which the car is audibly and visibly away from you: the speedo turns
// red, the grip lamp lights and the tyres chirp. One number, so the warning a
// driver sees and the one they hear can never disagree.
export const SLIP_WARN = 0.35;

// Speed at which each gear tops out. Scaled by the car's own top speed, so
// every car still pulls sixth at its own maximum.
const GEAR_TOPS = [0, 50, 85, 122, 160, 196, 232];
// A gearbox does not change back down at the speed it changed up at. Without
// the margin, a car sitting on a change-up speed shifts twice a second for
// ever -- and once the shift itself costs a fraction of a second of drive, the
// cut is what pushes it back below the line that caused it.
const GEAR_HYST = 8;   // km/h, at the reference top speed
const IDLE = 0.24;     // lowest the needle ever reads

// Which gear, and how hard the engine is turning in it.
//
// Engine speed is road speed divided by the gear, and the gear is chosen so
// the limiter falls exactly at the top of its band -- so the revs are simply
// `speed / top of this gear`, and the drop at a change is the ratio between
// two gears and nothing else. First to second here is 50/85, so the needle
// falls to three fifths; fifth to sixth is 196/232 and it barely moves. That
// is what a gearbox sounds like. Stretching each band over the same full
// sweep, as this did, gave every change the same enormous drop and made the
// engine note a siren that restarted six times on the way to top speed.
export function gearFor(speedKmh, topKmh = 232, held = 0) {
  const k = topKmh / 232;
  let g = 1;
  while (g < 6 && speedKmh > GEAR_TOPS[g] * k) g++;
  if (held > g && held <= 6 && speedKmh > (GEAR_TOPS[held - 1] - GEAR_HYST) * k) g = held;
  return { gear: g, rpm: clamp(speedKmh / (GEAR_TOPS[g] * k), IDLE, 1) };
}

const approach = (cur, target, rate, dt) => {
  const d = target - cur, m = rate * dt;
  return Math.abs(d) <= m ? target : cur + Math.sign(d) * m;
};

export class Car {
  constructor(track, phys) {
    this.track = track;
    this.phys = { ...DEFAULT_PHYS, ...(phys || {}) };
    this.respawnS = 0;
    this.reset(0);   // also seeds the camera; do not clear it afterwards
    // Counters, not flags: the audio layer remembers which it has already played,
    // so nothing has to reach in and clear them. Not reset on respawn.
    this.wallHits = 0;
    this.wallForce = 0;
    this.landings = 0;
    this.landForce = 0;
  }

  reset(s) {
    this.mode = MODE.ROAD;
    this.s = s;
    this.u = 0;
    this.v = 0;
    this.vu = 0;
    this.psi = 0;
    this.steer = 0;
    this.pos = [0, 0, 0];
    this.vel = [0, 0, 0];
    this.q = quat.id();
    this.angVel = [0, 0, 0];
    this.airTime = 0;
    this.prevH = 1;
    this.crashTimer = 0;
    this.onCurb = false;
    this.slip = 0;
    this.understeer = 0;
    this.gForce = 1;
    this.latAcc = 0;
    this.longAcc = 0;
    this.gear = 1;
    this.rpm = 0.22;
    this.shiftT = -1;
    this.shifting = false;
    this.roll = 0; this.rollV = 0;
    this.pitch = 0; this.pitchV = 0;
    this.heave = 0; this.heaveV = 0;
    this.rumble = 0;
    const f = this.track.frameAt(s);
    this._camP = v3.mad(f.pos, f.up, 1.15);
    this._camQ = f.sq;
    this.camPos = this._camP;
    this.camQuat = this._camQ;
    this._acc = 0;
  }

  get speedKmh() { return Math.abs(this.v) * 3.6; }

  crash(reason) {
    this.mode = MODE.CRASHED;
    this.crashTimer = 1.15;
    this.crashReason = reason;
    this.v = 0;
    this.vu = 0;
    // Nothing is loading the springs any more, so the body has to be told to
    // come back level -- otherwise a car that crashed mid-corner sits there
    // for the whole second and a bit with the horizon still leaning.
    this.latAcc = 0;
    this.longAcc = 0;
  }

  update(dt, input) {
    this._acc += Math.min(dt, 0.1);
    let steps = 0;
    while (this._acc >= SUBSTEP && steps < 12) {
      this._acc -= SUBSTEP;
      this.step(SUBSTEP, input);
      steps++;
    }
    this.updateCamera(dt);
  }

  step(dt, input) {
    if (this.mode === MODE.CRASHED) {
      this.crashTimer -= dt;
      if (this.crashTimer <= 0) this.reset(this.respawnS);
      return;
    }
    if (this.mode === MODE.AIR) this.stepAir(dt, input);
    else this.stepRoad(dt, input);
  }

  stepRoad(dt, input) {
    const f = this.track.frameAt(this.s);

    if (f.gap) { this.detach(f); return; }

    this.onCurb = Math.abs(this.u) > ROAD_HALF;

    const P = this.phys;
    const v = this.v;
    const absV = Math.abs(v);

    // Normal load per unit mass: path curvature plus gravity along the surface
    // normal. Going negative means the track can no longer hold the car — too
    // slow through a loop or corkscrew and you fall off it.
    const N = v * v * f.kUp + G * f.up[1];
    this.gForce = N / G;
    if (N < 0) { this.detach(f); return; }

    const aLatMax = (this.onCurb ? P.muCurb : P.mu) * Math.max(N, 0.4);
    const handbrake = input.handbrake && absV > 2 ? 1 : 0;

    // Longitudinal
    const heading = v3.add(v3.scale(f.fwd, Math.cos(this.psi)), v3.scale(f.right, Math.sin(this.psi)));
    let aLong = -G * heading[1];
    // The brake wins over the throttle, as it does in the pedal box of any car
    // built this century. It matters more here than in a car: a button is not a
    // pedal, the throttle is held down out of habit, and letting the engine
    // push against the brake was quietly eating a third of the stop.
    const throttle = input.brake > 0 ? 0 : input.throttle;
    const drive = this.drive(absV, dt, throttle);
    if (throttle > 0) aLong += throttle * drive * (this.onCurb ? 0.85 : 1);
    if (input.brake > 0) {
      const bmax = Math.min(P.brake, aLatMax * BRAKE_GRIP);
      if (v > 0.4) aLong -= input.brake * bmax;
      else aLong -= input.brake * P.accel * 0.45;   // reverse
    }
    // Engine braking and air resistance do not stop existing because the brake
    // went down -- and they are the part that scales with speed, so they are
    // what makes the first moment of a stop from top speed bite hardest. Left
    // out of a braking car, as they were, the brake lost the one thing that
    // lifting off still had. Closed throttle is the condition, not an idle
    // pedal, so this still never caps top speed.
    // A gear change disconnects the engine, so for as long as it lasts the car
    // is coasting -- but with the clutch out there is no engine braking
    // either, only air. Leaving the whole coast term in would have made every
    // shift a small stab of the brakes.
    if (throttle === 0 || this.shifting) {
      const drag = P.coastDrag * v * v * (input.brake > 0 ? BRAKE_DRAG : 1);
      aLong -= Math.sign(v) * (this.shifting ? drag : P.coastBase + drag);
    }
    if (this.onCurb) aLong -= Math.sign(v) * 1.6;
    if (handbrake) aLong -= Math.sign(v) * 7;

    this.v += aLong * dt;
    if (this.v < -9) this.v = -9;
    if (this.v > P.vmax * 1.02) this.v = P.vmax * 1.02;

    // Load, axle by axle. Everything the car does in a corner comes out of
    // these two numbers, and they are only the static split with the transfer
    // added on: nothing decides in advance whether this is going to be
    // understeer or oversteer.
    // Load moves because the tyres push the road, so the transfer is capped by
    // what the tyres could actually produce. The brake is deliberately allowed
    // past the cornering figure (BRAKE_GRIP above), and without this cap that
    // licence turned into weight the car does not have: a stop at 1.9g threw
    // half the load off the back axle and the car could not be steered at all.
    const muA = this.onCurb ? P.muCurb : P.mu;
    const shift = clamp(aLong, -muA * N, muA * N) * CG_H / P.wheelbase;
    const Nf = Math.max(0.25, N * WEIGHT_F - shift);
    const Nr = Math.max(0.25, N * (1 - WEIGHT_F) + shift);
    // What each axle is already spending going forwards or stopping. Driving
    // belongs to the rear axle alone -- this is a rear-drive car, which is why
    // the throttle can be made to rotate it -- while braking is shared, nose
    // first, as the bias valve in any car of the period shares it.
    const lonF = aLong < 0 ? aLong * BRAKE_BIAS : 0;
    const lonR = aLong < 0 ? aLong * (1 - BRAKE_BIAS) : aLong;
    // Slowing down and speeding up do not cost the same cornering grip, even
    // once the load has moved: on the brakes the wheels that steer are the
    // loaded ones and the tyre gives its longitudinal work up cheaply, on the
    // power it does not. The same two shares as before, now spent one axle at
    // a time rather than out of a single pot.
    const share = aLong < 0 ? BRAKE_SHARE : GRIP_SHARE;
    const latF = Math.sqrt(Math.max(0, muA * Nf * (muA * Nf) - lonF * lonF * share));
    const latR = Math.sqrt(Math.max(0, muA * Nr * (muA * Nr) - lonR * lonR * share))
      * (handbrake ? HANDBRAKE_HOLD : 1);

    // Each axle carries lateral force in proportion to the weight it stands
    // on, so the one that runs out first is the one that sets the limit -- and
    // which one that is *is* the difference between understeer and oversteer.
    const gripF = latF / WEIGHT_F, gripR = latR / (1 - WEIGHT_F);
    const grip = Math.min(gripF, gripR);   // the corner the car can actually hold

    // Whether the corner is possible at all against the grip that is actually
    // there, not the tyres' theoretical best: hard braking or hard power
    // already spends part of the very same budget the steering lock draws
    // from, so arriving at a bend on the brakes can cost real cornering power
    // before the wheel is ever turned.
    //
    // It has to be measured here, from the road ahead, because it is the one
    // thing downstream cannot see. The axle terms below catch the car being
    // asked for more than it can give; they say nothing at all about a corner
    // taken far too fast but steered gently, where the lock quietly refuses to
    // wind on and the car runs wide without a tyre ever being overworked.
    const demand = v * v * Math.abs(f.kRight) / Math.max(grip, 1);
    this.understeer = clamp((demand - 0.95) / 0.3, 0, 1);

    // The lock the driver is offered is what the car can hold in balance, so
    // turning the wheel harder is never on its own a way to spin it. What is
    // *not* clamped is where the wheel already is: it unwinds towards the new
    // lock at the rate a wheel turns, and the moment in between -- lifting off
    // in a corner, picking the power back up, cresting a rise -- is where a
    // slide comes from. Hard-clamping it, as this did, snapped the steering
    // straight the instant grip moved and left nothing to feel.
    // Sized off the FRONT axle, not off the balanced figure above. What limits
    // how far a wheel can usefully be turned is the grip of the wheels being
    // turned, and nothing else. Sizing it off the weaker of the two ends meant
    // that the moment the rear was the weaker one -- which is every heavy
    // stop, since the nose is carrying everything -- the car simply refused to
    // steer, when what should happen is that the back comes round.
    const lock = Math.atan(Math.min(Math.tan(P.maxSteer), gripF * P.wheelbase / Math.max(v * v, 6)));
    const rate = STEER_RATE * lock / P.maxSteer + 0.6;
    this.steer = clamp(approach(this.steer, input.steer * lock, rate, dt),
      -P.maxSteer, P.maxSteer);

    const gravLat = G * f.right[1];
    const omegaCmd = absV > 0.8 ? this.v * Math.tan(this.steer) / P.wheelbase : 0;
    const aTyreReq = this.v * omegaCmd + gravLat;

    // Each end carries its share of what is being asked and holds what it can.
    // What the front cannot hold is the car not turning; what the rear cannot
    // hold is the car turning further than the front wheels ever asked for.
    const reqF = aTyreReq * WEIGHT_F, reqR = aTyreReq * (1 - WEIGHT_F);
    const holdF = clamp(reqF, -latF, latF);
    const holdR = clamp(reqR, -latR, latR);
    const exF = reqF - holdF, exR = reqR - holdR;
    const aTyre = holdF + holdR;

    // How far past what the tyres can hold the car is, and at which end.
    const loose = Math.abs(exR) / Math.max(latR, 1);
    this.slip = Math.min(1, Math.max(loose,
      Math.abs(exF) / Math.max(latF, 1), this.understeer));
    const omegaEff = absV > 0.8 ? (aTyre - gravLat) / this.v : 0;

    let dpsi = omegaEff - this.v * f.kRight;
    // The back stepping out. This is the whole of oversteer, and it needs no
    // case of its own: the handbrake produces it by halving the rear's grip
    // above, exactly as trail-braking and a bootful of throttle produce it by
    // moving the load about. The kick below is only the initiation -- locking
    // the rear wheels in a straight line has to do something too.
    if (exR !== 0) dpsi += exR * OVERSTEER_YAW / Math.max(absV, 6);
    if (handbrake) dpsi += Math.sign(this.steer) * HANDBRAKE_YAW * clamp(absV / 8, 0, 1);
    // The realignment aid would catch every slide before the driver saw one,
    // so it steps back in proportion to how far the rear has actually gone.
    dpsi -= this.psi * P.assist * (handbrake ? 0.15 : 1 - 0.45 * loose)
      * clamp(absV / 12, 0, 1);
    this.psi = clamp(this.psi + dpsi * dt, -1.25, 1.25);

    // A front that has given up pushes the car bodily sideways; a rear that
    // has given up has mostly been spent rotating it already.
    this.vu += -(exF + exR * REAR_SCRUB) * dt;
    this.vu *= Math.exp(-dt * VU_DECAY);

    // What the body will lean on, worked out once here rather than guessed at
    // by the camera from the outside.
    this.latAcc = aTyre;
    this.longAcc = aLong;

    this.s += this.v * Math.cos(this.psi) * dt;
    this.u += (this.v * Math.sin(this.psi) + this.vu) * dt;
    this.hitWall(dt, input.steer);

    if (this.s < 0) { this.s = 0; this.v = Math.max(0, this.v); }
    this.airTime = 0;
  }

  // Thrust, gear by gear. `gearFor` above already tells the engine note and the
  // rev counter which gear the car is in; this is the same answer reaching the
  // wheels. It costs two multiplications, and it is the whole difference
  // between an engine and a fan: the car comes alive off the bottom of a gear,
  // runs out of breath at the top, and goes dead for a tenth of a second at
  // the change.
  drive(absV, dt, throttle) {
    const P = this.phys;
    const { gear, rpm } = gearFor(absV * 3.6, P.vmax * 3.6, this.gear);
    this.rpm = rpm;
    this.shiftT -= dt;
    if (gear !== this.gear) {
      if (gear > this.gear && throttle > 0 && this.shiftT < -SHIFT_LOCK) {
        this.shiftT = SHIFT_CUT;
      }
      this.gear = gear;
    }
    this.shifting = this.shiftT > 0;
    const pull = PULL[0] + rpm * (PULL[1] + PULL[2] * rpm);
    // A change is a dip in the drive, not a hole in it: a hole long enough to
    // feel is also long enough to cost a car a jump it used to clear, and the
    // rev drop is doing most of the telling anyway.
    return P.accel * pull * Math.max(0, 1 - absV / P.vmax)
      * (this.shifting ? SHIFT_TORQUE : 1);
  }

  // Barriers line both edges, so running wide costs speed instead of the race.
  hitWall(dt, steerInput) {
    if (Math.abs(this.u) <= WALL_U) return;
    const side = Math.sign(this.u);
    this.u = side * WALL_U;

    const closing = (this.v * Math.sin(this.psi) + this.vu) * side;
    if (closing > 0) {
      this.vu = -side * closing * WALL_BOUNCE;
      this.psi *= 0.3;
      this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), closing * WALL_BITE);
      this.slip = Math.max(this.slip, Math.min(1, closing / 10));
      // The body is thrown against the barrier before it comes back off it.
      // Small: a spring with this frequency turns a nudge in its velocity into
      // several degrees of lean, and the horizon is not supposed to fall over.
      this.rollV += side * Math.min(closing, 8) * 0.05;
      this.heaveV -= Math.min(closing, 8) * 0.03;
      if (closing > 1.2) { this.wallHits++; this.wallForce = closing; }
    } else {
      this.vu = 0;
    }

    // Friction rises with how hard the driver holds the car into the barrier, so
    // leaning on it through a corner is slower than braking for the corner.
    const press = clamp(steerInput * side, 0, 1);
    const scrub = WALL_SCRUB * (0.45 + 0.55 * press) * dt;
    this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), scrub);
  }

  detach(f) {
    const surface = v3.mad(f.pos, f.right, this.u);
    this.pos = v3.mad(surface, f.up, 0.05);
    const heading = v3.add(v3.scale(f.fwd, Math.cos(this.psi)), v3.scale(f.right, Math.sin(this.psi)));
    this.vel = v3.add(v3.scale(heading, this.v), v3.scale(f.right, this.vu));
    this.q = quat.mul(f.sq, quat.axisAngle([0, 1, 0], this.psi));
    // Keep a little of the ramp's rotation so the car pitches over the crest.
    this.angVel = [f.kUp * this.v * 0.55, 0, 0];
    this.mode = MODE.AIR;
    this.airTime = 0;
    this.prevH = 0.05;
    this.lastS = f.s;
  }

  stepAir(dt, input) {
    this.airTime += dt;
    this.vel[1] -= G * dt;
    this.pos = v3.mad(this.pos, this.vel, dt);
    this.gForce = 0;
    this.latAcc = 0;
    this.longAcc = 0;

    const w = this.angVel;
    const wl = Math.hypot(w[0], w[1], w[2]);
    if (wl > 1e-5) {
      this.q = quat.norm(quat.mul(this.q, quat.axisAngle([w[0] / wl, w[1] / wl, w[2] / wl], -wl * dt)));
    }

    if (this.pos[1] < GROUND_Y + 0.35) { this.crash('aterragem fora da pista'); return; }
    if (this.airTime > 6) { this.crash('perdeu a pista'); return; }

    const f = this.track.nearest(this.pos, this.lastS, 110);
    const d = v3.sub(this.pos, f.pos);
    const h = v3.dot(d, f.up);
    const lat = v3.dot(d, f.right);
    const sOff = v3.dot(d, f.fwd);
    this.lastS = f.s + sOff;

    // A crossing test on prevH is not enough: over a gap the car skims the
    // invisible ribbon and can slip under it before the road resumes. Landing on
    // any shallow penetration while descending catches that case too.
    const descending = v3.dot(this.vel, f.up) < 0.5;
    if (!f.gap && this.airTime > 0.08 && h <= 0 && h > -3 && descending
        && Math.abs(lat) < WALL_U + 2.5) {
      this.land(f, clamp(lat, -WALL_U, WALL_U), sOff);
      return;
    }
    this.prevH = h;
  }

  land(f, lat, sOff) {
    const impact = Math.max(0, -v3.dot(this.vel, f.up));
    const tangential = v3.sub(this.vel, v3.scale(f.up, v3.dot(this.vel, f.up)));
    const along = v3.dot(tangential, f.fwd);
    const side = v3.dot(tangential, f.right);

    this.mode = MODE.ROAD;
    this.s = Math.max(0, f.s + sOff);
    this.u = lat;
    this.v = Math.hypot(along, side) * (along < 0 ? -1 : 1);
    this.psi = clamp(Math.atan2(side, Math.abs(along) < 0.01 ? 0.01 : along), -1.1, 1.1);
    // What the suspension does not swallow. The vertical part of the flight is
    // already gone -- it went into the ground, which is what the projection
    // above does -- so this is only the scrub of landing badly, and it used to
    // be enormous: a normal jump came down a third slower than it took off,
    // which made every ramp on every track a punishment rather than a stunt.
    // A heavy arrival off a loop still costs real speed, at the cap.
    this.v *= 1 - clamp(impact / 140, 0, 0.2);
    // The springs take the rest of it: the car squats on arrival and comes
    // back up, which is the part a driver sees rather than reads on a gauge.
    this.heaveV -= Math.min(impact * 0.2, 3.0);
    this.vu = 0;
    this.landings++;
    this.landForce = impact;
    this.airTime = 0;
  }

  // World transform for the cockpit camera.
  cameraTarget() {
    if (this.mode === MODE.AIR) {
      return { pos: v3.mad(this.pos, quat.up(this.q), 1.15), q: this.q };
    }
    const f = this.track.frameAt(this.s);
    const surface = v3.mad(f.pos, f.right, this.u);
    const q = quat.mul(f.sq, quat.axisAngle([0, 1, 0], this.psi));
    const pos = v3.mad(v3.mad(surface, f.up, 1.15), quat.fwd(q), 0.35);
    return { pos, q };
  }

  // How the car sits on its springs. None of this changes where the car goes;
  // it is the body leaning on top of a path that is already decided. But a
  // view that never rolls into a corner, never dives under the brakes and
  // never lands on anything is a camera on a rail, and no amount of tyre
  // model underneath it will read as driving.
  updateBody(dt) {
    const h = Math.min(dt, 0.05);
    const air = this.mode === MODE.AIR;
    const rollT = air ? 0 : clamp(this.latAcc * ROLL_PER_A, -0.12, 0.12);
    const pitchT = air ? 0 : clamp(-this.longAcc * PITCH_PER_A, -0.055, 0.055);
    // Unloaded, the springs push the body up off its bump stops; loaded -- the
    // bottom of a dip, the inside of a loop -- they let it settle.
    let heaveT = air ? 0.05 : clamp((1 - this.gForce) * 0.03, -0.1, 0.05);
    // The only way to know you are on a kerb without looking down is that the
    // car starts talking about it.
    this.rumble = this.onCurb && !air
      ? Math.sin(this.s * CURB_RIDGE) * clamp(Math.abs(this.v) / 12, 0, 1)
      : this.rumble * Math.exp(-h * CURB_FADE);
    this.rollV = springV(this.roll, this.rollV, rollT, W_ROLL, Z_ROLL, h);
    this.roll += this.rollV * h;
    this.pitchV = springV(this.pitch, this.pitchV, pitchT, W_PITCH, Z_PITCH, h);
    this.pitch += this.pitchV * h;
    this.heaveV = springV(this.heave, this.heaveV, heaveT, W_HEAVE, Z_HEAVE, h);
    this.heave = clamp(this.heave + this.heaveV * h, -0.22, 0.14);
  }

  updateCamera(dt) {
    this.updateBody(dt);
    const t = this.cameraTarget();
    const kp = 1 - Math.exp(-dt / 0.055);
    const kq = 1 - Math.exp(-dt / 0.065);
    // The smoothed chassis pose is kept apart from what the camera ends up
    // using, and that separation is the whole point of the two extra fields.
    // Writing the lean back into the value the smoothing reads next frame
    // feeds it to itself: only a fifth of it is taken back out per frame and
    // the rest piles up, so three degrees of body roll arrived on screen as
    // sixteen and the horizon fell over in every corner.
    this._camP = v3.lerp(this._camP, t.pos, kp);
    this._camQ = quat.nlerp(this._camQ, t.q, kq);
    // The body goes on last, in the car's own axes and outside the smoothing:
    // the springs are already a filter, and putting them through a second one
    // would only make them arrive late. The cockpit does not move with it,
    // which is right -- a dashboard is bolted to the same body your eyes are
    // sitting in, and it is the world that tilts.
    this.camQuat = quat.mul(this._camQ,
      quat.mul(quat.axisAngle([0, 0, 1], this.roll + this.rumble * CURB_LEAN),
               quat.axisAngle([1, 0, 0], this.pitch)));
    this.camPos = v3.mad(this._camP, quat.up(this.camQuat),
      this.heave + this.rumble * CURB_LIFT);
  }
}
