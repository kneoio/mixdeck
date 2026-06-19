it is<template>
  <div class="overview">
    <PageHeader :title="t('overview.title')" :count="brandsStore.brands.length" />

    <div class="overview-list">
      <NCard
        v-for="brand in brandsStore.brands"
        :key="brand.id"
        class="brand-card"
        :style="brand.color ? { '--brand-color': brand.color } : undefined"
      >
        <template #header>
          <div class="brand-head">
            <span class="brand-name" @click="goPlaylist(brand)">{{ brandLabel(brand) }}</span>
            <span class="brand-status">{{ ledState(brand).label }}</span>
          </div>
        </template>

        <template v-if="brand.mixplaUrl" #header-extra>
          <div class="brand-url">
            <a :href="brand.mixplaUrl" target="_blank" rel="noopener noreferrer" class="brand-url-link">{{ brand.mixplaUrl }}</a>
            <button
              class="copy-btn"
              :class="{ 'copy-btn--done': copiedId === brand.id }"
              :title="t('dashboard.copy_url')"
              @click="copyUrl(brand)"
            >
              <svg v-if="copiedId !== brand.id" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </div>
        </template>

        <AivoxCard v-if="brand.slugName" :brand-slug="brand.slugName" :timezone="brand.timeZone" />

        <NCollapse v-if="brand.slugName" class="agenda-collapse">
          <NCollapseItem :title="t('agenda.title')" :name="brand.id">
            <AgendaCard :brand-slug="brand.slugName" :alive="isAlive(brand)" />
          </NCollapseItem>
        </NCollapse>
      </NCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NCard, NCollapse, NCollapseItem } from 'naive-ui'
import { useBrandsStore, type Brand } from '@/stores/brands'
import PageHeader from '@/components/PageHeader.vue'
import AivoxCard from '@/components/AivoxCard.vue'
import AgendaCard from '@/components/AgendaCard.vue'

const { t } = useI18n()
const router = useRouter()
const brandsStore = useBrandsStore()

const brandLabel = (brand: Brand) =>
  brand.localizedName?.['en'] || brand.title || brand.slugName || brand.id

function isAlive(brand: Brand): boolean {
  return brandsStore.streamingStates[brand.slugName ?? ''] ?? false
}

function ledState(brand: Brand): { active: boolean; color: string; label: string } {
  const slug = brand.slugName ?? ''
  const liveState = brandsStore.streamingStates[slug]
  const isOnline = liveState === true || (liveState === undefined && brand.status === 'ON_LINE')
  const isIdle = liveState === false
    ? brand.status === 'IDLE'
    : (liveState === undefined && brand.status === 'IDLE')
  if (isOnline) return { active: true, color: '#00FF3C', label: t('overview.online') }
  if (isIdle) return { active: true, color: '#FFD600', label: t('overview.idle') }
  return { active: false, color: '#00FF3C', label: t('overview.offline') }
}

function goPlaylist(brand: Brand) {
  router.push(`/brands/${brand.id}/playlist`)
}

const copiedId = ref<string | null>(null)
function copyUrl(brand: Brand) {
  if (!brand.mixplaUrl) return
  navigator.clipboard.writeText(brand.mixplaUrl)
  copiedId.value = brand.id
  setTimeout(() => { copiedId.value = null }, 2000)
}
</script>

<style scoped>
.overview {
  width: 100%;
}
.overview-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.brand-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-name {
  font-weight: 600;
  cursor: pointer;
}
.brand-name:hover {
  color: #7C3AED;
}
.brand-status {
  font-size: 0.75rem;
  opacity: 0.55;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.brand-url {
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand-url-link {
  font-size: 0.78rem;
  opacity: 0.6;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dashed currentColor;
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-url-link:hover {
  opacity: 1;
}
.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  padding: 2px 5px;
  cursor: pointer;
  color: inherit;
  opacity: 0.5;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s;
  line-height: 1;
  flex-shrink: 0;
}
.copy-btn:hover {
  opacity: 1;
}
.copy-btn--done {
  color: #4caf50;
  border-color: rgba(76, 175, 80, 0.4);
  opacity: 1;
}
.agenda-collapse {
  margin-top: 12px;
}
.brand-card :deep(.n-card__content) {
  padding-top: 8px;
}
.brand-card {
  border-color: var(--brand-color);
}
</style>
