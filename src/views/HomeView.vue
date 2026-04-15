<template>
  <div class="landing">
    <div class="landing-content">
      <h1 class="landing-title">Mixdeck</h1>
      <p class="landing-subtitle">Radio brand management</p>
      <div class="landing-actions">
        <NButton
          v-if="isAuthenticated"
          type="primary"
          size="large"
          @click="router.push('/brands')"
        >
          Open Dashboard
        </NButton>
        <NButton
          v-else
          type="primary"
          size="large"
          @click="authStore.login()"
        >
          Login
        </NButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { NButton } from 'naive-ui'

const authStore = useAuthStore()
const router = useRouter()

const isAuthenticated = computed(() => authStore.isAuthenticated)
</script>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 40%, rgba(124, 58, 237, 0.15), transparent 60%);
}

.landing-content {
  text-align: center;
  padding: 40px;
}

.landing-title {
  font-size: 3rem;
  font-weight: 700;
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

.landing-subtitle {
  font-size: 1.1rem;
  opacity: 0.5;
  margin: 0 0 40px;
}

.landing-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
