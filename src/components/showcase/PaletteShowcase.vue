<script setup lang="ts">
import GameIcon from '@/components/common/GameIcon.vue'

const darkFeudalTones = [
  { name: 'Feudal Void', hex: '#120d09', desc: 'Main domain viewport canvas (weathered black oak)' },
  { name: 'Fief Dark', hex: '#18120d', desc: 'Panels & containers background' },
  { name: 'Fief Card', hex: '#201711', desc: 'Unit cards & modal sheet backgrounds' },
  { name: 'Leather Border', hex: '#3d2b1f', desc: 'Subtle parchment borders & dividers' },
  { name: 'Gilded Trim', hex: '#694f26', desc: 'Golden trims for royal decrees & crowns' },
]

const contrastAccents = [
  { name: 'Royal Gold', hex: '#d69e2e', class: 'bg-royal-gold text-ink-black', desc: 'AP, treasury, victories, royal crowns' },
  { name: 'Wax Red', hex: '#9e1d1d', class: 'bg-wax-red text-white', desc: 'Production seal, active deadlines, threats' },
  { name: 'Voxel Pink', hex: '#f60887', class: 'bg-voxel-pink text-white', desc: 'Voxel Lab pilot constraint: imperial insignia & decree seal' },
  { name: 'Parchment Text', hex: '#eedfcb', class: 'bg-fief-text text-ink-black', desc: 'High-legibility primary typography' },
  { name: 'Peasant Green', hex: '#3ea834', class: 'bg-peasant-green text-white', desc: 'Demographic growth & harvests' },
  { name: 'Iron Grey', hex: '#6b7280', class: 'bg-iron-grey text-white', desc: 'Military forces & fortified keeps' },
  { name: 'Church Purple', hex: '#9b4de0', class: 'bg-clergy-purple text-white', desc: 'Clergy & spiritual pacification' },
]
</script>

<template>
  <div class="space-y-3 p-3 bg-fief-dark text-fief-text">
    <!-- Header -->
    <div class="bg-fief-card border border-fief-border rounded-lg p-3 space-y-1">
      <h2 class="text-base font-medieval text-royal-gold flex items-center gap-1.5">
        <GameIcon name="lawDecree" class="w-5 h-5 text-royal-gold" />
        <span>Dark Feudal Design System</span>
      </h2>
      <p class="text-[11px] font-serif-book text-fief-text-muted italic">
        Atmospheric lordly cabinet: weathered dark wood, scarlet wax seals, and gilded trims.
      </p>
    </div>

    <!-- Dark Background Tones -->
    <div class="bg-fief-card border border-fief-border rounded-lg p-3 space-y-2">
      <h3 class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
        <GameIcon name="scrollUnfurled" class="w-4 h-4 text-royal-gold" />
        <span>Dark Surfaces & Materials</span>
      </h3>
      <div class="space-y-1.5">
        <div
          v-for="tone in darkFeudalTones"
          :key="tone.name"
          class="p-2 rounded border border-fief-border flex items-center justify-between"
          :style="{ backgroundColor: tone.hex }"
        >
          <div>
            <div class="font-medieval text-xs text-fief-text">{{ tone.name }}</div>
            <div class="text-[10px] text-fief-text-muted italic">{{ tone.desc }}</div>
          </div>
          <span class="font-mono text-[10px] text-royal-gold font-bold">{{ tone.hex }}</span>
        </div>
      </div>
    </div>

    <!-- Vivid Medieval Accents -->
    <div class="bg-fief-card border border-fief-border rounded-lg p-3 space-y-2">
      <h3 class="font-medieval text-xs text-fief-text flex items-center gap-1.5">
        <GameIcon name="warBanner" class="w-4 h-4 text-wax-red" />
        <span>Heraldic Contrasts & Accents</span>
      </h3>
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="a in contrastAccents"
          :key="a.name"
          class="p-2 rounded border border-fief-border flex flex-col justify-between"
          :class="a.class"
        >
          <div class="font-medieval text-xs font-bold">{{ a.name }}</div>
          <div class="text-[10px] opacity-90 mt-1 italic leading-tight">{{ a.desc }}</div>
        </div>
      </div>
    </div>

    <!-- Typography Demonstration on Dark -->
    <div class="bg-fief-card border border-fief-border rounded-lg p-3 space-y-2">
      <h3 class="font-medieval text-xs text-fief-text">WOFF Medieval Typographies</h3>
      <div class="p-2.5 bg-fief-dark border border-fief-border rounded space-y-1">
        <div class="font-medieval text-sm text-royal-gold">MedievalSharp (Titles & Royal Seals)</div>
        <p class="font-medieval text-xs text-fief-text-muted leading-tight">
          "The Crown Audit brooks no negligence nor deceit."
        </p>
      </div>

      <div class="p-2.5 bg-fief-dark border border-fief-border rounded space-y-1">
        <div class="font-serif-book text-sm italic text-royal-gold">IM Fell English (Ledgers & Chronicles)</div>
        <p class="font-serif-book text-xs italic text-fief-text leading-tight">
          "The scribe dipped his quill in dark ink over the harvest ledger..."
        </p>
      </div>
    </div>
  </div>
</template>
