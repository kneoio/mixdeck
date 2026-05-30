<template>
  <CodeMirror
    ref="cmRef"
    :model-value="modelValue"
    @update:model-value="(val) => emit('update:modelValue', typeof val === 'string' ? val : '')"
    basic
    :disabled="false"
    :style="{ width: '100%', minHeight: '80px', border: '1px solid ' + (dark ? '#333' : '#e0e0e0'), borderRadius: '3px', fontSize: '0.8rem' }"
    :extensions="extensions"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EditorView } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { handlebarsLanguage } from '@xiechao/codemirror-lang-handlebars'
import CodeMirror from 'vue-codemirror6'

const props = defineProps<{
  modelValue: string
  dark?: boolean
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const cmRef = ref<any>(null)

function insertText(text: string) {
  const view: EditorView | undefined = cmRef.value?.view
  if (!view) return
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
  })
  view.focus()
}

defineExpose({ insertText })

const handlebarsBraces = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.tagName, color: '#f5a623' },
]))

const extensions = computed(() => [
  handlebarsLanguage,
  handlebarsBraces,
  EditorView.lineWrapping,
  EditorView.theme({
    '.cm-gutters': { display: 'none' },
    '&': { background: 'transparent' },
    '.cm-scroller': { background: 'transparent' },
    '.cm-content': { background: 'transparent' },
    '.cm-activeLine': { background: 'transparent' },
  }),
])
</script>
