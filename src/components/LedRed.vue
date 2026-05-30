<template>
  <LedIndicator :active="active" color="#CC0000" :size="18" />
</template>

<script setup lang="ts">
import LedIndicator from '@/components/LedIndicator.vue'
defineProps<{ active?: boolean }>()
</script>
