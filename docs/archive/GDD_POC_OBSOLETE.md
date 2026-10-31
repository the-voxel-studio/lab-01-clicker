> [!WARNING]
> **DOCUMENT ARCHIVÉ ET OBSOLÈTE**  
> Ce document est l'ébauche initiale de conception du PoC. Les spécifications définitives, les formules équilibrées et le modèle économique de référence sont maintenus dans [`docs/GUIDE.md`](../GUIDE.md), [`docs/GAME_RULES.md`](../GAME_RULES.md) et [`src/data/balance.ts`](../../src/data/balance.ts).

# Le Grand Audit - Document de conception (PoC) [ARCHIVÉ]

*Jeu incrémental roguelike de gestion bureaucratique, 100 % hors-ligne, jouable dans un navigateur.*

---

## 1. Vision

### 1.1 Résumé

Le joueur est un seigneur qui doit survivre à dix inspections de la Couronne, les **échéances**. À chaque échéance, il doit prouver que son royaume est solide sur au moins **deux des trois fronts** : l'administration, la population et la puissance militaire.

Le jeu part d'un clicker (on clique pour produire de la *Puissance Administrative*, la PA), mais le clic devient vite secondaire. Ce sont les décisions de gestion qui font gagner ou perdre : à qui confier la population, quelles lois adopter, quel taux d'impôt fixer, quelles batailles risquer.

### 1.2 Objectifs du proof of concept

- Un jeu qui **se lance, se perd et se gagne facilement**, sans compte, sans serveur, sans connexion.
- Un jeu **addictif** : runs de 15 à 20 minutes, relance en quelques secondes, nouveauté toutes les une à deux minutes.
- Un jeu où **il n'existe pas de meilleure option absolue** : on ne se contente pas d'acheter le dernier objet disponible.
- Un **périmètre stable et fermé** : pas d'âges technologiques, pas d'IA, pas de backend.

### 1.3 Piliers de conception

1. **Spécialisation** : on peut jouer à deux ordres sur trois, voire aux trois au prix d'une gestion très tendue.
2. **Tout a un coût permanent** : chaque unité, chaque loi coûte de l'entretien et alourdit la paperasse.
3. **Plusieurs façons de perdre**, donc plusieurs choses à surveiller en même temps.
4. **Du risque maîtrisable** : les batailles sont des paris que l'on peut préparer.
5. **Du contenu qui varie** : tirages de lois, événements et menaces rendent chaque run différent.

---

## 2. Structure d'un run

### 2.1 Départ

| Élément | Valeur de départ |
| --- | --- |
| PA | 50 |
| Population | 100 |
| Provinces | 3 |
| Unités | aucune |
| Taux d'imposition | 25 % |
| Mécontentement | 10 / 100 |
| Lois | aucune (5 emplacements vides) |

Les bonus de métaprogression (voir section 12) modifient ces valeurs.

### 2.2 Les échéances

Un run compte **10 échéances** d'environ **100 secondes** chacune, soit 17 minutes de jeu actif. Le chronomètre est suspendu pendant les choix de lois, les événements et les batailles.

À chaque échéance, la Couronne contrôle trois exigences :

| Exigence | Ce qui est mesuré |
| --- | --- |
| **PA** | PA *produite* pendant l'échéance (revenu cumulé, pas le stock : on peut donc dépenser librement) |
| **Population** | Population totale au moment du contrôle |
| **Puissance militaire** | Puissance militaire totale au moment du contrôle |

**Règle des deux sur trois :** il suffit de satisfaire **deux** exigences sur trois. L'échéance 10, le **Grand Audit**, suit la même règle avec des seuils plus élevés.

Valeurs provisoires des exigences :

| Échéance | PA produite | Population | Puissance militaire |
| --- | --- | --- | --- |
| 1 | 500 | 200 | 20 |
| 2 | 1 200 | 350 | 40 |
| 3 | 2 800 | 550 | 70 |
| 4 | 6 000 | 800 | 110 |
| 5 | 12 000 | 1 100 | 170 |
| 6 | 24 000 | 1 500 | 250 |
| 7 | 45 000 | 2 000 | 360 |
| 8 | 85 000 | 2 700 | 500 |
| 9 | 150 000 | 3 500 | 700 |
| 10 (Grand Audit) | 300 000 | 5 000 | 1 000 |

