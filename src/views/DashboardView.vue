<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, h, watch, nextTick } from 'vue'
import gsap from 'gsap'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandsStore } from '@/stores/brands'
import aivoxApiService from '@/services/aivoxApi'
import {
  NLayout, NLayoutSider, NLayoutHeader, NLayoutContent,
  NMenu, NButton, NDropdown, NAvatar, NSpace, NFlex, NIcon,
  NDrawer, NDrawerContent, type MenuOption
} from 'naive-ui'
import {
  RadioOutline,
  HomeOutline as OverviewIcon,
  HeadsetOutline as ListenersIcon,
  MusicalNotesOutline as PlaylistIcon,
  SettingsOutline as SettingsIcon,
  LogOutOutline as LogoutIcon,
  SunnyOutline as LightIcon,
  MoonOutline as DarkIcon,
  MenuOutline as HamburgerIcon,
  AddOutline as AddIcon,
  PersonOutline as ProfileIcon,
} from '@vicons/ionicons5'

const { t } = useI18n()

const authStore = useAuthStore()
const themeStore = useThemeStore()
const brandsStore = useBrandsStore()
const router = useRouter()
const route = useRoute()

const menuThemeOverrides = computed(() => {
  const normalText = themeStore.isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.85)'
  return {
    itemColorActive: '#7C3AED',
    itemColorActiveHover: '#6d31d4',
    itemTextColorActive: '#ffffff',
    itemIconColorActive: '#ffffff',
    itemTextColorActiveHover: '#ffffff',
    itemIconColorActiveHover: '#ffffff',
    itemTextColorChildActive: normalText,
    itemIconColorChildActive: normalText,
    arrowColorChildActive: normalText,
  }
})

const collapsed = ref(false)
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)
const mobileDrawerOpen = ref(false)

const HEADER_STRIPE_PURPLE = '#7C3AED'
/** Pairs of (purple, accent) vertical lines; accent is black in dark theme, white in light. */
const HEADER_LINE_PAIRS_DESKTOP = 110
const HEADER_LINE_PAIRS_MOBILE = 36

const headerLinePairs = computed(() =>
  isMobile.value ? HEADER_LINE_PAIRS_MOBILE : HEADER_LINE_PAIRS_DESKTOP
)

const headerStripeAccent = computed(() => (themeStore.isDark ? '#000000' : '#ffffff'))

const headerVerticalLines = computed(() => {
  const accent = headerStripeAccent.value
  const out: { widthPct: number; color: string }[] = []
  const n = headerLinePairs.value
  for (let p = 0; p < n; p++) {
    const t = n <= 1 ? 0 : p / (n - 1)
    const blueShare = 0.06 + 0.79 * (1 - t) ** 1.2
    const blackShare = 1 - blueShare
    const pairPct = 100 / n
    out.push({ widthPct: pairPct * blueShare, color: HEADER_STRIPE_PURPLE })
    out.push({ widthPct: pairPct * blackShare, color: accent })
  }
  return out
})

const headerFirstLine = computed(() => headerVerticalLines.value[0]!)
const headerLastLine = computed(() => headerVerticalLines.value[headerVerticalLines.value.length - 1]!)
const headerMiddleLines = computed(() => headerVerticalLines.value.slice(1, -1))

const headerLineZoneRef = ref<HTMLElement | null>(null)
let headerLineGsapCtx: gsap.Context | null = null

function runHeaderLineAnimation() {
  headerLineGsapCtx?.revert()
  headerLineGsapCtx = null
  nextTick(() => {
    const zone = headerLineZoneRef.value
    if (!zone) return
    const lines = zone.querySelectorAll<HTMLElement>('.dashboard-header-line-mid .dashboard-header-line')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const staggerEach = isMobile.value ? 0.005 : 0.0016

    headerLineGsapCtx = gsap.context(() => {
      if (reduceMotion) return

      gsap.set(lines, { transformOrigin: 'right center', scaleX: 1.35 })
      gsap.set(zone, { xPercent: 100 })

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      tl.to(zone, { xPercent: 0, duration: 1.1 }, 0)
      tl.to(
        lines,
        {
          scaleX: 1,
          duration: 1.05,
          stagger: { each: staggerEach, from: 'end' },
        },
        0.06
      )
    }, zone)
  })
}

