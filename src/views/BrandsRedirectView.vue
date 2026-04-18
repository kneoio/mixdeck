<template>
  <div />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBrandsStore } from '@/stores/brands'

const router = useRouter()
const brandsStore = useBrandsStore()

onMounted(async () => {
  await brandsStore.loadBrands(1, 1)
  const first = brandsStore.brands[0]
  if (first) {
    await router.replace(`/brands/${first.id}/playlist`)
  } else {
    await router.replace('/broadcaster-welcome')
  }
})
</script>
