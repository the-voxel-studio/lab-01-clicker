/**
 * Plan 04 Task 1: the moments model.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { dispatch } from '@/core/commands'
import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import { calculateNetApRate, evaluateDeadlineAudit } from '@/core/engine'
import { canAffordEffects } from '@/core/modifiers'
import { createInitialGameState } from '@/core/state'
import type { GameState, RunPhase } from '@/core/types'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { LAWS_DATA } from '@/data/laws'
import { MOMENT_COPY } from '@/data/momentCopy'
import { FACTIONS_DATA, SCHEDULED_THREATS_DATA } from '@/data/threats'
import { isMomentPhase, momentView, type MomentView } from '@/ui/moments'

const config = DEFAULT_ENGINE_CONFIG
const { balance } = config

function stateIn(phase: RunPhase): GameState {
  const state = createInitialGameState({ seed: 7 })
  state.phase = phase
  return state
}

function view(state: GameState): MomentView {
  const moment = momentView(state)
  if (!moment) throw new Error('expected a moment')
  return moment
}

function audited(overrides: Partial<NonNullable<GameState['lastAuditOutcome']>>): GameState {
  const state = stateIn('AUDIT_ASSESSMENT')
  state.deadline = 3
  state.lastAuditOutcome = {
    deadline: 3,
    apMet: true,
    popMet: true,
    militaryMet: true,
    passedCount: 3,
    success: true,
    royalPardonIssued: false,
    isGameOver: false,
    victory: false,
    grossApRate: 2400,
    ...overrides,
  }
  return state
}

function heraldFor(deadline: number): GameState {
  const state = stateIn('THREAT_HERALD')
  state.deadline = deadline - 1
  state.currentThreatId = deadline
  state.currentThreatPower = 70
  state.currentThreatTributeAp = 1900
  state.provinces = 3
  state.provinceBiomes = ['heartland', 'farmlands', 'heartland']
  state.ap = 5000
  return state
}

describe('Task 1: moments model', () => {
  let state: GameState

  beforeEach(() => {
    state = stateIn('ACTIVE_CYCLE')
  })

  it('has no letter outside the six moments', () => {
    for (const phase of [
      'ACTIVE_CYCLE',
      'EXPEDITION',
      'AWAIT_RESUME',
      'RUN_DEFEAT',
      'RUN_VICTORY',
    ] as const) {
      state.phase = phase
      expect(isMomentPhase(phase)).toBe(false)
      expect(momentView(state)).toBeNull()
    }
    expect(isMomentPhase(null)).toBe(false)
    expect(isMomentPhase('LOMBARD_OFFER')).toBe(true)
  })

  it('tells a clean audit, a narrow one and a pardon apart', () => {
    const clean = view(audited({}))
    const narrow = view(audited({ apMet: false, passedCount: 2 }))
    const pardon = view(audited({ success: false, royalPardonIssued: true, passedCount: 1 }))
    expect(new Set([clean.title, narrow.title, pardon.title]).size).toBe(3)
    expect(pardon.body).toMatch(/province/)
    expect(pardon.body).toMatch(/50% of your coffer/)
  })

  it('copies met or unmet from the outcome, whatever the figures say', () => {
    const moment = view(audited({ popMet: false, passedCount: 2 }))
    expect(moment.quotas.map((line) => line.met)).toEqual([true, false, true])
    const flattering = audited({ apMet: false, grossApRate: 999999, passedCount: 2 })
    expect(view(flattering).quotas[0]?.met).toBe(false)
  })

  it('reads the AP line as a rate from the outcome', () => {
    const moment = view(audited({ grossApRate: 2400 }))
    expect(moment.quotas[0]?.figure).toBe('2.4k AP/s')
    expect(moment.answers.map((answer) => answer.command)).toEqual([{ type: 'SUBMIT_AUDIT' }])
  })

  it('splits every dilemma into two answers with their cost apart', () => {
    for (const dilemma of Object.values(DILEMMAS_DATA)) {
      const council = stateIn('COUNCIL_DILEMMA')
      council.currentDilemmaId = dilemma.id
      const moment = view(council)
      expect(moment.title).toBe(dilemma.name)
      expect(moment.answers).toHaveLength(2)
      moment.answers.forEach((answer, index) => {
        expect(answer.label).not.toMatch(/[()]/)
        expect(dilemma.choices[index]?.text).toBe(`${answer.label} (${answer.detail})`)
      })
    }
  })

  it('blocks the dilemma choice the coffer cannot bear', () => {
    const council = stateIn('COUNCIL_DILEMMA')
    council.ap = 0
    const costly = Object.values(DILEMMAS_DATA).find((dilemma) =>
      dilemma.choices.some(
        (choice) => !canAffordEffects(council, choice.effects, calculateNetApRate(council, config)),
      ),
    )
    council.currentDilemmaId = costly!.id
    const blocked = view(council).answers.filter((answer) => answer.command === null)
    expect(blocked.length).toBeGreaterThan(0)
    expect(blocked[0]?.blocked).toBe('The coffer cannot bear it')
  })

  it('reads every law description without a pipe', () => {
    for (const law of Object.values(LAWS_DATA)) {
      const council = stateIn('COUNCIL_LAWS')
      council.ap = 1e7
      council.currentLawDraft = [law.id]
      const answer = view(council).answers[0]!
      expect(answer.label).toBe(law.name)
      expect(answer.detail).not.toContain('|')
    }
  })

  it('states why a law cannot pass, and always offers to reject', () => {
    const council = stateIn('COUNCIL_LAWS')
    council.ap = 1e7
    const [chancellor] = Object.values(LAWS_DATA).filter((law) => law.order === 'chancellor')
    council.currentLawDraft = [chancellor!.id]
    council.activeLaws = Array.from({ length: balance.LAW_SLOTS_BASE }, (_, i) => `law:held_${i}`)
    expect(view(council).answers[0]?.blocked).toBe('The council is full')

    council.activeLaws = []
    council.ruleFlags = ['law:marshals_carte_blanche']
    expect(view(council).answers[0]?.blocked).toBe('The Marshal forbids it')

    const reject = view(council).answers.at(-1)!
    expect(reject.command).toEqual({ type: 'REJECT_LAWS' })
    expect(reject.detail).toContain('+1 archive point')
  })

  it('never offers what the engine refuses', () => {
    const cases: GameState[] = [audited({}), heraldFor(4), stateIn('SURPRISE_RAID')]
    for (const dilemma of Object.values(DILEMMAS_DATA)) {
      const council = stateIn('COUNCIL_DILEMMA')
      council.currentDilemmaId = dilemma.id
      cases.push(council)
    }
    for (const law of Object.values(LAWS_DATA)) {
      const council = stateIn('COUNCIL_LAWS')
      council.currentLawDraft = [law.id]
      cases.push(council)
    }
    const lombard = stateIn('LOMBARD_OFFER')
    lombard.provinces = 3
    lombard.provinceBiomes = ['heartland', 'farmlands', 'heartland']
    cases.push(lombard)
    for (const moment of cases) {
      for (const answer of view(moment).answers) {
        if (!answer.command) continue
        const result = dispatch(structuredClone(moment), answer.command, config)
        expect({ answer: answer.label, error: result.error }).toEqual({
          answer: answer.label,
          error: undefined,
        })
      }
    }
  })

  it('names the herald from the catalogs and shows the exact threat', () => {
    const moment = view(heraldFor(4))
    const threat = SCHEDULED_THREATS_DATA.find((item) => item.deadline === 4)!
    expect(moment.title).toBe(threat.title)
    expect(moment.eyebrow).toContain(FACTIONS_DATA[threat.factionId].name)
    expect(moment.clash?.theirs).toBe(70)
    expect(moment.note).toBe('The council will not rise until you answer.')
    expect(moment.answers.map((answer) => answer.label)).toEqual([
      'Stand and fight',
      'Pay the tribute',
      'Raise the levy',
    ])
    expect(moment.answers[2]?.tone).toBe('grave')
  })

  it('prices the tribute, and blocks it below the price', () => {
    const herald = heraldFor(4)
    expect(view(herald).answers[1]?.detail).toContain('1.9k AP')
    herald.ap = 100
    const tribute = view(herald).answers[1]!
    expect(tribute.command).toBeNull()
    expect(tribute.blocked).toBe('The coffer cannot pay it')
  })

  it('states what a lost fight costs, the legions taking two provinces', () => {
    expect(view(heraldFor(4)).answers[0]?.detail).toContain('one province')
    expect(view(heraldFor(4)).answers[0]?.detail).toContain(`${balance.COLLAPSE_UNREST} unrest`)
    expect(view(heraldFor(10)).answers[0]?.detail).toContain('two provinces')
  })

  it('warns when the fight stakes the last province', () => {
    const herald = heraldFor(4)
    herald.provinces = 1
    herald.provinceBiomes = ['heartland']
    expect(view(herald).answers[0]?.detail).toContain('This is your last province.')
    const legions = heraldFor(10)
    legions.provinces = 2
    legions.provinceBiomes = ['heartland', 'farmlands']
    expect(view(legions).answers[0]?.detail).toContain('This is your last province.')
  })

  it('counts fortifications and men-at-arms in the force, rolls aside', () => {
    const herald = heraldFor(4)
    herald.units.soldier = 10
    const bare = view(herald).clash!.yours
    expect(bare).toBeGreaterThan(10)
    herald.units.man_at_arms = 5
    const armed = view(herald).clash!.yours
    expect(armed).toBeGreaterThan(bare)
    herald.provinceBiomes = ['stronghold', 'farmlands', 'heartland']
    expect(view(herald).clash!.yours).toBeGreaterThan(armed)
  })

  it('sizes the raid from the quota', () => {
    const raid = stateIn('SURPRISE_RAID')
    raid.deadline = 4
    const expected = Math.round(
      balance.RAID_POWER_QUOTA_SHARE * quotaForDeadline(config, 4).military,
    )
    const moment = view(raid)
    expect(moment.clash?.theirs).toBe(expected)
    expect(moment.answers.map((answer) => answer.command)).toEqual([
      { type: 'RESOLVE_RAID_DEFENSE' },
    ])
  })

  it('states the terms of the Lombard', () => {
    const lombard = stateIn('LOMBARD_OFFER')
    const moment = view(lombard)
    expect(moment.answers.map((answer) => answer.command)).toEqual([
      { type: 'ACCEPT_LOMBARD_LOAN' },
      { type: 'REFUSE_LOMBARD_LOAN' },
    ])
    expect(moment.answers[0]?.detail).toContain('2k AP')
    expect(moment.answers[0]?.detail).toContain('one province')
  })

  it('writes no dash and no middle dot anywhere', () => {
    const texts: string[] = []
    const collect = (moment: MomentView) => {
      texts.push(moment.eyebrow, moment.title, moment.body ?? '', moment.note ?? '')
      for (const answer of moment.answers) texts.push(answer.label, answer.detail ?? '')
    }
    for (const id of Object.keys(DILEMMAS_DATA)) {
      const council = stateIn('COUNCIL_DILEMMA')
      council.currentDilemmaId = id
      collect(view(council))
    }
    const laws = stateIn('COUNCIL_LAWS')
    laws.currentLawDraft = Object.keys(LAWS_DATA)
    collect(view(laws))
    collect(view(audited({})))
    collect(view(heraldFor(4)))
    collect(view(stateIn('SURPRISE_RAID')))
    collect(view(stateIn('LOMBARD_OFFER')))
    expect(texts.join(' ')).not.toMatch(/[–—·]/)
  })
})

describe('Task 8: final review of the letters', () => {
  function zealots(unrest: number, soldiers: number): GameState {
    const state = heraldFor(7)
    state.unrest = unrest
    state.units.soldier = soldiers
    return state
  }

  it('prints the target the audit used, after its scoped modifiers are gone', () => {
    const state = stateIn('ACTIVE_CYCLE')
    state.deadline = 3
    state.activeModifiers = [
      { source: 'test', stat: 'quota_requirement', op: 'mul', value: 0.5, untilNextAudit: true },
    ]
    const quota = quotaForDeadline(config, 3)
    const outcome = evaluateDeadlineAudit(state, config)
    state.activeModifiers = []
    expect(outcome.required).toEqual({
      apRate: quota.apRate / 2,
      pop: quota.pop / 2,
      military: quota.military / 2,
    })
    state.phase = 'AUDIT_ASSESSMENT'
    expect(view(state).quotas[1]?.figure).toContain(`of ${Math.ceil(quota.pop / 2)}`)
  })

  it('prints no target for an audit saved before the engine kept it', () => {
    for (const line of view(audited({})).quotas) expect(line.figure).not.toContain(' of ')
  })

  it('counts the defection of the Holy League in the levy and the fight', () => {
    expect(SCHEDULED_THREATS_DATA.find((item) => item.deadline === 7)?.factionId).toBe('zealots')
    const [fight, , levy] = view(zealots(61, 100)).answers
    expect(levy?.detail).toContain(`Unrest +${balance.LEVY_UNREST + 15}`)
    expect(levy?.detail).toContain('10 soldiers desert')
    expect(fight?.detail).toContain('Unrest +15')
    expect(fight?.detail).toContain('10 soldiers desert')
    expect(view(zealots(60, 100)).answers[2]?.detail).toContain(`Unrest +${balance.LEVY_UNREST},`)
  })

  it('compares the threat with the force left after the desertions', () => {
    expect(view(zealots(61, 100)).clash?.yours).toBe(view(zealots(50, 90)).clash?.yours)
  })

  it('warns of a levy the engine turns into a revolution', () => {
    const state = zealots(61, 100)
    expect(view(state).answers[2]?.detail).toContain(MOMENT_COPY.herald.fatalUnrest)
    dispatch(state, { type: 'SELECT_THREAT_RESPONSE', response: 'levy' })
    expect(state.defeatReason).toBe('revolution')

    const plain = heraldFor(4)
    plain.unrest = 70
    expect(view(plain).answers[2]?.detail).toContain(MOMENT_COPY.herald.fatalUnrest)
    plain.unrest = 69
    expect(view(plain).answers[2]?.detail).not.toContain(MOMENT_COPY.herald.fatalUnrest)
  })

  it('warns of a fight lost before it starts', () => {
    expect(view(zealots(85, 100)).answers[0]?.detail).toContain(MOMENT_COPY.herald.fatalUnrest)
    expect(view(zealots(84, 100)).answers[0]?.detail).not.toContain(MOMENT_COPY.herald.fatalUnrest)
  })
})
