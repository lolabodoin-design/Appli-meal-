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
    if (pts.length < 2) return '<p class="hint sv-empty">La courbe apparaîtra dès ta deuxième pesée.</p>';
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
      </form>
      <p class="hint sv-note">${msg || 'Une pesée par semaine suffit, le matin à jeun. Tes objectifs caloriques s\'ajustent à ton nouveau poids.'}</p>`;
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

  // ---------- Page
  function renderPeople() {
    const people = activePeople();
    el('suivi-who').hidden = people.length < 2;
    el('suivi-who').innerHTML = people.map(p =>
      `<button type="button" class="seg-btn" data-who="${p.id}" aria-selected="${p.id === who}">${esc(p.name)}</button>`).join('');
  }
  function renderAll(msg) { person(); renderPeople(); renderWater(); renderWeight(msg); }

  page.addEventListener('click', e => {
    const w = e.target.closest('[data-who]');
    if (w) { who = w.dataset.who; renderAll(); return; }
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
