/**
 * Plan V2_DIFFICULTY, Task 4: every view of a hard reign shows the reign's own demands, never the
 * ordinary ones, and no view in the interface falls back on the default configuration.
 *
 * @module __tests__/unit/level_views.spec
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { generateCampaignTarget } from '@/core/battle'
import { quotaForDeadline, type EngineConfig } from '@/core/config'
import { effectiveQuota } from '@/core/engine'
import { createInitialGameState } from '@/core/state'
import type { AuditOutcome, GameState } from '@/core/types'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { realmRules } from '@/data/rulesCopy'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import { observeChange } from '@/ui/chronicle'
import { adviseCounsel } from '@/ui/counsel'
import { realmRecap } from '@/ui/crownRecap'
import { computeDread } from '@/ui/dread'
import { realmRates } from '@/ui/effects'
import { configForLevel } from '@/ui/levelConfig'
import { hostLine } from '@/ui/orderRows'
import { formatCompact } from '@/ui/realmText'
import { warForecast } from '@/ui/war'

const ORDINARY = configForLevel('ordinary')
const TYRANNICAL = configForLevel('tyrannical')
const DEADLINE = 5
const SURCHARGE_STEPS = 2

/** A reign at the fifth audit, past two paid conquests, so both the factor and the step show. */
function hardReign(): GameState {
  const state = createInitialGameState({ seed: 3 })
  state.phase = 'ACTIVE_CYCLE'
  state.deadline = DEADLINE
  state.crownSurchargeSteps = SURCHARGE_STEPS
  state.units.soldier = 10
  return state
}

function required(state: GameState, config: EngineConfig) {
  return effectiveQuota(state, quotaForDeadline(config, DEADLINE), state.activeModifiers, config)
}

function outcome(state: GameState): AuditOutcome {
  return {
    deadline: DEADLINE,
    apMet: true,
    popMet: true,
    militaryMet: true,
    passedCount: 3,
    success: true,
    royalPardonIssued: false,
    isGameOver: false,
    victory: false,
    grossApRate: required(state, TYRANNICAL).apRate + 1,
  }
}

