<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command } from '@/core/types'
import type { MomentAnswer } from '@/ui/moments'

/** One framed answer with its consequence; a blocked answer states why (Figma `53:335`). */
defineProps<{ answer: MomentAnswer }>()
const emit = defineEmits<{ choose: [command: Command] }>()
</script>

<template>
  <button
    data-moment-answer
    type="button"
    :disabled="answer.command === null"
    class="flex w-full items-center gap-3 rounded-lg border-[1.5px] px-3 py-2 text-left shadow-[0_3px_0_0_rgb(77_46_15/0.35)] transition-transform duration-100 enabled:active:translate-y-0.5 disabled:opacity-60 disabled:shadow-none"
    :class="answer.tone === 'grave' ? 'border-rubric bg-wax/12' : 'border-gold bg-vellum-shade'"
    @click="answer.command && emit('choose', answer.command)"
  >
    <GameIcon
      :name="answer.icon"
      label=""
      class="size-[30px]"
      :class="answer.tone === 'grave' ? 'text-rubric' : 'text-ink'"
    />
    <span class="min-w-0">
      <span
        class="block font-display text-[21px] leading-[28px]"
        :class="answer.tone === 'grave' ? 'text-rubric' : 'text-ink'"
      >
        {{ answer.label }}
      </span>
      <span
        v-if="answer.detail"
        class="block font-body text-base italic leading-[22px] text-ink-faded"
      >
        {{ answer.detail }}
      </span>
      <span
        v-if="answer.blocked"
        class="block font-body text-base italic leading-[22px] text-rubric"
      >
        {{ answer.blocked }}
      </span>
    </span>
  </button>
</template>
