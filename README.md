# Menu Protéiné

Application web qui génère un **menu sain et riche en protéines pour 7 jours**, en respectant un objectif de calories et de macronutriments, puis produit la **liste de courses** de la semaine avec des liens vers **Leclerc Drive**.

## Lancer l'application

- **Sur l'ordinateur** : double-cliquer sur `index.html`. Les données restent dans le navigateur (`localStorage`).
- **En ligne** : l'appli est publiée avec GitHub Pages (Settings → Pages → branche `main`, dossier `/`).
- **Sur le téléphone (appli installable / PWA)** : ouvrir le lien GitHub Pages, puis
  - iPhone : Safari → Partager → « Sur l'écran d'accueil » ;
  - Android : Chrome → ⋮ → « Installer l'application ».

  L'appli s'ouvre alors en plein écran avec son icône 🥑 et fonctionne **hors connexion** (menu, recettes, liste de courses). Open Food Facts et le stock Drive demandent internet.

### Mettre à jour l'appli publiée

1. Modifier les fichiers.
2. **Changer `VERSION` dans `service-worker.js`** (ex. `v1.0.0` → `v1.1.0`). Sans ça, les téléphones garderaient l'ancienne version en cache.
3. Envoyer sur GitHub (commit + push). GitHub Pages republie le site en ~1 minute.
4. À la prochaine ouverture avec internet, l'appli affiche « ✨ Nouvelle version disponible » → « Mettre à jour ».

Les données de chaque appareil (profils, menu, cases cochées) sont conservées pendant les mises à jour, mais ne sont pas synchronisées entre appareils.

## Fonctionnalités

1. **Le foyer (2 profils)** : Lola et Barnabé ont chacun leurs mensurations, leur objectif et leurs cibles de calories et de macros (recalcul automatique par Mifflin-St Jeor dès qu'on change une mensuration ou l'objectif, puis ajustable à la main). Objectifs : perte de gras (−20 % kcal, 2 g de protéines/kg), **recomposition corporelle** (−10 % kcal, 2,2 g/kg), maintien (1,6 g/kg), prise de muscle (+10 % kcal, 2 g/kg). Chaque personne a aussi son **régime** et choisit si elle prend une collation. Les mensurations se saisissent une seule fois : après « Enregistrer », le profil s'affiche en résumé (bouton « Modifier » pour y revenir).
2. **Préférences communes** : temps en cuisine les soirs de semaine (express 15 min, normal 30 min, sans limite) et **budget courses en tranches d'euros** (moins de 90 €, 90-120 €, 120-150 €, 150-180 € par semaine, ou sans limite). Chaque ingrédient a un prix indicatif en €/kg (`PRICES` dans `data.js`), remplacé par le prix réel du Drive après la vérification du stock. L'algorithme pénalise les journées qui dépassent leur part du budget, et l'appli affiche le coût estimé de la semaine ainsi que l'estimation en caisse (paquets entiers).
   - Le régime **anti-inflammatoire** ne garde que les recettes marquées 🌿 : poissons gras riches en oméga-3 (saumon, sardines), noix, fruits rouges, légumes verts, légumineuses, curcuma et huile d'olive. Il exclut la viande rouge, la charcuterie et les sucres ajoutés.
3. **Quiz « Nos envies de la semaine »** (5 questions puis un récapitulatif) :
   - **Ambiance** (frais, réconfortant, épicé, iodé, végétal) : ces recettes sortent plus souvent.
   - **Sorties** (resto ou soirée, jour par jour) : pas de dîner à cuisiner. Le repas pris dehors est estimé (40 % des calories du jour pour un resto, 50 % pour une soirée) et les autres repas du jour sont réduits d'autant. **Le lendemain d'une soirée**, journée « récup » : recettes hydratantes et digestes (bouillon, soupe miso, poisson, smoothies…), −10 % de calories et −20 % de lipides.
   - **Midi en semaine** : à la maison, en lunch box (plats transportables) ou à la cantine (déjeuner estimé, non cuisiné).
   - **Pas envie de…** : poisson et fruits de mer, viande, tofu, œufs, produits laitiers, légumineuses, protéine en poudre, **plus n'importe quel aliment tapé librement** (ex. « brocolis » → écarte les recettes qui contiennent du brocoli).
   - **Petit plaisir** : un dîner gourmand (burger maison, pizza, fajitas…) le soir choisi, toujours calé sur les macros.
