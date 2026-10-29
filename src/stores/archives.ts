/**
 * Archive and run history store: the cross run progress, persisted after every change.
 *
 * @module stores/archives
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  concludeRun,
  createArchiveData,
  investPerk,
  resetPerks,
  type ArchiveData,
  type RunConclusion,
} from '@/core/archives'
import type { DispatchResult, GameState } from '@/core/types'
import { validateArchiveData } from '@/core/validation'
import { createRunRecord, parseHistory, serializeHistory, type RunRecord } from '@/ui/runRecord'
import { ARCHIVE_KEY, HISTORY_KEY, readKey, writeKey } from '@/ui/storage'

function parseArchive(raw: string | null): ArchiveData {
  if (raw === null) return createArchiveData()
  try {
    return validateArchiveData(JSON.parse(raw))
  } catch {
    return createArchiveData()
  }
}

/** The archive (points, perks, feats) and the history of concluded reigns. */
export const useArchivesStore = defineStore('archives', () => {
  const archive = ref<ArchiveData>(createArchiveData())
  const history = ref<RunRecord[]>([])

  function persist(): void {
    writeKey(ARCHIVE_KEY, JSON.stringify(archive.value))
    writeKey(HISTORY_KEY, serializeHistory(history.value))
  }

  /** Reads the archive and the history from storage, falling back to defaults on bad data. */
  function load(): void {
    archive.value = parseArchive(readKey(ARCHIVE_KEY))
    history.value = parseHistory(readKey(HISTORY_KEY))
  }

  /**
   * Banks a finished or abandoned run into the archive and appends its record. A run already
   * concluded (the engine's `archiveConcluded` flag) changes nothing and appends nothing.
   *
   * @param state - The run state; its `archiveConcluded` flag is set.
   * @param abandoned - True when the player laid down the crown.
   */
  function conclude(
    state: GameState,
    abandoned = false,
  ): { conclusion: RunConclusion; record: RunRecord } {
    const alreadyConcluded = state.archiveConcluded
    const conclusion = concludeRun(archive.value, state)
    const record = createRunRecord(state, conclusion, new Date(), abandoned)
    if (!alreadyConcluded) {
      history.value.push(record)
      persist()
    }
    return { conclusion, record }
  }

  /** Invests archive points in a perk; persists on success. */
  function invest(perkId: string): DispatchResult {
    const result = investPerk(archive.value, perkId)
    if (result.success) persist()
    return result
  }

  /** Refunds every invested perk and persists. */
  function respec(): void {
    resetPerks(archive.value)
    persist()
  }

  return { archive, history, load, conclude, invest, respec }
})
