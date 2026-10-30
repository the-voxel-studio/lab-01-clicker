/**
 * Chronicle of the realm: short entries written from what changed in the run (audits, deaths,
 * money), from the player's commands, and folklore that carries the dread band in words
 * (design 4.2, fourth and fifth passes). Pure functions; the chronicle store keeps the entries.
 *
 * @module ui/chronicle
 */

import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import { calculateMilitaryPower, calculateNetApRate, effectiveQuota } from '@/core/engine'
import type { AuditOutcome, Command, DispatchResult, GameState, UnitId } from '@/core/types'
import { FOLKLORE, UNIT_NAMES } from '@/data/chronicleCopy'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { LAWS_DATA } from '@/data/laws'
import type { DreadBand } from '@/ui/dread'
import { formatCompact } from '@/ui/realmText'

/** What an entry tells: the player's decisions, audits, folklore, deaths or money. */
export type ChronicleKind = 'decision' | 'audit' | 'folklore' | 'death' | 'money'

/** How an audit ended, kept on its entry to title the audit in the chronicle. */
export type AuditVerdict = 'passed' | 'pardoned' | 'failed'

/** One line of the chronicle; `deadline` 0 is the coronation. */
export interface ChronicleEntry {
  id: number
  deadline: number
  reignSeconds: number
  kind: ChronicleKind
  text: string
  verdict?: AuditVerdict
  /** Lets a repeated command add to this line instead of writing a new one. */
  merge?: ChronicleMerge
}

/** What a mergeable command line adds up: a unit's purchases, or the tax rate's moves. */
export interface ChronicleMerge {
  key: string
  count: number
  cost: number
  unit?: UnitId
  fromRate?: number
  rate?: number
}

/** What the chronicle remembers of the run between two observations. */
export interface RunSnapshot {
  auditKey: string | null
  starvationLosses: number
  populationHundreds: number
  bankrupt: boolean
  /** True from the "coffer is empty" line until the rescue is told. */
  bankruptcyTold: boolean
  /** Reign seconds since the coffer has stayed above zero, or null. */
  solventSince: number | null
  band: DreadBand
  /** Worst band reached in the current audit, and that audit. */
  worstBand: DreadBand
  worstDeadline: number
  lastFolkloreSeconds: number
  lastFolkloreText: string | null
  /** Starvation losses already told, and when the last death line was written. */
  lossesTold: number
  lastDeathSeconds: number
}

const FOLKLORE_INTERVAL_SECONDS = 25
const BAND_ORDER: readonly DreadBand[] = ['enchanted', 'uneasy', 'rotting', 'death_throes']
const NARROW_MARGIN = 10
/** A rescue is told only once the coffer has stayed above zero this long. */
const RECOVERY_SECONDS = 5
/** Starvation is told by the soul count, and at most this often. */
const DEATH_THRESHOLD = 2
const DEATH_INTERVAL_SECONDS = 10
/** Repeated purchases or tax moves this close together share one line. */
const MERGE_WINDOW_SECONDS = 10

const figure = (value: number): string => formatCompact(value)
const decimal = (value: number): string => formatCompact(value, 1)

/** Formats seconds of reign as `m:ss`. */
export function formatReignClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function isBankrupt(state: GameState): boolean {
  return state.ap <= 0 && calculateNetApRate(state, DEFAULT_ENGINE_CONFIG) < 0
}

function auditKeyOf(outcome: AuditOutcome | null): string | null {
  return outcome ? `${outcome.deadline}:${outcome.success}:${outcome.royalPardonIssued}` : null
}

/** The audit verdict, then its figures as a second sentence. */
function verdictOf(outcome: AuditOutcome): AuditVerdict {
  if (!outcome.success) return 'failed'
  return outcome.royalPardonIssued ? 'pardoned' : 'passed'
}

function auditText(state: GameState, outcome: AuditOutcome): string {
  const required = effectiveQuota(state, quotaForDeadline(DEFAULT_ENGINE_CONFIG, outcome.deadline))
  const figures =
    `AP ${decimal(outcome.grossApRate)} of ${decimal(required.apRate)}, ` +
    `People ${figure(state.totalPopulation)} of ${figure(required.pop)}, ` +
    `Army ${decimal(calculateMilitaryPower(state))} of ${decimal(required.military)}.`
  const margin = outcome.grossApRate - required.apRate
  let verdict: string
  if (!outcome.success) verdict = 'Audit failed. The Crown marks a strike against you.'
  else if (outcome.royalPardonIssued)
    verdict = 'Audit passed with the Royal Pardon. You will not get another.'
  else if (!outcome.apMet) verdict = 'Audit passed, though the Chancery fell short.'
  else if (margin < NARROW_MARGIN)
    verdict = `Audit passed by ${decimal(margin)} AP. The Crown is satisfied.`
  else verdict = 'Audit passed. The Crown sends a cask of wine and a warning.'
  return `${verdict} ${figures}`
}

