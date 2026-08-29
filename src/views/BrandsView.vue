<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NDataTable, NPopconfirm, NButton, NIcon, useMessage, type DataTableColumns } from 'naive-ui'
import { RefreshOutline, CheckmarkCircle } from '@vicons/ionicons5'
import { useBrandsStore, type Brand } from '@/stores/brands'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()
const router = useRouter()
const brandsStore = useBrandsStore()
const message = useMessage()
const selectedIds = ref<string[]>([])
const deleting = ref(false)

const brandLabel = (brand: Brand) =>
  brand.localizedName?.['en'] || brand.title || brand.slugName || ''

function ownerLabel(row: Brand) {
  const raw = row.owner as unknown
  if (typeof raw === 'string') return raw
  return (raw as { name?: string } | undefined)?.name || row.ownerEmail || ''
}

function renderPublicCell(row: Brand) {
  if (row.publicBrand === 0) return ''
  return h(NIcon, { component: CheckmarkCircle, color: '#16a34a', size: 18 })
}

function renderColorCell(row: Brand) {
  if (!row.color) return ''
  return h('span', {
    style: {
      display: 'inline-block',
      width: '18px',
      height: '18px',
      borderRadius: '4px',
      backgroundColor: row.color,
      border: '1px solid rgba(128,128,128,0.3)',
      verticalAlign: 'middle',
    },
  })
}

async function handleDelete() {
  if (!selectedIds.value.length) return
  deleting.value = true
  try {
    await Promise.all(selectedIds.value.map(slug => brandsStore.closeBrand(slug)))
    message.success(t('brandsView.deleted', { count: selectedIds.value.length }))
    selectedIds.value = []
    await brandsStore.loadBrands()
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    deleting.value = false
  }
}

const columns = computed<DataTableColumns<Brand>>(() => [
  { type: 'selection', multiple: true },
  {
    title: t('brandsView.col_name'), key: 'name', minWidth: 200,
    render: (row) => brandLabel(row),
  },
  {
    title: t('brandsView.col_country'), key: 'country', width: 100,
    render: (row) => row.country || '',
  },
  {
    title: t('brandsView.col_color'), key: 'color', width: 80,
    render: renderColorCell,
  },
  {
    title: t('brandsView.col_timezone'), key: 'timeZone', minWidth: 200,
    render: (row) => row.timeZone || '',
  },
  {
    title: t('brandsView.col_public'), key: 'publicBrand', width: 80,
    render: renderPublicCell,
  },
  {
    title: t('brandsView.col_owner'), key: 'owner', minWidth: 140,
    render: ownerLabel,
  },
])

function goSettings(row: Brand) {
  if (!row.slugName) return
  router.push({ path: `/brands/${row.slugName}/settings`, query: { returnTo: '/brands' } })
}
</script>

<template>
  <div>
    <PageHeader :title="t('menu.my_brands')" :subtitle="t('brandsView.subtitle')" :count="brandsStore.brands.length" />
    <ActionBar>
      <div class="gsap-row" style="padding-left:0">
        <GsapButton type="primary" @click="router.push('/brands/new')">
          <span>{{ t('menu.add_new') }}</span>
        </GsapButton>
        <NPopconfirm @positive-click="handleDelete" :disabled="selectedIds.length === 0">
          <template #trigger>
            <GsapButton type="error" :disabled="!selectedIds.length || deleting">
              <span>{{ t('brandsView.delete_btn', { count: selectedIds.length }) }}</span>
            </GsapButton>
          </template>
          {{ t('brandsView.delete_confirm', { count: selectedIds.length }) }}
        </NPopconfirm>
        <NButton quaternary circle size="small" style="opacity:0.5" @click="brandsStore.loadBrands()">
          <template #icon><NIcon :component="RefreshOutline" /></template>
        </NButton>
      </div>
    </ActionBar>
    <NDataTable
      :columns="columns"
      :data="brandsStore.brands"
      :row-key="(row: Brand) => row.slugName"
      v-model:checked-row-keys="selectedIds"
      :row-props="(row: Brand) => ({ style: 'cursor:pointer', onClick: (e: MouseEvent) => { if ((e.target as HTMLElement).closest('.n-data-table-td--selection')) return; goSettings(row) } })"
    />
  </div>
</template>
