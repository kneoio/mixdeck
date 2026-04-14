import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import HomeView from '../views/HomeView.vue'
import DashboardView from '../views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { requiresAuth: false }
    },
    {
      // Layout shell — children use absolute paths, URL stays at top level
      path: '/app',
      component: DashboardView,
      meta: { requiresAuth: true },
      children: [
        // Brands list & create
        {
          path: '/brands',
          name: 'brands',
          component: () => import('../views/BrandsView.vue'),
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
      ]
    }
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (authStore.isLoading) {
    await authStore.initializeAuth()
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth && !authStore.isAuthenticated) {
    next('/')
  } else if (!requiresAuth && authStore.isAuthenticated && to.path === '/') {
    next('/brands')
  } else {
    next()
  }
})

export default router
