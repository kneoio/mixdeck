<template>
  <LedIndicator :active="active" color="#FF2D95" :size="18" />
</template>

<script setup lang="ts">
import LedIndicator from '@/components/LedIndicator.vue'
defineProps<{ active?: boolean }>()
</script>
