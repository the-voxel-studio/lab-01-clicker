<script setup lang="ts">
import { computed } from 'vue'
import { GAME_ICONS, type GameIconKey } from '@/data/icons'

/** Component property contract for GameIcon. */
interface Props {
  /** The icon identifier matching a key in GAME_ICONS. */
  name: GameIconKey
  /** Optional custom accessibility label. Defaults to the icon's standard label. */
  label?: string
}

const props = defineProps<Props>()

const icon = computed(() => GAME_ICONS[props.name])
const iconLabel = computed(() => props.label ?? icon.value?.label ?? props.name)
const innerSvg = computed(() => icon.value?.innerHtml ?? '')
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    fill="currentColor"
    :aria-label="iconLabel"
    role="img"
    class="inline-block shrink-0 align-middle"
    v-html="innerSvg"
  />
</template>
