'use strict';

// ============================================================
//  Configuration
// ============================================================
const STORAGE_KEY = 'menu-proteine-v2';
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const DAY_EMOJIS = ['🥦', '🥕', '🍅', '🥑', '🍋', '🍓', '🫐'];

// Chaque portion peut être agrandie ou réduite dans ces limites (1 = portion de base)
const SLOTS = {
  petitdej:  { label: 'Petit-déjeuner', icon: '🥣', type: 'petitdej',  min: 0.6, max: 2.2 },
  dejeuner:  { label: 'Déjeuner',       icon: '🥗', type: 'plat',      min: 0.6, max: 2.6 },
  collation: { label: 'Collation',      icon: '🍎', type: 'collation', min: 0.5, max: 2.5 },
  diner:     { label: 'Dîner',          icon: '🍲', type: 'plat',      min: 0.6, max: 2.6 },
};

const MACROS = ['kcal', 'p', 'c', 'f'];
// Importance de chaque objectif dans l'optimisation : calories > protéines > glucides/lipides
const WEIGHTS = { kcal: 3, p: 2, c: 1, f: 1 };
const TRIES_PER_DAY = 500;
// Rappel vers une portion « homogène » : évite par ex. un déjeuner énorme et un dîner minuscule
const BALANCE = 0.04;

const REGIMES = {
  omnivore: {
    label: 'Omnivore',
    desc: 'Toutes les recettes : viandes, poissons, œufs, laitages et légumineuses.',
    allows: () => true,
  },
  pescetarien: {
    label: 'Pesco-végétarien',
    desc: 'Pas de viande. Poissons, fruits de mer, œufs et laitages autorisés.',
    allows: r => !r.tags.has('viande'),
  },
  vegetarien: {
    label: 'Végétarien',
    desc: 'Ni viande ni poisson. Les protéines viennent des œufs, laitages, tofu et légumineuses.',
    allows: r => !r.tags.has('viande') && !r.tags.has('poisson'),
  },
  anti: {
    label: 'Anti-inflammatoire 🌿',
    desc: "Riche en oméga-3 (saumon, sardines, noix), en antioxydants (fruits rouges, légumes verts, curcuma) et en fibres. Huile d'olive ; pas de viande rouge, de charcuterie ni de sucres ajoutés.",
    allows: r => r.anti === true,
  },
};

// Temps en cuisine les soirs de semaine (le week-end, pas de limite)
const TIME_OPTIONS = [
  ['express', '⚡ Express : 15 min max en semaine', 15],
  ['normal', '⏱️ Normal : 30 min max en semaine', 30],
  ['chef', "👩‍🍳 On aime cuisiner : pas de limite", 999],
];
// Budget courses du foyer pour la semaine (plafond = haut de la tranche)
const BUDGET_OPTIONS = [
  ['libre', '💶 Pas de limite', null],
  ['90', '🪙 Moins de 90 € / semaine', 90],
  ['120', '💶 90 à 120 € / semaine', 120],
  ['150', '💶 120 à 150 € / semaine', 150],
  ['180', '💰 150 à 180 € / semaine', 180],
];
// On achète des paquets entiers et il y a des restes : +15 % sur le coût des quantités utilisées
const WASTE = 1.15;

// ---------- Quiz « Nos envies de la semaine »
const MOODS = [
  ['frais', '🥗', 'Frais & léger', 'Salades, bowls, poke'],
  ['reconfort', '🍲', 'Réconfortant', 'Plats chauds, gratins, soupes'],
  ['epice', '🌶️', 'Épicé & voyage', 'Curry, chili, fajitas, pad thaï'],
  ['iode', '🐟', 'Iodé', 'Poissons et fruits de mer'],
  ['vegetal', '🌱', 'Plus végétal', 'Légumineuses, tofu, œufs'],
];
const LUNCH_OPTIONS = [
  ['maison', '🏠', 'À la maison', 'On cuisine le midi'],
  ['box', '🥡', 'En lunch box', 'Des plats qui se transportent et se réchauffent bien'],
  ['cantine', '🍴', 'Cantine / resto', 'Pas de déjeuner à cuisiner du lundi au vendredi'],
];
const PLAISIR_OPTIONS = [
  ['', '🙅', 'Non merci', 'On reste sage'],
  ['4', '🍕', 'Vendredi soir', 'Pour fêter la fin de semaine'],
  ['5', '🍔', 'Samedi soir', 'Burger, pizza, fajitas…'],
  ['6', '🌮', 'Dimanche soir', 'Avant de reprendre la semaine'],
];
const hasIng = (...ids) => r => ids.some(id => r.ingIds.has(id));
const DISLIKES = {
  poisson:      { icon: '🐟', label: 'Poisson & fruits de mer', test: r => r.tags.has('poisson') },
  viande:       { icon: '🥩', label: 'Viande', test: r => r.tags.has('viande') },
  tofu:         { icon: '🧊', label: 'Tofu', test: hasIng('tofu') },
  oeufs:        { icon: '🥚', label: 'Œufs', test: hasIng('oeufs', 'blancoeuf') },
  laitiers:     { icon: '🥛', label: 'Produits laitiers', test: r => r.tags.has('lactose') },
  legumineuses: { icon: '🫘', label: 'Légumineuses', test: hasIng('lentilles', 'poischiches', 'harirouges', 'edamame', 'houmous', 'petitspois') },
  whey:         { icon: '🥤', label: 'Protéine en poudre', test: r => r.tags.has('whey') },
};

// « Pas envie de » libre : un mot tapé par l'utilisateur → ingrédients correspondants
const normText = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function ingredientsMatching(term) {
  const t = normText(term).replace(/(s|x)$/, ''); // « tomates » → « tomate »
  if (t.length < 3) return [];
  return Object.keys(INGREDIENTS).filter(id => {
    const ing = INGREDIENTS[id];
    return normText(ing.name).includes(t) || normText(ing.search).includes(t) || normText(id).includes(t);
  });
}
const customDislikeIds = () => [...new Set(state.quiz.custom.flatMap(ingredientsMatching))];

// Repas pris dehors : on ne cuisine pas, mais on estime ce qu'il apporte
// (part des calories de la journée + répartition des macros) pour rééquilibrer le reste
const EXTERNAL = {
  restau: {
    label: 'Restaurant', icon: '🍽️', share: 0.40, split: { p: 0.18, c: 0.42, f: 0.40 },
    tip: 'Une viande ou un poisson grillé avec des légumes, et on partage le dessert 😉. Le reste de la journée est allégé.',
  },
  soiree: {
    label: 'Soirée', icon: '🎉', share: 0.50, split: { p: 0.10, c: 0.40, f: 0.35 }, // le reste ≈ alcool
    tip: "Mange avant de partir et bois un verre d'eau entre chaque verre. Demain, plats hydratants et digestes.",
  },
  cantine: {
    label: 'Cantine / resto du midi', icon: '🍴', share: 0.32, split: { p: 0.20, c: 0.45, f: 0.35 },
    tip: 'Une source de protéines + des légumes : le dîner complète ce qui manque.',
  },
};

// Objectifs : facteur appliqué aux calories d'entretien et protéines en g par kg de poids de corps
const GOALS = {
  perte:    { kcal: 0.8, proteines: 2.0 },  // sèche : préserver le muscle
  recompo:  { kcal: 0.9, proteines: 2.2 },  // léger déficit + beaucoup de protéines
  maintien: { kcal: 1.0, proteines: 1.6 },
  prise:    { kcal: 1.1, proteines: 2.0 },  // surplus modéré pour construire du muscle
};

const PROFILE_OPTIONS = {
  sexe: [['femme', 'Femme'], ['homme', 'Homme']],
  activite: [
    ['1.2', 'Sédentaire (peu ou pas de sport)'],
    ['1.375', 'Légère (1-3 séances/semaine)'],
    ['1.55', 'Modérée (3-5 séances/semaine)'],
    ['1.725', 'Intense (6-7 séances/semaine)'],
  ],
  objectif: [
    ['perte', 'Perte de gras (-20 % kcal, 2 g/kg de protéines)'],
    ['recompo', 'Recomposition corporelle (-10 % kcal, 2,2 g/kg)'],
    ['maintien', 'Maintien (1,6 g/kg)'],
    ['prise', 'Prise de muscle (+10 % kcal, 2 g/kg)'],
  ],
};

function defaultPerson(id, name, profile) {
  // saved = mensurations enregistrées : on affiche alors un résumé au lieu du formulaire
  return { id, name, active: true, collation: true, regime: 'omnivore', saved: false, profile, targets: computeNeeds(profile) };
}

const DEFAULT_STATE = {
  people: [
    defaultPerson('lola', 'Lola', { sexe: 'femme', age: 23, poids: 60, taille: 165, activite: '1.375', objectif: 'maintien' }),
    defaultPerson('barnabe', 'Barnabé', { sexe: 'homme', age: 25, poids: 78, taille: 180, activite: '1.55', objectif: 'maintien' }),
  ],
  prefs: { temps: 'normal', budget: 'libre' },
  quiz: { moods: [], events: {}, lunch: 'maison', dislikes: [], custom: [], plaisirDay: null },
  driveUrl: '',
  // [{ meals: [{ slot, recipeId, variants?: { lola: 'dahl' }, scales: { lola: 1.2, barnabe: 1.5 } }
  //            (ou { slot, external: 'soiree', scales })] }] × 7
  // variants : recette propre à une personne quand la recette commune ne convient pas à son régime
  plan: null,
  checked: {},     // ingrédients cochés dans la liste de courses
  products: {},    // produit Open Food Facts choisi pour chaque ingrédient
  useRealNutrition: false, // calculer avec les valeurs des produits choisis
  stock: null,     // résultat du favori « Stock Drive » : { magasin, date, items: { ingrédient: {...} } }
  unavailable: [], // ingrédients en rupture au Drive, écartés à la prochaine génération
};

