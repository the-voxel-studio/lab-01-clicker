# Tâche 2.1 — Effets Secondaires des 24 Unités (`GAME_RULES.md §4`)

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-19
- **Fichiers modifiés & créés** :
  - `src/core/types.ts` (modifié : ajout des champs optionnels `revealedFalseLedger?: boolean` et `revealedAmbush?: boolean` à `CampaignTarget`)
  - `src/core/engine.ts` (modifié : réduction de l'Unrest fiscal par Prélat de -20% par unité plafonnée à -80%, extension du compte à rebours de faillite par Chambre des comptes de +10s par unité)
  - `src/core/battle.ts` (modifié : réduction des pertes militaires par Capitaine de -5% par unité plafonnée à -50% en offensive et défensive, bonus de butin de campagne par Sergent +2% par unité, bonus de butin AP de campagne par Guilde +1% par unité, bonus de défense passive plate par Homme d'armes +0.5 par unité, réduction de l'incertitude M par Éclaireur (-12%) et Maître-espion (-30%) avec plancher à 5%, révélation des déceptions et embuscades par Maître-espion)
  - `src/__tests__/unit/secondary_effects.spec.ts` (nouveau : 9 tests unitaires validant exhaustivement chacun des 7 effets secondaires)
  - `src/__tests__/unit/military_threats_clock.spec.ts` (modifié : mise à jour du test de RECON_PATROL pour tester l'incertitude dynamique de 0.33 avec 1 éclaireur et 0.45 avec 0 éclaireur)

---

## 1. Actions Réalisées

1. **Prélat (`prelate`)** :
   - Réduction relative de l'Unrest fiscal : `taxUnrestRate *= (1.0 - Math.min(0.80, prelateCount * 0.20))`.
   - La pacification continue de base (`baseUnrestPac`) reste active (+0.15/s par Prélat).

2. **Chambre des comptes (`audit_chamber`)** :
   - Le plafond de temps de grâce avant faillite s'étend de `30.0s` à `30.0 + auditChamberCount * 10.0s`.
   - Le seuil de déclenchement de l'offre lombarde reste fixé à $\le 20.0\text{s}$ restantes.

3. **Capitaine (`captain`)** :
   - Réduction relative des pertes de retinue militaire : `captainDiscount = Math.min(0.50, captainCount * 0.05)`.
   - Appliqué à `resolveOffensiveCampaign` : `effectiveCasualtyRate = outcomeData.casualtyRate * (1.0 - captainDiscount)`.
   - Appliqué à `resolveDefensiveClash` en cas de victoire : `effectiveCasualtyRate = 0.10 * (1.0 - captainDiscount)`.

4. **Sergent (`sergeant`) & Guilde (`guild`)** :
   - `resolveCampaignLoot` prend en compte `state` :
     - `sergeantBonus = 1.0 + sergeantCount * 0.02` appliqué à toutes les catégories de butin (AP, population, soldats).
     - `guildApBonus = 1.0 + guildCount * 0.01` appliqué spécifiquement au butin en AP.

5. **Homme d'armes (`man_at_arms`)** :
   - Ajout de `manAtArmsCount * 0.5` de défense passive plate dans `calculateDefenderPower` lors des affrontements défensifs (`resolveDefensiveClash`).

6. **Éclaireur (`scout`) & Maître-espion (`spymaster`)** :
   - Marge d'incertitude dans `generateCampaignTarget` :
     `uncertaintyMargin = Math.max(0.05, 0.45 - scoutCount * 0.12 - spymasterCount * 0.30)`.
   - Si `spymasterCount >= 1`, `revealedFalseLedger = isFalseLedger` et `revealedAmbush = isAmbush` sont exposés sur `CampaignTarget`.

---

## 2. Vérification & Tests

- **Tests unitaires (`src/__tests__/unit/secondary_effects.spec.ts`)** : 9 tests vérifiant les 7 mécaniques.
- **Suite globale** : 17 suites / 177 tests passés avec succès (`npm run test:unit`).
- **Simulations** : 5/5 conformes (`npm run test:sim`).
- **Typage & Linter** : 0 erreur, 0 avertissement (`vue-tsc`, `oxlint`, `eslint`).
