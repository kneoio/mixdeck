<template>
  <div
      class="eq"
      :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <span
        v-for="i in 5"
        :key="i"
        class="bar"
        :style="{ animationDelay: `${(i - 1) * -0.18}s` }"
    />
  </div>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
      size?: number
    }>(),
    {
      size: 72
    }
)
</script>

<style scoped>
.eq {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9%;
}

.bar {
  width: 9%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(180deg, #b180ef, #7c3aed, #ff2d95);
  animation: pulse 1.1s ease-in-out infinite;
  transform-origin: center;
  will-change: transform;
}

@keyframes pulse {
  0%, 100% {
    transform: scaleY(0.25);
    opacity: 0.55;
  }
  50% {
    transform: scaleY(1);
    opacity: 1;
  }
}
</style>
