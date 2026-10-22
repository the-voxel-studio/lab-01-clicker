# Tâche 2.2 — Modélisation des Biomes de Provinces (`src/data/biomes.ts`, `src/core/engine.ts`)

- **Statut** : ✅ Complétée & Validée
- **Date** : 2026-10-19
- **Fichiers modifiés & créés** :
  - `src/data/biomes.ts` (nouveau : catalogue complet des 5 biomes de provinces `heartland`, `farmlands`, `trade_hub`, `stronghold`, `wilderness`)
  - `src/data/balance.ts` (modifié : réexport de `BIOMES_DATA` depuis `./biomes`)
  - `src/core/battle.ts` (modifié : prise en compte de `strongholdCount` lors de la défense programmée dans `resolveScheduledThreat`)
  - `src/__tests__/unit/biomes.spec.ts` (nouveau : 7 tests unitaires validant les caractéristiques de chaque biome et le LIFO)

---

## 1. Actions Réalisées

1. **Création du module `src/data/biomes.ts`** :
   - Extraction de `BIOMES_DATA` avec les 5 définitions de biomes :
     - `heartland` : Domaine souverain de départ (neutre, capacité 250, aucun modificateur).
     - `farmlands` : Plaines arables (+50% capacité de logement = 375, $+0.001$ au taux logistique $r$).
     - `trade_hub` : Carrefour commercial (+15% efficacité fiscale `tax_efficiency`).
     - `stronghold` : Bastion frontalier (+12 défense passive plate lors des combats défensifs).
     - `wilderness` : Terres sauvages & marais (-20% capacité de logement = 200, -5% inertie de paperasse).

2. **Intégration Moteur & Règles Système** :
   - Le helper `getBiomeModifiers(state)` agrège les modificateurs de biomes à partir de `state.provinceBiomes`.
   - `calculateMaxPopulation` applique la moyenne pondérée de logement ($\sum m_i \times 250$), préservant exactement 750 de capacité de départ avec les 3 provinces `heartland`.
   - `calculateGrossApRate` applique `taxEfficiencyBonus` dans `baseArtisanTaxBonus`.
   - `calculateNetPaperwork` applique `paperworkReduction` dans `archivistReduction`.
   - `calculateDefenderPower` applique `strongholdCount * 12` flat.
   - Les combats programmés (`resolveScheduledThreat`) transmettent le décompte réel de bastions `strongholdCount` à `resolveDefensiveClash`.
   - Maintien strict de la parité `state.provinces === state.provinceBiomes.length` :
     - Colonisation (`COLONISE_PROVINCE`) ajoute `heartland`.
     - Prêt lombard (`ACCEPT_LOMBARD_LOAN`), censure royale et effondrement défensif retirent le dernier biome acquis selon l'ordre LIFO.

---

## 2. Vérification & Tests

- **Tests unitaires (`src/__tests__/unit/biomes.spec.ts`)** : 7 tests validant l'état initial neutre (750 cap), les bonus de chaque biome et l'ordre LIFO.
- **Suite globale** : 18 suites / 184 tests passés avec succès (`npm run test:unit`).
- **Simulations** : 5/5 conformes (`npm run test:sim`).
- **Typage & Linter** : 0 erreur, 0 avertissement (`vue-tsc`, `oxlint`, `eslint`).