const onResize = () => { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

onMounted(() => {
  runHeaderLineAnimation()
})

watch(headerLinePairs, () => {
  runHeaderLineAnimation()
})

onUnmounted(() => {
  headerLineGsapCtx?.revert()
  headerLineGsapCtx = null
})

const HEARTBEAT_POLL_MS = 5_000
let heartbeatPollTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatPollCancelled = false

async function pollHeartbeat() {
  if (heartbeatPollCancelled) return
  const slugs = brandsStore.brands.filter(b => b.slugName).map(b => b.slugName!)
  if (slugs.length > 0) {
    const { byBrand } = await aivoxApiService.heartbeatBatch(slugs)
    if (heartbeatPollCancelled) return
    for (const slug of slugs) brandsStore.setStreamingState(slug, byBrand[slug] ?? false)
  }
  if (!heartbeatPollCancelled) heartbeatPollTimer = setTimeout(() => void pollHeartbeat(), HEARTBEAT_POLL_MS)
}

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    router.push('/')
    return
  }
  await brandsStore.loadBrands(1, 10)
  if (brandsStore.brands.length === 0 && route.path !== '/broadcaster-welcome') {
    await router.replace('/broadcaster-welcome')
    return
  }
  heartbeatPollCancelled = false
  void pollHeartbeat()
})

onUnmounted(() => {
  heartbeatPollCancelled = true
  if (heartbeatPollTimer) { clearTimeout(heartbeatPollTimer); heartbeatPollTimer = null }
})

watch(
  () => brandsStore.brands.length,
  async (count) => {
    if (count === 0 && route.path !== '/broadcaster-welcome') {
      await router.replace('/broadcaster-welcome')
    }
  }
)

// Derive active menu key from current route
const activeKey = computed(() => {
  const path = route.path
  if (path === '/mixdeck' || path === '/brands') return 'overview'
  if (path === '/shared') return 'my-sounds-contributed'
  if (path === '/sound-library/received') return 'my-sounds-received'
  if (path === '/sound-library/unassigned-to-brands') return 'my-sounds-unassigned-to-brands'
  if (path === '/sound-library/sound-assets') return 'my-sounds-assets'
  const m = path.match(/^\/brands\/([^/]+)\/(\w+)$/)
  if (m) return `brand-${m[1]}-${m[2]}`
  if (path === '/brands/new') return 'brands-manage'
  return null
})

// Manually controlled expanded keys so user can expand/collapse brand rows
const expandedKeys = ref<string[]>(['my-sounds-root', 'brands-group'])

watch(
  () => brandsStore.brands,
  (brands) => {
    const brandKeys = brands.map(b => `brand-root-${b.id}`)
    const next = [...expandedKeys.value]
    for (const k of brandKeys) {
      if (!next.includes(k)) next.push(k)
    }
    expandedKeys.value = next
  },
  { immediate: true }
)

