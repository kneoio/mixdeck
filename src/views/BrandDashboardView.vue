<template>
  <div class="brand-dashboard">
    <PageHeader :title="brandName" :subtitle="t('menu.dashboard')">
      <template #actions>
        <span class="free-badge">{{ t('dashboard.free_streaming_limit') }}</span>
        <template v-if="brand?.mixplaUrl">
          <span class="player-url-caption">{{ t('dashboard.your_player') }}:</span>
          <a :href="brand.mixplaUrl" target="_blank" rel="noopener noreferrer" class="player-url-link">{{ brand.mixplaUrl }}</a>
          <button class="copy-btn" :class="{ 'copy-btn--done': copied }" @click="copyUrl" :title="t('dashboard.copy_url')">
            <svg v-if="!copied" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </template>
      </template>
    </PageHeader>
    <AivoxCard v-if="brandSlug" :brand-slug="brandSlug" :timezone="brand?.timeZone" />
    <AgendaCard :brand-slug="brandSlug" :alive="streamAlive" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useBrandsStore } from '@/stores/brands'
import PageHeader from '@/components/PageHeader.vue'
import AgendaCard from '@/components/AgendaCard.vue'
import AivoxCard from '@/components/AivoxCard.vue'

const { t } = useI18n()
const route = useRoute()
const brandsStore = useBrandsStore()

const brand = computed(() => {
  const id = route.params.id as string
  return brandsStore.brands.find(b => b.id === id)
})

const brandName = computed(() =>
  brand.value?.localizedName?.['en'] || brand.value?.title || brand.value?.slugName || (route.params.id as string)
)

const brandSlug = computed(() => brand.value?.slugName ?? '')
const streamAlive = computed(() => brandsStore.streamingStates[brandSlug.value] ?? false)

const copied = ref(false)
function copyUrl() {
  if (!brand.value?.mixplaUrl) return
  navigator.clipboard.writeText(brand.value.mixplaUrl)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped>
.brand-dashboard {
  width: 100%;
}
.free-badge {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(124, 58, 237, 0.15);
  border: 1px solid rgba(124, 58, 237, 0.35);
  color: #7C3AED;
  white-space: nowrap;
}
.player-url-caption {
  font-size: 0.8rem;
  opacity: 0.45;
  white-space: nowrap;
}
@media (max-width: 768px) {
  .player-url-caption {
    display: none;
  }
}
.player-url-link {
  font-size: 0.8rem;
  opacity: 0.6;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dashed currentColor;
  white-space: nowrap;
  transition: opacity 0.2s;
}
.player-url-link:hover {
  opacity: 1;
}
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 4px;
  padding: 2px 5px;
  cursor: pointer;
  color: inherit;
  opacity: 0.5;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s;
  line-height: 1;
}
.copy-btn:hover {
  opacity: 1;
}
.copy-btn--done {
  color: #4caf50;
  border-color: rgba(76, 175, 80, 0.4);
  opacity: 1;
}
</style>