À mi-échéance, l'intendant avertit le joueur s'il est en train de rater deux exigences sur trois.

### 2.3 Entre deux échéances

Après chaque échéance réussie, le jeu enchaîne dans cet ordre :

1. **Choix de loi** : trois cartes proposées par les trois conseillers (voir section 9).
2. **Événement de l'intendant** : un dilemme avec un choix à faire.
3. **Annonce de la menace** de l'échéance suivante (à partir de l'échéance 3).
4. Reprise du chronomètre.

### 2.4 Conditions de victoire

Le joueur **gagne** en réussissant le Grand Audit (échéance 10). Il reçoit alors un bonus de points d'Archives (section 12) et peut relancer une partie.

### 2.5 Conditions de défaite

Quatre défaites existent. Chacune a plusieurs façons d'être évitée :

| Défaite | Déclencheur | Comment l'éviter |
| --- | --- | --- |
| **Quota manqué** | Moins de deux exigences sur trois satisfaites à l'échéance | Choisir deux fronts et les tenir |
| **Révolte** | Mécontentement à 100 | Baisser l'impôt, recruter du clergé, adopter des lois apaisantes |
| **Banqueroute** | PA nette négative pendant 30 secondes consécutives | Réduire l'entretien, recruter des réducteurs, augmenter les revenus |
| **Invasion** | Perte de la dernière province | Répondre aux menaces (force, tribut ou levée en masse) |

Une menace non repoussée fait perdre **une province** et 15 % de la population. La défaite par invasion n'arrive qu'à zéro province, donc un joueur sans armée la contourne par le tribut.

---

## 3. Les ressources

| Ressource | Rôle | Remarques |
| --- | --- | --- |
| **PA** (Puissance Administrative) | Monnaie universelle : recrutement, remplacement de lois, tributs | Revenu brut diminué de la paperasse et de l'entretien |
| **Population** | Socle du royaume : alimente les trois ordres | Croît par elle-même, limitée par la capacité des provinces |
| **Mécontentement** | Jauge de 0 à 100 | À 100, c'est la révolte |
| **Puissance militaire** | Mesure de l'armée | Somme de la puissance des soldats × bonus |
| **Provinces** | Capacité de population, base de la défense | Conquises en bataille, perdues par invasion |
| **Archives** | Monnaie de métaprogression | Conservée entre les runs |

### 3.1 Population

- **Capacité** = 100 × nombre de provinces (valeur provisoire, modifiable par les lois).
- **Croissance par seconde** = (1 + bonus des paysans) × (1 − population / capacité).
- Chaque administrateur, soldat ou membre du peuple spécialisé est **pris sur la population** et compte dans ses plafonds.
- La population non affectée est la **population libre** : elle paie des impôts et nourrit les percepteurs.

### 3.2 Revenu en PA

```
PA brute = clic + scribes + percepteurs + impôts + butin
PA nette = PA brute × (1 − paperasse) − entretien total
```

- **Impôts** = population × taux d'imposition × 0,02 PA/s, augmentés par les artisans.
- Les revenus des unités sont détaillés en section 5.

### 3.3 Le clic

Valeur d'un clic = **1 + 3 % du revenu passif brut par seconde**. Visée : le clic pèse **10 à 20 %** du revenu en milieu de run, donc il reste utile sans devenir le jeu. Les lois peuvent le modifier.

---

## 4. L'inertie bureaucratique

Plus le royaume grossit, plus une part de la production est avalée par la paperasse.

```
taille = (scribes + 2 × superviseurs + 2 × archivistes ... + 0,5 × soldats + 10 × provinces)
         (les unités de palier II comptent double)
paperasse = taille / (taille + S)          avec S = 200 au départ
```

