/**
 * The decision moments: what each phase that takes the reign's answer shows in its letter. Whether
 * a quota was met comes from the audit outcome, never from the figures: the audit strips its own
 * scoped modifiers before the letter opens, so the quotas read afterwards may differ.
 *
 * @module ui/moments
 */

import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import { calculateMilitaryPower, calculateNetApRate, scopedQuota } from '@/core/engine'
import { canAffordEffects, composeStat, extractRawEvaluationState } from '@/core/modifiers'
import { hasRule } from '@/core/rules'
import type { AuditOutcome, Command, GameState, RunPhase } from '@/core/types'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import type { GameIconKey } from '@/data/icons'
import { LAWS_DATA, type LawDef } from '@/data/laws'
import { MOMENT_COPY } from '@/data/momentCopy'
import {
  FACTIONS_DATA,
  SCHEDULED_THREATS_DATA,
  type FactionTraitResult,
  type ScheduledThreatDef,
} from '@/data/threats'
import { auditOrdinal, formatCompact } from '@/ui/realmText'

const config = DEFAULT_ENGINE_CONFIG
const { balance } = config

const MOMENT_PHASES: readonly RunPhase[] = [
  'AUDIT_ASSESSMENT',
  'COUNCIL_DILEMMA',
  'COUNCIL_LAWS',
  'THREAT_HERALD',
  'SURPRISE_RAID',
  'LOMBARD_OFFER',
]

/** One answer of a letter; a blocked answer has no command and says why. */
export interface MomentAnswer {
  label: string
  detail: string | null
  command: Command | null
  blocked: string | null
  tone: 'plain' | 'grave'
  icon: GameIconKey
}

/** One quota of an audit verdict. */
export interface QuotaLine {
  label: string
  figure: string
  met: boolean
}

/** Your defensive force against theirs, rolls aside. */
export interface ClashView {
  yours: number
  theirs: number
}

/** Everything a letter shows. */
export interface MomentView {
  kind: 'audit' | 'dilemma' | 'laws' | 'herald' | 'raid' | 'lombard'
  eyebrow: string
  title: string
  body: string | null
  quotas: QuotaLine[]
  clash: ClashView | null
  answers: MomentAnswer[]
  note: string | null
}

/** True while the reign stands on a letter that must be answered. */
export function isMomentPhase(phase: RunPhase | null): boolean {
  return phase !== null && MOMENT_PHASES.includes(phase)
}

function answer(
  label: string,
  detail: string | null,
  command: Command,
  icon: GameIconKey,
): MomentAnswer {
  return { label, detail, command, blocked: null, tone: 'plain', icon }
}

function blockedWhen(item: MomentAnswer, blocked: string | null): MomentAnswer {
  return blocked ? { ...item, command: null, blocked } : item
}

function letter(
  kind: MomentView['kind'],
  eyebrow: string,
  title: string,
  answers: MomentAnswer[],
  extra: Partial<Pick<MomentView, 'body' | 'quotas' | 'clash' | 'note'>> = {},
): MomentView {
  return {
    kind,
    eyebrow,
    title,
    body: null,
    quotas: [],
    clash: null,
    note: null,
    answers,
    ...extra,
  }
}

function auditTitle(outcome: AuditOutcome): string {
  if (!outcome.success) return MOMENT_COPY.audit.pardon
  return outcome.passedCount >= 3 ? MOMENT_COPY.audit.clean : MOMENT_COPY.audit.narrow
}

/**
 * What an audit counted against what it asked. The targets come from the outcome: its scoped
 * modifiers are gone from the state, and a save from before the field shows the held figure alone.
 */
export function quotaLines(state: GameState, outcome: AuditOutcome): QuotaLine[] {
  const figure = (held: number, target: number | undefined): string =>
    target === undefined
      ? formatCompact(held)
      : `${formatCompact(held)} of ${formatCompact(target, 0, 'up')}`
  const { required } = outcome
  return [
    {
      label: 'AP',
      figure: `${figure(outcome.grossApRate, required?.apRate)} AP/s`,
      met: outcome.apMet,
    },
    { label: 'People', figure: figure(state.totalPopulation, required?.pop), met: outcome.popMet },
    {
      label: 'Force',
      figure: figure(calculateMilitaryPower(state, config), required?.military),
      met: outcome.militaryMet,
    },
  ]
}

function auditMoment(state: GameState): MomentView | null {
  const outcome = state.lastAuditOutcome
  if (!outcome) return null
  const share = Math.round(balance.ROYAL_CENSURE_AP_CONFISCATION * 100)
  return letter(
    'audit',
    `The ${auditOrdinal(outcome.deadline)} audit`,
    auditTitle(outcome),
    [answer(MOMENT_COPY.audit.answer, null, { type: 'SUBMIT_AUDIT' }, 'crown')],
    {
      body: outcome.royalPardonIssued ? MOMENT_COPY.audit.pardonBody(share) : null,
      quotas: quotaLines(state, outcome),
    },
  )
}

