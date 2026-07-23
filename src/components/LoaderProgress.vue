<script setup lang="ts">
defineProps({
  size: {
    type: Number,
    default: 28
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
    <circle
      class="path"
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke-width="4"
    />
  </svg>
</template>

<style scoped>
.loader {
  animation: rotate 0.7s linear infinite;
}

.path {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-dasharray: 90 150;
  stroke-dashoffset: 0;
  animation: dash 0.9s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1 150;
    stroke-dashoffset: 0;
  }

  50% {
    stroke-dasharray: 90 150;
    stroke-dashoffset: -35;
  }

  100% {
    stroke-dasharray: 90 150;
    stroke-dashoffset: -124;
  }
}
</style>
