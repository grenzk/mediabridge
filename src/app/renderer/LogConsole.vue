<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { KnowledgeWorksLogEntry, KnowledgeWorksLogLevel } from '../../shared/types/knowledgeworks'

const logs = ref<KnowledgeWorksLogEntry[]>([])
const consoleBody = ref<HTMLElement | null>(null)
let unsubscribeLogs: (() => void) | undefined

const hasLogs = computed(() => logs.value.length > 0)

/**
 * Scrolls the console to the latest log after Vue flushes DOM updates.
 */
async function scrollToBottom() {
  await nextTick()

  if (consoleBody.value) {
    consoleBody.value.scrollTop = consoleBody.value.scrollHeight
  }
}

/**
 * Replaces the visible logs with entries from the shared Electron log store.
 */
function setLogs(nextLogs: KnowledgeWorksLogEntry[]) {
  logs.value = nextLogs
  void scrollToBottom()
}

/**
 * Loads the current log history when the console window opens.
 */
async function loadLogs() {
  setLogs(await window.knowledgeworks.getLogs())
}

/**
 * Clears logs from the shared Electron log store.
 */
async function clearLogs() {
  await window.knowledgeworks.clearLogs()
}

/**
 * Formats the log level for terminal-style display.
 */
function getLevelLabel(level: KnowledgeWorksLogLevel) {
  return level.toUpperCase()
}

onMounted(async () => {
  await loadLogs()
  unsubscribeLogs = window.knowledgeworks.onLogsUpdated(setLogs)
})

onBeforeUnmount(() => {
  unsubscribeLogs?.()
})
</script>

<template>
  <main class="log-window app-dark">
    <section ref="consoleBody" class="log-console" aria-live="polite">
      <Button
        v-tooltip.top="'Clear logs'"
        class="log-clear-button"
        icon="pi pi-trash"
        severity="secondary"
        text
        aria-label="Clear logs"
        :disabled="!hasLogs"
        @click="clearLogs"
      />

      <p v-if="!hasLogs" class="log-empty">No logs yet. Run an action in KnowledgeWorks to start capturing output.</p>

      <article v-for="entry in logs" v-else :key="entry.id" class="log-entry" :class="entry.level">
        <div class="log-entry-line">
          <span class="log-time">{{ entry.timestamp }}</span>
          <span class="log-level">{{ getLevelLabel(entry.level) }}</span>
          <span class="log-scope">{{ entry.scope }}:</span>
          <span class="log-message">{{ entry.message }}</span>
        </div>

        <pre v-if="entry.detail" class="log-detail">{{ entry.detail }}</pre>
      </article>
    </section>
  </main>
</template>

<style scoped>
.log-window {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  color: var(--kw-text-light);
  background: var(--kw-canvas);
}

:deep(.log-clear-button.p-button) {
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 2;
  width: 44px;
  height: 44px;
  color: var(--kw-text-light) !important;
  border: 1px solid var(--kw-border) !important;
  border-radius: 8px;
  background: var(--kw-surface) !important;
  box-shadow: 0 6px 18px rgb(0 0 0 / 28%);
}

:deep(.log-clear-button.p-button:hover) {
  border-color: var(--kw-text-muted) !important;
  background: var(--kw-surface-hover) !important;
}

:deep(.log-clear-button.p-button:focus-visible) {
  outline: 2px solid var(--kw-focus);
  outline-offset: 2px;
}

:deep(.log-clear-button.p-button:disabled) {
  color: var(--kw-text-disabled) !important;
  opacity: 1;
}

.log-console {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 20px 20px 80px;
  background: var(--kw-canvas);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  scrollbar-color: var(--kw-border) var(--kw-canvas);
}

.log-empty {
  margin: 0;
  color: var(--kw-text-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}

.log-entry {
  padding: 10px 0;
  border-bottom: 1px solid var(--kw-border-subtle);
}

.log-entry-line {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
  color: var(--kw-text-light);
  font-size: 0.78rem;
  line-height: 1.45;
}

.log-time {
  flex: 0 0 auto;
  color: var(--kw-text-muted);
  font-size: 0.72rem;
}

.log-level {
  flex: 0 0 auto;
  color: var(--kw-focus);
  font-weight: 700;
}

.log-entry.error .log-level {
  color: var(--kw-danger);
}

.log-entry.success .log-level {
  color: var(--kw-success);
}

.log-scope {
  flex: 0 0 auto;
  color: var(--kw-text-muted);
  font-weight: 700;
}

.log-message {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--kw-text-light);
}

.log-detail {
  margin: 5px 0 0;
  padding-left: 12px;
  overflow-x: auto;
  color: var(--kw-text-muted);
  border-left: 2px solid var(--kw-border-subtle);
  font: inherit;
  font-size: 0.72rem;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>
