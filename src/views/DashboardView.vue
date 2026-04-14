<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, h, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useBrandsStore } from '@/stores/brands'
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
} from '@vicons/ionicons5'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const brandsStore = useBrandsStore()
const router = useRouter()
const route = useRoute()

const menuThemeOverrides = {
  itemColorActive: '#7C3AED',
  itemColorActiveHover: '#6d31d4',
  itemTextColorActive: '#ffffff',
  itemIconColorActive: '#ffffff',
  itemTextColorActiveHover: '#ffffff',
  itemIconColorActiveHover: '#ffffff',
  itemTextColorChildActive: '#ffffff',
  itemIconColorChildActive: '#ffffff',
  itemTextColorChildActiveHover: '#ffffff',
  itemIconColorChildActiveHover: '#ffffff',
  arrowColorChildActive: '#ffffff',
  arrowColorChildActiveHover: '#ffffff',
}

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
})

// Derive active menu key from current route
const activeKey = computed(() => {
  const path = route.path
  const m = path.match(/^\/brands\/([^/]+)\/(\w+)$/)
  if (m) return `brand-${m[1]}-${m[2]}`
  if (path === '/brands' || path === '/brands/new') return 'brands-manage'
  return null
})

// Manually controlled expanded keys so user can expand/collapse brand rows
const expandedKeys = ref<string[]>(['brands-group'])

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
    label: 'Brands',
    key: 'brands-group',
    icon: () => h(NIcon, null, { default: () => h(RadioOutline) }),
    children: [
      ...brandsStore.brands.map(brand => ({
        label: brandLabel(brand),
        key: `brand-root-${brand.id}`,
            icon: () => h(NIcon, null, { default: () => h(RadioOutline) }),
        children: [
          {
            label: 'Dashboard',
            key: `brand-${brand.id}-dashboard`,
            icon: () => h(NIcon, null, { default: () => h(DashboardIcon) }),
          },
          {
            label: 'Listeners',
            key: `brand-${brand.id}-listeners`,
            icon: () => h(NIcon, null, { default: () => h(ListenersIcon) }),
          },
          {
            label: 'Playlist',
            key: `brand-${brand.id}-playlist`,
            icon: () => h(NIcon, null, { default: () => h(PlaylistIcon) }),
          },
          {
            label: 'Settings',
            key: `brand-${brand.id}-settings`,
            icon: () => h(NIcon, null, { default: () => h(SettingsIcon) }),
          },
        ],
      })),
      {
        label: 'Add New',
        key: 'brands-new',
        icon: () => h(NIcon, null, { default: () => h(AddIcon) }),
      },
    ],
  },
  { key: 'divider-1', type: 'divider' },
  {
    label: 'Logout',
    key: 'logout',
    icon: () => h(NIcon, null, { default: () => h(LogoutIcon) }),
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

const userMenuOptions = [
  {
    label: 'Logout',
    key: 'logout',
    icon: () => h(NIcon, null, { default: () => h(LogoutIcon) }),
  },
]

const handleUserMenuSelect = async (key: string) => {
  if (key === 'logout') await authStore.logout()
}
</script>

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
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div style="padding: 8px;">
        <NMenu
          :collapsed="collapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
          :value="activeKey"
          :expanded-keys="expandedKeys"
          :theme-overrides="menuThemeOverrides"
          @update:expanded-keys="handleUpdateExpandedKeys"
          @update:value="handleMenuSelect"
        />
      </div>
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
              <template #icon><NIcon><HamburgerIcon /></NIcon></template>
            </NButton>
            <h1 style="color: white; margin: 0; font-size: 14px; font-weight: 600;">Mixdeck</h1>
          </NFlex>
          <NSpace>
            <NButton
              circle quaternary
              @click="themeStore.toggleTheme"
              :title="themeStore.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
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
