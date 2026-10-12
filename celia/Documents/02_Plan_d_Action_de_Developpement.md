# 2. Plan d'Action de Développement (Niveau Débutant)

Ce plan de développement professionnel est conçu spécialement pour être suivi pas à pas par un développeur débutant. Il fournit la feuille de route architecturale complète, les règles de conception et les méthodologies pour construire le projet proprement, de manière modulaire et sans écrire de code bancal.

---

## Phase 1 : Principes d'Architecture & Méthodologie

### 1.1 Organisation du Projet
- Travailler avec trois fichiers distincts séparant clairement les responsabilités :
  - **`index.html`** : Définit uniquement la structure et le squelette de la page. Aucun style direct ni comportement interactif n'y est inclus.
  - **`style.css`** : Gère l'apparence, la disposition en deux colonnes, le thème sombre, les animations et la couleur signature Rose Flashy (`#F60887`).
  - **`script.js`** : Contient toute la logique du jeu, la gestion de l'état, les calculs et la mise à jour de l'interface.

### 1.2 Règles de Conception Pro pour Débutant ("Zéro Erreur Console")
- **Sécurisation du DOM** : Avant de manipuler un élément HTML en JavaScript ou d'y attacher un écouteur d'événement, toujours vérifier que l'élément existe bien dans le document.
- **Gestion Unifiée de l'État (State Management)** : Regrouper l'ensemble des variables du jeu dans un unique objet JavaScript global (pièces, statistiques, niveau des améliorations, trophées débloqués, paramètres audio). Cela évite les variables dispersées et simplifie la sauvegarde.
- **Rendu Réactif** : Séparer la modification des données et l'affichage. Quand une action a lieu (ex: un clic ou un achat), modifier d'abord l'objet d'état, puis appeler une fonction dédiée à la mise à jour de l'interface utilisateur.

### 1.3 Pattern Architectural Obligatoire : MVC (Modèle - Vue - Contrôleur)
Le projet doit respecter une implémentation stricte et explicite du pattern **MVC** (Modèle - Vue - Contrôleur) :
- **Modèle (Model)** : L'objet `gameState` et les fonctions logiques pures de calcul (formules de coûts, bonus de puzzle). Le Modèle contient toute la vérité métier et ne manipule jamais directement le DOM HTML.
- **Vue (View)** : Le fichier `index.html` pour la structure, et la fonction de rendu réactif `updateUI()` (dans `script.js`). La Vue lit uniquement les données du Modèle pour refléter l'état actuel dans l'interface (compteurs, boutons activés/désactivés, jauge de progression, grille).
- **Contrôleur (Controller)** : Les gestionnaires d'événements (`addEventListener` pour les clics manuels, boutons d'achats, options) et le boucle d'automatisation (ticker passif). Le Contrôleur reçoit les interactions utilisateur, invoque les mutations sur le **Modèle**, puis déclenche le rafraîchissement de la **Vue**.

Flux d'exécution unidirectionnel obligatoire :
$$\text{Interaction Joueur} \longrightarrow \textbf{Contrôleur} \longrightarrow \textbf{Modèle }(gameState) \longrightarrow \textbf{Vue }(updateUI)$$

---

## Phase 2 : Structuration HTML (`index.html`)

### 2.0 Bonnes Pratiques & Sémantique HTML
- **Balises Sémantiques HTML5** : Privilégier les balises signifiantes (`<header>`, `<main>`, `<section>`, `<aside>`, `<footer>`) plutôt que d'empiler des `<div>` anonymes afin de rendre la structure claire et maintenable.
- **Accessibilité & Robustesse (A11y)** :
  - Toujours expliciter l'attribut `type="button"` sur tous les éléments `<button>`.
  - Fournir des attributs `aria-label` descriptifs sur les boutons sans texte visible (ex: icône de paramètres/son).
  - Respecter la hiérarchie stricte des titres (`<h1>` pour le jeu, `<h2>` pour les grandes zones, `<h3>` pour les sous-sections).
- **Séparation Stricte des Préoccupations (Clean Code)** :
  - Zéro style en ligne (`style="..."`) : le style est 100% délégué à `style.css`.
  - Zéro gestionnaire d'événement inline (`onclick="..."`) : les comportements sont 100% délégués aux écouteurs d'événements de `script.js`.
