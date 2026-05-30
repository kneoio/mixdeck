<script setup lang="ts">
defineProps({
  size: {
    type: Number,
    default: 18
  }
})
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 50 50"
    class="loader"
  >
    <!-- Irregular star: 8 arms at uneven angles, varying lengths -->
    <line x1="25" y1="25" x2="43" y2="25"   stroke-width="3.5" />
    <line x1="25" y1="25" x2="32.7" y2="34.2" stroke-width="2.5" />
    <line x1="25" y1="25" x2="23.6" y2="40.9" stroke-width="3" />
    <line x1="25" y1="25" x2="16.5" y2="30.3" stroke-width="2" />
    <line x1="25" y1="25" x2="5.1"  y2="23.3" stroke-width="3.5" />
    <line x1="25" y1="25" x2="18"   y2="12.9" stroke-width="2.5" />
    <line x1="25" y1="25" x2="30.5" y2="15.5" stroke-width="2" />
    <line x1="25" y1="25" x2="39.1" y2="19.9" stroke-width="3" />
  </svg>
</template>

<style scoped>
.loader {
  animation: spin 1.2s linear infinite;
}

line {
  stroke: currentColor;
  stroke-linecap: round;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}
</style>
