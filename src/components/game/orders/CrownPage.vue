<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { Command, GameState } from '@/core/types'
import type { EdictId } from '@/data/edicts'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { coloniseView, edictRows, upcomingTaxRate, type EdictRow as EdictView } from '@/ui/crown'
import { realmRates, type RealmRates } from '@/ui/effects'
import ArmyTab from '../crown/ArmyTab.vue'
import CofferTab from '../crown/CofferTab.vue'
import CrownTabs from '../crown/CrownTabs.vue'
import DecreesTab from '../crown/DecreesTab.vue'
import RealmTab from '../crown/RealmTab.vue'
import OrderFrame from './OrderFrame.vue'
import TaxSlider from './TaxSlider.vue'

/**
 * The Crown: the recap of the reign in four tabs, with the tax on Coffer, new land on Realm and
 * the emergency edicts on Decrees, whose leaves replace the inner scroll.
 */
const REFRESH_MS = 250
const game = useGameStore()
const nav = useNavStore()
const rates = ref<RealmRates | null>(null)
const refused = ref(false)
const stamped = ref<EdictId | null>(null)
const raised = ref(0)

/** Reads the reign after the last engine call: its object never changes, only `revision` does. */
function current(): GameState | null {
  void game.revision
  return game.run
}

/** Each edict plays on a copy of the realm, so the rows refresh 4 times a second, not each frame. */
const edicts = ref<EdictView[]>([])
const draftRate = ref<number | null>(null)
function readEdicts(): void {
  edicts.value = game.run
    ? edictRows(game.run, game.config, upcomingTaxRate(game.run, draftRate.value, game.heldTax))
    : []
  rates.value = game.run ? realmRates(game.run, game.config) : null
}
readEdicts()
const edictTimer = setInterval(readEdicts, REFRESH_MS)
onUnmounted(() => clearInterval(edictTimer))
const colonise = computed(() => {
  const run = current()
  return run ? coloniseView(run, game.config) : null
})

/** A refusal speaks of the order just given: it does not follow the player to another tab. */
watch(
  () => nav.crownTab,
  () => (refused.value = false),
)

function readDraft(rate: number): void {
  draftRate.value = rate
  readEdicts()
}

function act(command: Command): void {
  refused.value = !game.act(command).success
  if (refused.value) return
  if (command.type === 'ENACT_EDICT') stamped.value = command.edictId
  if (command.type === 'COLONISE_PROVINCE') raised.value++
  readEdicts()
}
</script>

<template>
  <OrderFrame title="The Crown" intro="" tabbed>
    <template #header>
      <CrownTabs class="mt-1" />
    </template>
    <div v-if="game.run" class="flex h-full min-h-0 flex-col">
      <p v-if="refused" data-refusal class="shrink-0 font-body text-base italic text-rubric">
        The Crown refuses this order.
      </p>
      <div
        data-crown-body
        class="min-h-0 flex-1"
        :class="nav.crownTab === 'decrees' ? 'overflow-hidden' : 'overflow-y-auto'"
      >
        <RealmTab
          v-if="nav.crownTab === 'realm' && rates"
          :run="game.run"
          :rates="rates"
          :colonise="colonise"
          :raised="raised"
          @act="act"
        />
        <template v-else-if="nav.crownTab === 'coffer'">
          <CofferTab :run="game.run" :revision="game.revision" />
          <TaxSlider
            class="mt-3"
            :run="game.run"
            :revision="game.revision"
            :held="game.heldTax"
            @proclaim="act({ type: 'SET_TAX_RATE', rate: $event })"
            @draft="readDraft"
          />
        </template>
        <ArmyTab v-else-if="nav.crownTab === 'army'" :run="game.run" :revision="game.revision" />
        <DecreesTab
          v-else-if="nav.crownTab === 'decrees'"
          :run="game.run"
          :revision="game.revision"
          :edicts="edicts"
          :stamped="stamped"
          @enact="act"
        />
      </div>
    </div>
  </OrderFrame>
</template>
