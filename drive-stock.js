/* ============================================================
   Vérificateur de stock Leclerc Drive
   ------------------------------------------------------------
   Cette fonction est transformée en favori (« bookmarklet ») par l'appli.
   Elle s'exécute sur la page de TON magasin Leclerc Drive, dans ta propre
   session de navigateur :
     1. tu colles la liste de courses copiée depuis l'appli ;
     2. pour chaque ingrédient, elle ouvre la page de recherche du magasin
        (une recherche toutes les 3 s, comme une personne qui cherche) ;
     3. elle lit le stock réel (iQteDisponible), le prix et la contenance,
        choisit le produit en stock le moins cher au kilo et calcule
        combien en acheter ;
     4. elle affiche la liste et te permet de copier le résultat pour l'appli.
   Elle n'ajoute rien au panier et s'arrête si le site demande une vérification.
   Doit rester autonome : aucune dépendance, pas de variable extérieure.
   ============================================================ */
function leclercStockCheck() {
  'use strict';
  var DELAY_MS = 3000;
  var STOPWORDS = ['de', 'du', 'des', 'la', 'le', 'les', 'd', 'l', 'a', 'au', 'aux', 'et', 'en', 'un', 'une', 'pour'];

  if (document.getElementById('mp-stock-host')) return;

  // --- Magasin courant : https://fdX-courses.leclercdrive.fr/magasin-016301-Ville/...
  var seg = location.pathname.match(/^\/(magasin-(\d+)[^/]*)(\/|$)/);
  if (!/(^|\.)leclercdrive\.fr$/.test(location.hostname) || !seg) {
    alert("Ouvre d'abord une page de ton magasin Leclerc Drive (après avoir choisi ton magasin), puis reclique sur ce favori.");
    return;
  }
  // Sur la page d'accueil (magasin-016301-016301-ville.aspx), on reconstruit le chemin du magasin
  var storePath = /\.aspx$/i.test(seg[1]) ? 'magasin-' + seg[2] + '-' + seg[2] : seg[1];
  var base = location.origin + '/' + storePath;

  // --- Outils
  var decoder = document.createElement('textarea');
  function decode(s) { decoder.innerHTML = s || ''; return decoder.value.trim(); }
  function norm(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ');
  }
  function words(s) { return norm(s).split(' ').filter(function (w) { return w.length > 1 && STOPWORDS.indexOf(w) < 0; }); }
  function euros(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' €'; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // Extrait les objets produit ("objElement": {...}) du HTML de la page de recherche
  function extractProducts(html) {
    var out = [], seen = {}, key = '"objElement":', i = 0;
    while ((i = html.indexOf(key, i)) !== -1) {
      var j = i + key.length;
      if (html[j] !== '{') { i = j; continue; }
      var depth = 0, inStr = false, escp = false, k = j;
      for (; k < html.length; k++) {
        var c = html[k];
        if (inStr) { if (escp) escp = false; else if (c === '\\') escp = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) break; }
      }
      try {
        var o = JSON.parse(html.slice(j, k + 1));
        if (o.iIdProduit && !seen[o.iIdProduit]) {
          seen[o.iIdProduit] = 1;
          out.push({
            id: o.iIdProduit,
            nom: decode(o.sLibelleLigne1) + ' ' + decode(o.sLibelleLigne2),
            prix: Number(o.nrPVUnitaireTTC) || 0,
            prix_kg: Number(o.nrPVParUniteDeMesureTTC) || null,
            prix_mesure: decode(o.sPrixParUniteDeMesure),
            stock: Number(o.iQteDisponible) || 0,
            contenance: Number(o.nrContenanceTotale) || 0,
            unite: String(o.sUniteMesureTotale || '').toLowerCase(),
            url: o.sUrlPageProduit || '',
            image: o.sUrlVignetteProduit || '',
          });
        }
      } catch (e) { /* objet illisible : ignoré */ }
      i = k;
    }
    return out;
  }

  // Combien de paquets pour couvrir le besoin ?
  function quantity(p, a) {
    if ((p.unite === 'kg' || p.unite === 'l') && p.contenance > 0 && a.besoin_g) {
      return Math.max(1, Math.ceil(a.besoin_g / (p.contenance * 1000) - 0.1));
    }
    if (p.contenance > 0 && a.piece_g) { // vendu à la pièce (œufs…)
      return Math.max(1, Math.ceil(a.besoin_g / a.piece_g / p.contenance - 0.1));
    }
    return a.nombre || 1;
  }

  // Choix du produit : correspondance avec les mots recherchés, en stock, puis le moins cher au kilo
  function choose(products, a) {
    var terms = words(a.recherche);
    var scored = products.map(function (p) {
      var label = norm(p.nom);
      var hits = terms.filter(function (w) { return label.indexOf(w) >= 0; }).length;
      return { p: p, s: terms.length ? hits / terms.length : 0 };
    }).filter(function (x) { return x.s >= 0.5; });

    var inStock = scored.filter(function (x) { return x.p.stock > 0; });
    if (!inStock.length) return { statut: scored.length ? 'rupture' : 'introuvable', alternatives: [] };

    var bestScore = Math.max.apply(null, inStock.map(function (x) { return x.s; }));
    var pool = inStock.filter(function (x) { return x.s === bestScore; }).map(function (x) { return x.p; });
    pool.sort(function (x, y) { return (x.prix_kg || 1e9) - (y.prix_kg || 1e9) || x.prix - y.prix; });
    var best = pool[0];
    var q = quantity(best, a);
    return {
      statut: 'ok',
      produit: best,
      quantite: q,
      total: Math.round(q * best.prix * 100) / 100,
      alternatives: pool.slice(1, 3).map(function (p) { return { nom: p.nom, prix: p.prix, url: p.url, stock: p.stock }; }),
    };
  }

  // --- Interface (dans un Shadow DOM pour ne pas être gênée par le style du site)
  var host = document.createElement('div');
  host.id = 'mp-stock-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
  document.body.appendChild(host);
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>'
    + '*{box-sizing:border-box;font-family:Nunito,system-ui,sans-serif}'
    + '.bg{position:absolute;inset:0;background:rgba(20,30,24,.55)}'
    + '.box{position:absolute;top:4vh;left:50%;transform:translateX(-50%);width:min(860px,94vw);max-height:92vh;overflow:auto;background:#fbf6ea;color:#24332a;border-radius:24px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)}'
    + 'h2{margin:0 0 4px;font-size:22px}p{margin:6px 0;font-size:14px}.muted{color:#6b7a70}'
    + 'textarea{width:100%;height:120px;border:2px solid #e8e2d0;border-radius:14px;padding:10px;font:12px monospace;background:#fff}'
    + 'button{cursor:pointer;border:none;border-radius:999px;padding:10px 18px;font-weight:800;font-size:14px;margin:8px 8px 0 0}'
    + '.go{background:#3a9d5d;color:#fff}.ghost{background:#efeadb;color:#24332a}'
    + '.bar{height:10px;background:#e8e2d0;border-radius:99px;overflow:hidden;margin:10px 0}.fill{height:100%;width:0;background:#3a9d5d;transition:width .3s}'
    + 'table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}td,th{padding:7px 6px;border-bottom:1px solid #e8e2d0;text-align:left;vertical-align:top}'
    + 'th{font-size:12px;color:#6b7a70}.r{text-align:right;white-space:nowrap}a{color:#23703f;font-weight:700}'
    + '.tot{font-size:18px;font-weight:800;margin-top:12px}.warn{color:#b8650b;font-weight:700}.x{position:absolute;top:14px;right:18px;background:none;font-size:20px}'
    + '</style>'
    + '<div class="bg"></div><div class="box"><button class="x" title="Fermer">✕</button>'
    + '<h2>🥑 Menu Protéiné · stock du Drive</h2>'
    + '<p class="muted">Magasin : ' + esc(storePath) + '</p><div id="body"></div></div>';
  var body = root.getElementById('body');
  var stopped = false;
  function close() { stopped = true; host.remove(); }
  root.querySelector('.x').onclick = close;
  root.querySelector('.bg').onclick = close;

  function showInput(msg) {
    body.innerHTML = '<p>Colle ici la liste copiée depuis l\'appli (bouton « 📋 Copier la liste pour le Drive ») :</p>'
      + (msg ? '<p class="warn">' + esc(msg) + '</p>' : '')
      + '<textarea id="in" placeholder=\'{"v":1,"articles":[...]}\'></textarea>'
      + '<button class="go" id="run">Vérifier le stock</button>';
    root.getElementById('run').onclick = function () {
      var data;
      try { data = JSON.parse(root.getElementById('in').value); } catch (e) { data = null; }
      if (!data || !data.articles || !data.articles.length) { showInput('Liste illisible : recopie-la depuis l\'appli.'); return; }
      run(data.articles);
    };
  }

  async function run(articles) {
    var results = {};
    body.innerHTML = '<p id="st">Préparation…</p><div class="bar"><div class="fill" id="fill"></div></div>'
      + '<p class="muted">Une recherche toutes les ' + DELAY_MS / 1000 + ' s pour ne pas surcharger le site. Tu peux laisser l\'onglet ouvert.</p>'
      + '<button class="ghost" id="stop">Arrêter</button>';
    root.getElementById('stop').onclick = function () { stopped = true; };

    for (var n = 0; n < articles.length && !stopped; n++) {
      var a = articles[n];
      root.getElementById('st').textContent = (n + 1) + ' / ' + articles.length + ' : ' + a.ingredient + '…';
      root.getElementById('fill').style.width = Math.round((n / articles.length) * 100) + '%';
      try {
        var res = await fetch(base + '/recherche.aspx?TexteRecherche=' + encodeURIComponent(a.recherche), { credentials: 'include' });
        var html = await res.text();
        if (!res.ok || (html.indexOf('"objElement"') < 0 && /captcha|datadome/i.test(html))) {
          // Le site demande une vérification : on s'arrête, sans jamais la contourner
          showResults(articles, results, 'Le site Leclerc demande une vérification (anti-robot). La recherche est arrêtée : recharge la page du Drive, attends quelques minutes, puis relance.');
          return;
        }
        var r = choose(extractProducts(html), a);
        r.ingredient = a.ingredient;
        r.recherche = a.recherche;
        results[a.id] = r;
      } catch (e) {
        results[a.id] = { statut: 'erreur', ingredient: a.ingredient, recherche: a.recherche, alternatives: [] };
      }
      if (n < articles.length - 1) await sleep(DELAY_MS);
    }
    showResults(articles, results, stopped ? 'Recherche arrêtée avant la fin.' : '');
  }

  function showResults(articles, results, msg) {
    var total = 0, ok = 0, ko = 0;
    var rows = articles.filter(function (a) { return results[a.id]; }).map(function (a) {
      var r = results[a.id];
      if (r.statut === 'ok') {
        ok++; total += r.total;
        return '<tr><td>✅</td><td><b>' + esc(a.ingredient) + '</b><br><span class="muted">' + esc(a.a_acheter || '') + '</span></td>'
          + '<td><a href="' + esc(r.produit.url) + '" target="_blank">' + esc(r.produit.nom) + '</a><br><span class="muted">'
          + esc(r.produit.prix_mesure || '') + ' · ' + r.produit.stock + ' en stock</span></td>'
          + '<td class="r">' + r.quantite + ' × ' + euros(r.produit.prix) + '<br><b>' + euros(r.total) + '</b></td></tr>';
      }
      ko++;
      var label = { rupture: ['❌', 'En rupture'], introuvable: ['❓', 'Introuvable'], erreur: ['⚠️', 'Erreur de chargement'] }[r.statut];
      return '<tr><td>' + label[0] + '</td><td><b>' + esc(a.ingredient) + '</b></td><td class="warn">' + label[1]
        + ' <a href="' + esc(base + '/recherche.aspx?TexteRecherche=' + encodeURIComponent(a.recherche)) + '" target="_blank">voir la recherche</a></td><td></td></tr>';
    }).join('');

    var payload = JSON.stringify({ v: 1, type: 'stock-drive', magasin: base, date: new Date().toISOString(), resultats: results });
    body.innerHTML = (msg ? '<p class="warn">' + esc(msg) + '</p>' : '')
      + '<p><b>' + ok + '</b> produits en stock · <b>' + ko + '</b> à remplacer</p>'
      + '<div class="tot">Total estimé : ' + euros(total) + '</div>'
      + '<button class="go" id="copy">📋 Copier le résultat pour l\'appli</button><button class="ghost" id="again">Recommencer</button>'
      + '<table><tr><th></th><th>Ingrédient</th><th>Produit du Drive (en stock, le moins cher au kilo)</th><th class="r">Prix</th></tr>' + rows + '</table>'
      + '<p class="muted">Clique sur un produit pour l\'ouvrir et l\'ajouter toi-même au panier.</p>';
    root.getElementById('copy').onclick = function (e) {
      navigator.clipboard.writeText(payload).then(function () { e.target.textContent = '✅ Copié ! Colle-le dans l\'appli'; },
        function () { root.getElementById('in2') || body.insertAdjacentHTML('beforeend', '<textarea id="in2"></textarea>'); root.getElementById('in2').value = payload; root.getElementById('in2').select(); });
    };
    root.getElementById('again').onclick = function () { stopped = false; showInput(''); };
  }

  showInput('');
}
