/**
 * Motion helpers for components: whether motion is allowed, figures that roll to their new value,
 * and phase offsets for the ambient loops of a scene (design 4.2.1).
 *
 * @module components/game/run/useAmbientMotion
 */

import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { MOTION, motionAllowed, phaseOffset, rollTowards } from '@/ui/motion'

function systemPrefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** True unless the Reduced motion setting or the system asks for reduced motion. */
export function useMotionAllowed(): ComputedRef<boolean> {
  const settings = useSettingsStore()
  const system = systemPrefersReducedMotion()
  return computed(() => motionAllowed(settings.reducedMotion, system))
}

/**
 * A figure that rolls towards `source` and jumps when motion is off or no animation frame is
 * available. One frame request follows the latest target: the game loop changes the coffer every
 * frame, so restarting on each change would cancel the roll before it ever ran.
 */
export function useRolledNumber(source: () => number, enabled: () => boolean): Ref<number> {
  const shown = ref(source())
  let goal = shown.value
  let frame: number | null = null
  let lastMs = 0

  const stop = (): void => {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
  }
  const tick = (): void => {
    const now = performance.now()
    shown.value = rollTowards(shown.value, goal, now - lastMs, MOTION.roll)
    lastMs = now
    frame = shown.value === goal ? null : requestAnimationFrame(tick)
  }

  watch(source, (target) => {
    goal = target
    if (!enabled() || typeof requestAnimationFrame !== 'function') {
      stop()
      shown.value = target
    } else if (frame === null) {
      lastMs = performance.now()
      frame = requestAnimationFrame(tick)
    }
  })

  onUnmounted(stop)
  return shown
}

const ANIMATED_LAYERS =
  '[id*="-Smoke"], [id*="-Cloud"], [id*="-Tree"], [id*="-Pennant"], [id*="-Peasant"], [id*="-Raven"], [id*="-Flame"], [id*="-Mob"]'

/** Gives each animated layer of `root` its own phase, so no two loops beat together. */
export function spreadPhases(root: Element, seed: number): void {
  root.querySelectorAll<SVGElement>(ANIMATED_LAYERS).forEach((layer, index) => {
    layer.style.animationDelay = `-${phaseOffset(seed, index)}ms`
  })
}