- La PA nette est la PA brute multipliée par `(1 − paperasse)`.
- Résultat : chaque administrateur supplémentaire rapporte moins que le précédent. Il existe donc une **taille optimale** de l'administration, et le joueur doit la trouver.
- **Les archivistes** réduisent la paperasse (jusqu'à −60 % au maximum), ce qui coûte des places dans le plafond administratif.
- La paperasse alimente aussi le mécontentement (section 7).

---

## 5. Les trois ordres

Le royaume repose sur trois **ordres** : le **Peuple**, l'**Administration** et l'**Armée**.

- Le **Peuple** est le socle. Il fournit les administrateurs et les soldats, et sa taille compte dans l'exigence de population.
- L'**Administration** produit la PA.
- L'**Armée** fournit la puissance militaire et, avec de la chance, des provinces et du butin.

Le joueur doit satisfaire deux exigences sur trois, donc il peut se passer d'un ordre :

| Archétype | Ordres joués | Style | Risque |
| --- | --- | --- | --- |
| **Bureaucrate** | Peuple + Administration | Production stable, optimisation de la paperasse | Menaces à gérer par le tribut |
| **Conquérant** | Peuple + Armée | PA tirée du butin et des provinces | Très volatil, dépend des batailles |
| **Empire complet** | Les trois | Le plus puissant | Paperasse et entretien explosent |

### 5.1 Les quatre rôles de chaque ordre

Chaque ordre propose quatre types de rôles :

- **Producteur** : génère la ressource principale de l'ordre.
- **Multiplicateur** : amplifie les producteurs.
- **Réducteur** : diminue un coût ou une pénalité.
- **Spécial** : effet particulier.

Chaque rôle existe en **deux paliers** (I et II), jamais plus. Recruter = payer en PA et prélever l'unité sur la population.

**Le palier II n'est pas strictement meilleur :** il donne beaucoup plus d'effet *par tête*, mais coûte plus cher, plus d'entretien et compte double dans la paperasse. Quand le plafond limite le nombre de têtes, le palier II est précieux. Quand c'est la PA qui limite, le palier I reste rentable.

### 5.2 Le Peuple

| Rôle | Palier I | Palier II |
| --- | --- | --- |
| **Producteur : croissance** | **Paysans** - coût 20, +0,02 hab/s | **Fermiers** - coût 120, +0,12 hab/s, entretien 0,1 PA/s |
| **Multiplicateur : impôts** | **Artisans** - coût 60, +0,5 % d'impôts | **Guildes** - coût 300, +3 % d'impôts, entretien 0,3 PA/s |
| **Réducteur : mécontentement** | **Clergé** - coût 50, −0,02 mécontentement/s | **Prélats** - coût 250, −0,12 mécontentement/s, entretien 0,5 PA/s |
| **Spécial : plafonds** | **Notables** - coût 150, +1 % aux plafonds des trois ordres | **Seigneurs** - coût 800, +5 % aux plafonds, entretien 2 PA/s |

### 5.3 L'Administration

| Rôle | Palier I | Palier II |
| --- | --- | --- |
| **Producteur : PA** | **Scribes** - coût 15, +0,5 PA/s | **Greffiers** - coût 100, +4 PA/s, entretien 0,5 PA/s |
| **Multiplicateur : production** | **Superviseurs** - coût 80, +2 % de production des producteurs administratifs | **Intendants de province** - coût 400, +8 %, entretien 1 PA/s |
| **Réducteur : paperasse** | **Archivistes** - coût 70, −1,5 % de paperasse | **Chambre des comptes** - coût 350, −6 % de paperasse, entretien 1 PA/s |
| **Spécial : conversion** | **Percepteurs** - coût 120, +0,8 PA/s par tranche de 100 habitants libres | **Fermiers généraux** - coût 600, +4 PA/s par tranche de 100 habitants libres, entretien 2 PA/s |

### 5.4 L'Armée

| Rôle | Palier I | Palier II |
| --- | --- | --- |
| **Producteur : puissance** | **Soldats** - coût 25, +1 puissance, entretien 0,3 PA/s | **Hommes d'armes** - coût 150, +6 puissance, entretien 1,5 PA/s |
| **Multiplicateur : puissance et chance** | **Officiers** - coût 100, +1,5 % de puissance et de chance | **Capitaines** - coût 500, +6 %, entretien 1 PA/s |
| **Réducteur : entretien** | **Intendants militaires** - coût 90, −1,5 % d'entretien de l'armée | **Quartiers-maîtres** - coût 450, −6 %, entretien 1 PA/s |
| **Spécial : renseignement** | **Éclaireurs** - coût 110, resserre la fourchette ennemie de 3 points | **Espions** - coût 550, −10 points et révèle les traits de l'ennemi, entretien 2 PA/s |

La **chance** vient uniquement de l'armée : elle améliore les tirages de bataille. Un joueur sans armée n'en a pas, mais n'en a pas besoin.

### 5.5 Les plafonds

Pour éviter l'accumulation sans limite, tout est plafonné en pourcentage de la population :

| Plafond | Valeur provisoire |
| --- | --- |
| Total Administration | 12 % de la population |
| Total Armée | 10 % de la population |
| Total rôles du Peuple | 25 % de la population |
| Dans chaque ordre : producteurs | jusqu'à 60 % du plafond de l'ordre |
| Multiplicateurs | jusqu'à 20 % |
| Réducteurs | jusqu'à 10 % |
| Spéciaux | jusqu'à 10 % |

Les Notables et Seigneurs relèvent ces plafonds. Faire croître la population relâche donc toutes les contraintes à la fois, ce qui rend le Peuple indispensable même pour les joueurs spécialisés.

---

## 6. Le taux d'imposition

Un **curseur continu**, de 0 % à 60 %, réglable à tout moment.

| Taux élevé | Taux bas |
| --- | --- |
| Plus d'impôts (PA) | Peuple apaisé |
| Mécontentement qui monte | Croissance démographique plus rapide |
| Croissance démographique ralentie | Revenu fiscal faible |

Le bon réglage change selon l'échéance : en période de quota PA, on serre la vis, puis on relâche pour laisser la population repartir. Il n'existe pas de réglage unique valable pour tout le run.

---

## 7. Le mécontentement

**Variation par seconde** = pression fiscale + pression de la paperasse + pression de la guerre − apaisement.

| Composante | Valeur provisoire |
| --- | --- |
| Pression fiscale | `(taux − 25 %) / 10 × 0,1` (négative sous 25 %) |
| Pression de la paperasse | `paperasse × 0,15` |
| Pression de la guerre | +2 par bataille perdue ou pyrrhique, décroît en 20 s |
| Apaisement | Clergé, Prélats, lois et événements |

La jauge est visible en permanence. À 70 %, l'intendant intervient. À 100 %, c'est la révolte et la fin du run.

---

## 8. L'armée, les menaces et les batailles

### 8.1 Entretien

Chaque unité militaire consomme de la PA en continu. Une armée trop grande par rapport à l'administration ruine l'État avant même de combattre : c'est le piège principal des conquérants.

### 8.2 Les menaces

À partir de l'échéance 3, une **menace** est annoncée avant chaque échéance. Sa force vaut **80 % de l'exigence militaire** de l'échéance. Trois réponses sont possibles :

| Réponse | Ordre mobilisé | Coût |
| --- | --- | --- |
| **Repousser par la force** | Armée | Soldats perdus (pertes selon la marge de puissance) |
| **Payer un tribut** | Administration | 20 % de l'exigence PA de l'échéance suivante, payés en PA |
| **Levée en masse** | Peuple | 10 % de la population transformés en milice pour la durée de la menace, +30 mécontentement |

Si aucune réponse n'est donnée ou si elle échoue, le joueur perd une province.

### 8.3 Les batailles volontaires

Entre les échéances, le joueur peut lancer jusqu'à **2 campagnes** par échéance pour gagner des provinces et du butin. C'est un pari dans l'esprit du blackjack : on mise des soldats, on décide d'insister ou de se retirer.

**Ce que le joueur voit avant de s'engager**

- La **force ennemie sous forme de fourchette** (par exemple « 100 à 160 »). La valeur réelle est cachée. Les éclaireurs et espions resserrent la fourchette (±40 % au départ).
- Le **butin promis** (PA, population, parfois une province).
- Ses soldats disponibles.

**Déroulement (3 manches maximum)**

1. Le joueur **envoie N soldats** au front. Les autres restent à l'abri.
2. **Tirage :** puissance de la manche = soldats au front × bonus des officiers × un aléa de 0,8 à 1,2.
3. La puissance **s'accumule** d'une manche à l'autre.
4. **Pertes :** environ 25 % des soldats au front meurent à chaque manche.
5. **Renforts ennemis :** la force ennemie augmente de 10 % à chaque manche, donc traîner coûte cher.
6. **Indice :** à la fin de chaque manche, le jeu indique « ennemi ébranlé à X % », ce qui permet de déduire sa vraie force.
7. **Décision :** renforcer (comme tirer une carte), tenir ou battre en retraite.

Si l'ennemi n'est pas brisé après la troisième manche, c'est une **défaite totale**.

**Issues possibles**

| Issue | Condition | Effet |
| --- | --- | --- |
| **Victoire éclatante** | Puissance ≥ 1,5 × force ennemie | Butin ×1,5, une province, moins de pertes |
| **Victoire** | Puissance entre 1 et 1,5 × force ennemie | Butin normal, une province |
| **Victoire à la Pyrrhus** | Victoire, mais plus de 60 % des soldats engagés sont morts | Butin ×0,4, pas de province |
| **Défaite** | Force ennemie non atteinte après 3 manches | Tous les soldats engagés sont perdus, mécontentement en hausse |
| **Retraite** | Décision du joueur | Les survivants sont conservés, aucun butin |

**La question que pose chaque bataille :** ai-je misé assez de soldats sans trop en miser ?

- Trop peu, et l'ennemi n'est pas brisé à temps.
- Trop, et on gagne, mais au prix de pertes inutiles pour le même butin.
- Trop tard, et les renforts ennemis rattrapent le joueur.

Les pertes étant proportionnelles aux soldats engagés, envoyer plus que nécessaire n'est jamais gratuit.

**Équilibrage visé :** avec un rapport puissance/force proche de 1, l'espérance est légèrement négative (c'est un vrai pari). À partir de 1,5, elle devient positive. Les officiers réduisent la variance, les éclaireurs affichent des probabilités plus précises.

