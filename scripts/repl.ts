/**
 * Engine REPL: plays The Grand Audit from the terminal.
 *
 * Reads one line per command from stdin and prints a short state summary after each. `TICK <seconds>`
 * advances game time through `tick`; every other line is `<COMMAND_TYPE> <args...>`, turned into a
 * `Command` and passed to `dispatch`, the only way the REPL changes the state. A malformed or
 * unknown line prints an error line and the loop goes on.
 *
 * Usage: `npm run repl -- [--seed <n>]` (seed defaults to 1), then type lines such as
 * `BUY_UNIT scribe 1`, `TICK 10`, `SET_TAX_RATE 0.2`, `STAMP_DOCUMENT`. The REPL exits 0 at the end
 * of the input.
 *
 * @module scripts/repl
 */

import * as path from 'node:path'
import * as readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import type * as CommandsModule from '../src/core/commands'
import type * as EngineModule from '../src/core/engine'
import type * as StateModule from '../src/core/state'
import type * as BalanceModule from '../src/data/balance'
import type { Command, GameState, UnitId, UnitOrder } from '../src/core/types'

const scriptPath = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(path.dirname(scriptPath), '..')

/** Seed used when `--seed` is absent. */
const DEFAULT_SEED = 1

/** Engine entry points the REPL drives; loaded with jiti by `main`, passed in by tests. */
export interface ReplEngine {
  readonly dispatch: typeof CommandsModule.dispatch
  readonly tick: typeof EngineModule.tick
  readonly calculateMilitaryPower: typeof EngineModule.calculateMilitaryPower
  readonly createInitialGameState: typeof StateModule.createInitialGameState
  /** Every unit identifier, in catalog order. */
  readonly unitIds: readonly UnitId[]
}

/** What a typed line asks for. */
export type ParsedLine =
  | { readonly kind: 'blank' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'tick'; readonly seconds: number }
  | { readonly kind: 'command'; readonly command: Command }

/** Commands that take no argument, by their line keyword. */
const ZERO_ARGUMENT_COMMANDS: ReadonlyMap<string, Command> = new Map<string, Command>([
  ['STAMP_DOCUMENT', { type: 'STAMP_DOCUMENT' }],
  ['COLONISE_PROVINCE', { type: 'COLONISE_PROVINCE' }],
  ['SUBMIT_AUDIT', { type: 'SUBMIT_AUDIT' }],
  ['REJECT_LAWS', { type: 'REJECT_LAWS' }],
  ['RECON_PATROL', { type: 'RECON_PATROL' }],
  ['SKIP_EXPEDITION', { type: 'SKIP_EXPEDITION' }],
  ['RESUME_GOVERNANCE', { type: 'RESUME_GOVERNANCE' }],
  ['RESOLVE_RAID_DEFENSE', { type: 'RESOLVE_RAID_DEFENSE' }],
  ['ACCEPT_LOMBARD_LOAN', { type: 'ACCEPT_LOMBARD_LOAN' }],
  ['REFUSE_LOMBARD_LOAN', { type: 'REFUSE_LOMBARD_LOAN' }],
])

/** Edict identifiers `ENACT_EDICT` accepts. */
const EDICT_IDS = ['forced_tithe', 'church_seizure', 'grand_festival'] as const

/** Unit orders `UNLOCK_PATENT` accepts. */
const UNIT_ORDERS: readonly UnitOrder[] = ['people', 'admin', 'military']

/** Threat responses `SELECT_THREAT_RESPONSE` accepts. */
const THREAT_RESPONSES = ['defense', 'tribute', 'levy'] as const

/** Result of reading one argument: the value, or the reason it is not valid. */
type ArgResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string }

/** Reads a finite number. */
function readNumber(text: string | undefined, name: string): ArgResult<number> {
  const value = text === undefined || text.trim() === '' ? Number.NaN : Number(text)
  return Number.isFinite(value)
    ? { ok: true, value }
    : { ok: false, message: `${name} must be a finite number, got "${text ?? ''}".` }
}

/** Reads a positive whole number. */
function readCount(text: string | undefined, name: string): ArgResult<number> {
  const parsed = readNumber(text, name)
  if (!parsed.ok) return parsed
  return Number.isInteger(parsed.value) && parsed.value > 0
    ? parsed
    : { ok: false, message: `${name} must be a positive whole number, got "${text ?? ''}".` }
}

/** Reads a whole number that is not negative. */
function readIndex(text: string | undefined, name: string): ArgResult<number> {
  const parsed = readNumber(text, name)
  if (!parsed.ok) return parsed
  return Number.isInteger(parsed.value) && parsed.value >= 0
    ? parsed
    : { ok: false, message: `${name} must be a whole number, zero or more, got "${text ?? ''}".` }
}

