<script setup>
import { withBase } from 'vitepress'
import { ref, computed } from 'vue'
import { exampleCatalog, exampleHref } from '../example-catalog.mjs'
const libraries={cad:'CAD',gpu:'GPU',viewer:'Viewer',physics:'Physics'}
const purposes={api:'Library API',language:'Language',integration:'Integrated workflow'}
const library=ref('all'),purpose=ref('all'),query=ref('')
const entries=Object.entries(exampleCatalog)
const matches=computed(()=>entries.filter(([,entry])=>
 (library.value==='all'||entry.library===library.value)&&
 (purpose.value==='all'||entry.category===purpose.value)&&
 [entry.label,entry.summary,libraries[entry.library],purposes[entry.category],entry.language||''].join(' ').toLowerCase().includes(query.value.trim().toLowerCase())))
function clear(){library.value='all';purpose.value='all';query.value=''}
</script>
<template>
<section class="example-catalog" aria-label="Example catalog">
 <nav class="catalog-views" aria-label="Ways to browse examples">
  <a :href="withBase('/examples/library')"><img :src="withBase('/examples/viewer-panel.png')" alt="A native CAD model shown in the Viewer panel"/><strong>By library</strong><span>Choose a library, then open its language, API or workflow examples.</span></a>
  <a :href="withBase('/examples/language')"><img :src="withBase('/examples/advanced-shader.png')" alt="Neon plasma rendered from a complete GPU shader"/><strong>Language practice</strong><span>Learn model declarations, scene syntax and material expressions.</span></a>
  <a :href="withBase('/examples/integration')"><img :src="withBase('/examples/cad-surface.png')" alt="A sampled CAD surface displayed by the GPU renderer"/><strong>Integrated workflows</strong><span>Follow native data through multiple public libraries.</span></a>
 </nav>
 <div class="catalog-filters">
  <label>Library<select v-model="library" aria-label="Catalog library"><option value="all">All libraries</option><option v-for="(name,key) in libraries" :key="key" :value="key">{{name}}</option></select></label>
  <label>Purpose<select v-model="purpose" aria-label="Catalog purpose"><option value="all">All purposes</option><option v-for="(name,key) in purposes" :key="key" :value="key">{{name}}</option></select></label>
  <label>Find an example<input v-model="query" aria-label="Find an example" type="search" placeholder="Shader, surface, parameter…"/></label>
 </div>
 <p class="catalog-count" role="status">{{matches.length}} of {{entries.length}} runnable examples</p>
 <ul class="catalog-list">
  <li v-for="[key,entry] in matches" :key="key">
   <div><a class="catalog-title" :href="withBase(exampleHref(key))">{{entry.label}}</a><p class="catalog-meta">{{libraries[entry.library]}} · {{purposes[entry.category]}}</p><p>{{entry.summary}}</p></div>
   <div class="catalog-actions"><a :href="withBase(exampleHref(key))">Run example</a><a :href="withBase(entry.guide)">Read guide</a></div>
  </li>
 </ul>
 <div v-if="!matches.length" class="catalog-empty"><p>No examples match these filters.</p><button @click="clear">Clear filters</button></div>
</section>
</template>
<style>
.VPDoc:has(.example-catalog) .aside{display:none!important}
.VPDoc:has(.example-catalog) .container{max-width:1200px!important}
.VPDoc:has(.example-catalog) .content{width:100%;max-width:none!important;padding:0!important}
.VPDoc:has(.example-catalog) .content-container{max-width:none!important}
</style>
<style scoped>
.catalog-views{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:24px 0 32px}.catalog-views a{display:flex;flex-direction:column;gap:10px;color:var(--vp-c-text-1);text-decoration:none}.catalog-views img{width:100%;aspect-ratio:8/5;object-fit:cover;border-radius:6px}.catalog-views strong{font-size:20px}.catalog-views span{font-size:14px;line-height:1.6;color:var(--vp-c-text-2)}.catalog-filters{display:grid;grid-template-columns:1fr 1fr 2fr;gap:16px}.catalog-filters label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600}.catalog-filters select,.catalog-filters input{width:100%;min-width:0;padding:8px 10px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg-soft)}.catalog-count{font-size:13px;color:var(--vp-c-text-2)}.catalog-list{list-style:none;padding:0;margin:0}.catalog-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;border-top:1px solid var(--vp-c-divider);padding:20px 0;margin:0}.catalog-list p{margin:6px 0;font-size:14px;line-height:1.6}.catalog-title{font-size:18px;font-weight:600}.catalog-list .catalog-meta{font-size:12px;color:var(--vp-c-text-2)}.catalog-actions{display:flex;gap:18px;align-items:center;font-size:14px}.catalog-empty{padding:24px 0}.catalog-empty button{padding:7px 12px;background:var(--vp-c-bg-soft);border:1px solid var(--vp-c-divider);border-radius:6px}@media(max-width:760px){.catalog-views{grid-template-columns:1fr;gap:24px}.catalog-views a{display:grid;grid-template-columns:110px minmax(0,1fr);column-gap:16px;row-gap:4px}.catalog-views img{grid-row:1/3}.catalog-views strong{font-size:18px}.catalog-views span{font-size:13px}.catalog-filters{grid-template-columns:1fr}.catalog-list li{grid-template-columns:1fr;gap:8px}.catalog-actions{justify-content:flex-start}}
</style>