**Exemple.** Force réelle de l'ennemi : 130 (fourchette affichée 100-160). Manche 1 : 60 soldats, puissance ≈ 62, ennemi ébranlé à 48 %, 15 soldats perdus. Manche 2 : l'ennemi monte à 143, 40 renforts, puissance cumulée ≈ 147 ≥ 143, victoire. Bilan : 36 soldats morts sur 100 engagés, victoire normale. Un envoi massif de 120 soldats dès la manche 1 donne aussi la victoire, mais pour 52 morts : la mise juste est la plus rentable.

---

## 9. Les lois et les conseillers

### 9.1 Les conseillers

Quatre personnages donnent une voix au jeu. Ils sont **écrits à la main** : aucun texte n'est généré.

| Conseiller | Rôle |
| --- | --- |
| **L'Intendant** | Narrateur et fil rouge : tutoriel, alertes, dilemmes (section 10). Ton ironique et servile |
| **Le Prélat** | Propose des lois liées au **Peuple** |
| **Le Chancelier** | Propose des lois liées à l'**Administration** |
| **Le Maréchal** | Propose des lois liées à l'**Armée** |

### 9.2 Les lois

Après chaque échéance, le joueur reçoit **trois cartes** : une du Prélat, une du Chancelier, une du Maréchal, tirées d'un pool. Il en choisit **une** ou les **refuse toutes** (il gagne alors 1 point d'Archives).

