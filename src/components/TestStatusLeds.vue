<template>
  <div class="test-leds">
    <LedYellow :active="loading" />
    <LedGreen :active="success" />
    <LedRed :active="error" />
  </div>
</template>

<script setup lang="ts">
import LedYellow from '@/components/LedYellow.vue'
import LedGreen from '@/components/LedGreen.vue'
import LedRed from '@/components/LedRed.vue'

defineProps<{
  loading?: boolean
  success?: boolean
  error?: boolean
}>()
</script>

<style scoped>
.test-leds {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
