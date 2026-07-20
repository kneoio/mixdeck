<template>
  <svg
      class="mixpla-loader"
      :style="{ '--size': size + 'px' }"
      viewBox="0 0 120 60"
  >
    <line
        v-for="(e, i) in edges"
        :key="'e'+i"
        :x1="nodes[e[0]].x"
        :y1="nodes[e[0]].y"
        :x2="nodes[e[1]].x"
        :y2="nodes[e[1]].y"
        class="edge"
    />

    <circle
        v-for="(n, i) in nodes"
        :key="'n'+i"
        :cx="n.x"
        :cy="n.y"
        :r="i === activeNode ? 4 : 2.6"
        :class="['node', i === activeNode && 'active']"
    />

    <circle
        ref="pulseRef"
        r="2.8"
        class="pulse"
    />
  </svg>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import gsap from 'gsap'

withDefaults(defineProps<{ size?: number }>(), {
  size: 48
})

const nodes = [
  { x: 12, y: 30 },
  { x: 32, y: 15 },
  { x: 32, y: 45 },
  { x: 60, y: 30 },
  { x: 88, y: 15 },
  { x: 88, y: 45 },
  { x: 108, y: 30 }
]

const edges = [
  [0,1],[0,2],
  [1,3],[2,3],
  [3,4],[3,5],
  [4,6],[5,6]
]

const pulseRef = ref()
const activeNode = ref(0)

let edge = 0
let progress = 0
let tick

onMounted(() => {
  const pulse = pulseRef.value

  tick = () => {
    progress += 0.018

    if (progress >= 1) {
      progress = 0
      edge = (edge + 1) % edges.length
      activeNode.value = edges[edge][1]
    }

    const a = nodes[edges[edge][0]]
    const b = nodes[edges[edge][1]]

    pulse.setAttribute("cx", (a.x + (b.x-a.x)*progress).toString())
    pulse.setAttribute("cy", (a.y + (b.y-a.y)*progress).toString())
  }

  gsap.ticker.add(tick)
})

onBeforeUnmount(() => {
  gsap.ticker.remove(tick)
})
</script>

<style scoped>
.mixpla-loader{
  width:calc(var(--size) * 2.2);
  height:var(--size);
}

.edge{
  stroke:#6b4cff66;
  stroke-width:1.6;
}

.node{
  fill:#7c3aed;
  transition:.25s;
}

.node.active{
  fill:#ff2d95;
  filter:drop-shadow(0 0 6px #ff2d95);
}

.pulse{
  fill:white;
  filter:drop-shadow(0 0 5px white);
}
</style>