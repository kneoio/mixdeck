<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NDataTable, NPopconfirm, NButton, NIcon, useMessage, type DataTableColumns } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { useBrandsStore } from '@/stores/brands'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'
import { handleApiError } from '@/utils/notificationService'

const { t } = useI18n()
const router = useRouter()
const brandsStore = useBrandsStore()
const message = useMessage()
const closingSlug = ref<string | null>(null)

const brandLabel = (brand: any) =>
  brand.localizedName?.['en'] || brand.title || brand.slugName || ''

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

const columns = computed<DataTableColumns<any>>(() => [
  {
    title: t('brandsView.col_name'), key: 'name', minWidth: 200,
    render: (row) => brandLabel(row),
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
