// =============================================================
//  Page « Anti-gaspi » : Mon frigo
//  - on coche ce qu'il reste (1 toucher = il en reste · 2 = à finir vite · 3 = retiré)
//  - mode « Finir mes restes » : le menu de la semaine les utilise en priorité
//    (voir fridgeHits dans app.js) + cartes de recettes qui les finissent
//  - mode « Uniquement mon frigo » : cartes des recettes faisables sans courses
//    (ou presque : il manque 1 ou 2 choses)
// =============================================================
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const page = el('page-frigo');
  if (!page) return;

  let query = '';
  let mode = 'restes';
  const fr = () => (state.fridge ||= {});
  const shortName = ing => ing.name.replace(/\s*\(.*\)/, '');
  // Toujours au placard : huile, épices, sauce soja, miel, miso, whey
  const always = id => INGREDIENTS[id].placard || INGREDIENTS[id].rayon === 'Placard';

  // ---------- Choix des aliments
  function renderEditor() {
    const f = fr();
    const groups = new Map();
    for (const [id, ing] of Object.entries(INGREDIENTS)) {
      if (always(id)) continue;
      if (query && !normText(ing.name).includes(normText(query))) continue;
      if (!groups.has(ing.rayon)) groups.set(ing.rayon, []);
      groups.get(ing.rayon).push([id, ing]);
    }
    el('fridge-list').innerHTML = groups.size ? [...groups].map(([rayon, items]) => `
      <div class="fridge-group">
        <h4>${esc(rayon)}</h4>
        <div class="fridge-chips">${items.map(([id, ing]) => {
          const v = f[id] || 0;
          return `<button type="button" class="fridge-chip ${v === 1 ? 'on' : v === 2 ? 'urgent' : ''}" data-fridge="${id}" aria-pressed="${v > 0}">`
            + `${v === 2 ? '<span class="fc-dot" aria-hidden="true">!</span>' : v === 1 ? '<span class="fc-dot" aria-hidden="true">✓</span>' : ''}${esc(shortName(ing))}</button>`;
        }).join('')}</div>
      </div>`).join('') : '<p class="hint">Aucun aliment ne correspond.</p>';
    el('btn-fridge-clear').hidden = !Object.keys(f).length;
  }

  function renderSummary() {
    const f = fr();
    const ids = Object.keys(f);
    const urgent = ids.filter(id => f[id] === 2);
    el('fridge-summary').innerHTML = ids.length
      ? `<b>${ids.length} aliment${ids.length > 1 ? 's' : ''}</b> : ${ids.map(id => esc(shortName(INGREDIENTS[id]).toLowerCase())).join(', ')}`
        + (urgent.length ? `<br>À finir vite : <b>${urgent.map(id => esc(shortName(INGREDIENTS[id]).toLowerCase())).join(', ')}</b>` : '')
      : 'Ton frigo est vide pour l\'instant. Ajoute ce qu\'il te reste : l\'appli s\'en sert pour éviter le gaspillage.';
    el('btn-fridge-edit').textContent = ids.length ? 'Modifier mon frigo' : 'Remplir mon frigo';
    const badge = el('count-frigo');
    if (badge) badge.textContent = ids.length || '';
  }

  // ---------- Recettes
  const eligible = r => householdAllows(r) && activePeople().some(p => personAllows(r, p));

  // Recettes qui finissent le mieux les restes (« à finir vite » compte double)
  function finishers() {
    const f = fr();
    return RECIPES.filter(eligible).map(r => {
      const used = [...r.ingIds].filter(id => f[id]);
      return { r, used, missing: [...r.ingIds].filter(id => !f[id] && !always(id)), score: used.reduce((a, id) => a + f[id], 0) };
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length)
      .slice(0, 10);
  }

  // Recettes faisables avec le frigo seul (ou presque)
  function fromFridgeOnly() {
    const f = fr();
    return RECIPES.filter(eligible).map(r => {
      const used = [...r.ingIds].filter(id => f[id]);
      return { r, used, missing: [...r.ingIds].filter(id => !f[id] && !always(id)) };
    }).filter(x => x.used.length && x.missing.length <= 2)
      .sort((a, b) => a.missing.length - b.missing.length || b.used.length - a.used.length)
      .slice(0, 12);
  }

  function card({ r, used, missing }, showMissing) {
    const f = fr();
    const typeLabel = { petitdej: 'Petit-déjeuner', plat: 'Plat', collation: 'Collation' }[r.type];
    return `
      <article class="gaspi-card">
        <div class="gc-plate">${plateSVG(r)}</div>
        <h3>${esc(r.name)}</h3>
        <div class="gc-meta">${typeLabel} · ${r.time} min</div>
        <div class="gc-tags">${used.map(id => `<span class="gc-tag ${f[id] === 2 ? 'urgent' : ''}">${esc(shortName(INGREDIENTS[id]))}</span>`).join('')}</div>
        ${showMissing
          ? (missing.length
            ? `<div class="gc-tags">${missing.map(id => `<span class="gc-tag miss">+ ${esc(shortName(INGREDIENTS[id]))}</span>`).join('')}</div>`
            : '<div class="gc-ok">✓ Tout est dans ton frigo</div>')
          : ''}
        ${cookButton({ recipe: r, forWho: 'Portion de base', scalable: true, items: r.ingredients.map(([id, g]) => ({ id, g })) })}
      </article>`;
  }

  function renderMode() {
    document.querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    const box = el('frigo-mode');
    const n = Object.keys(fr()).length;
    if (!n) {
      box.innerHTML = `<p class="mode-empty">Ajoute d'abord ce qu'il te reste dans ton frigo :<br>les idées de recettes apparaîtront ici.</p>`;
      return;
    }
    if (mode === 'restes') {
      const list = finishers();
      box.innerHTML = `
        <p class="mode-intro">Le menu de la semaine utilise d'abord tes restes, et ce qui est <b>à finir vite</b> dès lundi.</p>
        <div class="mode-cta"><button type="button" class="primary" id="btn-fridge-go">${state.plan ? 'Régénérer la semaine avec mes restes' : 'Générer le menu avec mes restes'}</button></div>
        ${list.length ? `<div class="gaspi-row">${list.map(x => card(x, false)).join('')}</div>
          <p class="gaspi-count">${list.length} idée${list.length > 1 ? 's' : ''} pour finir ton frigo · fais défiler →</p>` : ''}`;
    } else {
      const list = fromFridgeOnly();
      const full = list.filter(x => !x.missing.length).length;
      box.innerHTML = list.length
        ? `<p class="mode-intro">${full ? `<b>${full} recette${full > 1 ? 's' : ''}</b> sans aucune course !` : 'Rien de complet, mais il ne manque presque rien :'} Les autres demandent juste 1 ou 2 choses.</p>
           <div class="gaspi-row">${list.map(x => card(x, true)).join('')}</div>
           <p class="gaspi-count">Fais défiler →</p>`
        : `<p class="mode-empty">Pas encore assez d'ingrédients pour une recette complète.<br>Ajoute ce qu'il te reste, même les petites choses (œufs, yaourt, légumes…).</p>`;
    }
  }

  function render() { renderSummary(); renderMode(); if (!el('fridge-editor').hidden) renderEditor(); }

  // ---------- Événements
  el('btn-fridge-edit').addEventListener('click', () => {
    const ed = el('fridge-editor');
    ed.hidden = !ed.hidden;
    el('btn-fridge-edit').setAttribute('aria-expanded', String(!ed.hidden));
    el('btn-fridge-edit').hidden = !ed.hidden;
    if (!ed.hidden) renderEditor();
  });
  el('btn-fridge-done').addEventListener('click', () => {
    el('fridge-editor').hidden = true;
    el('btn-fridge-edit').hidden = false;
    el('btn-fridge-edit').setAttribute('aria-expanded', 'false');
    page.scrollIntoView({ block: 'start' });
    render();
  });
  page.addEventListener('click', e => {
    const chip = e.target.closest('[data-fridge]');
    if (chip) {
      const f = fr(), id = chip.dataset.fridge;
      f[id] = ((f[id] || 0) + 1) % 3;
      if (!f[id]) delete f[id];
      saveState();
      renderEditor(); renderSummary(); renderMode();
      return;
    }
    const seg = e.target.closest('.seg-btn');
    if (seg) { mode = seg.dataset.mode; renderMode(); return; }
    if (e.target.closest('#btn-fridge-go')) {
      generateWeek();
      showPage('semaine');
      showNotice('Menu recalculé avec ton frigo : les restes passent en priorité, et ce qui est « à finir vite » arrive en début de semaine.');
    }
  });
  el('fridge-search').addEventListener('input', e => { query = e.target.value.trim(); renderEditor(); });
  el('btn-fridge-clear').addEventListener('click', () => { state.fridge = {}; saveState(); render(); });

  // Mise à jour quand on arrive sur la page (régimes, avis… ont pu changer)
  document.querySelectorAll('.nav-item[data-page="frigo"]').forEach(b => b.addEventListener('click', render));
  if (!Object.keys(fr()).length) { el('fridge-editor').hidden = false; el('btn-fridge-edit').hidden = true; }
  render();
})();
