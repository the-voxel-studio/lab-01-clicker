<script setup lang="ts">
import { REALM_RULES } from '@/data/rulesCopy'
import { useNavStore } from '@/stores/nav'

/** The plain rules of the realm, opened from the game menu. */
const nav = useNavStore()
</script>

<template>
  <section data-how-to-reign class="flex min-h-0 flex-1 flex-col px-5 pb-3 pt-6">
    <h1 class="font-display text-[28px] leading-8 text-ink">How to reign</h1>
    <div class="mt-2 min-h-0 flex-1 overflow-y-auto">
      <div v-for="rule in REALM_RULES" :key="rule.title" class="border-b border-ink-faded/30 py-2">
        <h2 class="font-caps text-base leading-5 text-rubric">{{ rule.title }}</h2>
        <p class="font-body text-[18px] leading-6 text-ink">{{ rule.text }}</p>
      </div>
    </div>
    <button
      type="button"
      data-back
      class="mt-2 min-h-11 self-start font-body text-[18px] text-rubric underline"
      @click="nav.go('run')"
    >
      Back to the reign
    </button>
  </section>
</template>
