# 4. Points d'Attention & Bonnes Pratiques Négligées (Game Design & Technique)

Pour réussir un jeu vidéo web incrémentiel (clicker / tycoon) de ce style, plusieurs aspects techniques et d'ergonomie sont souvent oubliés lors de la conception initiale. Ce document rassemble tous ces points essentiels pour garantir un jeu fluide, agréable et professionnel.

---

## 1. Ergonomie & "Game Feel" (Juiciness)
Un jeu de clic vit grâce aux retours visuels et sonores immédiats. Sans eux, l'expérience devient rapidement terne.
- **Textes flottants dynamiques (Popups de Clic)** :
  - Générer un petit texte temporaire (`+1`, `+5 CRITIQUE !`) apparaissant exactement sous la position du curseur au moment du clic et s'envolant vers le haut en s'effaçant (`fade-out`).
- **Feedback visuel sur le bouton** :
  - Animation de pression/rebond (`transform: scale(0.95)`) et effet d'onde ou d'étincelles lors du clic.
- **Effets Sonores Courts (SFX)** :
  - En plus de la musique d'ambiance, intégrer des effets sonores très courts et légers : un bruit de "clic/pop" à la pose de pièce, un son de caisse enregistreuse à l'achat d'upgrade, et un jingle de victoire à la complétion d'un puzzle.

---

## 2. Défis Techniques Spécifiques aux Jeux Web

### A. Gestion des Onglets Inactifs & Inactivité (`Delta Time`)
- **Problème** : Les navigateurs web mettent en pause ou ralentissent considérablement les timers JavaScript (`setInterval`, `requestAnimationFrame`) lorsque l'onglet est masqué ou en arrière-plan.
- **Solution** : Ne pas compter les pièces uniquement à chaque tick de timer, mais calculer le temps écoulé depuis la dernière mise à jour via `Date.now()`.
- **Gains Hors-Ligne (Offline Progress)** :
  - Enregistrer l'horodatage (`lastTimestamp`) lors de la fermeture ou de la sauvegarde.
  - Au rechargement du jeu, calculer la différence de temps et créditer automatiquement les pièces passives accumulées pendant l'absence du joueur (avec un popup récapitulatif : *"Pendant votre absence, vous avez gagné 450 pièces !"*).

### B. Anti-Spam & Anti-Autoclicker
- **Problème** : Les joueurs sur ordinateur peuvent utiliser des logiciels d'autoclicker (50 clics/seconde) ou spammer la barre d'espace, ce qui casse la vitesse de progression équilibrée.
- **Solution** :
  - Vérifier l'authenticité de l'événement (`event.isTrusted`).
  - Appliquer un délai de sécurité minimum (throttle/debounce) entre deux enregistrements de clics, coordonné avec le temps de recharge (cooldown).

### C. Formatage des Grands Nombres
- **Problème** : Au fur et me mesure des améliorations, les nombres deviennent géants (ex: `15849204 pièces`), ce qui dépasse l'affichage et devient illisible.
- **Solution** : Utiliser une fonction utilitaire de formatage :
  - $1\,000 \to 1\text{k}$
  - $1\,000\,000 \to 1\text{M}$
  - $1\,000\,000\,000 \to 1\text{B}$

### D. Ergonomie Mobile & Tactile
- **Problème** : Sur smartphone/tablette, cliquer très rapidement provoque souvent un zoom intempestif du navigateur (double-tap to zoom) ou la sélection involontaire du texte.
- **Solution CSS** :
  - Appliquer `touch-action: manipulation;` sur le bouton de clic.
  - Désactiver la sélection de texte sur l'interface de jeu avec `user-select: none;`.

---

## 3. Options de Sauvegarde & Réinitialisation

- **Bouton de Réinitialisation (Hard Reset)** :
  - Permettre au joueur de recommencer une partie à zéro depuis la fenêtre des paramètres (avec un popup de confirmation de sécurité) en cas de besoin.
- **Exportation / Importation de Sauvegarde** :
  - (Optionnel) Permettre de copier/coller sa sauvegarde sous forme de chaîne de caractères codée (base64) pour transférer sa partie sur un autre navigateur ou appareil.
