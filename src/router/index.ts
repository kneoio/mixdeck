import { createRouter, createWebHistory } from 'vue-router'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import Welcome from '../views/Welcome.vue'
import DashboardView from '../views/DashboardView.vue'

/** True while a protected-route navigation is waiting on auth init / login redirect / lazy chunk load. */
export const isRouteResolving = ref(false)

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
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/submission',
      name: 'submission',
      component: () => import('../views/SubmissionView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/ots',
      name: 'ots-master',
      component: () => import('../views/OtsMasterView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/demo',
      name: 'demo',
      component: () => import('../views/DemoView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('../views/HelpView.vue'),
      meta: { requiresAuth: false }
    },
    {
      // Layout shell — children use absolute paths, URL stays at top level
      path: '/app',
      component: DashboardView,
      meta: { requiresAuth: true },
      children: [
        {
          path: '/shared',
          name: 'sound-library-contributed',
          component: () => import('../views/SharedView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/shared/:fragmentId',
          name: 'sound-library-contributed-edit',
          component: () => import('../components/forms/SoundFragmentForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/received',
          name: 'sound-library-received',
          component: () => import('../views/ReceivedView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/playlist',
          name: 'playlist',
          component: () => import('../views/PlaylistView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/listeners',
          name: 'listeners',
          component: () => import('../views/ListenersView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/listeners/new',
          name: 'listener-new',
          component: () => import('../components/forms/ListenerForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/listeners/:listenerId',
          name: 'listener-edit',
          component: () => import('../components/forms/ListenerForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/archived',
          redirect: '/playlist',
        },
        {
          path: '/sound-library/archived/new',
          name: 'sound-library-unassigned-new',
          component: () => import('../components/forms/SoundFragmentForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/sound-assets',
          name: 'sound-library-sound-assets',
          component: () => import('../views/SoundAssetsView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/sound-assets/new',
          name: 'sound-asset-new',
          component: () => import('../components/forms/SoundAssetForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/sound-assets/:fragmentId',
          name: 'sound-asset-edit',
          component: () => import('../components/forms/SoundAssetForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/received/:fragmentId',
          name: 'sound-library-received-edit',
          component: () => import('../components/forms/ReceivedForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/sound-library/archived/:fragmentId',
          name: 'sound-library-archived-edit',
          component: () => import('../components/forms/SoundFragmentForm.vue'),
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
          path: '/brands/:slug/listeners',
          redirect: to => ({ path: '/listeners', query: { brand: String(to.params.slug) } }),
        },
        {
          path: '/brands/:slug/listeners/new',
          name: 'brand-listener-new',
          component: () => import('../components/forms/ListenerForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:slug/listeners/:listenerId',
          name: 'brand-listener-edit',
          component: () => import('../components/forms/ListenerForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:slug/playlist',
          redirect: to => ({ path: '/playlist', query: { brand: String(to.params.slug) } }),
        },
        {
          path: '/brands/:slug/playlist/new',
          name: 'brand-fragment-new',
          component: () => import('../components/forms/SoundFragmentForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:slug/playlist/:fragmentId',
          name: 'brand-fragment-edit',
          component: () => import('../components/forms/SoundFragmentForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/brands/:slug/settings',
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
          name: 'brands',
          component: () => import('../views/BrandsView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/mixdeck',
          name: 'overview',
          component: () => import('../views/OverviewView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/one-time-streams',
          name: 'ots-list',
          component: () => import('../views/OtsDefinitionsView.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/one-time-streams/new',
          name: 'ots-new',
          component: () => import('../components/forms/OtsForm.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: '/one-time-streams/:slugName',
          name: 'ots-edit',
          component: () => import('../components/forms/OtsForm.vue'),
          meta: { requiresAuth: true }
        },
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
      meta: { requiresAuth: false }
    }
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  // Public routes pass through immediately — no auth needed.
  // Kick off auth init in the background (unawaited) so nav bar/login state
  // can still catch up later, without blocking the public page on it.
  if (!requiresAuth) {
    if (authStore.isLoading) {
      authStore.initializeAuth()
    }
    return next()
  }

  // Protected route — auth state must be known before deciding.
  // Only show the overlay when there's actually something to wait on, so
  // ordinary in-app navigation (already authenticated) never flickers it.
  if (authStore.isLoading) {
    isRouteResolving.value = true
    await authStore.initializeAuth()
  }

  if (!authStore.isAuthenticated) {
    isRouteResolving.value = false
    return next({ name: 'login', query: { redirect: to.fullPath } })
  } else {
    next()
  }
})

router.afterEach(() => {
  isRouteResolving.value = false
})

router.onError(() => {
  isRouteResolving.value = false
})

export default router
