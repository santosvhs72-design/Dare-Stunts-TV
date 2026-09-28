// One input vocabulary for the whole TV interface.
//
// A TV app is driven by three devices that report nothing alike: a remote (key
// events, often with an empty KeyboardEvent.code), a gamepad (no key events at
// all -- it must be polled), and a keyboard while developing. Every screen
// would otherwise have to know all three. This turns all of them into the same
// handful of named actions.
//
// Key events fire the moment they arrive rather than being sampled by the poll
// loop: a quick press can begin and end between two polls, and a menu that
// silently drops presses is worse than one that is slightly slow.
import { keyName } from '../ui/keys.js';
import { activePad } from '../ui/pads.js';

const HOLD_FIRST = 400;   // pad only: pause before a held direction repeats
const HOLD_NEXT = 130;    // pad only: repeat rate afterwards
const STICK = 0.55;       // stick deflection that counts as a direction
// One physical press can arrive twice -- a gamepad D-pad shows up as a key
// event *and* as a polled button -- so the same action is never acted on twice
// inside this window, whichever source it came from. It therefore has to be
// longer than the poll interval below, and it must not be much longer than
// that: the gap between two taps of somebody navigating in a hurry is not long
// at all, and this is the last thing standing between them and the menu.
const MIN_GAP = 70;

const KEY_ACTION = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Enter: 'ok', Space: 'ok',
  Escape: 'back', Backspace: 'back',
  // B is deliberately not 'back': it is the handbrake while a lap is running,
  // and the dispatcher in tv/main.js turns it into 'back' everywhere else.
  KeyB: 'b',
  KeyX: 'x', KeyY: 'y', KeyQ: 'l', KeyE: 'r', KeyM: 'menu', KeyG: 'ghost',
};

// Standard gamepad mapping. The face buttons keep their console meaning so the
// on-screen legend matches the physical controller.
const PAD_ACTION = { 0: 'ok', 1: 'b', 2: 'x', 3: 'y', 4: 'l', 5: 'r', 8: 'back', 9: 'menu' };
const PAD_DIR = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const DIRS = ['up', 'down', 'left', 'right'];

export class TvInput {
  constructor() {
    this.enabled = true;
    this.handler = () => {};
    this.padName = '';
    this.padConnected = false;

    this._last = {};        // action -> timestamp of last accepted fire
    this._swallow = new Set();  // held through a screen change; dead until let go
    this._downKeys = new Set();
    this._prevPad = new Set();
    this._dir = null;
    this._dirAt = 0;
    this._dirFired = 0;

    // A held key repeats: Android sends ACTION_DOWN again and again while a
    // button is down and the wrapper forwards every one. A repeat is not a new
    // press, and acting on it means whatever appears while a button is held is
    // activated by that same press -- finish a lap with the throttle down and
    // the results menu takes the press that was still accelerating. Directions
    // are the exception, because holding one to run down a list is how a list is
    // meant to be used. The polled gamepad path has always worked this way (see
    // _prevPad below); this brings keys into line with it.
    addEventListener('keydown', e => {
      const a = KEY_ACTION[keyName(e)];
      if (!a) return;
      // Arrows scroll and Space/Enter activate things; this interface does all
      // of that itself, so the browser must keep its hands off.
      e.preventDefault();
      if (!DIRS.includes(a)) {
        if (this._downKeys.has(a)) return;
        this._downKeys.add(a);
      }
      if (this.enabled) this._fire(a);
    });
    addEventListener('keyup', e => {
      const a = KEY_ACTION[keyName(e)];
      if (!a) return;
      this._downKeys.delete(a);
      // Released only when neither source still has it: one physical button
      // can arrive down both ways at once (see MIN_GAP above).
      if (!this._prevPad.has(a)) this._swallow.delete(a);
    });
    // Focus moving away mid-press would otherwise leave a button held for ever.
    addEventListener('blur', () => { this._downKeys.clear(); this._swallow.clear(); });

    setInterval(() => this._poll(), 50);
  }

  on(handler) { this.handler = handler; }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      this._prevPad.clear(); this._downKeys.clear(); this._swallow.clear();
      this._dir = null;
    }
  }

  _poll() {
    const pad = activePad();
    this.padConnected = !!pad;
    if (pad) this.padName = pad.id;
    if (!pad || !this.enabled) { this._dir = null; this._prevPad.clear(); return; }

    const btn = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
    const held = new Set();
    for (const [i, a] of Object.entries(PAD_ACTION)) if (btn(i)) held.add(a);
    for (const [i, a] of Object.entries(PAD_DIR)) if (btn(i)) held.add(a);
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    if (ay < -STICK) held.add('up'); else if (ay > STICK) held.add('down');
    if (ax < -STICK) held.add('left'); else if (ax > STICK) held.add('right');

    const now = performance.now();

    // Directions repeat while held; everything else fires once per press, or
    // holding A would activate a menu item dozens of times a second.
    const dir = DIRS.find(d => held.has(d)) || null;
    if (dir !== this._dir) {
      this._dir = dir; this._dirAt = now; this._dirFired = 0;
      if (dir) { this._fire(dir); this._dirFired = now; }
    } else if (dir && now - this._dirAt >= HOLD_FIRST && now - this._dirFired >= HOLD_NEXT) {
      this._fire(dir); this._dirFired = now;
    }

    for (const a of held) {
      if (DIRS.includes(a)) continue;
      if (!this._prevPad.has(a)) this._fire(a);
    }
    // A pad is a level read with no edges of its own, so a button that has
    // stopped being reported is the only "released" this path ever gets -- but
    // only if the key path is not still holding the same action down, or a pad
    // being present at all would quietly cancel every guard a key ever armed.
    for (const a of this._swallow) {
      if (!held.has(a) && !this._downKeys.has(a)) this._swallow.delete(a);
    }
    this._prevPad = held;
  }

  // Every screen change puts whatever is under a thumb at that moment out of
  // action until it is let go. Finish a lap with the throttle down and the
  // results menu would otherwise take the press that was still accelerating.
  //
  // What counts as "let go" is the hardware saying so -- a keyup, or a button
  // that stops being reported by the pad -- and nothing else. This used to be
  // inferred from the timing instead, on the theory that a device might report
  // a repeat as an up immediately followed by a down. The theory cost real
  // presses: two taps less than sixty milliseconds apart were read as one
  // button never released, so navigating in a hurry meant pressing twice and
  // getting one. Whoever is actually holding the buttons matters more than a
  // device nobody has.
  guard() {
    for (const a of this._downKeys) if (!DIRS.includes(a)) this._swallow.add(a);
    for (const a of this._prevPad) if (!DIRS.includes(a)) this._swallow.add(a);
  }

  _fire(action) {
    const now = performance.now();
    if (this._swallow.has(action)) return;
    if (now - (this._last[action] || -1e9) < MIN_GAP) return;
    this._last[action] = now;
    try { this.handler(action); } catch (e) { console.error('TV input', action, e); }
  }
}