/** Deterministic pick from the seed and the entry id, never the same line twice in a row. */
function pickFolklore(band: DreadBand, seed: number, nextId: number, last: string | null): string {
  const lines = FOLKLORE[band]
  let hash = (seed ^ Math.imul(nextId + 1, 0x9e3779b1)) >>> 0
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b) >>> 0
  let index = hash % lines.length
  if (lines[index] === last) index = (index + 1) % lines.length
  return lines[index] ?? lines[0] ?? ''
}

/**
 * Compares the run with the last snapshot and returns the entries to write and the new snapshot.
 * Without a snapshot it writes the coronation.
 *
 * @param before - Snapshot of the last observation, or null at the coronation.
 * @param state - The run now.
 * @param band - Current dread band.
 * @param nextId - Id of the first entry written; later entries count up from it.
 */
export function observeChange(
  before: RunSnapshot | null,
  state: GameState,
  band: DreadBand,
  nextId: number,
): { entries: ChronicleEntry[]; snapshot: RunSnapshot } {
  const entries: ChronicleEntry[] = []
  const write = (
    kind: ChronicleKind,
    text: string,
    deadline = state.deadline,
    verdict?: AuditVerdict,
  ): void => {
    const entry: ChronicleEntry = {
      id: nextId + entries.length,
      deadline,
      reignSeconds: state.totalElapsedSeconds,
      kind,
      text,
    }
    if (verdict) entry.verdict = verdict
    entries.push(entry)
  }
  const now = state.totalElapsedSeconds
  const sameAudit = before?.worstDeadline === state.deadline
  const snapshot: RunSnapshot = {
    auditKey: auditKeyOf(state.lastAuditOutcome),
    starvationLosses: state.starvationLosses,
    populationHundreds: Math.floor(state.peakPopulation / 100),
    bankrupt: isBankrupt(state),
    bankruptcyTold: before?.bankruptcyTold ?? false,
    solventSince: before?.solventSince ?? null,
    band,
    worstBand: before && sameAudit ? before.worstBand : band,
    worstDeadline: state.deadline,
    lastFolkloreSeconds: before?.lastFolkloreSeconds ?? now,
    lastFolkloreText: before?.lastFolkloreText ?? null,
    lossesTold: before?.lossesTold ?? state.starvationLosses,
    lastDeathSeconds: before?.lastDeathSeconds ?? -DEATH_INTERVAL_SECONDS,
  }

  if (!before) {
    write(
      'audit',
      `You are crowned before a crowd of ${figure(state.totalPopulation)}. Someone in the back does not cheer.`,
      0,
    )
    return { entries, snapshot }
  }

  const outcome = state.lastAuditOutcome
  if (outcome && snapshot.auditKey !== before.auditKey) {
    write('audit', auditText(state, outcome), outcome.deadline, verdictOf(outcome))
  }
  const lost = Math.floor(state.starvationLosses - snapshot.lossesTold)
  if (lost >= DEATH_THRESHOLD && now - snapshot.lastDeathSeconds >= DEATH_INTERVAL_SECONDS) {
    write(
      'death',
      `Death reaped ${figure(lost)} souls in the marsh villages. The priest blames the fog.`,
    )
    snapshot.lossesTold += lost
    snapshot.lastDeathSeconds = now
  }
  if (snapshot.populationHundreds > before.populationHundreds) {
    write(
      'folklore',
      `A child is born in Ashford. The People reach ${figure(state.totalPopulation)}.`,
    )
  }
  // A seal pressed on an empty coffer lifts it for a few frames only: tell the danger once and
  // the rescue only when it lasts.
  if (snapshot.bankrupt) {
    snapshot.solventSince = null
    if (!snapshot.bankruptcyTold) {
      write('money', "The coffer is empty. The Lombard's men are on the road.")
      snapshot.bankruptcyTold = true
    }
  } else if (state.ap > 0) {
    snapshot.solventSince ??= now
    if (snapshot.bankruptcyTold && now - snapshot.solventSince >= RECOVERY_SECONDS) {
      write(
        'money',
        `The near bankruptcy was averted: the Lombard's men turned back at the bridge with ${figure(state.ap)} AP to spare.`,
      )
      snapshot.bankruptcyTold = false
    }
  }

  // Only a new worst band of the audit is told at once; a band flickering at a threshold is not.
  const worsened = BAND_ORDER.indexOf(band) > BAND_ORDER.indexOf(snapshot.worstBand)
  if (worsened) snapshot.worstBand = band
  const due = now - before.lastFolkloreSeconds >= FOLKLORE_INTERVAL_SECONDS
  if (worsened || due) {
    const text = pickFolklore(band, state.seed, nextId + entries.length, before.lastFolkloreText)
    write('folklore', text)
    snapshot.lastFolkloreSeconds = state.totalElapsedSeconds
    snapshot.lastFolkloreText = text
  }
  return { entries, snapshot }
}

