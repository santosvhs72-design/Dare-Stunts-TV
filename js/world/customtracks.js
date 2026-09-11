// Where player-made tracks live, and what one looks like once saved.
//
// Kept apart from the editors on purpose: two very different interfaces build
// these objects -- the pointer-driven desktop editor and the controller-driven
// television one -- and both must produce and read exactly the same thing. It
// also means the TV build never has to pull in the desktop editor's DOM code
// just to list the tracks someone saved.

const KEY = 'velocidadecega.tracks';

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
};
const write = list => {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
};

export const loadCustom = () => read().filter(t => t && Array.isArray(t.pieces));

// Shared with the Android TV editor, which builds the same track objects
// through a different interface and must land in the same storage.
export function trackDefFrom({ pieces, length, name, id }) {
  return {
    id: id || `custom-${Date.now().toString(36)}`,
    name,
    custom: true,
    difficulty: 4,
    diffLabel: 'Tua',
    desc: summarise(pieces, length),
    target: Math.max(20, Math.round(length / 21)),
    pieces: pieces.map(p => ({ ...p })),
  };
}

export function saveCustom(def) {
  const list = read().filter(t => t.id !== def.id);
  list.push(def);
  return write(list);
}

export function deleteCustom(id) {
  write(read().filter(t => t.id !== id));
  try { localStorage.removeItem(`velocidadecega.best.${id}`); } catch { /* ignore */ }
}

function summarise(pieces, length) {
  const count = t => pieces.filter(p => p.t === t).length;
  const bits = [`${(length / 1000).toFixed(2).replace('.', ',')} km`];
  const cps = count('cp');
  if (cps) bits.push(`${cps} checkpoint${cps > 1 ? 's' : ''}`);
  for (const [t, one, many] of [['loop', 'loop', 'loops'], ['cork', 'corkscrew', 'corkscrews'],
                                ['jump', 'salto', 'saltos'], ['hill', 'colina', 'colinas']]) {
    const n = count(t);
    if (n) bits.push(`${n} ${n > 1 ? many : one}`);
  }
  return bits.join(' · ');
}