- Le joueur dispose de **5 emplacements** de lois pour tout le run.
- Si les emplacements sont pleins, il doit en **remplacer** une, pour un coût de 30 secondes de revenu net.
- Toutes les lois ont **un avantage et une contrepartie**.
- Il n'y a **pas de niveaux** : une loi est ce qu'elle est, ce qui évite l'échelle « toujours acheter la dernière ».

### 9.3 Pourquoi aucune loi n'est dominante

1. **Les choix sont horizontaux** : chaque carte est bonne pour certains profils seulement.
2. **Contreparties** : la paperasse, l'entretien ou le mécontentement montent.
3. **Effets conditionnels** : la valeur d'une carte dépend de l'état du royaume.
4. **Synergies et anti-synergies** entre cartes.
5. **Coût de remplacement** : chaque choix engage le joueur.

### 9.4 Exemples de lois (pool cible : 30 cartes)

| Loi | Conseiller | Effet | Contrepartie |
| --- | --- | --- | --- |
| **Scriptorium** | Chancelier | +50 % de production des scribes | +20 % de paperasse |
| **Cadastre** | Chancelier | −25 % de paperasse | Entretien de 2 PA/s par province |
| **Dîme exceptionnelle** | Chancelier | +80 % de PA pendant une échéance | +30 mécontentement ensuite |
| **Guichet unique** | Chancelier | Les archivistes comptent double | Les superviseurs sont moins efficaces (−50 %) |
| **Édit de recensement** | Prélat | +25 % de population | Plafond d'administrateurs réduit |
| **Jours fériés** | Prélat | −0,2 mécontentement/s | −10 % de PA |
| **Droit d'aînesse** | Prélat | +15 % de capacité des provinces | Croissance démographique −20 % |
| **Grande kermesse** | Prélat | Mécontentement −25 immédiatement | Coût de 40 s de revenu net |
| **Garnison permanente** | Maréchal | Menaces couvertes à 60 % | Entretien militaire +30 % |
| **Solde au mérite** | Maréchal | Entretien de l'armée −30 % | Valable seulement avec moins de 3 provinces |
| **Pillage encadré** | Maréchal | Butin ×1,5 | +20 % de mécontentement par bataille |
| **Écoles d'officiers** | Maréchal | Les officiers comptent double | Les soldats coûtent +20 % |

