/**
 * Navigation store: which screen the single page shows, and whether the game menu is open.
 * Replaces a router, which the single file build does not need.
 *
 * @module stores/nav
 */

import { ref } from 'vue'
import { defineStore } from 'pinia'

/** Every screen of the game. */
export type Screen =
  | 'hall'
  | 'run'
  | 'order_people'
  | 'order_admin'
  | 'order_military'
  | 'fortune'
  | 'crown'
  | 'chronicle'
  | 'how_to_reign'
  | 'hall_of_feats'
  | 'fate'
  | 'end'

/** The tabs of the Crown, in order. */
export const CROWN_TABS = ['realm', 'coffer', 'army', 'decrees'] as const

/** One tab of the Crown. */
export type CrownTab = (typeof CROWN_TABS)[number]

/** The current screen and the game menu toggle. */
export const useNavStore = defineStore('nav', () => {
  const screen = ref<Screen>('hall')
  const menuOpen = ref(false)
  const crownTab = ref<CrownTab>('realm')

  /** Shows a screen and closes the game menu. */
  function go(next: Screen): void {
    screen.value = next
    menuOpen.value = false
  }

  return { screen, menuOpen, crownTab, go }
})
