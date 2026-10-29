/**
 * Counsel line and realm phrases.
 *
 * @module __tests__/unit/ui_counsel.spec
 */

import { describe, expect, it } from 'vitest'
import { dispatch } from '@/core/commands'
import { createInitialGameState } from '@/core/state'
import type { GameState } from '@/core/types'
import type { QuotaView } from '@/stores/game'
import { adviseCounsel } from '@/ui/counsel'
import { auditOrdinal, formatClock, formatRate, unrestLine } from '@/ui/realmText'

function quotas(
  ap: [number, number],
  pop: [number, number],
  military: [number, number],
): QuotaView[] {
  const view = (axis: QuotaView['axis'], [current, required]: [number, number]): QuotaView => ({
    axis,
    current,
    required,
    met: current >= required,
  })
  return [view('ap', ap), view('pop', pop), view('military', military)]
}

/** Dispatches the counsel's command on a copy and reports whether the engine accepts it. */
function accepted(state: GameState, counsel: ReturnType<typeof adviseCounsel>): boolean {
  if (!counsel.action) return false
  return dispatch(structuredClone(state), counsel.action.command).success
}

describe('Task 4: counsel and realm phrases', () => {
  it('has no counsel left at death throes', () => {
    const counsel = adviseCounsel(
      createInitialGameState(),
      quotas([0, 5], [0, 50], [0, 9]),
      'death_throes',
      60,
    )
    expect(counsel).toEqual({
      title: 'No one advises you',
      text: 'Your counsellors have fled the castle.',
      action: null,
    })
  })

  it('praises a realm where every quota is met', () => {
    const counsel = adviseCounsel(
      createInitialGameState(),
      quotas([9, 5], [99, 50], [9, 9]),
      'enchanted',
      60,
    )
    expect(counsel).toEqual({
      title: 'The Steward advises',
      text: 'Every quota is met. Keep the realm quiet.',
      action: null,
    })
  })

  it('sends the Marshal for the army, warning when the audit is close', () => {
    const state = createInitialGameState({ ap: 100000, deadline: 3 })
    const advice = adviseCounsel(state, quotas([9, 5], [99, 50], [49, 70]), 'uneasy', 60)
    expect(advice.title).toBe('The Marshal advises')
    expect(advice.text).toBe("The army is 21 men short of the Crown's demand.")
    expect(advice.action?.label).toMatch(/^Recruit \d+, [\d,]+ AP$/)
    expect(accepted(state, advice)).toBe(true)

    const warning = adviseCounsel(state, quotas([9, 5], [99, 50], [41, 70]), 'uneasy', 20)
    expect(warning.title).toBe('The Marshal warns')
    expect(warning.text).toBe('The army is 29 men short, and the audit is close.')
  })

  it('sends the Steward for the People with a purchase of peasants', () => {
    const state = createInitialGameState({ ap: 100000, deadline: 3 })
    const advice = adviseCounsel(state, quotas([9, 5], [500, 550], [70, 70]), 'rotting', 60)
    expect(advice.title).toBe('The Steward warns')
    expect(advice.text).toBe("The People are 50 souls short of the Crown's demand.")
    expect(advice.action?.label).toMatch(/^Buy 10 peasants, [\d,]+ AP$/)
    expect(accepted(state, advice)).toBe(true)
  })

  it('sends the Chancellor for the AP rate with a purchase of scribes', () => {
    const state = createInitialGameState({ ap: 100000 })
    const advice = adviseCounsel(state, quotas([2.5, 6], [99, 50], [9, 9]), 'enchanted', 60)
    expect(advice.title).toBe('The Chancellor advises')
    expect(advice.text).toBe("The Chancery is 3.5 AP each second short of the Crown's demand.")
    expect(advice.action?.label).toMatch(/^Hire 1 scribe, [\d,.]+ AP$/)
    expect(accepted(state, advice)).toBe(true)
  })

  it('offers nothing the treasury cannot pay', () => {
    const state = createInitialGameState({ ap: 0 })
    const advice = adviseCounsel(state, quotas([0, 6], [99, 50], [9, 9]), 'enchanted', 60)
    expect(advice.text).toBe("The Chancery is 6 AP each second short of the Crown's demand.")
    expect(advice.action).toBeNull()
  })

  it('writes the clock, the rate, the unrest and the audit ordinal', () => {
    expect(formatClock(78)).toBe('1:18')
    expect(formatClock(0.2)).toBe('0:01')
    expect(formatClock(100)).toBe('1:40')
    expect(formatRate(81.4)).toBe('+81 AP each second')
    expect(formatRate(-5)).toBe('−5 AP each second')
    expect(unrestLine(28)).toBe('Unrest 28%, the realm is quiet')
    expect(unrestLine(58)).toBe('Unrest 58%, the villages refuse to pay')
    expect(unrestLine(81)).toBe('Unrest 81%, strife and desertion')
    expect(unrestLine(94)).toBe('Unrest 94%, the towns rise against you')
    expect(auditOrdinal(3)).toBe('third')
  })
})
