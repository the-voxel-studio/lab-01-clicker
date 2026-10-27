/**
 * Quota solver and balance report (GAME_RULES §21).
 *
 * Derives the 10 deadline quotas from the Greedy bot: `Quota_k = c x w_k x Median_k` from deadline
 * 2 (`w` = 0.9, 0.95, then 1) and `Quota_1 = floor(Median_1)`, where `Median_k` is the median
 * audited metric at deadline k (gross AP rate, population, military power) of the quota blind
 * Greedy bot, the calibration variant that never reads a quota. One calibration pass
 * runs it on the calibration seeds under relaxed quotas, so every run reaches the 10 audits and the
 * medians carry no survivor bias. A bisection on c then looks for the table that puts the real,
 * quota aware Greedy ROI bot in its [35%, 65%] win rate band on the validation seeds; that table
 * must also leave both expert bots above 65% and the Random bot below 5%.
 *
 * Usage: `npm run balance:report -- [report.md]` (report on stdout without a path). On success
 * the script rewrites `src/data/balance.generated.ts`; otherwise it leaves it untouched and exits
 * with 1.
 *
 * @module scripts/generate-balance-report
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import type * as SimulationModule from '../src/__tests__/simulation/botRunner'
import type * as ConfigModule from '../src/core/config'
import type { DeadlineQuota } from '../src/data/balance.generated'

const scriptPath = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(path.dirname(scriptPath), '..')
const generatedQuotasPath = path.join(projectRoot, 'src', 'data', 'balance.generated.ts')

/** Consecutive run seeds. */
interface SeedRange {
  readonly first: number
  readonly count: number
}

/** Seeds whose calibration medians set the quotas. */
const CALIBRATION_SEEDS: SeedRange = { first: 10001, count: 200 }

/** Seeds that measure the win rates of a candidate table. */
const VALIDATION_SEEDS: SeedRange = { first: 20001, count: 100 }

/** Bisection interval of the coefficient c. */
const C_RANGE = { low: 0.3, high: 1.2 } as const

/** Greedy ROI win rate band of GAME_RULES §21. */
const GREEDY_BAND = { min: 0.35, max: 0.65 } as const

/** Expert bots must win more often than this. */
const EXPERT_MIN_WIN_RATE = 0.65

/** The Random bot must win less often than this. */
const RANDOM_MAX_WIN_RATE = 0.05

/** Bisection steps allowed before the solver gives up. */
const MAX_BISECTION_STEPS = 12

/** Number of deadlines of a run. */
const DEADLINE_COUNT = 10

/**
 * Share of c applied to the deadlines after the first, by deadline; 1 when absent. The opening
 * deadlines have almost no spread, so a full c turns them into a cliff (balance study, plan 01).
 */
const EARLY_C_WEIGHTS: Readonly<Record<number, number>> = { 2: 0.9, 3: 0.95 }

/**
 * Relaxed quotas of the calibration runs: tiny and strictly increasing, so no calibration run can
 * fail an audit. Side effects, the same for every seed: threats and raids have no power and the
 * dilemmas keyed on the AP rate quota ratio always see a large surplus.
 */
export const RELAXED_QUOTAS: readonly DeadlineQuota[] = Array.from(
  { length: DEADLINE_COUNT },
  (_, index) => {
    const level = (index + 1) / 1000
    return { deadline: index + 1, apRate: level, pop: level, military: level }
  },
)

/** The three audited axes of a quota. */
type Axis = 'apRate' | 'pop' | 'military'

/** The axes in table column order. */
const AXES: readonly Axis[] = ['apRate', 'pop', 'military']

/** Simulation entry points, loaded with the `@/` alias the bots import with. */
export interface Toolkit {
  readonly simulation: typeof SimulationModule
  readonly config: typeof ConfigModule
}

/** Spread of one axis at one deadline over the calibration runs. */
export interface AxisSpread {
  p10: number
  p25: number
  median: number
  p75: number
  p90: number
}

/** Calibration statistics of one deadline. */
export interface DeadlineCalibration {
  deadline: number
  /** Calibration runs that reached this audit. */
  runs: number
  apRate: AxisSpread
  pop: AxisSpread
  military: AxisSpread
}