/** Splits `Do this (its cost)` into the deed and its cost. */
function splitChoice(text: string): { label: string; detail: string | null } {
  const match = /^(.*\S)\s*\(([^()]*)\)$/.exec(text)
  return match?.[1] && match[2]
    ? { label: match[1], detail: match[2] }
    : { label: text.replace(/[()]/g, ''), detail: null }
}

function dilemmaMoment(state: GameState): MomentView | null {
  const id = state.currentDilemmaId
  const dilemma = id === null ? undefined : DILEMMAS_DATA[id]
  if (!dilemma || id === null) return null
  const netApRate = calculateNetApRate(state, config)
  const answers = dilemma.choices.map((choice, choiceIndex) => {
    const { label, detail } = splitChoice(choice.text)
    return blockedWhen(
      answer(label, detail, { type: 'RESOLVE_DILEMMA', dilemmaId: id, choiceIndex }, 'scroll'),
      canAffordEffects(state, choice.effects, netApRate) ? null : MOMENT_COPY.blocked.bear,
    )
  })
  return letter('dilemma', MOMENT_COPY.dilemma.eyebrow, dilemma.name, answers, {
    body: dilemma.description,
  })
}

/** Seats of the council for a law, as `ENACT_LAW` counts them. */
function lawSeats(state: GameState, law: LawDef): number {
  const seats = Math.floor(
    composeStat(
      'law_slots',
      balance.LAW_SLOTS_BASE,
      state.activeModifiers,
      extractRawEvaluationState(state),
    ),
  )
  const concordat = hasRule(state, 'law:papal_concordat') && law.id !== 'law:papal_concordat'
  return concordat ? seats - 1 : seats
}

function lawBlock(state: GameState, law: LawDef, netApRate: number): string | null {
  if (law.order === 'chancellor' && hasRule(state, 'law:marshals_carte_blanche')) {
    return MOMENT_COPY.blocked.marshal
  }
  if (state.activeLaws.length >= lawSeats(state, law)) return MOMENT_COPY.blocked.full
  return canAffordEffects(state, law.effects, netApRate) ? null : MOMENT_COPY.blocked.bear
}

function lawsMoment(state: GameState): MomentView {
  const netApRate = calculateNetApRate(state, config)
  const laws = state.currentLawDraft.flatMap((id) => {
    const law = LAWS_DATA[id]
    if (!law) return []
    const detail = law.description.replaceAll(' | ', '. ').replace(/\.\.$/, '.')
    return [
      blockedWhen(
        answer(law.name, detail, { type: 'ENACT_LAW', lawId: id }, 'lawDecree'),
        lawBlock(state, law, netApRate),
      ),
    ]
  })
  return letter('laws', MOMENT_COPY.laws.eyebrow, MOMENT_COPY.laws.title, [
    ...laws,
    answer(
      MOMENT_COPY.laws.reject,
      MOMENT_COPY.laws.rejectDetail,
      { type: 'REJECT_LAWS' },
      'cancel',
    ),
  ])
}

/** Defensive force as `resolveDefensiveClash` counts it, with a roll of 1. */
function defensiveForce(state: GameState): number {
  const strongholds = state.provinceBiomes.filter((biome) => biome === 'stronghold').length
  const factor = hasRule(state, 'law:guerrilla_border_watch')
    ? balance.GUERRILLA_STRONGHOLD_FACTOR
    : 1
  return Math.floor(
    calculateMilitaryPower(state, config) * (1 + balance.DEFENDER_FORTIFICATION_BONUS) +
      strongholds * balance.BORDER_STRONGHOLD_DEFENSE_FLAT * factor +
      (state.units.man_at_arms ?? 0) * balance.MAN_AT_ARMS_DEFENSE_FLAT,
  )
}

function fightDetail(
  state: GameState,
  provincesAtStake: number,
  yours: number,
  theirs: number,
): string {
  const lost = provincesAtStake > 1 ? 'two provinces' : 'one province'
  const stakes = `Your force ${formatCompact(yours)} against their ${formatCompact(theirs, 0, 'up')}. Losing costs ${lost}, the whole army, part of your people and coffer, and ${balance.COLLAPSE_UNREST} unrest.`
  return state.provinces <= provincesAtStake
    ? `${stakes} ${MOMENT_COPY.herald.lastProvince}`
    : stakes
}

/** What facing a threat costs before the first blow, as `forecastThreatTrait` reads it. */
function threatToll(
  state: GameState,
  deadline: number,
  factionId: ScheduledThreatDef['factionId'],
): Pick<FactionTraitResult, 'unrestDelta' | 'soldierDesertions'> {
  return FACTIONS_DATA[factionId].applyReactiveTrait(
    state,
    state.currentThreatPower,
    state.currentThreatTributeAp,
    {
      militaryPower: calculateMilitaryPower(state, config),
      militaryQuota: scopedQuota(state, quotaForDeadline(config, deadline)).military,
    },
  )
}

function withoutDeserters(state: GameState, deserters: number): GameState {
  const soldiers = Math.max(0, (state.units.soldier ?? 0) - deserters)
  return { ...state, units: { ...state.units, soldier: soldiers } }
}

function deserterWords(deserters: number): string {
  if (deserters <= 0) return ''
  return deserters === 1 ? ' 1 soldier deserts.' : ` ${deserters} soldiers desert.`
}

