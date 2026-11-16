/**
 * The missive after a fight: what it cost and what it won, read from the state before and after,
 * so it can be kept with the chronicle and shown again.
 *
 * @module ui/report
 */

import { calculateEnemyPower } from '@/core/battle'
import type { EngineConfig } from '@/core/config'
import { calculateMilitaryPower } from '@/core/engine'
import type { Command, GameState } from '@/core/types'
import { raidPower } from '@/ui/moments'
import { formatCompact } from '@/ui/realmText'

/** One line of a missive. */
export interface ReportLine {
  label: string
  figure: string
}

/** A fight as the field writes it home. */
export interface BattleReport {
  eyebrow: string
  title: string
  won: boolean
  lines: ReportLine[]
}

function signed(value: number): string {
  return `${value > 0 ? '+' : '−'}${formatCompact(Math.abs(value))}`
}

function soldiers(state: GameState): number {
  return (state.units.soldier ?? 0) + (state.units.man_at_arms ?? 0)
}

function campaignTitle(gained: boolean, won: boolean): string {
  if (gained) return 'The land is yours.'
  return won ? 'They won, but could not hold the land.' : 'Your host was beaten.'
}

function provincesLine(before: GameState, after: GameState): ReportLine {
  const moved = after.provinces - before.provinces
  return {
    label: 'Provinces',
    figure: moved === 0 ? 'none' : `${signed(moved)}, now ${after.provinces}`,
  }
}

function costLines(before: GameState, config: EngineConfig, after: GameState): ReportLine[] {
  const lost = soldiers(before) - soldiers(after)
  const unrest = Math.round(after.unrest - before.unrest)
  const lines: ReportLine[] = [
    { label: 'Soldiers lost', figure: `${lost} of ${soldiers(before)}` },
    {
      label: 'Force left',
      figure: formatCompact(calculateMilitaryPower(after, config)),
    },
    provincesLine(before, after),
  ]
  if (unrest !== 0) lines.push({ label: 'Unrest', figure: signed(unrest) })
  return lines
}

function gainLines(before: GameState, after: GameState): ReportLine[] {
  const coffer = Math.round(after.ap - before.ap)
  const people = after.totalPopulation - before.totalPopulation + soldiers(before) - soldiers(after)
  const lines: ReportLine[] = []
  if (coffer > 0) lines.push({ label: 'Loot', figure: `${formatCompact(coffer)} AP` })
  if (coffer < 0) lines.push({ label: 'Coffer', figure: `${signed(coffer)} AP` })
  if (people !== 0) lines.push({ label: 'People', figure: signed(people) })
  return lines
}

function forceLines(before: GameState, config: EngineConfig, theirs: number): ReportLine[] {
  return [
    { label: 'Your force', figure: formatCompact(calculateMilitaryPower(before, config)) },
    { label: 'Their force', figure: formatCompact(theirs) },
  ]
}

function campaignReport(before: GameState, config: EngineConfig, after: GameState): BattleReport {
  const gained = after.provinces > before.provinces
  const won = after.victoriesCount > before.victoriesCount
  const target = before.currentTarget
  const theirs = target ? calculateEnemyPower(target, config) : 0
  return {
    eyebrow: target?.isAmbush ? 'A missive from the field: an ambush' : 'A missive from the field',
    title: campaignTitle(gained, won),
    won,
    lines: [
      ...forceLines(before, config, theirs),
      ...costLines(before, config, after),
      ...gainLines(before, after),
    ],
  }
}

function defenceReport(
  before: GameState,
  config: EngineConfig,
  after: GameState,
  theirs: number,
): BattleReport {
  const held = after.provinces >= before.provinces
  return {
    eyebrow: 'A missive from the border',
    title: held ? 'Your host held the border.' : 'The line broke.',
    won: held,
    lines: [
      ...forceLines(before, config, theirs),
      ...costLines(before, config, after),
      ...gainLines(before, after),
    ],
  }
}

/**
 * Writes the missive of a fight, or null for any other command.
 *
 * @param command - The command dispatched.
 * @param before - Copy of the run before the dispatch.
 * @param after - The run after the dispatch.
 */
export function battleReport(
  command: Command,
  config: EngineConfig,
  before: GameState,
  after: GameState,
): BattleReport | null {
  switch (command.type) {
    case 'LAUNCH_ATTACK':
      return campaignReport(before, config, after)
    case 'RESOLVE_RAID_DEFENSE':
      return defenceReport(before, config, after, raidPower(before, config))
    case 'SELECT_THREAT_RESPONSE': {
      const theirs = before.currentThreatPower
      if (command.response === 'defense') return defenceReport(before, config, after, theirs)
      const paid = command.response === 'tribute'
      return {
        eyebrow: 'A missive from the border',
        title: paid ? 'They took the gold and turned back.' : 'The levy drove them off.',
        won: true,
        lines: [...costLines(before, config, after), ...gainLines(before, after)].filter(
          (line) => line.label !== 'Force left' || !paid,
        ),
      }
    }
    default:
      return null
  }
}
