<script setup lang="ts">
import { ref } from 'vue'
import GsapButton from '@/components/GsapButton.vue'

const props = defineProps<{ data: unknown[] }>()
const copied = ref(false)

function copy() {
  navigator.clipboard.writeText(JSON.stringify(props.data, null, 2))
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}
</script>

<template>
  <GsapButton @click="copy">
    <span>{{ copied ? 'Copied!' : 'Copy JSON' }}</span>
  </GsapButton>
</template>