function fatalUnrestWords(state: GameState, added: number): string {
  return state.unrest + added >= 100 ? ` ${MOMENT_COPY.herald.fatalUnrest}` : ''
}

function heraldMoment(state: GameState): MomentView {
  const threat = SCHEDULED_THREATS_DATA.find(
    (item) => item.deadline === (state.currentThreatId ?? state.deadline + 1),
  )
  const faction = threat ? FACTIONS_DATA[threat.factionId] : undefined
  const theirs = state.currentThreatPower
  const tribute = state.currentThreatTributeAp
  const provincesAtStake = threat?.factionId === 'imperial_legions' ? 2 : 1
  const levyOdds = Math.round(1 / balance.LEVY_CASUALTY_SHARE)
  const toll = threat
    ? threatToll(state, threat.deadline, threat.factionId)
    : { unrestDelta: 0, soldierDesertions: 0 }
  const yours = defensiveForce(withoutDeserters(state, toll.soldierDesertions))
  const desert = deserterWords(toll.soldierDesertions)
  const levyUnrest = balance.LEVY_UNREST + toll.unrestDelta
  const defection = toll.unrestDelta > 0 ? ` Unrest +${toll.unrestDelta}.${desert}` : desert
  return letter(
    'herald',
    faction ? `A herald of the ${faction.name}` : 'A herald',
    threat?.title ?? 'A herald at the gate',
    [
      answer(
        MOMENT_COPY.herald.fight,
        `${fightDetail(state, provincesAtStake, yours, theirs)}${defection}${fatalUnrestWords(state, toll.unrestDelta)}`,
        {
          type: 'SELECT_THREAT_RESPONSE',
          response: 'defense',
        },
        'threatRepel',
      ),
      blockedWhen(
        answer(
          MOMENT_COPY.herald.tribute,
          `${formatCompact(tribute, 0, 'up')} AP leave the coffer. The Crown will notice the hole.`,
          { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' },
          'threatTribute',
        ),
        state.ap < tribute ? MOMENT_COPY.blocked.pay : null,
      ),
      {
        ...answer(
          MOMENT_COPY.herald.levy,
          `They are driven off. Unrest +${levyUnrest}, and one in ${levyOdds} of your people dies.${desert}${fatalUnrestWords(state, levyUnrest)}`,
          { type: 'SELECT_THREAT_RESPONSE', response: 'levy' },
          'threatLevy',
        ),
        tone: 'grave',
      },
    ],
    {
      body: MOMENT_COPY.herald.body,
      clash: { yours, theirs },
      note: MOMENT_COPY.herald.note,
    },
  )
}

/** Power of the raid, as `RESOLVE_RAID_DEFENSE` composes it. */
export function raidPower(state: GameState): number {
  const base = Math.round(
    balance.RAID_POWER_QUOTA_SHARE * quotaForDeadline(config, state.deadline).military,
  )
  const factor = composeStat(
    'threat_power',
    1,
    state.activeModifiers,
    extractRawEvaluationState(state),
  )
  return Math.max(0, Math.round(base * factor))
}

function raidMoment(state: GameState): MomentView {
  const theirs = raidPower(state)
  return letter(
    'raid',
    MOMENT_COPY.raid.eyebrow,
    MOMENT_COPY.raid.title,
    [
      answer(
        MOMENT_COPY.raid.answer,
        fightDetail(state, 1, defensiveForce(state), theirs),
        {
          type: 'RESOLVE_RAID_DEFENSE',
        },
        'threatRepel',
      ),
    ],
    { body: MOMENT_COPY.raid.body, clash: { yours: defensiveForce(state), theirs } },
  )
}

function lombardMoment(state: GameState): MomentView {
  const seconds = Math.ceil(state.bankruptcyGraceTimer)
  const loan = formatCompact(balance.LOMBARD_BAILOUT_AP)
  return letter(
    'lombard',
    MOMENT_COPY.lombard.eyebrow,
    MOMENT_COPY.lombard.title,
    [
      answer(
        MOMENT_COPY.lombard.accept,
        `+${loan} AP for one province. The countdown starts afresh.`,
        { type: 'ACCEPT_LOMBARD_LOAN' },
        'coins',
      ),
      answer(
        MOMENT_COPY.lombard.refuse,
        MOMENT_COPY.lombard.refuseDetail,
        {
          type: 'REFUSE_LOMBARD_LOAN',
        },
        'cancel',
      ),
    ],
    { body: `${seconds} seconds before the realm is seized.` },
  )
}

/** The letter of the current phase, or null when the reign is not waiting on one. */
export function momentView(state: GameState): MomentView | null {
  switch (state.phase) {
    case 'AUDIT_ASSESSMENT':
      return auditMoment(state)
    case 'COUNCIL_DILEMMA':
      return dilemmaMoment(state)
    case 'COUNCIL_LAWS':
      return lawsMoment(state)
    case 'THREAT_HERALD':
      return heraldMoment(state)
    case 'SURPRISE_RAID':
      return raidMoment(state)
    case 'LOMBARD_OFFER':
      return lombardMoment(state)
    default:
      return null
  }
}
