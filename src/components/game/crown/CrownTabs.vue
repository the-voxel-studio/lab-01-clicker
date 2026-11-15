<script setup lang="ts">
import { computed } from 'vue'
import RegisterTabs from '@/components/game/ledger/RegisterTabs.vue'
import { useGameStore } from '@/stores/game'
import { CROWN_TABS, useNavStore, type CrownTab } from '@/stores/nav'
import { crownMarks } from '@/ui/crownRecap'

/**
 * The four tabs of the Crown; the choice lasts for the reign. One line says what the open tab
 * holds and what is ordered there, and a mark shows the tabs that answer an alarm.
 */
const game = useGameStore()
const nav = useNavStore()
const NAMES: Record<CrownTab, string> = {
  realm: 'Realm',
  coffer: 'Coffer',
  army: 'Army',
  decrees: 'Decrees',
}
const INTROS: Record<CrownTab, string> = {
  realm: 'Your land and people. Settle new land here.',
  coffer: 'What comes in and goes out. Set the tax here.',
  army: 'Your force, and what comes against it.',
  decrees: 'Proclaim an edict. Read the laws in force.',
}
const tabs = computed(() => {
  void game.revision
  const marks = game.run ? crownMarks(game.run) : {}
  return CROWN_TABS.map((id) => ({ id, label: NAMES[id], mark: marks[id] }))
})
</script>

<template>
  <div>
    <RegisterTabs
      :tabs="tabs"
      :selected="nav.crownTab"
      label="The Crown"
      attr="data-crown-tab"
      fill
      @select="nav.crownTab = $event"
    />
    <p
      data-crown-intro
      class="crown-intro font-body text-base italic leading-[22px] text-ink-faded"
    >
      {{ INTROS[nav.crownTab] }}
    </p>
  </div>
</template>

<style scoped>
/* Short screens keep the room for the tab itself, as the intro of every order page does. */
@media (max-height: 700px) {
  .crown-intro {
    display: none;
  }
}
</style>
