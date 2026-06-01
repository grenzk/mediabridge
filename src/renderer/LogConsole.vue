<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const logs = ref([])
const consoleBody = ref(null)
let unsubscribeLogs

const hasLogs = computed(() => logs.value.length > 0)

async function scrollToBottom() {
  await nextTick()

  if (consoleBody.value) {
    consoleBody.value.scrollTop = consoleBody.value.scrollHeight
  }
}

function setLogs(nextLogs) {
  logs.value = nextLogs
  scrollToBottom()
}

async function loadLogs() {
  setLogs(await window.mediabridge.getLogs())
}

async function clearLogs() {
  await window.mediabridge.clearLogs()
}

function getLevelLabel(level) {
  return level.toUpperCase()
}

onMounted(async () => {
  await loadLogs()
  unsubscribeLogs = window.mediabridge.onLogsUpdated(setLogs)
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

      <p v-if="!hasLogs" class="log-empty">
        No logs yet. Run an action from the toolbar to start capturing output.
      </p>

      <article
        v-for="entry in logs"
        v-else
        :key="entry.id"
        class="log-entry"
        :class="entry.level"
      >
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
