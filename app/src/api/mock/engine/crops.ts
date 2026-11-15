// Catálogo de cultivos. Valores aproximados de FAO ECOCROP (temperaturas, lluvia,
// pH, ciclo), FAO-56 (Kc), FAO-29 / Maas-Hoffman (umbral de salinidad) y
// referencias regionales de horas frío. TODOS deben validarse con el agrónomo:
// varían por variedad y por región. `AGRO` son parámetros internos del motor de
// demostración (rendimiento de referencia, valor, residuos, erosión…).
//
// Campos cortos de `R`:
//   cycle   días de siembra a cosecha (perennes: 365)
//   topt    temperatura media óptima del ciclo (°C)      tabs  límites absolutos (°C)
//   ft      tolera heladas                               hc    temperatura crítica en floración (°C)
//   water   necesidad de agua del ciclo (mm)             ec    umbral de salinidad CEe (dS/m)
//   gh      común en invernadero                         agro  [rend. t/ha, valor 0–1, residuo, factor C, forraje 0–1, N kg/ha, mano de obra 0–1]
//   per     perennes: horas frío [bajo req., tradicional], mes sensible a helada, años a 1.ª cosecha, meses de cosecha, meses para plantar

import type { Crop, CropCategory, CropRole } from '../types.ts'

interface R {
  id: string
  es: string
  en: string
  emoji: string
  family: string
  cat: CropCategory
  roles: CropRole[]
  cycle: [number, number]
  topt: [number, number]
  tabs: [number, number]
  ft: boolean
  hc: number
  water: [number, number]
  ph: [number, number]
  kc: [number, number, number]
  nfix?: boolean
  ec: number
  gh?: boolean
  agro: [number, number, number, number, number, number, number]
  per?: { chill?: [number, number]; bloom?: number; first: number; harvest: [number, number]; plant: number[] }
  aka?: string[]
}

const P: [number, number] = [365, 365]

