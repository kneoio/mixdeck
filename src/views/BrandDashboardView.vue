<template>
  <div class="brand-dashboard">
    <PageHeader :title="brandName" subtitle="Station Dashboard" />
    <AgendaCard v-if="brandSlug" :brand-slug="brandSlug" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useBrandsStore } from '@/stores/brands'
import PageHeader from '@/components/PageHeader.vue'
import AgendaCard from '@/components/AgendaCard.vue'

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
</script>

<style scoped>
.brand-dashboard {
  width: 100%;
}
</style>
