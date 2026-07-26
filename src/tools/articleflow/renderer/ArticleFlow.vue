<script setup lang="ts">
type ArticleFlowAvailability = 'unavailable'

const availability: ArticleFlowAvailability = 'unavailable'
</script>

<template>
  <main class="article-flow-shell app-dark">
    <header class="article-flow-header">
      <span class="article-flow-mark" aria-hidden="true">AF</span>
      <strong>ArticleFlow</strong>
    </header>

    <section class="article-flow-status" :data-availability="availability">
      <i class="pi pi-lock" aria-hidden="true" />
      <div>
        <strong>Not available yet</strong>
        <span>ArticleFlow is being prepared for a future KnowledgeWorks release.</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.article-flow-shell {
  display: grid;
  grid-template-rows: 58px 1fr;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #111418;
  color: #f6f7f8;
}

.article-flow-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid rgb(255 255 255 / 10%);
  background: #171b20;
}

.article-flow-header strong {
  font-size: 0.88rem;
  font-weight: 750;
}

.article-flow-mark {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  color: #e8eef7;
  border-radius: 8px;
  background: #395f88;
  font-size: 0.78rem;
  font-weight: 850;
  line-height: 1;
}

.article-flow-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px;
  padding: 14px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  background: rgb(255 255 255 / 4%);
}

.article-flow-status > i {
  color: #6f99c6;
  font-size: 1.2rem;
}

.article-flow-status div {
  display: grid;
  gap: 4px;
}

.article-flow-status strong {
  font-size: 0.8rem;
  font-weight: 750;
}

.article-flow-status span {
  color: rgb(255 255 255 / 56%);
  font-size: 0.68rem;
  line-height: 1.35;
}
</style>
