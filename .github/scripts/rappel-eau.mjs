// ============================================================
//  Rappels pour boire de l'eau : envoi des notifications push
//  Lancé par GitHub Actions toutes les heures (.github/workflows/rappels-eau.yml).
//
//  Secrets GitHub nécessaires (Settings → Secrets and variables → Actions) :
//    VAPID_PRIVATE_KEY   clé privée VAPID (ne jamais la publier)
//    PUSH_SUBSCRIPTIONS  codes d'abonnement copiés depuis l'appli, séparés par des retours à la ligne
//                        (un par téléphone)
// ============================================================
import webpush from 'web-push';

// Clé publique : la même que dans app.js (elle peut être publique)
const VAPID_PUBLIC_KEY = 'BGBCOspq8oPslC0c4yFnDw7d2UuhCt5QAZx_wDGNO3_oK1xw0NDx6E_IkhXAcr2rPLhrz_-WTXAM24FMpGoWemc';
const APP_URL = 'https://lolabodoin-design.github.io/Appli-meal-/';

// Heures d'envoi (heure de Paris) selon le rythme choisi dans l'appli
const SCHEDULES = {
  '4x': [9, 12, 15, 18],
  hourly: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
};

const MESSAGES = {
  9: "Bonjour ! Un grand verre d'eau pour bien démarrer la journée ☀️",
  10: "Petite gorgée ? L'hydratation aide à rester concentré(e) 🧠",
  11: "Un verre d'eau avant le déjeuner, ça aide aussi à mieux écouter sa faim.",
  12: "Pause déjeuner : pense à boire un verre d'eau avec ton repas 🥗",
  13: "Après le repas, un verre d'eau aide la digestion.",
  14: "Coup de barre de 14 h ? Parfois, c'est juste la soif 💧",
  15: "Petit coup de mou ? Un verre d'eau !",
  16: "L'heure du goûter : une collation et un verre d'eau 🍎",
  17: "Tu en es où de ton objectif d'eau aujourd'hui ?",
  18: "Fin de journée : un verre d'eau pour compenser la journée 💪",
  19: "Un verre d'eau pendant que le dîner cuit ? 🍲",
  20: "Dernière ligne droite : encore un verre d'eau ?",
  21: "Dernier rappel de la journée : un petit verre d'eau et bonne soirée 🌙",
};

// Heure actuelle à Paris (gère automatiquement l'heure d'été / d'hiver)
const parisHour = Number(new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', hour12: false, timeZone: 'Europe/Paris' }).format(new Date()));
const manual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch'; // bouton « Run workflow » : envoi de test

const privateKey = process.env.VAPID_PRIVATE_KEY;
if (!privateKey) {
  // Pas encore configuré : on s'arrête sans erreur (évite un e-mail d'échec toutes les heures)
  console.log('Secret VAPID_PRIVATE_KEY pas encore ajouté : aucun rappel envoyé.');
  process.exit(0);
}
webpush.setVapidDetails(APP_URL, VAPID_PUBLIC_KEY, privateKey.trim());

// Un code d'abonnement par ligne (ou un tableau JSON)
const raw = (process.env.PUSH_SUBSCRIPTIONS || '').trim();
let entries = [];
try {
  entries = raw.startsWith('[') ? JSON.parse(raw) : raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
} catch (e) {
  console.error('Secret PUSH_SUBSCRIPTIONS illisible : recopie les codes depuis l\'appli.', e.message);
  process.exit(1);
}
if (!entries.length) {
  console.log('Aucun téléphone abonné pour l\'instant.');
  process.exit(0);
}

let sent = 0;
for (const entry of entries) {
  const { subscription, rythme = '4x', prenom = '' } = entry;
  const hours = SCHEDULES[rythme] || SCHEDULES['4x'];
  if (!manual && !hours.includes(parisHour)) continue;

  const body = manual
    ? '✅ Test réussi : les rappels d\'eau fonctionnent !'
    : MESSAGES[parisHour] || "Pense à boire un verre d'eau 💧";
  const payload = JSON.stringify({
    title: prenom ? `💧 ${prenom}, un verre d'eau ?` : "💧 Un verre d'eau ?",
    body,
    url: APP_URL,
  });
  try {
    await webpush.sendNotification(subscription, payload, { TTL: 3600, urgency: 'normal' });
    sent++;
    console.log(`Envoyé à ${prenom || 'un téléphone'} (${rythme}) à ${parisHour} h.`);
  } catch (err) {
    // 404 / 410 : abonnement expiré (appli supprimée, notifications désactivées…)
    console.error(`Échec pour ${prenom || 'un téléphone'} : ${err.statusCode || ''} ${err.body || err.message}`);
  }
}
console.log(`${sent} notification(s) envoyée(s) — il est ${parisHour} h à Paris.`);
