/**
 * Frame loop: clamped steps, stop, and the pause while the document is hidden.
 *
 * @module __tests__/unit/ui_game_loop.spec
 */

import { describe, expect, it, vi } from 'vitest'
import { createGameLoop, MAX_FRAME_SECONDS, type FrameScheduler } from '@/ui/gameLoop'

/** A scheduler driven by hand: `frame(t)` runs the pending callback at time `t` ms. */
function fakeScheduler() {
  let pending: ((timeMs: number) => void) | null = null
  const scheduler: FrameScheduler = {
    request(cb) {
      pending = cb
      return 1
    },
    cancel() {
      pending = null
    },
  }
  return {
    scheduler,
    frame(timeMs: number) {
      const cb = pending
      pending = null
      cb?.(timeMs)
    },
  }
}

/** A document whose `hidden` flag and `visibilitychange` event are driven by hand. */
function fakeDocument() {
  const listeners = new Set<() => void>()
  const doc = {
    hidden: false,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }
  return {
    doc,
    setHidden(hidden: boolean) {
      doc.hidden = hidden
      listeners.forEach((listener) => listener())
    },
  }
}

function setup() {
  const step = vi.fn<(dt: number) => void>()
  const clock = fakeScheduler()
  const page = fakeDocument()
  const loop = createGameLoop(step, clock.scheduler, page.doc)
  return { step, clock, page, loop }
}

describe('Task 5: frame loop', () => {
  it('skips the first frame and steps by the elapsed seconds after it', () => {
    const { step, clock, loop } = setup()
    loop.start()
    clock.frame(0)
    clock.frame(16)
    clock.frame(32)
    expect(step.mock.calls).toEqual([[0.016], [0.016]])
    expect(loop.running()).toBe(true)
  })

  it('clamps a long gap to the maximum frame', () => {
    const { step, clock, loop } = setup()
    loop.start()
    clock.frame(0)
    clock.frame(5000)
    expect(step).toHaveBeenLastCalledWith(MAX_FRAME_SECONDS)
    expect(MAX_FRAME_SECONDS).toBe(0.25)
  })

  it('stops stepping after stop', () => {
    const { step, clock, loop } = setup()
    loop.start()
    clock.frame(0)
    loop.stop()
    clock.frame(16)
    expect(step).not.toHaveBeenCalled()
    expect(loop.running()).toBe(false)
  })

  it('pauses while hidden and skips the first visible frame', () => {
    const { step, clock, page, loop } = setup()
    loop.start()
    clock.frame(0)
    clock.frame(16)
    page.setHidden(true)
    clock.frame(32)
    expect(step).toHaveBeenCalledTimes(1)
    page.setHidden(false)
    clock.frame(60000)
    clock.frame(60016)
    expect(step.mock.calls).toEqual([[0.016], [0.016]])
  })
})