/** Result of the calibration pass. */
export interface Calibration {
  deadlines: DeadlineCalibration[]
  /** Calibration runs that did not win, as `reason at deadline` with counts. */
  defeats: Record<string, number>
}

/** Win rates of the four bots on the validation seeds under one table. */
export interface WinRates {
  random: number
  greedy: number
  bureaucrat: number
  conqueror: number
}

/** One bisection step. */
export interface BisectionStep {
  c: number
  quotas: readonly DeadlineQuota[]
  winRates: WinRates
}

/** Outcome of the solver. */
export interface SolverResult {
  calibration: Calibration
  steps: BisectionStep[]
  /** The step that met every criterion, if any. */
  chosen: BisectionStep | null
  failure: string | null
}

/**
 * Loads the bots and the engine configuration through jiti with the `@/` alias.
 *
 * @returns The simulation entry points and the engine configuration module.
 */
export async function loadToolkit(): Promise<Toolkit> {
  const jiti = createJiti(import.meta.url, {
    alias: { '@/': `${path.join(projectRoot, 'src')}/` },
  })
  const simulation = await jiti.import<typeof SimulationModule>(
    path.join(projectRoot, 'src', '__tests__', 'simulation', 'botRunner.ts'),
  )
  const config = await jiti.import<typeof ConfigModule>(
    path.join(projectRoot, 'src', 'core', 'config.ts'),
  )
  return { simulation, config }
}

/** Seeds of a range, in order. */
function seedsOf(range: SeedRange): number[] {
  return Array.from({ length: range.count }, (_, index) => range.first + index)
}

/**
 * Quantile of a sorted non empty list, interpolated between the two closest ranks (the median of
 * an even count is the mean of the two middle values).
 *
 * @param sorted - Values in ascending order.
 * @param share - Quantile in [0, 1].
 */
export function quantile(sorted: readonly number[], share: number): number {
  const position = share * (sorted.length - 1)
  const lower = sorted[Math.floor(position)] ?? Number.NaN
  const upper = sorted[Math.ceil(position)] ?? lower
  return lower + (upper - lower) * (position - Math.floor(position))
}

/** Spread of a list of values. */
function spreadOf(values: readonly number[]): AxisSpread {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
  }
}

/** Engine configuration with a quota table. */
function configWith(toolkit: Toolkit, quotas: readonly DeadlineQuota[]): ConfigModule.EngineConfig {
  return { ...toolkit.config.DEFAULT_ENGINE_CONFIG, quotas }
}

/**
 * Runs the quota blind Greedy bot once on every calibration seed under the relaxed quotas.
 *
 * @param toolkit - Loaded bots and configuration.
 * @returns The spread of each axis per deadline and the defeats, if any.
 */
export function calibrate(toolkit: Toolkit): Calibration {
  const config = configWith(toolkit, RELAXED_QUOTAS)
  const byDeadline = new Map<number, SimulationModule.AuditSnapshot[]>()
  const defeats: Record<string, number> = {}
  for (const seed of seedsOf(CALIBRATION_SEEDS)) {
    const run = toolkit.simulation.runSimulation(toolkit.simulation.blindGreedyBotStrategy, seed, {
      config,
    })
    if (!run.won) {
      const key = `${run.defeatReason ?? 'unfinished'} at deadline ${run.finalDeadline}`
      defeats[key] = (defeats[key] ?? 0) + 1
    }
    for (const audit of run.audits) {
      byDeadline.set(audit.deadline, [...(byDeadline.get(audit.deadline) ?? []), audit])
    }
  }
  const deadlines = RELAXED_QUOTAS.map((quota): DeadlineCalibration => {
    const audits = byDeadline.get(quota.deadline) ?? []
    return {
      deadline: quota.deadline,
      runs: audits.length,
      apRate: spreadOf(audits.map((audit) => audit.apRate)),
      pop: spreadOf(audits.map((audit) => audit.pop)),
      military: spreadOf(audits.map((audit) => audit.military)),
    }
  })
  return { deadlines, defeats }
}

