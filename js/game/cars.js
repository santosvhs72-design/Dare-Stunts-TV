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
      dash: '#7b2531', dashLite: '#a83b46', dashDark: '#4a1219',
      body: '#d24a32', bodyDark: '#8c2c1b',
      panel: '#120b0b', panelLite: '#4a2f2c',
      pillar: '#1d1616', pillarEdge: '#4a3733', roof: '#120d0d',
      rim: '#332726', rimHi: '#57433f', rimLow: '#180f0f',
      face: '#0b0606', bezel: '#c8b6b2', needle: '#ffd24a',
      accent: '#ff6a5a', accent2: '#ffb43a',
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
      dash: '#2e3a6e', dashLite: '#4a5796', dashDark: '#1a2247',
      body: '#c9a43a', bodyDark: '#8a6f1f',
      panel: '#0a0d13', panelLite: '#2b3246',
      pillar: '#171b21', pillarEdge: '#333b46', roof: '#0e1116',
      rim: '#31363f', rimHi: '#565d69', rimLow: '#15181e',
      face: '#06080d', bezel: '#b9bec9', needle: '#ef4a3c',
      accent: '#ffb43a', accent2: '#7fd0ff',
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
      dash: '#1f5140', dashLite: '#2f7a60', dashDark: '#123227',
      body: '#3fae7a', bodyDark: '#236b4a',
      panel: '#08110f', panelLite: '#26443c',
      pillar: '#141d1b', pillarEdge: '#31473f', roof: '#0b1211',
      rim: '#28322e', rimHi: '#47564e', rimLow: '#101615',
      face: '#050d0a', bezel: '#b4c4bc', needle: '#ffd24a',
      accent: '#5fd894', accent2: '#7fd0ff',
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
