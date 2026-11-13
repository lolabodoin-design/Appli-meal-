// =============================================================
//  Page « Suivi » : l'eau du jour en verres dessinés (500 ml chacun, jusqu'à l'objectif)
//  et le suivi du poids (courbe + objectifs recalculés).
//  - l'eau repart à zéro chaque jour (clé = date locale) ; on garde 60 jours d'historique
//  - chaque personne a son suivi ; par défaut, celle des rappels d'eau de cet appareil
// =============================================================
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const page = el('page-suivi');
  if (!page) return;

  const GLASS = 500; // ml par verre
  const DAY_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  let who = null;

  const todayKey = (date = new Date()) => date.toLocaleDateString('sv'); // AAAA-MM-JJ, heure locale
  const goalMl = p => Math.round(p.profile.poids * 35 / 50) * 50;   // 35 ml / kg, comme les rappels
  const fmtL = ml => `${(Math.round(ml / 100) / 10).toString().replace('.', ',')} L`;
  const log = () => (state.drinkLog ||= {});
  const drunk = (pid, key = todayKey()) => log()[key]?.[pid] || 0;
  const weights = pid => ((state.weights ||= {})[pid] ||= []);

  function person() {
    const people = activePeople();
    if (!who || !people.some(p => p.id === who)) {
      const mine = people.find(p => normText(p.name) === normText(state.water?.prenom || ''));
      who = (mine || people[0]).id;
    }
    return personById(who);
  }

  // ---------- Verre dessiné (rempli de 0 à 1)
  function glassSVG(fill, i) {
    const top = 6, bottom = 52, level = bottom - (bottom - top) * fill;
    const id = `gl-${who}-${i}`;
    return `<svg viewBox="0 0 40 58" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="M7 5 L33 5 L29.5 52 Q29.3 54 27 54 L13 54 Q10.7 54 10.5 52 Z"/></clipPath></defs>
      <g clip-path="url(#${id})">
        <rect class="gl-water" x="0" y="${level.toFixed(1)}" width="40" height="${(58 - level).toFixed(1)}"/>
        ${fill > 0 && fill < 1.01 ? `<path class="gl-wave" d="M4 ${level.toFixed(1)} q4 -2 8 0 t8 0 t8 0 t8 0 t8 0"/>` : ''}
      </g>
      <path class="gl-line" d="M7 5 L33 5 L29.5 52 Q29.3 54 27 54 L13 54 Q10.7 54 10.5 52 Z"/>
      <path class="gl-shine" d="M11 10 L13 46"/>
    </svg>`;
  }

  // ---------- Eau
  function renderWater() {
    const p = person();
    const goal = goalMl(p), ml = drunk(p.id);
    const n = Math.ceil(goal / GLASS);
    const pct = Math.min(100, Math.round((ml / goal) * 100));
    const glasses = Array.from({ length: n }, (_, i) => {
      const cap = Math.min(GLASS, goal - i * GLASS); // le dernier verre peut être plus petit
      const fill = Math.max(0, Math.min(1, (ml - i * GLASS) / cap));
      return `<button type="button" class="glass ${fill >= 1 ? 'full' : ''}" data-glass="${i}" aria-label="Verre ${i + 1} : ${cap} ml${fill >= 1 ? ', bu' : ''}">${glassSVG(fill, i)}</button>`;
    }).join('');

    // 7 derniers jours
    const days = Array.from({ length: 7 }, (_, k) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - k));
      const v = drunk(p.id, todayKey(d));
      return { label: DAY_SHORT[(d.getDay() + 6) % 7], pct: Math.min(100, Math.round((v / goal) * 100)), v, today: k === 6 };
    });

    el('suivi-water').innerHTML = `
      <div class="sv-head">
        <div><span class="sv-kicker">Eau · aujourd'hui</span>
          <div class="sv-big"><b>${fmtL(ml)}</b> <span>/ ${fmtL(goal)}</span></div></div>
        <div class="sv-ring" style="--p:${pct}"><span>${pct} %</span></div>
      </div>
      <div class="glasses">${glasses}</div>
      <div class="sv-actions">
        <button type="button" class="ghost" data-drink="-1" ${ml ? '' : 'disabled'}>− 500 ml</button>
        <button type="button" class="primary" data-drink="1">+ 500 ml</button>
      </div>
      <p class="sv-msg">${ml >= goal ? 'Objectif atteint, bravo !' : `Encore ${fmtL(goal - ml)} : ${Math.ceil((goal - ml) / GLASS)} verre${Math.ceil((goal - ml) / GLASS) > 1 ? 's' : ''}.`}</p>
      <div class="sv-week" aria-label="Eau des 7 derniers jours">${days.map(d => `
        <div class="svw-day ${d.today ? 'today' : ''}" title="${fmtL(d.v)}">
          <div class="svw-bar"><div style="height:${d.pct}%"></div></div><span>${d.label}</span></div>`).join('')}
      </div>`;
  }

  function setDrunk(ml) {
    const p = person(), key = todayKey();
    const goal = goalMl(p);
    log()[key] ||= {};
    log()[key][p.id] = Math.max(0, Math.min(goal + 2 * GLASS, ml));
    // On ne garde que 60 jours
    const keys = Object.keys(log()).sort();
    while (keys.length > 60) delete log()[keys.shift()];
    saveState();
    renderWater();
  }

  // ---------- Poids
  function chartSVG(list) {
    const pts = list.slice(-12);
    if (pts.length < 2) return '';
    const W = 300, H = 120, px = 14, py = 16;
    const kgs = pts.map(x => x.kg);
    let lo = Math.min(...kgs), hi = Math.max(...kgs);
    if (hi - lo < 2) { const m = (hi + lo) / 2; lo = m - 1; hi = m + 1; }
    const X = i => px + (i * (W - 2 * px)) / (pts.length - 1);
    const Y = kg => py + ((hi - kg) * (H - 2 * py)) / (hi - lo);
    const line = pts.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x.kg).toFixed(1)}`).join(' ');
    const area = `${line} L${X(pts.length - 1).toFixed(1)} ${H - 4} L${X(0).toFixed(1)} ${H - 4} Z`;
    const fmtD = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `<svg class="sv-chart" viewBox="0 0 ${W} ${H + 18}" role="img" aria-label="Évolution du poids">
      <path class="svc-area" d="${area}"/><path class="svc-line" d="${line}"/>
      ${pts.map((x, i) => `<circle class="svc-dot" cx="${X(i).toFixed(1)}" cy="${Y(x.kg).toFixed(1)}" r="${i === pts.length - 1 ? 4 : 2.6}"><title>${fmtD(x.d)} : ${String(x.kg).replace('.', ',')} kg</title></circle>`).join('')}
      <text class="svc-txt" x="${px}" y="${H + 14}">${fmtD(pts[0].d)}</text>
      <text class="svc-txt" x="${W - px}" y="${H + 14}" text-anchor="end">${fmtD(pts[pts.length - 1].d)}</text>
    </svg>`;
  }

  function renderWeight(msg = '') {
    const p = person();
    const list = weights(p.id);
    const last = list[list.length - 1];
    const first = list[0];
    const diff = last && first && list.length > 1 ? Math.round((last.kg - first.kg) * 10) / 10 : null;
    el('suivi-weight').innerHTML = `
      <div class="sv-head">
        <div><span class="sv-kicker">Poids</span>
          <div class="sv-big"><b>${String(last?.kg ?? p.profile.poids).replace('.', ',')} kg</b>
          ${diff !== null ? `<span class="sv-diff ${diff < 0 ? 'down' : diff > 0 ? 'up' : ''}">${diff > 0 ? '+' : ''}${String(diff).replace('.', ',')} kg depuis le ${new Date(first.d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>` : ''}</div></div>
      </div>
      ${chartSVG(list)}
      <form class="sv-form" id="weight-form">
        <label for="weight-input" class="sr-only">Poids du jour en kg</label>
        <input type="text" id="weight-input" inputmode="decimal" autocomplete="off" pattern="[0-9]{2,3}([,.][0-9])?" placeholder="${String(last?.kg ?? p.profile.poids).replace('.', ',')}" required>
        <span class="sv-unit">kg</span>
        <button type="submit" class="secondary">Noter mon poids</button>
      </form>`;
  }

  function addWeight(kg) {
    const p = person();
    const list = weights(p.id);
    const today = todayKey();
    const entry = list.find(x => x.d === today);
    if (entry) entry.kg = kg; else list.push({ d: today, kg });
    list.sort((a, b) => a.d.localeCompare(b.d));
    // Le profil prend le dernier poids : besoins et eau recalculés
    const before = p.targets.kcal;
    p.profile.poids = kg;
    p.targets = computeNeeds(p.profile);
    rebalancePlan();
    saveState();
    render(); // le reste de l'appli (bilan, réglages) suit
    renderAll(before !== p.targets.kcal ? `Noté ! Objectif de ${esc(p.name)} : ${p.targets.kcal} kcal par jour (avant : ${before}).` : 'Noté !');
  }

  // ---------- Analyser mon assiette avec Claude (gratuit : passe par l'appli Claude de l'utilisatrice)
  // 1. l'appli prépare une consigne (repas prévu + format de réponse), la copie et ouvre Claude
  // 2. on y joint la photo ; Claude répond par un bloc JSON
  // 3. on colle la réponse ici : affichage + comparaison au repas prévu, gardé dans l'historique du jour
  const CLAUDE_URL = 'https://claude.ai/new';
  const SLOT_ORDER = ['petitdej', 'dejeuner', 'collation', 'diner'];
  let photoSlot = null;
  let photoResult = null;
  let photoFile = null, photoUrl = null;
  let replaceMsg = '';

  // Photo réduite (1600 px max, JPEG) : plus légère à partager, suffisante pour l'analyse
  function preparePhoto(file) {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      c.toBlob(b => {
        photoFile = new File([b], 'mon-assiette.jpg', { type: 'image/jpeg' });
        if (photoUrl) URL.revokeObjectURL(photoUrl);
        photoUrl = URL.createObjectURL(photoFile);
        renderPhoto();
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => { photoFile = file; renderPhoto(); };
    img.src = src;
  }
  const photos = () => (state.photoLog ||= {});
  const r0 = n => Math.round(Number(n) || 0);

  function guessSlot() {
    const h = new Date().getHours();
    return h < 11 ? 'petitdej' : h < 15 ? 'dejeuner' : h < 18 ? 'collation' : 'diner';
  }
  // Le repas prévu aujourd'hui pour ce créneau (null si pas de menu ou repas dehors)
  function plannedMeal(slot) {
    const meal = state.plan?.[todayIndex]?.meals.find(m => m.slot === slot);
    if (!meal) return null;
    const detail = mealDetail(meal, person().id);
    if (!detail) return null;
    const name = meal.external ? EXTERNAL[meal.external].label : recipeOf(meal, person().id).name;
    return { name, detail, external: !!meal.external };
  }

  function buildPrompt() {
    const p = person(), plan = plannedMeal(photoSlot);
    const planned = plan
      ? `Repas prévu par mon appli pour ce ${SLOTS[photoSlot].label.toLowerCase()} : « ${plan.name} »`
        + (plan.detail.items.length ? `, soit ${plan.detail.items.map(it => `${it.g} g de ${it.ing.name.toLowerCase()}`).join(', ')}` : '')
        + `. Objectif : ${r0(plan.detail.totals.kcal)} kcal, ${r0(plan.detail.totals.p)} g de protéines, ${r0(plan.detail.totals.c)} g de glucides, ${r0(plan.detail.totals.f)} g de lipides.`
      : 'Pas de repas prévu pour ce créneau.';
    return `Je joins la photo de mon assiette (${SLOTS[photoSlot].label.toLowerCase()} de ${p.name}).