/**
 * Rounds one axis of a raw table and forces it strictly increasing. Values are whole numbers; the
 * AP rate of deadline 1 keeps one decimal when it would otherwise round to 0.
 *
 * @param raw - Raw values of one axis, deadline 1 first.
 * @param axis - The axis, for the AP rate decimal exception.
 */
export function roundAxis(raw: readonly number[], axis: Axis): number[] {
  const rounded: number[] = []
  for (const value of raw) {
    const previous = rounded[rounded.length - 1]
    const whole = Math.round(value)
    const first =
      axis === 'apRate' && whole <= 0 ? Math.max(0.1, Math.round(value * 10) / 10) : whole
    rounded.push(previous === undefined ? first : Math.max(first, Math.floor(previous) + 1))
  }
  return rounded
}

/**
 * Raw quota of one axis at one deadline: the floor of the median at deadline 1 (whatever c), then c
 * times the early weight times the median.
 */
function rawQuota(c: number, entry: DeadlineCalibration, axis: Axis): number {
  const median = entry[axis].median
  return entry.deadline === 1
    ? Math.floor(median)
    : c * (EARLY_C_WEIGHTS[entry.deadline] ?? 1) * median
}

/**
 * Quota table for a coefficient: deadline 1 at the floor of its medians, then c times the early
 * weight times the calibration medians, rounded and strictly increasing per axis.
 *
 * @param c - Coefficient applied to the medians.
 * @param calibration - Calibration statistics.
 * @throws Error when a scaled median is not finite.
 */
export function quotaTable(c: number, calibration: Calibration): DeadlineQuota[] {
  for (const entry of calibration.deadlines) {
    for (const axis of AXES) {
      if (!Number.isFinite(c * entry[axis].median)) {
        throw new Error(`Quota ${axis} of deadline ${entry.deadline} is not finite.`)
      }
    }
  }
  const [apRate, pop, military] = AXES.map((axis) =>
    roundAxis(
      calibration.deadlines.map((entry) => rawQuota(c, entry, axis)),
      axis,
    ),
  )
  if (!apRate || !pop || !military) throw new Error('Quota axes are missing.')
  return calibration.deadlines.map((entry, index) => {
    const row = { apRate: apRate[index], pop: pop[index], military: military[index] }
    if (row.apRate === undefined || row.pop === undefined || row.military === undefined) {
      throw new Error(`Quota axes do not cover deadline ${entry.deadline}.`)
    }
    return { deadline: entry.deadline, apRate: row.apRate, pop: row.pop, military: row.military }
  })
}

/** Win rate of a bot on the validation seeds under a table. */
function winRate(
  toolkit: Toolkit,
  strategy: SimulationModule.BotStrategy,
  quotas: readonly DeadlineQuota[],
): number {
  const config = configWith(toolkit, quotas)
  const wins = seedsOf(VALIDATION_SEEDS).filter(
    (seed) => toolkit.simulation.runSimulation(strategy, seed, { config }).won,
  ).length
  return wins / VALIDATION_SEEDS.count
}

/**
 * Win rates of the four bots on the validation seeds.
 *
 * @param toolkit - Loaded bots and configuration.
 * @param quotas - Table in force.
 * @returns The win rate of each bot.
 */
export function validate(toolkit: Toolkit, quotas: readonly DeadlineQuota[]): WinRates {
  const sim = toolkit.simulation
  return {
    random: winRate(toolkit, sim.randomBotStrategy, quotas),
    greedy: winRate(toolkit, sim.greedyRoiBotStrategy, quotas),
    bureaucrat: winRate(toolkit, sim.bureaucratBotStrategy, quotas),
    conqueror: winRate(toolkit, sim.conquerorBotStrategy, quotas),
  }
}

/** Why a table that puts the Greedy bot in its band still fails, or null when it passes. */
function otherCriteriaFailure(rates: WinRates): string | null {
  if (rates.bureaucrat <= EXPERT_MIN_WIN_RATE || rates.conqueror <= EXPERT_MIN_WIN_RATE) {
    return 'the Greedy band is reached but an expert bot is at or below 65%'
  }
  if (rates.random >= RANDOM_MAX_WIN_RATE) {
    return 'the Greedy band is reached but the Random bot wins 5% or more'
  }
  return null
}