- **Standards & Nommage** :
  - Balises de base irréprochables (`<!DOCTYPE html>`, `lang="fr"`, `meta charset="UTF-8"`, `meta viewport`, balise `<title>`).
  - Identifiants (`id`) et classes CSS explicites, descriptifs et écrits en kebab-case.

### 2.1 Découpage Général en Deux Colonnes Flexibles
- Organiser le corps de la page dans un conteneur principal configuré en disposition à deux colonnes équilibrées.

### 2.2 Colonne de Gauche (Gameplay & Paramètres)
- **Zone Entête & Statut** :
  - Un bloc supérieur contenant un bouton d'ouverture des paramètres (gestion audio) ainsi qu'un badge affichant le Statut/Titre du joueur.
- **Zone d'Informations en Direct** :
  - Des compteurs lisibles affichant : le nombre total de pièces possédées, la progression du puzzle courant (pièces posées / pièces requises), le nombre de puzzles résolus et la vitesse de clic actuelle (temps de recharge).
- **Zone de la Table & du Puzzle** :
  - Un conteneur représentant la table de jeu qui accueillera la grille dynamique du puzzle.
- **Bouton d'Action Principal** :
  - Un grand bouton interactif positionné juste sous la table pour effectuer l'assemblage manuel.

### 2.3 Colonne de Droite (Système, Upgrades & Succès)
- **Conteneur d'Onglets ou de Sections** :
  - Section **Améliorations (Upgrades)** : Cartes avec icône/logo, titre, description, coût (en pièces ou en puzzles) et bouton d'achat affichant le niveau actuel.
  - Section **Statistiques (Stats)** : Liste de tous les compteurs historiques cumulés depuis le début.
  - Section **Trophées (Succès)** : Badges de succès verrouillés ou débloqués selon l'avancement.

---

## Phase 3 : Stylisation & Design CSS (`style.css`)

### 3.1 Thème Visuel & Variables
- Définir une palette sombre pour simuler un tapis de découpe/table de jeu avec un dégradé radial et un quadrillage subtil en filigrane.
- Utiliser la couleur **Rose Flashy (`#F60887`)** pour valoriser les éléments importants : bouton de clic principal, pièces assemblées sur la grille, surbrillance des cartes d'amélioration et compteurs actifs.

### 3.2 Layout à Deux Colonnes Responsive
- Mettre en place un système de colonnes (avec Flexbox ou CSS Grid) s'adaptant proprement aux écrans d'ordinateurs et de tablettes.

### 3.3 Rendu de la Grille de Puzzle
- Configurer la grille de puzzle de manière dynamique avec CSS Grid pour que le nombre de lignes et de colonnes s'ajuste automatiquement selon la taille du puzzle actif (ex: 3x3, 4x4, 5x5).
- Appliquer un style pointillé et semi-transparent pour les cases vides, et un fond plein rose flashy avec une lueur lumineuse pour les cases complétées.

---

## Phase 4 : Logique du Jeu & Mécaniques (`script.js`)

### 4.1 Initialisation de l'État & Démarrage
- Créer l'objet global représentant l'état initial du jeu.
- Au chargement de la page, déclencher la génération de la grille HTML correspondant au puzzle initial.

### 4.2 Gestion de la Vitesse de Clic & Cooldown
- Mettre en place une règle de délai de recharge (cooldown) sur le bouton principal de clic :
  - Lors d'un clic, le bouton devient temporairement inactif pendant un temps défini (vitesse de clic).
  - Une barre de progression visuelle ou un indicateur signale la fin du temps de recharge.
  - Chaque achat d'amélioration de vitesse réduit ce délai de recharge.

### 4.3 Assemblage, Complétion & Progression des Puzzles
- À chaque clic valide, créditer des pièces et remplir les cases vides de la grille.
- Lorsque toutes les cases d'un puzzle sont remplies :
  - Incrementer le compteur de puzzles résolus.
  - Calculer et attribuer une prime de pièces bonus.
  - Réinitialiser la grille en augmentant sa dimension pour le puzzle suivant.

### 4.4 Système d'Améliorations Répétables (Style Tycoon)
- Pour chaque amélioration :
  - Vérifier si le joueur possède les ressources requises (pièces ou puzzles résolus).
  - Si la ressource est suffisante, déduire le montant exact du solde du joueur.
  - Augmenter le niveau de l'amélioration et multiplier son coût pour le niveau suivant (progression exponentielle).
  - Mettre à jour la mécanique associée (ex: augmenter les pièces par clic, réduire le temps de recharge, ajouter de la production passive par seconde).