${planned}

Analyse la photo : identifie les aliments visibles, estime chaque quantité en grammes, puis les calories, protéines, glucides et lipides. Si un aliment est incertain, fais ta meilleure estimation.

Réponds UNIQUEMENT avec ce bloc JSON (nombres sans unités, pas de texte autour) :
\`\`\`json
{"plat": "nom court du plat", "aliments": [{"nom": "...", "g": 0, "kcal": 0, "p": 0, "g_glucides": 0, "l": 0}], "total": {"kcal": 0, "p": 0, "g_glucides": 0, "l": 0}, "confiance": "faible | moyenne | bonne", "conseil": "une phrase courte et bienveillante, en comparant au repas prévu"}
\`\`\``;
  }

  // Lit la réponse de Claude : bloc ```json ou premier objet { … }
  function parseAnswer(text) {
    // Copié depuis l'appli Claude, le texte peut contenir des guillemets typographiques,
    // des espaces insécables ou une virgule en trop : on nettoie avant de lire
    const clean = String(text)
      .replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"').replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u00A0\u202F]/g, ' ');
    const block = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
    let raw = block ? block[1] : clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1);
    raw = raw.replace(/,\s*([}\]])/g, '$1').replace(/(\d),(\d)/g, '$1.$2');
    let d;
    try { d = JSON.parse(raw); } catch { return null; }
    if (!d || typeof d !== 'object') return null;
    const al = Array.isArray(d.aliments) ? d.aliments.map(a => ({
      nom: String(a.nom || '?'), g: r0(a.g), kcal: r0(a.kcal), p: r0(a.p), c: r0(a.g_glucides ?? a.glucides), f: r0(a.l ?? a.lipides),
    })) : [];
    const t = d.total || {};
    const total = {
      kcal: r0(t.kcal) || al.reduce((x, a) => x + a.kcal, 0),
      p: r0(t.p) || al.reduce((x, a) => x + a.p, 0),
      c: r0(t.g_glucides ?? t.glucides) || al.reduce((x, a) => x + a.c, 0),
      f: r0(t.l ?? t.lipides) || al.reduce((x, a) => x + a.f, 0),
    };
    if (!total.kcal && !al.length) return null;
    return { plat: String(d.plat || 'Mon assiette'), aliments: al, total, confiance: String(d.confiance || ''), conseil: String(d.conseil || '') };
  }

  function resultHTML(res, plan) {
    const t = res.total, T = plan?.detail.totals;
    const diff = T ? t.kcal - r0(T.kcal) : null;
    const bar = (label, v, target, cls) => {
      const pct = target ? Math.min(150, Math.round((v / target) * 100)) : 0;
      return `<div class="ph-bar"><span>${label}</span><div class="ph-track"><div class="${cls}" style="width:${Math.min(100, pct)}%"></div></div>
        <b>${v}${label === 'Calories' ? '' : ' g'}</b>${target ? `<small>/ ${r0(target)}</small>` : ''}</div>`;
    };
    return `
      <div class="ph-result">
        <h3>${esc(res.plat)}</h3>
        ${diff !== null ? `<p class="ph-diff ${Math.abs(diff) <= 0.12 * T.kcal ? 'ok' : 'off'}">${diff > 0 ? '+' : ''}${diff} kcal par rapport au repas prévu (${esc(plan.name)})</p>` : ''}
        ${bar('Calories', t.kcal, T?.kcal, 'b-kcal')}${bar('Protéines', t.p, T?.p, 'b-p')}${bar('Glucides', t.c, T?.c, 'b-c')}${bar('Lipides', t.f, T?.f, 'b-f')}
        ${res.aliments.length ? `<ul class="ph-list">${res.aliments.map(a => `<li><span>${esc(a.nom)}</span><small>${a.g} g · ${a.kcal} kcal</small></li>`).join('')}</ul>` : ''}
        ${res.conseil ? `<p class="ph-tip">${esc(res.conseil)}</p>` : ''}
        ${state.plan ? `<div class="ph-replace">
          <b>Tu n'as pas mangé le repas prévu ?</b>
          <div class="ph-replace-row">
            <select id="ph-day" aria-label="Jour">${DAYS.map((n, k) => `<option value="${k}" ${k === todayIndex ? 'selected' : ''}>${k === todayIndex ? 'Aujourd\'hui' : k === todayIndex - 1 ? 'Hier' : n}</option>`).join('')}</select>
            <select id="ph-slot" aria-label="Repas">${SLOT_ORDER.map(k => `<option value="${k}" ${k === photoSlot ? 'selected' : ''}>${SLOTS[k].label}</option>`).join('')}</select>
          </div>
          <button type="button" class="primary small" data-ph-replace>Remplacer par ma photo</button>
        </div>` : ''}
        ${replaceMsg ? `<div class="ph-replaced">${replaceMsg}</div>` : ''}
      </div>`;
  }

  function renderPhoto(msg = '') {
    const p = person();
    photoSlot ||= guessSlot();
    const plan = plannedMeal(photoSlot);
    const today = (photos()[todayKey()] || []).filter(x => x.who === p.id);
    const dayKcal = today.reduce((a, x) => a + x.total.kcal, 0);
    el('suivi-photo').innerHTML = `
      <div class="sv-head"><div><span class="sv-kicker">Robot photo · avec Claude</span>
        <div class="sv-big ph-title">Analyser mon assiette</div></div></div>
      <div class="ph-slots">${SLOT_ORDER.map(k => `<button type="button" class="chip-btn ${k === photoSlot ? 'active' : ''}" data-ph-slot="${k}">${SLOTS[k].label}</button>`).join('')}</div>
      <p class="hint">${plan ? `Prévu : <b>${esc(plan.name)}</b> · ${r0(plan.detail.totals.kcal)} kcal` : 'Pas de repas prévu pour ce créneau : Claude estimera sans comparer.'}</p>
      <ol class="ph-steps">
        <li><label class="${photoFile ? 'secondary' : 'primary'} ph-shot"><input type="file" id="ph-file" accept="image/*" capture="environment" hidden>
            ${photoFile ? 'Reprendre la photo' : 'Prendre la photo'}</label>
          ${photoUrl ? `<img class="ph-thumb" src="${photoUrl}" alt="Photo de l'assiette">` : ''}</li>
        <li><button type="button" class="primary small" data-ph-send ${photoFile ? '' : 'disabled'}>Envoyer à Claude</button>
</li>
        <li><span>Copie la réponse de Claude, puis :</span>
          <button type="button" class="primary small ph-insert" data-ph-insert>Insérer la réponse de Claude</button>
          <details class="ph-manual"><summary>Ça ne marche pas ? Coller à la main</summary>
            <textarea id="ph-in" rows="3" placeholder="Touche ici, puis Coller"></textarea>
            <button type="button" class="chip-btn ph-read" data-ph-read>Lire la réponse</button>
          </details></li>
      </ol>
      <p class="ph-msg" aria-live="polite">${msg}</p>
      ${photoResult ? resultHTML(photoResult, plan) : ''}
      ${today.length ? `<div class="ph-today"><b>Aujourd'hui</b> : ${today.length} repas analysé${today.length > 1 ? 's' : ''} · ${dayKcal} kcal
        <ul>${today.map((x, i) => `<li>${esc(SLOTS[x.slot]?.label || '')} · ${esc(x.plat)} · ${x.total.kcal} kcal <button type="button" class="link-btn" data-ph-del="${i}" aria-label="Supprimer">✕</button></li>`).join('')}</ul></div>` : ''}`;
  }

  function openManual(msg) {
    renderPhoto(msg);
    const box = page.querySelector('.ph-manual');
    if (box) { box.open = true; el('ph-in').focus(); }
  }

  function readAnswer(text) {
    const res = parseAnswer(text || '');
    if (!res) {
      const peek = String(text || '').trim().slice(0, 60);
      renderPhoto(peek
        ? `Je n'arrive pas à lire cette réponse (j'ai reçu : « ${esc(peek)}… »). Copie toute la réponse de Claude, avec les accolades { }.`
        : 'Le presse-papier est vide : dans Claude, fais un appui long sur la réponse → Copier, puis réessaie.');
      return;
    }
    photoResult = res;
    replaceMsg = '';
    const key = todayKey();
    photos()[key] ||= [];
    // Même réponse collée deux fois : on ne la compte qu'une fois
    const dup = photos()[key].some(x => x.who === person().id && x.slot === photoSlot && x.plat === res.plat && x.total.kcal === res.total.kcal);
    if (!dup) photos()[key].push({ who: person().id, slot: photoSlot, time: new Date().toTimeString().slice(0, 5), plat: res.plat, total: res.total });
    const keys = Object.keys(photos()).sort();
    while (keys.length > 60) delete photos()[keys.shift()];
    saveState();
    renderPhoto();
  }

  // ---------- Page
  function renderPeople() {
    const people = activePeople();
    el('suivi-who').hidden = people.length < 2;
    el('suivi-who').innerHTML = people.map(p =>
      `<button type="button" class="seg-btn" data-who="${p.id}" aria-selected="${p.id === who}">${esc(p.name)}</button>`).join('');
  }
  function renderAll(msg) { person(); renderPeople(); renderWater(); renderPhoto(); renderWeight(msg); }

  page.addEventListener('click', e => {
    const w = e.target.closest('[data-who]');
    if (w) { who = w.dataset.who; photoResult = null; renderAll(); return; }
    const sl = e.target.closest('[data-ph-slot]');
    if (sl) { photoSlot = sl.dataset.phSlot; photoResult = null; renderPhoto(); return; }
    if (e.target.closest('[data-ph-copy]')) {
      // Copie puis ouverture dans le même geste (sinon Safari bloque l'un ou l'autre)
      const text = buildPrompt();
      const done = () => renderPhoto();
      navigator.clipboard?.writeText(text).then(done, () => { el('ph-in') && (el('ph-in').value = text); renderPhoto('Copie impossible : la consigne est dans la case ci-dessous, copie-la à la main.'); el('ph-in').value = text; });
      window.open(CLAUDE_URL, '_blank', 'noopener');
      return;
    }
    if (e.target.closest('[data-ph-send]')) {
      if (!photoFile) return;
      const text = buildPrompt();
      // La demande est aussi copiée : si l'appli Claude ne reprend que la photo, il suffit de la coller
      navigator.clipboard?.writeText(text).catch(() => {});
      const data = { files: [photoFile], text };
      if (navigator.canShare && navigator.canShare(data)) {
        navigator.share(data).then(
          () => renderPhoto(),
          err => { if (err.name !== 'AbortError') renderPhoto(`Le partage n'a pas abouti (${err.name}). Essaie « Copier seulement la demande ».`); });
      } else {
        navigator.clipboard?.writeText(text).catch(() => {});
        window.open(CLAUDE_URL, '_blank', 'noopener');
        renderPhoto('Demande copiée : dans Claude, colle-la et ajoute ta photo.');
      }
      return;
    }
    if (e.target.closest('[data-ph-read]')) { readAnswer(el('ph-in').value); return; }
    if (e.target.closest('[data-ph-insert]')) {
      if (!navigator.clipboard?.readText) { openManual('Ton navigateur ne permet pas de lire le presse-papier : colle la réponse dans la case.'); return; }
      navigator.clipboard.readText().then(readAnswer, err => openManual(`L'iPhone a refusé de coller (${esc(err?.name || 'erreur')}) : colle la réponse dans la case ci-dessous.`));
      return;
    }
    if (e.target.closest('[data-ph-replace]') && photoResult) {
      const d = Number(el('ph-day').value), slot = el('ph-slot').value, p = person();
      const res = replaceWithPhoto(d, slot, p.id, photoResult);
      if (!res) { replaceMsg = `Pas de ${SLOTS[slot].label.toLowerCase()} prévu ce jour-là dans le menu.`; renderPhoto(); return; }
      const dayName = d === todayIndex ? 'aujourd\'hui' : d === todayIndex - 1 ? 'hier' : DAYS[d].toLowerCase();
      replaceMsg = `<b>C'est fait : ${esc(SLOTS[slot].label.toLowerCase())} de ${dayName} remplacé.</b><br>`
        + `Journée de ${esc(p.name)} : ${r0(res.total.kcal)} kcal pour un objectif de ${r0(res.target.kcal)} · P ${r0(res.total.p)} / ${r0(res.target.p)} g`
        + (res.changed.length
          ? `<br>Repas ajustés : ${res.changed.map(c => `${esc(SLOTS[c.slot].label.toLowerCase())} ${r0(c.before)} → ${r0(c.after)} kcal`).join(', ')}.`
          : (d < todayIndex ? '<br>Journée passée : rien à réajuster, elle est juste mise à jour dans ton bilan.' : '<br>Aucun autre repas à ajuster ce jour-là.'))
        + (d >= todayIndex && res.total.kcal > res.target.kcal * 1.1
          ? `<br>Même en allégeant les repas suivants au maximum, la journée dépasse de ${r0(res.total.kcal - res.target.kcal)} kcal : pas de panique, ça s'équilibre sur la semaine.`
          : d >= todayIndex && res.total.kcal < res.target.kcal * 0.9
            ? `<br>Il te manque encore ${r0(res.target.kcal - res.total.kcal)} kcal : une collation en plus serait la bienvenue.` : '');
      renderPhoto();
      return;
    }
    const del = e.target.closest('[data-ph-del]');
    if (del) {
      const key = todayKey(), mine = (photos()[key] || []).filter(x => x.who === person().id);
      const target = mine[Number(del.dataset.phDel)];
      photos()[key] = photos()[key].filter(x => x !== target);
      saveState(); renderPhoto(); return;
    }
    const d = e.target.closest('[data-drink]');
    if (d) { setDrunk(drunk(person().id) + Number(d.dataset.drink) * GLASS); return; }
    const g = e.target.closest('[data-glass]');
    if (g) {
      // Toucher un verre : on remplit jusqu'à lui ; toucher le dernier verre plein le vide
      const p = person(), i = Number(g.dataset.glass), goal = goalMl(p);
      const upTo = Math.min(goal, (i + 1) * GLASS);
      setDrunk(drunk(p.id) === upTo ? i * GLASS : upTo);
    }
  });
  // Dès qu'une réponse complète est collée dans la case, on la lit (le bouton « Coller » est bloqué sur iPhone)
  page.addEventListener('input', e => {
    if (e.target.id !== 'ph-in') return;
    const v = e.target.value;
    if (v.includes('{') && v.lastIndexOf('}') > v.indexOf('{')) readAnswer(v);
  });
  page.addEventListener('change', e => {
    if (e.target.id === 'ph-file' && e.target.files?.[0]) preparePhoto(e.target.files[0]);
  });
  page.addEventListener('submit', e => {
    if (e.target.id !== 'weight-form') return;
    e.preventDefault();
    const kg = Math.round(parseFloat(String(el('weight-input').value).replace(',', '.')) * 10) / 10;
    if (kg >= 30 && kg <= 250) addWeight(kg);
  });

  // Nouveau jour : l'eau repart à zéro (on relit la date à chaque retour sur l'appli)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !page.hidden) renderAll(); });
  document.querySelectorAll('.nav-item[data-page="suivi"]').forEach(b => b.addEventListener('click', () => renderAll()));
  renderAll();
})();
