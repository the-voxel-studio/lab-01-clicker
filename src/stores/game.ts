/**
 * Game store: owns the engine state of the reign in progress, steps it, saves it, and concludes
 * it into the archive. Components read its getters and call its actions; the engine mutates the
 * state in place, so every engine call bumps `revision` to refresh the getters.
 *
 * @module stores/game
 */

import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { startRun, type RunConclusion } from '@/core/archives'
import { dispatch } from '@/core/commands'
import { DEFAULT_ENGINE_CONFIG, quotaForDeadline } from '@/core/config'
import {
  calculateGrossApRate,
  calculateMilitaryPower,
  effectiveQuota,
  isFastForwardUnlocked,
  tick,
} from '@/core/engine'
import { exportSaveToBase64, importSaveFromBase64 } from '@/core/migrations'
import type { Command, DispatchResult, GameState, RunPhase } from '@/core/types'
import { useArchivesStore } from '@/stores/archives'
import { useChronicleStore } from '@/stores/chronicle'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import { bandForScore, computeDread, type DreadBand, type DreadReading } from '@/ui/dread'
import type { RunRecord } from '@/ui/runRecord'
import { readKey, SAVE_KEY, writeKey } from '@/ui/storage'

/** One Crown quota against its target; the AP quota is a rate (gross AP per second). */
export interface QuotaView {
  axis: 'ap' | 'pop' | 'military'
  current: number
  required: number
  met: boolean
}

const config = DEFAULT_ENGINE_CONFIG
const SEED_MODULUS = 2147483647

/** Lower bound of each band, used as the score of a forced band. */
const BAND_FLOOR: Record<DreadBand, number> = {
  enchanted: 0,
  uneasy: 0.25,
  rotting: 0.5,
  death_throes: 0.75,
}

/** Deadline of the stored save; an unreadable save is removed and reads as none. */
function readSavedDeadline(): number | null {
  const raw = readKey(SAVE_KEY)
  if (raw === null) return null
  try {
    return importSaveFromBase64(raw).state.deadline
  } catch {
    writeKey(SAVE_KEY, null)
    return null
  }
}

/** Commands the chronicle tells; the others are not worth copying the run before dispatch. */
const TOLD_COMMANDS: ReadonlySet<Command['type']> = new Set([
  'BUY_UNIT',
  'SET_TAX_RATE',
  'ENACT_LAW',
  'RESOLVE_DILEMMA',
  'REFUSE_LOMBARD_LOAN',
  'ACCEPT_LOMBARD_LOAN',
])

function isConcludedPhase(phase: RunPhase): boolean {
  return phase === 'RUN_DEFEAT' || phase === 'RUN_VICTORY'
}