const RECIPE_BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));

// Étiquettes d'une recette : celles de ses ingrédients + celles du quiz (data.js)
for (const r of RECIPES) {
  r.ingIds = new Set(r.ingredients.map(([id]) => id));
  r.tags = new Set(r.ingredients.flatMap(([id]) => INGREDIENTS[id].tags || []));
  r.cher = r.ingredients.some(([id]) => INGREDIENTS[id].cher);
  r.flags = new Set(Object.keys(RECIPE_FLAGS).filter(f => RECIPE_FLAGS[f].includes(r.id)));
  if (r.tags.has('poisson')) r.flags.add('iode');
  if (!r.tags.has('viande') && !r.tags.has('poisson')) r.flags.add('vegetal');
}

// ============================================================
//  État + sauvegarde locale
// ============================================================
// Magasin par défaut : Leclerc Drive Clermont-Ferrand (170 avenue du Brézet)
const DEFAULT_DRIVE_URL = 'https://fd14-courses.leclercdrive.fr/magasin-016301-Clermont-Ferrand';

let state = loadState();
if (!state.driveUrl) state.driveUrl = DEFAULT_DRIVE_URL;

function loadState() {
  const base = structuredClone(DEFAULT_STATE);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      const quiz = { ...base.quiz, ...saved.quiz };
      quiz.dislikes = quiz.dislikes.filter(k => DISLIKES[k]); // anciennes options retirées
      return {
        ...base, ...saved,
        people: base.people.map(p => {
          const s = (saved.people || []).find(x => x.id === p.id) || {};
          return {
            ...p, ...s,
            active: true,
            regime: s.regime || saved.prefs?.regime || 'omnivore', // l'ancien régime commun devient celui de chacun
            profile: { ...p.profile, ...s.profile },
            targets: { ...p.targets, ...s.targets },
          };
        }),
        prefs: { ...base.prefs, ...saved.prefs },
        quiz,
      };
    }
  } catch { /* stockage indisponible : on repart des valeurs par défaut */ }
  return base;
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

const personById = id => state.people.find(p => p.id === id);
const activePeople = () => state.people.filter(p => p.active);
const personEats = (p, slot) => p.active && (slot !== 'collation' || p.collation);

// ============================================================
//  Calculs nutritionnels
// ============================================================
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];

function computeNeeds({ sexe, age, poids, taille, activite, objectif }) {
  // Mifflin-St Jeor
  const bmr = 10 * poids + 6.25 * taille - 5 * age + (sexe === 'homme' ? 5 : -161);
  const goal = GOALS[objectif] || GOALS.maintien;
  const kcal = Math.round((bmr * Number(activite) * goal.kcal) / 10) * 10;
  const p = Math.round(poids * goal.proteines);
  const f = Math.round((kcal * 0.27) / 9);
  const c = Math.max(0, Math.round((kcal - 4 * p - 9 * f) / 4));
  return { kcal, p, c, f };
}

// Valeurs pour 100 g d'un ingrédient : celles du produit Open Food Facts choisi
// (si l'option est activée et la fiche complète), sinon celles de notre base
function nutrition(id) {
  const product = state.useRealNutrition && state.products[id];
  return product && hasMacros(product) ? product : INGREDIENTS[id];
}

// Valeurs nutritionnelles d'une recette en portion de base (sans arrondi)
function recipeBase(recipe) {
  const tot = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const [id, g] of recipe.ingredients) {
    const n = nutrition(id);
    for (const m of MACROS) tot[m] += (n[m] * g) / 100;
  }
  return tot;
}

// ---------- Coûts (prix indicatifs de data.js, ou prix réels du Drive s'ils ont été importés)
function pricePerKg(id) {
  const r = state.stock?.items[id];
  if (r?.statut === 'ok' && r.produit.prix_kg) return r.produit.prix_kg;
  return PRICES[id] || 0;
}

// Coût d'une recette en portion de base
function recipeCost(recipe) {
  return recipe.ingredients.reduce((sum, [id, g]) => sum + (pricePerKg(id) * g) / 1000, 0);
}

// Coût d'une journée (tous les convives) à partir des portions de chacun
function dayCost(meals, scales) {
  let total = 0;
  meals.forEach((m, i) => {
    if (m.external) return;
    for (const [pid, x] of Object.entries(scales[i])) {
      if (x != null) total += recipeCost(m.variants?.[pid] || m.recipe) * x;
    }
  });
  return total;
}

const budgetCap = () => BUDGET_OPTIONS.find(([k]) => k === state.prefs.budget)?.[2] ?? null;

// Malus si la journée dépasse sa part du budget hebdomadaire
function budgetPenalty(cost) {
  const cap = budgetCap();
  if (!cap) return 0;
  const over = (cost * WASTE) / (cap / 7) - 1;
  return over > 0 ? 0.3 * over + 1.5 * over * over : 0;
}

// Arrondit une quantité pour qu'elle soit réaliste en cuisine
function roundGrams(ing, g) {
  if (ing.whole) return Math.max(1, Math.round(g / ing.piece)) * ing.piece;
  if (g < 20) return Math.max(1, Math.round(g));
  return Math.round(g / 5) * 5;
}

// Estimation de ce qu'apporte un repas pris dehors pour une personne
function externalTotals(kind, person) {
  const { share, split } = EXTERNAL[kind];
  const kcal = share * targetsOf(person).kcal;
  return { kcal, p: (kcal * split.p) / 4, c: (kcal * split.c) / 4, f: (kcal * split.f) / 9 };
}

// Recette mangée par une personne : sa variante éventuelle, sinon la recette commune
const recipeOf = (meal, personId) => RECIPE_BY_ID[meal.variants?.[personId] || meal.recipeId];

// Portion d'une personne pour un repas : quantités arrondies + totaux réels (null si elle n'en mange pas)
function mealDetail(meal, personId) {
  const scale = meal.scales[personId];
  if (scale == null) return null;
  if (meal.external) return { items: [], totals: externalTotals(meal.external, personById(personId)) };
  const totals = { kcal: 0, p: 0, c: 0, f: 0 };
  const items = recipeOf(meal, personId).ingredients.map(([id, g]) => {
    const ing = INGREDIENTS[id];
    const grams = roundGrams(ing, g * scale);
    const n = nutrition(id);
    for (const m of MACROS) totals[m] += (n[m] * grams) / 100;
    return { id, ing, g: grams };
  });
  return { items, totals };
}

function dayTotals(day, personId) {
  const tot = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const meal of day.meals) {
    const detail = mealDetail(meal, personId);
    if (detail) for (const m of MACROS) tot[m] += detail.totals[m];
  }
  return tot;
}

// ============================================================
//  Algorithme de planification
// ============================================================

// Créneaux du foyer : la collation n'apparaît que si au moins une personne en prend une
function daySlots() {
  const snack = activePeople().some(p => p.collation);
  return ['petitdej', 'dejeuner', ...(snack ? ['collation'] : []), 'diner'];
}

// Ce que les réponses au quiz impliquent pour le jour d (0 = lundi)
function dayContext(d) {
  const q = state.quiz;
  const weekday = d < 5;
  return {
    weekday,
    event: q.events[d] || null,                       // dîner dehors : 'restau' | 'soiree'
    lendemain: d > 0 && q.events[d - 1] === 'soiree', // la veille était une soirée
    lunch: weekday ? q.lunch : 'maison',
    plaisir: q.plaisirDay !== null && Number(q.plaisirDay) === d && !q.events[d],
  };
}

// Squelette de la journée : quels créneaux sont cuisinés, lesquels sont pris dehors
function daySkeleton(d) {
  const ctx = dayContext(d);
  return daySlots().map(slot => {
    if (slot === 'dejeuner' && ctx.lunch === 'cantine') return { slot, external: 'cantine' };
    if (slot === 'diner' && ctx.event) return { slot, external: ctx.event };
    return { slot };
  });
}

// Objectifs du jour : le lendemain de soirée, journée un peu plus légère et moins grasse
function dayTargets(person, d) {
  const T = targetsOf(person);
  if (!dayContext(d).lendemain) return T;
  return { kcal: T.kcal * 0.9, p: T.p, c: T.c * 0.9, f: T.f * 0.8 };
}

// Filtres communs au foyer : « pas envie de » du quiz et ruptures au Drive
function householdAllows(recipe) {
  if (state.unavailable.some(id => recipe.ingIds.has(id))) return false; // en rupture au Drive
  if (state.quiz.dislikes.some(k => DISLIKES[k]?.test(recipe))) return false;
  return !customDislikeIds().some(id => recipe.ingIds.has(id));
}

// Régime propre à chaque personne
const personAllows = (recipe, person) => REGIMES[person.regime]?.allows(recipe) ?? true;
const allowedForAll = recipe => activePeople().every(p => personAllows(recipe, p));

// Recettes possibles par type de repas : pour une personne, ou pour le foyer
// (= acceptées par au moins une personne ; les autres auront une variante)
function recipePools(person = null) {
  const pools = { petitdej: [], plat: [], collation: [] };
  for (const r of RECIPES) {
    if (!householdAllows(r)) continue;
    const ok = person ? personAllows(r, person) : activePeople().some(p => personAllows(r, p));
    if (ok) pools[r.type].push(r);
  }
  return pools;
}

// Pour chaque personne qui ne peut pas manger la recette commune, on tire sa variante
function pickVariants(d, slot, recipe, exclude) {
  const variants = {};
  for (const p of activePeople()) {
    if (!personEats(p, slot) || personAllows(recipe, p)) continue;
    const v = weightedPick(slotPool(d, slot, recipePools(p)), exclude);
    variants[p.id] = v;
    exclude.push(v);
  }
  return variants;
}

