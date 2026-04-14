<template>
  <div class="brand-dashboard">
    <PageHeader :title="brandName" subtitle="Station Dashboard" />
    <div class="placeholder">
      <p>Dashboard coming soon.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useBrandsStore } from '@/stores/brands'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()
const brandsStore = useBrandsStore()

const brandName = computed(() => {
  const id = route.params.id as string
  const brand = brandsStore.brands.find(b => b.id === id)
  return brand?.localizedName?.['en'] || brand?.title || brand?.slugName || id
})
</script>

<style scoped>
.brand-dashboard {
  width: 100%;
}
.placeholder {
  margin-top: 32px;
  opacity: 0.5;
}
</style>
