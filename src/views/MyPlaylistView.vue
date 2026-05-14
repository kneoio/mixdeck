<script setup lang="ts">
import { ref, computed, h, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import {
  NDataTable, NButton, NSpace, NPopconfirm, NInput, NTag,
  type DataTableColumns, useMessage
} from 'naive-ui'
import datanestApiService from '@/services/datanestApi'
import dictionaryApiService from '@/services/dictionaryApi'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import { handleApiError } from '@/utils/notificationService'
import { useBrandsStore } from '@/stores/brands'

const { t } = useI18n()
const message = useMessage()
const route = useRoute()
const router = useRouter()
const brandsStore = useBrandsStore()

const entries = ref<any[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])
const searchTerm = ref('')

const genreMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())
const labelMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())

const isSharedLibraryRoute = computed(() => route.path === '/shared')
const isReceivedRoute = computed(() => route.path === '/sound-library/received')

const activeTypeFilter = computed<string[]>(() => {
  const path = route.path
  if (path === '/my-sounds/songs') return ['SONG']
  if (path === '/my-sounds/advertisement') return ['ADVERTISEMENT']
  if (path === '/my-sounds/sound-design') {
    return ['JINGLE', 'JINGLE_INTRO', 'JINGLE_OUTRO', 'BACKGROUND_LOOP']
  }
  return []
})

const pageTitle = computed(() => {
  const path = route.path
  if (path === '/my-sounds/songs') return `${t('menu.my_sounds')} / ${t('menu.songs')}`
  if (path === '/my-sounds/advertisement') return `${t('menu.my_sounds')} / ${t('menu.ads')}`
  if (path === '/my-sounds/sound-design') return `${t('menu.my_sounds')} / ${t('menu.sound_design')}`
  if (path === '/shared') return t('menu.songs')
  if (path === '/sound-library/received') return t('menu.received')
  return t('menu.my_sounds')
})

async function loadDictionaries() {
  const [genres, labels] = await Promise.allSettled([
    dictionaryApiService.getGenres(),
    dictionaryApiService.getLabelsByCategory('sound_fragment'),
  ])
  if (genres.status === 'fulfilled') {
    genreMap.value = new Map(genres.value.map(g => [g.id, {
      name: g.localizedName?.en || Object.values(g.localizedName || {})[0] || g.identifier || g.id,
      color: g.color,
      fontColor: g.fontColor,
    }]))
  }
  if (labels.status === 'fulfilled') {
    labelMap.value = new Map(labels.value.map(l => [l.id, {
      name: l.localizedName?.en || l.identifier || l.id,
      color: l.color,
      fontColor: l.fontColor,
    }]))
  }
}

function resolveGenre(g: any) {
  if (typeof g === 'string') return genreMap.value.get(g) ?? { name: g }
  return { name: g.identifier || g.id, color: g.color, fontColor: g.fontColor }
}

function resolveLabel(l: any) {
  if (typeof l === 'string') return labelMap.value.get(l) ?? { name: l }
  return { name: l.identifier || l.id, color: l.color, fontColor: l.fontColor }
}

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

const columns = computed<DataTableColumns<any>>(() => {
  const cols: DataTableColumns<any> = [
    { type: 'selection', multiple: true },
    { title: t('playlistView.col_title'), key: 'title', minWidth: 200, render: (row) => row.title || '-' },
    { title: t('playlistView.col_artist'), key: 'artist', minWidth: 160, render: (row) => row.artist || '-' },
    {
      title: t('playlistView.col_genres'), key: 'genres', width: 180,
      render: (row) => {
        if (!row.genres?.length) return '-'
        return h(NSpace, { size: 4, wrap: true }, {
          default: () => row.genres.map((g: any) => {
            const r = resolveGenre(g)
            return h(NTag, {
              size: 'small',
              style: r.color ? `background:${r.color};color:${r.fontColor || '#fff'}` : ''
            }, { default: () => r.name })
          })
        })
      }
    },
    {
      title: t('playlistView.col_labels'), key: 'labels', width: 180,
      render: (row) => {
        if (!row.labels?.length) return '-'
        return h(NSpace, { size: 4, wrap: true }, {
          default: () => row.labels.map((l: any) => {
            const r = resolveLabel(l)
            return h(NTag, {
              size: 'small',
              style: r.color ? `background:${r.color};color:${r.fontColor || '#fff'}` : ''
            }, { default: () => r.name })
          })
        })
      }
    },
    { title: t('playlistView.col_description'), key: 'description', minWidth: 160, ellipsis: { tooltip: true } },
  ]
  return cols
})