// Recettes possibles pour un créneau donné, selon le contexte du jour.
// Chaque filtre n'est appliqué que s'il laisse au moins 2 recettes.
function slotPool(d, slot, pools) {
  const ctx = dayContext(d);
  let pool = pools[SLOTS[slot].type];
  const narrow = test => { const f = pool.filter(test); if (f.length >= 2) pool = f; };
  // Le plaisir demandé passe avant le mode « récup » du lendemain de soirée
  if (slot === 'diner' && ctx.plaisir) narrow(r => r.flags.has('plaisir'));
  else if (ctx.lendemain) narrow(r => r.flags.has('recup'));
  if (slot === 'dejeuner' && ctx.lunch === 'box') narrow(r => r.flags.has('box'));
  if (ctx.weekday && SLOTS[slot].type === 'plat') {
    const limit = TIME_OPTIONS.find(([k]) => k === state.prefs.temps)?.[2] ?? 999;
    narrow(r => r.time <= limit);
  }
  return pool;
}

// Plus une recette correspond aux envies, plus elle a de chances d'être tirée
function recipeWeight(r) {
  let w = 1;
  if (!allowedForAll(r)) w *= 0.6; // on préfère un peu un plat commun, plus simple à cuisiner
  if (state.quiz.moods.some(m => r.flags.has(m))) w *= 3;
  const cap = budgetCap();
  if (cap && cap <= 120 && r.cher) w *= 0.3;
  return w;
}

// Bonus / malus ajoutés au score d'une journée (plus petit = meilleur)
function preferenceScore(recipes) {
  return recipes.reduce((sum, r) => sum
    - (state.quiz.moods.some(m => r.flags.has(m)) ? 0.03 : 0)
    + ((budgetCap() ?? 999) <= 120 && r.cher ? 0.05 : 0), 0);
}

function weightedPick(pool, exclude) {
  const candidates = pool.filter(r => !exclude.includes(r)); // déjeuner ≠ dîner
  const list = candidates.length ? candidates : pool;
  let x = Math.random() * list.reduce((a, r) => a + recipeWeight(r), 0);
  for (const r of list) { x -= recipeWeight(r); if (x <= 0) return r; }
  return list[list.length - 1];
}

function targetsOf(person) {
  // Évite les divisions par zéro si un objectif est vide
  const t = {};
  for (const m of MACROS) t[m] = Math.max(1, Number(person.targets[m]) || 0);
  return t;
}

/**
 * Trouve le facteur de portion de chaque repas pour que la journée d'UNE personne colle
 * au mieux à ses objectifs (moindres carrés pondérés, descente par coordonnées,
 * chaque facteur étant borné par les limites du créneau).
 */
function optimizeScales(recipes, slotKeys, T) {
  const V = recipes.map(recipeBase);
  const n = V.length;
  const totalKcal = V.reduce((a, v) => a + v.kcal, 0);
  const uniform = T.kcal / totalKcal; // même facteur pour tous les repas de la journée
  const s = slotKeys.map(k => clamp(uniform, SLOTS[k].min, SLOTS[k].max));

  for (let iter = 0; iter < 25; iter++) {
    for (let i = 0; i < n; i++) {
      let num = 0, den = 0;
      for (const m of MACROS) {
        let others = 0;
        for (let j = 0; j < n; j++) if (j !== i) others += s[j] * V[j][m];
        const w = WEIGHTS[m] / (T[m] * T[m]);
        num += w * V[i][m] * (T[m] - others);
        den += w * V[i][m] * V[i][m];
      }
      num += BALANCE * uniform;
      den += BALANCE;
      const slot = SLOTS[slotKeys[i]];
      s[i] = clamp(num / den, slot.min, slot.max);
    }
  }

  let err = 0;
  for (const m of MACROS) {
    const tot = V.reduce((a, v, j) => a + s[j] * v[m], 0);
    err += WEIGHTS[m] * ((tot - T[m]) / T[m]) ** 2;
  }
  for (const x of s) err += BALANCE * (x - uniform) ** 2;
  return { scales: s, err };
}

/**
 * Pour des repas communs, calcule les portions de chaque personne.
 * meals : [{ slot, recipe }  ou  { slot, external }] — les repas pris dehors sont
 * déduits des objectifs du jour avant d'optimiser les repas cuisinés.
 * Renvoie { scales: [{ lola: x, barnabe: y }, …] (un objet par repas), err: somme des écarts }.
 */
function optimizeHousehold(meals, d) {
  const scales = meals.map(() => ({}));
  let err = 0;
  for (const person of state.people) {
    meals.forEach((m, i) => { scales[i][person.id] = m.external && personEats(person, m.slot) ? 1 : null; });
    if (!person.active) continue;

    const full = dayTargets(person, d);
    const T = { ...full };
    for (const m of meals) {
      if (!m.external || !personEats(person, m.slot)) continue;
      const e = externalTotals(m.external, person);
      for (const k of MACROS) T[k] = Math.max(full[k] * 0.25, T[k] - e[k]);
    }

    const idx = meals.map((_, i) => i).filter(i => !meals[i].external && personEats(person, meals[i].slot));
    if (!idx.length) continue;
    const res = optimizeScales(idx.map(i => meals[i].variants?.[person.id] || meals[i].recipe), idx.map(i => meals[i].slot), T);
    idx.forEach((i, k) => { scales[i][person.id] = res.scales[k]; });
    err += res.err;
  }
  return { scales, err };
}

// Pénalise les recettes déjà beaucoup utilisées dans la semaine (variété)
function varietyPenalty(recipes, usage) {
  return recipes.reduce((sum, r) => {
    const u = usage[r.id] || 0;
    return sum + u * 0.2 + (u >= 2 ? 0.5 : 0); // on évite de resservir un plat dans la semaine
  }, 0);
}

// Équilibre des sources de protéines sur la semaine (viande / poisson / végétal) :
// chaque plat d'une famille déjà servie coûte un peu plus cher, ce qui alterne les familles
// (calculé sur les plats communs : les variantes ne comptent pas pour les autres convives)
const proteinFamily = r => (r.tags.has('viande') ? 'viande' : r.tags.has('poisson') ? 'poisson' : 'vegetal');
function familyCounts(skipDay = -1, skipMeal = -1) {
  const count = { viande: 0, poisson: 0, vegetal: 0 };
  (state.plan || []).forEach((day, d) => day.meals.forEach((m, i) => {
    if (!m.recipeId || (d === skipDay && (skipMeal === -1 || i === skipMeal))) return;
    const r = RECIPE_BY_ID[m.recipeId];
    if (r.type === 'plat') count[proteinFamily(r)]++;
  }));
  return count;
}
function familyPenalty(recipes, families) {
  const count = { ...families };
  return recipes.reduce((sum, r) => {
    if (r.type !== 'plat') return sum;
    const f = proteinFamily(r);
    const pen = 0.03 * count[f];
    count[f]++;
    return sum + pen;
  }, 0);
}

// Repas du plan → format attendu par optimizeHousehold
const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj || {}).map(([k, v]) => [k, fn(v)]));
const toOptMeals = day => day.meals.map(m => ({
  slot: m.slot, external: m.external, recipe: RECIPE_BY_ID[m.recipeId], variants: mapValues(m.variants, id => RECIPE_BY_ID[id]),
}));
function fromOptMeal(m, scales) {
  if (m.external) return { slot: m.slot, external: m.external, scales };
  const out = { slot: m.slot, recipeId: m.recipe.id, scales };
  if (m.variants && Object.keys(m.variants).length) out.variants = mapValues(m.variants, r => r.id);
  return out;
}
// Toutes les recettes d'un repas (commune + variantes), pour compter la variété
const mealRecipeIds = m => (m.recipeId ? [m.recipeId, ...Object.values(m.variants || {})] : []);

function generateDay(d, pools, usage, families) {
  const skeleton = daySkeleton(d);
  const slotPools = skeleton.map(s => (s.external ? null : slotPool(d, s.slot, pools)));
  let best = null;
  for (let t = 0; t < TRIES_PER_DAY; t++) {
    const picks = [];
    const shared = [];
    let nVariants = 0;
    const meals = skeleton.map((s, i) => {
      if (s.external) return { slot: s.slot, external: s.external };
      const r = weightedPick(slotPools[i], picks);
      picks.push(r);
      shared.push(r);
      const variants = pickVariants(d, s.slot, r, picks);
      nVariants += Object.keys(variants).length;
      return { slot: s.slot, recipe: r, variants };
    });
    const { scales, err } = optimizeHousehold(meals, d);
    const score = err + varietyPenalty(picks, usage) + familyPenalty(shared, families) + preferenceScore(picks)
      + budgetPenalty(dayCost(meals, scales)) + 0.01 * nVariants; // un plat commun, c'est moins de cuisine
    if (!best || score < best.score) best = { score, meals: meals.map((m, i) => fromOptMeal(m, scales[i])) };
  }
  return best.meals;
}

function usageExcept(skipDay = -1, skipMeal = -1) {
  const usage = {};
  (state.plan || []).forEach((day, d) => day.meals.forEach((m, i) => {
    if (d === skipDay && (skipMeal === -1 || i === skipMeal)) return;
    for (const id of mealRecipeIds(m)) usage[id] = (usage[id] || 0) + 1;
  }));
  return usage;
}

function canPlan(pools) {
  for (const p of activePeople()) {
    const own = recipePools(p);
    const missing = daySlots().filter(k => personEats(p, k)).map(k => SLOTS[k]).filter(s => own[s.type].length === 0);
    if (missing.length) {
      showNotice(`Aucune recette ne convient à ${p.name} pour : ${[...new Set(missing.map(s => s.label))].join(', ')}. Change son régime ou retire un « pas envie de ».`);
      return false;
    }
  }
  return pools.plat.length > 0;
}

