<script setup lang="ts">
import { ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import GameMockup from '@/components/showcase/GameMockup.vue'
import IconsGallery from '@/components/showcase/IconsGallery.vue'
import PaletteShowcase from '@/components/showcase/PaletteShowcase.vue'

type TabType = 'game' | 'icons' | 'palette'
const currentTab = ref<TabType>('game')
</script>

<template>
  <!-- True Responsive Mobile-First Root Container -->
  <div class="min-h-screen w-full bg-fief-bg text-fief-text selection:bg-wax-red selection:text-white font-serif-book flex justify-center">
    <!-- Responsive Main Column (Full width on mobile, constrained max-w-xl on larger screens) -->
    <div class="w-full max-w-xl min-h-screen bg-fief-dark sm:border-x sm:border-fief-border shadow-2xl flex flex-col relative">
      <!-- Top Application Header Bar -->
      <header class="bg-fief-dark border-b border-fief-border px-3.5 py-2.5 flex items-center justify-between shrink-0 select-none sticky top-0 z-40 backdrop-blur-md bg-fief-dark/95">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-wax-red text-royal-gold flex items-center justify-center border border-royal-gold/40 shadow-xs">
            <GameIcon name="crown" class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-sm sm:text-base font-medieval text-royal-gold leading-none tracking-wide">
              The Grand Audit
            </h1>
            <span class="text-[10px] font-mono text-fief-text-dim">Feudal Bureaucracy • PoC</span>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono uppercase bg-voxel-pink/15 text-voxel-pink px-2 py-0.5 rounded border border-voxel-pink/40 font-bold tracking-wider">
            <span class="w-1.5 h-1.5 rounded-full bg-voxel-pink"></span>
            #F60887
          </span>
          <div class="flex items-center gap-1.5 text-[9px] font-mono uppercase bg-wax-red/20 text-wax-red-light px-2.5 py-1 rounded border border-wax-red/40 font-bold tracking-wider">
            Mobile First
          </div>
        </div>
      </header>

      <!-- Main Scrollable Content Area -->
      <main class="flex-1 pb-16">
        <transition mode="out-in" name="fade">
          <component
            :is="currentTab === 'game' ? GameMockup : currentTab === 'icons' ? IconsGallery : PaletteShowcase"
          />
        </transition>
      </main>

      <!-- Sticky Bottom Navigation Bar (Touch-Optimized) -->
      <nav class="fixed bottom-0 w-full max-w-xl bg-fief-card/95 backdrop-blur-md border-t border-fief-border grid grid-cols-3 p-1.5 shrink-0 z-40 shadow-2xl select-none">
        <button
          type="button"
          @click="currentTab = 'game'"
          :class="[
            'py-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer',
            currentTab === 'game'
              ? 'text-royal-gold font-bold bg-fief-dark border border-royal-gold/40 shadow-xs'
              : 'text-fief-text-muted hover:text-fief-text hover:bg-fief-dark/40'
          ]"
        >
          <GameIcon name="waxSeal" class="w-5 h-5" />
          <span class="text-[10px] font-medieval tracking-wide">Game Mockup</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'icons'"
          :class="[
            'py-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer',
            currentTab === 'icons'
              ? 'text-royal-gold font-bold bg-fief-dark border border-royal-gold/40 shadow-xs'
              : 'text-fief-text-muted hover:text-fief-text hover:bg-fief-dark/40'
          ]"
        >
          <GameIcon name="quill" class="w-5 h-5" />
          <span class="text-[10px] font-medieval tracking-wide">Icons (81)</span>
        </button>

        <button
          type="button"
          @click="currentTab = 'palette'"
          :class="[
            'py-2 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer',
            currentTab === 'palette'
              ? 'text-royal-gold font-bold bg-fief-dark border border-royal-gold/40 shadow-xs'
              : 'text-fief-text-muted hover:text-fief-text hover:bg-fief-dark/40'
          ]"
        >
          <GameIcon name="lawDecree" class="w-5 h-5" />
          <span class="text-[10px] font-medieval tracking-wide">Theme & Styles</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
