/**
 * Unit tests for the 30 Imperial Laws and 20 Steward Dilemmas (Task 2.3, GAME_RULES §9, §10).
 *
 * @module __tests__/unit/laws_dilemmas.spec
 */

import { describe, it, expect } from 'vitest'
import { createInitialGameState } from '@/core/state'
import type { GameState } from '@/core/types'
import { LAWS_DATA } from '@/data/laws'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import { dispatch, hasAffordableChoice } from '@/core/commands'
import { exportSaveToBase64, importSaveFromBase64 } from '@/core/migrations'
import { createArchiveData } from '@/core/archives'
import { hasRule } from '@/core/rules'
import { applyEffect, composeStat, extractRawEvaluationState } from '@/core/modifiers'
import {
  calculateGrossApRate,
  calculateMaxPopulation,
  calculateMilitaryPower,
  calculateNetApRate,
  calculateNetPaperwork,
  tick,
} from '@/core/engine'
import { dilemmaOf, lawOf } from './catalog_lookup'

describe('Task 2.3: Imperial Laws (30) & Steward Dilemmas (20)', () => {
  describe('Catalogs Completeness & Integrity', () => {
    it('contains exactly 30 imperial laws distributed equally across 3 orders', () => {
      const laws = Object.values(LAWS_DATA)
      expect(laws.length).toBe(30)

      const chancellor = laws.filter((l) => l.order === 'chancellor')
      const prelate = laws.filter((l) => l.order === 'prelate')
      const marshal = laws.filter((l) => l.order === 'marshal')

      expect(chancellor.length).toBe(10)
      expect(prelate.length).toBe(10)
      expect(marshal.length).toBe(10)
    })

    it('contains exactly 20 steward dilemmas with binary choices', () => {
      const dilemmas = Object.values(DILEMMAS_DATA)
      expect(dilemmas.length).toBe(20)

      for (const d of dilemmas) {
        expect(d.choices.length).toBe(2)
        expect(typeof d.trigger).toBe('function')
      }
    })
  })

  describe('Council Sequence & Deterministic Drafting', () => {
    it('deterministically drafts an eligible dilemma on entering COUNCIL_DILEMMA', () => {
      const state = createInitialGameState({ seed: 777 })
      state.phase = 'AUDIT_ASSESSMENT'
      state.unrest = 60 // Triggers peasant salt boycott

      const res = dispatch(state, { type: 'SUBMIT_AUDIT' })
      expect(res.success).toBe(true)
      expect(state.phase).toBe('COUNCIL_DILEMMA')
      expect(state.currentDilemmaId).toBeDefined()
      expect(state.currentDilemmaId).not.toBeNull()
      expect(DILEMMAS_DATA[state.currentDilemmaId!]).toBeDefined()
    })

    it('drafts 3 laws (1 per order) on entering COUNCIL_LAWS', () => {
      const state = createInitialGameState({ seed: 1234 })
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:taxable_windows'

      // Choice 1: Forbid tax
      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:taxable_windows',
        choiceIndex: 1,
      })
      expect(res.success).toBe(true)
      expect(state.phase).toBe('COUNCIL_LAWS')
      expect(state.currentLawDraft.length).toBe(3)

      const draftLaws = state.currentLawDraft.map((id) => LAWS_DATA[id]!)
      expect(draftLaws.some((l) => l.order === 'chancellor')).toBe(true)
      expect(draftLaws.some((l) => l.order === 'prelate')).toBe(true)
      expect(draftLaws.some((l) => l.order === 'marshal')).toBe(true)
    })
  })

  describe('Dilemma Choice Solvency & Application', () => {
    it('applies dilemma choice effects and advances to COUNCIL_LAWS', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:foreign_envoy_bribe'
      state.ap = 500
      state.unrest = 10

      // Choice 0: Accept gold (+1200 AP, +15 Unrest)
      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:foreign_envoy_bribe',
        choiceIndex: 0,
      })
      expect(res.success).toBe(true)
      expect(state.ap).toBe(1700)
      expect(state.unrest).toBe(25)
      expect(state.phase).toBe('COUNCIL_LAWS')
    })

    it('rejects an unaffordable dilemma choice without changing phase', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:astrologer_comet'
      state.ap = 100 // Costs 500 AP

      // Choice 1: Mass prayers (-500 AP, -25 Unrest)
      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:astrologer_comet',
        choiceIndex: 1,
      })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Cannot afford')
      expect(state.phase).toBe('COUNCIL_DILEMMA')
      expect(state.ap).toBe(100)
    })
  })

  describe('Law Enactment & Slot Limits', () => {
    it('records rule flags when a law is enacted', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = ['law:sanctuary_rights']
      expect(hasRule(state, 'law:sanctuary_rights')).toBe(false)

      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:sanctuary_rights' })
      expect(res.success).toBe(true)
      expect(hasRule(state, 'law:sanctuary_rights')).toBe(true)
      expect(state.ruleFlags).toEqual(['law:sanctuary_rights'])
    })

    it('keeps rule flags through an export and import round trip', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = ['law:sanctuary_rights']
      expect(dispatch(state, { type: 'ENACT_LAW', lawId: 'law:sanctuary_rights' }).success).toBe(
        true,
      )

      const imported = importSaveFromBase64(exportSaveToBase64(state, createArchiveData())).state
      expect(imported.ruleFlags).toEqual(state.ruleFlags)
      expect(hasRule(imported, 'law:sanctuary_rights')).toBe(true)
    })

    it('adds a rule flag only once', () => {
      const state = createInitialGameState()
      applyEffect({ type: 'rule_flag', flag: 'law:sanctuary_rights' }, state)
      applyEffect({ type: 'rule_flag', flag: 'law:sanctuary_rights' }, state)
      expect(state.ruleFlags).toEqual(['law:sanctuary_rights'])
    })

    it('enacts drafted law, applies modifiers, and transitions to THREAT_HERALD', () => {
      const state = createInitialGameState()
      state.deadline = 2
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = [
        'law:royal_scriptorium',
        'law:holy_days_vigils',
        'law:standing_garrisons',
      ]

      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:royal_scriptorium' })
      expect(res.success).toBe(true)
      expect(state.activeLaws).toContain('law:royal_scriptorium')
      expect(state.activeModifiers.some((m) => m.source === 'law:royal_scriptorium')).toBe(true)
      expect(state.phase).toBe('THREAT_HERALD')
    })

    it('rejects enacting a law that is not in the current draft', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = [
        'law:royal_scriptorium',
        'law:holy_days_vigils',
        'law:standing_garrisons',
      ]

      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:crown_monopolies' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('not in current council draft')
      expect(state.phase).toBe('COUNCIL_LAWS')
      expect(state.activeLaws).not.toContain('law:crown_monopolies')
    })

    it('rejects enacting beyond the 5 active law slot capacity', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.activeLaws = ['law:1', 'law:2', 'law:3', 'law:4', 'law:5']
      state.currentLawDraft = [
        'law:royal_scriptorium',
        'law:holy_days_vigils',
        'law:standing_garrisons',
      ]

      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:royal_scriptorium' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Maximum active law capacity')
      expect(state.phase).toBe('COUNCIL_LAWS')
    })

    it('rejects an unaffordable law without changing phase', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.ap = 50
      state.currentLawDraft = [
        'law:grand_kermesse',
        'law:holy_days_vigils',
        'law:standing_garrisons',
      ]

      // Grand Kermesse costs 40 s of net income, more than 50 AP here
      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:grand_kermesse' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('Cannot afford')
      expect(state.phase).toBe('COUNCIL_LAWS')
      expect(state.ap).toBe(50)
    })
  })

  describe('Council command integrity', () => {
    it('rejects resolving a dilemma other than the drafted one', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:rotting_grain_silos'
      state.ap = 500

      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:foreign_envoy_bribe',
        choiceIndex: 0,
      })
      expect(res.success).toBe(false)
      expect(state.ap).toBe(500)
      expect(state.phase).toBe('COUNCIL_DILEMMA')
    })

    it('rejects an unknown dilemma id', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_DILEMMA'
      state.currentDilemmaId = 'dilemma:rotting_grain_silos'

      const res = dispatch(state, {
        type: 'RESOLVE_DILEMMA',
        dilemmaId: 'dilemma:nope',
        choiceIndex: 0,
      })
      expect(res.success).toBe(false)
      expect(state.phase).toBe('COUNCIL_DILEMMA')
    })

    it('rejects a law when no draft exists', () => {
      const state = createInitialGameState()
      state.phase = 'COUNCIL_LAWS'
      state.currentLawDraft = []
      const ap = state.ap

      const res = dispatch(state, { type: 'ENACT_LAW', lawId: 'law:royal_scriptorium' })
      expect(res.success).toBe(false)
      expect(state.ap).toBe(ap)
      expect(state.phase).toBe('COUNCIL_LAWS')
    })

    it('never drafts a dilemma without an affordable choice', () => {
      const drafted: Array<string | null> = []
      const unaffordable: string[] = []
      for (let seed = 1; seed <= 50; seed++) {
        const state = createInitialGameState({
          seed,
          freeSerfs: 10,
          ap: 100,
          provinceBiomes: ['heartland', 'heartland', 'farmlands'],
        })
        state.phase = 'AUDIT_ASSESSMENT'
        const silos = DILEMMAS_DATA['dilemma:rotting_grain_silos']!
        expect(silos.trigger(state)).toBe(true)
        expect(hasAffordableChoice(state, silos)).toBe(false)

        dispatch(state, { type: 'SUBMIT_AUDIT' })
        drafted.push(state.currentDilemmaId)
        const def = state.currentDilemmaId ? DILEMMAS_DATA[state.currentDilemmaId] : undefined
        if (def && !hasAffordableChoice(state, def)) unaffordable.push(def.id)
      }
      expect(drafted).not.toContain('dilemma:rotting_grain_silos')
      expect(unaffordable).toEqual([])
    })

    it('skips the dilemma step when nothing qualifies', () => {
      const state = createInitialGameState({
        seed: 5,
        ap: 100,
        lastAuditOutcome: {
          deadline: 1,
          apMet: true,
          popMet: true,
          militaryMet: true,
          passedCount: 3,
          success: true,
          royalPardonIssued: false,
          isGameOver: false,
          victory: false,
          grossApRate: DEFAULT_ENGINE_CONFIG.quotas[0]!.apRate * 1.5,
        },
      })
      state.phase = 'AUDIT_ASSESSMENT'
      expect(Object.values(DILEMMAS_DATA).filter((d) => d.trigger(state))).toEqual([])

      const res = dispatch(state, { type: 'SUBMIT_AUDIT' })
      expect(res.success).toBe(true)
      expect(state.phase).toBe('COUNCIL_LAWS')
      expect(state.currentDilemmaId).toBeNull()
    })
  })
})

