<script setup lang="ts">
import { ref, computed, watch, h, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NDataTable, NSpace, NPopconfirm, NInput, NTag, NIcon,
  type DataTableColumns, useMessage
} from 'naive-ui'
import { ShareSocialOutline } from '@vicons/ionicons5'
import { useBrandsStore } from '@/stores/brands'
import datanestApiService from '@/services/datanestApi'
import dictionaryApiService from '@/services/dictionaryApi'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import BulkUploadDialog from '@/components/forms/BulkUploadDialog.vue'
import ShareToBrandsDialog from '@/components/forms/ShareToBrandsDialog.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const brandsStore = useBrandsStore()
const message = useMessage()

const entries = ref<any[]>([])
const loading = ref(false)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])
const searchTerm = ref('')
const showBulkUpload = ref(false)
const showShareDialog = ref(false)
const shareFragmentIds = ref<string[]>([])
const brandDoc = ref<any | null>(null)

/** When true, narrow genres / labels / played / description so title & artist keep space. */
const narrowPlaylistTable = ref(false)
let playlistTableMql: MediaQueryList | null = null

function syncPlaylistTableNarrow() {
  narrowPlaylistTable.value = playlistTableMql?.matches ?? false
}

// Lookup maps for resolving IDs → display names
const genreMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())
const labelMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())

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

const brand = computed(() => brandsStore.brands.find(b => b.id === route.params.id))
const effectiveBrand = computed(() => brand.value ?? brandDoc.value)
const slugName = computed(() => effectiveBrand.value?.slugName ?? '')
const brandName = computed(() =>
  effectiveBrand.value?.localizedName?.['en']
    || effectiveBrand.value?.title
    || effectiveBrand.value?.slugName
    || (route.params.id as string)
)

const pagination = computed(() => ({
  page: pageNum.value,
  pageSize: pageSize.value,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: totalCount.value,
}))

const columns = computed<DataTableColumns<any>>(() => {
  const nw = narrowPlaylistTable.value
  const genreW = nw ? 100 : 180
  const labelW = nw ? 88 : 180
  const playedW = nw ? 56 : 80
  const descMin = nw ? 72 : 160
  const titleMin = nw ? 220 : 200
  const artistMin = nw ? 180 : 160
  const ratingW = nw ? 56 : 72
  const sharedW = nw ? 56 : 72

  return [
  { type: 'selection', multiple: true },
  {
    title: t('playlistView.col_title'),
    key: 'title',
    minWidth: titleMin,
    ellipsis: { tooltip: true },
    render: (row) => row.title || '-',
  },
  {
    title: t('playlistView.col_artist'),
    key: 'artist',
    minWidth: artistMin,
    ellipsis: { tooltip: true },
    render: (row) => row.artist || '-',
  },
  {
    title: t('playlistView.col_genres'), key: 'genres', width: genreW,
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
    title: t('playlistView.col_labels'), key: 'labels', width: labelW,
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
  { title: t('playlistView.col_played'), key: 'playedByBrandCount', width: playedW, render: (row) => row.playedByBrandCount ?? 0 },
  {
    title: t('playlistView.col_rating'), key: 'rating', width: ratingW,
    render: (row) => {
      const val = row.ratedByBrandCount ?? 0
      return val > 0 ? `+${val}` : String(val)
    }
  },
  {
    title: t('playlistView.col_shared'),
    key: 'shared',
    width: sharedW,
    align: 'center',
    render: (row) => row.shared
      ? h(NIcon, { size: 18, color: '#7C3AED' }, { default: () => h(ShareSocialOutline) })
      : null,
  },
  { title: t('playlistView.col_description'), key: 'description', width: nw ? 100 : undefined, minWidth: descMin, ellipsis: { tooltip: true } },
]
})

async function fetchData(page = pageNum.value, size = pageSize.value) {
  if (!slugName.value) return
  loading.value = true
  try {
    const result = await datanestApiService.getBrandPlaylist(
      slugName.value, page, size,
      searchTerm.value ? { searchTerm: searchTerm.value } : {}
    )
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

async function ensureBrandLoaded() {
  if (brand.value) {
    brandDoc.value = null
    return
  }
  try {
    brandDoc.value = await brandsStore.fetchBrand(route.params.id as string)
  } catch {
    brandDoc.value = null
  }
}

async function handleBulkDelete() {
  try {
    loading.value = true
    await Promise.all(selectedIds.value.map(id => datanestApiService.deleteSoundFragment(id)))
    message.success(t('playlistView.deleted', { count: selectedIds.value.length }))
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

function openShareBulk() {
  if (selectedIds.value.length === 0) return
  shareFragmentIds.value = [...selectedIds.value]
  showShareDialog.value = true
}

function onShareDialogDone() {
  selectedIds.value = []
  void fetchData()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchData(1), 400)
}

onMounted(() => {
  playlistTableMql = window.matchMedia('(max-width: 1100px)')
  narrowPlaylistTable.value = playlistTableMql.matches
  playlistTableMql.addEventListener('change', syncPlaylistTableNarrow)
  ensureBrandLoaded()
})

onUnmounted(() => {
  playlistTableMql?.removeEventListener('change', syncPlaylistTableNarrow)
  playlistTableMql = null
})

watch(
  () => route.params.id,
  () => {
    brandDoc.value = null
    ensureBrandLoaded()
  },
  { immediate: true }
)

watch(slugName, (val) => { if (val) { loadDictionaries(); fetchData(1) } }, { immediate: true })
watch(showBulkUpload, (isOpen, wasOpen) => {
  if (wasOpen && !isOpen) fetchData(1)
})
</script>

<template>
  <div>
    <PageHeader :title="brandName" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
      <NSpace>
        <GsapButton type="primary" @click="router.push({ path: `/brands/${route.params.id}/playlist/new`, query: { returnTo: route.fullPath } })">
          <span>{{ t('playlistView.new_track') }}</span>
        </GsapButton>
        <GsapButton @click="showBulkUpload = true"><span>{{ t('playlistView.bulk_upload') }}</span></GsapButton>
        <GsapButton :disabled="selectedIds.length === 0" @click="openShareBulk">
          <span>{{ t('playlistView.share_btn', { count: selectedIds.length }) }}</span>
        </GsapButton>
        <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
          <template #trigger>
            <GsapButton type="error" :disabled="selectedIds.length === 0">
              <span>{{ t('playlistView.delete_btn', { count: selectedIds.length }) }}</span>
            </GsapButton>
          </template>
          {{ t('playlistView.delete_confirm', { count: selectedIds.length }) }}
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
    <BulkUploadDialog
      v-model:show="showBulkUpload"
      :slug-name="slugName"
    />
    <ShareToBrandsDialog
      v-model:show="showShareDialog"
      :fragment-ids="shareFragmentIds"
      :brand-slug="slugName"
      @shared="onShareDialogDone"
    />
    <NDataTable
      :columns="columns"
      :data="entries"
      :loading="loading"
      :row-key="(row: any) => row.id || row.slugName"
      v-model:checked-row-keys="selectedIds"
      :pagination="pagination"
      remote
      :row-props="(row: any) => ({ style: 'cursor:pointer', onClick: (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return; router.push({ path: `/brands/${route.params.id}/playlist/${row.id}`, query: { returnTo: route.fullPath } }) } })"
      @update:page="(p) => { pageNum = p; fetchData(p) }"
      @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
    />
  </div>
</template>
