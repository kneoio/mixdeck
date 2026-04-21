<template>
  <div class="brand-dashboard">
    <PageHeader :title="brandName" :subtitle="t('menu.dashboard')" />
    <div v-if="brand?.timeZone" class="station-time-info">
      <div class="time-display">
        <span class="label">{{ t('dashboard.stationTime') }}:</span>
        <span class="time">{{ localTime }}</span>
      </div>
      <div class="timezone-display">
        <span class="label">{{ t('dashboard.timezone') }}:</span>
        <span class="timezone">{{ brand.timeZone }}</span>
      </div>
    </div>
    <AivoxCard v-if="brandSlug" :brand-slug="brandSlug" v-model:alive="streamAlive" />
    <AgendaCard :brand-slug="brandSlug" :alive="streamAlive" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
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
const streamAlive = ref(false)
const localTime = ref('')

let timeInterval: number | null = null

const updateLocalTime = () => {
  if (brand.value?.timeZone) {
    try {
      const now = new Date()
      localTime.value = now.toLocaleTimeString('en-US', {
        timeZone: brand.value.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    } catch (error) {
      console.error('Error formatting time:', error)
      localTime.value = 'Invalid timezone'
    }
  }
}

onMounted(() => {
  updateLocalTime()
  timeInterval = window.setInterval(updateLocalTime, 1000)
})

onUnmounted(() => {
  if (timeInterval) {
    clearInterval(timeInterval)
  }
})
</script>

<style scoped>
.brand-dashboard {
  width: 100%;
}

.station-time-info {
  display: flex;
  gap: 2rem;
  padding: 1rem;
  margin-bottom: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.time-display,
.timezone-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.label {
  font-weight: 500;
  opacity: 0.7;
}

.time {
  font-size: 1.25rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.timezone {
  font-weight: 500;
}
</style>
