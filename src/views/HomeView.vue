<template>
  <NLayout style="min-height: 100vh;">
    <NLayoutContent style="display: flex; align-items: center; justify-content: center; padding: 40px;">
      <NCard style="width: 100%; max-width: 420px;">
        <template #header>
          <div style="text-align: center;">
            <h1 style="font-size: 24px; font-weight: 600; margin: 0;">Mixdeck</h1>
          </div>
        </template>

        <div v-if="!isAuthenticated" style="text-align: center;">
          <p style="margin-bottom: 24px; opacity: 0.7;">
            Please log in to access the management area.
          </p>
          <NButton
            type="primary"
            size="large"
            @click="authStore.login()"
            :loading="authStore.isLoading"
          >
            {{ authStore.isLoading ? 'Initializing...' : 'Login' }}
          </NButton>
        </div>

        <div v-else style="text-align: center;">
          <p style="margin-bottom: 16px;">Hello, {{ userName }}!</p>
          <NSpace vertical align="center">
            <NButton type="primary" size="large" @click="router.push('/brands')">
              Enter Dashboard
            </NButton>
            <NButton text type="error" @click="authStore.logout()">Logout</NButton>
          </NSpace>
        </div>
      </NCard>
    </NLayoutContent>
  </NLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { NButton, NCard, NSpace, NLayout, NLayoutContent } from 'naive-ui'

const authStore = useAuthStore()
const router = useRouter()

const isAuthenticated = computed(() => authStore.isAuthenticated)
const userName = computed(() => authStore.userName)
</script>