---

## 10. Les événements de l'intendant

L'Intendant apparaît **une fois après chaque échéance** et soumet un dilemme. Sa fonction : donner du rythme, offrir des choix à enjeu et donner l'impression que le royaume réagit au joueur.

### 10.1 Structure

Chaque événement comporte :

- une **condition d'apparition** (par exemple « l'armée coûte plus de 40 % du revenu »),
- un **texte** dans la voix de l'Intendant,
- deux ou trois **choix**, chacun avec un effet et un risque.

Plusieurs variantes de texte existent pour le même événement, selon la **marge de survie** (échéance réussie de justesse ou largement), l'état du royaume (armée trop grosse, peuple en colère, population qui stagne) et le style du joueur (clics intensifs ou automatisation).

### 10.2 Exemples

| Événement | Condition | Choix |
| --- | --- | --- |
| **Les fenêtres imposables** | Revenu supérieur à la moyenne | A) +10 % de PA, +10 mécontentement , B) refus, +5 Archives |
| **Le scribe qui compte trop** | Marge de victoire faible | A) licencier des scribes (−5 % paperasse) , B) le promouvoir (+1 superviseur, +entretien) |
| **Le Prince cousin** | Armée > 40 % de l'entretien | A) lui verser une pension (−PA, +apaisement) , B) le renvoyer (risque de menace supplémentaire) |
| **Le grand incendie des registres** | Paperasse élevée | A) tout recopier (−PA, −paperasse) , B) tout oublier (+paperasse, +mécontentement) |
| **La pénurie d'armoires** | Marge de victoire > 200 % | A) créer un ministère des armoires (+entretien, −paperasse) , B) brûler les archives (+PA, −Archives) |

### 10.3 Garde-fous

Les effets sont **codés en dur**, avec des plafonds. Les textes sont écrits à la main et illimités en variantes. Cible : une vingtaine d'événements, avec deux à trois variantes de texte chacun.

---

## 11. Progression au sein d'un run

Les mécaniques se débloquent progressivement pour garder une nouveauté toutes les une à deux minutes :

| Échéance | Nouveautés |
| --- | --- |
| 1 | Clic, scribes, paysans, taux d'imposition, mécontentement |
| 2 | Superviseurs, archivistes, artisans, clergé, première loi |
| 3 | Soldats, menaces, première bataille volontaire, percepteurs |
| 4 | Officiers, intendants militaires, notables, éclaireurs |
| 5 | Tous les rôles de palier II |
| 6 à 10 | Les événements deviennent plus tendus, les menaces s'intensifient, seuils en forte hausse |

---

## 12. Métaprogression : les Archives nationales

À la fin de chaque run, victoire ou défaite, le joueur reçoit des **points d'Archives** :

| Source | Points |
| --- | --- |
| Chaque échéance réussie | 1 |
| Victoire au Grand Audit | 5 |
| Chaque victoire éclatante en bataille | 0,5 (maximum 3 par run) |
| Chaque refus de lois (choix « refuser les trois ») | 1 |

Les points s'investissent dans des bonus permanents. Environ **huit** bonus suffisent pour le PoC :

| Bonus | Effet |
| --- | --- |
| **Trésor de départ** | +100 PA au départ |
| **Droit d'aînesse ancien** | +5 % aux plafonds administratifs |
| **Cadastre ancien** | −5 % de paperasse de base |
| **Charte des libertés** | −5 mécontentement de départ |
| **Armée permanente** | 20 soldats au départ |
| **Réseau d'espions** | Fourchettes ennemies −10 points |
| **Chronique royale** | Affiche les exigences des deux échéances suivantes |
| **Sixième emplacement** | Un 6ᵉ emplacement de loi (bonus le plus cher) |

