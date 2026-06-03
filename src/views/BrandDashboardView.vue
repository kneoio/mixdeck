<template>
  <div class="brand-dashboard">
    <PageHeader :title="brandName" :subtitle="t('menu.dashboard')" />
    <div v-if="brand?.mixplaUrl" class="player-url-row">
      <span class="player-url-caption">{{ t('dashboard.player_ui') }}:</span>
      <a :href="brand.mixplaUrl" target="_blank" rel="noopener noreferrer" class="player-url-link">{{ brand.mixplaUrl }}</a>
    </div>
    <AivoxCard v-if="brandSlug" :brand-slug="brandSlug" :timezone="brand?.timeZone" />
    <AgendaCard :brand-slug="brandSlug" :alive="streamAlive" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
</script>

<style scoped>
.brand-dashboard {
  width: 100%;
}
.player-url-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  margin-top: 6px;
  margin-bottom: 2px;
  padding: 0 2px;
  white-space: nowrap;
  overflow: hidden;
}
.player-url-caption {
  font-size: 0.8rem;
  opacity: 0.5;
  flex-shrink: 0;
}
.player-url-link {
  font-size: 0.8rem;
  opacity: 0.7;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dashed currentColor;
  transition: opacity 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-url-link:hover {
  opacity: 1;
}
</style>