function generateWeek() {
  const pools = recipePools();
  if (!canPlan(pools)) return;
  const usage = {};
  const families = { viande: 0, poisson: 0, vegetal: 0 };
  state.plan = DAYS.map((_, d) => {
    const meals = generateDay(d, pools, usage, families);
    for (const m of meals) {
      for (const id of mealRecipeIds(m)) usage[id] = (usage[id] || 0) + 1;
      if (m.recipeId && RECIPE_BY_ID[m.recipeId].type === 'plat') families[proteinFamily(RECIPE_BY_ID[m.recipeId])]++;
    }
    return { meals };
  });
  state.checked = {};
  showNotice('');
  saveState();
  render();
}

function regenerateDay(d) {
  const pools = recipePools();
  if (!canPlan(pools)) return;
  state.plan[d].meals = generateDay(d, pools, usageExcept(d), familyCounts(d));
  saveState();
  render();
}

// Remplace un repas par une autre recette du même type, puis rééquilibre la journée
function swapMeal(d, i) {
  const day = state.plan[d];
  const current = day.meals[i];
  if (current.external) return;
  const others = day.meals.filter((_, j) => j !== i).map(m => m.recipeId);
  const pool = slotPool(d, current.slot, recipePools())
    .filter(r => r.id !== current.recipeId && !others.includes(r.id));
  if (!pool.length) return;

  const usage = usageExcept(d, i);
  const families = familyCounts(d, i);
  const base = toOptMeals(day);
  const options = pool.map(r => {
    const exclude = base.filter((_, j) => j !== i && !base[j].external).map(m => m.recipe);
    const meals = base.map((m, j) => (j === i ? { ...m, recipe: r, variants: pickVariants(d, m.slot, r, exclude) } : m));
    const { scales, err } = optimizeHousehold(meals, d);
    return { meals, scales, score: err + varietyPenalty([r], usage) + familyPenalty([r], families) + preferenceScore([r]) + budgetPenalty(dayCost(meals, scales)) };
  }).sort((a, b) => a.score - b.score);

  // On tire au hasard parmi les 3 meilleures options pour varier à chaque clic
  const pick = randomItem(options.slice(0, 3));
  day.meals = pick.meals.map((m, j) => fromOptMeal(m, pick.scales[j]));
  saveState();
  render();
}

// Quand les objectifs ou les participants changent, on garde les recettes et on recalcule les portions
function rebalancePlan() {
  if (!state.plan) return;
  state.plan.forEach((day, d) => {
    const { scales } = optimizeHousehold(toOptMeals(day), d);
    day.meals.forEach((m, i) => { m.scales = scales[i]; });
  });
  checkPlanStructure();
}

// Le plan correspond-il encore aux réponses (collation, sorties, cantine…) ?
function checkPlanStructure() {
  if (!state.plan) return;
  const sig = meals => meals.map(m => `${m.slot}:${m.external || ''}`).join();
  const same = state.plan.every((day, d) => sig(day.meals) === sig(daySkeleton(d)));
  showNotice(same ? '' : 'Vos réponses ont changé : clique sur « Régénérer » pour mettre le menu à jour.');
}

// ============================================================
//  Open Food Facts : vrais produits pour chaque ingrédient
//  API publique et gratuite (https://openfoodfacts.github.io/openfoodfacts-server/api/).
//  Les recherches sont limitées à ~10 par minute : on cherche à la demande et on garde
//  les résultats 7 jours en cache.
// ============================================================
const OFF_CACHE_KEY = 'off-cache-v1';
const OFF_CACHE_DAYS = 7;
const OFF_FIELDS = 'code,product_name,product_name_fr,brands,quantity,nutriscore_grade,nutriments,image_small_url';

let offCache = {};
try { offCache = JSON.parse(localStorage.getItem(OFF_CACHE_KEY)) || {}; } catch { /* ignore */ }
const offOpen = new Set();      // ingrédients dont le panneau « produits » est ouvert
const offLoading = new Set();
const offErrors = {};

const hasMacros = p => MACROS.every(m => typeof p[m] === 'number');
const offLinkable = ing => !ing.fresh;

function offSearchUrl(ing) {
  const params = new URLSearchParams({
    action: 'process', json: '1', page_size: '8', sort_by: 'unique_scans_n', fields: OFF_FIELDS,
    tagtype_0: 'countries', tag_contains_0: 'contains', tag_0: 'en:france',
  });
  if (ing.off) {
    // Recherche par catégorie officielle : bien plus précise qu'une recherche texte
    params.set('tagtype_1', 'categories');
    params.set('tag_contains_1', 'contains');
    params.set('tag_1', ing.off);
  } else {
    params.set('search_terms', ing.search);
    params.set('search_simple', '1');
  }
  return `https://world.openfoodfacts.org/cgi/search.pl?${params}`;
}

function parseProduct(p) {
  const n = p.nutriments || {};
  const num = v => (v === undefined || v === null || v === '' || isNaN(Number(v)) ? null : Number(v));
  return {
    code: p.code,
    name: (p.product_name_fr || p.product_name || '').trim(),
    brand: (p.brands || '').split(',')[0].trim(),
    quantity: p.quantity || '',
    nutriscore: /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : null,
    image: p.image_small_url || '',
    kcal: num(n['energy-kcal_100g']), p: num(n.proteins_100g), c: num(n.carbohydrates_100g), f: num(n.fat_100g),
  };
}

async function loadProducts(id) {
  const cached = offCache[id];
  if (cached && Date.now() - cached.at < OFF_CACHE_DAYS * 864e5) return;
  offLoading.add(id);
  delete offErrors[id];
  renderShopping();
  try {
    const res = await fetch(offSearchUrl(INGREDIENTS[id]));
    if (!res.ok) throw new Error(res.status === 429 || res.status >= 500 ? 'busy' : 'http');
    const json = await res.json().catch(() => { throw new Error('busy'); });
    const products = (json.products || []).map(parseProduct).filter(p => p.name && p.code);
    // Les fiches avec valeurs nutritionnelles complètes d'abord
    products.sort((a, b) => hasMacros(b) - hasMacros(a));
    offCache[id] = { at: Date.now(), products };
    try { localStorage.setItem(OFF_CACHE_KEY, JSON.stringify(offCache)); } catch { /* ignore */ }
  } catch (err) {
    // Quand le serveur est saturé, sa page d'erreur n'autorise pas le CORS : le navigateur
    // ne voit alors qu'une « erreur réseau ». On affiche donc un message qui couvre les deux cas.
    offErrors[id] = 'Open Food Facts ne répond pas : serveur saturé, limite de ~10 recherches par minute ou pas de connexion. Réessaie dans une minute.';
  } finally {
    offLoading.delete(id);
    renderShopping();
  }
}

function toggleProducts(id) {
  if (offOpen.has(id)) offOpen.delete(id);
  else { offOpen.add(id); loadProducts(id); }
  renderShopping();
}

function pickProduct(id, code) {
  const product = (offCache[id]?.products || []).find(p => p.code === code);
  if (!product) return;
  state.products[id] = product;
  offOpen.delete(id);
  afterProductsChange();
}

function clearProduct(id) {
  delete state.products[id];
  afterProductsChange();
}

function afterProductsChange() {
  if (state.useRealNutrition) rebalancePlan();
  saveState();
  render();
}

// ============================================================
//  Liste de courses
// ============================================================
function shoppingList() {
  const totals = {};
  for (const day of state.plan || []) {
    for (const meal of day.meals) {
      for (const person of state.people) {
        const detail = mealDetail(meal, person.id);
        if (detail) for (const it of detail.items) totals[it.id] = (totals[it.id] || 0) + it.g;
      }
    }
  }
  return Object.entries(totals).map(([id, g]) => ({ id, ing: INGREDIENTS[id], g }));
}

