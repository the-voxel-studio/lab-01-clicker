# Tâche 1.0 — Arbitrages de Règles & Alignement Documentaire (`GAME_RULES.md`, `GUIDE.md`, `PLAN.md`)

- **Statut** : ✅ Validée par l'utilisateur (Corrections documentaires intégrées)
- **Date** : 2026-10-13
- **Fichiers modifiés** :
  - `docs/GAME_RULES.md`
  - `docs/GUIDE.md`
  - `docs/PLAN.md`
  - `docs/making/README.md`

---

## 1. Synthèse des 14 Arbitrages Inscrits

1. **Révolution immédiate (§6.5)** :
   - L'Unrest atteignant 100 à n'importe quel instant (hausse continue ou pic instantané, dans n'importe quelle phase) déclenche immédiatement la défaite `revolution`.
   - `phase` bascule en `RUN_DEFEAT` et aucune transition ultérieure de phase ne peut écraser cet état.

2. **Désertion cumulative (§6.5, §10.2 / §11.1)** :
   - La désertion militaire s'applique de manière continue et cumulative de **75% à 99%** d'Unrest (paliers `strife_desertion` et `urban_rebellion`), au même titre que le boycott fiscal (50% à 99%) et le gel démographique (75% à 99%).
   - La loi *Sanctuary Rights* supprime la désertion **strictement sous 90% d'Unrest** (les désertions reprennent à 90%–99%).

3. **Quota d'AP en débit brut instantané (§1.1, §1.3, §8.1, §11)** :
   - Le critère AP de l'audit est le **débit brut d'AP par seconde mesuré à l'instant de l'inspection** (`ApRateQuota`).
   - Évalué via `calculateGrossApRate(state).total` (production de base des unités, capitation, multiplicateurs, pénalités de crise, modificateurs `gross_ap_rate`, avant paperasse et entretien).
   - Les transferts ponctuels de trésorerie (édits, emprunt lombard, butins de guerre, salvage) et les clics manuels n'altèrent pas ce débit et ne comptent donc pas dans le quota d'audit.
   - Les quotas provisoires d'AP deviennent : `5, 12, 22, 35, 55, 85, 130, 195, 285, 420` AP/s pour D1 à D10.
   - L'avertissement à 50s (§1.3) compare directement le débit brut instantané courant à `ApRateQuota` (sans extrapolation).
   - Les dilemmes §9 (ratio débit / quota) et la médiane du bot §21.2 évaluent ce débit.
   - `totalCumulativeAp` (score §13.1, haut fait *Crœsus*) ne comptabilise que la production continue et les clics, excluant les transferts de capital.

4. **Trésor signé** :
   - Aucune mécanique ne remet une dette (`ap < 0`) à zéro (ni effets, ni dilemmes, ni pillage d'effondrement défensif).
   - Tout choix d'action ayant un coût en AP (édit, loi, dilemme, tribut, achat) exige la solvabilité préalable `state.ap >= coût` ; sinon la commande est strictement rejetée.
   - **Exception explicite : `DISBAND_UNIT` (§14.1)** reste autorisé même en cas d'insolvabilité ou trésorerie négative (`ap < 0`), avec une pénalité de +2 Unrest par unité non payée au lieu du coût normal de licenciement.

5. **Héraut des menaces (§8, §8.1)** :
   - Après l'audit de la deadline $d$ ($2 \le d \le 9$), le Héraut annonce et résout la menace de la deadline **$d+1$**.
   - Puissance de base : $0.80 \times \text{MilitaryQuota}_{d+1}$.
   - Coût du tribut : $20 \times \text{ApRateQuota}_{d+1}$ (montants en AP identiques au catalogue existant : 440 AP à D3, jusqu'à 8 400 AP à D10).
   - Les 8 menaces du catalogue (D3 à D10) sont ainsi toutes jouées sur une partie complète.

6. **Conquête (§1.2, §7.4.2)** :
   - Le plancher de protection de 1 province ne s'applique qu'aux sanctions administratives (Censure royale et Prêt lombard).
   - Lors d'une défaite par effondrement défensif, si le joueur n'a qu'une seule province, celle-ci est perdue, déclenchant immédiatement la défaite par conquête (`conquest`).

7. **Biome neutre de départ (`heartland`) (§6.1, §7.2)** :
   - Ajout du biome neutre `heartland` (*Cœur du Domaine*, multiplicateur de capacité $\times 1.0 = 250$, $\Delta r = 0$, aucun bonus défensif ni réduction de paperasse).
   - Les 3 provinces de départ sont `heartland` (capacité de départ garantie à 750).
   - La colonisation civile crée une province `heartland`.
   - La conquête militaire confère le biome de la cible `currentTarget`.
   - La perte d'une province (censure, prêt lombard, effondrement défensif) retire la dernière province acquise selon une pile LIFO.

8. **Achats en vrac (§5.1, §5.3)** :
   - Les paliers débloqués définissent une **taille maximale d'achat** ($\le 1$, $\le 10$ à D3 ou Pop $\ge 250$, $\le 50$ à D6 ou Pop $\ge 1\,000$, $\le 100$ à D8 pour Paysans et Scribes uniquement).
   - Tout entier de 1 jusqu'à ce plafond est valide ; les quantités dépassant le plafond (ex. 99 en D1) sont rejetées.
   - Buy Max retourne $\min(\text{K abordable}, \lfloor\text{FreeSerfs}\rfloor, \lfloor\text{OrderHeadroom}\rfloor, \text{MaxBulkSize})$.

9. **Salvage défensif (§7.4.2)** :
   - Une victoire défensive accorde un butin de récupération :
     $$\text{SalvageAP} = \text{round}(0.25 \times \text{TributeCost}_{\text{repelled threat}} \times \text{Roll}(0.8, 1.2))$$
     (où $\text{TributeCost}_{\text{repelled threat}}$ correspond à la deadline $d+1$ pour une menace du Héraut, et à la deadline courante pour un `SURPRISE_RAID`), crédité directement au trésor `state.ap`, avec $-5$ Unrest.

10. **Butin de soldats capturés (§7.4.1)** :
    - Les soldats libérés/capturés lors de campagnes offensives intègrent l'armée jusqu'au plafond d'ordre militaire.
    - Tout excédent rejoint le bassin des Serfs libres (`freeSerfs`), préservant l'invariant démographique §3.1.

11. **Prêt lombard (§14.4)** :
    - L'offre de sauvetage n'est déclenchée que si le domaine possède **au moins 2 provinces** (`provinces >= 2`).
    - Si le joueur ne possède qu'une province, l'offre n'est pas présentée et le compte à rebours de faillite se poursuit.

12. **Raids et Mercenaires (§7.5 vs §8.3)** :
    - Le doublement de probabilité de raid surprise lorsque `ap > 2000` est une règle générale régie par §8.3.
    - Le trait réactif des Mercenaires (§7.5) est circonscrit à l'exigence de tribut accru de $+25\%$ (aucun doublement cumulatif indu).

13. **Clic d'amorçage (§2.1, §17)** :
    - Clarification : avec les 50 AP de départ (`STARTING_AP = 50`), le recrutement du premier Scribe est possible immédiatement sans clic préalable.
    - L'étape 4 du tutoriel FTUE précise que le quota d'audit évalue le débit de production (AP/s) et non le trésor accumulé.

14. **Format de sauvegarde & Schéma (§18)** :
    - Le préfixe `GRA-v1:` est l'identifiant immuable de l'enveloppe de sérialisation Base64.
    - La version du schéma d'état est portée de manière autonome par le champ `schemaVersion: number` au sein du payload JSON.

15. **Suivi dans `PLAN.md` & `making/README.md`** :
    - Ajout de la checklist détaillée de la Tâche 1.0 dans `docs/PLAN.md`.
    - Rappel de la convention de numérotation.
    - Journalisation de la tâche dans `docs/making/README.md`.

---

## 2. Vérifications de Conformité
- `vue-tsc --build` : 0 erreur
- `oxlint .` : 0 avertissement, 0 erreur
- `eslint .` : 0 avertissement, 0 erreur
- `vitest run` : 56/56 tests passés
- Absence totale de contradiction entre `GAME_RULES.md`, `GUIDE.md`, `PLAN.md` et `docs/plan/README.md`.
