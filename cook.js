// =============================================================
//  Mode cuisine pas à pas
//  - écran plein, une étape à la fois, gros boutons, glisser pour avancer
//  - minuteurs détectés dans le texte (« cuire 8 min » → bouton ⏱ 8 min)
//  - l'écran reste allumé (Wake Lock) pendant qu'on cuisine
//  Les recettes à cuisiner sont enregistrées par app.js via cookRegistry
//  (quantités réelles du menu de la semaine, ou portion de base du catalogue).
// =============================================================
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const sheet = el('cook');
  if (!sheet) return;

  let cur = null;          // { recipe, items, forWho, scalable }
  let step = 0;            // 0 = ingrédients, 1..n = étapes, n+1 = fin
  let steps = [];
  let servings = 1;
  let ticked = new Set();  // ingrédients préparés
  let timers = [];         // { id, label, total, end, done }
  let tick = null;
  let wakeLock = null;
  let audio = null;
  let lastFocus = null;

  // ---------- Texte → étapes
  function splitSteps(text) {
    return String(text || '')
      .replace(/([.!?])\s+(?=[A-ZÀ-ÖØ-Ý0-9«])/g, '$1\n')
      .split('\n').map(s => s.trim()).filter(Boolean);
  }

  // Durées présentes dans une étape : « 3 min », « 8 à 10 min », « 1 h 30 »
  function findTimers(text) {
    const out = [];
    const re = /(\d+)\s*h\s*(\d+)?|(\d+)(?:\s*(?:à|-|ou)\s*(\d+))?\s*min(?:utes?)?\b/gi;
    let m;
    while ((m = re.exec(text))) {
      const sec = m[1] ? (Number(m[1]) * 60 + Number(m[2] || 0)) * 60 : Number(m[3]) * 60;
      const label = m[1] ? `${m[1]} h${m[2] ? ' ' + m[2] : ''}` : `${m[3]} min`;
      if (sec > 0 && sec <= 6 * 3600 && !out.some(t => t.sec === sec)) out.push({ sec, label });
    }
    return out;
  }

  // Ingrédients cités dans une étape (premier mot du nom, ou identifiant)
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
  const stem = w => w.replace(/(es|s|x)$/, '');
  function stepIngredients(text) {
    const words = norm(text).split(/[^a-z0-9]+/).map(stem);
    return cur.items.filter(it => {
      const ing = INGREDIENTS[it.id];
      const first = norm(ing.name).split(/[^a-z0-9]+/).filter(w => w.length > 2)[0] || '';
      return [stem(first), stem(norm(it.id))].some(k => k.length > 2 && words.includes(k));
    });
  }

  // ---------- Quantités (multipliées par le nombre de portions dans le catalogue)
  function qty(ing, g) {
    g *= servings;
    if (ing.whole && ing.piece) {
      const n = Math.round((g / ing.piece) * 2) / 2;
      return `${String(n).replace('.', ',')} ${n > 1 ? ing.units : ing.unit}`;
    }
    return `${g >= 100 ? Math.round(g / 5) * 5 : Math.round(g)} g`;
  }

  // « 6 œufs » plutôt que « 6 œufs Œufs » : on n'ajoute le nom que s'il apporte une info
  function line(ing, g) {
    const q = qty(ing, g);
    if (ing.whole && ing.piece && norm(ing.name).includes(stem(norm(ing.unit)))) return `<b>${q}</b>`;
    return `<b>${q}</b> ${esc(ing.name)}`;
  }

  // ---------- Écran allumé
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* refusé : pas grave */ }
  }
  function releaseAwake() { try { wakeLock?.release(); } catch (e) { /* ignore */ } wakeLock = null; }
  document.addEventListener('visibilitychange', () => { if (!sheet.hidden && document.visibilityState === 'visible') { keepAwake(); renderTimers(); } });

  // ---------- Minuteurs
  const fmtTime = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; };
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(t => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
        g.gain.setValueAtTime(0.0001, audio.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.25);
        o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.3);
      });
    } catch (e) { /* pas de son */ }
    try { navigator.vibrate?.([300, 150, 300]); } catch (e) { /* ignore */ }
  }
  function startTimer(sec, label) {
    // Le son doit être « débloqué » par un geste de l'utilisateur (iPhone)
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch (e) { /* ignore */ }
    timers.push({ id: Date.now() + Math.random(), label, total: sec, end: Date.now() + sec * 1000, done: false });
    if (!tick) tick = setInterval(renderTimers, 500);
    renderTimers();
  }
  function renderTimers() {
    const box = el('cook-timers');
    const now = Date.now();
    timers.forEach(t => {
      if (!t.done && now >= t.end) {
        t.done = true; beep();
        if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker?.ready.then(r => r.showNotification('Minuteur terminé', { body: `${cur?.recipe.name || ''} · ${t.label}`, tag: 'cook-timer' })).catch(() => {});
        }
      }
    });
    box.hidden = !timers.length;
    box.innerHTML = timers.map(t => `
      <div class="cook-timer ${t.done ? 'done' : ''}">
        <span class="ct-time">${t.done ? 'C\'est prêt !' : fmtTime((t.end - now) / 1000)}</span>
        <span class="ct-label">${esc(t.label)}</span>
        <button type="button" class="ct-x" data-timer-stop="${t.id}" aria-label="Arrêter ce minuteur">✕</button>
      </div>`).join('');
    if (!timers.length && tick) { clearInterval(tick); tick = null; }
  }

  // ---------- Affichage
  function render() {
    const n = steps.length;
    const total = n + 2;
    el('cook-title').textContent = cur.recipe.name;
    el('cook-count').textContent = step === 0 ? 'Ingrédients' : step > n ? 'Terminé' : `Étape ${step} / ${n}`;
    el('cook-progress').style.width = `${Math.round((step / (total - 1)) * 100)}%`;
    const body = el('cook-body');

    if (step === 0) {
      body.innerHTML = `
        <div class="cook-plate">${plateSVG(cur.recipe)}</div>
        <p class="cook-kicker">${esc(cur.forWho)}</p>
        ${cur.scalable ? `<div class="cook-servings">
            <button type="button" class="ghost" data-serv="-1" aria-label="Une portion de moins">−</button>
            <span><b>${servings}</b> portion${servings > 1 ? 's' : ''}</span>
            <button type="button" class="ghost" data-serv="1" aria-label="Une portion de plus">+</button>
          </div>` : ''}
        <ul class="cook-ings">${cur.items.map((it, k) => {
          const ing = INGREDIENTS[it.id];
          const parts = it.parts ? `<small>${it.parts.map(p => `${esc(p.name)} ${qty(ing, p.g)}`).join(' · ')}</small>` : '';
          return `<li><button type="button" class="cook-ing ${ticked.has(k) ? 'on' : ''}" data-ing="${k}" aria-pressed="${ticked.has(k)}">
            <span class="ci-box" aria-hidden="true"></span>
            <span class="ci-txt">${line(ing, it.g)}${parts}</span></button></li>`;
        }).join('')}</ul>`;
    } else if (step <= n) {
      const text = steps[step - 1];
      const found = findTimers(text);
      const ings = stepIngredients(text);
      body.innerHTML = `
        <p class="cook-step">${esc(text)}</p>
        ${found.length ? `<div class="cook-timer-btns">${found.map(t =>
          `<button type="button" class="cook-start" data-start="${t.sec}" data-label="${esc(t.label)}">⏱ Lancer ${esc(t.label)}</button>`).join('')}</div>` : ''}
        ${ings.length ? `<div class="cook-need"><span>Il te faut</span>${ings.map(it =>
          `<span class="cook-chip">${line(INGREDIENTS[it.id], it.g)}</span>`).join('')}</div>` : ''}`;
    } else {
      const loved = state.ratings[cur.recipe.id] === 'love';
      body.innerHTML = `
        <div class="cook-end">
          <div class="cook-plate">${plateSVG(cur.recipe)}</div>
          <h3>Bon appétit !</h3>
          <button type="button" class="rate-btn ${loved ? 'on' : ''}" data-cook-love>${loved ? '♥ On aime' : '♡ J\'aime cette recette'}</button>
        </div>`;
    }
    el('cook-prev').disabled = step === 0;
    el('cook-next').textContent = step === 0 ? 'C\'est parti' : step === n ? 'Terminer' : step > n ? 'Fermer' : 'Suivant';
    body.scrollTop = 0;
  }

  function go(to) {
    const max = steps.length + 1;
    if (to > max) { close(); return; }
    step = Math.max(0, Math.min(max, to));
    render();
  }

  // ---------- Ouverture / fermeture
  function open(key) {
    const data = cookRegistry.get(key);
    if (!data) return;
    cur = data; step = 0; servings = 1; ticked = new Set();
    steps = splitSteps(data.recipe.steps);
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.documentElement.classList.add('cooking');
    keepAwake();
    render();
    renderTimers();
    el('cook-next').focus();
  }
  function close() {
    if (timers.some(t => !t.done) && !confirm('Un minuteur tourne encore. Quitter le mode cuisine ?')) return;
    sheet.hidden = true;
    document.documentElement.classList.remove('cooking');
    timers = []; renderTimers();
    releaseAwake();
    lastFocus?.focus?.();
  }

  // ---------- Événements
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-cook]');
    if (b) { e.preventDefault(); open(b.dataset.cook); }
  });
  el('cook-close').addEventListener('click', close);
  el('cook-prev').addEventListener('click', () => go(step - 1));
  el('cook-next').addEventListener('click', () => go(step + 1));
  sheet.addEventListener('click', e => {
    const ing = e.target.closest('[data-ing]');
    if (ing) { const k = Number(ing.dataset.ing); ticked.has(k) ? ticked.delete(k) : ticked.add(k); render(); return; }
    const sv = e.target.closest('[data-serv]');
    if (sv) { servings = Math.max(1, Math.min(8, servings + Number(sv.dataset.serv))); render(); return; }
    const st = e.target.closest('[data-start]');
    if (st) { startTimer(Number(st.dataset.start), st.dataset.label); return; }
    const x = e.target.closest('[data-timer-stop]');
    if (x) { timers = timers.filter(t => String(t.id) !== x.dataset.timerStop); renderTimers(); return; }
    if (e.target.closest('[data-cook-love]')) {
      rateRecipe(cur.recipe.id, 'love'); // second clic : annule
      render();
    }
  });
  document.addEventListener('keydown', e => {
    if (sheet.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') go(step + 1);
    else if (e.key === 'ArrowLeft') go(step - 1);
  });

  // Glisser vers la gauche / la droite pour changer d'étape
  let sx = null, sy = null;
  el('cook-body').addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  el('cook-body').addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    sx = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(step + (dx < 0 ? 1 : -1));
  }, { passive: true });

  window.cookIsOpen = () => !sheet.hidden;
})();
