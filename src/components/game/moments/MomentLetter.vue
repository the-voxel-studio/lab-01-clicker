<script setup lang="ts">
import { onMounted, ref } from 'vue'
import GameIcon from '@/components/common/GameIcon.vue'
import type { Command } from '@/core/types'
import type { GameIconKey } from '@/data/icons'
import type { DreadBand } from '@/ui/dread'
import type { MomentView } from '@/ui/moments'
import ClashBar from './ClashBar.vue'
import MomentAnswer from './MomentAnswer.vue'

/** The sealed letter every moment shares (Figma `53:320`); only its body scrolls. */
defineProps<{ view: MomentView; band: DreadBand; error: string | null }>()
const emit = defineEmits<{ choose: [command: Command] }>()

const SEAL_ICON: Record<MomentView['kind'], GameIconKey> = {
  audit: 'crown',
  dilemma: 'counselorSteward',
  laws: 'lawDecree',
  herald: 'threatBastion',
  raid: 'sword',
  lombard: 'coins',
}

const root = ref<HTMLElement | null>(null)
// The run behind goes inert, so the focus would otherwise fall out of the document.
onMounted(() => root.value?.focus())
</script>

<template>
  <article
    ref="root"
    data-moment-letter
    :data-kind="view.kind"
    :data-dread="band"
    role="dialog"
    aria-modal="true"
    aria-labelledby="moment-title"
    tabindex="-1"
    class="letter relative flex max-h-full w-full flex-col rounded bg-vellum pt-10 outline-none drop-shadow-[0_14px_15px_rgb(0_0_0/0.5)]"
  >
    <div class="letter-seal absolute -top-[34px] left-1/2 -ml-[34px] size-[68px]">
      <span class="letter-seal-whole wax absolute inset-0 flex items-center justify-center">
        <GameIcon :name="SEAL_ICON[view.kind]" label="" class="size-[26px] text-ink/70" />
      </span>
      <span class="letter-seal-half wax wax-left invisible absolute inset-0" />
      <span class="letter-seal-half wax wax-right invisible absolute inset-0" />
    </div>

    <div data-letter-scroll class="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 pb-5">
      <header>
        <p class="font-caps text-sm leading-5 tracking-[0.02em] text-rubric">{{ view.eyebrow }}</p>
        <h2 id="moment-title" class="font-display text-[25px] leading-[30px] text-ink">
          {{ view.title }}
        </h2>
      </header>
      <p v-if="view.body" class="font-body text-[15px] leading-[22px] text-ink">{{ view.body }}</p>

      <ul v-if="view.quotas.length > 0" class="flex flex-col gap-1">
        <li
          v-for="quota in view.quotas"
          :key="quota.label"
          data-quota
          class="flex items-baseline justify-between gap-2 font-body text-[15px] leading-[22px]"
        >
          <span class="text-ink">{{ quota.label }}</span>
          <span class="text-ink-faded">{{ quota.figure }}</span>
          <span class="ml-auto italic" :class="quota.met ? 'text-verdigris' : 'text-rubric'">
            {{ quota.met ? 'met' : 'short' }}
          </span>
        </li>
      </ul>

      <ClashBar v-if="view.clash" :clash="view.clash" />

      <div class="flex flex-col gap-3">
        <MomentAnswer
          v-for="item in view.answers"
          :key="item.label"
          :answer="item"
          @choose="emit('choose', $event)"
        />
      </div>

      <p data-moment-error v-if="error" class="font-body text-sm italic text-rubric">{{ error }}</p>
      <p v-if="view.note" class="font-body text-sm italic leading-[22px] text-ink-faded">
        {{ view.note }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.wax {
  border-radius: 46% 54% 50% 50% / 52% 48% 55% 45%;
  background: var(--color-wax);
  box-shadow: 0 2px 4px rgb(0 0 0 / 0.35);
}
.wax-left {
  clip-path: polygon(0 0, 54% 0, 44% 50%, 56% 100%, 0 100%);
}
.wax-right {
  clip-path: polygon(54% 0, 100% 0, 100% 100%, 56% 100%, 44% 50%);
}
/* The blood seal and the foxing of the rotten bands; the text keeps its contrast. */
.letter[data-dread='rotting'] .wax,
.letter[data-dread='death_throes'] .wax {
  background: var(--color-blood);
}
.letter[data-dread='rotting'] {
  box-shadow: inset 0 0 40px rgb(74 50 32 / 0.3);
}
.letter[data-dread='death_throes'] {
  box-shadow: inset 0 0 56px rgb(122 8 8 / 0.3);
}
</style>
