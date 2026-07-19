<script setup lang="ts">
import { ref, reactive, computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { NDataTable, NDropdown, NPopconfirm, NPopover, NButton, NIcon, NInput, NSpace, NTag, type DataTableColumns, type DropdownOption, type SelectOption, useMessage } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import QRCode from 'qrcode'
import { useOtsDefinitionsStore, type OtsDefinition } from '@/stores/otsDefinitions'
import { useScriptsStore } from '@/stores/scripts'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import GsapLoader from '@/components/GsapLoader.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()
const pageTitle = computed(() => `${t('menu.my_sounds')} / ${t('menu.one_time_stream')}`)
const message = useMessage()
const router = useRouter()
const otsDefinitionsStore = useOtsDefinitionsStore()
const scriptsStore = useScriptsStore()

const loading = ref(true)
const selectedIds = ref<string[]>([])
const searchTerm = ref('')

const pagination = computed(() => ({
  page: otsDefinitionsStore.pageNum,
  pageSize: otsDefinitionsStore.pageSize,
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  itemCount: otsDefinitionsStore.totalCount,
}))

function scriptName(scriptId: string): string {
  return scriptsStore.scripts.find((s) => s.id === scriptId)?.name || scriptId
}

function renderScriptOptionLabel(option: SelectOption) {
  const tags = (option as unknown as { tags?: Array<{ name?: string; identifier?: string; color?: string; fontColor?: string }> }).tags || []
  return h(
    NSpace,
    { align: 'center', size: 8, wrapItem: false },
    {
      default: () => [
        ...tags
          .filter((tag) => Boolean(tag?.name || tag?.identifier))
          .map((tag) =>
            h(
              NTag,
              { size: 'small', bordered: false, color: { color: tag.color || '#ececec', textColor: tag.fontColor || '#333333' } },
              { default: () => tag.name || tag.identifier }
            )
          ),
        h('span', String(option.label ?? option.value ?? '')),
      ],
    }
  )
}

const newStreamOptions = computed<DropdownOption[]>(() =>
  scriptsStore.scripts.map((script) => ({
    key: script.id,
    label: () => renderScriptOptionLabel({ label: script.name, value: script.id, tags: script.tags || [] } as unknown as SelectOption),
  }))
)

function onNewStreamScriptSelect(key: string) {
  router.push({ path: '/one-time-streams/new', query: { scriptId: key } })
}

const OTS_PLAYER_THEMES = ['hitachi', 'akai', '']
const otsLinks = reactive<Record<string, string>>({})
function getOtsLink(row: OtsDefinition): string {
  if (!row.slugName) return ''
  if (!otsLinks[row.id]) {
    const base = `https://mixpla.online/${row.slugName}`
    const theme = OTS_PLAYER_THEMES[Math.floor(Math.random() * OTS_PLAYER_THEMES.length)]
    otsLinks[row.id] = theme ? `${base}?theme=${theme}` : base
  }
  return otsLinks[row.id]
}

const copiedLinkId = ref<string | null>(null)
function copyLink(row: OtsDefinition) {
  const link = getOtsLink(row)
  if (!link) return
  navigator.clipboard.writeText(link)
  copiedLinkId.value = row.id
  setTimeout(() => { copiedLinkId.value = null }, 2000)
}

const qrDataUrls = reactive<Record<string, string>>({})
async function loadQr(row: OtsDefinition) {
  const link = getOtsLink(row)
  if (!link || qrDataUrls[row.id]) return
  try {
    qrDataUrls[row.id] = await QRCode.toDataURL(link, { width: 160, margin: 1 })
  } catch {
    /* leave unset; popover keeps showing the spinner */
  }
}

function renderLinkCell(row: OtsDefinition) {
  const link = getOtsLink(row)
  if (!link) return null
  const copied = copiedLinkId.value === row.id
  return h('div', { class: 'ots-link-cell', onClick: (e: MouseEvent) => e.stopPropagation() }, [
    h('a', { href: link, target: '_blank', rel: 'noopener noreferrer', class: 'ots-link-cell__link' }, link),
    h('div', { class: 'ots-link-cell__actions' }, [
      h('button', { class: ['copy-btn', copied && 'copy-btn--done'], title: t('dashboard.copy_url'), onClick: () => copyLink(row) }, [
        copied
          ? h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5 }, [h('polyline', { points: '20 6 9 17 4 12' })])
          : h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
              h('rect', { x: 9, y: 9, width: 13, height: 13, rx: 2 }),
              h('path', { d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' }),
            ]),
      ]),
      h(NPopover, { trigger: 'click', placement: 'bottom-end', 'onUpdate:show': (show: boolean) => show && loadQr(row) }, {
        trigger: () => h('button', { class: 'copy-btn', title: t('overview.ots_qr_code') }, [
          h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
            h('rect', { x: 3, y: 3, width: 7, height: 7 }),
            h('rect', { x: 14, y: 3, width: 7, height: 7 }),
            h('rect', { x: 3, y: 14, width: 7, height: 7 }),
            h('path', { d: 'M14 14h3v3h-3z' }),
            h('path', { d: 'M20 14v3' }),
            h('path', { d: 'M17 20h4' }),
          ]),
        ]),
        default: () => h('div', { class: 'ots-qr-popover' }, qrDataUrls[row.id]
          ? h('img', { src: qrDataUrls[row.id], alt: link, width: 160, height: 160 })
          : h('div', { style: 'width: 160px; height: 160px; display: flex; align-items: center; justify-content: center;' }, [h(GsapLoader, { size: 36 })])
        ),
      }),
    ]),
  ])
}

