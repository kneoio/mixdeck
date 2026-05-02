import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Welcome from '../views/Welcome.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Welcome,
      meta: { requiresAuth: false }
    },
    {
      // Layout shell — children use absolute paths, URL stays at top level
      path: '/app',
      component: DashboardView,
      meta: { requiresAuth: true },
      children: [
        {
          path: '/my-sounds/songs',
          name: 'my-sounds-songs',
          component: () => import('../views/MyPlaylistView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/my-sounds/advertisement',
          name: 'my-sounds-advertisement',
          component: () => import('../views/MyPlaylistView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/my-sounds/sound-design',
          name: 'my-sounds-sound-design',
          component: () => import('../views/MyPlaylistView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/contributed',
          name: 'sound-library-contributed',
          component: () => import('../views/MyPlaylistView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/pending-review',
          name: 'sound-library-pending-review',
          component: () => import('../views/MyPlaylistView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/new',
          name: 'brand-new',
          component: () => import('../components/forms/BrandForm.vue'),
          meta: { requiresAuth: true }
        },
        // Brand sub-pages (must come after /brands/new)
        {
          path: '/brands/:id/dashboard',
          name: 'brand-dashboard',
          component: () => import('../views/BrandDashboardView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:id/listeners',
          name: 'brand-listeners',
          component: () => import('../views/BrandListenersView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:id/listeners/new',
          name: 'brand-listener-new',
          component: () => import('../components/forms/ListenerForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:id/listeners/:listenerId',
          name: 'brand-listener-edit',
          component: () => import('../components/forms/ListenerForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:id/playlist',
          name: 'brand-playlist',
          component: () => import('../views/BrandPlaylistView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:id/playlist/new',
          name: 'brand-fragment-new',
          component: () => import('../components/forms/SoundFragmentForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:id/playlist/:fragmentId',
          name: 'brand-fragment-edit',
          component: () => import('../components/forms/SoundFragmentForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:id/settings',
          name: 'brand-settings',
          component: () => import('../components/forms/BrandForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/profile',
          name: 'profile',
          component: () => import('../views/ProfileView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/plans',
          name: 'plans',
          component: () => import('../views/PlansView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/broadcaster-welcome',
          name: 'broadcaster-welcome',
          component: () => import('../views/BroadcasterWelcome.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands',
          name: 'brands-redirect',
          component: () => import('../views/BrandsRedirectView.vue'),
          meta: { requiresAuth: true }
        },
      ]
    }
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  // Ensure auth is initialized for all routes
  if (authStore.isLoading) {
    await authStore.initializeAuth()
  }

  // Public routes pass through immediately — no auth needed
  if (!requiresAuth) {
    return next()
  }

  // Protected route — check authentication
  if (!authStore.isAuthenticated) {
    await authStore.login(window.location.origin + to.fullPath)
    return next(false)
  } else {
    next()
  }
})

export default router
