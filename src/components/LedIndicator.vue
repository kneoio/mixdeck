<template>
  <span
    class="led"
    :class="{ active, pulse }"
    :style="{ color: color ?? '#00FF3C' }"
  >
    ▬
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{ active?: boolean; pulse?: boolean; size?: number; color?: string }>();
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
    0 0 4px currentColor,
    0 0 12px currentColor,
    0 0 28px currentColor,
    0 0 55px currentColor;
}

.pulse {
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 70%, 100% { opacity: 1; text-shadow: 0 0 18px currentColor; }
  40% { opacity: 0.25; text-shadow: 0 0 4px currentColor; }
}
</style>