L'écran de fin de run affiche **ce qui a causé la défaite**, ce qui a été gagné en Archives et un bouton **Nouvelle partie** : le joueur doit pouvoir relancer en deux secondes.

---

## 13. Interface

Un **écran unique**, sans menu intermédiaire :

- **En-tête :** numéro d'échéance, chronomètre, trois exigences avec leur état (atteinte ou non), jauge de mécontentement.
- **Colonne centrale :** bouton de clic, PA, revenu brut, paperasse, entretien, revenu net, curseur d'imposition.
- **Trois colonnes d'ordres :** Peuple, Administration, Armée, avec leurs quatre rôles et leurs plafonds.
- **Panneau latéral :** emplacements de lois, journal de l'Intendant.
- **Fenêtres modales :** choix de loi, événement, menace et bataille (le chronomètre est suspendu).

Chaque achat affiche son **coût, son entretien et son impact sur la paperasse** avant validation, afin que le joueur voie le compromis.

---

## 14. Choix techniques

| Domaine | Choix |
| --- | --- |
| Langage | TypeScript |
| Outil de build | Vite |
| Interface | Vue 3 ou Svelte, ou DOM natif |
| Serveur | **Aucun** : le jeu est un site statique |
| Réseau | **Aucun** : hors-ligne par construction |
| Sauvegarde | `localStorage`, état de jeu sérialisable en JSON |
| Boucle de jeu | Delta-time (`performance.now()`) |
| Aléatoire | Générateur à graine (seed), pour les tests reproductibles |
| Nombres | `number` natif (pas de grands nombres pour le PoC) |
| Déploiement | GitHub Pages ou itch.io ; PWA optionnelle |

**Principes d'architecture**

- Le **moteur de jeu** est en TypeScript pur, indépendant de l'interface. L'état est un objet JSON sérialisable.
- Les **données** (unités, lois, événements, menaces, bonus d'Archives) sont dans des fichiers de données séparés, faciles à modifier sans toucher au moteur.
- Un **simulateur sans interface** exécute des runs automatiques avec des bots (un par archétype) pour calibrer l'équilibrage.

---

## 15. Périmètre

**Inclus**

- Clic, population, trois ordres avec quatre rôles chacun en deux paliers
- Inertie bureaucratique, taux d'imposition, mécontentement
- Menaces, batailles volontaires en trois manches
- 10 échéances, règle des deux sur trois, quatre défaites
- Lois (5 emplacements, pool de 30), conseillers, événements de l'Intendant
- Métaprogression par les Archives (8 bonus)
- Sauvegarde locale, jeu hors-ligne

**Exclu**

- Âges et révolutions industrielles
- IA, serveur, API externe
- Audio, packaging natif (Tauri), grands nombres
- Multijoueur, classements

---

## 16. Feuille de route

1. **Noyau économique :** état de jeu, boucle, clic, scribes, paysans, paperasse, entretien, mécontentement, première échéance.
2. **Les trois ordres :** les douze rôles, les deux paliers, les plafonds.
3. **Structure du run :** dix échéances, règle des deux sur trois, écran de fin, relance rapide.
4. **Lois et événements :** cartes, conseillers, événements de l'Intendant.
5. **Menaces et batailles :** les trois réponses, le pari en trois manches.
6. **Métaprogression :** points et bonus d'Archives.
7. **Équilibrage :** simulateur, bots par archétype, playtests.

**Critère de réussite du PoC :** chacun des trois archétypes doit pouvoir gagner un run, et les runs doivent être suffisamment différents pour donner envie d'en relancer un.

---

## 17. Questions ouvertes

- **Traits d'ennemi** : ajouter des ennemis spéciaux (forteresse, cavalerie...) ou garder des ennemis identiques pour le PoC ?
- **Population obligatoire ?** Le document suppose que oui. Faut-il autoriser un royaume presque sans habitants (mercenaires et bureaucrates) ?
- **Courbe des exigences :** les valeurs de la section 2.2 sont des estimations à valider par simulation.
- **Ton de l'Intendant :** serviteur lâche et hypocrite, haut fonctionnaire méprisant ou conseiller paniqué ?
- **Nom définitif du jeu :** « Le Grand Audit » est un nom de travail.