function purchaseText(unit: UnitId, count: number, cost: number): string {
  const name = count === 1 ? UNIT_NAMES[unit].one : UNIT_NAMES[unit].many
  return `You recruited ${count} ${name} for ${figure(cost)} AP.`
}

function taxText(fromRate: number, rate: number): string {
  return rate >= fromRate ? `You raised the tax to ${rate}%.` : `You lowered the tax to ${rate}%.`
}

function mergeOf(
  command: Command,
  before: GameState,
  after: GameState,
): ChronicleMerge | undefined {
  if (command.type === 'BUY_UNIT') {
    return {
      key: `buy:${command.unitId}`,
      count: command.count,
      cost: before.ap - after.ap,
      unit: command.unitId,
    }
  }
  if (command.type === 'SET_TAX_RATE') {
    return { key: 'tax', count: 1, cost: 0, fromRate: before.taxRate, rate: command.rate }
  }
  return undefined
}

/**
 * Folds a new command line into the previous one when both repeat the same purchase or move the
 * tax, in the same audit and within a few seconds; null when they must stay two lines.
 */
export function mergeEntries(
  previous: ChronicleEntry,
  next: ChronicleEntry,
): ChronicleEntry | null {
  const a = previous.merge
  const b = next.merge
  if (!a || !b || a.key !== b.key || previous.deadline !== next.deadline) return null
  if (next.reignSeconds - previous.reignSeconds > MERGE_WINDOW_SECONDS) return null
  const merge: ChronicleMerge = { ...b, count: a.count + b.count, cost: a.cost + b.cost }
  let text: string
  if (b.unit) {
    text = purchaseText(b.unit, merge.count, merge.cost)
  } else {
    merge.fromRate = a.fromRate
    text = taxText(a.fromRate ?? 0, b.rate ?? 0)
  }
  return { ...previous, reignSeconds: next.reignSeconds, text, merge }
}

/** The chronicle line of a command, or null when it is not worth a line. */
function commandText(command: Command, before: GameState, after: GameState): string | null {
  switch (command.type) {
    case 'BUY_UNIT':
      if ((before.units[command.unitId] ?? 0) === 0 && command.count === 1) {
        return `You hired your first ${UNIT_NAMES[command.unitId].one}.`
      }
      return purchaseText(command.unitId, command.count, before.ap - after.ap)
    case 'SET_TAX_RATE':
      return taxText(before.taxRate, command.rate)
    case 'ENACT_LAW': {
      const law = LAWS_DATA[command.lawId]
      return law ? `You sealed the ${law.name}.` : null
    }
    case 'RESOLVE_DILEMMA': {
      const choice = DILEMMAS_DATA[command.dilemmaId]?.choices[command.choiceIndex]
      return choice ? `You chose: ${choice.text}` : null
    }
    case 'REFUSE_LOMBARD_LOAN':
      return 'You refused the Lombard. He smiled.'
    case 'ACCEPT_LOMBARD_LOAN':
      return "You took the Lombard's gold."
    default:
      return null
  }
}

/**
 * Builds the chronicle entry of a dispatched command; null for a refused command, the seal and
 * the commands the chronicle does not tell.
 *
 * @param before - Copy of the run before the dispatch.
 * @param after - The run after the dispatch.
 */
export function entryFromCommand(
  command: Command,
  result: DispatchResult,
  before: GameState,
  after: GameState,
  nextId: number,
): ChronicleEntry | null {
  if (!result.success) return null
  const text = commandText(command, before, after)
  if (text === null) return null
  const kind: ChronicleKind =
    command.type === 'REFUSE_LOMBARD_LOAN' || command.type === 'ACCEPT_LOMBARD_LOAN'
      ? 'money'
      : 'decision'
  const entry: ChronicleEntry = {
    id: nextId,
    deadline: after.deadline,
    reignSeconds: after.totalElapsedSeconds,
    kind,
    text,
  }
  const merge = mergeOf(command, before, after)
  if (merge) entry.merge = merge
  return entry
}