4. **Menu de la semaine** : les **mêmes recettes pour tout le foyer**, mais des **portions différentes pour chacun**. Si une recette ne convient pas au régime de quelqu'un, il reçoit **sa propre variante** pour ce repas. Chaque recette affiche un tableau Lola / Barnabé / « À cuisiner » (le total à préparer), et des jauges comparent chaque journée aux objectifs de chaque personne.
   - 🔄 **changer** remplace un repas et rééquilibre les portions de la journée.
   - 🎲 **journée** régénère une journée entière.
5. **Vrais produits (Open Food Facts)** : dans la liste de courses, le bouton « 🔎 Produits réels » affiche les produits les plus scannés en France pour chaque ingrédient, avec la marque, le Nutri-Score et les valeurs pour 100 g. On choisit son produit : le lien Leclerc Drive cherche alors ce produit précis. Une option permet de recalculer les portions avec les valeurs réelles des produits choisis.
6. **Liste de courses** : les ingrédients sont additionnés sur la semaine, regroupés par rayon et convertis en conditionnements du commerce (barquettes, pots, pièces). Pour chaque produit, un bouton lance la recherche dans **ton magasin Leclerc Drive**. On peut aussi copier la liste, la télécharger en .txt ou l'imprimer.

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | Structure de la page |
| `style.css` | Mise en forme : thème « healthy », polices Fredoka et Nunito, mode clair/sombre, mobile, impression |
| `bg-pattern.svg` | Motif de fond : fruits et légumes dessinés |
| `data.js` | Base de données : 70 ingrédients (valeurs pour 100 g), 77 recettes (17 petits-déjeuners, 47 plats, 13 collations ; au moins 8 choix par type de repas pour chaque régime) et les étiquettes du quiz |
| `drive-stock.js` | Favori « Stock Drive » : vérifie le stock réel du magasin Leclerc Drive |
| `manifest.json`, `service-worker.js`, `icons/` | Appli installable (PWA) : nom, icône, mode hors connexion, mises à jour |
| `fonts.css`, `fonts/` | Polices Fredoka et Nunito en local (licence OFL) pour le mode hors connexion |
| `app.js` | Logique : calcul des besoins, optimisation, Open Food Facts, affichage, liste de courses |

## Algorithme de planification

