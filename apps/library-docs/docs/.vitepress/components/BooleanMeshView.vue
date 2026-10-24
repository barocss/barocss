<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { createBooleanRenderer } from './boolean-renderer.mjs';
const props = defineProps({ scene: Object, stage: Number, operation: String, yaw: Number, pitch: Number, interactive: Boolean, label: String });
const emit = defineEmits(['rotate']);
const canvas = ref(null), unavailable = ref(false);
let renderer, observer, dragging;
const render = () => renderer?.draw(props.scene, props.stage, props.operation, props.yaw, props.pitch);
onMounted(() => {
  renderer = createBooleanRenderer(canvas.value);
  unavailable.value = !renderer;
  if (renderer) { observer = new ResizeObserver(render); observer.observe(canvas.value); render(); }
});
watch(() => [props.scene, props.stage, props.operation, props.yaw, props.pitch], render);
onBeforeUnmount(() => { observer?.disconnect(); renderer?.dispose(); });
function down(e) {
  if (!props.interactive) return;
  dragging = { x: e.clientX, y: e.clientY, yaw: props.yaw, pitch: props.pitch };
  canvas.value.setPointerCapture(e.pointerId);
}
function move(e) {
  if (!dragging) return;
  emit('rotate', [dragging.yaw + (e.clientX - dragging.x) * 0.009, Math.max(-1.5, Math.min(-0.15, dragging.pitch + (e.clientY - dragging.y) * 0.009))]);
}
function key(e) {
  const turns = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] };
  if (!props.interactive || !turns[e.key]) return;
  e.preventDefault(); const [a, b] = turns[e.key];
  emit('rotate', [props.yaw + a, Math.max(-1.5, Math.min(-0.15, props.pitch + b))]);
}
</script>
<template>
  <div class="mesh-view">
    <canvas ref="canvas" :aria-label="label" role="img" :tabindex="interactive ? 0 : undefined"
      :class="{ interactive }" @pointerdown="down" @pointermove="move" @pointerup="dragging = null"
      @pointercancel="dragging = null" @lostpointercapture="dragging = null" @keydown="key">
      {{ label }}. The same shapes, dimensions and volume are given in the adjacent text.
    </canvas>
    <p v-if="unavailable" class="fallback">3D display is unavailable in this browser. Read the stage descriptions and numerical result below.</p>
  </div>
</template>
<style scoped>
.mesh-view { position: relative; width: 100%; height: 100%; min-height: 0; background: #0e1421; }
canvas { display: block; width: 100%; height: 100%; }
canvas.interactive { cursor: grab; touch-action: none; }
canvas.interactive:active { cursor: grabbing; }
canvas:focus-visible { outline: 3px solid #80baff; outline-offset: -4px; }
.fallback { position: absolute; inset: 8%; color: #fff; font-size: 13px; }
</style>
