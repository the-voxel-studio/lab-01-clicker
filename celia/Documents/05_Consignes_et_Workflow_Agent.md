# 5. Consignes de Travail & Règles pour les Agents IA

Ce document résume le fonctionnement et la méthodologie de travail attendus de la part des assistants et agents IA intervenant sur le prototype de Célia.

---

## 1. Mode de Fonctionnement & Rôle de l'Agent
- **Avancement Phase par Phase** :
  - Suivre strictement l'ordre établi dans [02_Plan_d_Action_de_Developpement.md](./02_Plan_d_Action_de_Developpement.md).
  - Travailler uniquement sur la phase demandée par l'utilisateur.
  - Attendre la validation de l'utilisateur avant d'enchaîner sur la phase suivante.
- **Rôle Actif & Pédagogique** :
  - Expliquer clairement, simplement et pas à pas tout ce qui est réalisé.
  - Implémenter directement le code à la place de l'utilisateur dans les fichiers du dossier `celia/`.

---

## 2. Branche & Isolation
- **Branche active** : `celia`.
- **Dossier de travail** : `celia/`.
- Ne pas toucher aux fichiers ni aux branches des autres collaborateurs du lab.

---

## 3. Règle Git Absolue
> **Ne jamais commiter (`git commit`) ni pousser (`git push`) sans la permission expresse de l'utilisateur.**

---

## 4. Bonnes Pratiques de Développement

### HTML5
- Utilisation de balises sémantiques (`<header>`, `<main>`, `<section>`, `<aside>`, `<footer>`).
- Accessibilité : `type="button"` obligatoire sur les boutons, attributs `aria-label` descriptifs, hiérarchie cohérente des titres `<h1>` à `<h3>`.
- Séparation stricte : zéro code CSS ou JavaScript dans le fichier HTML.

### CSS3
- Charte graphique avec le rose flashy `#F60887` en accentuation principale.
- Disposition en 2 colonnes bien équilibrée et adaptative.
- Empêcher la sélection de texte accidentelle (`user-select: none`).

### JavaScript (Architecture MVC)
- **Pattern MVC** : Séparation stricte entre Modèle (`gameState` + calculs), Vue (`index.html` + `updateUI()`), et Contrôleur (écouteurs d'événements).
- **Contrainte zéro erreur console** : vérifications de sécurité systématiques sur le DOM.
- **État unique (`gameState`)** : aucune variable dispersée.
- **Flux de données unidirectionnel** : action $\to$ mutation de l'état $\to$ rendu de la vue.

---

## 5. Protocole de Tests Obligatoire à Chaque Phase
Chaque phase livrée doit être validée selon le protocole de [06_Plan_de_Tests_Qualite.md](./06_Plan_de_Tests_Qualite.md) :
- **Tests Unitaires** : exactitude mathématique des coûts et gains.
- **Tests de Composants** : conformité HTML/CSS/A11y et réactivité des boutons.
- **Tests d'Intégration** : cohérence globale de la boucle de jeu.
- **Tests End-to-End** : complétion d'un cycle complet sans bug.
- **Tests de Charge** : résistance au spam de clics et conservation du temps hors-ligne.