function fmtWeight(g) {
  return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 2).replace('.', ',')} kg` : `${Math.round(g)} g`;
}

// Quantité affichée dans une recette : en pièces pour les œufs/tortillas, sinon en grammes
function fmtQty(ing, g) {
  if (!ing.whole) return `${g} g`;
  const n = g / ing.piece;
  return `${n} ${n > 1 ? ing.units : ing.unit}`;
}

function buyQuantity(ing, g) {
  if (ing.piece) {
    const n = Math.max(1, Math.ceil(g / ing.piece - 0.15));
    return `${n} ${n > 1 ? ing.units : ing.unit}`;
  }
  if (ing.pack) {
    const n = Math.ceil(g / ing.pack);
    return `${n} × ${ing.packLabel}`;
  }
  return fmtWeight(g);
}

// Lien de recherche Leclerc Drive.
// Les URL d'un magasin ont la forme https://fdX-courses.leclercdrive.fr/magasin-XXXXXX-Ville/...
// et la recherche se fait via recherche.aspx?TexteRecherche=...
const DRIVE_STORE_RE = /^(https:\/\/[a-z0-9-]+\.leclercdrive\.fr\/magasin-[^/?#]+)/i;

function driveStoreBase() {
  const m = (state.driveUrl || '').trim().match(DRIVE_STORE_RE);
  return m ? m[1] : null;
}

function driveTerm(id) {
  const product = state.products[id];
  return product ? `${product.brand} ${product.name}`.trim() : INGREDIENTS[id].search;
}

function searchUrl(term) {
  const base = driveStoreBase();
  return base
    ? `${base}/recherche.aspx?TexteRecherche=${encodeURIComponent(term)}`
    : 'https://www.leclercdrive.fr/';
}

function groupedList() {
  const list = shoppingList();
  return RAYONS
    .map(rayon => ({
      rayon,
      items: list.filter(x => x.ing.rayon === rayon).sort((a, b) => a.ing.name.localeCompare(b.ing.name, 'fr')),
    }))
    .filter(g => g.items.length);
}

function listAsText() {
  const names = activePeople().map(p => p.name).join(' & ');
  const lines = [`LISTE DE COURSES — Menu de la semaine (${names})`, ''];
  for (const { rayon, items } of groupedList()) {
    lines.push(`== ${rayon.toUpperCase()} ==`);
    for (const { id, ing, g } of items) {
      const box = state.checked[id] ? '[x]' : '[ ]';
      const product = state.products[id];
      const chosen = product ? ` → ${product.brand ? product.brand + ' ' : ''}${product.name}` : '';
      lines.push(`${box} ${ing.name}${chosen} — ${buyQuantity(ing, g)} (besoin : ${fmtWeight(g)})`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// Liste envoyée au favori « Stock Drive » (drive-stock.js)
function cartExport() {
  return {
    v: 1,
    genere_le: new Date().toISOString(),
    articles: shoppingList()
      .filter(({ id }) => !state.checked[id]) // déjà dans le placard ou déjà ajouté
      .map(({ id, ing, g }) => {
        const product = state.products[id];
        return {
          id,
          ingredient: ing.name,
          rayon: ing.rayon,
          recherche: driveTerm(id),
          a_acheter: buyQuantity(ing, g),
          nombre: ing.piece ? Math.max(1, Math.ceil(g / ing.piece - 0.15)) : ing.pack ? Math.ceil(g / ing.pack) : 1,
          besoin_g: Math.round(g),
          piece_g: ing.piece || null,
          produit: product ? { code_barres: product.code, marque: product.brand, nom: product.name } : null,
        };
      }),
  };
}

// ---------- Estimations de coût de la semaine
// Coût des quantités réellement utilisées (+ marge paquets entiers / restes)
function weekCost() {
  return (state.plan || []).reduce((sum, day) => sum + dayCost(toOptMeals(day), day.meals.map(m => m.scales)), 0) * WASTE;
}

// Ce qu'on paiera en caisse : paquets entiers, hors produits du placard et hors lignes cochées
function checkoutCost() {
  return shoppingList().reduce((sum, { id, ing, g }) => {
    if (ing.placard || state.checked[id]) return sum;
    const r = state.stock?.items[id];
    if (r?.statut === 'ok') return sum + r.total;
    const grams = ing.piece ? Math.max(1, Math.ceil(g / ing.piece - 0.15)) * ing.piece
      : ing.pack ? Math.ceil(g / ing.pack) * ing.pack : g;
    return sum + (PRICES[id] * grams) / 1000;
  }, 0);
}

const euros = n => `${Math.round(n)} €`;

// ---------- Stock réel du Drive
function importStock(text) {
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!data || data.type !== 'stock-drive' || !data.resultats) return false;
  state.stock = { magasin: data.magasin, date: data.date, items: data.resultats };
  saveState();
  return true;
}

// Ingrédients de la liste actuelle introuvables ou en rupture au Drive (hors placard)
function outOfStock() {
  if (!state.stock) return [];
  return shoppingList()
    .filter(({ id, ing }) => !ing.placard && ['rupture', 'introuvable'].includes(state.stock.items[id]?.statut))
    .map(({ id }) => id);
}

function renderStockSummary() {
  const el = $('#stock-summary');
  const excluded = state.unavailable.length
    ? `<p class="hint">Écartés du menu car en rupture : <b>${state.unavailable.map(id => esc(INGREDIENTS[id].name)).join(', ')}</b>
        <button type="button" class="link-btn" data-stock="reset">Réintégrer</button></p>`
    : '';
  if (!state.stock) { el.innerHTML = excluded; return; }
  const list = shoppingList();
  let total = 0, ok = 0, missing = 0;
  for (const { id } of list) {
    const r = state.stock.items[id];
    if (!r || state.checked[id]) continue;
    if (r.statut === 'ok') { ok++; total += r.total; } else missing++;
  }
  const ruptures = outOfStock();
  const date = new Date(state.stock.date).toLocaleString('fr-FR', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `
    <div class="stock-summary">
      <div class="stock-total"><span>Total estimé au Drive</span><b>${total.toFixed(2).replace('.', ',')} €</b></div>
      <div class="stock-stats">
        <span>✅ ${ok} en stock</span><span>❌ ${missing} à remplacer</span>
        <span class="muted">Vérifié ${esc(date)}</span>
      </div>
      <div class="stock-actions">
        ${ruptures.length ? `<button type="button" class="primary small" data-stock="adapt">🔁 Adapter le menu au stock (${ruptures.length} produit${ruptures.length > 1 ? 's' : ''} en rupture)</button>` : ''}
        <button type="button" class="ghost" data-stock="clear">Oublier ce stock</button>
      </div>
    </div>${excluded}`;
}

function stockLine(id) {
  const r = state.stock?.items[id];
  if (!r) return '';
  if (r.statut === 'ok') {
    return `<span class="item-stock ok">🏪 <a href="${esc(r.produit.url)}" target="_blank" rel="noopener">${esc(r.produit.nom)}</a>
      · ${r.quantite} × ${r.produit.prix.toFixed(2).replace('.', ',')} € · ${r.produit.stock} en stock</span>`;
  }
  return `<span class="item-stock ko">${r.statut === 'rupture' ? '❌ En rupture au Drive' : '❓ Introuvable au Drive'}</span>`;
}

// ============================================================
//  Affichage
// ============================================================
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const who = p => `<span class="who who-${p.id}">${esc(p.name)}</span>`;

function showNotice(msg) {
  const el = $('#notice');
  el.textContent = msg;
  el.hidden = !msg;
}

function bar(label, value, target, unit) {
  const pct = target > 0 ? (value / target) * 100 : 0;
  const gap = Math.abs(pct - 100);
  const cls = gap <= 7 ? 'ok' : gap <= 15 ? 'warn' : 'bad';
  return `
    <div class="bar ${cls}">
      <div class="bar-head"><span>${label}</span><span>${Math.round(value)} / ${Math.round(target)} ${unit}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(pct, 100)}%"></div></div>
    </div>`;
}

function macroBars(tot, T) {
  return bar('Calories', tot.kcal, T.kcal, 'kcal')
    + bar('Protéines', tot.p, T.p, 'g')
    + bar('Glucides', tot.c, T.c, 'g')
    + bar('Lipides', tot.f, T.f, 'g');
}

function macroLine(t) {
  return `<span>${Math.round(t.kcal)} kcal</span>
    <span class="mp">P ${Math.round(t.p)} g</span>
    <span class="mc">G ${Math.round(t.c)} g</span>
    <span class="mf">L ${Math.round(t.f)} g</span>`;
}

function renderExternalMeal(meal) {
  const ext = EXTERNAL[meal.external];
  const eaters = state.people.map(p => ({ p, detail: mealDetail(meal, p.id) })).filter(x => x.detail);
  return `
    <div class="meal external">
      <div class="meal-top"><span class="meal-slot">${SLOTS[meal.slot].icon} ${SLOTS[meal.slot].label}</span></div>
      <div class="ext-title">${ext.icon} ${ext.label} : pas de cuisine !</div>
      <p class="steps">${esc(ext.tip)}</p>
      ${eaters.map(({ p, detail }) => `<div class="macros">${who(p)} <span>≈ ${Math.round(detail.totals.kcal)} kcal estimées</span></div>`).join('')}
    </div>`;
}

// Tableau des quantités d'une recette pour un groupe de convives (+ total à cuisiner)
function recipeDetails(recipe, eaters) {
  const showTotal = eaters.length > 1;
  const rows = recipe.ingredients.map(([id], k) => {
    const ing = INGREDIENTS[id];
    const cells = eaters.map(({ detail }) => `<td>${fmtQty(ing, detail.items[k].g)}</td>`).join('');
    const total = eaters.reduce((a, { detail }) => a + detail.items[k].g, 0);
    return `<tr><th scope="row">${esc(ing.name)}</th>${cells}${showTotal ? `<td class="total">${fmtQty(ing, total)}</td>` : ''}</tr>`;
  }).join('');
  return `
    <details>
      <summary>${esc(recipe.name)}${recipe.anti ? ' <span title="Anti-inflammatoire">🌿</span>' : ''}</summary>
      <table class="qty-table">
        <thead><tr><th></th>${eaters.map(({ p }) => `<th>${who(p)}</th>`).join('')}${showTotal ? '<th>À cuisiner</th>' : ''}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="steps">${esc(recipe.steps)}</p>
    </details>`;
}

function renderMeal(meal, d, i) {
  if (meal.external) return renderExternalMeal(meal);
  const recipe = RECIPE_BY_ID[meal.recipeId];
  const ctx = dayContext(d);
  const tags = [
    meal.slot === 'dejeuner' && ctx.lunch === 'box' && recipe.flags.has('box') ? '🥡 à emporter' : '',
    meal.slot === 'diner' && ctx.plaisir && recipe.flags.has('plaisir') ? '😋 plaisir' : '',
  ].filter(Boolean).map(t => `<span class="meal-tag">${t}</span>`).join('');
  const eaters = state.people
    .map(p => ({ p, detail: mealDetail(meal, p.id) }))
    .filter(x => x.detail);
  const common = eaters.filter(({ p }) => !meal.variants?.[p.id]);
  const variantBlocks = eaters.filter(({ p }) => meal.variants?.[p.id]).map(x => `
    <div class="variant">
      <span class="variant-label">🔀 Variante pour ${who(x.p)} · ${esc(REGIMES[x.p.regime].label)}</span>
      ${recipeDetails(recipeOf(meal, x.p.id), [x])}
    </div>`).join('');

  return `
    <div class="meal">
      <div class="meal-top">
        <span class="meal-slot">${SLOTS[meal.slot].icon} ${SLOTS[meal.slot].label} · ${recipe.time} min ${tags}</span>
        <button type="button" class="icon-btn" data-swap="${d},${i}" title="Proposer une autre recette">🔄 changer</button>
      </div>
      ${common.length ? recipeDetails(recipe, common) : ''}
      ${variantBlocks}
      ${eaters.map(({ p, detail }) => `<div class="macros">${who(p)} ${macroLine(detail.totals)}</div>`).join('')}
    </div>`;
}

function personBars(day, d) {
  return activePeople().map(p => `
    <div class="person-bars">
      <div class="person-bars-name">${who(p)}</div>
      <div class="bars-grid">${macroBars(dayTotals(day, p.id), dayTargets(p, d))}</div>
    </div>`).join('');
}

// Bandeaux explicatifs en haut d'une journée
function dayBanners(d) {
  const ctx = dayContext(d);
  const b = [];
  if (ctx.lendemain) b.push(['recup', "💧 Lendemain de soirée : plats hydratants et digestes, journée un peu plus légère (-10 % kcal, moins de gras). Pense à boire beaucoup d'eau !"]);
  if (ctx.event === 'soiree') b.push(['party', '🎉 Soirée ce soir : le petit-déjeuner et le déjeuner sont ajustés pour compenser.']);
  if (ctx.event === 'restau') b.push(['party', '🍽️ Resto ce soir : les autres repas sont allégés pour compenser.']);
  if (ctx.plaisir) b.push(['plaisir', '😋 Soirée petit plaisir : un plat gourmand, mais toujours calé sur vos macros.']);
  return b.map(([cls, text]) => `<div class="day-banner ${cls}">${text}</div>`).join('');
}

function renderWeek() {
  const plan = state.plan;
  $('#week').innerHTML = plan.map((day, d) => `
    <article class="card day">
      <div class="day-head">
        <h3><span class="day-emoji" aria-hidden="true">${DAY_EMOJIS[d]}</span>${DAYS[d]}</h3>
        <button type="button" class="icon-btn" data-reday="${d}" title="Régénérer toute la journée">🎲 journée</button>
      </div>
      ${dayBanners(d)}
      ${day.meals.map((m, i) => renderMeal(m, d, i)).join('')}
      <div class="bars">${personBars(day, d)}</div>
    </article>`).join('');

  const cap = budgetCap();
  const cost = weekCost();
  const budgetHtml = `
    <div class="budget-row">
      <span>💶 Coût estimé de la semaine</span>
      ${cap ? `<div class="budget-bar ${cost > cap ? 'over' : ''}"><div style="width:${Math.min(100, (cost / cap) * 100)}%"></div></div>` : '<span></span>'}
      <b>${euros(cost)}${cap ? ` / ${cap} €` : ''}</b>
    </div>
    ${cap && cost > cap ? `<p class="hint warn">Au-dessus de votre budget : régénère la semaine, choisis une tranche plus haute ou le régime végétarien, souvent moins cher.</p>` : ''}`;
  $('#week-summary').innerHTML = `
    <h3>Moyenne par jour sur la semaine</h3>
    ${budgetHtml}
    ${activePeople().map(p => {
      const avg = { kcal: 0, p: 0, c: 0, f: 0 };
      for (const day of plan) {
        const t = dayTotals(day, p.id);
        for (const m of MACROS) avg[m] += t[m] / plan.length;
      }
      return `<div class="summary-row">${who(p)}<div class="summary-bars">${macroBars(avg, p.targets)}</div></div>`;
    }).join('')}`;
}

const nutriBadge = grade => grade
  ? `<span class="nutriscore ns-${grade}" title="Nutri-Score ${grade.toUpperCase()}">${grade.toUpperCase()}</span>`
  : '';

const fmtNum = v => (v === null ? '?' : String(Math.round(v * 10) / 10).replace('.', ','));

function renderProductPanel(id) {
  if (offLoading.has(id)) return `<div class="off-panel"><p class="hint">⏳ Recherche des produits sur Open Food Facts…</p></div>`;
  if (offErrors[id]) {
    return `<div class="off-panel"><p class="hint warn">${esc(offErrors[id])}</p>
      <button type="button" class="chip-btn" data-off-retry="${id}">↻ Réessayer</button></div>`;
  }
  const products = offCache[id]?.products || [];
  if (!products.length) return `<div class="off-panel"><p class="hint">Aucun produit trouvé pour cette catégorie.</p></div>`;
  const chosen = state.products[id]?.code;
  return `<div class="off-panel">
    <p class="hint">Produits les plus scannés en France · valeurs pour 100 g · source <a href="https://fr.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a></p>
    <div class="products">
      ${products.map(p => `
        <div class="product ${p.code === chosen ? 'chosen' : ''}">
          ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : '<div class="img-ph">🛒</div>'}
          <div class="product-info">
            <a class="product-name" href="https://fr.openfoodfacts.org/produit/${esc(p.code)}" target="_blank" rel="noopener">${esc(p.name)}</a>
            <span class="product-brand">${esc([p.brand, p.quantity].filter(Boolean).join(' · '))}</span>
            <span class="product-macros">${nutriBadge(p.nutriscore)} ${fmtNum(p.kcal)} kcal · P ${fmtNum(p.p)} · G ${fmtNum(p.c)} · L ${fmtNum(p.f)}</span>
          </div>
          <button type="button" class="chip-btn ${p.code === chosen ? 'active' : ''}" data-off-pick="${id}|${esc(p.code)}">${p.code === chosen ? '✓ Choisi' : 'Choisir'}</button>
        </div>`).join('')}
    </div>
  </div>`;
}

function renderShopping() {
  if (!state.plan) return;
  const groups = groupedList();
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const remaining = groups.reduce((a, g) => a + g.items.filter(x => !state.checked[x.id]).length, 0);
  $('#count').textContent = `${remaining}/${total}`;
  $('#use-real').checked = state.useRealNutrition;

  renderStockSummary();
  $('#checkout').innerHTML = `💶 Estimation en caisse : <b>${euros(checkoutCost())}</b>
    <small>${state.stock ? 'prix réels du Drive quand ils sont connus' : 'prix indicatifs'} · paquets entiers · hors placard et lignes cochées${budgetCap() ? ` · budget ${budgetCap()} €` : ''}</small>`;
  const warning = driveStoreBase() ? '' : `<p class="hint warn">⚠️ Renseigne votre magasin Leclerc Drive dans « Nos préférences » pour que les liens lancent directement la recherche du produit.</p>`;
  $('#shopping').innerHTML = warning + groups.map(({ rayon, items }) => `
    <div class="rayon">
      <h3>${rayon}${rayon === 'Placard' ? ' <span class="rayon-note">— vérifie que tu en as déjà</span>' : ''}</h3>
      ${items.map(({ id, ing, g }) => {
        const product = state.products[id];
        return `
        <div class="item ${state.checked[id] ? 'done' : ''}">
          <label class="item-main">
            <input type="checkbox" data-check="${id}" ${state.checked[id] ? 'checked' : ''}>
            <span>
              <span class="item-name">${esc(ing.name)}</span><br>
              <span class="item-qty">${esc(buyQuantity(ing, g))} · besoin : ${fmtWeight(g)}</span>
              ${product ? `<span class="item-product">${nutriBadge(product.nutriscore)} ${esc([product.brand, product.name].filter(Boolean).join(' – '))}
                <button type="button" class="link-btn" data-off-clear="${id}" title="Retirer ce produit">✕</button></span>` : ''}
              ${stockLine(id)}
            </span>
          </label>
          <div class="item-actions">
            ${offLinkable(ing)
              ? `<button type="button" class="chip-btn ${offOpen.has(id) ? 'active' : ''}" data-off-toggle="${id}">🔎 Produits réels</button>`
              : '<span class="fresh-tag">🥬 Produit frais</span>'}
            <a class="drive-link" href="${esc(searchUrl(driveTerm(id)))}" target="_blank" rel="noopener">Leclerc Drive ↗</a>
          </div>
          ${offOpen.has(id) ? renderProductPanel(id) : ''}
        </div>`;
      }).join('')}
    </div>`).join('');
}

function render() {
  const has = Boolean(state.plan);
  $('#results').hidden = !has;
  $('#btn-generate').textContent = has ? '🎲 Régénérer toute la semaine' : '✨ Générer notre menu de la semaine';
  if (!has) return;
  renderWeek();
  renderShopping();
}

// ---------- Quiz « Nos envies de la semaine »
let quizStep = 0;
const QUIZ_STEPS = 5; // + écran récapitulatif

const quizOption = (q, v, emoji, title, sub, selected, extra = '') => `
  <button type="button" class="quiz-opt ${selected ? 'selected' : ''}" data-q="${q}" data-v="${v}" ${extra} aria-pressed="${selected}">
    <span class="qo-emoji">${emoji}</span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}
  </button>`;

function quizRecap() {
  const q = state.quiz;
  const moods = q.moods.map(k => MOODS.find(m => m[0] === k)).filter(Boolean).map(m => `${m[1]} ${m[2]}`);
  const events = Object.entries(q.events).sort().map(([d, k]) => `${EXTERNAL[k].icon} ${EXTERNAL[k].label} ${DAYS[d].toLowerCase()} soir`);
  const lunch = LUNCH_OPTIONS.find(o => o[0] === q.lunch);
  const plaisir = PLAISIR_OPTIONS.find(o => o[0] === String(q.plaisirDay ?? ''));
  const dislikes = [...q.dislikes.map(k => `${DISLIKES[k].icon} ${DISLIKES[k].label}`), ...q.custom.map(t => `🚫 ${esc(t)}`)];
  const row = (step, label, value) => `
    <div class="recap-row"><span class="recap-label">${label}</span><span class="recap-value">${value}</span>
      <button type="button" class="link-btn" data-q-nav="goto-${step}">Modifier</button></div>`;
  return `
    <div class="quiz-q">
      <span class="quiz-num">Récapitulatif</span>
      <h3>Votre semaine en un coup d'œil ✨</h3>
      <div class="recap">
        ${row(0, 'Envies', moods.join(', ') || 'Pas de préférence')}
        ${row(1, 'Sorties', events.join(', ') || 'Aucune')}
        ${row(2, 'Le midi en semaine', `${lunch[1]} ${lunch[2]}`)}
        ${row(3, 'Pas envie de', dislikes.join(', ') || 'Rien à éviter')}
        ${row(4, 'Petit plaisir', `${plaisir[1]} ${plaisir[2]}`)}
      </div>
    </div>
    <div class="quiz-nav">
      <button type="button" class="ghost" data-q-nav="prev">← Retour</button>
      <button type="button" class="primary small" data-q-nav="generate">✨ Générer avec ces envies</button>
    </div>`;
}

function renderQuiz() {
  const q = state.quiz;
  const progress = `<div class="quiz-progress">${Array.from({ length: QUIZ_STEPS + 1 }, (_, i) =>
    `<button type="button" class="dot ${i === quizStep ? 'current' : ''} ${i < quizStep ? 'done' : ''}" data-q-nav="goto-${i}" aria-label="Étape ${i + 1}"></button>`).join('')}</div>`;
  let body;
  if (quizStep === 0) {
    body = `<h3>Quelle ambiance vous fait envie cette semaine ?</h3><p class="hint">Plusieurs choix possibles. Ces recettes sortiront plus souvent.</p>
      <div class="quiz-options">${MOODS.map(([k, e, t, sub]) => quizOption('moods', k, e, t, sub, q.moods.includes(k))).join('')}</div>`;
  } else if (quizStep === 1) {
    body = `<h3>Des sorties de prévues ?</h3><p class="hint">Resto ou soirée : pas de dîner à cuisiner, et le reste de la journée est rééquilibré. Le lendemain d'une soirée, on vous prépare des plats « récup ».</p>
      <div class="events">${DAYS.map((day, d) => `
        <div class="event-row"><span class="event-day">${DAY_EMOJIS[d]} ${day} soir</span>
          <div class="seg">${[['', 'Rien'], ['restau', '🍽️ Resto'], ['soiree', '🎉 Soirée']].map(([v, l]) =>
            `<button type="button" class="${(q.events[d] || '') === v ? 'on' : ''}" data-q="event" data-d="${d}" data-v="${v}">${l}</button>`).join('')}</div>
        </div>`).join('')}</div>`;
  } else if (quizStep === 2) {
    body = `<h3>Le midi en semaine, vous mangez…</h3>
      <div class="quiz-options">${LUNCH_OPTIONS.map(([k, e, t, sub]) => quizOption('lunch', k, e, t, sub, q.lunch === k)).join('')}</div>`;
  } else if (quizStep === 3) {
    body = `<h3>Pas envie de… cette semaine ?</h3><p class="hint">Les recettes qui en contiennent seront écartées.</p>
      <div class="quiz-options small">${Object.entries(DISLIKES).map(([k, d]) => quizOption('dislikes', k, d.icon, d.label, '', q.dislikes.includes(k))).join('')}</div>
      <div class="custom-dislike">
        <label class="field-label" for="custom-dislike">✍️ Un autre aliment ?</label>
        <div class="custom-row">
          <input type="text" id="custom-dislike" placeholder="ex. brocoli, thon, pois chiches…" maxlength="30" autocomplete="off">
          <button type="button" class="secondary" data-custom-add>Ajouter</button>
        </div>
        <div class="custom-chips">${q.custom.map((term, i) => {
          const found = ingredientsMatching(term).map(id => INGREDIENTS[id].name);
          return `<span class="custom-chip ${found.length ? '' : 'none'}" title="${esc(found.join(', ') || 'Aucun ingrédient trouvé dans nos recettes')}">
            🚫 ${esc(term)} <small>${found.length ? `(${found.length} ingrédient${found.length > 1 ? 's' : ''})` : '(introuvable)'}</small>
            <button type="button" data-custom-remove="${i}" aria-label="Retirer">✕</button></span>`;
        }).join('')}</div>
      </div>`;
  } else if (quizStep === 4) {
    body = `<h3>Un petit plaisir ce week-end ?</h3><p class="hint">Burger maison, pizza, fajitas… version protéinée et toujours calée sur vos macros.</p>
      <div class="quiz-options">${PLAISIR_OPTIONS.map(([k, e, t, sub]) => quizOption('plaisir', k, e, t, sub, String(q.plaisirDay ?? '') === k)).join('')}</div>`;
  }
  $('#quiz').innerHTML = progress + (quizStep === QUIZ_STEPS ? quizRecap() : `
    <div class="quiz-q"><span class="quiz-num">Question ${quizStep + 1} / ${QUIZ_STEPS}</span>${body}</div>
    <div class="quiz-nav">
      <button type="button" class="ghost" data-q-nav="prev" ${quizStep === 0 ? 'disabled' : ''}>← Retour</button>
      <button type="button" class="secondary" data-q-nav="next">Suivant →</button>
    </div>`);
}

function addCustomDislike() {
  const input = $('#custom-dislike');
  const term = input.value.trim();
  if (!term || state.quiz.custom.some(t => normText(t) === normText(term))) { input.value = ''; return; }
  state.quiz.custom.push(term);
  saveState();
  if (state.plan) showNotice('Vos envies ont changé : clique sur « Régénérer » pour les appliquer au menu.');
  renderQuiz();
  $('#custom-dislike').focus();
}

function onQuizClick(e) {
  if (e.target.closest('[data-custom-add]')) { addCustomDislike(); return; }
  const rm = e.target.closest('[data-custom-remove]');
  if (rm) {
    state.quiz.custom.splice(Number(rm.dataset.customRemove), 1);
    saveState();
    renderQuiz();
    return;
  }
  const opt = e.target.closest('[data-q]');
  const nav = e.target.closest('[data-q-nav]');
  const q = state.quiz;
  if (opt) {
    const { q: key, v, d } = opt.dataset;
    const toggle = arr => (arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
    if (key === 'moods') q.moods = toggle(q.moods);
    else if (key === 'dislikes') q.dislikes = toggle(q.dislikes);
    else if (key === 'lunch') q.lunch = v;
    else if (key === 'plaisir') q.plaisirDay = v === '' ? null : Number(v);
    else if (key === 'event') { if (v) q.events[d] = v; else delete q.events[d]; }
    saveState();
    if (state.plan) showNotice('Vos envies ont changé : clique sur « Régénérer » pour les appliquer au menu.');
    renderQuiz();
  } else if (nav) {
    const a = nav.dataset.qNav;
    if (a === 'next') quizStep = Math.min(QUIZ_STEPS, quizStep + 1);
    else if (a === 'prev') quizStep = Math.max(0, quizStep - 1);
    else if (a.startsWith('goto-')) quizStep = Number(a.slice(5));
    else if (a === 'generate') {
      generateWeek();
      if (state.plan) $('#results').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    renderQuiz();
  }
}

// ---------- Formulaires des personnes
const options = (list, value) => list
  .map(([v, l]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${l}</option>`).join('');

