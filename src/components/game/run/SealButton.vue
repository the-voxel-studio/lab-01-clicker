<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { useGameStore } from '@/stores/game'
import { useSettingsStore } from '@/stores/settings'
import type { DreadBand } from '@/ui/dread'
import { burstMissives, missiveIcons, MISSIVE_MS, type Missive } from '@/ui/sealBurst'

/** The wax seal: each press issues a decree (design 5, ported from the prototype). */
const game = useGameStore()
const settings = useSettingsStore()

/** Colour of the decree gains: the rose of grace fading with the band, blood at the end. */
const GAIN_COLOURS: Record<DreadBand, string> = {
  enchanted: 'text-rose',
  uneasy: 'text-[#c94f86]',
  rotting: 'text-[#7e3d5e]',
  death_throes: 'text-blood',
}
const PRESS_MS = 160

const pressed = ref(false)
const missives = ref<Missive[]>([])
const gains = ref<{ id: number; text: string; dx: number }[]>([])
const timers = new Set<ReturnType<typeof setTimeout>>()
let nextId = 0

const officials = computed(() => {
  void game.revision
  const icons = game.run ? missiveIcons(game.run) : []
  return icons[0] === 'scroll' ? [] : icons.slice(0, 4)
})
const gainColour = computed(() => GAIN_COLOURS[game.dread.band])

function later(action: () => void, ms: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    action()
  }, ms)
  timers.add(timer)
}

function seal(): void {
  const before = game.coffer
  if (!game.act({ type: 'STAMP_DOCUMENT' }).success) return
  pressed.value = true
  later(() => (pressed.value = false), PRESS_MS)
  if (settings.reducedMotion || !game.run) return
  const burst = burstMissives(Math.random, missiveIcons(game.run), nextId)
  nextId += burst.length + 1
  missives.value = missives.value.concat(burst)
  const gain = {
    id: nextId,
    text: `+${(Math.round((game.coffer - before) * 10) / 10).toLocaleString('en')}`,
    dx: Math.round((Math.random() - 0.5) * 120),
  }
  gains.value = gains.value.concat(gain)
  later(() => {
    const done = new Set(burst.map((m) => m.id))
    missives.value = missives.value.filter((m) => !done.has(m.id))
    gains.value = gains.value.filter((g) => g.id !== gain.id)
  }, MISSIVE_MS)
}

onUnmounted(() => timers.forEach((timer) => clearTimeout(timer)))
</script>

<template>
  <div class="relative mx-auto flex size-[160px] items-center justify-center">
    <template v-if="!settings.reducedMotion">
      <div
        class="spin-slow pointer-events-none absolute size-[176px] rounded-full border border-dashed border-gold/30"
      />
      <div
        class="pointer-events-none absolute size-[150px] rounded-full border transition-all duration-200"
        :class="pressed ? 'scale-115 border-gold opacity-80' : 'border-wax/30 opacity-20'"
      />
    </template>

    <span
      v-for="(icon, index) in officials"
      :key="icon"
      class="absolute flex size-7 items-center justify-center rounded border border-gold/50 bg-vellum-shade"
      :class="[
        ['-left-1 top-2', '-right-1 top-2', '-left-1 bottom-2', '-right-1 bottom-2'][index],
        pressed && !settings.reducedMotion ? 'admin-stamp' : '',
      ]"
    >
      <GameIcon :name="icon" class="size-4 text-ink" />
    </span>

    <span
      v-for="m in missives"
      :key="m.id"
      class="missive pointer-events-none absolute z-0 flex h-[21px] w-[30px] items-center justify-center rounded-[2px] bg-cream shadow"
      :style="{
        '--dx': `${m.dx}px`,
        '--dy': `${m.dy}px`,
        '--rot': `${m.rotate}deg`,
        '--scale': m.scale,
      }"
    >
      <GameIcon :name="m.icon" class="size-3.5 text-wax" />
    </span>

    <span
      v-for="g in gains"
      :key="g.id"
      class="gain pointer-events-none absolute z-20 font-display text-2xl"
      :class="gainColour"
      :style="{ '--dx': `${g.dx}px` }"
    >
      {{ g.text }}
    </span>

    <button
      type="button"
      class="relative z-10 flex size-[120px] items-center justify-center rounded-[46%_54%_50%_50%/52%_48%_55%_45%] bg-wax shadow-lg transition-transform duration-150 active:scale-95"
      :class="pressed ? 'scale-90' : ''"
      @click="seal"
    >
      <GameIcon name="crown" class="size-[42px] text-blood/80" label="Royal seal" />
      <span class="sr-only">Seal a decree</span>
    </button>
  </div>
</template>

<style scoped>
.spin-slow {
  animation: spin-slow 24s linear infinite;
}
@keyframes spin-slow {
  to {
    transform: rotate(360deg);
  }
}
.missive {
  animation: fly-letter-out 0.75s cubic-bezier(0.12, 0.8, 0.32, 1) forwards;
  will-change: transform, opacity;
}
@keyframes fly-letter-out {
  0% {
    transform: translate(0, 0) scale(0.35) rotate(0deg);
    opacity: 1;
  }
  60% {
    opacity: 0.95;
  }
  100% {
    transform: translate(var(--dx), var(--dy)) scale(var(--scale)) rotate(var(--rot));
    opacity: 0;
  }
}
.gain {
  animation: gain-rise 0.75s ease-out forwards;
}
@keyframes gain-rise {
  from {
    transform: translate(var(--dx), -40px);
    opacity: 1;
  }
  to {
    transform: translate(var(--dx), -110px);
    opacity: 0;
  }
}
.admin-stamp {
  animation: admin-stamp 0.16s ease-in-out;
}
@keyframes admin-stamp {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(3px) scale(1.12, 0.85);
  }
}
</style>