// When route changes to a brand sub-page, auto-expand that brand
watch(
  () => route.path,
  (path) => {
    const m = path.match(/^\/brands\/([^/]+)\//)
    if (m) {
      const key = `brand-root-${m[1]}`
      if (!expandedKeys.value.includes(key)) {
        expandedKeys.value = [...expandedKeys.value, key]
      }
    }
  },
  { immediate: true }
)

function handleUpdateExpandedKeys(keys: string[]) {
  expandedKeys.value = keys
}

const brandLabel = (brand: any) =>
  brand.localizedName?.['en'] || brand.title || brand.slugName || brand.id

const menuOptions = computed<MenuOption[]>(() => [
  {
    label: () => h('span', { style: 'font-weight: 700;' }, t('menu.overview')),
    key: 'overview',
    icon: () => h(NIcon, { color: '#2080F0' }, { default: () => h(OverviewIcon) }),
  },
  {
    label: () => h('span', { style: 'font-weight: 700;' }, t('menu.my_brands')),
    key: 'brands-group',
    children: [
      ...brandsStore.brands.map(brand => ({
        label: brandLabel(brand),
        key: `brand-root-${brand.id}`,
        children: [
          {
            label: t('menu.listeners'),
            key: `brand-${brand.id}-listeners`,
            icon: () => h(NIcon, null, { default: () => h(ListenersIcon) }),
          },
          {
            label: t('menu.playlist'),
            key: `brand-${brand.id}-playlist`,
            icon: () => h(NIcon, null, { default: () => h(PlaylistIcon) }),
          },
          {
            label: t('menu.settings'),
            key: `brand-${brand.id}-settings`,
            icon: () => h(NIcon, null, { default: () => h(SettingsIcon) }),
          },
        ],
      })),
      {
        label: () => h('span', { style: 'color: #7C3AED; font-weight: 600;' }, t('menu.add_new')),
        key: 'brands-new',
        icon: () => h(NIcon, { color: '#7C3AED' }, { default: () => h(AddIcon) }),
      },
    ],
  },
  {
    label: () => h('span', { style: 'font-weight: 700;' }, t('menu.my_sounds')),
    key: 'my-sounds-root',
    children: [
      {
        label: t('menu.unassigned_brands'),
        key: 'my-sounds-unassigned-to-brands',
      },
      {
        label: t('menu.songs'),
        key: 'my-sounds-contributed',
      },
      {
        label: t('menu.received'),
        key: 'my-sounds-received',
      },
      {
        label: t('menu.sound_assets'),
        key: 'my-sounds-assets',
      },
    ],
  },
])

const handleMenuSelect = async (key: string) => {
  if (key === 'logout') {
    await authStore.logout()
    return
  }
  if (isMobile.value) mobileDrawerOpen.value = false

  if (key === 'overview') {
    router.push('/mixdeck')
  } else if (key === 'brands-manage') {
    router.push('/brands')
  } else if (key === 'my-sounds-contributed') {
    router.push('/shared')
  } else if (key === 'my-sounds-received') {
    router.push('/sound-library/received')
  } else if (key === 'my-sounds-unassigned-to-brands') {
    router.push('/sound-library/unassigned-to-brands')
  } else if (key === 'my-sounds-assets') {
    router.push('/sound-library/sound-assets')
  } else if (key === 'brands-new') {
    router.push('/brands/new')
  } else if (key.startsWith('brand-') && key.endsWith('-listeners')) {
    const id = key.replace('brand-', '').replace('-listeners', '')
    router.push(`/brands/${id}/listeners`)
  } else if (key.startsWith('brand-') && key.endsWith('-playlist')) {
    const id = key.replace('brand-', '').replace('-playlist', '')
    router.push(`/brands/${id}/playlist`)
  } else if (key.startsWith('brand-') && key.endsWith('-settings')) {
    const id = key.replace('brand-', '').replace('-settings', '')
    router.push(`/brands/${id}/settings`)
  }
}

const userMenuOptions = computed(() => [
  {
    label: t('userMenu.profile'),
    key: 'profile',
    icon: () => h(NIcon, null, { default: () => h(ProfileIcon) }),
  },
  {
    label: t('userMenu.logout'),
    key: 'logout',
    icon: () => h(NIcon, null, { default: () => h(LogoutIcon) }),
  },
])

const handleUserMenuSelect = async (key: string) => {
  if (key === 'profile') router.push('/profile')
  if (key === 'logout') await authStore.logout()
}
</script>

<style scoped>
@font-face {
  font-family: 'Goldman';
  src: url('/src/assets/fonts/Goldman-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}

.dashboard-layout-header {
  position: relative;
  overflow: hidden;
  background-color: #7C3AED !important;
  border: none !important;
  box-shadow: none !important;
}

.dashboard-layout-header--light-stripe :deep(.dashboard-header-actions .n-button) {
  color: rgba(0, 0, 0, 0.82) !important;
}

.dashboard-header-line-zone {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 12%;
  z-index: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  pointer-events: none;
  overflow: hidden;
}

.dashboard-header-line-mid {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  box-sizing: border-box;
}

.dashboard-header-line-mid .dashboard-header-line {
  min-width: 0;
  height: 100%;
  will-change: transform;
}

.dashboard-header-toolbar-wrap {
  position: relative;
  z-index: 1;
}

.dashboard-layout-header:not(.dashboard-layout-header--light-stripe) :deep(.dashboard-header-actions .n-button) {
  color: rgba(255, 255, 255, 0.92);
}

</style>

<template>
  <NLayout has-sider style="min-height: 100vh; width: 100%; overflow-x: hidden;">

    <!-- Desktop sidebar -->
    <NLayoutSider
      v-if="!isMobile"
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="240"
      :collapsed="collapsed"
      show-trigger
      style="min-height: 100vh;"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <NMenu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
        :expanded-keys="expandedKeys"
        :theme-overrides="menuThemeOverrides"
        style="margin-top: 40px;"
        @update:expanded-keys="handleUpdateExpandedKeys"
        @update:value="handleMenuSelect"
      />
    </NLayoutSider>

    <!-- Mobile drawer -->
    <NDrawer
      v-if="isMobile"
      v-model:show="mobileDrawerOpen"
      placement="left"
      :width="260"
    >
      <NDrawerContent :native-scrollbar="false">
        <template #header>
          <span style="font-weight: 600;">Mixdeck</span>
        </template>
        <NMenu
          :options="menuOptions"
          :value="activeKey"
          :expanded-keys="expandedKeys"
          :theme-overrides="menuThemeOverrides"
          style="margin-top: 10px;"
          @update:expanded-keys="handleUpdateExpandedKeys"
          @update:value="handleMenuSelect"
        />
      </NDrawerContent>
    </NDrawer>

    <NLayout style="flex: 1; min-width: 0;">
      <NLayoutHeader
        class="dashboard-layout-header"
        :class="{ 'dashboard-layout-header--light-stripe': !themeStore.isDark }"
        :style="{ padding: isMobile ? '8px' : '16px' }"
      >
        <div
          ref="headerLineZoneRef"
          class="dashboard-header-line-zone"
          aria-hidden="true"
        >
          <div
            class="dashboard-header-line-mid"
            :style="{
              borderLeft: `0.5px solid ${headerFirstLine.color}`,
              borderRight: `0.5px solid ${headerLastLine.color}`,
            }"
          >
            <div
              v-for="(line, i) in headerMiddleLines"
              :key="i"
              class="dashboard-header-line"
              :style="{
                flex: `${line.widthPct} 0 0`,
                backgroundColor: line.color,
              }"
            />
          </div>
        </div>
        <div class="dashboard-header-toolbar-wrap">
          <NFlex justify="space-between" align="center">
            <NFlex align="center" :size="8">
              <NButton
                v-if="isMobile"
                circle quaternary
                @click="mobileDrawerOpen = true"
                style="color: white;"
              >
                <template #icon><NIcon size="26"><HamburgerIcon /></NIcon></template>
              </NButton>
              <h1 style="color: white; margin: 0; font-size: 14px; font-weight: 100; font-family: 'Goldman', 'Inter', sans-serif; letter-spacing: 0.24em; cursor: pointer;" @click="router.push('/')">M I X D E C K</h1>
            </NFlex>
            <NSpace class="dashboard-header-actions">
              <NButton
                circle quaternary
                @click="themeStore.toggleTheme"
                :title="themeStore.isDark ? t('theme.to_light') : t('theme.to_dark')"
              >
                <template #icon>
                  <NIcon>
                    <LightIcon v-if="themeStore.isDark" />
                    <DarkIcon v-else />
                  </NIcon>
                </template>
              </NButton>

              <NDropdown :options="userMenuOptions" @select="handleUserMenuSelect">
                <NButton text>
                  <NSpace align="center" :size="8">
                    <NAvatar size="small">
                      {{ authStore.userName.charAt(0).toUpperCase() }}
                    </NAvatar>
                    <span v-if="!isMobile">{{ authStore.userName }}</span>
                  </NSpace>
                </NButton>
              </NDropdown>
            </NSpace>
          </NFlex>
        </div>
      </NLayoutHeader>

      <NLayoutContent :style="isMobile ? 'padding: 8px 4px' : 'padding: 24px'">
        <router-view :key="$route.fullPath" />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>
