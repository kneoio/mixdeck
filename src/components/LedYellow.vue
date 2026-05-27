<template>
  <LedIndicator :active="active" :pulse="active" color="#FFD600" :size="18" />
</template>

<script setup lang="ts">
import LedIndicator from '@/components/LedIndicator.vue'
defineProps<{ active?: boolean }>()
</script>
