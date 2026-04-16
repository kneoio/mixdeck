<template>
  <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 24px; text-align: center; padding: 32px;">
    <n-icon size="64" color="#7C3AED">
      <RadioIcon />
    </n-icon>
    <h2 style="margin: 0;">Welcome to Mixdeck</h2>
    <p style="color: #888; max-width: 480px; margin: 0;">
      You don't have any broadcaster profiles yet. Create your first brand to get started with AI-powered streams.
    </p>
    <n-button type="primary" size="large" @click="router.push('/brands/new')">
      Create Your First Brand
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { NButton, NIcon } from 'naive-ui'
import { RadioOutline as RadioIcon } from '@vicons/ionicons5'

const router = useRouter()
</script>