/** Reads one word out of a list of allowed words. */
function readChoice<T extends string>(
  text: string | undefined,
  allowed: readonly T[],
  name: string,
): ArgResult<T> {
  const match = allowed.find((candidate) => candidate === text)
  return match === undefined
    ? { ok: false, message: `${name} must be one of ${allowed.join(', ')}, got "${text ?? ''}".` }
    : { ok: true, value: match }
}

/** Wraps a command as a parsed line. */
function commandLine(command: Command): ParsedLine {
  return { kind: 'command', command }
}

/** Wraps an invalid argument as an error line. */
function errorLine(message: string): ParsedLine {
  return { kind: 'error', message }
}

/** Parses `BUY_UNIT <unitId> <count>` and `DISBAND_UNIT <unitId> <count>`. */
function parseUnitCommand(
  type: 'BUY_UNIT' | 'DISBAND_UNIT',
  args: readonly string[],
  unitIds: readonly UnitId[],
): ParsedLine {
  const unitId = readChoice(args[0], unitIds, 'unitId')
  if (!unitId.ok) return errorLine(unitId.message)
  const count = readCount(args[1], 'count')
  if (!count.ok) return errorLine(count.message)
  return commandLine({ type, unitId: unitId.value, count: count.value })
}

/** Parses the commands that take arguments, or reports an unknown command type. */
function parseArgumentCommand(
  keyword: string,
  args: readonly string[],
  unitIds: readonly UnitId[],
): ParsedLine {
  switch (keyword) {
    case 'BUY_UNIT':
    case 'DISBAND_UNIT':
      return parseUnitCommand(keyword, args, unitIds)
    case 'SET_TAX_RATE': {
      const rate = readNumber(args[0], 'rate')
      return rate.ok
        ? commandLine({ type: 'SET_TAX_RATE', rate: rate.value })
        : errorLine(rate.message)
    }
    case 'ENACT_EDICT': {
      const edictId = readChoice(args[0], EDICT_IDS, 'edictId')
      return edictId.ok
        ? commandLine({ type: 'ENACT_EDICT', edictId: edictId.value })
        : errorLine(edictId.message)
    }
    case 'UNLOCK_PATENT': {
      const order = readChoice(args[0], UNIT_ORDERS, 'order')
      return order.ok
        ? commandLine({ type: 'UNLOCK_PATENT', order: order.value })
        : errorLine(order.message)
    }
    case 'SET_PAUSED': {
      const paused = readChoice(args[0], ['true', 'false'], 'paused')
      return paused.ok
        ? commandLine({ type: 'SET_PAUSED', paused: paused.value === 'true' })
        : errorLine(paused.message)
    }
    case 'ENACT_LAW':
      return args[0] === undefined
        ? errorLine('lawId is required.')
        : commandLine({ type: 'ENACT_LAW', lawId: args[0] })
    case 'RESOLVE_DILEMMA': {
      const choiceIndex = readIndex(args[1], 'choiceIndex')
      if (args[0] === undefined) return errorLine('dilemmaId is required.')
      return choiceIndex.ok
        ? commandLine({
            type: 'RESOLVE_DILEMMA',
            dilemmaId: args[0],
            choiceIndex: choiceIndex.value,
          })
        : errorLine(choiceIndex.message)
    }
    case 'SELECT_THREAT_RESPONSE': {
      const response = readChoice(args[0], THREAT_RESPONSES, 'response')
      return response.ok
        ? commandLine({ type: 'SELECT_THREAT_RESPONSE', response: response.value })
        : errorLine(response.message)
    }
    case 'LAUNCH_ATTACK': {
      if (args[0] === undefined) return commandLine({ type: 'LAUNCH_ATTACK' })
      const index = readIndex(args[0], 'targetProvinceIndex')
      return index.ok
        ? commandLine({ type: 'LAUNCH_ATTACK', targetProvinceIndex: index.value })
        : errorLine(index.message)
    }
    case 'RESTART_RUN': {
      if (args[0] === undefined) return commandLine({ type: 'RESTART_RUN' })
      const seed = readIndex(args[0], 'seed')
      return seed.ok
        ? commandLine({ type: 'RESTART_RUN', seed: seed.value })
        : errorLine(seed.message)
    }
    default:
      return errorLine(`Unknown command "${keyword}".`)
  }
}

/**
 * Parses one input line.
 *
 * @param line - Raw text typed by the player.
 * @param unitIds - Valid unit identifiers.
 * @returns A blank line, an error with its message, a tick request, or a `Command` for `dispatch`.
 */
