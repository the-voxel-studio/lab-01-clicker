<script setup lang="ts">
import { computed } from 'vue'
import ActionBar from '@/components/game/run/ActionBar.vue'
import { useNavStore, type Screen } from '@/stores/nav'

/** Stands in for the five order pages until plan 03 draws them. */
const nav = useNavStore()

const TITLES: Partial<Record<Screen, string>> = {
  order_people: 'The Commons',
  order_admin: 'The Chancery',
  order_military: 'The Host',
  fortune: 'Fortune',
  crown: 'The Crown',
}
const title = computed(() => TITLES[nav.screen] ?? '')
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col">
    <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-6">
      <h1 class="font-display text-[28px] text-ink">{{ title }}</h1>
      <button
        type="button"
        data-back
        class="self-start font-body italic text-rubric underline"
        @click="nav.go('run')"
      >
        Back to the reign
      </button>
    </div>
    <div class="z-20 shrink-0">
      <ActionBar />
    </div>
  </section>
</template>
