// The TV screens: one job per screen, each a full page.
//
// The desktop build puts cars, tracks and controls on one scrolling page, which
// is right for a mouse and wrong for a remote: scrolling a long page with a
// D-pad is slow and it is easy to lose track of where the selection is. Here
// each choice gets its own screen with a single row to walk along.
import { CARS, carById } from '../game/cars.js';
import { TRACKS } from '../world/tracks.js';
import { getBest, clearRecord } from '../game/game.js';
import { formatTime } from '../game/hud.js';
import { loadCustom, deleteCustom } from '../world/customtracks.js';
import { walkTrack } from '../world/track.js';
import { drawTrackMap } from './map.js';
import { keyName } from '../ui/keys.js';
import { activePad, allPads } from '../ui/pads.js';

export const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const node = html => {
  const d = document.createElement('div');
  d.innerHTML = html.trim();
  return d.firstElementChild;
};

// Shown on the home screen so it is obvious at a glance which build a
// television is actually running -- two APKs with the same name and package
// are otherwise indistinguishable once installed.
export const BUILD = '2.1-tv';

export const allTracks = () => [...TRACKS, ...loadCustom()];

const legend = items => `<div class="legend">${items.map(i =>
  `<span class="${i[0]}"><em>${i[1]}</em>${esc(i[2])}</span>`).join('')}
  <span class="pad" id="padStatus"></span></div>`;

// Keeps the focused card in the middle of the screen: the rail slides, the
// selection does not, so the eye never has to hunt for it.
function centreRail(inner, index) {
  const card = inner.children[index];
  if (!card) return;
  const view = inner.parentElement.clientWidth;
  inner.style.transform = `translateX(${Math.round(view / 2 - card.offsetLeft - card.offsetWidth / 2)}px)`;
}

/* ------------------------------------------------------------------ home -- */

export function homeScreen(app) {
  const items = [
    { id: 'play', label: 'Jogar', hint: 'escolher carro e pista' },
    { id: 'build', label: 'Construir pista', hint: 'editor com comando' },
    { id: 'sound', label: 'Som', hint: '' },
    { id: 'pad', label: 'Comando', hint: 'ver o que o jogo recebe' },
    { id: 'quit', label: 'Sair', hint: 'fechar a aplicação' },
  ];
  let i = 0;

  const el = node(`<div class="screen"><div class="safe">
    <div class="homewrap">
      <div class="homeside">
        <h1 class="brand">DARE <span>STUNTS</span></h1>
        <p class="sub">Loops, corkscrews e saltos. Contra o relógio.</p>
        <img class="homeart" src="img/capa.svg" alt="" width="960" height="540">
      </div>
      <div class="menu" id="menu"></div>
    </div>
    ${legend([['a', 'A', 'escolher'], ['', '↕', 'navegar'], ['', 'v', BUILD]])}
  </div></div>`);

  const paint = () => {
    items[2].hint = app.sound.muted ? 'desligado' : 'ligado';
    el.querySelector('#menu').innerHTML = items.map((it, n) =>
      `<div class="item${n === i ? ' on' : ''}">${esc(it.label)}
        <span class="hint">${esc(it.hint)}</span></div>`).join('');
  };
  paint();

  return {
    el,
    key(a) {
      if (a === 'up') { i = (i - 1 + items.length) % items.length; paint(); }
      else if (a === 'down') { i = (i + 1) % items.length; paint(); }
      else if (a === 'ok') {
        const id = items[i].id;
        if (id === 'play') app.push(carScreen(app));
        else if (id === 'build') app.openEditor(null);
        else if (id === 'pad') app.push(padScreen(app));
        else if (id === 'quit') app.push(confirmModal({
          title: 'Fechar o Dare Stunts?',
          text: 'Voltas ao ecrã inicial da televisão. Os recordes e as pistas ficam guardados.',
          yes: 'Fechar', no: 'Ficar',
          onYes: () => app.exit(), onNo: () => app.pop(),
        }));
        else { app.sound.setMuted(!app.sound.muted); paint(); }
      }
    },
  };
}

/* --------------------------------------------------------------- gamepad -- */