describe('Task 4: every view reads the reign config', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('asks more of a tyrannical reign than of an ordinary one, step included', () => {
    const state = hardReign()
    const hard = required(state, TYRANNICAL)
    const row = quotaForDeadline(TYRANNICAL, DEADLINE)
    expect(hard.pop).toBeCloseTo(row.pop * (1 + 0.15 * SURCHARGE_STEPS))
    expect(hard.pop).toBeGreaterThan(required(state, ORDINARY).pop)
  })

  it('shows the tyrannical demands, surcharge included, on the tally sticks', () => {
    setActivePinia(createPinia())
    useArchivesStore().load()
    useSettingsStore().load()
    const game = useGameStore()
    game.begin(3, 'tyrannical')
    game.run!.deadline = DEADLINE
    game.run!.crownSurchargeSteps = SURCHARGE_STEPS
    game.act({ type: 'STAMP_DOCUMENT' })
    const hard = required(game.run!, TYRANNICAL)
    expect(game.quotas.map((quota) => quota.required)).toEqual([
      hard.apRate,
      hard.pop,
      hard.military,
    ])
  })

  it('counsels against the tyrannical demands it is given', () => {
    const state = hardReign()
    const hard = required(state, TYRANNICAL)
    const quotas = [
      { axis: 'ap' as const, current: 0, required: hard.apRate, met: false },
      { axis: 'pop' as const, current: 0, required: hard.pop, met: false },
      { axis: 'military' as const, current: 0, required: hard.military, met: false },
    ]
    expect(adviseCounsel(state, TYRANNICAL, quotas, 'uneasy', 50).text.length).toBeGreaterThan(0)
  })

  it('names the tyrannical force demand on the Host', () => {
    const state = hardReign()
    expect(hostLine(state, TYRANNICAL).title).toContain(
      `The Crown wants ${formatCompact(required(state, TYRANNICAL).military)}`,
    )
  })

  it('shows the tyrannical surcharge on the Crown Realm tab', () => {
    const state = hardReign()
    expect(realmRecap(state, TYRANNICAL, realmRates(state, TYRANNICAL)).surcharge).toBe(30)
    expect(realmRecap(state, ORDINARY, realmRates(state, ORDINARY)).surcharge).toBe(10)
  })

  it('forecasts a conquest against the tyrannical demands and step', () => {
    const state = hardReign()
    generateCampaignTarget(state, TYRANNICAL)
    const forecast = warForecast(state, TYRANNICAL)!
    expect(forecast.step).toBe(0.15)
    expect(forecast.quotasBefore).toEqual(required(state, TYRANNICAL))
  })

  it('writes the audit in the chronicle against the tyrannical demands', () => {
    const state = hardReign()
    const before = observeChange(null, TYRANNICAL, state, 'enchanted', 0).snapshot
    state.lastAuditOutcome = outcome(state)
    const [audit] = observeChange(before, TYRANNICAL, state, 'enchanted', 1).entries.filter(
      (entry) => entry.kind === 'audit',
    )
    const hard = required(state, TYRANNICAL)
    expect(audit?.text).toContain(`of ${formatCompact(hard.pop)},`)
  })

  it('reads the shortfall against the tyrannical demands in the dread', () => {
    const state = hardReign()
    state.totalPopulation = Math.round(required(state, ORDINARY).pop)
    state.deadlineTimeSeconds = 80
    expect(computeDread(state, TYRANNICAL).score).toBeGreaterThan(
      computeDread(state, ORDINARY).score,
    )
  })

  it('states the surcharge step of the reign in the rules', () => {
    const rule = (config: EngineConfig) =>
      realmRules(config).find((entry) => entry.text.includes('further one'))?.text
    expect(rule(ORDINARY)).toContain('by 5%')
    expect(rule(TYRANNICAL)).toContain('by 15%')
  })

  it('lets a dilemma read the AP demand of the reign', () => {
    const state = hardReign()
    state.lastAuditOutcome = {
      ...outcome(state),
      grossApRate: quotaForDeadline(ORDINARY, DEADLINE).apRate * 1.2,
    }
    const scribe = DILEMMAS_DATA['dilemma:scribe_counted_too_much']!
    expect(scribe.trigger(state, ORDINARY)).toBe(false)
    expect(scribe.trigger(state, TYRANNICAL)).toBe(true)
  })
})

/** Reads of the default configuration that no level changes, each with its reason. */
const ALLOWED_READS: readonly { pattern: RegExp; reason: string }[] = [
  {
    pattern: /DEFAULT_ENGINE_CONFIG\.balance\.DEADLINE_DURATION_SECONDS/g,
    reason: 'every level keeps the length of an audit',
  },
  {
    pattern: /DEFAULT_ENGINE_CONFIG\.balance\.FAST_FORWARD_MIN_DEADLINE/g,
    reason: 'every level opens double speed at the same audit',
  },
  {
    pattern: /DEFAULT_ENGINE_CONFIG\.balance\.TOTAL_DEADLINES/g,
    reason: 'every level has the same number of audits',
  },
  {
    pattern: /import \{[^}]*\bDEFAULT_ENGINE_CONFIG\b[^}]*\} from '@\/core\/config'/g,
    reason: 'the import of an allowed read',
  },
]
/** Builds the levels from the default configuration. */
const ALLOWED_FILES = new Set(['src/ui/levelConfig.ts'])

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|vue)$/.test(name) ? [path] : []
  })
}

describe('Task 4: no view keeps the default configuration', () => {
  it('reads DEFAULT_ENGINE_CONFIG in the interface only for what no level changes', () => {
    const offenders: string[] = []
    for (const file of ['src/ui', 'src/data', 'src/components', 'src/stores'].flatMap(sources)) {
      if (ALLOWED_FILES.has(file)) continue
      let text = readFileSync(file, 'utf8')
      for (const { pattern } of ALLOWED_READS) text = text.replace(pattern, '')
      if (/\bDEFAULT_ENGINE_CONFIG\b/.test(text)) offenders.push(file)
    }
    expect(offenders).toEqual([])
  })
})
