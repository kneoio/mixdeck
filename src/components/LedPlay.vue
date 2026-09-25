<template>
  <LedIndicator :active="active" color="#00FF3C" :size="18" glyph="▶" />
</template>

<script setup lang="ts">
import LedIndicator from '@/components/LedIndicator.vue'
defineProps<{ active?: boolean }>()
</script>
