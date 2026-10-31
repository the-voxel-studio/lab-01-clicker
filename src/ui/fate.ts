/**
 * The fate of a reign: what the last screen before the register says, from the state alone. Whether
 * a quota was missed comes from the audit outcome. No amount is named: the audit strips its scoped
 * modifiers before this screen, so the target it used is gone from the state.
 *
 * @module ui/fate
 */

import { DEFAULT_ENGINE_CONFIG } from '@/core/config'
import type { GameState } from '@/core/types'
import { COUNT_WORDS, FATE } from '@/data/fateCopy'
import { auditOrdinal, formatFigure } from '@/ui/realmText'
import type { RunOutcome } from '@/ui/runRecord'

const config = DEFAULT_ENGINE_CONFIG

/** What the fate screen says. */
export interface FateView {
  outcome: Exclude<RunOutcome, 'abandoned'>
  title: string
  line: string
  foot: string
}

function outcomeOf(state: GameState): FateView['outcome'] {
  if (state.phase === 'RUN_VICTORY') return 'victory'
  return state.defeatReason ?? 'quota_failure'
}

/** Time since the coronation, as the foot of a fate writes it. */
function reignLength(state: GameState): string {
  const seconds = Math.floor(state.totalElapsedSeconds)
  return `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

/** The first unmet quota, AP then people then army; null without an audit. */
function firstShortfall(state: GameState): string | null {
  const outcome = state.lastAuditOutcome
  if (!outcome) return null
  if (!outcome.apMet) return 'your AP'
  if (!outcome.popMet) return 'your people'
  return outcome.militaryMet ? null : 'your army'
}

function fateLine(state: GameState, outcome: FateView['outcome']): string {
  const audit = `the ${auditOrdinal(state.deadline)} audit`
  switch (outcome) {
    case 'quota_failure': {
      const shortfall = firstShortfall(state)
      const counted = shortfall
        ? `The Crown found ${shortfall} short at ${audit}.`
        : `The Crown found you wanting at ${audit}.`
      return `${counted} Your name is crossed out of every register in the realm.`
    }
    case 'revolution':
      return `They took the chancery, then the ledgers, then you. Unrest reached its end at ${audit}.`
    case 'bankruptcy':
      return `Every coin, every tower, every debt, collected in full at ${audit}. Nothing is left to audit.`
    case 'conquest':
      return `Your last tower has fallen at ${audit}. Fortune's wheel has turned.`
    case 'victory': {
      const total = config.balance.TOTAL_DEADLINES
      const count = COUNT_WORDS[total] ?? formatFigure(total)
      return `${count} audits passed. The Crown's auditor lays down his pen.`
    }
  }
}

function fateFoot(state: GameState, outcome: FateView['outcome']): string {
  const audit = `the ${auditOrdinal(state.deadline)} audit`
  const length = reignLength(state)
  switch (outcome) {
    case 'quota_failure':
      return `fell at ${audit} after ${length}`
    case 'revolution':
      return `overthrown at ${audit} after ${length}`
    case 'bankruptcy':
      return `bankrupt at ${audit}`
    case 'conquest':
      return `conquered at ${audit} after ${length}`
    case 'victory':
      return `reigned ${length}`
  }
}

/** Reads the fate of a concluded reign. */
export function fateView(state: GameState): FateView {
  const outcome = outcomeOf(state)
  return {
    outcome,
    title: FATE[outcome].title,
    line: fateLine(state, outcome),
    foot: fateFoot(state, outcome),
  }
}
