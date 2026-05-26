<template>
  <div v-if="block" class="gsap-btn-wrap">
    <button
      ref="btnRef"
      :class="classes"
      :disabled="disabled || loading"
      v-bind="$attrs"
    >
      <span class="gsap-btn__inner"><slot /></span>
    </button>
  </div>
  <button
    v-else
    ref="btnRef"
    :class="classes"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span class="gsap-btn__inner"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import gsap from 'gsap'

const props = withDefaults(defineProps<{
  type?: 'default' | 'primary' | 'error' | 'warning' | 'success' | 'text'
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

const btnRef = ref<HTMLButtonElement | null>(null)

const classes = computed(() => [
  'gsap-btn',
  `gsap-btn--${props.type}`,
  props.size !== 'default' && `gsap-btn--${props.size}`,
  props.block && 'gsap-btn--block',
])

onMounted(() => {
  const el = btnRef.value
  if (!el || el.disabled) return

  const inner = el.querySelector('.gsap-btn__inner') as HTMLElement | null
  gsap.from(el, { skewX: 0, duration: 0.5, ease: 'power3.out', delay: 0.05 })
  if (inner) gsap.from(inner, { skewX: 0, duration: 0.5, ease: 'power3.out', delay: 0.05 })

  el.addEventListener('mouseenter', () => {
    gsap.to(el, { scale: 1.03, duration: 0.18, ease: 'power2.out' })
  })
  el.addEventListener('mouseleave', () => {
    gsap.to(el, { scale: 1, duration: 0.22, ease: 'power2.out' })
  })
  el.addEventListener('mousedown', () => {
    gsap.to(el, { scale: 0.96, duration: 0.08, ease: 'power2.in' })
  })
  el.addEventListener('mouseup', () => {
    gsap.to(el, { scale: 1.03, duration: 0.15, ease: 'power2.out' })
  })
})
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
  transition: opacity 0.15s;
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
.gsap-btn--error   { background: #FF2D95; color: #fff; }
.gsap-btn--warning { background: #1e1500; color: #F0A020; }
.gsap-btn--success { background: #041509; color: #18A058; }
.gsap-btn--text    { background: transparent; color: rgba(255,255,255,0.6); transform: none; }
.gsap-btn--text .gsap-btn__inner { transform: none; }

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
