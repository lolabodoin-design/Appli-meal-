// =============================================================
//  Partager le menu de la semaine en image (format story 1080 × 1920)
//  Dessin sur un <canvas> : titre, 7 jours × (petit-déj, déjeuner, dîner)
//  avec les assiettes dessinées, puis partage natif (iPhone) ou téléchargement.
// =============================================================
(function () {
  'use strict';
  const el = id => document.getElementById(id);
  const sheet = el('share-sheet');
  if (!sheet) return;

  const W = 1080, H = 1920;
  const C = { bg: '#f8f4ee', card: '#fffdfa', border: '#e6ddd0', text: '#3b2f27', muted: '#8c7e72', title: '#4e3b2f', sage: '#8fa382' };
  const PLATE_VARS = { '--plate-shadow': 'rgba(80,60,40,.07)', '--plate-rim': '#e6dccd', '--plate-well': '#f3ece1', '--plate': '#fffdfa' };
  const COLS = ['petitdej', 'dejeuner', 'diner'];
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  let blob = null, url = null;

  // ---------- Outils de dessin
  function loadImage(src) {
    return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
  }
  function plateImage(recipe) {
    let svg = plateSVG(recipe).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" ');
    for (const [k, v] of Object.entries(PLATE_VARS)) svg = svg.split(`var(${k})`).join(v);
    return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }
  function emptyPlate(ctx, cx, cy, r) {
    ctx.fillStyle = PLATE_VARS['--plate-shadow']; ctx.beginPath(); ctx.arc(cx + r * 0.03, cy + r * 0.06, r * 0.92, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.card; ctx.strokeStyle = PLATE_VARS['--plate-rim']; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2); ctx.stroke();
  }
  // Texte centré sur 2 lignes maximum, avec « … » si besoin
  function wrapText(ctx, text, cx, y, maxW, lineH, maxLines = 2) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      lines.length = maxLines;
      let last = lines[maxLines - 1];
      while (ctx.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1);
      lines[maxLines - 1] = last.replace(/[\s,&]+$/, '') + '…';
    }
    lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH));
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function weekLabel() {
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return monday.getMonth() === sunday.getMonth()
      ? `du ${monday.getDate()} au ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`
      : `du ${monday.getDate()} ${MONTHS[monday.getMonth()]} au ${sunday.getDate()} ${MONTHS[sunday.getMonth()]}`;
  }

  // ---------- L'image du menu
  async function drawMenu() {
    const serif = '"DM Serif Display", Georgia, serif', sans = '"DM Sans", system-ui, sans-serif';
    try { await Promise.all([document.fonts.load(`64px ${serif}`), document.fonts.load(`400 24px ${sans}`), document.fonts.load(`500 24px ${sans}`)]); } catch (e) { /* polices système */ }

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

    // En-tête : logo, titre, foyer et dates
    try { const logo = await loadImage('icons/logo.svg'); ctx.drawImage(logo, W / 2 - 46, 58, 92, 92); } catch (e) { /* sans logo */ }
    ctx.fillStyle = C.title; ctx.font = `66px ${serif}`;
    ctx.fillText('Le menu de la semaine', W / 2, 232);
    const names = activePeople().map(p => p.name);
    ctx.fillStyle = C.muted; ctx.font = `400 30px ${sans}`;
    ctx.fillText(`${names.join(' & ')} · ${weekLabel()}`, W / 2, 284);

    // Titres des colonnes
    const x0 = 50, dayW = 190, colW = (W - 2 * x0 - dayW) / 3;
    ctx.font = `500 21px ${sans}`; ctx.fillStyle = C.muted;
    ['PETIT-DÉJ', 'DÉJEUNER', 'DÎNER'].forEach((t, i) => {
      const cx = x0 + dayW + colW * (i + 0.5);
      ctx.save(); ctx.translate(cx, 352);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
      ctx.fillText(t, 0, 0); ctx.restore();
    });

    // Une carte par jour
    const top = 376, rowH = 196, gap = 9;
    for (let d = 0; d < 7; d++) {
      const y = top + d * (rowH + gap);
      roundRect(ctx, x0, y, W - 2 * x0, rowH, 28);
      ctx.fillStyle = C.card; ctx.fill(); ctx.strokeStyle = C.border; ctx.lineWidth = 2; ctx.stroke();

      ctx.textAlign = 'left'; ctx.fillStyle = C.title; ctx.font = `40px ${serif}`;
      ctx.fillText(DAYS[d], x0 + 30, y + rowH / 2 + 14);
      ctx.textAlign = 'center';

      const meals = state.plan[d].meals;
      for (let i = 0; i < COLS.length; i++) {
        const meal = meals.find(m => m.slot === COLS[i]);
        const cx = x0 + dayW + colW * (i + 0.5);
        const pr = 48, py = y + 14 + pr;
        let label = '';
        if (!meal) {
          emptyPlate(ctx, cx, py, pr); label = '—';
        } else if (meal.external) {
          emptyPlate(ctx, cx, py, pr); label = EXTERNAL[meal.external].label;
        } else {
          const recipe = RECIPE_BY_ID[meal.recipeId];
          try { ctx.drawImage(await plateImage(recipe), cx - pr, py - pr, pr * 2, pr * 2); } catch (e) { emptyPlate(ctx, cx, py, pr); }
          label = recipe.name;
        }
        ctx.fillStyle = C.text; ctx.font = `400 21px ${sans}`;
        wrapText(ctx, label, cx, y + 142, colW - 22, 25);
      }
    }

    ctx.fillStyle = C.muted; ctx.font = `400 22px ${sans}`;
    ctx.fillText('Healthy & protéiné · Le menu de la semaine', W / 2, H - 46);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }

  // ---------- Fenêtre d'aperçu et partage
  async function open() {
    if (!state.plan) return;
    sheet.hidden = false;
    el('share-status').textContent = 'Préparation de l\'image…';
    el('share-preview').removeAttribute('src');
    el('btn-share-go').disabled = true;
    blob = await drawMenu();
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    el('share-preview').src = url;
    el('share-dl').href = url;
    el('share-status').textContent = '';
    el('btn-share-go').disabled = false;
    const file = new File([blob], 'menu-de-la-semaine.png', { type: 'image/png' });
    const canShare = !!navigator.canShare && navigator.canShare({ files: [file] });
    el('btn-share-go').hidden = !canShare;
    el('share-dl').classList.toggle('primary', !canShare);
    el('share-dl').classList.toggle('secondary', canShare);
  }
  function close() { sheet.hidden = true; }

  el('btn-share').addEventListener('click', open);
  el('btn-share-close').addEventListener('click', close);
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) close(); });
  el('btn-share-go').addEventListener('click', async () => {
    const file = new File([blob], 'menu-de-la-semaine.png', { type: 'image/png' });
    try {
      await navigator.share({ files: [file], title: 'Le menu de la semaine' });
    } catch (e) {
      if (e.name !== 'AbortError') el('share-status').textContent = 'Partage impossible : utilise « Enregistrer l\'image ».';
    }
  });
})();