const TARGET_LABELS = [['kcal', 'Calories / jour', 'kcal'], ['p', 'Protéines', 'g'], ['c', 'Glucides', 'g'], ['f', 'Lipides', 'g']];

const labelOf = (list, v) => (list.find(o => String(o[0]) === String(v)) || ['', ''])[1];

// Profil enregistré : simple résumé. Sinon : formulaire complet.
function personSummary(p) {
  const T = p.targets;
  return `
    <div class="person person-${p.id} saved" data-person="${p.id}">
      <div class="person-head">
        <span class="person-title">${esc(p.name)}</span>
        <button type="button" class="chip-btn" data-edit>✏️ Modifier</button>
      </div>
      <div class="person-tags">
        <span>🎯 ${esc(labelOf(PROFILE_OPTIONS.objectif, p.profile.objectif).split(' (')[0])}</span>
        <span>🍽️ ${esc(REGIMES[p.regime].label)}</span>
        <span>⚖️ ${p.profile.poids} kg</span>
        <span>${p.collation ? '🍎 Avec collation' : '🚫 Sans collation'}</span>
      </div>
      <div class="person-macros"><b>${T.kcal}</b> kcal · <span class="mp">P ${T.p} g</span> · <span class="mc">G ${T.c} g</span> · <span class="mf">L ${T.f} g</span></div>
    </div>`;
}

