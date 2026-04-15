<template>
  <span
    class="led"
    :class="{ active, pulse }"
    :style="{ color: (active || pulse) ? '#00FF3C' : '#9ca3af' }"
  >
    ▬
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ active?: boolean; pulse?: boolean; size?: number }>();
</script>

<style scoped>
.led {
  font-family: 'Share Tech Mono', monospace;
  font-size: v-bind("`${size ?? 25}px`");
  opacity: 0.6;
  text-shadow: none;
  transition: opacity .3s, text-shadow .3s;
}

.active {
  opacity: 1;
  text-shadow:
    0 0 5px currentColor,
    0 0 15px currentColor,
    0 0 30px currentColor;
}

.pulse {
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 70%, 100% { opacity: 1; text-shadow: 0 0 18px currentColor; }
  40% { opacity: 0.25; text-shadow: 0 0 4px currentColor; }
}
</style>
