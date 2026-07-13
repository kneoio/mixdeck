<template>
  <NPopover trigger="click" placement="bottom-end" :width="260">
    <template #trigger>
      <NButton circle quaternary :title="t('theme.accent')">
        <template #icon>
          <NIcon>
            <ColorPaletteIcon />
          </NIcon>
        </template>
      </NButton>
    </template>

    <div class="accent-picker">
      <div class="accent-picker__label">{{ t('theme.presets') }}</div>
      <div class="accent-picker__swatches">
        <button
          v-for="preset in ACCENT_PRESETS"
          :key="preset.color"
          type="button"
          class="accent-picker__swatch"
          :class="{ 'accent-picker__swatch--active': isActive(preset.color) }"
          :style="{ background: preset.color }"
          :title="preset.name"
          @click="themeStore.setAccent(preset.color)"
        />
      </div>

      <NButton block secondary size="small" class="accent-picker__generate" @click="themeStore.generateAccent">
        <template #icon>
          <NIcon><SparklesIcon /></NIcon>
        </template>
        {{ t('theme.generate') }}
      </NButton>

      <NButton
        block
        quaternary
        size="small"
        :disabled="themeStore.isDefaultAccent"
        @click="themeStore.resetAccent"
      >
        <template #icon>
          <NIcon><ResetIcon /></NIcon>
        </template>
        {{ t('theme.reset') }}
      </NButton>
    </div>
  </NPopover>
</template>

<script setup lang="ts">
import { NPopover, NButton, NIcon } from 'naive-ui'
import {
  ColorPaletteOutline as ColorPaletteIcon,
  SparklesOutline as SparklesIcon,
  RefreshOutline as ResetIcon,
} from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import { ACCENT_PRESETS } from '@/utils/harmonicPalette'

const { t } = useI18n()
const themeStore = useThemeStore()

const isActive = (color: string) =>
  themeStore.accentColor.toLowerCase() === color.toLowerCase()
</script>

<style scoped>
.accent-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.accent-picker__label {
  font-size: 12px;
  opacity: 0.65;
}

.accent-picker__swatches {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
}

.accent-picker__swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.accent-picker__swatch:hover {
  transform: scale(1.1);
}

.accent-picker__swatch--active {
  border-color: var(--color-text, currentColor);
  box-shadow: 0 0 0 2px var(--color-background, #fff);
}

.accent-picker__generate {
  margin-top: 2px;
}
</style>