function personForm(p) {
  return `
    <div class="person person-${p.id}" data-person="${p.id}">
      <div class="person-head">
        <input class="person-name" data-field="name" value="${esc(p.name)}" maxlength="20" aria-label="Prénom">
        <label class="check"><input type="checkbox" data-field="collation" ${p.collation ? 'checked' : ''}> Prend une collation</label>
      </div>

      <label class="field-label">Régime
        <select data-field="regime">${options(Object.entries(REGIMES).map(([k, r]) => [k, r.label]), p.regime)}</select>
      </label>
      <p class="hint regime-desc">${esc(REGIMES[p.regime].desc)}</p>

      <div class="grid-form">
        <label>Sexe <select data-profile="sexe">${options(PROFILE_OPTIONS.sexe, p.profile.sexe)}</select></label>
        <label>Âge <input type="number" data-profile="age" min="14" max="99" value="${p.profile.age}"></label>
        <label>Poids (kg) <input type="number" data-profile="poids" min="30" max="250" value="${p.profile.poids}"></label>
        <label>Taille (cm) <input type="number" data-profile="taille" min="120" max="230" value="${p.profile.taille}"></label>
        <label class="span2">Activité <select data-profile="activite">${options(PROFILE_OPTIONS.activite, p.profile.activite)}</select></label>
        <label class="span2">Objectif <select data-profile="objectif">${options(PROFILE_OPTIONS.objectif, p.profile.objectif)}</select></label>
      </div>

      <div class="targets">
        ${TARGET_LABELS.map(([k, label, unit]) => `
          <label><span>${label} <span class="unit">${unit}</span></span>
            <input type="number" data-target="${k}" min="0" max="6000" value="${p.targets[k]}"></label>`).join('')}
      </div>
      <p class="hint macro-check"></p>
      <button type="button" class="primary small" data-save>✓ Enregistrer ${esc(p.name)}</button>
    </div>`;
}

