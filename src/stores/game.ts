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
import type { ChronicleEntry } from '@/ui/chronicle'
import { bandForScore, computeDread, type DreadBand, type DreadReading } from '@/ui/dread'
import { isMomentPhase } from '@/ui/moments'
import type { RunRecord } from '@/ui/runRecord'
import { readKey, SAVE_KEY, writeKey } from '@/ui/storage'

/** What the register keeps of a concluded reign, once the chronicle is cleared. */
export interface ConcludedReign {
  conclusion: RunConclusion
  record: RunRecord
  /** The last lines of the chronicle, oldest first. */
  finalEntries: ChronicleEntry[]
}

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
  'DISBAND_UNIT',
  'UNLOCK_PATENT',
  'ENACT_EDICT',
  'COLONISE_PROVINCE',
  'LAUNCH_ATTACK',
  'SET_TAX_RATE',
  'ENACT_LAW',
  'RESOLVE_DILEMMA',
  'REFUSE_LOMBARD_LOAN',
  'ACCEPT_LOMBARD_LOAN',
  'SELECT_THREAT_RESPONSE',
  'RESOLVE_RAID_DEFENSE',
])

/** Fights leave their letter at once, so the next screen carries how they went. */
const FIGHT_COMMANDS: ReadonlySet<Command['type']> = new Set([
  'SELECT_THREAT_RESPONSE',
  'RESOLVE_RAID_DEFENSE',
])
const TIDINGS_MS = 6000
const FINAL_ENTRIES = 3

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
  const lastConclusion = ref<ConcludedReign | null>(null)

  const tidings = ref<string | null>(null)
  let tidingsTimer: ReturnType<typeof setTimeout> | null = null

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
  /** True while the reign stands on a letter that must be answered. */
  const inMoment = computed(() => isMomentPhase(phase.value))
  /** True between two audits: time stands still, the realm can still be governed. */
  const preparing = computed(() => phase.value === 'AWAIT_RESUME')

  /** The audit being worked towards: the next one once this one is over. */
  const auditAhead = computed(() => {
    const deadline = current()?.deadline ?? 1
    return preparing.value ? deadline + 1 : deadline
  })
  const secondsLeft = computed(() => {
    const state = current()
    if (!state) return 0
    const { DEADLINE_DURATION_SECONDS } = config.balance
    return preparing.value
      ? DEADLINE_DURATION_SECONDS
      : DEADLINE_DURATION_SECONDS - state.deadlineTimeSeconds
  })
  const quotas = computed<QuotaView[]>(() => {
    const state = current()
    if (!state) return []
    const required = effectiveQuota(state, quotaForDeadline(config, auditAhead.value))
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

  function dismissTidings(): void {
    tidings.value = null
    if (tidingsTimer !== null) clearTimeout(tidingsTimer)
    tidingsTimer = null
  }

  function tell(text: string | undefined): void {
    dismissTidings()
    if (text === undefined) return
    tidings.value = text
    tidingsTimer = setTimeout(dismissTidings, TIDINGS_MS)
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
    dismissTidings()
    refresh()
    const resumed = savedAt !== null && chronicle.load(state.runId)
    if (!resumed) chronicle.start(state, dread.value.band)
  }

  /** Banks the run into the archive once; returns false when it was already concluded. */
  function concludeOnce(state: GameState, abandoned: boolean): boolean {
    if (state.archiveConcluded) return false
    const finalEntries = chronicle.entries.slice(0, FINAL_ENTRIES).reverse()
    lastConclusion.value = { ...archives.conclude(state, abandoned), finalEntries }
    clearSave()
    refresh()
    return true
  }

  /** Concludes a run that just reached defeat or victory, then shows how it ended. */
  function settleIfOver(): void {
    const state = run.value
    if (state && isConcludedPhase(state.phase) && concludeOnce(state, false)) nav.go('fate')
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
    if (result.success && FIGHT_COMMANDS.has(command.type) && !isConcludedPhase(state.phase)) {
      tell(chronicle.entries[0]?.text)
    }
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
    inMoment,
    preparing,
    auditAhead,
    quotas,
    dread,
    hasSave,
    savedDeadline,
    lastSavedDeadline,
    lastConclusion,
    tidings,
    dismissTidings,
    begin,
    resume,
    act,
    advance,
    save,
    abandon,
    restart,
  }
})