// What the page actually receives from a controller.
//
// A controller can fail in three different places and they look identical from
// the sofa: its buttons may never reach the page at all, the Gamepad API may
// not be exposed by this WebView, or several devices may be present -- a
// television usually offers its own remote as a gamepad too -- and the game may
// be listening to the wrong one. There is no console to open on a television,
// so this tells them apart: every pad the browser admits to, which of them the
// game is listening to, and the last few keys that arrived.
export function padScreen(app) {
  let seen = [];
  const el = node(`<div class="screen"><div class="safe">
    <div class="eyebrow">Comando</div>
    <p class="sub" id="padapi"></p>
    <div class="menu" id="padlist" style="min-width:56vw;margin-top:1vh"></div>
    <p class="sub" id="padkeys" style="margin-top:1.5vh"></p>
    ${legend([['b', 'B', 'voltar'], ['', '↕', 'carrega nos botões para os veres aqui']])}
  </div></div>`);

  const onKey = e => {
    seen.unshift(`${keyName(e) || '?'} (${e.keyCode})`);
    seen = seen.slice(0, 6);
  };
  addEventListener('keydown', onKey);

  const paint = () => {
    const has = !!navigator.getGamepads;
    const pads = has ? allPads() : [];
    const chosen = has ? activePad() : null;
    el.querySelector('#padapi').textContent = !has
      ? 'Gamepad API indisponível nesta WebView — só as teclas abaixo chegam ao jogo'
      : pads.length
        ? `${pads.length} comando(s) ligado(s) · o jogo ouve o que foi usado por último`
        : 'Nenhum comando visível — carrega num botão do comando (só aparece depois disso)';
    el.querySelector('#padlist').innerHTML = pads.map(p => {
      const on = p.buttons.map((b, i) => (b && b.pressed ? i : null)).filter(i => i !== null);
      const ax = [...p.axes].slice(0, 4).map(a => a.toFixed(2)).join('  ');
      const mine = chosen && p.index === chosen.index;
      return `<div class="item${mine ? ' on' : ''}">${esc(p.id.slice(0, 52))}
        <span class="hint">botões ${on.length ? on.join(' ') : '—'} · eixos ${esc(ax)}</span></div>`;
    }).join('');
    el.querySelector('#padkeys').textContent = seen.length
      ? `Teclas recebidas: ${seen.join('   ')}`
      : 'Teclas recebidas: nenhuma ainda — o comando também deve aparecer aqui';
  };
  paint();
  const timer = setInterval(paint, 120);

  return {
    el,
    dispose() { clearInterval(timer); removeEventListener('keydown', onKey); },
    key(a) { if (a === 'back') app.pop(); },
  };
}

/* -------------------------------------------------------------- car pick -- */

export function carScreen(app) {
  let i = Math.max(0, CARS.findIndex(c => c.id === app.car.id));

  const el = node(`<div class="screen"><div class="safe">
    <div class="eyebrow">Escolhe o carro</div>
    <div class="rail"><div class="railinner" id="rail">${CARS.map(c => `
      <div class="card">
        <img src="${c.img}" alt="${esc(c.name)}" width="480" height="360">
        <div class="cname">${esc(c.name)}</div>
        <div class="ctag">${esc(c.tagline)}</div>
        <div class="cbest">${esc(c.best)}</div>
        <div class="bars">${Object.entries(c.bars).map(([k, v]) => `
          <div class="bar"><span>${esc(k)}</span><i><b style="width:${Math.round(v * 100)}%;
            background:${c.theme.accent}"></b></i></div>`).join('')}</div>
      </div>`).join('')}</div></div>
    ${legend([['a', 'A', 'confirmar'], ['b', 'B', 'voltar'], ['', '↔', 'trocar de carro']])}
  </div></div>`);

  const rail = el.querySelector('#rail');
  const paint = () => {
    [...rail.children].forEach((c, n) => c.classList.toggle('on', n === i));
    centreRail(rail, i);
  };

  return {
    el,
    mounted: paint,          // offsetLeft is only real once the screen is in the DOM
    key(a) {
      if (a === 'left') { i = (i - 1 + CARS.length) % CARS.length; paint(); }
      else if (a === 'right') { i = (i + 1) % CARS.length; paint(); }
      else if (a === 'ok') { app.setCar(CARS[i]); app.push(trackScreen(app)); }
      else if (a === 'back') app.pop();
    },
  };
}

/* ------------------------------------------------------------ track pick -- */