describe('GAME_RULES §9: dilemma trigger thresholds', () => {
  /**
   * Builds a fresh realm and applies a change to it.
   *
   * @param change - Mutation applied to the new state.
   * @returns The changed state.
   */
  function realm(change: (state: GameState) => void = () => {}): GameState {
    const state = createInitialGameState({ seed: 1 })
    change(state)
    return state
  }

  /**
   * Records the last audit with a given gross AP rate.
   *
   * @param state - State to change; its deadline 1 quota is 12 AP/s.
   * @param grossApRate - Gross AP rate seen by the last audit.
   */
  function auditedAt(state: GameState, grossApRate: number): void {
    state.lastAuditOutcome = {
      deadline: 1,
      apMet: true,
      popMet: true,
      militaryMet: true,
      passedCount: 3,
      success: true,
      royalPardonIssued: false,
      isGameOver: false,
      victory: false,
      grossApRate,
    }
  }

  const cases: ReadonlyArray<{
    id: string
    holds: GameState
    fails: GameState
    why: string
  }> = [
    {
      id: 'dilemma:taxable_windows',
      holds: realm((s) => (s.units.scribe = 297)),
      fails: realm((s) => (s.units.scribe = 296)),
      why: 'gross AP rate above 150 AP/s (strictly)',
    },
    {
      id: 'dilemma:scribe_counted_too_much',
      holds: realm((s) => auditedAt(s, 13)),
      fails: realm((s) => auditedAt(s, 14)),
      why: 'gross AP rate under 115% of the audited quota',
    },
    {
      id: 'dilemma:cabinet_scarcity',
      holds: realm((s) => auditedAt(s, 37)),
      fails: realm((s) => auditedAt(s, 36)),
      why: 'gross AP rate above 300% of the audited quota',
    },
    {
      id: 'dilemma:peasant_salt_boycott',
      holds: realm((s) => (s.unrest = 51)),
      fails: realm((s) => (s.unrest = 50)),
      why: 'unrest above 50',
    },
    {
      id: 'dilemma:runaway_serfs',
      holds: realm((s) => {
        s.totalPopulation = 1000
        s.freeSerfs = 149
      }),
      fails: realm((s) => {
        s.totalPopulation = 1000
        s.freeSerfs = 150
      }),
      why: 'free serfs under 15% of the population',
    },
    {
      id: 'dilemma:wandering_troubadours',
      holds: realm((s) => {
        s.deadline = 3
        s.unrest = 34
      }),
      fails: realm((s) => {
        s.deadline = 3
        s.unrest = 35
      }),
      why: 'deadline 3 or later and unrest under 35',
    },
    {
      id: 'dilemma:false_relic_merchant',
      holds: realm((s) => {
        s.units.clergy = 3
        s.units.prelate = 2
      }),
      fails: realm((s) => {
        s.units.clergy = 3
        s.units.prelate = 1
      }),
      why: 'clergy and prelates together at least 5',
    },
    {
      id: 'dilemma:foreign_envoy_bribe',
      holds: realm((s) => (s.provinces = 4)),
      fails: realm((s) => (s.provinces = 3)),
      why: 'at least 4 provinces',
    },
    {
      id: 'dilemma:deserting_mercenaries',
      holds: realm((s) => (s.ap = 0)),
      fails: realm((s) => (s.ap = 1)),
      why: 'treasury at or below 0',
    },
    {
      id: 'dilemma:ghost_scribes',
      holds: realm((s) => (s.units.scribe = 20)),
      fails: realm((s) => (s.units.scribe = 19)),
      why: 'at least 20 scribes',
    },
    {
      id: 'dilemma:inquisitor_demand',
      holds: realm((s) => (s.unrest = 70)),
      fails: realm((s) => (s.unrest = 69)),
      why: 'unrest at least 70',
    },
    {
      id: 'dilemma:auditor_nephew',
      holds: realm((s) => (s.deadline = 5)),
      fails: realm((s) => (s.deadline = 4)),
      why: 'deadline 5 or later',
    },
    {
      id: 'dilemma:smugglers_cove',
      holds: realm((s) => (s.provinceBiomes = ['heartland', 'heartland', 'trade_hub'])),
      fails: realm(),
      why: 'a Trade Hub province held',
    },
    {
      id: 'dilemma:boundary_dispute',
      holds: realm((s) => (s.deadline = 4)),
      fails: realm((s) => (s.deadline = 3)),
      why: 'deadline 4 or later',
    },
    {
      id: 'dilemma:crowns_forced_loan',
      holds: realm((s) => (s.ap = 5001)),
      fails: realm((s) => (s.ap = 5000)),
      why: 'treasury above 5000 AP',
    },
    {
      id: 'dilemma:mutinous_quartermaster',
      holds: realm((s) => {
        s.units.soldier = 20
        s.units.man_at_arms = 3
        s.units.sergeant = 2
      }),
      fails: realm((s) => {
        s.units.soldier = 24
        s.units.scout = 10
        s.units.quartermaster = 5
      }),
      why: 'at least 25 soldiers, men-at-arms, sergeants and captains',
    },
    {
      id: 'dilemma:astrologer_comet',
      holds: realm((s) => (s.deadline = 9)),
      fails: realm((s) => (s.deadline = 10)),
      why: 'deadline 8 or 9',
    },
  ]

  it.each(cases)('$id needs $why', ({ id, holds, fails }) => {
    expect(dilemmaOf(id).trigger(holds)).toBe(true)
    expect(dilemmaOf(id).trigger(fails)).toBe(false)
  })

  it('brackets the taxable windows threshold within 1 AP/s on both sides', () => {
    const holds = calculateGrossApRate(cases[0]!.holds).total
    const fails = calculateGrossApRate(cases[0]!.fails).total
    expect(cases[0]!.id).toBe('dilemma:taxable_windows')
    expect(holds).toBeGreaterThan(150)
    expect(holds).toBeLessThan(151)
    expect(fails).toBeLessThanOrEqual(150)
    expect(fails).toBeGreaterThan(149)
  })

  it('opens the comet at deadline 8 and not at deadline 7', () => {
    expect(dilemmaOf('dilemma:astrologer_comet').trigger(realm((s) => (s.deadline = 8)))).toBe(true)
    expect(dilemmaOf('dilemma:astrologer_comet').trigger(realm((s) => (s.deadline = 7)))).toBe(
      false,
    )
  })
})

