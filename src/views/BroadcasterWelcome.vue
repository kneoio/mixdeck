<template>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 24px; text-align: center; padding: 32px;">
    <img src="/logo.svg" alt="Mixdeck" style="width: 80px; height: 80px;" />
    <h2 style="margin: 0;">Welcome to Mixdeck</h2>
    <p style="color: #888; max-width: 480px; margin: 0;">
      You don't have any brands yet. Create your first for Mixpla!
    </p>
    <n-button type="primary" size="large" @click="router.push('/brands/new')">
      Create Your First Brand
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'

const router = useRouter()
</script>
