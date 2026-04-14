<script setup lang="ts">
import { ref } from 'vue'
import { NButton } from 'naive-ui'

const props = defineProps<{ data: unknown[] }>()
const copied = ref(false)

function copy() {
  navigator.clipboard.writeText(JSON.stringify(props.data, null, 2))
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}
</script>

<template>
  <NButton @click="copy">
    {{ copied ? 'Copied!' : 'Copy JSON' }}
  </NButton>
</template>
