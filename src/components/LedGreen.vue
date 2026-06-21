<template>
  <LedIndicator :active="active" :pulse="pulse" color="#00FF3C" :size="18" />
</template>

<script setup lang="ts">
import LedIndicator from '@/components/LedIndicator.vue'
defineProps<{ active?: boolean; pulse?: boolean }>()
</script>