/** The reign in progress and every action the interface can take on it. */
export const useGameStore = defineStore('game', () => {
  const archives = useArchivesStore()
  const chronicle = useChronicleStore()
  const settings = useSettingsStore()
  const nav = useNavStore()

  const run = shallowRef<GameState | null>(null)
  const revision = ref(0)
  const lastNetApPerSecond = ref(0)
  const savedDeadline = ref<number | null>(readSavedDeadline())
  const hasSave = computed(() => savedDeadline.value !== null)
  const lastSavedDeadline = ref<number | null>(null)
  const lastConclusion = ref<{ conclusion: RunConclusion; record: RunRecord } | null>(null)

  /** Reads the run after the last engine call, so computed getters track `revision`. */
  function current(): GameState | null {
    void revision.value
    return run.value
  }

  const phase = computed(() => current()?.phase ?? null)
  const isOver = computed(() => current()?.archiveConcluded ?? false)
  const coffer = computed(() => current()?.ap ?? 0)
  const netApPerSecond = computed(() => {
    void revision.value
    return lastNetApPerSecond.value
  })
  /** True while the reign waits for the player's answer to an event. */
  const awaitingAnswer = computed(() => {
    void revision.value
    const current = run.value?.phase ?? null
    return (
      current !== null &&
      current !== 'ACTIVE_CYCLE' &&
      current !== 'RUN_DEFEAT' &&
      current !== 'RUN_VICTORY'
    )
  })

  const secondsLeft = computed(() => {
    const state = current()
    return state ? config.balance.DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds : 0
  })
  const quotas = computed<QuotaView[]>(() => {
    const state = current()
    if (!state) return []
    const required = effectiveQuota(state, quotaForDeadline(config, state.deadline))
    const view = (axis: QuotaView['axis'], value: number, target: number): QuotaView => ({
      axis,
      current: value,
      required: target,
      met: value >= target,
    })
    return [
      view('ap', calculateGrossApRate(state, config).total, required.apRate),
      view('pop', state.totalPopulation, required.pop),
      view('military', calculateMilitaryPower(state, config), required.military),
    ]
  })
  const dread = computed<DreadReading>(() => {
    const forced = settings.dreadOverride
    if (import.meta.env.DEV && forced !== null) {
      return { score: BAND_FLOOR[forced], band: bandForScore(BAND_FLOOR[forced]) }
    }
    const state = current()
    return state ? computeDread(state, config) : { score: 0, band: 'enchanted' }
  })

  function refresh(): void {
    revision.value++
  }

  function clearSave(): void {
    writeKey(SAVE_KEY, null)
    savedDeadline.value = null
    chronicle.clear()
  }

  /**
   * Installs a reign. Every reign starts at normal speed (double speed is a choice made within one
   * reign) and with its chronicle: the stored one when resuming, else a new one from the coronation.
   */
  function setRun(state: GameState, savedAt: number | null = null): void {
    run.value = state
    lastNetApPerSecond.value = 0
    lastConclusion.value = null
    lastSavedDeadline.value = savedAt
    settings.doubleSpeed = false
    refresh()
    const resumed = savedAt !== null && chronicle.load(state.runId)
    if (!resumed) chronicle.start(state, dread.value.band)
  }

  /** Banks the run into the archive once; returns false when it was already concluded. */
  function concludeOnce(state: GameState, abandoned: boolean): boolean {
    if (state.archiveConcluded) return false
    lastConclusion.value = archives.conclude(state, abandoned)
    clearSave()
    refresh()
    return true
  }

  /** Concludes a run that just reached defeat or victory, then shows the end screen. */
  function settleIfOver(): void {
    const state = run.value
    if (state && isConcludedPhase(state.phase) && concludeOnce(state, false)) nav.go('end')
  }

  /**
   * Banks a saved reign as abandoned before a new one replaces it, so its run points, feats and
   * history record are not lost with the save (design 4.2: abandoning counts as a death).
   */
  function layDownSavedReign(): void {
    const raw = readKey(SAVE_KEY)
    if (raw === null) return
    try {
      const saved = importSaveFromBase64(raw).state
      if (!saved.archiveConcluded) archives.conclude(saved, true)
    } catch {
      // An unreadable save holds nothing to bank.
    }
    clearSave()
  }

  /**
   * Begins a new reign from the archive (invested perks applied); seed defaults to the clock. A
   * saved reign still waiting to be continued is first laid down.
   */
  function begin(seed: number = Date.now() % SEED_MODULUS): void {
    layDownSavedReign()
    setRun(startRun(archives.archive, seed))
  }

  /**
   * Loads the saved reign. Only its state is kept: the archive copy inside the save is older than
   * the archive of record whenever perks changed after the save.
   *
   * @returns False when no save exists or it cannot be read.
   */
  function resume(): boolean {
    const raw = readKey(SAVE_KEY)
    if (raw === null) return false
    try {
      const state = importSaveFromBase64(raw).state
      setRun(state, state.deadline)
      return true
    } catch {
      return false
    }
  }

  /** Dispatches a command to the engine and concludes the run if it ended. */
  function act(command: Command): DispatchResult {
    const state = run.value
    if (!state) return { success: false, error: 'No reign in progress.' }
    const before = TOLD_COMMANDS.has(command.type) ? structuredClone(state) : null
    const result = dispatch(state, command, config)
    refresh()
    if (before) chronicle.noteCommand(command, result, before, state)
    chronicle.observe(state, dread.value.band)
    settleIfOver()
    return result
  }

  /** Steps the engine by `dt` seconds (doubled when double speed is on and unlocked). */
  function advance(dt: number): void {
    const state = run.value
    if (!state) return
    const factor = settings.doubleSpeed && isFastForwardUnlocked(state, config) ? 2 : 1
    const phaseBefore = state.phase
    const result = tick(state, dt * factor, config)
    if (result.dt > 0) lastNetApPerSecond.value = result.netApPerSecond
    if (result.dt > 0 || state.phase !== phaseBefore) {
      refresh()
      chronicle.observe(state, dread.value.band)
    }
    if (result.deadlineCompleted) save()
    settleIfOver()
  }

  /** Writes the reign in progress to the save slot; a concluded reign is never saved. */
  function save(): void {
    const state = run.value
    if (!state || state.archiveConcluded || isConcludedPhase(state.phase)) return
    writeKey(SAVE_KEY, exportSaveToBase64(state, archives.archive))
    savedDeadline.value = state.deadline
    lastSavedDeadline.value = state.deadline
    chronicle.persist(state.runId)
  }

  /** Lays down the crown: banks the reign as a death would, then shows the end screen. */
  function abandon(): void {
    const state = run.value
    if (state && concludeOnce(state, true)) nav.go('end')
  }

  /** Begins a new reign on the same seed; a reign in progress is first concluded as abandoned. */
  function restart(): void {
    const state = run.value
    if (!state) return
    concludeOnce(state, true)
    begin(state.seed)
  }

  return {
    run,
    revision,
    phase,
    isOver,
    coffer,
    netApPerSecond,
    secondsLeft,
    awaitingAnswer,
    quotas,
    dread,
    hasSave,
    savedDeadline,
    lastSavedDeadline,
    lastConclusion,
    begin,
    resume,
    act,
    advance,
    save,
    abandon,
    restart,
  }
})
