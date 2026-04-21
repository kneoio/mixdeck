<template>
  <div class="brand-dashboard">
    <PageHeader :title="brandName" :subtitle="t('menu.dashboard')" />
    <AivoxCard v-if="brandSlug" :brand-slug="brandSlug" :timezone="brand?.timeZone" v-model:alive="streamAlive" />
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
const streamAlive = ref(false)
</script>

<style scoped>
.brand-dashboard {
  width: 100%;
}
</style>
