<template>
  <div class="gsap-spin">
    <Transition name="gsap-spin-fade" mode="out-in">
      <div v-if="show" key="loading" class="gsap-spin__overlay">
        <GsapLoader :size="size" />
      </div>
      <div v-else key="content">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import GsapLoader from './GsapLoader.vue'

withDefaults(defineProps<{ show?: boolean; size?: number }>(), { show: false, size: 36 })
</script>

<style scoped>
.gsap-spin {
  position: relative;
}
.gsap-spin__overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
}
.gsap-spin-fade-enter-active,
.gsap-spin-fade-leave-active {
  transition: opacity 0.2s ease;
}
.gsap-spin-fade-enter-from,
.gsap-spin-fade-leave-to {
  opacity: 0;
}
</style>
