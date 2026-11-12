// =============================================================
//  Assiettes dessinées : un visuel pour chaque recette, vu du dessus,
//  composé automatiquement à partir de ses vrais ingrédients.
//  Chaque ingrédient a une forme (filet, grains, feuilles, rondelles…)
//  et deux couleurs douces ; la disposition est tirée au hasard mais
//  toujours la même pour une recette donnée (graine = identifiant).
// =============================================================
(function () {
  'use strict';

  // forme, couleur principale, couleur secondaire
  const LOOK = {
    lieu: ['fillet', '#f3ede2', '#e0d3bd'], cabillaud: ['fillet', '#f6f0e6', '#e2d5c0'],
    saumon: ['fillet', '#e99a80', '#f7c6b2'], saumonfume: ['ribbon', '#eda088', '#f8cbb8'],
    maquereau: ['fillet', '#bcaea3', '#8d7f75'], sardines: ['fillet', '#b4aeaa', '#837c77'],
    thon: ['mince', '#dcbca4', '#c7a189'], crevettes: ['shrimp', '#f0a68c', '#f8cdbb'],
    poulet: ['pieces', '#ebd8b8', '#d5b991'], dinde: ['pieces', '#efdec1', '#dac19b'],
    boeufemince: ['strips', '#9b6552', '#7b4d3d'], boeuf: ['mince', '#93604d', '#ad735e'],
    porc: ['slice', '#ecd0b8', '#c9a184'], jambon: ['ribbon', '#f2c0b6', '#e4a49a'],
    yaourtgrec: ['dollop', '#f8f2e8', '#e4d9c6'], ricotta: ['dollop', '#fbf6ec', '#e8ddca'],
    skyr: ['dollop', '#f7f2ea', '#e2d8c8'], fromblanc: ['dollop', '#f8f3eb', '#e4dacb'],
    cottage: ['mince', '#fbf8f1', '#e9e1d1'], houmous: ['dollop', '#e9d1a1', '#c9aa72'],
    pesto: ['dollop', '#8ea462', '#6f8a4a'], mozza: ['round', '#fbf9f4', '#e6dfd2'],
    feta: ['cube', '#f9f6ef', '#e3dacb'], parmesan: ['sprinkle', '#f1e1b0'], tofu: ['cube', '#f1e6cf', '#d9c6a2'],
    oeufs: ['egg', '#fbf8f1', '#efbf4c'], blancoeuf: ['mince', '#fbf6e7', '#eee2c3'], lait: ['base', '#fbf8f2', '#efe8dc'],
    poireau: ['slice', '#e2eac8', '#a9bf86'], butternut: ['cube', '#eba65c', '#d48a44'],
    choufleur: ['floret', '#f3eedf', '#d9cfb6'], aubergine: ['slice', '#e5d8b6', '#6c5678'],
    radis: ['slice', '#fbf5f2', '#d9667a'], betterave: ['cube', '#a44c60', '#8a3a4e'],
    kiwi: ['slice', '#a9c56b', '#6b5a43'], orange: ['slice', '#f1a84d', '#f8cd8a'],
    poire: ['halfmoon', '#ebe5b0', '#c4bb73'], fraises: ['berries', '#da615f', '#b74545'],
    carotte: ['stick', '#ec9b54', '#d9823c'], mangue: ['cube', '#f2b94d', '#e09f31'],
    brocoli: ['floret', '#71915e', '#567548'], epinards: ['leaf', '#6e905f', '#4f7044'],
    courgette: ['slice', '#e7edca', '#6f8f4f'], poivron: ['strips', '#da634f', '#b94a3a'],
    tomate: ['round', '#da6a52', '#c2503b'], concombre: ['slice', '#e5efd0', '#7fa060'],
    oignon: ['ring', '#dccbe0'], champi: ['halfmoon', '#ebe0cd', '#b9a184'],
    salade: ['leaf', '#a8c381', '#86a35f'], patatedouce: ['cube', '#ea945c', '#cf7843'],
    pdt: ['cube', '#edd9a5', '#d6bd7f'], avocat: ['halfmoon', '#c5d38d', '#7f9a52'],
    banane: ['slice', '#f6ecc2', '#e6d390'], pomme: ['halfmoon', '#f4ecca', '#c95b4f'],
    citron: ['wedge', '#f3e08a', '#e3c552'],
    lentillesvertes: ['grain', '#8e8b60', '#6f6c47'], boulgour: ['grain', '#dbc18c', '#c4a56c'],
    rizcomplet: ['grain', '#e4d4b2', '#cdb98f'], riz: ['grain', '#fbf8ef', '#e8dfcb'],
    quinoa: ['grain', '#efe2c0', '#d6c49a'], semoule: ['grain', '#f2e3b7', '#dcc792'],
    lentilles: ['grain', '#e8a26c', '#cf8850'], gnocchi: ['pieces', '#edd8a4', '#d8bd84'],
    soba: ['noodle', '#8f7c68', '#6f5f4e'], vermicelles: ['noodle', '#f8f4ea', '#e3d8c6'],
    pates: ['pieces', '#dcb984', '#c49b60'], chocolat: ['cube', '#5c3c30', '#3f271e'],
    cacao: ['sprinkle', '#6b4a3a'], dattes: ['pieces', '#7c4c34', '#5e3626'],
    laitcoco: ['pool', '#f5ead0'], tomconc: ['pool', '#cf6249'], avoine: ['base', '#eadcc2', '#d3c09c'],
    poischiches: ['round', '#e2c28b', '#c9a56b'], harirouges: ['round', '#8f3d3d', '#702b2b'],
    mais: ['round', '#f4cf5a', '#e2b83a'], edamame: ['round', '#9dc06b', '#7fa252'],
    petitspois: ['round', '#91b460', '#76994a'],
    galettes: ['bread', '#ebd9b2', '#d4bc8c'], pita: ['bread', '#e6c491', '#c99a5f'],
    painburger: ['bread', '#dba66c', '#b98244'], pain: ['toast', '#e3c190', '#b98a55'],
    tortilla: ['bread', '#f0ddb6', '#d6b985'],
    amandes: ['sprinkle', '#c99c6f'], noix: ['sprinkle', '#b68a5f'], chia: ['sprinkle', '#4b4743'],
    cacahuete: ['drizzle', '#c8925a'], miel: ['drizzle', '#e2b54a'],
    fruitsrouges: ['berries', '#9f4157', '#5c3f6d'], haricotsv: ['stick', '#80a15b', '#66874a'],
    legwok: ['strips', '#8fb35e', '#da634f'],
  };
  // Petits ingrédients qu'on ne dessine pas (huile, sauces, épices, poudre)
  const SKIP = new Set(['huile', 'soja', 'miso', 'curcuma', 'whey']);

  // ---------- Hasard reproductible
  function rngFor(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
  const f = n => Math.round(n * 10) / 10;

  // ---------- Formes (centre cx, cy ; taille s ; R = hasard)
  // Position aléatoire dans un disque de rayon r
  function spot(R, cx, cy, r) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d]; }

  const SHAPES = {
    fillet(cx, cy, s, R, c, c2) {
      const a = f(R() * 180), rx = s * 0.95, ry = s * 0.58;
      let out = `<g transform="rotate(${a} ${f(cx)} ${f(cy)})"><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${c}"/>`;
      for (let k = -1; k <= 1; k++) {
        const x = cx + k * rx * 0.42;
        out += `<path d="M${f(x - ry * 0.25)} ${f(cy - ry * 0.7)} q${f(ry * 0.35)} ${f(ry * 0.7)} 0 ${f(ry * 1.4)}" stroke="${c2}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
      }
      return out + '</g>';
    },
    ribbon(cx, cy, s, R, c, c2) {
      let out = '';
      for (let k = 0; k < 3; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.45), a = f(R() * 180);
        out += `<g transform="rotate(${a} ${f(x)} ${f(y)})"><path d="M${f(x - s * 0.6)} ${f(y)} q${f(s * 0.3)} ${f(-s * 0.45)} ${f(s * 0.6)} 0 t${f(s * 0.6)} 0" stroke="${c}" stroke-width="${f(s * 0.42)}" fill="none" stroke-linecap="round"/>`
          + `<path d="M${f(x - s * 0.5)} ${f(y)} q${f(s * 0.25)} ${f(-s * 0.35)} ${f(s * 0.5)} 0" stroke="${c2}" stroke-width=".7" fill="none" stroke-linecap="round"/></g>`;
      }
      return out;
    },
    shrimp(cx, cy, s, R, c, c2) {
      let out = '';
      for (let k = 0; k < 5; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.6), a = f(R() * 360), r = s * 0.28;
        out += `<g transform="rotate(${a} ${f(x)} ${f(y)})"><path d="M${f(x - r)} ${f(y)} a${f(r)} ${f(r)} 0 1 1 ${f(r * 1.4)} ${f(r * 0.9)}" stroke="${c}" stroke-width="${f(s * 0.24)}" fill="none" stroke-linecap="round"/>`
          + `<path d="M${f(x - r)} ${f(y)} a${f(r)} ${f(r)} 0 1 1 ${f(r * 1.4)} ${f(r * 0.9)}" stroke="${c2}" stroke-width=".6" stroke-dasharray="1.4 1.6" fill="none"/></g>`;
      }
      return out;
    },
    pieces(cx, cy, s, R, c, c2) {
      let out = '';
      const n = 5 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.62), w = s * (0.36 + R() * 0.14), h = s * (0.26 + R() * 0.1);
        out += `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h * 0.45)}" fill="${c}" stroke="${c2}" stroke-width=".6" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>`;
      }
      return out;
    },
    strips(cx, cy, s, R, c, c2) {
      let out = '';
      for (let k = 0; k < 7; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.6), w = s * 0.75, h = s * 0.16, col = k % 3 === 2 ? c2 : c;
        out += `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${col}" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>`;
      }
      return out;
    },
    mince(cx, cy, s, R, c, c2) {
      let out = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.72)}" fill="${c}" opacity=".9"/>`;
      for (let k = 0; k < 16; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.72);
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * (0.08 + R() * 0.1))}" fill="${k % 2 ? c2 : c}"/>`;
      }
      return out;
    },
    grain(cx, cy, s, R, c, c2) {
      let out = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.86)}" fill="${c2}" opacity=".55"/>`;
      for (let k = 0; k < Math.round(s * 2.6); k++) {
        const [x, y] = spot(R, cx, cy, s * 0.82);
        out += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="1.25" ry=".75" fill="${c}" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>`;
      }
      return out;
    },
    noodle(cx, cy, s, R, c, c2) {
      let out = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(s * 0.8)}" fill="${c2}" opacity=".5"/>`;
      for (let k = 0; k < 8; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.45), a = f(R() * 180), l = s * 0.5;
        out += `<path d="M${f(x - l)} ${f(y)} q${f(l / 2)} ${f(-l * 0.4)} ${f(l)} 0 t${f(l)} 0" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round" transform="rotate(${a} ${f(x)} ${f(y)})"/>`;
      }
      return out;
    },
    leaf(cx, cy, s, R, c, c2) {
      let out = '';
      for (let k = 0; k < 5; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.5), a = f(R() * 360), L = s * (0.42 + R() * 0.15);
        out += `<g transform="translate(${f(x)} ${f(y)}) rotate(${a})"><path d="M0 ${f(-L)} C${f(L * 0.7)} ${f(-L * 0.5)} ${f(L * 0.6)} ${f(L * 0.6)} 0 ${f(L)} C${f(-L * 0.6)} ${f(L * 0.6)} ${f(-L * 0.7)} ${f(-L * 0.5)} 0 ${f(-L)}Z" fill="${c}"/>`
          + `<path d="M0 ${f(-L * 0.8)} V${f(L * 0.85)}" stroke="${c2}" stroke-width=".55"/></g>`;
      }
      return out;
    },
    floret(cx, cy, s, R, c, c2) {
      let out = '';
      for (let k = 0; k < 4; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.5), r = s * 0.15;
        out += `<rect x="${f(x - r * 0.5)}" y="${f(y)}" width="${f(r)}" height="${f(r * 2.2)}" rx="${f(r * 0.4)}" fill="${c2}"/>`;
        for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI * 2; out += `<circle cx="${f(x + Math.cos(a) * r)}" cy="${f(y + Math.sin(a) * r)}" r="${f(r * 0.85)}" fill="${c}"/>`; }
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.8)}" fill="${c}"/>`;
      }
      return out;
    },
    round(cx, cy, s, R, c, c2) {
      let out = '';
      const n = 6, r = s * 0.24;
      for (let k = 0; k < n; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.6);
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}" stroke="${c2}" stroke-width=".5"/><circle cx="${f(x - r * 0.35)}" cy="${f(y - r * 0.35)}" r="${f(r * 0.28)}" fill="#fff" opacity=".35"/>`;
      }
      return out;
    },
    egg(cx, cy, s, R, c, c2) {
      const r = s * 0.78;
      return `<path d="M${f(cx - r)} ${f(cy)} C${f(cx - r)} ${f(cy - r * 1.05)} ${f(cx + r * 0.9)} ${f(cy - r * 1.1)} ${f(cx + r)} ${f(cy - r * 0.1)} C${f(cx + r * 1.05)} ${f(cy + r * 0.95)} ${f(cx - r * 0.95)} ${f(cy + r * 1.05)} ${f(cx - r)} ${f(cy)}Z" fill="${c}" stroke="#e8dcc8" stroke-width=".6"/>`
        + `<circle cx="${f(cx + r * 0.08)}" cy="${f(cy)}" r="${f(r * 0.4)}" fill="${c2}"/><circle cx="${f(cx - r * 0.06)}" cy="${f(cy - r * 0.13)}" r="${f(r * 0.12)}" fill="#fff" opacity=".45"/>`;
    },
    slice(cx, cy, s, R, c, c2) {
      let out = '';
      const r = s * 0.32;
      for (let k = 0; k < 5; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.55);
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c2}"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.8)}" fill="${c}"/>`
          + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.32)}" fill="${c2}" opacity=".35"/>`;
      }
      return out;
    },
    halfmoon(cx, cy, s, R, c, c2) {
      // Tranches en éventail (avocat, pomme, poire, champignon)
      let out = '';
      const base = f(R() * 360), l = s * 0.62;
      for (let k = 0; k < 4; k++) {
        out += `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${f(base + (k - 1.5) * 9)}) translate(0 ${f((k - 1.5) * s * 0.26)})">`
          + `<path d="M${f(-l)} 0 Q0 ${f(l * 0.95)} ${f(l)} 0 Q0 ${f(l * 0.3)} ${f(-l)} 0Z" fill="${c}" stroke="${c2}" stroke-width="1.1" stroke-linejoin="round"/></g>`;
      }
      return out;
    },
    cube(cx, cy, s, R, c, c2) {
      let out = '';
      for (let k = 0; k < 8; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.62), w = s * 0.3;
        out += `<rect x="${f(x - w / 2)}" y="${f(y - w / 2)}" width="${f(w)}" height="${f(w)}" rx="1" fill="${c}" stroke="${c2}" stroke-width=".6" transform="rotate(${f(R() * 90)} ${f(x)} ${f(y)})"/>`;
      }
      return out;
    },
    stick(cx, cy, s, R, c, c2) {
      let out = '';
      const a0 = R() * 180;
      for (let k = 0; k < 7; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.45), w = s * 1.1, h = s * 0.13;
        out += `<rect x="${f(x - w / 2)}" y="${f(y - h / 2)}" width="${f(w)}" height="${f(h)}" rx="${f(h / 2)}" fill="${k % 3 ? c : c2}" transform="rotate(${f(a0 + (R() - 0.5) * 30)} ${f(x)} ${f(y)})"/>`;
      }
      return out;
    },
    dollop(cx, cy, s, R, c, c2) {
      const r = s * 0.78;
      let d = '';
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * Math.PI * 2, rr = r * (0.9 + R() * 0.15);
        d += `${k ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
      }
      return `<path d="${d}Z" fill="${c}" stroke="${c2}" stroke-width="1.6" stroke-linejoin="round"/>`
        + `<path d="M${f(cx - r * 0.45)} ${f(cy)} a${f(r * 0.45)} ${f(r * 0.4)} 0 1 1 ${f(r * 0.6)} ${f(r * 0.25)}" stroke="${c2}" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
    },
    berries(cx, cy, s, R, c, c2) {
      let out = '';
      for (let k = 0; k < 8; k++) {
        const [x, y] = spot(R, cx, cy, s * 0.62), r = s * (0.16 + R() * 0.06);
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${k % 3 === 2 ? c2 : c}"/><circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.3)}" r="${f(r * 0.25)}" fill="#fff" opacity=".35"/>`;
      }
      return out;
    },
    bread(cx, cy, s, R, c, c2) {
      const r = s * 0.85;
      let out = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${c}" stroke="${c2}" stroke-width="1.6"/>`;
      for (let k = 0; k < 6; k++) { const [x, y] = spot(R, cx, cy, r * 0.7); out += `<circle cx="${f(x)}" cy="${f(y)}" r=".9" fill="${c2}" opacity=".6"/>`; }
      return out;
    },
    toast(cx, cy, s, R, c, c2) {
      const w = s * 1.25, a = f((R() - 0.5) * 40);
      return `<g transform="rotate(${a} ${f(cx)} ${f(cy)})"><path d="M${f(cx - w / 2)} ${f(cy + w / 2)} V${f(cy - w * 0.2)} a${f(w * 0.22)} ${f(w * 0.22)} 0 0 1 ${f(w * 0.3)} ${f(-w * 0.3)} h${f(w * 0.4)} a${f(w * 0.22)} ${f(w * 0.22)} 0 0 1 ${f(w * 0.3)} ${f(w * 0.3)} V${f(cy + w / 2)}Z" fill="${c}" stroke="${c2}" stroke-width="1.8" stroke-linejoin="round"/></g>`;
    },
    ring(cx, cy, s, R, c) {
      let out = '';
      for (let k = 0; k < 4; k++) { const [x, y] = spot(R, cx, cy, s * 0.6); out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s * 0.25)}" fill="none" stroke="${c}" stroke-width="1.1"/>`; }
      return out;
    },
    wedge(cx, cy, s, R, c, c2) {
      const r = s * 0.42, a = f(R() * 360);
      return `<g transform="rotate(${a} ${f(cx)} ${f(cy)})"><path d="M${f(cx - r)} ${f(cy)} A${f(r)} ${f(r)} 0 0 0 ${f(cx + r)} ${f(cy)}Z" fill="${c}" stroke="${c2}" stroke-width="1"/>`
        + `<path d="M${f(cx)} ${f(cy)} L${f(cx)} ${f(cy + r * 0.85)} M${f(cx)} ${f(cy)} L${f(cx - r * 0.6)} ${f(cy + r * 0.6)} M${f(cx)} ${f(cy)} L${f(cx + r * 0.6)} ${f(cy + r * 0.6)}" stroke="${c2}" stroke-width=".5"/></g>`;
    },
  };

  // ---------- Assiette complète
  const cache = new Map();
  function plateSVG(recipe) {
    if (cache.has(recipe.id)) return cache.get(recipe.id);
    const R = rngFor(recipe.id);
    const items = recipe.ingredients
      .filter(([id]) => !SKIP.has(id) && LOOK[id])
      .map(([id, g]) => ({ id, g, look: LOOK[id] }));
    const bases = items.filter(x => x.look[0] === 'base' || (x.look[0] === 'dollop' && recipe.type !== 'plat'));
    const bowl = recipe.type !== 'plat' && bases.length > 0;
    // le lait seul fait un bol trop pâle : les flocons, le skyr ou le yaourt passent devant
    const prio = x => x.g * (x.id === 'lait' ? 0.2 : x.id === 'avoine' ? 3 : 1);
    const base = bowl ? bases.sort((a, b) => prio(b) - prio(a))[0] : null;
    const pools = items.filter(x => x.look[0] === 'pool' && x !== base);
    const sprinkles = items.filter(x => x.look[0] === 'sprinkle');
    const drizzles = items.filter(x => x.look[0] === 'drizzle');
    const solids = items
      .filter(x => x !== base && !['base', 'pool', 'sprinkle', 'drizzle'].includes(x.look[0]))
      .sort((a, b) => b.g - a.g).slice(0, 5);

    const inner = bowl ? 37 : 33;
    let food = '';
    // Fond de bol (porridge, skyr…) ou sauce étalée (curry, tomate)
    if (base) {
      const [, c, c2] = base.look;
      food += `<circle cx="50" cy="50" r="${inner}" fill="${c}" stroke="${c2 || c}" stroke-width="1.4"/>`;
      for (let k = 0; k < 10; k++) { const [x, y] = spot(R, 50, 50, inner * 0.85); food += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(0.8 + R())}" fill="${c2 || c}" opacity=".45"/>`; }
    }
    for (const p of pools) food += `<circle cx="${f(50 + (R() - 0.5) * 6)}" cy="${f(50 + (R() - 0.5) * 6)}" r="${f(inner * 0.8)}" fill="${p.look[1]}" opacity=".9"/>`;

    // Ingrédients principaux répartis en parts autour du centre, selon leur quantité
    const w = solids.map(x => Math.sqrt(x.g));
    const W = w.reduce((a, b) => a + b, 0) || 1;
    let angle = R() * Math.PI * 2;
    solids.forEach((x, i) => {
      const share = w[i] / W;
      const span = share * Math.PI * 2;
      const s = Math.max(10, Math.min(solids.length === 1 ? 26 : 21, Math.sqrt(share) * 44));
      const mid = angle + span / 2;
      const rho = solids.length === 1 ? 0 : Math.max(6, Math.min(inner - s * 0.85, 17));
      const cx = 50 + Math.cos(mid) * rho, cy = 50 + Math.sin(mid) * rho;
      const [shape, c, c2] = x.look;
      food += SHAPES[shape](cx, cy, s, R, c, c2 || c);
      angle += span;
    });

    // Filets (miel, beurre de cacahuète) puis graines parsemées
    for (const d of drizzles) {
      const y0 = 38 + R() * 24;
      food += `<path d="M28 ${f(y0)} q8 -8 14 0 t14 0 t14 0" stroke="${d.look[1]}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".85"/>`;
    }
    for (const sp of sprinkles) {
      for (let k = 0; k < 14; k++) {
        const [x, y] = spot(R, 50, 50, inner * 0.85);
        food += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(0.7 + R() * 0.8)}" ry="${f(0.6 + R() * 0.4)}" fill="${sp.look[1]}" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})"/>`;
      }
    }

    const dish = bowl
      ? `<circle cx="51.5" cy="53" r="46" fill="var(--plate-shadow)"/>
         <circle cx="50" cy="50" r="46" fill="var(--plate)" stroke="var(--plate-rim)" stroke-width=".8"/>
         <circle cx="50" cy="50" r="${inner + 1}" fill="var(--plate-well)" stroke="var(--plate-rim)" stroke-width=".6"/>`
      : `<circle cx="51.5" cy="53" r="46" fill="var(--plate-shadow)"/>
         <circle cx="50" cy="50" r="46" fill="var(--plate)" stroke="var(--plate-rim)" stroke-width=".8"/>
         <circle cx="50" cy="50" r="${inner + 3}" fill="none" stroke="var(--plate-rim)" stroke-width=".6"/>`;
    const svg = `<svg class="plate" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      ${dish}<g>${food}</g></svg>`;
    cache.set(recipe.id, svg);
    return svg;
  }

  // ---------- Fruits & légumes de saison : petites illustrations entières (48 × 48)
  const SW = 'stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"';
  const leafAt = (x, y, a, c = '#8fae6a', d = '#5f7d45') =>
    `<path d="M0 0 C3 -5 9 -6 12 -4 C9 0 4 2 0 0Z" fill="${c}" stroke="${d}" ${SW} transform="translate(${x} ${y}) rotate(${a})"/>`;
  const PRODUCE = {
    poireau: `<path d="M21 24 C18 15 13 9 8 6 C14 7 20 12 24 20 C27 12 32 6 40 4 C35 9 30 15 27 24Z" fill="#8fae6a" stroke="#5f7d45" ${SW}/>
      <rect x="20" y="22" width="8" height="19" rx="4" fill="#f4f1e2" stroke="#b5ae86" ${SW}/>
      <path d="M21 42 l-2 3 M24 42 v3.5 M27 42 l2 3" stroke="#b5ae86" ${SW} fill="none"/>`,
    butternut: `<path d="M24 9 C29 9 30 15 29.5 20 C37 23 40 33 35 39.5 C31 44 17 44 13 39.5 C8 33 11 23 18.5 20 C18 15 19 9 24 9Z" fill="#f0b66c" stroke="#c98b40" ${SW}/>
      <path d="M24 9 V5" stroke="#7d6040" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="34" r="3.2" fill="#e49a48" opacity=".6"/>`,
    choufleur: `${leafAt(8, 34, -20)}${leafAt(40, 34, 200)}
      <g fill="#f6f0dc" stroke="#cfc29c" ${SW}><circle cx="17" cy="24" r="7"/><circle cx="31" cy="24" r="7"/><circle cx="24" cy="18" r="7.5"/><circle cx="24" cy="29" r="8"/></g>
      <path d="M16 36 C20 41 28 41 32 36" fill="#a8c381" stroke="#6f8f4f" ${SW}/>`,
    kiwi: `<circle cx="24" cy="24" r="16" fill="#9b7b55" stroke="#73583a" ${SW}/><circle cx="24" cy="24" r="13.4" fill="#a9c96a"/>
      <circle cx="24" cy="24" r="4.5" fill="#f2f0d5"/>
      <g fill="#3d3328">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<ellipse cx="${f(24 + Math.cos(a) * 7.5)}" cy="${f(24 + Math.sin(a) * 7.5)}" rx="1" ry=".6" transform="rotate(${f((a * 180) / Math.PI)} ${f(24 + Math.cos(a) * 7.5)} ${f(24 + Math.sin(a) * 7.5)})"/>`; }).join('')}</g>`,
    poire: `<path d="M24 12 C28 12 28.5 18 29 21 C35 25 37 33 33.5 38.5 C30 43.5 18 43.5 14.5 38.5 C11 33 13 25 19 21 C19.5 18 20 12 24 12Z" fill="#e2e08c" stroke="#a9a65a" ${SW}/>
      <path d="M24 12 C24 9 25 7 26 5.5" stroke="#7d6040" ${SW} fill="none"/>${leafAt(25.5, 8, -25)}`,
    brocoli: `<path d="M21 28 L19 42 H29 L27 28Z" fill="#b9d08f" stroke="#7d9a5a" ${SW}/>
      <g fill="#6f9258" stroke="#4f7044" ${SW}><circle cx="15" cy="22" r="6.5"/><circle cx="33" cy="22" r="6.5"/><circle cx="24" cy="15" r="7.5"/><circle cx="24" cy="25" r="6.5"/></g>`,
    epinards: `<path d="M10 38 C8 24 16 10 30 8 C32 22 24 34 10 38Z" fill="#6f915f" stroke="#4f7044" ${SW}/><path d="M11 37 C16 28 22 19 29 10" stroke="#a9c48f" ${SW} fill="none"/>
      <path d="M20 42 C22 30 30 22 41 22 C40 33 32 41 20 42Z" fill="#87a86f" stroke="#57794a" ${SW}/><path d="M21 41 C27 34 33 28 40 23" stroke="#b9d3a0" ${SW} fill="none"/>`,
    patatedouce: `<path d="M8 30 C6 22 16 13 28 12 C38 11 43 17 40 24 C37 31 26 36 17 36 C12 36 9 34 8 30Z" fill="#cf7a5e" stroke="#9c5340" ${SW}/>
      <path d="M40 22 l4 -2 M8 30 l-4 2" stroke="#9c5340" ${SW}/><g fill="#a65b45"><circle cx="18" cy="24" r=".9"/><circle cx="27" cy="20" r=".9"/><circle cx="31" cy="28" r=".9"/></g>`,
    avocat: `<path d="M24 6 C30 6 32 14 33 19 C38 24 39 33 35 38.5 C31.5 43.5 16.5 43.5 13 38.5 C9 33 10 24 15 19 C16 14 18 6 24 6Z" fill="#55703a" stroke="#3f5a2b" ${SW}/>
      <path d="M24 9 C28.5 9 30 15 30.5 20 C35 24 35.5 32 32.5 36.5 C29.5 40.5 18.5 40.5 15.5 36.5 C12.5 32 13 24 17.5 20 C18 15 19.5 9 24 9Z" fill="#d6dc95"/>
      <circle cx="24" cy="30" r="6" fill="#9a6a45" stroke="#764e30" ${SW}/>`,
    pomme: `<path d="M24 16 C18 11 9 14 9 24 C9 34 16 42 21 41 C23 40.5 25 40.5 27 41 C32 42 39 34 39 24 C39 14 30 11 24 16Z" fill="#e17f6c" stroke="#b5574a" ${SW}/>
      <path d="M24 16 C24 12 25 9 27 7" stroke="#7d6040" ${SW} fill="none"/>${leafAt(26, 10, -15)}<ellipse cx="16" cy="22" rx="2.2" ry="3.4" fill="#fff" opacity=".35"/>`,
    citron: `<path d="M7 26 C8 18 15 12 24 12 C33 12 40 18 41 26 C40 34 33 39 24 39 C15 39 8 34 7 26Z" fill="#f3df7c" stroke="#cdb345" ${SW}/>
      <path d="M7 26 l-3 0 M41 26 l3 0" stroke="#cdb345" ${SW}/>${leafAt(24, 12, -60)}<ellipse cx="17" cy="21" rx="3" ry="1.8" fill="#fff" opacity=".4"/>`,
    aubergine: `<path d="M18 14 C26 12 34 18 38 28 C41 36 36 43 29 41 C22 39 15 32 13 24 C12 19 14 15 18 14Z" fill="#6e5584" stroke="#4f3b63" ${SW}/>
      <path d="M12 9 C14 13 17 15 20 15 C19 12 16 9 12 9Z M18 14 C15 17 15 20 17 22 C19 19 21 17 23 16Z" fill="#8fae6a" stroke="#5f7d45" ${SW}/>
      <ellipse cx="25" cy="24" rx="2" ry="4.5" fill="#fff" opacity=".25" transform="rotate(-40 25 24)"/>`,
    radis: `${leafAt(24, 18, -110)}${leafAt(24, 18, -70)}<circle cx="24" cy="28" r="10" fill="#e07b8c" stroke="#b5566a" ${SW}/>
      <path d="M24 38 C24 41 25 43 27 45" stroke="#b5566a" ${SW} fill="none"/><ellipse cx="20" cy="25" rx="2" ry="3" fill="#fff" opacity=".4"/>`,
    orange: `<circle cx="24" cy="26" r="15" fill="#f2a64e" stroke="#c9822e" ${SW}/>${leafAt(24, 11, -50)}
      <g fill="#d98a35" opacity=".55"><circle cx="18" cy="24" r=".8"/><circle cx="28" cy="20" r=".8"/><circle cx="30" cy="31" r=".8"/><circle cx="20" cy="33" r=".8"/></g>
      <ellipse cx="18" cy="20" rx="3" ry="2" fill="#fff" opacity=".35"/>`,
    fraises: `<path d="M24 42 C15 36 10 28 11 21 C12 16 17 14 24 15 C31 14 36 16 37 21 C38 28 33 36 24 42Z" fill="#df625f" stroke="#b34445" ${SW}/>
      <path d="M15 15 C18 10 21 13 24 11 C27 13 30 10 33 15 C29 17 19 17 15 15Z" fill="#7fa45a" stroke="#58793f" ${SW}/>
      <g fill="#f6dc8a">${[[18, 22], [24, 21], [30, 22], [20, 28], [27, 28], [23, 34], [16, 26], [32, 27]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx=".7" ry="1.1"/>`).join('')}</g>`,
    courgette: `<path d="M9 34 C8 30 12 27 17 24 L33 12 C36 10 40 12 39 16 C38 19 36 21 33 23 L18 35 C14 38 10 38 9 34Z" fill="#6f9152" stroke="#4f7038" ${SW}/>
      <path d="M14 30 L33 15 M16 33 L35 18" stroke="#9cbb7c" stroke-width="1" opacity=".7"/><path d="M38 13 l3 -3" stroke="#7d6040" stroke-width="2.4" stroke-linecap="round"/>`,
    poivron: `<path d="M24 14 C17 12 10 16 10 25 C10 34 15 41 20 41 C22 41 23 40 24 39 C25 40 26 41 28 41 C33 41 38 34 38 25 C38 16 31 12 24 14Z" fill="#dd6450" stroke="#b1473a" ${SW}/>
      <path d="M24 14 V8 C24 6 26 5 28 6" stroke="#5f7d45" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M24 16 V36" stroke="#b1473a" stroke-width="1" opacity=".5"/>
      <ellipse cx="17" cy="23" rx="2" ry="4.5" fill="#fff" opacity=".3"/>`,
    tomate: `<circle cx="24" cy="27" r="14" fill="#e06b53" stroke="#b44c3a" ${SW}/>
      <path d="M24 13 L26 17 L31 15.5 L28.5 19.5 L32 22 L27 21.5 L24 24 L21 21.5 L16 22 L19.5 19.5 L17 15.5 L22 17Z" fill="#7fa45a" stroke="#58793f" ${SW}/>
      <ellipse cx="17" cy="27" rx="2.4" ry="3.6" fill="#fff" opacity=".35"/>`,
    concombre: `<rect x="6" y="18" width="36" height="13" rx="6.5" fill="#6f9152" stroke="#4f7038" ${SW} transform="rotate(-25 24 24.5)"/>
      <path d="M12 30 L36 19" stroke="#a9c48f" stroke-width="1.2" stroke-dasharray="3 3" stroke-linecap="round"/>`,
  };
  function produceIcon(id) {
    return PRODUCE[id] ? `<svg class="produce" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${PRODUCE[id]}</svg>` : '';
  }

  window.plateSVG = plateSVG;
  window.produceIcon = produceIcon;
})();
