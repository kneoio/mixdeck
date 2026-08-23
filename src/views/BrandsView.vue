<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { NDataTable, type DataTableColumns } from 'naive-ui'
import { useBrandsStore } from '@/stores/brands'
import PageHeader from '@/components/PageHeader.vue'
import ActionBar from '@/components/ActionBar.vue'
import GsapButton from '@/components/GsapButton.vue'

const { t } = useI18n()
const router = useRouter()
const brandsStore = useBrandsStore()

const brandLabel = (brand: any) =>
  brand.localizedName?.['en'] || brand.title || brand.slugName || ''

const columns = computed<DataTableColumns<any>>(() => [
  {
    title: t('brandsView.col_name'), key: 'name', minWidth: 200,
    render: (row) => brandLabel(row),
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
      <GsapButton type="primary" @click="router.push('/brands/new')">
        <span>{{ t('menu.add_new') }}</span>
      </GsapButton>
    </ActionBar>
    <NDataTable
      :columns="columns"
      :data="brandsStore.brands"
      :row-key="(row: any) => row.slugName"
      :row-props="(row: any) => ({ style: 'cursor:pointer', onClick: () => goSettings(row) })"
    />
  </div>
</template>
