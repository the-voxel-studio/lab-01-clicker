# 3. Catalogue des Améliorations (Upgrades) & Équilibrage Economique

Ce document répertorie l'ensemble des améliorations disponibles dans la boutique du jeu **Table Clicker Puzzle** ainsi que le modèle d'équilibrage économique adapté à la courbe de difficulté du jeu.

---

## Principes d'Équilibrage de la Progression

### Échelle de Difficulté des Puzzles
Comme les premiers puzzles sont de petite taille ($2\times2 = 4$ pièces, $3\times3 = 9$ pièces, $4\times4 = 16$ pièces), les premiers niveaux se terminent très rapidement. Pour éviter qu'un joueur ne débloque toutes les améliorations majeures en moins d'une minute :
1. **Première phase (Pièces)** : Les achats en pièces (ex: Doigts agiles, Assembleur auto) permettent de démarrer rapidement la boucle d'incrémentation.
2. **Seconde phase (Puzzles résolus)** : Les améliorations fonctionnant avec la monnaie "Puzzles résolus" requièrent d'avoir accumulé plusieurs puzzles (ex: 5, 10, 15 puzzles). Leurs coûts augmentent également de manière significative pour imposer un vrai choix stratégique (style Tycoon / Tree).

---

## Liste des Améliorations (Upgrades Rééquilibrées)

### 1. 👆 Doigts agiles
- **Type** : Clic Manuel
- **Effet** : Augmente le nombre de pièces posées à chaque clic manuel (+1 pièce par niveau).
- **Coût initial** : 15 Pièces
- **Type de monnaie** : Pièces
- **Multiplicateur de coût** : $\times 1.6$ par niveau

---

### 2. ⚡ Cadence de tir (Vitesse de Clic)
- **Type** : Vitesse / Cooldown
- **Effet** : Réduit le délai de recharge entre deux clics manuels (-10% de temps d'attente par niveau).
- **Coût initial** : 50 Pièces
- **Type de monnaie** : Pièces
- **Multiplicateur de coût** : $\times 2.0$ par niveau

---

### 3. 🤖 Assembleur auto
- **Type** : Automatisation / Passive
- **Effet** : Pose automatiquement un nombre fixe de pièces par seconde (+1 pièce/s par niveau).
- **Coût initial** : 100 Pièces
- **Type de monnaie** : Pièces
- **Multiplicateur de coût** : $\times 1.7$ par niveau

---

### 4. ⏱️ Cadence de tri
- **Type** : Automatisation / Fréquence
- **Effet** : Augmente la fréquence des ticks de la boucle automatique pour accélérer la pose passive des pièces.
- **Coût initial** : 250 Pièces
- **Type de monnaie** : Pièces
- **Multiplicateur de coût** : $\times 2.2$ par niveau

---

### 5. 👁️ Coup d'œil (Coup Critique)
- **Type** : Probabilité / Chance
- **Effet** : Augmente les chances (+5% par niveau) d'effectuer un "clic parfait" rapportant $5\times$ la valeur normale d'un clic.
- **Coût initial** : 500 Pièces
- **Type de monnaie** : Pièces
- **Multiplicateur de coût** : $\times 2.5$ par niveau

---

### 6. 📐 Manœuvre des bords
- **Type** : Spécial / Démarrage
- **Effet** : Pose automatiquement le contour complet du puzzle ($20\%$ du total des pièces) immédiatement au début de chaque nouveau puzzle.
- **Coût initial** : 5 Puzzles résolus
- **Type de monnaie** : Puzzles résolus
- **Augmentation du coût** : $+5$ Puzzles par niveau

---

### 7. 🧪 Colle à prise rapide
- **Type** : Boost Temporaire
- **Effet** : Multiplie par 2 toute la production de pièces pendant 15 secondes immédiatement après la complétion d'un puzzle.
- **Coût initial** : 10 Puzzles résolus
- **Type de monnaie** : Puzzles résolus
- **Augmentation du coût** : $+10$ Puzzles par niveau

---

### 8. 📦 Boîte de transfert
- **Type** : Optimisation / Surplus
- **Effet** : Conserve le surplus de pièces généré par le clic final qui valide un puzzle et l'applique directement au puzzle suivant.
- **Coût initial** : 15 Puzzles résolus
- **Type de monnaie** : Puzzles résolus
- **Augmentation du coût** : $+15$ Puzzles par niveau

---

## Synthèse du Barème des Prix & Progression

| Emoji | Nom de l'Upgrade | Monnaie | Coût Initial | Progression du Coût | Effet Principal |
| :---: | :--- | :---: | :---: | :---: | :--- |
| 👆 | **Doigts agiles** | Pièces | 15 | $\times 1.6$ / niveau | +1 pièce / clic |
| ⚡ | **Cadence de tir** | Pièces | 50 | $\times 2.0$ / niveau | Réduit le temps entre clics |
| 🤖 | **Assembleur auto** | Pièces | 100 | $\times 1.7$ / niveau | +1 pièce / seconde |
| ⏱️ | **Cadence de tri** | Pièces | 250 | $\times 2.2$ / niveau | Accélère la boucle auto |
| 👁️ | **Coup d'œil** | Pièces | 500 | $\times 2.5$ / niveau | +5% chance de Clic Critique ($5\times$) |
| 📐 | **Manœuvre des bords** | Puzzles | 5 | $+5$ Puzzles / niveau | 20% du puzzle rempli au départ |
| 🧪 | **Colle à prise rapide**| Puzzles | 10 | $+10$ Puzzles / niveau | Double la production pendant 15s |
| 📦 | **Boîte de transfert** | Puzzles | 15 | $+15$ Puzzles / niveau | Conserve le surplus de pièces |
