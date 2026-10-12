# 1. Sujet & Concept du Projet

## Fiche d'identité
- **Titre du jeu** : Table Clicker Puzzle
- **Genre** : Jeu incrémentiel / Clicker / Puzzle
- **Public cible / Niveau de code** : Débutant en programmation (HTML, CSS, JavaScript Vanilla).
- **Style visuel** : Design épuré sans assets images, fond sombres façon table de jeu/tapis de découpe, mis en valeur par une touche **Rose Flashy (`#F60887`)**.

---

## Concept Général
**Table Clicker Puzzle** est un jeu d'incrémentation où le joueur clique pour fabriquer et poser des pièces de puzzle sur une table virtuelle. L'objectif est de compléter des puzzles successifs de plus en plus grands ($3\times3$, $4\times4$, $5\times5$, etc.) tout en achetant des améliorations pour automatiser et accélérer la production de pièces.

---

## Déroulement du Jeu (Gameplay Loop)

1. **Clics Manuels** :
   - Le joueur clique sur la zone de jeu pour générer un nombre $N$ de pièces.
   - Les pièces générées viennent remplir la grille de puzzle active case par case.

2. **Complétion du Puzzle** :
   - Dès que $100\%$ des cases du puzzle actuel sont remplies :
     - Le compteur de puzzles résolus augmente de $+1$.
     - La taille du puzzle suivant augmente (ex. 9 pièces, puis 16, 25, 36, etc.).
     - Le joueur reçoit une prime de pièces bonus.

3. **Monnaie & Boutique d'Améliorations** :
   - Les pièces générées permettent d'acheter des améliorations (Upgrades) dans le panneau latéral.
   - Les améliorations augmentent la quantité de pièces par clic, la production automatique par seconde ou apportent des effets spéciaux.

4. **Équilibre & Progression** :
   - Le coût des améliorations augmente à chaque achat.
   - La progression reste satisfaisante grâce au déblocage rapide des premiers automatismes.

---

## Contraintes Majeures à Respecter

1. **Intégration d'une musique de fond** :
   - Ajout d'une musique d'ambiance via une balise `<audio>` HTML5.
   - Bouton Mute/Unmute ou Démarrer la musique pour respecter les contraintes des navigateurs (politique d'autostart).
2. **Couleur Thématique Rose Flashy (`#F60887`)** :
   - Utilisée pour les éléments interactifs (boutons d'action, pièces complétées actives, bordures d'accentuation, jauges de progression).
3. **Zéro Erreur Console** :
   - Code JavaScript propre et défensif (vérification de la présence des éléments dans le DOM avant manipulation, gestion des événements sans exceptions unhandled).
