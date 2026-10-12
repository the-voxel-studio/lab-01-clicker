# Consignes & Règles Générales pour les Agents IA (Projet Clicker Game)

Ce fichier définit les directives obligatoires que tout agent IA (Antigravity / Gemini / Copilot / etc.) doit impérativement respecter sur ce projet.

---

## 1. Périmètre de Travail & Branches
- **Branche & Dossier** : Travailler uniquement sur la branche `celia` et à l'intérieur du dossier `celia/`.
- Ne jamais intervenir, modifier ou inspecter les dossiers ou branches des autres participants (`armand`, `marius`, etc.).

---

## 2. Déroulement du Projet & Interaction avec l'Utilisateur
- **Progression Phase par Phase** :
  - Toujours suivre le plan d'action défini dans `celia/Documents/02_Plan_d_Action_de_Developpement.md`.
  - Ne démarrer une phase que lorsque l'utilisateur la demande explicitement.
  - Ne jamais devancer, sauter ou combiner des phases sans consigne explicite.
- **Rôle de l'Agent** :
  - Lorsque l'utilisateur demande une phase, l'agent doit :
    1. **Bien expliquer tout ce qu'il fait** de façon claire, pédagogique et structurée.
    2. **Faire le travail à la place de l'utilisateur** en créant et modifiant directement les fichiers dans le dossier `celia/`.

---

## 3. Règle Absolue sur Git
- **INTERDICTION FORMELLE** d'effectuer un `git commit` ou un `git push` sans l'autorisation explicite préalable de l'utilisateur.
- Laisser les fichiers modifiés / non indexés dans l'espace de travail jusqu'à ce que l'utilisateur donne son feu vert pour versionner.

---

## 4. Bonnes Pratiques Techniques

### A. HTML (`index.html`)
- Utiliser la sémantique HTML5 (`<header>`, `<main>`, `<section>`, `<aside>`, `<footer>`) au lieu d'enchaîner des `<div>` neutres.
- Accessibilité :
  - Définir impérativement `type="button"` sur chaque balise `<button>`.
  - Ajouter `aria-label` sur les boutons avec icône ou sans texte visible.
  - Respecter la hiérarchie stricte des titres (`<h1>`, `<h2>`, `<h3>`).
- Séparation stricte : Zéro style inline (`style="..."`), zéro écouteur inline (`onclick="..."`).
- Nommage en `kebab-case` clair et parlant.

### B. CSS (`style.css`)
- Respecter scrupuleusement la contrainte imposée : **Rose Flashy (`#F60887`)** pour les actions principales et éléments interactifs.
- Thème sombre simulant un tapis de découpe / table de puzzle.
- Disposition responsive en 2 colonnes (Flexbox / CSS Grid).
- Propriété `user-select: none;` et `touch-action: manipulation;` pour éviter les sélections involontaires ou les zooms intempestifs lors des clics rapides.

### C. JavaScript (`script.js`) & Architecture MVC
- **Pattern MVC Obligatoire** :
  - **Modèle (Model)** : L'objet `gameState` et la logique de calcul pure (formules de coûts, bonus).
  - **Vue (View)** : Le HTML et la fonction de rendu réactif `updateUI()`.
  - **Contrôleur (Controller)** : Les gestionnaires d'événements et la boucle passive qui reçoivent les actions, mutent le Modèle et rafraîchissent la Vue.
- **Zéro Erreur Console** : Toujours vérifier l'existence des éléments dans le DOM avant manipulation ou ajout d'écouteurs d'événements.
- **État Unique (`gameState`)** : Centraliser l'ensemble des données (ressources, puzzle, statistiques, améliorations, options) dans un seul objet JS.
- **Rendu Réactif** : Séparer strictement la modification des données (`gameState`) et la mise à jour de l'affichage via une fonction dédiée (`updateUI()`).
- Gestion de l'inactivité et du temps hors ligne via `Date.now()` (delta-time).
- Formatage lisible des grands nombres ($1\text{k}$, $1\text{M}$, etc.).

---

## 5. Protocole de Tests & Validation Obligatoire à Chaque Phase
- Avant de déclarer une phase terminée, l'agent doit impérativement exécuter et valider la grille de tests correspondante détaillée dans `celia/Documents/06_Plan_de_Tests_Qualite.md` :
  1. **Tests Unitaires** : Fonctions pures, formules de coûts exponentiels, calculs de bonus/primes, utilitaires de formatage.
  2. **Tests de Composants** : Validation du balisage DOM, accessibilité (`aria-label`, `type="button"`), classes CSS et états des éléments (ex: boutons désactivés si solde insuffisant).
  3. **Tests d'Intégration** : Cohérence de l'ensemble de la boucle (Clic $\to$ incrémentation $\to$ complétion du puzzle $\to$ passage à la taille supérieure $\to$ achat d'upgrades).
  4. **Tests End-to-End (E2E)** : Parcours utilisateur complet d'une session de jeu réelle.
  5. **Tests de Charge & Anti-Spam** : Résistance au spam de clics rapides (50 clics/s sans plantage), reprise fluide après mise en veille de l'onglet (delta-time).
- **Règle Zéro Erreur Console** : Tout test doit obligatoirement être validé avec une console 100% propre (zéro warning, zéro exception).