/**
 * Calibrates once, then bisects c until the Greedy bot lands in its band on the validation seeds.
 *
 * @param toolkit - Loaded bots and configuration.
 * @returns The calibration, every bisection step and the chosen one, if any.
 */
export function solve(toolkit: Toolkit): SolverResult {
  log('Calibration pass (quota blind Greedy, relaxed quotas)')
  const calibration = calibrate(toolkit)
  const steps: BisectionStep[] = []
  let low: number = C_RANGE.low
  let high: number = C_RANGE.high
  for (let step = 1; step <= MAX_BISECTION_STEPS; step++) {
    const c = (low + high) / 2
    const quotas = quotaTable(c, calibration)
    const winRates = validate(toolkit, quotas)
    const current: BisectionStep = { c, quotas, winRates }
    steps.push(current)
    log(`Bisection step ${step}: c=${c.toFixed(4)}: ${formatRates(winRates)}`)
    if (winRates.greedy > GREEDY_BAND.max) {
      low = c
    } else if (winRates.greedy < GREEDY_BAND.min) {
      high = c
    } else {
      const failure = otherCriteriaFailure(winRates)
      return { calibration, steps, chosen: failure === null ? current : null, failure }
    }
  }
  return {
    calibration,
    steps,
    chosen: null,
    failure: 'no c in the range put the Greedy bot in its band',
  }
}

/** Percentage with one decimal. */
function percent(share: number): string {
  return `${(share * 100).toFixed(1)}%`
}

/** One line summary of the four win rates. */
function formatRates(rates: WinRates): string {
  return (
    `Random ${percent(rates.random)}, Greedy ${percent(rates.greedy)}, ` +
    `Bureaucrat ${percent(rates.bureaucrat)}, Conqueror ${percent(rates.conqueror)}`
  )
}

/** Progress line on stderr, so stdout carries only the report. */
function log(line: string): void {
  process.stderr.write(`${line}\n`)
}

/** Markdown table of a quota table. */
function quotaTableMarkdown(quotas: readonly DeadlineQuota[]): string {
  const rows = quotas.map(
    (quota) => `| ${quota.deadline} | ${quota.apRate} | ${quota.pop} | ${quota.military} |`,
  )
  return ['| Deadline | AP rate | Population | Military |', '|---|---|---|---|', ...rows].join('\n')
}

/** `p10 / p25 / median / p75 / p90` of one axis. */
function spreadCell(spread: AxisSpread): string {
  return [spread.p10, spread.p25, spread.median, spread.p75, spread.p90]
    .map((value) => value.toFixed(1))
    .join(' / ')
}

/** Markdown table of the calibration spread. */
function calibrationMarkdown(calibration: Calibration): string {
  const rows = calibration.deadlines.map(
    (entry) =>
      `| ${entry.deadline} | ${entry.runs} | ${spreadCell(entry.apRate)} | ` +
      `${spreadCell(entry.pop)} | ${spreadCell(entry.military)} |`,
  )
  const defeats = Object.entries(calibration.defeats)
  return [
    '| Deadline | Runs | AP rate | Population | Military |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    'Each cell: p10 / p25 / median / p75 / p90.',
    '',
    defeats.length === 0
      ? 'Every calibration run won (all 10 audits reached).'
      : `Calibration runs that lost: ${defeats.map(([key, count]) => `${key}: ${count}`).join(', ')}.`,
  ].join('\n')
}

