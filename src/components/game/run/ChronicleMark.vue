<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'
import type { GameIconKey } from '@/data/icons'
import type { ChronicleKind } from '@/ui/chronicle'

/** The margin mark of a chronicle entry: one icon and one colour per kind. */
defineProps<{ kind: ChronicleKind }>()

const MARKS: Record<ChronicleKind, { icon: GameIconKey; colour: string; label: string }> = {
  decision: { icon: 'waxSeal', colour: 'text-wax', label: 'Your decision' },
  audit: { icon: 'crown', colour: 'text-gold', label: 'Audit' },
  folklore: { icon: 'fleurDeLys', colour: 'text-verdigris', label: 'Folklore' },
  death: { icon: 'skull', colour: 'text-ink', label: 'Death' },
  money: { icon: 'coins', colour: 'text-rubric', label: 'Money' },
}
</script>

<template>
  <GameIcon
    :name="MARKS[kind].icon"
    :label="MARKS[kind].label"
    class="size-4 shrink-0"
    :class="MARKS[kind].colour"
  />
</template>