export function trackScreen(app) {
  let list = allTracks();
  let i = 0;
  const walks = new Map();

  const el = node(`<div class="screen"><div class="safe">
    <div class="eyebrow">Escolhe a pista &middot; <span id="carname"></span></div>
    <div class="rail"><div class="railinner" id="rail"></div></div>
    <div id="lg"></div>
  </div></div>`);
  el.querySelector('#carname').textContent = app.car.name;

  const rail = el.querySelector('#rail');

  const build = () => {
    rail.innerHTML = list.map(t => {
      const best = getBest(t.id);
      const who = best && best.car ? ` &middot; ${esc(carById(best.car).name)}` : '';
      return `<div class="card tcard">
        <canvas></canvas>
        <div class="cname">${esc(t.name)}</div>
        <div class="ctag"><span class="chip d${t.difficulty}">${esc(t.diffLabel)}</span></div>
        <div class="cbest">${esc(t.desc)}</div>
        <div class="meta"><span>Alvo <b>${formatTime(t.target * 1000)}</b></span>
          <span>Recorde <b>${formatTime(best && best.ms)}</b>${who}</span></div>
      </div>`;
    }).join('');

  };

  // Drawing needs real element sizes, which only exist once the screen is in
  // the document -- called from mounted(), never from build().
  const drawMaps = () => {
    [...rail.children].forEach((card, n) => {
      const t = list[n];
      // Walking a 4 km track into frames is real work, so each track is walked
      // once and the result kept for as long as the screen lives.
      if (!walks.has(t.id)) {
        try { walks.set(t.id, walkTrack(t.pieces)); } catch { walks.set(t.id, null); }
      }
      drawTrackMap(card.querySelector('canvas'), walks.get(t.id), { labels: false, pad: 14 });
    });
  };

  const paint = () => {
    [...rail.children].forEach((c, n) => c.classList.toggle('on', n === i));
    centreRail(rail, i);
    const custom = list[i] && list[i].custom;
    el.querySelector('#lg').innerHTML = legend(custom
      ? [['a', 'A', 'correr'], ['b', 'B', 'voltar'], ['x', 'X', 'editar'], ['y', 'Y', 'apagar'],
         ['', '↓', 'opções']]
      : [['a', 'A', 'correr'], ['b', 'B', 'voltar'], ['', '↓', 'opções']]);
    app.paintPad();
  };

  const askDelete = () => {
    const t = list[i];
    app.push(confirmModal({
      title: 'Apagar pista?',
      text: `"${t.name}" e o seu recorde desaparecem para sempre.`,
      yes: 'Apagar', no: 'Manter',
      onYes: () => { deleteCustom(t.id); app.pop(); refresh(); },
      onNo: () => app.pop(),
    }));
  };

  // Records are worth a confirmation: the time and the ghost go together, and
  // the lap that set them is not coming back.
  const askClear = t => {
    const best = getBest(t.id);
    app.push(confirmModal({
      title: `Limpar o recorde de ${t.name}?`,
      text: `Apaga o tempo de ${formatTime(best && best.ms)} e o fantasma dessa volta.`,
      yes: 'Limpar', no: 'Cancelar',
      onYes: () => { clearRecord(t.id); app.pop(); refresh(); },
      onNo: () => app.pop(),
    }));
  };

  // A television remote has no X or Y button, so running, editing and deleting
  // all have to be reachable from the D-pad alone.
  const trackMenu = () => {
    const t = list[i];
    const items = [{ label: `Correr em ${t.name}`, run: () => { app.pop(); app.startRace(t); } }];
    if (getBest(t.id)) {
      items.push({ label: 'Limpar o recorde', run: () => { app.pop(); askClear(t); } });
    }
    if (t.custom) {
      items.push({ label: 'Editar esta pista', run: () => { app.pop(); app.openEditor(t); } });
      items.push({ label: 'Apagar esta pista', run: () => { app.pop(); askDelete(); } });
    }
    let n = 0;
    const m = node(`<div class="modal"><div class="panel">
      <h2>${esc(t.name)}</h2><div class="menu" id="mi"></div>
      <div class="legend"><span class="a"><em>A</em>escolher</span>
        <span class="b"><em>B</em>fechar</span></div>
    </div></div>`);
    const paintM = () => {
      m.querySelector('#mi').innerHTML = items.map((it, k) =>
        `<div class="item${k === n ? ' on' : ''}">${esc(it.label)}</div>`).join('');
    };
    paintM();
    return {
      el: m,
      key(a) {
        if (a === 'up') { n = (n - 1 + items.length) % items.length; paintM(); }
        else if (a === 'down') { n = (n + 1) % items.length; paintM(); }
        else if (a === 'ok') items[n].run();
        else if (a === 'back') app.pop();
      },
    };
  };

  const refresh = () => {
    list = allTracks();
    i = Math.min(i, Math.max(0, list.length - 1));
    build(); drawMaps(); paint();
  };

  build();

  return {
    el,
    mounted: () => { drawMaps(); paint(); },
    resumed: refresh,        // coming back from the editor, the list may have changed
    key(a) {
      if (!list.length) { if (a === 'back') app.pop(); return; }
      if (a === 'left') { i = (i - 1 + list.length) % list.length; paint(); }
      else if (a === 'right') { i = (i + 1) % list.length; paint(); }
      else if (a === 'ok') app.startRace(list[i]);
      else if (a === 'back') app.pop();
      else if (a === 'x' && list[i].custom) app.openEditor(list[i]);
      else if (a === 'y' && list[i].custom) askDelete();
      else if (a === 'down') app.push(trackMenu());
    },
  };
}

/* ------------------------------------------------------------- confirm -- */

export function confirmModal({ title, text, yes = 'Sim', no = 'Não', onYes, onNo }) {
  let i = 1;   // default to the harmless option
  const el = node(`<div class="modal"><div class="panel centered">
    <h2>${esc(title)}</h2>
    <p class="sub">${esc(text)}</p>
    <div class="menu" id="opts" style="margin-top:2vh"></div>
  </div></div>`);
  const paint = () => {
    el.querySelector('#opts').innerHTML = [yes, no].map((l, n) =>
      `<div class="item${n === i ? ' on' : ''}">${esc(l)}</div>`).join('');
  };
  paint();
  return {
    el,
    key(a) {
      if (a === 'up' || a === 'down' || a === 'left' || a === 'right') { i = 1 - i; paint(); }
      else if (a === 'ok') (i === 0 ? onYes : onNo)();
      else if (a === 'back') onNo();
    },
  };
}