function renderPeopleForms() {
  $('#people').innerHTML = state.people.map(p => (p.saved ? personSummary(p) : personForm(p))).join('');
  state.people.filter(p => !p.saved).forEach(updateMacroCheck);
  $('#people-hint').hidden = state.people.every(p => p.saved);
}

function updateMacroCheck(p) {
  const el = document.querySelector(`[data-person="${p.id}"] .macro-check`);
  if (!el) return;
  const T = p.targets;
  const fromMacros = 4 * (+T.p || 0) + 4 * (+T.c || 0) + 9 * (+T.f || 0);
  const diff = fromMacros - (+T.kcal || 0);
  el.classList.toggle('warn', Math.abs(diff) > 100);
  el.textContent = `Les macros représentent ${fromMacros} kcal`
    + (Math.abs(diff) > 100 ? ` : ${diff > 0 ? '+' : ''}${diff} kcal par rapport à l'objectif, pense à ajuster.` : ' : cohérent ✓');
}

function fillForms() {
  renderPeopleForms();
  $('#temps').innerHTML = options(TIME_OPTIONS, state.prefs.temps);
  if (!BUDGET_OPTIONS.some(([k]) => k === state.prefs.budget)) state.prefs.budget = 'libre'; // anciennes valeurs
  $('#budget').innerHTML = options(BUDGET_OPTIONS, state.prefs.budget);
  renderQuiz();
  $('#drive-url').value = state.driveUrl;
  $('#drive-status').textContent = driveStoreBase() ? '✅ Magasin reconnu' : '';
  $('#drive-open').href = driveStoreBase() ? `${driveStoreBase()}/recherche.aspx?TexteRecherche=` : 'https://www.leclercdrive.fr/';
}

// ============================================================
//  Événements
// ============================================================
function prefsChanged() {
  saveState();
  if (state.plan) showNotice('Préférences modifiées : clique sur « Régénérer » pour les appliquer au menu.');
}

function bindEvents() {
  // Formulaires des personnes (délégation)
  $('#people').addEventListener('change', e => {
    const card = e.target.closest('[data-person]');
    if (!card) return;
    const p = personById(card.dataset.person);
    const { field, profile, target } = e.target.dataset;

    if (field === 'name') {
      p.name = e.target.value.trim() || (p.id === 'lola' ? 'Lola' : 'Barnabé');
      card.querySelector('[data-save]').textContent = `✓ Enregistrer ${p.name}`;
    } else if (field === 'collation') {
      p.collation = e.target.checked;
      rebalancePlan();
    } else if (field === 'regime') {
      p.regime = e.target.value;
      card.querySelector('.regime-desc').textContent = REGIMES[p.regime].desc;
      if (state.plan) showNotice(`Régime de ${p.name} modifié : clique sur « Régénérer » pour l'appliquer au menu.`);
    } else if (profile) {
      // Changer une mensuration ou l'objectif recalcule les cibles (ajustables ensuite à la main)
      p.profile[profile] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      p.targets = computeNeeds(p.profile);
      for (const [k] of TARGET_LABELS) card.querySelector(`[data-target="${k}"]`).value = p.targets[k];
      updateMacroCheck(p);
      rebalancePlan();
    } else if (target) {
      p.targets[target] = Number(e.target.value) || 0;
      updateMacroCheck(p);
      rebalancePlan();
    }
    saveState();
    render();
  });

  // Enregistrer (→ résumé) ou Modifier (→ formulaire)
  $('#people').addEventListener('click', e => {
    const btn = e.target.closest('[data-save],[data-edit]');
    if (!btn) return;
    const p = personById(btn.closest('[data-person]').dataset.person);
    p.saved = btn.hasAttribute('data-save');
    saveState();
    renderPeopleForms();
  });

  for (const k of ['temps', 'budget']) {
    $('#' + k).addEventListener('change', e => {
      state.prefs[k] = e.target.value;
      prefsChanged();
    });
  }

  $('#quiz').addEventListener('click', onQuizClick);
  $('#quiz').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'custom-dislike') { e.preventDefault(); addCustomDislike(); }
  });

  $('#drive-url').addEventListener('change', e => {
    state.driveUrl = e.target.value.trim();
    saveState();
    $('#drive-status').textContent = !state.driveUrl ? '' : driveStoreBase() ? '✅ Magasin reconnu' : '❌ Adresse non reconnue (elle doit contenir leclercdrive.fr/magasin-…)';
    if (state.plan) renderShopping();
  });

  $('#btn-generate').addEventListener('click', generateWeek);

  // Délégation : boutons « changer » et « journée »
  $('#week').addEventListener('click', e => {
    const swap = e.target.closest('[data-swap]');
    if (swap) {
      const [d, i] = swap.dataset.swap.split(',').map(Number);
      swapMeal(d, i);
      return;
    }
    const reday = e.target.closest('[data-reday]');
    if (reday) regenerateDay(Number(reday.dataset.reday));
  });

  $('#shopping').addEventListener('click', e => {
    const t = e.target.closest('[data-off-toggle],[data-off-pick],[data-off-clear],[data-off-retry]');
    if (!t) return;
    e.preventDefault();
    const d = t.dataset;
    if (d.offToggle) toggleProducts(d.offToggle);
    else if (d.offPick) { const [id, code] = d.offPick.split('|'); pickProduct(id, code); }
    else if (d.offClear) clearProduct(d.offClear);
    else if (d.offRetry) loadProducts(d.offRetry);
  });

  $('#use-real').addEventListener('change', e => {
    state.useRealNutrition = e.target.checked;
    afterProductsChange();
  });

  $('#shopping').addEventListener('change', e => {
    const id = e.target.dataset.check;
    if (!id) return;
    if (e.target.checked) state.checked[id] = true; else delete state.checked[id];
    saveState();
    renderShopping();
  });

  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $('#tab-menu').hidden = tab.dataset.tab !== 'menu';
    $('#tab-courses').hidden = tab.dataset.tab !== 'courses';
  }));

  $('#btn-copy').addEventListener('click', async e => {
    try {
      await navigator.clipboard.writeText(listAsText());
      e.target.textContent = '✅ Copiée !';
    } catch {
      e.target.textContent = '❌ Copie impossible';
    }
    setTimeout(() => { e.target.textContent = '📋 Copier'; }, 1800);
  });

  $('#btn-download').addEventListener('click', () => {
    const blob = new Blob([listAsText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'liste-de-courses.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- Stock réel du Drive
  // Le favori est construit à partir du code de drive-stock.js
  const bm = $('#bm-link');
  bm.href = 'javascript:' + encodeURIComponent(`(${leclercStockCheck.toString()})()`);
  bm.addEventListener('click', e => {
    e.preventDefault();
    bm.textContent = '👆 Glisse-moi dans la barre de favoris';
    setTimeout(() => { bm.textContent = '🥑 Stock Drive'; }, 2500);
  });

  $('#btn-copy-drive').addEventListener('click', async e => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(cartExport()));
      e.target.textContent = `✅ ${cartExport().articles.length} produits copiés`;
    } catch {
      e.target.textContent = '❌ Copie impossible';
    }
    setTimeout(() => { e.target.textContent = '📋 Copier la liste pour le Drive'; }, 2500);
  });

  $('#btn-import-stock').addEventListener('click', () => {
    const ok = importStock($('#stock-in').value.trim());
    $('#stock-in').value = '';
    if (!ok) { alert("Ce texte n'est pas un résultat du favori « Stock Drive ». Recopie-le depuis la fenêtre du Drive."); return; }
    $('#stock-card').open = false;
    renderShopping();
  });

  $('#stock-summary').addEventListener('click', e => {
    const action = e.target.closest('[data-stock]')?.dataset.stock;
    if (action === 'adapt') {
      state.unavailable = [...new Set([...state.unavailable, ...outOfStock()])];
      generateWeek();
    } else if (action === 'reset') {
      state.unavailable = [];
      saveState();
      showNotice('Ingrédients réintégrés : clique sur « Régénérer » pour les utiliser à nouveau.');
      renderShopping();
    } else if (action === 'clear') {
      state.stock = null;
      saveState();
      renderShopping();
    }
  });

  $('#btn-print').addEventListener('click', () => window.print());
  // À l'impression, on déplie toutes les recettes
  window.addEventListener('beforeprint', () => document.querySelectorAll('.meal details').forEach(d => { d.open = true; }));

  $('#btn-uncheck').addEventListener('click', () => {
    state.checked = {};
    saveState();
    renderShopping();
  });
}

// ============================================================
//  Appli installable (PWA) : hors connexion + mises à jour
// ============================================================
let updateRequested = false;

function registerServiceWorker() {
  // Le service worker ne fonctionne qu'en https (ou sur localhost), pas en ouvrant le fichier directement
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register('service-worker.js').then(reg => {
    const offerUpdate = worker => {
      $('#update-banner').hidden = false;
      $('#btn-update').onclick = () => {
        updateRequested = true;
        worker.postMessage('skipWaiting');
      };
    };
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => {
        // Une nouvelle version est prête et une ancienne tourne encore : on propose la mise à jour
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });
  }).catch(() => { /* pas de mode hors connexion, l'appli fonctionne quand même */ });

  // On ne recharge que si l'utilisateur a demandé la mise à jour
  // (pas lors de la toute première installation)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested) return;
    updateRequested = false;
    location.reload();
  });
}

fillForms();
bindEvents();
render();
registerServiceWorker();
