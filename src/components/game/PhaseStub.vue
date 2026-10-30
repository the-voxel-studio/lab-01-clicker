<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Command, RunPhase } from '@/core/types'
import { DILEMMAS_DATA } from '@/data/dilemmas'
import { useGameStore } from '@/stores/game'

/** One answer of a stub: its label and the command it dispatches. */
interface StubAnswer {
  label: string
  command: Command
}

const game = useGameStore()
const error = ref<string | null>(null)

/** Fixed answers per phase; the dilemma answers come from the current dilemma. */
const FIXED_ANSWERS: Partial<Record<RunPhase, StubAnswer[]>> = {
  AUDIT_ASSESSMENT: [{ label: 'Accept the verdict', command: { type: 'SUBMIT_AUDIT' } }],
  COUNCIL_LAWS: [{ label: 'Reject the laws', command: { type: 'REJECT_LAWS' } }],
  THREAT_HERALD: [
    { label: 'Defend', command: { type: 'SELECT_THREAT_RESPONSE', response: 'defense' } },
    { label: 'Pay the tribute', command: { type: 'SELECT_THREAT_RESPONSE', response: 'tribute' } },
    { label: 'Raise a levy', command: { type: 'SELECT_THREAT_RESPONSE', response: 'levy' } },
  ],
  EXPEDITION: [{ label: 'Stay home', command: { type: 'SKIP_EXPEDITION' } }],
  AWAIT_RESUME: [{ label: 'Resume governance', command: { type: 'RESUME_GOVERNANCE' } }],
  SURPRISE_RAID: [{ label: 'Hold the border', command: { type: 'RESOLVE_RAID_DEFENSE' } }],
  LOMBARD_OFFER: [
    { label: 'Take the loan', command: { type: 'ACCEPT_LOMBARD_LOAN' } },
    { label: 'Refuse', command: { type: 'REFUSE_LOMBARD_LOAN' } },
  ],
}

const answers = computed<StubAnswer[]>(() => {
  const phase = game.phase
  if (phase !== 'COUNCIL_DILEMMA') return phase ? (FIXED_ANSWERS[phase] ?? []) : []
  const dilemmaId = game.run?.currentDilemmaId ?? null
  const dilemma = dilemmaId === null ? undefined : DILEMMAS_DATA[dilemmaId]
  if (!dilemma || dilemmaId === null) return []
  return dilemma.choices.map((choice, choiceIndex) => ({
    label: choice.text,
    command: { type: 'RESOLVE_DILEMMA', dilemmaId, choiceIndex },
  }))
})

watch(
  () => game.phase,
  () => {
    error.value = null
  },
)

function answer(command: Command): void {
  const result = game.act(command)
  error.value = result.success ? null : (result.error ?? 'The Crown refuses.')
}
</script>

<template>
  <div
    data-phase-stub
    class="absolute inset-0 z-30 flex flex-col justify-center gap-4 overflow-y-auto bg-vellum px-6 py-10"
  >
    <h2 class="font-display text-2xl text-ink">{{ game.phase }}</h2>
    <button
      v-for="item in answers"
      :key="item.label"
      type="button"
      class="rounded border border-ink-faded bg-vellum-shade px-4 py-3 text-left font-body text-ink"
      @click="answer(item.command)"
    >
      {{ item.label }}
    </button>
    <p v-if="error" data-stub-error class="font-body italic text-rubric">{{ error }}</p>
  </div>
</template>
