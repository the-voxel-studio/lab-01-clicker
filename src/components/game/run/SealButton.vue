<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { useGameStore } from '@/stores/game'
import { burstMissives, missiveIcons, MISSIVE_MS, type Missive } from '@/ui/sealBurst'
import { useMotionAllowed } from './useAmbientMotion'

/** The wax seal: each press issues a decree (design 5, ported from the prototype). */
const game = useGameStore()
const motionOn = useMotionAllowed()

const PRESS_MS = 160
/** The inner ring stays out this long after the last click, so a quick run keeps it there. */
const RING_HOLD_MS = 400
/** On the vellum, either side of the lower half of the seal, so the kingdom stays clear. */
const OFFICIAL_PLACES = ['-left-[40px]', '-right-[40px]', '-left-[78px]', '-right-[78px]']

const pressed = ref(false)
const ringOut = ref(false)
let ringTimer: ReturnType<typeof setTimeout> | null = null
const missives = ref<Missive[]>([])
const gains = ref<{ id: number; text: string; dx: number }[]>([])
const timers = new Set<ReturnType<typeof setTimeout>>()
let nextId = 0

const officials = computed(() => {
  void game.revision
  const icons = game.run ? missiveIcons(game.run) : []
  return icons[0] === 'scroll' ? [] : icons.slice(0, 4)
})

function later(action: () => void, ms: number): void {
  const timer = setTimeout(() => {
    timers.delete(timer)
    action()
  }, ms)
  timers.add(timer)
}

function holdRing(): void {
  ringOut.value = true
  if (ringTimer !== null) clearTimeout(ringTimer)
  ringTimer = setTimeout(() => (ringOut.value = false), RING_HOLD_MS)
}

function seal(): void {
  const before = game.coffer
  if (!game.act({ type: 'STAMP_DOCUMENT' }).success) return
  pressed.value = true
  later(() => (pressed.value = false), PRESS_MS)
  if (!motionOn.value || !game.run) return
  holdRing()
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

onUnmounted(() => {
  timers.forEach((timer) => clearTimeout(timer))
  if (ringTimer !== null) clearTimeout(ringTimer)
})
</script>

<template>
  <div class="relative mx-auto flex size-[160px] items-center justify-center">
    <template v-if="motionOn">
      <div
        class="spin-slow pointer-events-none absolute size-[176px] rounded-full border-2 border-dashed border-wax/70"
      />
      <div
        data-seal-ring
        class="pointer-events-none absolute size-[150px] rounded-full border-2 transition-all"
        :class="
          ringOut
            ? 'scale-[1.16] border-wax opacity-100 duration-100'
            : 'border-rubric/60 opacity-70 duration-500'
        "
      />
    </template>

    <span
      v-for="(icon, index) in officials"
      :key="icon"
      data-official
      class="absolute top-[92px] flex size-7 items-center justify-center rounded border border-wax/70 bg-vellum shadow"
      :class="[OFFICIAL_PLACES[index], pressed && motionOn ? 'admin-stamp' : '']"
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
      class="gain pointer-events-none absolute z-20 font-display text-2xl text-ink"
      :style="{ '--dx': `${g.dx}px` }"
    >
      {{ g.text }}
    </span>

    <button
      type="button"
      class="relative z-10 flex size-[120px] items-center justify-center rounded-[46%_54%_50%_50%/52%_48%_55%_45%] bg-wax shadow-lg transition-transform duration-150 active:scale-95"
      :class="pressed ? 'scale-90' : 'motion-breathe'"
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
  /* Ink with a pale halo stays readable on the fields, the vellum and the blood sky alike. */
  text-shadow:
    0 0 3px var(--color-cream),
    0 0 3px var(--color-cream),
    0 0 6px var(--color-cream);
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
