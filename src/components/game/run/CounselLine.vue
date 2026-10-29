<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '@/stores/game'
import { adviseCounsel } from '@/ui/counsel'

/** One counsellor and one direct action, under the kingdom (design 4.2, fourth pass). */
const game = useGameStore()
const error = ref<string | null>(null)

const counsel = computed(() => {
  const run = game.run
  void game.revision
  return run ? adviseCounsel(run, game.quotas, game.dread.band, game.secondsLeft) : null
})

watch(
  () => counsel.value?.action?.label,
  () => (error.value = null),
)

function follow(): void {
  const action = counsel.value?.action
  if (!action) return
  const result = game.act(action.command)
  error.value = result.success ? null : (result.error ?? 'The Crown refuses.')
}
</script>

<template>
  <section v-if="counsel" class="flex items-start gap-3 px-4">
    <div class="min-w-0 flex-1">
      <p class="font-caps text-sm text-rubric">{{ counsel.title }}</p>
      <p class="font-body text-[17px] leading-6 text-ink">{{ counsel.text }}</p>
      <p v-if="error" class="font-body text-sm italic text-rubric">{{ error }}</p>
    </div>
    <button
      v-if="counsel.action"
      type="button"
      data-counsel-action
      class="w-[132px] shrink-0 rounded border border-gold bg-wax px-2 py-1.5 font-body italic leading-tight text-cream"
      @click="follow"
    >
      {{ counsel.action.label }}
    </button>
  </section>
</template>
