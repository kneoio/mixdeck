<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  NDataTable, NSpace, NPopconfirm, NTag, NButton, NIcon, NInput,
  type DataTableColumns, useMessage
} from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import datanestApiService from '@/services/datanestApi'
import { useDictionaryStore } from '@/stores/dictionary'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapLoader from '@/components/GsapLoader.vue'
import { handleApiError } from '@/utils/notificationService'
import { useBrandsStore } from '@/stores/brands'

const { t } = useI18n()
const pageTitle = computed(() => `${t('menu.my_sounds')} / ${t('menu.songs')}`)
const message = useMessage()
const router = useRouter()
const brandsStore = useBrandsStore()
const dictionaryStore = useDictionaryStore()

const entries = ref<any[]>([])
const loading = ref(true)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])
const searchTerm = ref('')

const genreMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())
const labelMap = ref<Map<string, { name: string; color?: string; fontColor?: string }>>(new Map())

async function loadDictionaries() {
  await Promise.all([
    dictionaryStore.loadGenres(),
    dictionaryStore.loadSoundFragmentLabels(),
  ])
  genreMap.value = new Map(dictionaryStore.genres.map(g => [g.id, {
    name: g.localizedName?.en || Object.values(g.localizedName || {})[0] || g.identifier || g.id,
    color: g.color,
    fontColor: g.fontColor,
  }]))
  labelMap.value = new Map(dictionaryStore.soundFragmentLabels.map(l => [l.id, {
    name: l.localizedName?.en || l.identifier || l.id,
    color: l.color,
    fontColor: l.fontColor,
  }]))
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

const columns = computed<DataTableColumns<any>>(() => [
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
])

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchData(1), 400)
}

async function fetchData(page = pageNum.value, size = pageSize.value) {
  loading.value = true
  try {
    const result = await datanestApiService.getShared(page, size, searchTerm.value)
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

async function handleBulkUnshare() {
  if (selectedIds.value.length === 0) return
  try {
    loading.value = true
    await Promise.all(selectedIds.value.map(async id => {
      const raw = await datanestApiService.getDocument<any>('/soundfragments', String(id))
      const frag = raw?.payload?.docData ?? raw?.docData ?? raw
      const brandIds: string[] = Array.isArray(frag?.sharedWith)
        ? frag.sharedWith.map((s: any) => s.targetBrandId).filter(Boolean)
        : []
      if (!brandIds.length) return
      const slug = resolveBrandSlugFromFragment(frag)
      if (!slug) return
      return datanestApiService.unshare(slug, String(id), brandIds)
    }))
    message.success(t('playlistView.unshared_bulk', { count: selectedIds.value.length }))
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

function representedBrandIds(row: any): string[] {
  const rb = row?.representedInBrands
  if (!Array.isArray(rb)) return []
  return rb.map((x: any) => (typeof x === 'string' ? x : x?.id)).filter(Boolean)
}

function resolveBrandIdForRow(row: any): string | null {
  const src = row?.sourceBrandId ?? row?.sourceBrand?.id
  if (src) return String(src)
  const owned = new Set(brandsStore.brands.map(b => b.id))
  const fromRow = representedBrandIds(row).find(id => owned.has(id))
  if (fromRow) return fromRow
  const anyBrand = representedBrandIds(row)[0]
  if (anyBrand) return anyBrand
  return brandsStore.brands[0]?.id ?? null
}

function resolveBrandSlug(brandId: string | null, row?: any): string | null {
  if (row?.sourceBrandSlug) return String(row.sourceBrandSlug)
  if (brandId) {
    const slug = brandsStore.brands.find(b => b.id === brandId)?.slugName
    if (slug) return slug
  }
  return null
}

function resolveBrandSlugForRow(row: any): string | null {
  return resolveBrandSlug(resolveBrandIdForRow(row), row)
}

function resolveBrandSlugFromFragment(frag: any): string | null {
  const owned = new Set(brandsStore.brands.map(b => b.id))
  const brandId = (Array.isArray(frag?.representedInBrands) ? frag.representedInBrands : [])
    .map((x: any) => (typeof x === 'string' ? x : x?.id))
    .find((id: string) => owned.has(id))
  return resolveBrandSlug(brandId ?? null, frag)
}

function rowProps(row: any) {
  return {
    style: 'cursor:pointer',
    onClick: (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return
      const fragmentId = row.slugName
      if (!fragmentId) return
      router.push({ path: `/shared/${fragmentId}` })
    },
  }
}

onMounted(async () => {
  await loadDictionaries()
  await fetchData(1)
})
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
      <div class="playlist-action-row">
        <NSpace>
          <NPopconfirm @positive-click="handleBulkUnshare" :disabled="selectedIds.length === 0">
            <template #trigger>
              <GsapButton type="warning" :disabled="selectedIds.length === 0">
                <span>{{ t('playlistView.unshare_btn', { count: selectedIds.length }) }}</span>
              </GsapButton>
            </template>
            {{ t('playlistView.unshare_bulk_confirm', { count: selectedIds.length }) }}
          </NPopconfirm>
          <NButton quaternary circle size="small" style="opacity:0.5" @click="fetchData()">
            <template #icon><NIcon :component="RefreshOutline" /></template>
          </NButton>
        </NSpace>
        <NInput
          v-model:value="searchTerm"
          :placeholder="t('playlistView.search')"
          clearable
          style="width: 220px"
          @update:value="onSearchChange"
        />
      </div>
    </ActionBar>
    <NDataTable
      :columns="columns"
      :data="entries"
      :loading="loading"
      :row-key="(row: any) => row.slugName"
      v-model:checked-row-keys="selectedIds"
      :pagination="pagination"
      remote
      :row-props="rowProps"
      @update:page="(p) => { pageNum = p; fetchData(p) }"
      @update:page-size="(s) => { pageSize = s; fetchData(1, s) }"
    >
      <template #loading><GsapLoader :size="32" /></template>
    </NDataTable>
  </div>
</template>

<style>
.playlist-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
@media (max-width: 600px) {
  .playlist-action-row {
    flex-wrap: wrap;
    gap: 8px;
  }
  .playlist-action-row .n-input {
    width: 100% !important;
  }
}
</style>