async function fetchData(page = pageNum.value, size = pageSize.value) {
  loading.value = true
  try {
    const path = route.path
    let result
    if (path === '/shared') {
      result = await datanestApiService.getShared(page, size)
    } else if (path === '/sound-library/received') {
      result = await datanestApiService.getReceived(page, size)
    } else {
      result = await datanestApiService.getMyPlaylist(
        page,
        size,
        {
          ...(searchTerm.value ? { searchTerm: searchTerm.value } : {}),
          ...(activeTypeFilter.value.length ? { type: activeTypeFilter.value } : {}),
        }
      )
    }
    entries.value = result.entries
    totalCount.value = result.count
    pageNum.value = result.pageNum
    pageSize.value = result.pageSize
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

async function handleBulkDelete() {
  try {
    loading.value = true
    const deleteFn = route.path === '/sound-library/received'
      ? datanestApiService.rejectReceivedSoundFragment.bind(datanestApiService)
      : datanestApiService.deleteSoundFragment.bind(datanestApiService)
    await Promise.all(selectedIds.value.map(id => deleteFn(id)))
    const successKey = isReceivedRoute.value ? 'playlistView.received_removed' : 'playlistView.deleted'
    message.success(t(successKey, { count: selectedIds.value.length }))
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

async function handleBulkUnshare() {
  if (selectedIds.value.length === 0) return
  try {
    loading.value = true
    await Promise.all(selectedIds.value.map(id => datanestApiService.unshare(String(id))))
    message.success(t('playlistView.unshared_bulk', { count: selectedIds.value.length }))
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchData(1), 400)
}

function representedBrandIds(row: any): string[] {
  const rb = row?.representedInBrands
  if (!Array.isArray(rb)) return []
  return rb
    .map((x: any) => (typeof x === 'string' ? x : x?.id))
    .filter(Boolean)
}

/** Brand segment for SoundFragmentForm URL — same fragment editor as brand playlist. */
function resolveBrandIdForPlaylistRow(row: any): string | null {
  const src = row?.sourceBrandId ?? row?.sourceBrand?.id
  if (src) return String(src)
  const owned = new Set(brandsStore.brands.map(b => b.id))
  const fromRow = representedBrandIds(row).find(id => owned.has(id))
  if (fromRow) return fromRow
  const anyBrand = representedBrandIds(row)[0]
  if (anyBrand) return anyBrand
  return brandsStore.brands[0]?.id ?? null
}

function playlistRowProps(row: any) {
  return {
    style: 'cursor:pointer',
    onClick: (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return
      const fragmentId = row.id
      if (!fragmentId) return
      const brandId = resolveBrandIdForPlaylistRow(row)
      if (!brandId) return
      router.push({
        path: `/brands/${brandId}/playlist/${fragmentId}`,
        query: { returnTo: route.fullPath },
      })
    },
  }
}

onMounted(async () => {
  await loadDictionaries()
  await fetchData(1)
})

watch(
  () => route.path,
  () => {
    selectedIds.value = []
    searchTerm.value = ''
    fetchData(1)
  }
)
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
      <NSpace>
        <NPopconfirm
          v-if="isSharedLibraryRoute"
          @positive-click="handleBulkUnshare"
          :disabled="selectedIds.length === 0"
        >
          <template #trigger>
            <NButton type="warning" :disabled="selectedIds.length === 0">
              {{ t('playlistView.unshare_btn', { count: selectedIds.length }) }}
            </NButton>
          </template>
          {{ t('playlistView.unshare_bulk_confirm', { count: selectedIds.length }) }}
        </NPopconfirm>
        <NPopconfirm v-else @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
          <template #trigger>
            <NButton type="error" :disabled="selectedIds.length === 0">
              {{ t(isReceivedRoute ? 'playlistView.received_remove_btn' : 'playlistView.delete_btn', { count: selectedIds.length }) }}
            </NButton>
          </template>
          {{ t(isReceivedRoute ? 'playlistView.received_remove_confirm' : 'playlistView.delete_confirm', { count: selectedIds.length }) }}
        </NPopconfirm>
        <NInput
          v-model:value="searchTerm"
          :placeholder="t('playlistView.search')"
          clearable
          style="width: 220px"
          @update:value="onSearchChange"
        />
      </NSpace>
    </ActionBar>
    <NDataTable
      :columns="columns"
      :data="entries"
      :loading="loading"
      :row-key="(row: any) => row.id || row.slugName"
      v-model:checked-row-keys="selectedIds"
      :pagination="pagination"
      remote
      :row-props="playlistRowProps"
      @update:page="(p) => { pageNum = p; fetchData(p) }"
      @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
    />
  </div>
</template>
