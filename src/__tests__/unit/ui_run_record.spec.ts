/**
 * Run records: one history entry per concluded reign, and the tolerant history parser.
 *
 * @module __tests__/unit/ui_run_record.spec
 */

import { describe, it, expect } from 'vitest'
import type { RunConclusion } from '@/core/archives'
import { createInitialGameState } from '@/core/state'
import { createRunRecord, parseHistory, serializeHistory } from '@/ui/runRecord'

const CONCLUSION: RunConclusion = { newFeats: ['royal_pacifist'], pointsEarned: 3 }
const ENDED_AT = new Date('2026-10-29T18:00:00.000Z')

function defeatedState() {
  return createInitialGameState({
    seed: 77,
    phase: 'RUN_DEFEAT',
    defeatReason: 'quota_failure',
    deadline: 3,
    playedSeconds: 272,
  })
}

describe('Task 3: run records', () => {
  it('records a defeat with its reason and the run figures', () => {
    const record = createRunRecord(defeatedState(), CONCLUSION, ENDED_AT)
    expect(record.outcome).toBe('quota_failure')
    expect(record.seed).toBe(77)
    expect(record.deadlineReached).toBe(3)
    expect(record.elapsedSeconds).toBe(272)
    expect(record.newFeats).toEqual(['royal_pacifist'])
  })

  it('records a victory', () => {
    const state = createInitialGameState({ phase: 'RUN_VICTORY', isVictory: true })
    expect(createRunRecord(state, CONCLUSION, ENDED_AT).outcome).toBe('victory')
  })

  it('records an abandoned reign over a defeat or a victory', () => {
    const won = createInitialGameState({ phase: 'RUN_VICTORY', isVictory: true })
    expect(createRunRecord(defeatedState(), CONCLUSION, ENDED_AT, true).outcome).toBe('abandoned')
    expect(createRunRecord(won, CONCLUSION, ENDED_AT, true).outcome).toBe('abandoned')
  })

  it('stores the end date as an ISO string', () => {
    expect(createRunRecord(defeatedState(), CONCLUSION, ENDED_AT).endedAt).toBe(
      '2026-10-29T18:00:00.000Z',
    )
  })

  it('round trips the history through its serialized form', () => {
    const records = [
      createRunRecord(defeatedState(), CONCLUSION, ENDED_AT),
      createRunRecord(createInitialGameState({ isVictory: true }), CONCLUSION, ENDED_AT),
    ]
    expect(parseHistory(serializeHistory(records))).toEqual(records)
  })

  it('reads a missing, corrupt or foreign history as empty', () => {
    expect(parseHistory(null)).toEqual([])
    expect(parseHistory('{')).toEqual([])
    expect(parseHistory('{"version":2,"records":[]}')).toEqual([])
    expect(parseHistory('{"version":1,"records":{}}')).toEqual([])
  })

  it('drops a record whose feats name an inherited property', () => {
    const valid = createRunRecord(defeatedState(), CONCLUSION, ENDED_AT)
    const raw = JSON.stringify({ version: 1, records: [{ ...valid, newFeats: ['constructor'] }] })
    expect(parseHistory(raw)).toEqual([])
  })

  it('drops a malformed record and keeps the valid one beside it', () => {
    const valid = createRunRecord(defeatedState(), CONCLUSION, ENDED_AT)
    const raw = JSON.stringify({ version: 1, records: [{ ...valid, seed: 'x' }, valid] })
    expect(parseHistory(raw)).toEqual([valid])
  })
})
