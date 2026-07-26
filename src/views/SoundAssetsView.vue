<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted } from 'vue'
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

const { t } = useI18n()
const pageTitle = computed(() => `${t('menu.my_sounds')} / ${t('menu.sound_assets')}`)
const message = useMessage()
const router = useRouter()
const dictionaryStore = useDictionaryStore()

const entries = ref<any[]>([])
const loading = ref(true)
const totalCount = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const selectedIds = ref<string[]>([])
const searchTerm = ref('')

const isMobile = ref(false)
let mobileMql: MediaQueryList | null = null
function syncMobile() { isMobile.value = mobileMql?.matches ?? false }

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

const columns = computed<DataTableColumns<any>>(() => {
  if (isMobile.value) {
    return [
      { type: 'selection', multiple: true },
      {
        key: 'mob',
        title: '',
        render: (row) => {
          const schedActive = row.type === 'PRERECORDED_ADVERTISEMENT' && row.schedule?.enabled === true && Array.isArray(row.schedule?.tasks) && row.schedule.tasks.length > 0
          const schedTag = schedActive
            ? h(NTag, { size: 'small', style: 'background:rgba(34,197,94,0.12);color:#22c55e;border:1px solid rgba(34,197,94,0.35);flex-shrink:0' }, { default: () => t('playlistView.scheduler_active') })
            : null
          const row1 = h('div', { class: 'mob-r1' }, [
            h('span', { class: 'mob-title' }, row.title || '-'),
            row.type ? h(NTag, { size: 'small', style: 'flex-shrink:0' }, { default: () => row.type }) : null,
            schedTag,
          ].filter(Boolean))

          const labelTags = (row.labels || []).map((l: any) => {
            const r = resolveLabel(l)
            return h(NTag, { size: 'small', style: r.color ? `background:${r.color};color:${r.fontColor || '#fff'}` : '' }, { default: () => r.name })
          })
          const row2 = labelTags.length ? h('div', { class: 'mob-r2' }, labelTags) : null

          const row3 = row.description
            ? h('div', { class: 'mob-r3' }, [h('span', { class: 'mob-meta-item mob-desc' }, row.description)])
            : null

          return h('div', { class: 'mob-card' }, [row1, row2, row3].filter(Boolean))
        },
      },
    ]
  }

  return [
    { type: 'selection', multiple: true },
    { title: t('playlistView.col_title'), key: 'title', minWidth: 200, render: (row) => row.title || '-' },
    { title: t('playlistView.col_type'), key: 'type', width: 220, render: (row) => row.type ? h(NTag, { size: 'small', style: 'max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, { default: () => t(`fragmentForm.type_${row.type.toLowerCase()}`, row.type) }) : '-' },
    {
      title: t('playlistView.col_scheduler'), key: 'schedule', width: 110,
      render: (row) => {
        const active = row.type === 'PRERECORDED_ADVERTISEMENT' && row.schedule?.enabled === true && Array.isArray(row.schedule?.tasks) && row.schedule.tasks.length > 0
        if (!active) return null
        return h(NTag, {
          size: 'small',
          style: 'background:rgba(34,197,94,0.12);color:#22c55e;border:1px solid rgba(34,197,94,0.35)',
        }, { default: () => t('playlistView.scheduler_active') })
      },
    },
    {
      title: t('playlistView.col_labels'), key: 'labels', width: 180,
      render: (row) => {
        if (!row.labels?.length) return '-'
        return h(NSpace, { size: 4, wrap: true }, {
          default: () => row.labels.map((l: any) => {
            const r = resolveLabel(l)
            return h(NTag, { size: 'small', style: r.color ? `background:${r.color};color:${r.fontColor || '#fff'}` : '' }, { default: () => r.name })
          })
        })
      }
    },
  ]
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchData(1), 400)
}

async function fetchData(page = pageNum.value, size = pageSize.value) {
  loading.value = true
  try {
    const result = await datanestApiService.getSoundAssets(page, size, searchTerm.value)
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

onMounted(async () => {
  mobileMql = window.matchMedia('(max-width: 640px)')
  isMobile.value = mobileMql.matches
  mobileMql.addEventListener('change', syncMobile)
  await loadDictionaries()
  await fetchData(1)
})

onUnmounted(() => {
  mobileMql?.removeEventListener('change', syncMobile)
  mobileMql = null
})
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" :subtitle="t('playlistView.subtitle')" :count="totalCount" />
    <ActionBar>
      <div class="playlist-action-row">
        <div class="gsap-row" style="padding-left:0">
          <GsapButton type="primary" @click="router.push('/sound-library/sound-assets/new')">
            <span>{{ t('menu.sound_assets_new') }}</span>
          </GsapButton>
          <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
            <template #trigger>
              <GsapButton type="error" :disabled="selectedIds.length === 0">
                <span>{{ t('playlistView.delete_btn', { count: selectedIds.length }) }}</span>
              </GsapButton>
            </template>
            {{ t('playlistView.delete_confirm', { count: selectedIds.length }) }}
          </NPopconfirm>
          <NButton quaternary circle size="small" style="opacity:0.5" @click="fetchData()">
            <template #icon><NIcon :component="RefreshOutline" /></template>
          </NButton>
        </div>
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
      :row-props="(row: any) => ({
        style: 'cursor:pointer',
        onClick: (e: MouseEvent) => {
          if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return
          router.push(`/sound-library/sound-assets/${row.slugName}`)
        }
      })"
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
