<script setup lang="ts">
import { ref, computed } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import { GAME_ICONS, type GameIconKey } from '@/data/icons'

const selectedCategory = ref<string>('all')
const searchQuery = ref<string>('')
const activeColor = ref<string>('text-royal-gold')

const colorOptions = [
  { label: 'Royal Gold', class: 'text-royal-gold', bg: 'bg-royal-gold' },
  { label: 'Wax Red', class: 'text-wax-red', bg: 'bg-wax-red' },
  { label: 'Parchment', class: 'text-fief-text', bg: 'bg-fief-text' },
  { label: 'Peasant Green', class: 'text-peasant-green', bg: 'bg-peasant-green' },
  { label: 'Church Purple', class: 'text-clergy-purple', bg: 'bg-clergy-purple' },
  { label: 'Heraldic Blue', class: 'text-heraldic-blue', bg: 'bg-heraldic-blue' },
]

const categories: { key: string; label: string }[] = [
  { key: 'all', label: 'All (81)' },
  { key: 'royal', label: 'Crown' },
  { key: 'admin', label: 'Admin' },
  { key: 'people', label: 'People' },
  { key: 'military', label: 'Military' },
  { key: 'threat', label: 'Threats' },
  { key: 'economy', label: 'Treasury' },
  { key: 'time', label: 'Time' },
  { key: 'ui', label: 'UI' },
]

const allIconsList = Object.values(GAME_ICONS)

const filteredIcons = computed(() => {
  return allIconsList.filter((item) => {
    const matchesCat =
      selectedCategory.value === 'all' || item.category === selectedCategory.value
    const q = searchQuery.value.toLowerCase().trim()
    const matchesQuery =
      !q ||
      item.key.toLowerCase().includes(q) ||
      item.label.toLowerCase().includes(q) ||
      item.sourcePath.toLowerCase().includes(q)
    return matchesCat && matchesQuery
  })
})

const copiedKey = ref<string | null>(null)

async function copySnippet(key: GameIconKey): Promise<void> {
  const code = `<GameIcon name="${key}" class="w-6 h-6" />`
  try {
    await navigator.clipboard.writeText(code)
    copiedKey.value = key
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null
    }, 1500)
  } catch {
    // Clipboard not available
  }
}
</script>

<template>
  <div class="space-y-3 p-3 bg-fief-dark text-fief-text">
    <!-- Header & Search -->
    <div class="bg-fief-card border border-fief-border rounded-lg p-3 space-y-2.5">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-medieval text-royal-gold flex items-center gap-1.5">
          <GameIcon name="crown" class="w-5 h-5 text-royal-gold" />
          <span>Icon Gallery ({{ filteredIcons.length }} / 81)</span>
        </h2>

        <!-- Color Tester Dots -->
        <div class="flex items-center gap-1.5 bg-fief-dark px-2 py-1 rounded border border-fief-border">
          <button
            v-for="c in colorOptions"
            :key="c.class"
            type="button"
            @click="activeColor = c.class"
            :class="[
              c.bg,
              'w-4 h-4 rounded-full border border-fief-border transition-transform cursor-pointer',
              activeColor === c.class ? 'scale-125 ring-2 ring-royal-gold' : 'hover:scale-110'
            ]"
            :title="c.label"
          />
        </div>
      </div>

      <!-- Search Input -->
      <div class="relative">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search icons (e.g. scroll, seal, sword, scribe)..."
          class="w-full bg-fief-dark border border-fief-border rounded px-2.5 py-1.5 text-xs text-fief-text placeholder-fief-text-dim focus:outline-none focus:border-royal-gold"
        />
        <span v-if="searchQuery" class="absolute right-2 top-1.5 text-xs text-fief-text-dim cursor-pointer" @click="searchQuery = ''">✕</span>
      </div>

      <!-- Category Filter Horizontal Scroll -->
      <div class="flex gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
        <button
          v-for="cat in categories"
          :key="cat.key"
          type="button"
          @click="selectedCategory = cat.key"
          :class="[
            'px-2 py-0.5 rounded whitespace-nowrap transition-colors cursor-pointer border',
            selectedCategory === cat.key
              ? 'bg-wax-red text-white border-wax-red font-bold'
              : 'bg-fief-dark text-fief-text-muted border-fief-border hover:text-fief-text'
          ]"
        >
          {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Phone 3-Column Icons Grid -->
    <div class="grid grid-cols-3 gap-2">
      <div
        v-for="item in filteredIcons"
        :key="item.key"
        @click="copySnippet(item.key)"
        class="bg-fief-card border border-fief-border hover:border-royal-gold rounded-lg p-2 flex flex-col items-center text-center transition-all cursor-pointer relative active:scale-95"
      >
        <div class="w-10 h-10 rounded bg-fief-dark border border-fief-border flex items-center justify-center p-1.5 mb-1.5">
          <GameIcon :name="item.key" :class="[activeColor, 'w-7 h-7 transition-colors drop-shadow-xs']" />
        </div>

        <span class="font-mono text-[9px] font-bold text-fief-text truncate max-w-full">
          {{ item.key }}
        </span>

        <span class="text-[8px] text-fief-text-dim italic line-clamp-1 mt-0.5 font-serif-book">
          {{ item.label }}
        </span>

        <div
          v-if="copiedKey === item.key"
          class="absolute inset-0 bg-wax-red/95 text-white font-mono text-[10px] font-bold rounded-lg flex items-center justify-center animate-fade-in"
        >
          Copied!
        </div>
      </div>
    </div>

    <div v-if="filteredIcons.length === 0" class="text-center py-8 bg-fief-card border border-fief-border rounded text-xs text-fief-text-dim italic">
      No icons found matching your query.
    </div>
  </div>
</template>
