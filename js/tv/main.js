// Android TV shell: a stack of full screens, one input vocabulary, and the
// unchanged game underneath.
//
// The racing itself -- physics, rendering, HUD, sound -- is imported exactly as
// the desktop build uses it. Only the interface around it is different, because
// only the interface is wrong on a television.
import { Game, STATE } from '../game/game.js';
import { Input } from '../game/input.js';
import { Sound } from '../game/audio.js';
import { formatTime } from '../game/hud.js';
import { carById, loadCar, saveCar } from '../game/cars.js';
import { keyValue } from '../ui/keys.js';
import { TvInput } from './input.js';
import { homeScreen, node, esc } from './screens.js';
import { editorScreen } from './editor.js';

const ui = document.getElementById('ui');
const input = new Input();
const sound = new Sound();
const tv = new TvInput();

let game;
try {
  game = new Game(document.getElementById('gl'), document.getElementById('hud'), input, sound);
} catch (e) {
  ui.innerHTML = `<div class="screen"><div class="safe"><h1 class="brand">WebGL indisponível</h1>
    <p class="sub">${esc(e.message)}</p></div></div>`;
  throw e;
}

/* ------------------------------------------------------------ view stack -- */

const stack = [];
const top = () => stack[stack.length - 1];

// Show the topmost view plus any modals stacked on it, and hide whatever the
// nearest full screen covers. Without this the track picker would keep
// rendering its map canvases behind the editor.
function restack() {
  let showing = true;
  for (let i = stack.length - 1; i >= 0; i--) {
    const v = stack[i];
    if (!v.el) continue;
    v.el.style.display = showing ? '' : 'none';
    if (showing && !v.el.classList.contains('modal')) showing = false;
  }
}

const app = {
  car: loadCar(),
  sound,
  push(v) {
    stack.push(v);
    if (v.el) ui.appendChild(v.el);
    restack();
    if (v.mounted) v.mounted();
    app.paintPad();
  },
  pop() {
    const v = stack.pop();
    if (v && v.el) v.el.remove();
    if (v && v.dispose) v.dispose();
    restack();
    const t = top();
    if (t && t.resumed) t.resumed();
    app.paintPad();
  },
  reset(v) {
    while (stack.length) app.pop();
    app.push(v);
  },
  setCar(c) { app.car = c; game.car0 = c; saveCar(c.id); },
  startRace(def) { startRace(def); },
  openEditor(def) { app.push(editorScreen(app, def)); },
  paintPad() {
    for (const p of ui.querySelectorAll('#padStatus')) {
      p.textContent = tv.padConnected ? `Comando: ${tv.padName.slice(0, 30)}` : 'Sem comando';
      p.classList.toggle('on', tv.padConnected);
    }
  },
};

/* ------------------------------------------------------------------ race -- */

let racing = false;

// While a race runs nothing is on screen but the game; this placeholder view
// exists only so the menu and back buttons still have somewhere to land.
const raceView = () => ({
  el: null,
  key(a) { if (a === 'menu' || a === 'back') pauseRace(); },
});

function startRace(def) {
  const loading = node(`<div class="screen"><div class="safe centered"
    style="justify-content:center"><h1 class="brand">A construir a pista...</h1></div></div>`);
  app.push({ el: loading });
  // setTimeout rather than rAF: rAF never fires while the tab is hidden, and the
  // pause has to survive that to let the loading screen paint.
  setTimeout(() => {
    app.pop();
    sound.unlock();
    game.load(def);
    ui.classList.add('hidden');
    racing = true;
    app.push(raceView());
    game.start();
  }, 30);
}

function leaveRace() {
  racing = false;
  game.stop();
  ui.classList.remove('hidden');
}

function pauseRace() {
  if (!racing || game.state === STATE.PAUSED) return;
  game.pause();
  ui.classList.remove('hidden');
  app.push(pauseModal());
}

