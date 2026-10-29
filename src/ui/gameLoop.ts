/**
 * Frame loop that drives the engine: one step per animation frame with the elapsed seconds,
 * clamped so a long gap never feeds one huge step, and paused while the page is hidden.
 *
 * @module ui/gameLoop
 */

/** Longest step fed to the engine in one frame, in seconds. */
export const MAX_FRAME_SECONDS = 0.25

/** Schedules frame callbacks; the default wraps `requestAnimationFrame`. */
export interface FrameScheduler {
  request(cb: (timeMs: number) => void): number
  cancel(id: number): void
}

/** The part of `Document` the loop reads: its visibility and the change event. */
export interface VisibilitySource {
  readonly hidden: boolean
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

const animationFrames: FrameScheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
}

/**
 * Creates a loop that calls `step(dt)` once per frame. The first frame after `start`, or after
 * the page becomes visible again, only records its timestamp; no step runs while the page is hidden.
 *
 * @param step - Receives the elapsed seconds, at most `MAX_FRAME_SECONDS`.
 * @param scheduler - Frame source (tests pass a fake one).
 * @param doc - Visibility source (defaults to `document`).
 */
export function createGameLoop(
  step: (dt: number) => void,
  scheduler: FrameScheduler = animationFrames,
  doc: VisibilitySource = document,
): { start(): void; stop(): void; running(): boolean } {
  let frameId: number | null = null
  let lastMs: number | null = null

  const onVisibilityChange = (): void => {
    lastMs = null
  }

  const onFrame = (timeMs: number): void => {
    frameId = scheduler.request(onFrame)
    if (doc.hidden) {
      lastMs = null
      return
    }
    if (lastMs !== null) step(Math.min((timeMs - lastMs) / 1000, MAX_FRAME_SECONDS))
    lastMs = timeMs
  }

  return {
    start() {
      if (frameId !== null) return
      lastMs = null
      doc.addEventListener('visibilitychange', onVisibilityChange)
      frameId = scheduler.request(onFrame)
    },
    stop() {
      if (frameId === null) return
      scheduler.cancel(frameId)
      frameId = null
      doc.removeEventListener('visibilitychange', onVisibilityChange)
    },
    running: () => frameId !== null,
  }
}
