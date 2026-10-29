/**
 * Runs the frame loop while a run screen is shown, and saves the reign when the page is hidden
 * for good (`pagehide`), so a reload in the middle of a deadline loses nothing.
 *
 * @module components/game/useGameLoop
 */

import { onMounted, onUnmounted, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { useNavStore, type Screen } from '@/stores/nav'
import { createGameLoop } from '@/ui/gameLoop'

const SCREENS_WITHOUT_CLOCK: readonly Screen[] = ['hall', 'hall_of_feats', 'end']

/** Drives `game.advance` from animation frames on run screens; call once from the app root. */
export function useGameLoop(): void {
  const game = useGameStore()
  const nav = useNavStore()
  const loop = createGameLoop((dt) => game.advance(dt))

  const sync = (): void => {
    const shouldRun =
      game.run !== null && !game.isOver && !SCREENS_WITHOUT_CLOCK.includes(nav.screen)
    if (shouldRun && !loop.running()) loop.start()
    else if (!shouldRun && loop.running()) loop.stop()
  }

  const onPageHide = (): void => game.save()
  // Mobile browsers often discard a background tab without firing `pagehide`.
  const onVisibilityChange = (): void => {
    if (document.hidden) game.save()
  }

  watch(() => [nav.screen, game.run, game.isOver], sync)

  onMounted(() => {
    sync()
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    loop.stop()
    window.removeEventListener('pagehide', onPageHide)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
