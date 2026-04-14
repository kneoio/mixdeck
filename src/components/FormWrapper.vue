<template>
  <div class="form-wrapper">
    <PageHeader :title="title" :subtitle="subtitle">
      <template #actions>
        <slot name="header-actions" />
      </template>
    </PageHeader>

    <ActionBar>
      <slot name="actions" />
    </ActionBar>

    <div :class="['form-content', { 'form-content--full': fullWidth }]">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useLoadingBar } from 'naive-ui'
import PageHeader from './PageHeader.vue'
import ActionBar from './ActionBar.vue'

interface Props {
  title: string
  subtitle?: string
  fullWidth?: boolean
  loading?: boolean
}

const props = defineProps<Props>()
const loadingBar = useLoadingBar()

watch(() => props.loading, (val, prev) => {
  if (val && !prev) loadingBar.start()
  else if (!val && prev) loadingBar.finish()
})
</script>

<style scoped>
.form-wrapper {
  width: 100%;
}

.form-content {
  max-width: 600px;
}

.form-content--full {
  max-width: none;
}
</style>
