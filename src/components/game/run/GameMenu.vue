<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useArchivesStore } from '@/stores/archives'
import { useGameStore } from '@/stores/game'
import { useNavStore } from '@/stores/nav'
import { useSettingsStore } from '@/stores/settings'
import type { DreadBand } from '@/ui/dread'
import { auditOrdinal, capitalized } from '@/ui/realmText'

/** The game menu over the run (Figma `39:2303`); the reign is paused while it is open. */
const archives = useArchivesStore()
const game = useGameStore()
const nav = useNavStore()
const settings = useSettingsStore()

const CONFIRM_MS = 3000
const BANDS: DreadBand[] = ['enchanted', 'uneasy', 'rotting', 'death_throes']
const isDev = import.meta.env.DEV

const confirmAbandon = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | null = null
let pausedBefore = false
const firstItem = ref<HTMLButtonElement | null>(null)

const ordinal = computed(() => auditOrdinal(game.auditAhead))
const timeLeft = computed(() => {
  const total = Math.max(0, Math.ceil(game.secondsLeft))
  return `${Math.floor(total / 60)} min ${total % 60} s left`
})
const savedLine = computed(() =>
  game.lastSavedDeadline === null
    ? 'Not saved yet'
    : `Last saved at the ${auditOrdinal(game.lastSavedDeadline)} audit`,
)

function setPaused(paused: boolean): void {
  if (game.run && !game.isOver && game.run.isPaused !== paused) {
    game.act({ type: 'SET_PAUSED', paused })
  }
}

// Synchronous, so a menu action that closes the menu restores the pause before it acts.
watch(
  () => nav.menuOpen,
  (open) => {
    if (open) {
      pausedBefore = game.run?.isPaused ?? false
      setPaused(true)
      document.addEventListener('keydown', onKeydown)
      void nextTick(() => firstItem.value?.focus())
    } else {
      setPaused(pausedBefore)
      disarmAbandon()
      document.removeEventListener('keydown', onKeydown)
    }
  },
  { flush: 'sync' },
)

function close(): void {
  nav.menuOpen = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close()
}

function disarmAbandon(): void {
  if (confirmTimer) clearTimeout(confirmTimer)
  confirmTimer = null
  confirmAbandon.value = false
}

/** Reading the chronicle from the menu keeps the reign paused: the player stopped to read. */
function readChronicle(): void {
  pausedBefore = true
  nav.go('chronicle')
}

function restart(): void {
  close()
  game.restart()
}

function returnToHall(): void {
  close()
  game.save()
  nav.go('hall')
}

function abandon(): void {
  if (!confirmAbandon.value) {
    disarmAbandon()
    confirmAbandon.value = true
    confirmTimer = setTimeout(disarmAbandon, CONFIRM_MS)
    return
  }
  close()
  game.abandon()
}

onUnmounted(() => {
  disarmAbandon()
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Transition name="slide">
    <div v-if="nav.menuOpen" class="absolute inset-0 z-40 flex bg-ink/40">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Game menu"
        class="flex w-[300px] flex-col gap-2 overflow-y-auto bg-vellum px-4 py-5 shadow-xl"
      >
        <h2 class="font-display text-[26px] text-ink">Reign {{ archives.history.length + 1 }}</h2>
        <p class="font-body italic text-ink-faded">
          {{ capitalized(ordinal) }} audit, {{ timeLeft }}
        </p>
        <p class="font-body text-base italic text-rubric">Game paused while this menu is open.</p>

        <button ref="firstItem" type="button" class="menu-item" @click="close">
          Resume<small>Back to the {{ ordinal }} audit</small>
        </button>
        <button type="button" class="menu-item" @click="game.save()">
          Save the reign<small>{{ savedLine }}</small>
        </button>
        <button type="button" class="menu-item" @click="restart">
          Restart the reign<small>Same seed, from the coronation</small>
        </button>
        <button type="button" class="menu-item" @click="readChronicle">
          Read the chronicle<small>Every audit since the coronation</small>
        </button>
        <button type="button" class="menu-item" @click="returnToHall">
          Return to the hall<small>The reign is saved and waits for you</small>
        </button>

        <p class="mt-2 font-caps text-base text-rubric">Settings</p>
        <label class="setting"><input v-model="settings.music" type="checkbox" />Music</label>
        <label class="setting"><input v-model="settings.sfx" type="checkbox" />Sound effects</label>
        <label class="setting">
          <input v-model="settings.reducedMotion" type="checkbox" />Reduced motion
        </label>
        <label v-if="isDev" class="setting">
          Dread band (dev)
          <select v-model="settings.dreadOverride" class="ml-auto bg-vellum-shade">
            <option :value="null">from the reign</option>
            <option v-for="band in BANDS" :key="band" :value="band">{{ band }}</option>
          </select>
        </label>

        <button type="button" class="menu-item danger mt-3" @click="abandon">
          {{ confirmAbandon ? 'Tap again to abandon' : 'Abandon the reign'
          }}<small>Counts as a death.</small>
        </button>
      </section>
      <button type="button" class="flex-1" aria-label="Close the menu" @click="close" />
    </div>
  </Transition>
</template>

<style scoped>
.menu-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 1px solid var(--color-gold);
  border-radius: 3px;
  background: var(--color-vellum-shade);
  padding: 6px 10px;
  text-align: left;
  font-family: var(--font-body);
  font-size: 17px;
  color: var(--color-ink);
}
.menu-item.danger {
  border-color: var(--color-rubric);
  color: var(--color-rubric);
}
.menu-item small {
  font-size: 16px;
  font-style: italic;
  color: var(--color-ink-faded);
}
.setting {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-body);
  color: var(--color-ink);
}
</style>
