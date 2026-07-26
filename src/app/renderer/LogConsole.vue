<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

/** @type {import('vue').Ref<import('../../shared/types/knowledgeworks').KnowledgeWorksLogEntry[]>} */
const logs = ref([])
/** @type {import('vue').Ref<HTMLElement | null>} */
const consoleBody = ref(null)
/** @type {undefined | (() => void)} */
let unsubscribeLogs

const hasLogs = computed(() => logs.value.length > 0)

/**
 * Scrolls the console to the latest log after Vue flushes DOM updates.
 *
 * @returns {Promise<void>}
 */
async function scrollToBottom() {
  await nextTick()

  if (consoleBody.value) {
    consoleBody.value.scrollTop = consoleBody.value.scrollHeight
  }
}

/**
 * Replaces the visible logs with entries from the shared Electron log store.
 *
 * @param {import('../../shared/types/knowledgeworks').KnowledgeWorksLogEntry[]} nextLogs
 */
function setLogs(nextLogs) {
  logs.value = nextLogs
  scrollToBottom()
}

/**
 * Loads the current log history when the console window opens.
 *
 * @returns {Promise<void>}
 */
async function loadLogs() {
  setLogs(await window.knowledgeworks.getLogs())
}

/**
 * Clears logs from the shared Electron log store.
 *
 * @returns {Promise<void>}
 */
async function clearLogs() {
  await window.knowledgeworks.clearLogs()
}

/**
 * Formats the log level for terminal-style display.
 *
 * @param {import('../../shared/types/knowledgeworks').KnowledgeWorksLogLevel} level
 * @returns {string}
 */
function getLevelLabel(level) {
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
