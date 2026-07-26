<template>
  <span
    class="led"
    :class="{ active, pulse }"
    :style="{ color: color ?? '#00FF3C', animationDuration: pulse ? beatDuration : undefined }"
  >
    ▬
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ active?: boolean; pulse?: boolean; size?: number; color?: string; bpm?: number }>();

const beatDuration = computed(() => {
  if (!props.bpm || props.bpm <= 0) return '0.8s';
  return `${(60 / props.bpm).toFixed(3)}s`;
});
</script>

<style scoped>
.led {
  font-family: 'Share Tech Mono', monospace;
  font-size: v-bind("`${size ?? 25}px`");
  opacity: 0.25;
  text-shadow: none;
  transition: opacity 3s ease-out, text-shadow 3s ease-out;
}

.active {
  opacity: 1;
  transition: opacity 0.05s, text-shadow 0.05s;
  text-shadow:
    0 0 6px currentColor,
    0 0 16px currentColor,
    0 0 36px currentColor,
    0 0 60px currentColor;
}

.pulse {
  animation-name: pulse;
  animation-duration: 0.8s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

@keyframes pulse {
  0%, 70%, 100% { opacity: 1; text-shadow: 0 0 18px currentColor; }
  40% { opacity: 0.25; text-shadow: 0 0 4px currentColor; }
}
</style>
