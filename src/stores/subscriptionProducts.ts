import { defineStore } from 'pinia'
import { ref } from 'vue'
import nivaroApiService from '@/services/nivaroApi'
import type { SubscriptionProductEntry } from '@/services/coreApi'

export const useSubscriptionProductsStore = defineStore('subscriptionProducts', () => {
  const products = ref<SubscriptionProductEntry[]>([])
  const loading = ref(false)
  const totalCount = ref(0)
  const pageNum = ref(1)
  const pageSize = ref(10)
  const maxPage = ref(1)

  async function loadProducts(page = pageNum.value, size = pageSize.value) {
    loading.value = true
    try {
      const result = await nivaroApiService.getSubscriptionProducts(page, size)
      products.value = result.entries
      totalCount.value = result.count
      pageNum.value = result.pageNum
      pageSize.value = result.pageSize
      maxPage.value = result.maxPage
    } catch (error) {
      console.error('Failed to load subscription products:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  return {
    products,
    loading,
    totalCount,
    pageNum,
    pageSize,
    maxPage,
    loadProducts,
  }
})
