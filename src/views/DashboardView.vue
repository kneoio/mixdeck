<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, h, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandsStore } from '@/stores/brands'
import LedIndicator from '@/components/LedIndicator.vue'
import aivoxApiService from '@/services/aivoxApi'
import {
  NLayout, NLayoutSider, NLayoutHeader, NLayoutContent,
  NMenu, NButton, NDropdown, NAvatar, NSpace, NFlex, NIcon,
  NDrawer, NDrawerContent, type MenuOption
} from 'naive-ui'
import {
  RadioOutline,
  SpeedometerOutline as DashboardIcon,
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

const onResize = () => { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onUnmounted(() => window.removeEventListener('resize', onResize))

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
  brandsStore.brands
    .filter(b => b.slugName)
    .forEach(b => {
      aivoxApiService.heartbeat(b.slugName!).then(alive => {
        brandsStore.setStreamingState(b.slugName!, alive)
      })
    })
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
  if (path === '/my-sounds/songs') return 'my-sounds-songs'
  if (path === '/my-sounds/advertisement') return 'my-sounds-advertisement'
  if (path === '/my-sounds/sound-design') return 'my-sounds-sound-design'
  const m = path.match(/^\/brands\/([^/]+)\/(\w+)$/)
  if (m) return `brand-${m[1]}-${m[2]}`
  if (path === '/brands/new') return 'brands-manage'
  return null
})

// Manually controlled expanded keys so user can expand/collapse brand rows
const expandedKeys = ref<string[]>(['my-sounds-root', 'brands-group'])

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
    label: () => h('span', { style: 'font-weight: 700;' }, t('menu.my_sounds')),
    key: 'my-sounds-root',
    children: [
      {
        label: t('menu.songs'),
        key: 'my-sounds-songs',
      },
      {
        label: t('menu.ads'),
        key: 'my-sounds-advertisement',
      },
      {
        label: t('menu.sound_design'),
        key: 'my-sounds-sound-design',
      },
    ],
  },
  {
    label: () => h('span', { style: 'font-weight: 700;' }, t('menu.my_brands')),
    key: 'brands-group',
    children: [
      ...brandsStore.brands.map(brand => ({
        label: brandLabel(brand),
        key: `brand-root-${brand.id}`,
        icon: () => {
            const slug = brand.slugName ?? ''
            const liveState = brandsStore.streamingStates[slug]
            const isOnline = liveState === true || (liveState === undefined && brand.status === 'ON_LINE')
            const isIdle = liveState === false
              ? brand.status === 'IDLE'
              : (liveState === undefined && brand.status === 'IDLE')
            return h(LedIndicator, {
              active: isOnline || isIdle,
              pulse: false,
              size: 16,
              color: isIdle ? '#FFD600' : '#00FF3C',
            })
          },
        children: [
          {
            label: t('menu.dashboard'),
            key: `brand-${brand.id}-dashboard`,
            icon: () => h(NIcon, null, { default: () => h(DashboardIcon) }),
          },
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
        label: t('menu.add_new'),
        key: 'brands-new',
        icon: () => h(NIcon, null, { default: () => h(AddIcon) }),
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

  if (key === 'brands-manage') {
    router.push('/brands')
  } else if (key === 'my-sounds-songs') {
    router.push('/my-sounds/songs')
  } else if (key === 'my-sounds-advertisement') {
    router.push('/my-sounds/advertisement')
  } else if (key === 'my-sounds-sound-design') {
    router.push('/my-sounds/sound-design')
  } else if (key === 'brands-new') {
    router.push('/brands/new')
  } else if (key.startsWith('brand-') && key.endsWith('-dashboard')) {
    const id = key.replace('brand-', '').replace('-dashboard', '')
    router.push(`/brands/${id}/dashboard`)
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
        style="margin-top: 65px;"
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
        bordered
        :style="isMobile
          ? 'padding: 8px; background: linear-gradient(90deg, #7C3AED 0%, transparent 100%);'
          : 'padding: 16px; background: linear-gradient(90deg, #7C3AED 0%, transparent 100%);'"
      >
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
            <h1 style="color: white; margin: 0; font-size: 14px; font-weight: 100; font-family: 'Goldman', 'Inter', sans-serif; letter-spacing: 0.24em;">M I X D E C K</h1>
          </NFlex>
          <NSpace>
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
      </NLayoutHeader>

      <NLayoutContent :style="isMobile ? 'padding: 8px 4px' : 'padding: 24px'">
        <router-view />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>
