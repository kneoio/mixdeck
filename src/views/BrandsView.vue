<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NDataTable, NPopconfirm, NButton, NIcon, NTag, NSpace, useMessage, type DataTableColumns } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { useBrandsStore, SUBMISSION_POLICY_OPTIONS, type Brand } from '@/stores/brands'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()
const router = useRouter()
const brandsStore = useBrandsStore()
const message = useMessage()
const closingSlug = ref<string | null>(null)

const brandLabel = (brand: Brand) =>
  brand.localizedName?.['en'] || brand.title || brand.slugName || ''

function policyLabel(value?: string) {
  return SUBMISSION_POLICY_OPTIONS.find(o => o.value === value)?.label ?? value ?? ''
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

function renderFlagsCell(row: Brand) {
  const flags = [
    { label: t('brandForm.accept_shared_sounds'), value: row.submissionPolicy },
    { label: t('brandForm.chat_with_dj'), value: row.messagingPolicy },
    { label: t('brandForm.one_time_stream'), value: row.oneTimeStreamPolicy },
  ].filter(f => f.value)
  return h(NSpace, { size: 4, wrap: true }, {
    default: () => flags.map(f => h(NTag, {
      size: 'small',
      bordered: false,
      type: f.value === 'NO_RESTRICTIONS' ? 'success' : f.value === 'REVIEW_REQUIRED' ? 'warning' : 'default',
    }, { default: () => `${f.label}: ${policyLabel(f.value)}` })),
  })
}

async function handleCloseBrand(row: any) {
  if (!row.slugName) return
  try {
    closingSlug.value = row.slugName
    await brandsStore.closeBrand(row.slugName)
    message.success('Brand closed successfully')
    await brandsStore.loadBrands()
  } catch (error: any) {
    handleApiError(error, message)
  } finally {
    closingSlug.value = null
  }
}

const columns = computed<DataTableColumns<Brand>>(() => [
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
    title: t('brandsView.col_flags'), key: 'flags', minWidth: 280,
    render: renderFlagsCell,
  },
  {
    key: 'actions',
    width: 160,
    render: (row) => h('div', {
      onClick: (e: MouseEvent) => e.stopPropagation(),
      onMousedown: (e: MouseEvent) => e.stopPropagation(),
    }, [
      h(NPopconfirm, {
        disabled: !!closingSlug.value,
        onPositiveClick: () => handleCloseBrand(row),
      }, {
        trigger: () => h(GsapButton, {
          type: 'error',
          disabled: !!closingSlug.value,
        }, { default: () => h('span', t('brandForm.close_brand')) }),
        default: () => t('brandForm.close_brand_confirm'),
      }),
    ]),
  },
])

function goSettings(row: any) {
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
        <NButton quaternary circle size="small" style="opacity:0.5" @click="brandsStore.loadBrands()">
          <template #icon><NIcon :component="RefreshOutline" /></template>
        </NButton>
      </div>
    </ActionBar>
    <NDataTable
      :columns="columns"
      :data="brandsStore.brands"
      :row-key="(row: any) => row.slugName"
      :row-props="(row: any) => ({ style: 'cursor:pointer', onClick: () => goSettings(row) })"
    />
  </div>
</template>
