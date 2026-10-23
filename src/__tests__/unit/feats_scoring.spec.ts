import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import { dispatch } from '@/core/commands'
import { calculateRunScore, getDynasticTitle } from '@/core/formulas'
import { evaluateFeats, FEATS_DATA } from '@/data/feats'
import { applyArchivePerks, ARCHIVES_DATA } from '@/data/archives'
import { EDICTS_DATA } from '@/data/edicts'
import { FACTIONS_DATA, SCHEDULED_THREATS_DATA } from '@/data/threats'
import { performScoutReroll } from '@/core/battle'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { tick } from '@/core/engine'

describe('Task 2.4: Threats, Factions, Archives, Feats & Dynastic Scoring', () => {
  describe('Catalogs Completeness', () => {
    it('defines all 3 emergency edicts with complete metadata', () => {
      expect(Object.keys(EDICTS_DATA)).toHaveLength(3)
      expect(EDICTS_DATA.forced_tithe.name).toBe('The Forced Tithe')
      expect(EDICTS_DATA.church_seizure.name).toBe('Church Seizure')
      expect(EDICTS_DATA.grand_festival.name).toBe('The Grand Festival')
    })

    it('defines all 8 National Archive perks with positive costs', () => {
      const perkKeys = Object.keys(ARCHIVES_DATA)
      expect(perkKeys).toHaveLength(8)
      for (const key of perkKeys) {
        expect(ARCHIVES_DATA[key as keyof typeof ARCHIVES_DATA].cost).toBeGreaterThan(0)
      }
    })

    it('defines all 8 Royal Feats with +0.5 archive point reward', () => {
      const featKeys = Object.keys(FEATS_DATA)
      expect(featKeys).toHaveLength(8)
      for (const key of featKeys) {
        expect(FEATS_DATA[key as keyof typeof FEATS_DATA].rewardArchivePoints).toBe(0.5)
      }
    })

    it('defines 8 scheduled threats from Deadline 3 to 10 and 6 factions', () => {
      expect(SCHEDULED_THREATS_DATA).toHaveLength(8)
      expect(SCHEDULED_THREATS_DATA[0]!.deadline).toBe(3)
      expect(SCHEDULED_THREATS_DATA[7]!.deadline).toBe(10)
      expect(Object.keys(FACTIONS_DATA)).toHaveLength(6)
    })
  })

  describe('Faction Reactive Traits', () => {
    it('applies outlaws civilian casualty penalty when soldiers < 10', () => {
      const state = createInitialGameState()
      state.units.soldier = 5
      const traitResult = FACTIONS_DATA.outlaws.applyReactiveTrait(state, 50, 1000)
      expect(traitResult.extraCivilianCasualtyRate).toBe(0.15)

      state.units.soldier = 12
      const traitResult2 = FACTIONS_DATA.outlaws.applyReactiveTrait(state, 50, 1000)
      expect(traitResult2.extraCivilianCasualtyRate).toBe(0)
    })

    it('applies mercenaries +25% tribute cost escalation', () => {
      const state = createInitialGameState()
      const traitResult = FACTIONS_DATA.mercenaries.applyReactiveTrait(state, 40, 1000)
      expect(traitResult.adjustedTributeCost).toBe(1250)
    })

    it('applies zealots religious defection when unrest > 60%', () => {
      const state = createInitialGameState()
      state.unrest = 65
      state.units.soldier = 5
      const initialPop = state.totalPopulation
      FACTIONS_DATA.zealots.applyReactiveTrait(state, 60, 2000)
      expect(state.unrest).toBe(80)
      expect(state.units.soldier).toBe(3)
      expect(state.totalPopulation).toBe(initialPop - 2)
    })
  })

  describe('National Archive Perks Application', () => {
    it('applies starting_treasury and charter_of_liberties correctly', () => {
      const state = createInitialGameState()
      const initialAp = state.ap
      const initialUnrest = state.unrest

      applyArchivePerks(state, ['starting_treasury', 'charter_of_liberties'])
      expect(state.ap).toBe(initialAp + 150)
      expect(state.unrest).toBe(Math.max(0, initialUnrest - 8))
    })

    it('applies standing_vanguard preserving Population Balance Equation', () => {
      const state = createInitialGameState()
      const initialPop = state.totalPopulation
      const initialSerfs = state.freeSerfs

      applyArchivePerks(state, ['standing_vanguard'])
      expect(state.units.soldier).toBe(25)
      expect(state.freeSerfs).toBe(initialSerfs)
      expect(state.totalPopulation).toBe(initialPop + 25)

      // Verify Population Balance Invariant: TotalPop = FreeSerfs + sum(Units)
      const unitSum = Object.values(state.units).reduce((a, b) => a + b, 0)
      expect(state.totalPopulation).toBe(state.freeSerfs + unitSum)
    })

    it('allows 6th active law slot when sixth_law_slot perk is active', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.activeLaws = [
        'law:royal_scriptorium',
        'law:general_cadastre',
        'law:census_edict',
        'law:standing_garrisons',
        'law:merit_pay',
      ]
      state.currentLawDraft = ['law:scorched_earth']

      // Without perk: 5 laws max, 6th should fail
      const failRes = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:scorched_earth' })
      expect(failRes.success).toBe(false)
      expect(failRes.error).toContain('Maximum active law capacity (5) reached')

      // With sixth_law_slot perk: 6 laws allowed
      applyArchivePerks(state, ['sixth_law_slot'])
      const passRes = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:scorched_earth' })
      expect(passRes.success).toBe(true)
      expect(state.activeLaws).toHaveLength(6)
    })
  })

  describe('Royal Feats Evaluation', () => {
    it('evaluates royal_pacifist only on victory with 0 military recruits', () => {
      const state = createInitialGameState()
      state.isVictory = true
      state.militaryRecruitedCount = 0

      let feats = evaluateFeats(state)
      expect(feats).toContain('royal_pacifist')

      state.militaryRecruitedCount = 2
      feats = evaluateFeats(state)
      expect(feats).not.toContain('royal_pacifist')

      state.militaryRecruitedCount = 0
      state.isVictory = false
      feats = evaluateFeats(state)
      expect(feats).not.toContain('royal_pacifist')
    })

    it('evaluates scout_butcher when 20 or more scouts are sacrificed', () => {
      const state = createInitialGameState()
      state.units.scout = 25
      state.totalPopulation = 200

      for (let i = 0; i < 20; i++) {
        performScoutReroll(state, DEFAULT_ENGINE_CONFIG)
      }
      expect(state.scoutsSacrificed).toBe(20)
      const feats = evaluateFeats(state)
      expect(feats).toContain('scout_butcher')
    })

    it('evaluates fiscal_paradise, iron_bailout, and unyielding_governance on victory', () => {
      const state = createInitialGameState()
      state.isVictory = true
      state.taxRateViolated15 = false
      state.lombardBailoutAccepted = true
      state.strikes = 0

      const feats = evaluateFeats(state)
      expect(feats).toContain('fiscal_paradise')
      expect(feats).toContain('iron_bailout')
      expect(feats).toContain('unyielding_governance')
    })

    it('evaluates croesus_of_the_realm, the_six_seals, and imperial_barony', () => {
      const state = createInitialGameState()
      state.totalCumulativeAp = 1_500_000
      state.activeLaws = ['1', '2', '3', '4', '5', '6']
      state.provinces = 8

      const feats = evaluateFeats(state)
      expect(feats).toContain('croesus_of_the_realm')
      expect(feats).toContain('the_six_seals')
      expect(feats).toContain('imperial_barony')
    })
  })

  describe('Run Scoring & Dynastic Titles', () => {
    it('calculates run score correctly based on §13.1 formula', () => {
      const state = createInitialGameState({
        totalCumulativeAp: 250_000, // 2,500 pts
        peakPopulation: 1_200, // 2,400 pts
        provinces: 6, // 3,000 pts
        victoriesCount: 5, // 1,000 pts
        strikes: 1, // -1,000 pts
      })
      // Expected: 2500 + 2400 + 3000 + 1000 - 1000 = 7900
      expect(calculateRunScore(state)).toBe(7900)
    })

    it('assigns dynastic defeat titles based on defeat reason', () => {
      const state = createInitialGameState()
      state.isGameOver = true
      state.isVictory = false

      state.defeatReason = 'bankruptcy'
      expect(getDynasticTitle(state)).toBe('Bankrupt Beggar')

      state.defeatReason = 'revolution'
      expect(getDynasticTitle(state)).toBe('The Fallen Tyrant')

      state.defeatReason = 'conquest'
      expect(getDynasticTitle(state)).toBe('The Subjugated Vassal')

      state.defeatReason = 'quota_failure'
      expect(getDynasticTitle(state)).toBe('The Disgraced Regent')
    })

    it('assigns dynastic victory titles based on royal accomplishments', () => {
      const state = createInitialGameState()
      state.isGameOver = true
      state.isVictory = true

      // The Bloodied Conqueror (provinces >= 8)
      state.capturedProvincesCount = 8
      expect(getDynasticTitle(state)).toBe('The Bloodied Conqueror')

      // Father of the Nation (pop >= 4000, 0 starvation)
      state.capturedProvincesCount = 0
      state.provinces = 5
      state.totalPopulation = 4200
      state.starvationLosses = 0
      expect(getDynasticTitle(state)).toBe('Father of the Nation')

      // Grand Treasurer of the Crown (> 60% of score from administration)
      state.totalPopulation = 500
      state.provinces = 3
      state.victoriesCount = 0
      state.strikes = 0
      state.totalCumulativeAp = 1_000_000 // 10,000 AP pts
      // peakPop 500 * 2 = 1000, prov 3 * 500 = 1500. Total = 12500. 10000 / 12500 = 80% > 60%
      expect(getDynasticTitle(state)).toBe('Grand Treasurer of the Crown')

      // Universal Sovereign (balanced)
      state.totalCumulativeAp = 50_000 // 500 AP pts
      state.peakPopulation = 1000 // 2000 pts
      state.provinces = 4 // 2000 pts
      state.victoriesCount = 5 // 1000 pts
      expect(getDynasticTitle(state)).toBe('Universal Sovereign')
    })
  })

  describe('Run statistics', () => {
    it('tracks peak population while growing', () => {
      const state = createInitialGameState({ seed: 3 })
      let peak = state.peakPopulation
      for (let i = 0; i < 900; i++) {
        tick(state, 0.1)
        peak = Math.max(peak, state.totalPopulation)
        expect(state.peakPopulation).toBe(Math.max(peak, state.peakPopulation))
        expect(state.peakPopulation).toBeGreaterThanOrEqual(state.totalPopulation)
      }
      expect(state.peakPopulation).toBe(peak)
      expect(state.peakPopulation).toBeGreaterThan(100)
    })

    it('counts a campaign win as a victory', () => {
      const state = createInitialGameState({ seed: 3 })
      state.phase = 'EXPEDITION'
      state.units.man_at_arms = 50
      state.currentTarget = {
        power: 1,
        uncertaintyMargin: 0,
        biome: 'trade_hub',
        lootType: 'ap',
        isFalseLedger: false,
        isAmbush: false,
      }
      const res = dispatch(state, { type: 'LAUNCH_ATTACK' })
      expect(res.success).toBe(true)
      expect(state.provinces).toBe(4)
      expect(state.victoriesCount).toBe(1)
      expect(state.capturedProvincesCount).toBe(1)
    })

    it('titles The Bloodied Conqueror on 8 captured provinces, not 8 held', () => {
      const state = createInitialGameState()
      state.isGameOver = true
      state.isVictory = true
      state.provinces = 11
      state.capturedProvincesCount = 3
      expect(getDynasticTitle(state)).not.toBe('The Bloodied Conqueror')
      state.capturedProvincesCount = 8
      expect(getDynasticTitle(state)).toBe('The Bloodied Conqueror')
    })
  })
})
