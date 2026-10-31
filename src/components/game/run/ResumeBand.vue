<script setup lang="ts">
import { computed, ref } from 'vue'
import { useChronicleStore } from '@/stores/chronicle'
import { useGameStore } from '@/stores/game'

/** The open resume: time stands still above the order bar until the player takes it up again. */
const game = useGameStore()
const chronicle = useChronicleStore()
const error = ref<string | null>(null)

/** The last deed of the reign, told beside the button that takes it up again. */
const lastDeed = computed(() => chronicle.entries[0]?.text ?? null)

function resume(): void {
  const result = game.act({ type: 'RESUME_GOVERNANCE' })
  error.value = result.success ? null : (result.error ?? 'The Crown refuses.')
}
</script>

<template>
  <div
    data-resume-band
    class="flex shrink-0 items-center gap-3 border-t border-gold/60 bg-vellum-shade px-4 py-1.5"
  >
    <div class="min-w-0 flex-1 font-body text-[13px] italic leading-[17px]">
      <p v-if="lastDeed" class="resume-deed truncate text-ink">{{ lastDeed }}</p>
      <p class="text-ink-faded">Time stands still until you resume.</p>
      <p v-if="error" class="text-rubric">{{ error }}</p>
    </div>
    <button
      data-resume
      type="button"
      class="min-h-11 shrink-0 rounded bg-wax px-3 font-display text-base leading-5 text-cream shadow transition-transform duration-100 active:scale-95"
      @click="resume"
    >
      Resume governance
    </button>
  </div>
</template>

<style scoped>
@media (max-height: 520px) {
  .resume-deed {
    display: none;
  }
}
</style>