describe('GAME_RULES §10: law magnitudes', () => {
  /**
   * Builds the reference realm of the magnitude checks: 20 scribes, 40 soldiers.
   *
   * @returns A fresh state.
   */
  function referenceRealm(): GameState {
    const state = createInitialGameState({ seed: 1 })
    state.units.scribe = 20
    state.units.soldier = 40
    return state
  }

  /**
   * Applies every effect of a law to a state, as ENACT_LAW does.
   *
   * @param state - State that enacts the law.
   * @param lawId - Catalog id of the law.
   */
  function enact(state: GameState, lawId: string): void {
    const netRate = calculateNetApRate(state)
    for (const effect of lawOf(lawId).effects) applyEffect(effect, state, netRate)
  }

  /**
   * Measures a quantity before and after a law.
   *
   * @param lawId - Catalog id of the law.
   * @param measure - Quantity read from the reference realm.
   * @returns The ratio of the quantity after the law to the quantity before it.
   */
  function ratioUnder(lawId: string, measure: (state: GameState) => number): number {
    const state = referenceRealm()
    const before = measure(state)
    enact(state, lawId)
    return measure(state) / before
  }

  const gross = (state: GameState): number => calculateGrossApRate(state).total
  const pollTax = (state: GameState): number => calculateGrossApRate(state).pollTax
  const paperwork = (state: GameState): number => calculateNetPaperwork(state)

  it.each([
    ['law:exceptional_tithe', gross, 1.8],
    ['law:crown_monopolies', gross, 1.25],
    ['law:imperial_bond_floating', gross, 0.9],
    ['law:holy_days_vigils', gross, 0.9],
    ['law:parish_relief_registers', gross, 0.95],
    ['law:stamp_duty_monopoly', pollTax, 0.85],
    ['law:corvee_exemption_tax', pollTax, 1.3],
    ['law:monastic_granaries', pollTax, 0.9],
    ['law:royal_scriptorium', paperwork, 1.2],
    ['law:general_cadastre', paperwork, 0.75],
    ['law:chancery_red_tape', paperwork, 1.15],
    ['law:marshals_carte_blanche', calculateMilitaryPower, 1.25],
    ['law:primogeniture_decrees', calculateMaxPopulation, 1.2],
    ['law:census_edict', calculateMaxPopulation, 1.25],
  ] as const)('%s scales its measure by %s', (lawId, measure, ratio) => {
    expect(ratioUnder(lawId, measure)).toBeCloseTo(ratio, 6)
  })

  it('doubles the click power under Stamp Duty Monopoly', () => {
    const state = referenceRealm()
    enact(state, 'law:stamp_duty_monopoly')
    expect(composeStat('click_power', 1, state.activeModifiers)).toBeCloseTo(2, 10)
  })

  it('grants 3000 AP at once under Imperial Bond Floating', () => {
    const state = referenceRealm()
    const before = state.ap
    enact(state, 'law:imperial_bond_floating')
    expect(state.ap).toBe(before + 3000)
  })

  it('lowers the growth rate r by 20% under Primogeniture Decrees', () => {
    const state = referenceRealm()
    enact(state, 'law:primogeniture_decrees')
    const rawState = extractRawEvaluationState(state)
    expect(composeStat('pop_growth_rate', 0.005, state.activeModifiers, rawState)).toBeCloseTo(
      0.004,
      10,
    )
  })

  it('pacifies 0.20 Unrest/s more under Holy Days and Vigils', () => {
    const state = referenceRealm()
    state.unrest = 40
    enact(state, 'law:holy_days_vigils')
    tick(state, 1.0)
    expect(state.unrest).toBeCloseTo(39.8, 6)
  })

  it('cuts the base unrest generation by 40% under the Papal Concordat', () => {
    const plain = referenceRealm()
    plain.taxRate = 45
    tick(plain, 1.0)
    const concordat = referenceRealm()
    concordat.taxRate = 45
    enact(concordat, 'law:papal_concordat')
    tick(concordat, 1.0)
    expect(concordat.unrest - 10).toBeCloseTo((plain.unrest - 10) * 0.6, 6)
  })

  it('recruits 15 Men-at-Arms from the serfs and adds 20 Unrest under Feudal Retinue Levy', () => {
    const state = referenceRealm()
    const serfs = state.freeSerfs
    const population = state.totalPopulation
    const unrest = state.unrest
    enact(state, 'law:feudal_retinue_levy')
    expect(state.units.man_at_arms).toBe(15)
    expect(state.freeSerfs).toBe(serfs - 15)
    expect(state.totalPopulation).toBe(population)
    expect(state.unrest).toBe(unrest + 20)
  })
})
