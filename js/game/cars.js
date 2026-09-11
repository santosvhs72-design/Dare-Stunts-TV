// Three cars, none better than the others: each trades top speed against grip,
// so the right choice depends on the circuit. Balance is verified by driving
// every car on every track with the editor's autopilot.

export const CARS = [
  {
    id: 'veloz',
    name: 'Lebre',
    tagline: 'Mais velocidade, menos aderência',
    best: 'Circuitos com retas longas e curvas abertas',
    bars: { Velocidade: 0.95, Aderência: 0.5, Travagem: 0.55 },
    phys: {
      vmax: 76, accel: 9, brake: 17, mu: 1.28, muCurb: 0.86,
      maxSteer: 0.55, wheelbase: 2.95, coastBase: 2.9, coastDrag: 0.0016, assist: 0.75,
    },
    img: 'img/lebre.png',
    theme: {
      dashHi: '#2a2320', dashMid: '#1a1413', dashLow: '#0b0708',
      seam: '#6b4a44', screen: '#120b0b', screenEdge: '#4a2f2c',
      rim: '#241a19', rimHi: '#4a3733', rimLow: '#120c0c',
      pillar: '#1d1616', roof: '#120d0d',
      accent: '#ff6a5a', accent2: '#ffb43a', ambient: '255,106,90',
      dashScale: 0.93, wheelScale: 1.04,
    },
  },
  {
    id: 'equilibrado',
    name: 'Corsário',
    tagline: 'Equilíbrio entre velocidade e aderência',
    best: 'Circuitos mistos, com retas e algumas curvas lentas',
    bars: { Velocidade: 0.72, Aderência: 0.7, Travagem: 0.7 },
    phys: {
      vmax: 63, accel: 9.6, brake: 17, mu: 1.45, muCurb: 0.95,
      maxSteer: 0.6, wheelbase: 2.75, coastBase: 3.2, coastDrag: 0.0018, assist: 0.85,
    },
    img: 'img/corsario.png',
    theme: {
      dashHi: '#232833', dashMid: '#14181f', dashLow: '#070910',
      seam: '#4a535f', screen: '#0a0d13', screenEdge: '#29313d',
      rim: '#1c2128', rimHi: '#39424e', rimLow: '#0d1015',
      pillar: '#171b21', roof: '#0e1116',
      accent: '#ffb43a', accent2: '#7fd0ff', ambient: '255,180,58',
      dashScale: 1, wheelScale: 1,
    },
  },
  {
    id: 'aderente',
    name: 'Tenaz',
    tagline: 'Mais aderência, menos velocidade',
    best: 'Circuitos lentos, com muitas curvas apertadas',
    bars: { Velocidade: 0.5, Aderência: 0.95, Travagem: 0.9 },
    phys: {
      vmax: 48, accel: 10.5, brake: 17, mu: 1.66, muCurb: 1.05,
      maxSteer: 0.66, wheelbase: 2.55, coastBase: 3.6, coastDrag: 0.0021, assist: 0.95,
    },
    img: 'img/tenaz.png',
    theme: {
      dashHi: '#1e2a27', dashMid: '#121b19', dashLow: '#060b0a',
      seam: '#3f5d54', screen: '#08110f', screenEdge: '#26443c',
      rim: '#182320', rimHi: '#31473f', rimLow: '#0b1211',
      pillar: '#141d1b', roof: '#0b1211',
      accent: '#5fd894', accent2: '#7fd0ff', ambient: '95,216,148',
      dashScale: 1.08, wheelScale: 1.12,
    },
  },
];

const KEY = 'velocidadecega.car';

export const carById = id => CARS.find(c => c.id === id) || CARS[1];

export function loadCar() {
  try { return carById(localStorage.getItem(KEY)); } catch { return CARS[1]; }
}

export function saveCar(id) {
  try { localStorage.setItem(KEY, id); } catch { /* private mode */ }
}