### 4.5 Statistiques Globales & Trophées
- Mettre à jour en permanence les conteneurs de statistiques historiques (temps de jeu global mesuré via un temporisateur, clics cumulés, pièces totales gagnées).
- Comparer régulièrement ces statistiques aux critères des Trophées :
  - Lorsqu'un trophée est validé, changer son état en débloqué.
  - Mettre à jour automatiquement le Titre/Statut du joueur affiché en haut à gauche.

### 4.6 Paramètres Audio & Sauvegarde Sécurisée
- **Gestion de la Musique** : Activer/désactiver la musique lors de l'action du joueur sur le bouton des paramètres pour éviter les blocages du navigateur.
- **Sauvegarde Automatique (LocalStorage)** : Enregistrer régulièrement l'objet d'état dans le navigateur du joueur. Entourer les opérations de lecture/écriture de vérifications pour prévenir tout plantage si les données sont invalides.

---

## Phase Optionnelle : Intégration d'une API d'Images (Si le temps le permet)

Cette phase s'effectue uniquement lorsque l'ensemble du jeu de base fonctionnel est finalisé et parfaitement stable.

### 1. Objectif & Principe de Fonctionnement
- Télécharger dynamiquement une image d'arrière-plan réelle depuis une API publique d'images gratuites à chaque nouveau puzzle.
- Découper visuellement l'image à travers les cases de la grille CSS grâce au positionnement d'arrière-plan (`background-position`).
- Chaque case du puzzle révèle ainsi progressivement une portion de l'image réelle lorsque le joueur pose des pièces.

### 2. Sélection & Recommandations des API d'Images

#### A. 🌟 Lorem Picsum (`picsum.photos`) — *Recommandée pour Débuter*
- **Pourquoi la choisir** : **Aucune clé API (API Key)** ni inscription nécessaire. Idéale pour prototyer rapidement sans configuration réseau complexe.
- **Principe d'URL** : Générer directement une URL d'image dynamique (ex: `https://picsum.photos/600/600?random=ID_DU_PUZZLE`).
- **Avantage** : Renvoyer immédiatement un fichier image compatible avec les règles CSS d'arrière-plan, sans risque d'erreur CORS ou d'échec d'authentification.

#### B. 📸 Unsplash API — *Qualité Professionnelle*
- **Pourquoi la choisir** : Collection massive de photographies de haute qualité catégorisées par thèmes (nature, architecture, art, espace).
- **Principe** : Inscription gratuite sur Unsplash Developers pour obtenir une clé d'accès (`client_id`), puis appel de l'endpoint d'image aléatoire (`https://api.unsplash.com/photos/random`).
- **Avantage** : Permet d'afficher la mention du photographe sous le puzzle (ex: *"Photo par Jane Doe"*).

#### C. 🖼️ Pexels API — *Haute Stabilité & Quota Généreux*
- **Pourquoi la choisir** : Offre une alternative gratuite très stable avec un quota de 20 000 requêtes par mois.
- **Principe** : Inscription sur Pexels API et envoi d'une clé d'autorisation dans les en-têtes HTTP de la requête `fetch`.

#### D. 🎨 Pixabay API — *Recherche en Français*
- **Pourquoi la choisir** : Validation immédiate de la clé API et support de requêtes de recherche multilingues.

### 3. Méthodologie d'Intégration & Sécurité ("Zéro Erreur Console")

1. **Étape 1 (Prototypage avec Lorem Picsum)** :
   - Commencer obligatoirement par Lorem Picsum pour valider la mécanique de découpage CSS avant d'intégrer une API nécessitant une clé d'accès.
2. **Étape 2 (Découpage Visuel CSS)** :
   - Appliquer l'URL de l'image en `background-image` sur les cases (`<div>`) de la grille de puzzle.
   - Calculer le `background-position` et le `background-size` de chaque case en pourcentage selon sa position sur la grille (ligne et colonne) afin de recréer l'image complète.
3. **Étape 3 (Gestion de Secours / Fallback Sécurisé)** :
   - Si la requête réseau échoue ou si le joueur n'a pas de connexion Internet, intercepter l'erreur avec un bloc `try...catch` ou `.catch()`.
   - Basculer immédiatement et de façon transparente la couleur de fond des cases sur le **Rose Flashy (`#F60887`)** habituel. Le jeu reste ainsi 100% jouable sans planter ni générer d'erreur console non gérée.