Pour chaque jour :
1. On construit le squelette de la journée d'après le quiz (repas pris dehors, lendemain de soirée, lunch box, plaisir), puis on tire des recettes parmi celles autorisées. Le tirage est pondéré : ×3 pour une recette qui correspond aux envies, ×0,25 pour une recette chère en budget économique.
2. On retire des objectifs du jour ce qu'apportent les repas pris dehors. Puis, pour **chaque personne**, on calcule un **facteur de portion** par repas (borné, par exemple entre ×0,6 et ×2,6 pour un plat) qui minimise l'écart aux objectifs, par **moindres carrés pondérés** : calories ×3, protéines ×2, glucides et lipides ×1. La résolution se fait par descente par coordonnées.
3. Un terme d'**équilibre** garde les portions d'une personne proches entre elles (pas de déjeuner énorme suivi d'un dîner minuscule).
4. On ajoute une **pénalité de variété** (un plat déjà servi dans la semaine est fortement pénalisé) et un **équilibre des sources de protéines** (viande / poisson / végétal).
5. On répète 500 fois et on garde la combinaison qui minimise la somme des écarts des deux personnes.

Les quantités sont ensuite arrondies à 5 g près (ou à l'unité pour les œufs et les tortillas), et les totaux affichés sont recalculés sur ces quantités arrondies.

## Intégration Open Food Facts

[Open Food Facts](https://fr.openfoodfacts.org) est une base collaborative, libre et gratuite, de produits alimentaires. Son API est publique et ne demande aucune clé.

- **Recherche par catégorie officielle** : chaque ingrédient de `data.js` est relié à une catégorie de la taxonomie Open Food Facts (par exemple `en:plain-skyrs` ou `en:chicken-breasts`). C'est bien plus précis qu'une recherche texte, qui renvoyait par exemple du fromage blanc pour « skyr ».
- Requête : `https://world.openfoodfacts.org/cgi/search.pl`, filtrée sur la catégorie et sur les produits vendus en France, triée par popularité (nombre de scans).
- **Limite de l'API** : environ 10 recherches par minute. L'appli ne cherche donc qu'à la demande, garde les résultats 7 jours en cache (`localStorage`) et affiche un message si le serveur est saturé.
- Les produits frais sans emballage (fruits et légumes) n'ont pas de fiche : ils sont marqués « 🥬 Produit frais ».

## Stock réel du Drive (favori « 🥑 Stock Drive »)

Le site Leclerc Drive n'a pas d'API publique et il est protégé par un anti-robot (DataDome). Un script extérieur (Python, GitHub Actions…) reçoit une erreur 403. En revanche, les pages de recherche d'un magasin contiennent, pour chaque produit, le **stock réel** (`iQteDisponible`), le prix, le prix au kilo et la contenance.

La solution est un **favori** (bookmarklet), créé à partir de `drive-stock.js`, que l'utilisateur lance lui-même sur la page de son magasin :
1. dans l'appli, « 📋 Copier la liste pour le Drive » copie la liste de courses au format JSON ;
2. sur le Drive, le favori ouvre une fenêtre où l'on colle cette liste ;
3. pour chaque ingrédient, il charge la page de recherche du magasin (**une recherche toutes les 3 s**, dans la session de l'utilisateur), garde les produits dont le nom correspond aux mots recherchés, écarte ceux en rupture, choisit **le moins cher au kilo** et calcule le nombre de paquets à partir de la contenance ;
4. il affiche la liste avec les prix et le total, puis on colle le résultat dans l'appli ;
5. l'appli montre le produit, le prix et le stock sous chaque ingrédient. Le bouton « 🔁 Adapter le menu au stock » **régénère le menu sans les ingrédients en rupture**.

Le favori **n'ajoute rien au panier**, et il s'arrête dès que le site demande une vérification anti-robot, sans chercher à la contourner. Test réel sur le Drive de Clermont-Ferrand (magasin 016301) : skyr nature → 2 × Délisse 850 g à 2,60 € (12 en stock) ; œufs → 2 × 10 œufs plein air bio à 3,41 € (140 en stock).

## Intégration Leclerc Drive : choix et limites

Leclerc Drive ne propose **pas d'API publique** pour gérer le panier. L'application construit donc des liens de recherche vers le magasin choisi, au format `https://fdX-courses.leclercdrive.fr/magasin-XXXXXX-Ville/recherche.aspx?TexteRecherche=<produit>`. L'utilisateur clique, choisit le produit (marque, prix) et l'ajoute lui-même au panier.

Ce choix est volontaire :
- **Légal** : pas de scraping ni d'automatisation contraire aux CGU.
- **Sécurisé** : l'application ne manipule jamais les identifiants Leclerc.
- **Robuste** : les liens continuent de fonctionner même si l'interface du site change.

**Piste d'évolution** : automatiser l'ajout au panier avec Playwright (l'utilisateur se connecte lui-même, puis le script recherche et ajoute chaque produit). C'est plus fragile, et c'est à vérifier au regard des CGU.

## Sources

Valeurs nutritionnelles indicatives, d'après la table [Ciqual (ANSES)](https://ciqual.anses.fr/) et des étiquettes courantes.
