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
import { EditorView, MatchDecorator, ViewPlugin, Decoration } from '@codemirror/view'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { handlebarsLanguage } from '@xiechao/codemirror-lang-handlebars'
import CodeMirror from 'vue-codemirror6'

const JESOOS_HELPERS = ['random', 'contains']

const helperMark = Decoration.mark({ class: 'cm-jesoos-helper' })
const helperDecorator = new MatchDecorator({
  regexp: new RegExp(`\\{\\{~?\\s*(${JESOOS_HELPERS.join('|')})(?=[\\s}~])`, 'g'),
  decorate: (add, from, _to, match) => {
    const nameStart = from + match[0].length - match[1].length
    add(nameStart, nameStart + match[1].length, helperMark)
  },
  boundary: /\S/,
})

const jesoosHelperPlugin = ViewPlugin.fromClass(
  class {
    decorations: any
    constructor(view: EditorView) { this.decorations = helperDecorator.createDeco(view) }
    update(update: any) { this.decorations = helperDecorator.updateDeco(update, this.decorations) }
  },
  { decorations: (v: any) => v.decorations },
)

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
  { tag: tags.keyword, class: 'cm-jesoos-helper' },
]))

const extensions = computed(() => [
  handlebarsLanguage,
  handlebarsBraces,
  jesoosHelperPlugin,
  EditorView.lineWrapping,
  EditorView.theme({
    '.cm-gutters': { display: 'none' },
    '&': { background: 'transparent' },
    '.cm-scroller': { background: 'transparent' },
    '.cm-content': { background: 'transparent' },
    '.cm-activeLine': { background: 'transparent' },
    '.cm-cursor': { borderLeftWidth: '2px', borderLeftColor: props.dark ? '#eff605' : '#7C3AED', boxShadow: props.dark ? '0 0 6px #eff605' : 'none' },
    '.cm-jesoos-helper': { color: props.dark ? '#5dac30' : '#284e03' },
  }),
])
</script>
