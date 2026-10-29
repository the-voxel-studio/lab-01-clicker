/**
 * Chronicle store: the entries of the reign in progress, newest first, grouped by audit and kept
 * in storage next to the save.
 *
 * @module stores/chronicle
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Command, DispatchResult, GameState } from '@/core/types'
import {
  entryFromCommand,
  mergeEntries,
  observeChange,
  type AuditVerdict,
  type ChronicleEntry,
  type RunSnapshot,
} from '@/ui/chronicle'
import type { DreadBand } from '@/ui/dread'
import { auditOrdinal, capitalized } from '@/ui/realmText'
import { CHRONICLE_KEY, readKey, writeKey } from '@/ui/storage'

/** The entries of one audit under their title. */
export interface ChronicleGroup {
  deadline: number
  title: string
  entries: ChronicleEntry[]
}

const STORED_VERSION = 1
const KINDS = ['decision', 'audit', 'folklore', 'death', 'money']
const VERDICTS: readonly AuditVerdict[] = ['passed', 'pardoned', 'failed']
const BANDS: readonly DreadBand[] = ['enchanted', 'uneasy', 'rotting', 'death_throes']

function isEntry(value: unknown): value is ChronicleEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry: Record<string, unknown> = { ...value }
  return (
    typeof entry.id === 'number' &&
    typeof entry.deadline === 'number' &&
    typeof entry.reignSeconds === 'number' &&
    typeof entry.text === 'string' &&
    KINDS.includes(String(entry.kind)) &&
    (entry.verdict === undefined || VERDICTS.some((verdict) => verdict === entry.verdict))
  )
}

function isSnapshot(value: unknown): value is RunSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const snapshot: Record<string, unknown> = { ...value }
  const numbers = ['starvationLosses', 'populationHundreds', 'worstDeadline', 'lastFolkloreSeconds']
  return (
    numbers.every((field) => typeof snapshot[field] === 'number') &&
    ['lossesTold', 'lastDeathSeconds'].every((field) => typeof snapshot[field] === 'number') &&
    typeof snapshot.bankrupt === 'boolean' &&
    typeof snapshot.bankruptcyTold === 'boolean' &&
    (snapshot.solventSince === null || typeof snapshot.solventSince === 'number') &&
    (snapshot.auditKey === null || typeof snapshot.auditKey === 'string') &&
    (snapshot.lastFolkloreText === null || typeof snapshot.lastFolkloreText === 'string') &&
    BANDS.some((band) => band === snapshot.band) &&
    BANDS.some((band) => band === snapshot.worstBand)
  )
}

/** The chronicle of the reign in progress. */
export const useChronicleStore = defineStore('chronicle', () => {
  const entries = ref<ChronicleEntry[]>([])
  const currentDeadline = ref(1)
  let snapshot: RunSnapshot | null = null

  const nextId = (): number => (entries.value[0]?.id ?? -1) + 1

  function prepend(written: ChronicleEntry[]): void {
    if (written.length > 0) entries.value = [...written].reverse().concat(entries.value)
  }

  /** Opens a new chronicle with the coronation of `state`. */
  function start(state: GameState, band: DreadBand): void {
    entries.value = []
    snapshot = null
    observe(state, band)
  }

  /** Writes what changed in the run since the last observation. */
  function observe(state: GameState, band: DreadBand): void {
    currentDeadline.value = state.deadline
    const change = observeChange(snapshot, state, band, nextId())
    snapshot = change.snapshot
    prepend(change.entries)
  }

  /** Writes the line of a dispatched command, if it has one. */
  function noteCommand(
    command: Command,
    result: DispatchResult,
    before: GameState,
    after: GameState,
  ): void {
    const entry = entryFromCommand(command, result, before, after, nextId())
    if (!entry) return
    const newest = entries.value[0]
    const merged = newest ? mergeEntries(newest, entry) : null
    if (merged) entries.value = [merged, ...entries.value.slice(1)]
    else prepend([entry])
  }

  /** Stores the chronicle of the reign `runId`, next to its save. */
  function persist(runId: string): void {
    writeKey(
      CHRONICLE_KEY,
      JSON.stringify({ version: STORED_VERSION, runId, entries: entries.value, snapshot }),
    )
  }

  /**
   * Reads the stored chronicle of the reign `runId`.
   *
   * @returns False when none is stored for this reign or it cannot be read.
   */
  function load(runId: string): boolean {
    const raw = readKey(CHRONICLE_KEY)
    if (raw === null) return false
    try {
      const stored: unknown = JSON.parse(raw)
      if (typeof stored !== 'object' || stored === null) return false
      const document: Record<string, unknown> = { ...stored }
      if (document.version !== STORED_VERSION || document.runId !== runId) return false
      if (!Array.isArray(document.entries) || !isSnapshot(document.snapshot)) return false
      entries.value = document.entries.filter(isEntry)
      snapshot = document.snapshot
      return true
    } catch {
      return false
    }
  }

  /** Removes the stored copy; the entries in memory stay for the end of reign. */
  function clear(): void {
    writeKey(CHRONICLE_KEY, null)
  }

  const byAudit = computed<ChronicleGroup[]>(() => {
    const groups = new Map<number, ChronicleEntry[]>()
    for (const entry of entries.value) {
      groups.set(entry.deadline, [...(groups.get(entry.deadline) ?? []), entry])
    }
    return [...groups.entries()]
      .sort(([a], [b]) => b - a)
      .map(([deadline, list]) => ({ deadline, title: titleOf(deadline, list), entries: list }))
  })

  function titleOf(deadline: number, list: ChronicleEntry[]): string {
    if (deadline === 0) return 'Coronation'
    const name = `${capitalized(auditOrdinal(deadline))} audit`
    const verdict = list.find((entry) => entry.verdict)?.verdict
    if (verdict) return `${name}, ${verdict}`
    return deadline === currentDeadline.value ? `${name}, now` : name
  }

  return { entries, byAudit, start, observe, noteCommand, persist, load, clear }
})