export function parseLine(line: string, unitIds: readonly UnitId[]): ParsedLine {
  const words = line.trim().split(/\s+/)
  const keyword = (words[0] ?? '').toUpperCase()
  const args = words.slice(1)
  if (keyword === '') return { kind: 'blank' }
  if (keyword === 'TICK') {
    const seconds = readNumber(args[0], 'seconds')
    if (!seconds.ok) return errorLine(seconds.message)
    return seconds.value > 0
      ? { kind: 'tick', seconds: seconds.value }
      : errorLine('seconds must be positive.')
  }
  const zeroArgument = ZERO_ARGUMENT_COMMANDS.get(keyword)
  if (zeroArgument !== undefined) {
    return args.length === 0
      ? commandLine(zeroArgument)
      : errorLine(`${keyword} takes no argument.`)
  }
  return parseArgumentCommand(keyword, args, unitIds)
}

/**
 * Builds the one line state summary: phase, game time, AP, population, military power and the
 * owned units whose count is not zero.
 *
 * @param state - Current game state.
 * @param engine - Engine entry points (military power, unit order).
 * @returns The summary text.
 */
export function formatSummary(state: GameState, engine: ReplEngine): string {
  const owned = engine.unitIds
    .filter((unitId) => (state.units[unitId] ?? 0) !== 0)
    .map((unitId) => `${unitId}=${state.units[unitId]}`)
  const military = engine.calculateMilitaryPower(state)
  return [
    `phase=${state.phase}`,
    `time=${state.totalElapsedSeconds.toFixed(2)}s`,
    `ap=${state.ap.toFixed(1)}`,
    `population=${Math.floor(state.totalPopulation)}`,
    `military=${military}`,
    `units: ${owned.length === 0 ? 'none' : owned.join(' ')}`,
  ].join(' | ')
}

/**
 * Applies one input line to the state and returns the lines to print: an error line when the line
 * is invalid or `dispatch` rejects it, then the state summary.
 *
 * @param state - The mutable game state.
 * @param line - Raw text typed by the player.
 * @param engine - Engine entry points.
 * @returns Output lines, empty for a blank line.
 */
export function runLine(state: GameState, line: string, engine: ReplEngine): string[] {
  const parsed = parseLine(line, engine.unitIds)
  switch (parsed.kind) {
    case 'blank':
      return []
    case 'error':
      return [`error: ${parsed.message}`]
    case 'tick':
      engine.tick(state, parsed.seconds)
      return [formatSummary(state, engine)]
    case 'command': {
      const result = engine.dispatch(state, parsed.command)
      const failure = result.success ? [] : [`error: ${result.error ?? 'Command rejected.'}`]
      return [...failure, formatSummary(state, engine)]
    }
  }
}

/**
 * Reads the seed from the command line arguments.
 *
 * @param argv - Arguments after the script path.
 * @returns The seed after `--seed`, or the default; `null` when the value is not a whole number.
 */
export function parseSeedArgument(argv: readonly string[]): number | null {
  const flag = argv.indexOf('--seed')
  if (flag === -1) return DEFAULT_SEED
  const seed = readIndex(argv[flag + 1], 'seed')
  return seed.ok ? seed.value : null
}

/** Loads the engine through jiti with the `@/` alias the engine modules import with. */
async function loadEngine(): Promise<ReplEngine> {
  const jiti = createJiti(import.meta.url, {
    alias: { '@/': `${path.join(projectRoot, 'src')}/` },
  })
  const load = <T>(file: string): Promise<T> =>
    jiti.import<T>(path.join(projectRoot, 'src', ...file.split('/')))
  const commands = await load<typeof CommandsModule>('core/commands.ts')
  const engine = await load<typeof EngineModule>('core/engine.ts')
  const state = await load<typeof StateModule>('core/state.ts')
  const balance = await load<typeof BalanceModule>('data/balance.ts')
  return {
    dispatch: commands.dispatch,
    tick: engine.tick,
    calculateMilitaryPower: engine.calculateMilitaryPower,
    createInitialGameState: state.createInitialGameState,
    unitIds: Object.values(balance.UNITS_DATA).map((def) => def.id),
  }
}

/** Reads stdin line by line and prints the output of each. */
async function main(): Promise<number> {
  const seed = parseSeedArgument(process.argv.slice(2))
  if (seed === null) {
    console.error('error: --seed needs a whole number.')
    return 1
  }
  const engine = await loadEngine()
  const state = engine.createInitialGameState({ seed })
  const lines = readline.createInterface({ input: process.stdin })
  for await (const line of lines) {
    for (const output of runLine(state, line, engine)) console.log(output)
  }
  return 0
}

if (process.argv[1] === scriptPath) {
  process.exitCode = await main()
}
