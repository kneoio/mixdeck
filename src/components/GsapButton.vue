<template>
  <div v-if="block" class="gsap-btn-wrap">
    <button
      :class="classes"
      :disabled="disabled || loading"
      v-bind="$attrs"
    >
      <span class="gsap-btn__inner"><slot /></span>
    </button>
  </div>
  <button
    v-else
    :class="classes"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span class="gsap-btn__inner"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  type?: 'default' | 'primary' | 'info' | 'error' | 'warning' | 'success' | 'text'
  size?: 'small' | 'default' | 'large'
  disabled?: boolean
  loading?: boolean
  block?: boolean
}>(), {
  type: 'default',
  size: 'default',
  disabled: false,
  loading: false,
  block: false,
})

const classes = computed(() => [
  'gsap-btn',
  `gsap-btn--${props.type}`,
  props.size !== 'default' && `gsap-btn--${props.size}`,
  props.block && 'gsap-btn--block',
])
</script>

<style scoped>
.gsap-btn-wrap {
  width: 100%;
  overflow: hidden;
  padding-inline: 14px;
}

.gsap-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 20px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  outline: none;
  white-space: nowrap;
  transform: skewX(-10deg);
  will-change: transform;
  transition: opacity 0.15s, transform 0.18s ease;
}

.gsap-btn:not(:disabled):hover {
  transform: skewX(-10deg) scale(1.03);
}

.gsap-btn:not(:disabled):active {
  transform: skewX(-10deg) scale(0.96);
}

.gsap-btn__inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  transform: skewX(10deg);
}

.gsap-btn--small        { height: 28px; padding: 0 14px; }
.gsap-btn--small .gsap-btn__inner { font-size: 0.75rem; }
.gsap-btn--large        { height: 40px; padding: 0 26px; }
.gsap-btn--large .gsap-btn__inner { font-size: 0.88rem; }

.gsap-btn--block { width: 100%; }

/* types */
.gsap-btn--default { background: #1f1f23; color: rgba(255,255,255,0.82); }
.gsap-btn--primary { background: #7C3AED; color: #fff; }
.gsap-btn--info    { background: #2080F0; color: #fff; }
.gsap-btn--error   { background: #FF2D95; color: #fff; }
.gsap-btn--warning { background: #1e1500; color: #F0A020; }
.gsap-btn--success { background: #041509; color: #18A058; }
.gsap-btn--text    { background: transparent; color: rgba(255,255,255,0.6); transform: none; }
.gsap-btn--text .gsap-btn__inner { transform: none; }
.gsap-btn--text:not(:disabled):hover { transform: scale(1.03); }
.gsap-btn--text:not(:disabled):active { transform: scale(0.96); }

.gsap-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

/* light theme overrides */
:global(.n-config-provider:not([class*="dark"])) .gsap-btn--default {
  background: #f0f0f5;
  color: rgba(0,0,0,0.75);
}
</style>

<style>
/* Use <div class="gsap-row"> instead of NSpace around GsapButtons */
.gsap-row {
  display: flex;
  align-items: center;
  gap: 3px;
  padding-left: 10px;
}
</style>