function renderFlagsCell(row: OtsDefinition) {
  return h(NSpace, { size: 4 }, {
    default: () => [
      row.status ? h(NTag, { size: 'small', bordered: false }, { default: () => row.status }) : null,
      row.type ? h(NTag, { size: 'small', bordered: false }, { default: () => row.type }) : null,
    ],
  })
}

const columns = computed<DataTableColumns<OtsDefinition>>(() => [
  { type: 'selection', multiple: true },
  { title: t('otsListView.col_name'), key: 'name', minWidth: 200, render: (row) => row.name || scriptName(row.scriptId) },
  { title: t('otsListView.col_script'), key: 'script', minWidth: 160, render: (row) => scriptName(row.scriptId) },
  { title: t('otsListView.col_flags'), key: 'flags', width: 110, render: renderFlagsCell },
  { title: t('otsListView.col_link'), key: 'link', minWidth: 320, render: renderLinkCell },
])

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchChange() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchData(1), 400)
}

async function fetchData(page = otsDefinitionsStore.pageNum, size = otsDefinitionsStore.pageSize) {
  loading.value = true
  try {
    await otsDefinitionsStore.loadOtsDefinitions(page, size, searchTerm.value ? { searchTerm: searchTerm.value } : {})
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

async function handleBulkDelete() {
  try {
    loading.value = true
    await Promise.all(selectedIds.value.map((id) => otsDefinitionsStore.deleteOtsDefinition(id)))
    message.success(t('otsListView.deleted', { count: selectedIds.value.length }))
    selectedIds.value = []
    await fetchData()
  } catch (e: any) {
    handleApiError(e, message)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (!scriptsStore.scripts.length) scriptsStore.loadScripts(1, scriptsStore.pageSize, 'timingMode=RELATIVE_TO_STREAM_START')
  await fetchData(1)
})
</script>

<template>
  <div>
    <PageHeader :title="pageTitle" :subtitle="t('otsListView.subtitle')" :count="otsDefinitionsStore.totalCount" />
    <ActionBar>
      <div class="playlist-action-row">
        <div class="gsap-row" style="padding-left:0">
          <NDropdown trigger="click" :options="newStreamOptions" :disabled="scriptsStore.loading" @select="onNewStreamScriptSelect">
            <GsapButton type="primary">
              <span>{{ t('otsListView.new_btn') }}</span>
            </GsapButton>
          </NDropdown>
          <NPopconfirm @positive-click="handleBulkDelete" :disabled="selectedIds.length === 0">
            <template #trigger>
              <GsapButton type="error" :disabled="selectedIds.length === 0">
                <span>{{ t('otsListView.delete_btn', { count: selectedIds.length }) }}</span>
              </GsapButton>
            </template>
            {{ t('otsListView.delete_confirm', { count: selectedIds.length }) }}
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
      :data="otsDefinitionsStore.otsDefinitions"
      :loading="loading"
      :row-key="(row: OtsDefinition) => row.id"
      v-model:checked-row-keys="selectedIds"
      :pagination="pagination"
      remote
      :row-props="(row: OtsDefinition) => ({
        style: 'cursor:pointer',
        onClick: (e: MouseEvent) => {
          if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return
          if ((e.target as HTMLElement).closest('.ots-link-cell')) return
          router.push(`/one-time-streams/${row.id}`)
        }
      })"
      @update:page="(p) => fetchData(p)"
      @update:page-size="(s) => fetchData(1, s)"
    >
      <template #loading><GsapLoader :size="32" /></template>
    </NDataTable>
  </div>
</template>

<style>
.ots-link-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.ots-link-cell__link {
  font-size: 0.78rem;
  opacity: 0.6;
  color: inherit;
  text-decoration: none;
  border-bottom: 1px dashed currentColor;
  white-space: normal;
  word-break: break-all;
}
.ots-link-cell__link:hover {
  opacity: 1;
}
.ots-link-cell__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.ots-link-cell .copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 4px;
  padding: 2px 5px;
  cursor: pointer;
  color: inherit;
  opacity: 0.5;
  transition: opacity 0.2s, color 0.2s, border-color 0.2s;
  line-height: 1;
  flex-shrink: 0;
}
.ots-link-cell .copy-btn:hover {
  opacity: 1;
}
.ots-link-cell .copy-btn--done {
  color: #4caf50;
  border-color: rgba(76, 175, 80, 0.4);
  opacity: 1;
}
.ots-qr-popover {
  display: flex;
  align-items: center;
  justify-content: center;
}
.ots-qr-popover img {
  display: block;
  border-radius: 4px;
}
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