function pauseModal() {
  const items = [
    { label: 'Continuar', run: () => { app.pop(); ui.classList.add('hidden'); game.resume(); } },
    { label: 'Reiniciar', run: () => { app.pop(); ui.classList.add('hidden'); game.restart(); } },
    { label: 'Escolher pista', run: () => { app.pop(); app.pop(); leaveRace(); } },
  ];
  return listModal('Pausa', items, () => items[0].run());
}

function listModal(title, items, onBack) {
  let i = 0;
  const el = node(`<div class="modal"><div class="panel centered">
    <h2>${esc(title)}</h2><div class="menu" id="mi" style="margin-top:1.4vh"></div>
    <div class="legend"><span class="a"><em>A</em>escolher</span>
      <span class="pad" id="padStatus"></span></div>
  </div></div>`);
  const paint = () => {
    el.querySelector('#mi').innerHTML = items.map((it, n) =>
      `<div class="item${n === i ? ' on' : ''}">${esc(it.label)}</div>`).join('');
  };
  paint();
  return {
    el,
    key(a) {
      if (a === 'up') { i = (i - 1 + items.length) % items.length; paint(); }
      else if (a === 'down') { i = (i + 1) % items.length; paint(); }
      else if (a === 'ok') items[i].run();
      else if (a === 'back' || a === 'menu') onBack ? onBack() : app.pop();
    },
  };
}

game.onFinish = ({ time, best, record }) => {
  const who = best && best.car ? ` · ${carById(best.car).name}` : '';
  const el = node(`<div class="modal"><div class="panel centered">
    <h2>${record ? 'Novo recorde!' : 'Terminado'}</h2>
    <div class="bigtime">${formatTime(time)}</div>
    <p class="sub">${record
      ? `Melhor tempo em ${esc(game.def.name)} com o ${esc(game.car0.name)}`
      : `Recorde ${formatTime(best && best.ms)}${esc(who)} · alvo ${formatTime(game.def.target * 1000)}`}</p>
    <div class="menu" id="mi" style="margin-top:2vh"></div>
    <div class="legend"><span class="a"><em>A</em>escolher</span>
      <span class="pad" id="padStatus"></span></div>
  </div></div>`);

  const items = [
    { label: 'Outra volta', run: () => { app.pop(); ui.classList.add('hidden'); game.restart(); } },
    { label: 'Escolher pista', run: () => { app.pop(); app.pop(); leaveRace(); } },
  ];
  let i = 0;
  const paint = () => {
    el.querySelector('#mi').innerHTML = items.map((it, n) =>
      `<div class="item${n === i ? ' on' : ''}">${esc(it.label)}</div>`).join('');
  };
  paint();

  ui.classList.remove('hidden');
  app.push({
    el,
    key(a) {
      if (a === 'up') { i = (i - 1 + items.length) % items.length; paint(); }
      else if (a === 'down') { i = (i + 1) % items.length; paint(); }
      else if (a === 'ok') items[i].run();
    },
  });
};

/* ----------------------------------------------------------------- input -- */

tv.on(a => {
  const t = top();
  if (t && t.key) t.key(a);
});

// The wrapper hands remote keys straight to the page (see MainActivity). They
// arrive as ordinary synthetic key events, which is all TvInput needs -- the TV
// interface never relies on DOM focus or default actions, so untrusted events
// are as good as real ones here.
window.__tvKey = (action, name) => {
  dispatchEvent(new KeyboardEvent(action === 'down' ? 'keydown' : 'keyup',
    { code: name, key: keyValue(name), bubbles: true, cancelable: true }));
};

// Android's own Back button: close whatever is open, and only let the system
// exit the app when we are already at the home screen.
window.__tvBack = () => {
  if (stack.length > 1) { const t = top(); if (t && t.key) t.key('back'); return false; }
  return true;
};

addEventListener('resize', () => { game.renderer.resize(); game.hud.resize(); });

// Pad status is polled rather than pushed: a controller that is switched on
// after the app starts otherwise shows as missing forever.
setInterval(() => app.paintPad(), 600);

game.car0 = app.car;   // the Game drives whichever car the picker last confirmed
// The ghost is a TV-version feature; the desktop build records laps but never
// draws them, so it stays exactly as it was.
game.showGhost = true;
app.push(homeScreen(app));
