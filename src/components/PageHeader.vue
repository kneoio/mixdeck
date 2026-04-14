<template>
  <div class="page-header">
    <NPageHeader :title="title" :subtitle="subtitle">
      <template #extra>
        <div class="page-header-extra">
          <span v-if="count !== undefined" class="total-count">
            Total: {{ count }}
          </span>
          <slot name="actions" />
        </div>
      </template>
    </NPageHeader>
  </div>
</template>

<script setup lang="ts">
import { NPageHeader } from 'naive-ui'

interface Props {
  title: string
  subtitle?: string
  count?: number
}

defineProps<Props>()
</script>

<style scoped>
.page-header {
  margin-bottom: 16px;
}

.page-header-extra {
  display: flex;
  align-items: center;
  gap: 16px;
}

.total-count {
  font-size: 14px;
  opacity: 0.7;
}
</style>