/** Markdown table of the win rate of every bot per c. */
function curvesMarkdown(steps: readonly BisectionStep[]): string {
  const rows = [...steps]
    .sort((a, b) => a.c - b.c)
    .map(
      (step) =>
        `| ${step.c.toFixed(4)} | ${percent(step.winRates.random)} | ` +
        `${percent(step.winRates.greedy)} | ${percent(step.winRates.bureaucrat)} | ` +
        `${percent(step.winRates.conqueror)} |`,
    )
  return [
    '| c | Random | Greedy ROI | Bureaucrat | Conqueror |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

/**
 * Full markdown report of a solver run.
 *
 * @param result - Solver outcome.
 * @param runtimeSeconds - Wall time of the run.
 */
export function renderReport(result: SolverResult, runtimeSeconds: number): string {
  const chosen = result.chosen
  const chosenSection = chosen
    ? [
        '',
        `## Chosen table (c = ${chosen.c.toFixed(4)})`,
        '',
        quotaTableMarkdown(chosen.quotas),
        '',
        `Validation win rates: ${formatRates(chosen.winRates)}.`,
      ]
    : []
  const stepTables = result.steps.map((step) =>
    [`### c = ${step.c.toFixed(4)}`, '', quotaTableMarkdown(step.quotas)].join('\n'),
  )
  return [
    '# Balance report: deadline quotas',
    '',
    `Status: ${chosen ? 'solved' : `failed (${result.failure ?? 'unknown'})`}. ` +
      `Runtime ${runtimeSeconds.toFixed(0)} s.`,
    '',
    `Calibration: quota blind Greedy bot on seeds ${CALIBRATION_SEEDS.first} to ` +
      `${CALIBRATION_SEEDS.first + CALIBRATION_SEEDS.count - 1}, relaxed quotas, one pass. ` +
      `Validation: four bots on seeds ${VALIDATION_SEEDS.first} to ` +
      `${VALIDATION_SEEDS.first + VALIDATION_SEEDS.count - 1}. Bisection of c in ` +
      `[${C_RANGE.low}, ${C_RANGE.high}] on the quota aware Greedy ROI win rate.`,
    ...chosenSection,
    '',
    '## Calibration spread',
    '',
    calibrationMarkdown(result.calibration),
    '',
    '## Win rates per c (validation seeds)',
    '',
    curvesMarkdown(result.steps),
    '',
    '## Tables tried',
    '',
    stepTables.join('\n\n'),
    '',
  ].join('\n')
}

/**
 * Source of `src/data/balance.generated.ts` for a quota table.
 *
 * @param quotas - The 10 deadline quotas.
 * @returns The file content.
 */
export function generateQuotasFileContent(quotas: readonly DeadlineQuota[]): string {
  return `/**
 * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY.
 * Generated by scripts/generate-balance-report.ts.
 * Master calibrated deadline quotas for The Grand Audit.
 *
 * @module data/balance.generated
 */

export interface DeadlineQuota {
  deadline: number
  apRate: number
  pop: number
  military: number
}

/**
 * Master calibrated deadline quotas derived via simulation solver across 200 fixed seeds.
 */
export const DEADLINE_QUOTAS: readonly DeadlineQuota[] = [
${quotas
  .map(
    (q) =>
      `  { deadline: ${q.deadline}, apRate: ${q.apRate}, pop: ${q.pop}, military: ${q.military} },`,
  )
  .join('\n')}
] as const
`
}

/** Runs the solver, writes the report, and on success the generated quota table. */
async function main(reportPath: string | undefined): Promise<void> {
  const startedAt = Date.now()
  const toolkit = await loadToolkit()
  const result = solve(toolkit)
  const report = renderReport(result, (Date.now() - startedAt) / 1000)
  if (reportPath) {
    fs.writeFileSync(path.resolve(reportPath), report, 'utf-8')
    log(`Report written to ${path.resolve(reportPath)}`)
  } else {
    process.stdout.write(report)
  }
  const lost = Object.entries(result.calibration.defeats)
  if (lost.length > 0) {
    log(
      `Solver failed: calibration runs lost under relaxed quotas (${lost.map(([key, count]) => `${key}: ${count}`).join(', ')}), medians would be survivor biased. ${generatedQuotasPath} left untouched.`,
    )
    process.exitCode = 1
    return
  }
  if (!result.chosen) {
    log(`Solver failed: ${result.failure ?? 'unknown'}. ${generatedQuotasPath} left untouched.`)
    process.exitCode = 1
    return
  }
  fs.writeFileSync(generatedQuotasPath, generateQuotasFileContent(result.chosen.quotas))
  log(`Quotas written to ${generatedQuotasPath}`)
}

if (process.argv[1] === scriptPath) {
  await main(process.argv[2])
}