const raw: R[] = [
  // ───────────── Grains and cereals ─────────────
  { id: 'maiz', es: 'Maíz', en: 'Corn', emoji: '🌽', family: 'poaceae', cat: 'grain', roles: ['cash'], cycle: [110, 150], topt: [18, 33], tabs: [10, 40], ft: false, hc: 38, water: [500, 800], ph: [5.5, 8.0], kc: [0.3, 1.2, 0.6], ec: 1.7, agro: [5.5, 0.55, 1, 0.4, 0.3, -110, 0.5], aka: ['maiz grano', 'elote'] },
  { id: 'maiz_forrajero', es: 'Maíz forrajero (ensilaje)', en: 'Silage corn', emoji: '🌽', family: 'poaceae', cat: 'forage', roles: ['forage'], cycle: [95, 120], topt: [18, 32], tabs: [10, 40], ft: false, hc: 38, water: [450, 700], ph: [5.5, 8.0], kc: [0.3, 1.15, 0.5], ec: 1.7, agro: [45, 0.4, 0, 0.45, 1, -150, 0.45], aka: ['ensilaje', 'silo', 'maiz para silo'] },
  { id: 'sorgo', es: 'Sorgo', en: 'Sorghum', emoji: '🌾', family: 'poaceae', cat: 'grain', roles: ['cash', 'drought_tolerant', 'forage'], cycle: [100, 130], topt: [22, 35], tabs: [12, 42], ft: false, hc: 38, water: [400, 600], ph: [5.5, 8.5], kc: [0.3, 1.05, 0.55], ec: 6.8, agro: [4.5, 0.45, 1, 0.35, 0.6, -80, 0.4], aka: ['sorgo grano', 'milo'] },
  { id: 'sorgo_forrajero', es: 'Sorgo forrajero', en: 'Forage sorghum', emoji: '🌾', family: 'poaceae', cat: 'forage', roles: ['forage', 'drought_tolerant'], cycle: [80, 110], topt: [22, 35], tabs: [12, 42], ft: false, hc: 40, water: [350, 550], ph: [5.5, 8.5], kc: [0.3, 1.0, 0.8], ec: 6.8, agro: [35, 0.35, 0, 0.35, 1, -100, 0.35] },
  { id: 'trigo', es: 'Trigo', en: 'Wheat', emoji: '🌾', family: 'poaceae', cat: 'grain', roles: ['cash'], cycle: [120, 160], topt: [12, 24], tabs: [-8, 32], ft: true, hc: 32, water: [400, 600], ph: [6.0, 8.0], kc: [0.4, 1.15, 0.3], ec: 6.0, agro: [4.0, 0.5, 1, 0.15, 0.2, -90, 0.4], aka: ['trigo harinero', 'trigo cristalino'] },
  { id: 'cebada', es: 'Cebada', en: 'Barley', emoji: '🌾', family: 'poaceae', cat: 'grain', roles: ['cash', 'drought_tolerant'], cycle: [100, 130], topt: [12, 24], tabs: [-6, 32], ft: true, hc: 32, water: [350, 500], ph: [6.0, 8.5], kc: [0.3, 1.15, 0.25], ec: 8.0, agro: [3.5, 0.45, 1, 0.15, 0.3, -70, 0.35], aka: ['cebada maltera'] },
  { id: 'avena', es: 'Avena forrajera', en: 'Forage oat', emoji: '🌾', family: 'poaceae', cat: 'forage', roles: ['forage', 'cover'], cycle: [90, 120], topt: [10, 22], tabs: [-6, 30], ft: true, hc: 30, water: [300, 450], ph: [5.5, 8.0], kc: [0.3, 1.1, 0.3], ec: 5.0, agro: [8.0, 0.4, 1, 0.12, 1, -50, 0.3], aka: ['avena'] },
  { id: 'triticale', es: 'Triticale', en: 'Triticale', emoji: '🌾', family: 'poaceae', cat: 'forage', roles: ['forage', 'drought_tolerant'], cycle: [110, 140], topt: [10, 24], tabs: [-8, 32], ft: true, hc: 32, water: [300, 450], ph: [5.5, 8.0], kc: [0.35, 1.1, 0.3], ec: 6.0, agro: [8.5, 0.4, 1, 0.12, 1, -60, 0.3] },
  { id: 'centeno', es: 'Centeno', en: 'Rye', emoji: '🌾', family: 'poaceae', cat: 'grain', roles: ['cover', 'forage', 'drought_tolerant'], cycle: [110, 150], topt: [8, 22], tabs: [-25, 30], ft: true, hc: 30, water: [300, 450], ph: [5.0, 7.5], kc: [0.4, 1.1, 0.3], ec: 6.0, agro: [3.0, 0.35, 1, 0.12, 0.7, -60, 0.3] },
  { id: 'arroz', es: 'Arroz', en: 'Rice', emoji: '🍚', family: 'poaceae', cat: 'grain', roles: ['cash'], cycle: [120, 150], topt: [22, 32], tabs: [12, 38], ft: false, hc: 35, water: [900, 1400], ph: [5.0, 7.5], kc: [1.05, 1.2, 0.9], ec: 3.0, agro: [6.0, 0.5, 1, 0.3, 0.2, -120, 0.6] },
  { id: 'amaranto', es: 'Amaranto', en: 'Amaranth', emoji: '🌱', family: 'amaranthaceae', cat: 'grain', roles: ['cash', 'drought_tolerant'], cycle: [90, 120], topt: [20, 32], tabs: [10, 40], ft: false, hc: 38, water: [300, 500], ph: [6.0, 8.0], kc: [0.3, 1.0, 0.5], ec: 4.0, agro: [1.8, 0.75, 1, 0.4, 0.2, -60, 0.6], aka: ['alegria'] },
  { id: 'chia', es: 'Chía', en: 'Chia', emoji: '🌱', family: 'lamiaceae', cat: 'grain', roles: ['cash'], cycle: [120, 150], topt: [16, 28], tabs: [8, 34], ft: false, hc: 34, water: [350, 550], ph: [6.0, 8.0], kc: [0.4, 1.0, 0.4], ec: 2.0, agro: [0.8, 0.85, 1, 0.4, 0, -40, 0.5] },
  { id: 'quinoa', es: 'Quinoa', en: 'Quinoa', emoji: '🌱', family: 'amaranthaceae', cat: 'grain', roles: ['cash', 'drought_tolerant'], cycle: [100, 150], topt: [12, 25], tabs: [-4, 35], ft: true, hc: 32, water: [250, 450], ph: [6.0, 8.5], kc: [0.4, 1.0, 0.6], ec: 8.0, agro: [1.5, 0.85, 1, 0.4, 0, -60, 0.5], aka: ['quinua'] },

  // ───────────── Legumes ─────────────
  { id: 'frijol', es: 'Frijol', en: 'Bean', emoji: '🫘', family: 'fabaceae', cat: 'legume', roles: ['cash', 'legume'], cycle: [85, 110], topt: [16, 28], tabs: [10, 32], ft: false, hc: 32, water: [300, 500], ph: [5.5, 7.8], kc: [0.4, 1.15, 0.35], nfix: true, ec: 1.0, agro: [1.2, 0.7, 0, 0.45, 0, 30, 0.6], aka: ['frijol pinto', 'frijol negro', 'frejol'] },
  { id: 'ejote', es: 'Ejote', en: 'Green bean', emoji: '🫛', family: 'fabaceae', cat: 'vegetable', roles: ['cash', 'legume'], cycle: [60, 80], topt: [16, 28], tabs: [10, 32], ft: false, hc: 32, water: [250, 400], ph: [5.5, 7.5], kc: [0.5, 1.05, 0.9], nfix: true, ec: 1.0, gh: true, agro: [10, 0.65, 0, 0.45, 0.2, 30, 0.8], aka: ['judia verde', 'vainita'] },
  { id: 'garbanzo', es: 'Garbanzo', en: 'Chickpea', emoji: '🫘', family: 'fabaceae', cat: 'legume', roles: ['cash', 'legume', 'drought_tolerant'], cycle: [100, 130], topt: [12, 26], tabs: [-2, 32], ft: true, hc: 32, water: [250, 400], ph: [6.0, 8.5], kc: [0.4, 1.0, 0.35], nfix: true, ec: 1.5, agro: [1.6, 0.65, 0, 0.3, 0, 35, 0.45] },
  { id: 'haba', es: 'Haba', en: 'Faba bean', emoji: '🫛', family: 'fabaceae', cat: 'legume', roles: ['cash', 'legume', 'cover'], cycle: [120, 160], topt: [10, 22], tabs: [-6, 30], ft: true, hc: 28, water: [300, 500], ph: [6.0, 8.0], kc: [0.5, 1.15, 0.3], nfix: true, ec: 1.6, agro: [2.0, 0.6, 1, 0.3, 0.3, 60, 0.5] },
  { id: 'lenteja', es: 'Lenteja', en: 'Lentil', emoji: '🫘', family: 'fabaceae', cat: 'legume', roles: ['cash', 'legume', 'drought_tolerant'], cycle: [100, 130], topt: [12, 24], tabs: [-4, 30], ft: true, hc: 30, water: [250, 400], ph: [6.0, 8.0], kc: [0.4, 1.1, 0.3], nfix: true, ec: 1.5, agro: [1.2, 0.65, 0, 0.3, 0, 30, 0.45] },
  { id: 'chicharo', es: 'Chícharo', en: 'Pea', emoji: '🫛', family: 'fabaceae', cat: 'legume', roles: ['cash', 'legume', 'cover'], cycle: [80, 110], topt: [12, 20], tabs: [-2, 28], ft: true, hc: 27, water: [300, 450], ph: [6.0, 7.5], kc: [0.5, 1.15, 1.1], nfix: true, ec: 1.5, agro: [6.0, 0.7, 0, 0.35, 0.2, 40, 0.7], aka: ['arveja', 'guisante'] },
  { id: 'soya', es: 'Soya', en: 'Soybean', emoji: '🫘', family: 'fabaceae', cat: 'legume', roles: ['cash', 'legume'], cycle: [100, 140], topt: [20, 30], tabs: [10, 38], ft: false, hc: 35, water: [450, 700], ph: [6.0, 7.5], kc: [0.4, 1.15, 0.5], nfix: true, ec: 5.0, agro: [2.8, 0.55, 1, 0.4, 0.1, 40, 0.4], aka: ['soja'] },
  { id: 'cacahuate', es: 'Cacahuate', en: 'Peanut', emoji: '🥜', family: 'fabaceae', cat: 'legume', roles: ['cash', 'legume'], cycle: [120, 150], topt: [22, 30], tabs: [14, 38], ft: false, hc: 34, water: [450, 700], ph: [5.5, 7.0], kc: [0.4, 1.15, 0.6], nfix: true, ec: 3.2, agro: [3.0, 0.7, 0, 0.45, 0.2, 30, 0.6], aka: ['mani', 'cacahuete'] },
  { id: 'veza', es: 'Veza (abono verde)', en: 'Vetch (cover)', emoji: '☘️', family: 'fabaceae', cat: 'legume', roles: ['cover', 'legume', 'forage'], cycle: [100, 130], topt: [8, 22], tabs: [-8, 30], ft: true, hc: 30, water: [250, 400], ph: [5.5, 8.0], kc: [0.4, 1.0, 0.5], nfix: true, ec: 3.0, agro: [4.0, 0.2, 2, 0.1, 0.7, 80, 0.25], aka: ['ebo', 'abono verde'] },
  { id: 'trebol', es: 'Trébol (cobertura)', en: 'Clover (cover)', emoji: '☘️', family: 'fabaceae', cat: 'legume', roles: ['cover', 'legume', 'forage'], cycle: [120, 200], topt: [10, 24], tabs: [-10, 30], ft: true, hc: 30, water: [400, 700], ph: [6.0, 7.5], kc: [0.4, 1.0, 0.85], nfix: true, ec: 1.5, agro: [5.0, 0.2, 2, 0.05, 0.8, 90, 0.25] },
  { id: 'alfalfa', es: 'Alfalfa', en: 'Alfalfa', emoji: '☘️', family: 'fabaceae', cat: 'forage', roles: ['forage', 'legume', 'deep_root'], cycle: [300, 365], topt: [10, 30], tabs: [-10, 38], ft: true, hc: 38, water: [800, 1200], ph: [6.5, 8.5], kc: [0.4, 0.95, 0.9], nfix: true, ec: 2.0, agro: [14, 0.6, 3, 0.02, 1, 120, 0.6] },

  // ───────────── Forage and grasses ─────────────
  { id: 'ballico', es: 'Ballico (ryegrass)', en: 'Ryegrass', emoji: '🌱', family: 'poaceae', cat: 'forage', roles: ['forage', 'cover'], cycle: [150, 240], topt: [10, 22], tabs: [-8, 30], ft: true, hc: 30, water: [500, 800], ph: [5.5, 8.0], kc: [0.4, 1.0, 0.9], ec: 5.6, agro: [12, 0.35, 1, 0.05, 1, -90, 0.35], aka: ['raigras', 'rye grass', 'zacate ballico'] },
  { id: 'pasto_sudan', es: 'Pasto sudán', en: 'Sudangrass', emoji: '🌾', family: 'poaceae', cat: 'forage', roles: ['forage', 'drought_tolerant'], cycle: [80, 120], topt: [22, 34], tabs: [12, 42], ft: false, hc: 40, water: [350, 600], ph: [5.5, 8.5], kc: [0.3, 1.0, 0.8], ec: 2.8, agro: [30, 0.3, 0, 0.3, 1, -90, 0.3], aka: ['sudan', 'zacate sudan'] },
  { id: 'buffel', es: 'Zacate buffel', en: 'Buffelgrass', emoji: '🌾', family: 'poaceae', cat: 'forage', roles: ['forage', 'drought_tolerant', 'deep_root'], cycle: P, topt: [24, 35], tabs: [-6, 45], ft: true, hc: 42, water: [250, 600], ph: [6.0, 8.5], kc: [0.4, 0.85, 0.75], ec: 6.0, agro: [6, 0.25, 1, 0.05, 1, -30, 0.15], per: { first: 1, harvest: [7, 10], plant: [6, 7] }, aka: ['pasto buffel', 'zacate'] },

  // ───────────── Vegetables ─────────────
  { id: 'papa', es: 'Papa', en: 'Potato', emoji: '🥔', family: 'solanaceae', cat: 'vegetable', roles: ['cash'], cycle: [100, 130], topt: [14, 24], tabs: [5, 30], ft: false, hc: 29, water: [450, 650], ph: [5.0, 7.0], kc: [0.5, 1.15, 0.75], ec: 1.7, agro: [28, 0.85, -1, 0.5, 0, -140, 0.9], aka: ['patata'] },
  { id: 'tomate', es: 'Tomate', en: 'Tomato', emoji: '🍅', family: 'solanaceae', cat: 'vegetable', roles: ['cash'], cycle: [100, 140], topt: [18, 28], tabs: [10, 35], ft: false, hc: 32, water: [400, 700], ph: [5.5, 7.5], kc: [0.6, 1.15, 0.8], ec: 2.5, gh: true, agro: [45, 0.95, -1, 0.5, 0, -150, 1], aka: ['jitomate', 'tomate rojo', 'tomate saladette'] },
  { id: 'tomate_verde', es: 'Tomate verde', en: 'Tomatillo', emoji: '🍏', family: 'solanaceae', cat: 'vegetable', roles: ['cash'], cycle: [80, 110], topt: [18, 28], tabs: [10, 35], ft: false, hc: 33, water: [400, 600], ph: [5.5, 7.5], kc: [0.6, 1.1, 0.8], ec: 2.0, gh: true, agro: [20, 0.65, -1, 0.5, 0, -120, 0.8], aka: ['tomatillo', 'tomate de cascara', 'miltomate'] },
  { id: 'chile', es: 'Chile', en: 'Chili pepper', emoji: '🌶️', family: 'solanaceae', cat: 'vegetable', roles: ['cash'], cycle: [120, 150], topt: [18, 30], tabs: [12, 35], ft: false, hc: 33, water: [500, 750], ph: [5.5, 7.5], kc: [0.6, 1.05, 0.9], ec: 1.5, gh: true, agro: [20, 0.9, -1, 0.5, 0, -140, 1], aka: ['jalapeno', 'serrano', 'chile ancho', 'poblano', 'chile seco'] },
  { id: 'pimiento', es: 'Pimiento morrón', en: 'Bell pepper', emoji: '🫑', family: 'solanaceae', cat: 'vegetable', roles: ['cash'], cycle: [110, 150], topt: [18, 28], tabs: [12, 35], ft: false, hc: 32, water: [500, 750], ph: [5.5, 7.0], kc: [0.6, 1.05, 0.9], ec: 1.5, gh: true, agro: [40, 0.9, -1, 0.5, 0, -150, 1], aka: ['morron', 'pimiento'] },
  { id: 'berenjena', es: 'Berenjena', en: 'Eggplant', emoji: '🍆', family: 'solanaceae', cat: 'vegetable', roles: ['cash'], cycle: [110, 150], topt: [20, 30], tabs: [12, 38], ft: false, hc: 35, water: [500, 750], ph: [5.5, 7.0], kc: [0.6, 1.05, 0.9], ec: 1.1, gh: true, agro: [35, 0.6, -1, 0.5, 0, -130, 0.9] },
  { id: 'cebolla', es: 'Cebolla', en: 'Onion', emoji: '🧅', family: 'amaryllidaceae', cat: 'vegetable', roles: ['cash'], cycle: [120, 160], topt: [12, 25], tabs: [-2, 32], ft: true, hc: 32, water: [350, 550], ph: [6.0, 7.5], kc: [0.7, 1.05, 0.75], ec: 1.2, agro: [35, 0.8, -1, 0.5, 0, -120, 0.85] },
  { id: 'ajo', es: 'Ajo', en: 'Garlic', emoji: '🧄', family: 'amaryllidaceae', cat: 'vegetable', roles: ['cash'], cycle: [150, 210], topt: [12, 24], tabs: [-6, 30], ft: true, hc: 30, water: [400, 600], ph: [6.0, 7.5], kc: [0.7, 1.0, 0.7], ec: 1.7, agro: [10, 0.9, -1, 0.45, 0, -120, 0.9] },
  { id: 'calabaza', es: 'Calabaza', en: 'Squash / pumpkin', emoji: '🎃', family: 'cucurbitaceae', cat: 'vegetable', roles: ['cash'], cycle: [90, 120], topt: [18, 30], tabs: [10, 36], ft: false, hc: 34, water: [350, 550], ph: [5.5, 7.5], kc: [0.5, 1.0, 0.8], ec: 3.2, agro: [18, 0.6, 0, 0.45, 0, -90, 0.6], aka: ['calabaza de castilla', 'pepita'] },
  { id: 'calabacita', es: 'Calabacita', en: 'Zucchini', emoji: '🥒', family: 'cucurbitaceae', cat: 'vegetable', roles: ['cash'], cycle: [55, 75], topt: [18, 30], tabs: [10, 35], ft: false, hc: 34, water: [300, 450], ph: [5.5, 7.5], kc: [0.5, 1.0, 0.8], ec: 4.7, gh: true, agro: [25, 0.65, 0, 0.45, 0, -100, 0.8], aka: ['zucchini', 'calabacin'] },
  { id: 'pepino', es: 'Pepino', en: 'Cucumber', emoji: '🥒', family: 'cucurbitaceae', cat: 'vegetable', roles: ['cash'], cycle: [60, 90], topt: [18, 30], tabs: [12, 35], ft: false, hc: 33, water: [350, 500], ph: [5.5, 7.5], kc: [0.6, 1.0, 0.75], ec: 2.5, gh: true, agro: [40, 0.7, -1, 0.45, 0, -120, 0.9] },
  { id: 'sandia', es: 'Sandía', en: 'Watermelon', emoji: '🍉', family: 'cucurbitaceae', cat: 'vegetable', roles: ['cash'], cycle: [80, 110], topt: [22, 32], tabs: [12, 40], ft: false, hc: 36, water: [400, 600], ph: [5.5, 7.5], kc: [0.4, 1.0, 0.75], ec: 2.0, agro: [40, 0.6, 0, 0.45, 0, -90, 0.7] },
  { id: 'melon', es: 'Melón', en: 'Melon', emoji: '🍈', family: 'cucurbitaceae', cat: 'vegetable', roles: ['cash'], cycle: [85, 120], topt: [20, 32], tabs: [12, 40], ft: false, hc: 36, water: [400, 600], ph: [6.0, 7.5], kc: [0.5, 1.05, 0.75], ec: 2.2, gh: true, agro: [30, 0.7, 0, 0.45, 0, -100, 0.8], aka: ['melon cantaloupe', 'chino'] },
  { id: 'lechuga', es: 'Lechuga', en: 'Lettuce', emoji: '🥬', family: 'asteraceae', cat: 'vegetable', roles: ['cash'], cycle: [60, 90], topt: [12, 22], tabs: [2, 28], ft: true, hc: 27, water: [200, 350], ph: [6.0, 7.5], kc: [0.7, 1.0, 0.95], ec: 1.3, gh: true, agro: [25, 0.75, -1, 0.5, 0, -80, 0.8] },
  { id: 'brocoli', es: 'Brócoli', en: 'Broccoli', emoji: '🥦', family: 'brassicaceae', cat: 'vegetable', roles: ['cash'], cycle: [70, 100], topt: [15, 22], tabs: [-2, 28], ft: true, hc: 27, water: [350, 500], ph: [6.0, 7.5], kc: [0.7, 1.05, 0.95], ec: 2.8, agro: [15, 0.75, 1, 0.45, 0.2, -150, 0.8] },
  { id: 'coliflor', es: 'Coliflor', en: 'Cauliflower', emoji: '🥦', family: 'brassicaceae', cat: 'vegetable', roles: ['cash'], cycle: [80, 110], topt: [15, 22], tabs: [-1, 28], ft: true, hc: 27, water: [350, 500], ph: [6.0, 7.5], kc: [0.7, 1.05, 0.95], ec: 2.8, agro: [20, 0.7, 1, 0.45, 0.2, -150, 0.8] },
  { id: 'col', es: 'Col (repollo)', en: 'Cabbage', emoji: '🥬', family: 'brassicaceae', cat: 'vegetable', roles: ['cash'], cycle: [90, 120], topt: [13, 24], tabs: [-4, 30], ft: true, hc: 28, water: [380, 500], ph: [6.0, 7.5], kc: [0.7, 1.05, 0.95], ec: 1.8, agro: [40, 0.5, 1, 0.45, 0.3, -140, 0.7], aka: ['repollo'] },
  { id: 'zanahoria', es: 'Zanahoria', en: 'Carrot', emoji: '🥕', family: 'apiaceae', cat: 'vegetable', roles: ['cash'], cycle: [90, 120], topt: [15, 24], tabs: [2, 30], ft: true, hc: 30, water: [350, 550], ph: [6.0, 7.5], kc: [0.7, 1.05, 0.95], ec: 1.0, agro: [40, 0.6, -1, 0.5, 0, -100, 0.7] },
  { id: 'betabel', es: 'Betabel', en: 'Beetroot', emoji: '🟣', family: 'amaranthaceae', cat: 'vegetable', roles: ['cash'], cycle: [70, 100], topt: [15, 24], tabs: [-2, 30], ft: true, hc: 30, water: [350, 500], ph: [6.0, 7.5], kc: [0.5, 1.05, 0.95], ec: 4.0, agro: [30, 0.5, -1, 0.5, 0.2, -100, 0.7], aka: ['remolacha', 'betarraga'] },
  { id: 'espinaca', es: 'Espinaca', en: 'Spinach', emoji: '🥬', family: 'amaranthaceae', cat: 'vegetable', roles: ['cash'], cycle: [40, 60], topt: [10, 20], tabs: [-6, 26], ft: true, hc: 26, water: [200, 300], ph: [6.0, 7.5], kc: [0.7, 1.0, 0.95], ec: 2.0, gh: true, agro: [15, 0.6, -1, 0.5, 0, -80, 0.8] },
  { id: 'cilantro', es: 'Cilantro', en: 'Coriander', emoji: '🌿', family: 'apiaceae', cat: 'vegetable', roles: ['cash'], cycle: [45, 70], topt: [15, 25], tabs: [-2, 30], ft: true, hc: 30, water: [250, 400], ph: [6.0, 7.5], kc: [0.7, 1.0, 0.9], ec: 1.5, gh: true, agro: [10, 0.6, -1, 0.5, 0, -60, 0.8] },
  { id: 'rabano', es: 'Rábano', en: 'Radish', emoji: '🌱', family: 'brassicaceae', cat: 'vegetable', roles: ['cash'], cycle: [25, 45], topt: [10, 22], tabs: [-2, 28], ft: true, hc: 28, water: [150, 250], ph: [6.0, 7.5], kc: [0.7, 0.9, 0.85], ec: 1.2, gh: true, agro: [15, 0.4, -1, 0.5, 0, -50, 0.6] },
  { id: 'camote', es: 'Camote', en: 'Sweet potato', emoji: '🍠', family: 'convolvulaceae', cat: 'vegetable', roles: ['cash'], cycle: [120, 150], topt: [22, 30], tabs: [12, 38], ft: false, hc: 35, water: [400, 650], ph: [5.5, 7.0], kc: [0.5, 1.15, 0.65], ec: 1.5, agro: [20, 0.5, -1, 0.45, 0.3, -60, 0.6], aka: ['batata'] },
  { id: 'esparrago', es: 'Espárrago', en: 'Asparagus', emoji: '🌱', family: 'asparagaceae', cat: 'vegetable', roles: ['cash', 'deep_root'], cycle: P, topt: [16, 28], tabs: [-20, 38], ft: true, hc: 35, water: [500, 800], ph: [6.5, 8.0], kc: [0.5, 0.95, 0.3], ec: 4.1, agro: [5, 0.95, 1, 0.3, 0, -80, 0.9], per: { first: 2, harvest: [2, 4], plant: [1, 2, 3] } },
  { id: 'fresa', es: 'Fresa', en: 'Strawberry', emoji: '🍓', family: 'rosaceae', cat: 'berry', roles: ['cash'], cycle: [180, 240], topt: [15, 25], tabs: [-6, 32], ft: true, hc: 30, water: [500, 800], ph: [5.5, 6.8], kc: [0.4, 0.85, 0.75], ec: 1.0, gh: true, agro: [40, 1, -1, 0.4, 0, -120, 1], aka: ['frutilla', 'fresas'] },

  // ───────────── Oilseeds e industriales ─────────────
  { id: 'girasol', es: 'Girasol', en: 'Sunflower', emoji: '🌻', family: 'asteraceae', cat: 'oilseed', roles: ['cash', 'deep_root', 'drought_tolerant'], cycle: [100, 130], topt: [18, 30], tabs: [8, 38], ft: false, hc: 36, water: [350, 550], ph: [6.0, 8.0], kc: [0.35, 1.05, 0.35], ec: 4.8, agro: [2.0, 0.55, 1, 0.4, 0, -60, 0.4] },
  { id: 'cartamo', es: 'Cártamo', en: 'Safflower', emoji: '🌼', family: 'asteraceae', cat: 'oilseed', roles: ['cash', 'deep_root', 'drought_tolerant'], cycle: [120, 150], topt: [15, 28], tabs: [-4, 38], ft: true, hc: 36, water: [250, 450], ph: [6.0, 8.5], kc: [0.35, 1.05, 0.25], ec: 7.0, agro: [1.8, 0.5, 1, 0.3, 0, -50, 0.35] },
  { id: 'canola', es: 'Canola', en: 'Canola', emoji: '🌼', family: 'brassicaceae', cat: 'oilseed', roles: ['cash', 'deep_root'], cycle: [120, 160], topt: [12, 24], tabs: [-8, 32], ft: true, hc: 30, water: [350, 500], ph: [5.5, 8.0], kc: [0.35, 1.1, 0.35], ec: 6.0, agro: [2.2, 0.55, 1, 0.3, 0, -90, 0.4], aka: ['colza'] },
  { id: 'algodon', es: 'Algodón', en: 'Cotton', emoji: '☁️', family: 'malvaceae', cat: 'industrial', roles: ['cash', 'deep_root'], cycle: [150, 180], topt: [22, 32], tabs: [14, 40], ft: false, hc: 38, water: [600, 900], ph: [5.5, 8.0], kc: [0.35, 1.15, 0.6], ec: 7.7, agro: [4.5, 0.7, 1, 0.4, 0, -120, 0.6] },
  { id: 'remolacha_azucarera', es: 'Remolacha azucarera', en: 'Sugar beet', emoji: '🍠', family: 'amaranthaceae', cat: 'industrial', roles: ['cash', 'deep_root'], cycle: [160, 200], topt: [15, 25], tabs: [-4, 32], ft: true, hc: 32, water: [550, 750], ph: [6.5, 8.0], kc: [0.35, 1.2, 0.7], ec: 7.0, agro: [60, 0.4, 0, 0.45, 0.3, -130, 0.6], aka: ['betabel azucarero'] },
  { id: 'cana', es: 'Caña de azúcar', en: 'Sugarcane', emoji: '🎋', family: 'poaceae', cat: 'industrial', roles: ['cash'], cycle: [330, 365], topt: [24, 34], tabs: [12, 42], ft: false, hc: 40, water: [1500, 2500], ph: [5.0, 8.0], kc: [0.4, 1.25, 0.75], ec: 1.7, agro: [80, 0.4, 1, 0.2, 0.4, -150, 0.6], aka: ['cana de azucar'] },

  // ───────────── Fruit trees de hueso y pepita (necesitan frío) ─────────────
  { id: 'manzana', es: 'Manzana', en: 'Apple', emoji: '🍎', family: 'rosaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [12, 24], tabs: [-30, 35], ft: true, hc: 35, water: [600, 900], ph: [5.5, 8.0], kc: [0.45, 0.95, 0.75], ec: 1.7, agro: [25, 0.9, 0, 0.1, 0, -80, 0.9], per: { chill: [400, 900], bloom: 4, first: 4, harvest: [8, 10], plant: [12, 1, 2] }, aka: ['manzano', 'manzanas', 'golden', 'red delicious'] },
  { id: 'pera', es: 'Pera', en: 'Pear', emoji: '🍐', family: 'rosaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [12, 25], tabs: [-25, 36], ft: true, hc: 35, water: [600, 900], ph: [6.0, 8.2], kc: [0.45, 0.95, 0.75], ec: 1.7, agro: [20, 0.85, 0, 0.1, 0, -70, 0.85], per: { chill: [400, 900], bloom: 3, first: 5, harvest: [7, 9], plant: [12, 1, 2] }, aka: ['peral', 'peras'] },
  { id: 'durazno', es: 'Durazno', en: 'Peach', emoji: '🍑', family: 'rosaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [15, 28], tabs: [-20, 38], ft: true, hc: 36, water: [600, 900], ph: [6.0, 7.5], kc: [0.45, 0.9, 0.65], ec: 1.7, agro: [15, 0.8, 0, 0.1, 0, -80, 0.9], per: { chill: [200, 800], bloom: 2, first: 3, harvest: [5, 8], plant: [12, 1, 2] }, aka: ['duraznero', 'melocoton', 'duraznos'] },
  { id: 'ciruela', es: 'Ciruela', en: 'Plum', emoji: '🟣', family: 'rosaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [14, 27], tabs: [-20, 38], ft: true, hc: 36, water: [600, 850], ph: [6.0, 7.5], kc: [0.45, 0.9, 0.65], ec: 1.5, agro: [15, 0.75, 0, 0.1, 0, -70, 0.85], per: { chill: [300, 800], bloom: 3, first: 4, harvest: [6, 8], plant: [12, 1, 2] }, aka: ['ciruelo', 'ciruelas'] },
  { id: 'chabacano', es: 'Chabacano', en: 'Apricot', emoji: '🍑', family: 'rosaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [14, 28], tabs: [-20, 38], ft: true, hc: 36, water: [550, 800], ph: [6.0, 8.0], kc: [0.45, 0.9, 0.65], ec: 1.6, agro: [12, 0.85, 0, 0.1, 0, -70, 0.85], per: { chill: [300, 700], bloom: 2, first: 4, harvest: [5, 6], plant: [12, 1, 2] }, aka: ['albaricoque', 'damasco'] },
  { id: 'membrillo', es: 'Membrillo', en: 'Quince', emoji: '🍐', family: 'rosaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [14, 28], tabs: [-20, 38], ft: true, hc: 36, water: [500, 800], ph: [5.5, 8.0], kc: [0.45, 0.9, 0.65], ec: 1.7, agro: [18, 0.65, 0, 0.1, 0, -60, 0.75], per: { chill: [100, 300], bloom: 4, first: 4, harvest: [8, 10], plant: [12, 1, 2] }, aka: ['membrillos', 'ate'] },
  { id: 'cereza', es: 'Cereza', en: 'Sweet cherry', emoji: '🍒', family: 'rosaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [12, 24], tabs: [-25, 34], ft: true, hc: 32, water: [600, 900], ph: [6.0, 7.5], kc: [0.45, 0.95, 0.7], ec: 1.5, agro: [8, 1, 0, 0.1, 0, -60, 1], per: { chill: [600, 1100], bloom: 4, first: 5, harvest: [5, 7], plant: [12, 1, 2] }, aka: ['cerezo', 'cerezas'] },
  { id: 'higo', es: 'Higo', en: 'Fig', emoji: '🌳', family: 'moraceae', cat: 'fruit', roles: ['cash', 'deep_root', 'drought_tolerant'], cycle: P, topt: [18, 32], tabs: [-10, 42], ft: true, hc: 40, water: [400, 700], ph: [6.0, 8.5], kc: [0.4, 0.85, 0.85], ec: 4.0, agro: [10, 0.75, 0, 0.1, 0, -50, 0.7], per: { chill: [100, 300], first: 3, harvest: [6, 9], plant: [1, 2, 3] }, aka: ['higuera', 'higos', 'breva'] },
  { id: 'granada', es: 'Granada', en: 'Pomegranate', emoji: '🔴', family: 'lythraceae', cat: 'fruit', roles: ['cash', 'deep_root', 'drought_tolerant'], cycle: P, topt: [18, 33], tabs: [-12, 42], ft: true, hc: 40, water: [500, 800], ph: [5.5, 8.5], kc: [0.4, 0.85, 0.8], ec: 4.0, agro: [15, 0.75, 0, 0.1, 0, -50, 0.7], per: { chill: [100, 200], bloom: 4, first: 3, harvest: [9, 10], plant: [1, 2, 3] }, aka: ['granado', 'granadas'] },

  // ───────────── Vid ─────────────
  { id: 'uva', es: 'Uva (vid)', en: 'Grape', emoji: '🍇', family: 'vitaceae', cat: 'vine', roles: ['cash', 'deep_root'], cycle: P, topt: [15, 30], tabs: [-18, 42], ft: true, hc: 38, water: [500, 800], ph: [5.5, 8.5], kc: [0.3, 0.7, 0.45], ec: 1.5, agro: [12, 0.95, 0, 0.15, 0, -40, 0.9], per: { chill: [150, 400], bloom: 4, first: 3, harvest: [7, 9], plant: [1, 2, 3] }, aka: ['vid', 'uvas', 'vinedo', 'vino', 'parra', 'uva de mesa'] },

  // ───────────── Nueces ─────────────
  { id: 'nogal', es: 'Nuez pecanera (nogal)', en: 'Pecan', emoji: '🌰', family: 'juglandaceae', cat: 'nut', roles: ['cash', 'deep_root'], cycle: P, topt: [20, 32], tabs: [-20, 44], ft: true, hc: 41, water: [1000, 1400], ph: [6.0, 8.0], kc: [0.5, 1.1, 0.65], ec: 1.5, agro: [2.0, 0.95, 1, 0.1, 0, -100, 0.6], per: { chill: [300, 600], bloom: 4, first: 6, harvest: [10, 12], plant: [12, 1, 2] }, aka: ['nuez', 'nogal pecanero', 'pecan', 'pecana', 'nogalera'] },
  { id: 'nuez_castilla', es: 'Nuez de Castilla', en: 'Walnut', emoji: '🌰', family: 'juglandaceae', cat: 'nut', roles: ['cash', 'deep_root'], cycle: P, topt: [14, 28], tabs: [-25, 38], ft: true, hc: 38, water: [700, 1000], ph: [6.0, 8.0], kc: [0.5, 1.1, 0.65], ec: 1.5, agro: [3.0, 0.95, 1, 0.1, 0, -90, 0.6], per: { chill: [500, 1000], bloom: 4, first: 6, harvest: [9, 10], plant: [12, 1, 2] }, aka: ['nogal de castilla', 'walnut'] },
  { id: 'almendra', es: 'Almendra', en: 'Almond', emoji: '🌰', family: 'rosaceae', cat: 'nut', roles: ['cash', 'deep_root'], cycle: P, topt: [15, 30], tabs: [-15, 42], ft: true, hc: 40, water: [600, 1000], ph: [6.0, 8.5], kc: [0.4, 0.9, 0.65], ec: 1.5, agro: [2.0, 0.95, 1, 0.1, 0, -70, 0.6], per: { chill: [200, 500], bloom: 2, first: 4, harvest: [8, 9], plant: [12, 1, 2] }, aka: ['almendro', 'almendras'] },
  { id: 'pistache', es: 'Pistache', en: 'Pistachio', emoji: '🥜', family: 'anacardiaceae', cat: 'nut', roles: ['cash', 'deep_root', 'drought_tolerant'], cycle: P, topt: [18, 35], tabs: [-15, 46], ft: true, hc: 44, water: [500, 900], ph: [7.0, 8.5], kc: [0.4, 1.1, 0.45], ec: 8.0, agro: [2.5, 1, 1, 0.1, 0, -60, 0.6], per: { chill: [600, 1000], bloom: 4, first: 6, harvest: [8, 9], plant: [12, 1, 2] }, aka: ['pistacho', 'pistaches'] },

  // ───────────── Cítricos y subtropicales (sin heladas) ─────────────
  { id: 'aguacate', es: 'Aguacate', en: 'Avocado', emoji: '🥑', family: 'lauraceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [16, 28], tabs: [-2, 38], ft: false, hc: 36, water: [900, 1300], ph: [5.0, 7.0], kc: [0.6, 0.85, 0.75], ec: 1.3, agro: [10, 1, 0, 0.1, 0, -80, 0.8], per: { first: 4, harvest: [10, 3], plant: [3, 4, 5, 6, 7] }, aka: ['palta', 'hass'] },
  { id: 'naranja', es: 'Naranja', en: 'Orange', emoji: '🍊', family: 'rutaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [18, 30], tabs: [-3, 40], ft: false, hc: 38, water: [900, 1200], ph: [5.5, 7.5], kc: [0.7, 0.65, 0.7], ec: 1.7, agro: [25, 0.55, 0, 0.1, 0, -80, 0.7], per: { first: 4, harvest: [11, 3], plant: [3, 4, 5, 6] }, aka: ['naranjo', 'naranjas', 'citricos'] },
  { id: 'limon', es: 'Limón', en: 'Lime / lemon', emoji: '🍋', family: 'rutaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [20, 32], tabs: [-2, 40], ft: false, hc: 38, water: [900, 1200], ph: [5.5, 7.5], kc: [0.7, 0.65, 0.7], ec: 1.5, agro: [20, 0.7, 0, 0.1, 0, -80, 0.7], per: { first: 3, harvest: [6, 10], plant: [3, 4, 5, 6] }, aka: ['limonero', 'limones', 'lima', 'limon persa'] },
  { id: 'mandarina', es: 'Mandarina', en: 'Mandarin', emoji: '🍊', family: 'rutaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [18, 30], tabs: [-4, 40], ft: false, hc: 38, water: [900, 1200], ph: [5.5, 7.5], kc: [0.7, 0.65, 0.7], ec: 1.7, agro: [22, 0.6, 0, 0.1, 0, -80, 0.7], per: { first: 4, harvest: [10, 1], plant: [3, 4, 5, 6] }, aka: ['mandarinas', 'tangerina'] },
  { id: 'toronja', es: 'Toronja', en: 'Grapefruit', emoji: '🍊', family: 'rutaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [20, 32], tabs: [-3, 40], ft: false, hc: 38, water: [900, 1200], ph: [5.5, 7.5], kc: [0.7, 0.65, 0.7], ec: 1.8, agro: [30, 0.45, 0, 0.1, 0, -80, 0.7], per: { first: 4, harvest: [11, 3], plant: [3, 4, 5, 6] }, aka: ['pomelo'] },
  { id: 'mango', es: 'Mango', en: 'Mango', emoji: '🥭', family: 'anacardiaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [24, 33], tabs: [1, 45], ft: false, hc: 42, water: [800, 1200], ph: [5.5, 7.5], kc: [0.6, 0.8, 0.7], ec: 1.5, agro: [12, 0.7, 0, 0.1, 0, -60, 0.7], per: { first: 4, harvest: [5, 8], plant: [6, 7, 8] }, aka: ['mangos', 'ataulfo'] },
  { id: 'papaya', es: 'Papaya', en: 'Papaya', emoji: '🟠', family: 'caricaceae', cat: 'fruit', roles: ['cash'], cycle: P, topt: [22, 32], tabs: [5, 40], ft: false, hc: 38, water: [1200, 1800], ph: [5.5, 7.0], kc: [0.6, 1.0, 0.9], ec: 1.5, agro: [50, 0.6, 0, 0.2, 0, -120, 0.8], per: { first: 1, harvest: [1, 12], plant: [3, 4, 5, 6, 7, 8] }, aka: ['papayo', 'lechosa'] },
  { id: 'platano', es: 'Plátano', en: 'Banana', emoji: '🍌', family: 'musaceae', cat: 'fruit', roles: ['cash'], cycle: P, topt: [24, 32], tabs: [10, 40], ft: false, hc: 38, water: [1500, 2500], ph: [5.5, 7.5], kc: [0.5, 1.1, 1.0], ec: 1.0, agro: [40, 0.5, 1, 0.15, 0.2, -150, 0.8], per: { first: 1, harvest: [1, 12], plant: [4, 5, 6, 7] }, aka: ['banano', 'banana', 'platanos'] },
  { id: 'guayaba', es: 'Guayaba', en: 'Guava', emoji: '🍈', family: 'myrtaceae', cat: 'fruit', roles: ['cash', 'deep_root'], cycle: P, topt: [20, 30], tabs: [-1, 42], ft: false, hc: 40, water: [800, 1200], ph: [5.0, 7.5], kc: [0.6, 0.8, 0.7], ec: 2.0, agro: [20, 0.55, 0, 0.1, 0, -60, 0.7], per: { first: 3, harvest: [10, 2], plant: [4, 5, 6, 7] }, aka: ['guayabo', 'guayabas'] },
  { id: 'olivo', es: 'Aceituna (olivo)', en: 'Olive', emoji: '🫒', family: 'oleaceae', cat: 'fruit', roles: ['cash', 'deep_root', 'drought_tolerant'], cycle: P, topt: [15, 30], tabs: [-10, 42], ft: true, hc: 40, water: [500, 800], ph: [6.5, 8.5], kc: [0.65, 0.7, 0.7], ec: 4.0, agro: [6, 0.75, 1, 0.1, 0, -40, 0.6], per: { chill: [150, 400], bloom: 4, first: 4, harvest: [10, 12], plant: [2, 3, 4] }, aka: ['olivo', 'aceitunas', 'oliva', 'aceite de oliva'] },
  { id: 'datil', es: 'Dátil (palma datilera)', en: 'Date palm', emoji: '🌴', family: 'arecaceae', cat: 'fruit', roles: ['cash', 'deep_root', 'drought_tolerant'], cycle: P, topt: [25, 38], tabs: [-5, 50], ft: true, hc: 48, water: [1200, 1800], ph: [7.0, 8.5], kc: [0.9, 0.95, 0.95], ec: 4.0, agro: [10, 0.9, 0, 0.1, 0, -60, 0.8], per: { first: 5, harvest: [8, 10], plant: [3, 4, 5] }, aka: ['datiles', 'palma datilera', 'medjool'] },

  // ───────────── Berries (zarzas y arándano) ─────────────
  { id: 'frambuesa', es: 'Frambuesa', en: 'Raspberry', emoji: '🍓', family: 'rosaceae', cat: 'berry', roles: ['cash'], cycle: P, topt: [15, 25], tabs: [-20, 32], ft: true, hc: 30, water: [500, 800], ph: [5.5, 7.0], kc: [0.4, 1.05, 0.5], ec: 1.0, gh: true, agro: [10, 1, 0, 0.15, 0, -60, 1], per: { chill: [200, 800], bloom: 4, first: 1, harvest: [6, 10], plant: [1, 2, 3] }, aka: ['frambuesas', 'berries'] },
  { id: 'zarzamora', es: 'Zarzamora', en: 'Blackberry', emoji: '🫐', family: 'rosaceae', cat: 'berry', roles: ['cash'], cycle: P, topt: [16, 28], tabs: [-15, 35], ft: true, hc: 32, water: [500, 800], ph: [5.5, 7.0], kc: [0.4, 1.05, 0.5], ec: 1.0, gh: true, agro: [12, 0.95, 0, 0.15, 0, -60, 1], per: { chill: [200, 600], bloom: 4, first: 1, harvest: [5, 8], plant: [1, 2, 3] }, aka: ['mora', 'moras', 'zarzamoras'] },
  { id: 'arandano', es: 'Arándano', en: 'Blueberry', emoji: '🫐', family: 'ericaceae', cat: 'berry', roles: ['cash'], cycle: P, topt: [15, 26], tabs: [-25, 34], ft: true, hc: 32, water: [500, 800], ph: [4.5, 5.5], kc: [0.4, 1.0, 0.6], ec: 1.0, gh: true, agro: [10, 1, 0, 0.15, 0, -40, 1], per: { chill: [150, 800], bloom: 3, first: 2, harvest: [4, 7], plant: [1, 2, 3] }, aka: ['arandanos', 'blueberry', 'mora azul'] },

  // ───────────── Prickly pear and agave ─────────────
  { id: 'nopal', es: 'Nopal (verdura y tuna)', en: 'Prickly pear', emoji: '🌵', family: 'cactaceae', cat: 'cactus', roles: ['cash', 'drought_tolerant', 'forage'], cycle: P, topt: [16, 32], tabs: [-10, 45], ft: true, hc: 45, water: [200, 500], ph: [6.0, 8.5], kc: [0.3, 0.45, 0.4], ec: 6.0, agro: [60, 0.4, 0, 0.1, 0.5, -40, 0.6], per: { first: 1, harvest: [3, 10], plant: [2, 3, 4, 5] }, aka: ['tuna', 'tunas', 'nopales', 'nopalitos', 'xoconostle'] },
  { id: 'agave', es: 'Agave (maguey)', en: 'Agave', emoji: '🌵', family: 'asparagaceae', cat: 'cactus', roles: ['cash', 'drought_tolerant', 'deep_root'], cycle: P, topt: [18, 30], tabs: [-8, 45], ft: true, hc: 45, water: [250, 600], ph: [6.0, 8.5], kc: [0.2, 0.35, 0.35], ec: 6.0, agro: [80, 0.8, 0, 0.1, 0, -20, 0.4], per: { first: 6, harvest: [1, 12], plant: [5, 6, 7] }, aka: ['maguey', 'mezcal', 'tequila', 'agave mezcalero', 'pulque'] },

  // ───────────── Herbs ─────────────
  { id: 'oregano', es: 'Orégano', en: 'Oregano', emoji: '🌿', family: 'verbenaceae', cat: 'aromatic', roles: ['cash', 'drought_tolerant'], cycle: P, topt: [15, 30], tabs: [-8, 42], ft: true, hc: 40, water: [300, 600], ph: [6.0, 8.5], kc: [0.4, 0.8, 0.7], ec: 3.0, agro: [3, 0.9, 0, 0.15, 0, -40, 0.7], per: { first: 1, harvest: [6, 10], plant: [3, 4, 5, 6] }, aka: ['oregano mexicano'] },
  { id: 'lavanda', es: 'Lavanda', en: 'Lavender', emoji: '🪻', family: 'lamiaceae', cat: 'aromatic', roles: ['cash', 'drought_tolerant'], cycle: P, topt: [15, 28], tabs: [-15, 38], ft: true, hc: 36, water: [300, 550], ph: [6.5, 8.5], kc: [0.4, 0.75, 0.6], ec: 2.5, agro: [1.5, 0.85, 0, 0.15, 0, -30, 0.8], per: { first: 2, harvest: [6, 7], plant: [3, 4, 10] }, aka: ['lavandin', 'espliego'] },
  { id: 'romero', es: 'Romero', en: 'Rosemary', emoji: '🌿', family: 'lamiaceae', cat: 'aromatic', roles: ['cash', 'drought_tolerant'], cycle: P, topt: [15, 28], tabs: [-10, 40], ft: true, hc: 38, water: [300, 550], ph: [6.0, 8.5], kc: [0.4, 0.75, 0.6], ec: 3.0, agro: [4, 0.7, 0, 0.15, 0, -30, 0.7], per: { first: 1, harvest: [4, 10], plant: [3, 4, 9, 10] } },
]

export const CROPS: Crop[] = raw.map((r) => ({
  id: r.id,
  name: { es: r.es, en: r.en },
  emoji: r.emoji,
  family: r.family,
  category: r.cat,
  roles: r.roles,
  cycle_days: r.cycle,
  temp_opt_c: r.topt,
  temp_abs_c: r.tabs,
  frost_tolerant: r.ft,
  heat_critical_c: r.hc,
  water_need_mm: r.water,
  ph: r.ph,
  kc: { ini: r.kc[0], mid: r.kc[1], end: r.kc[2] },
  n_fixing: !!r.nfix,
  salt_threshold_ds_m: r.ec,
  greenhouse_ok: !!r.gh,
  perennial: !!r.per,
  chill_hours: r.per?.chill ?? null,
  sensitive_month: r.per?.bloom ?? null,
  years_to_first_harvest: r.per?.first ?? null,
  harvest_months: r.per?.harvest ?? null,
  plant_months: r.per?.plant ?? null,
  aliases: r.aka ?? [],
}))
export const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]))

export const CATEGORY_LABEL: Record<CropCategory, string> = {
  grain: 'Grains and cereals',
  legume: 'Legumes',
  forage: 'Forage and grasses',
  vegetable: 'Vegetables',
  oilseed: 'Oilseeds',
  industrial: 'Industrial crops',
  fruit: 'Fruit trees',
  vine: 'Grapevines',
  nut: 'Nuts',
  berry: 'Berries',
  cactus: 'Prickly pear and agave',
  aromatic: 'Herbs',
}

/** Parámetros internos del motor de demostración (no forman parte del contrato). */
export const AGRO: Record<string, { yield_t_ha: number; value_index: number; residue: number; c_factor: number; forage: number; n_kg_ha: number; labor: number }> = Object.fromEntries(
  raw.map((r) => [r.id, { yield_t_ha: r.agro[0], value_index: r.agro[1], residue: r.agro[2], c_factor: r.agro[3], forage: r.agro[4], n_kg_ha: r.agro[5], labor: r.agro[6] }]),
)

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Busca el cultivo mencionado en un texto libre ("¿cuándo planto manzanos?").
 * Gana la coincidencia más larga para no confundir "nuez" con "nuez de Castilla".
 */
export function findCropInText(text: string): Crop | undefined {
  const t = ` ${norm(text).replace(/[^a-z0-9ñ ]/g, ' ')} `
  let best: { crop: Crop; len: number } | undefined
  for (const c of CROPS) {
    const base = norm(c.name.en).replace(/\(.*?\)/g, ' ').trim()
    const inParens = [...norm(c.name.es).matchAll(/\(([^)]+)\)/g)].map((m) => m[1])
    const tokens = [base, norm(c.name.es).replace(/\(.*?\)/g, ' ').trim(), ...inParens, c.id.replace(/_/g, ' '), ...c.aliases.map(norm)]
    for (const tok of tokens) {
      if (tok.length < 3) continue
      if (new RegExp(`\\s${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?\\s`).test(t) && (!best || tok.length > best.len)) best = { crop: c, len: tok.length }
    }
  }
  return best?.crop
}

/** Busca cultivos por nombre o alias (para buscadores). */
export function searchCrops(q: string, pool: Crop[] = CROPS): Crop[] {
  const n = norm(q.trim())
  if (!n) return pool
  return pool.filter((c) => norm(c.name.es).includes(n) || c.aliases.some((a) => norm(a).includes(n)) || norm(c.name.en).includes(n))
}
