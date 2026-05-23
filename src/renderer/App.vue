<script setup>
import { computed, ref } from 'vue'

const linkCount = ref(null)
const pdfCount = ref(null)
const processedCount = ref(null)
const status = ref('')
const busyAction = ref('')
const errorMessage = ref('')

const isBusy = computed(() => busyAction.value !== '')
const linkLabel = computed(() => {
  return linkCount.value === 1 ? 'Link' : 'Links'
})
const currentMessage = computed(() => errorMessage.value || status.value)

async function runAction(name, action, successMessage) {
  busyAction.value = name
  errorMessage.value = ''
  status.value = name

  try {
    const result = await action()

    if (result?.count !== undefined) {
      linkCount.value = result.count
    }

    if (result?.pdfCount !== undefined) {
      pdfCount.value = result.pdfCount
    }

    if (result?.processedCount !== undefined) {
      processedCount.value = result.processedCount
    }

    status.value = successMessage(result)
  } catch (error) {
    errorMessage.value = error.message
    status.value = 'Needs attention'
  } finally {
    busyAction.value = ''
  }
}

function launchBrowser() {
  return runAction(
    'Opening browser',
    () => window.sessionjack.launchBrowser(),
    () => 'Browser open',
  )
}

function refreshLinkCount() {
  return runAction(
    'Counting links',
    () => window.sessionjack.getLinkCount(),
    result => `${result.pdfCount} PDF links found`,
  )
}

function runMediaLinking() {
  return runAction(
    'Running script',
    () => window.sessionjack.runMediaLinking(),
    result => `Inserted ${result.processedCount} PDF links`,
  )
}

function closeToolbar() {
  window.sessionjack.closeToolbar()
}
</script>

<template>
  <main class="toolbar-shell app-dark">
    <section class="toolbar" aria-label="Sessionjack toolbar">
      <div class="brand" aria-label="Asset Express">
        <span class="brand-mark">ASX</span>
      </div>

      <Button
        v-tooltip.bottom="'Launch controlled browser'"
        icon="pi pi-external-link"
        severity="secondary"
        text
        :loading="busyAction === 'Opening browser'"
        aria-label="Launch browser"
        @click="launchBrowser"
      />

      <Button
        v-tooltip.bottom="'Run media-linking script'"
        icon="pi pi-play"
        severity="secondary"
        text
        :loading="busyAction === 'Running script'"
        aria-label="Run media linking script"
        @click="runMediaLinking"
      />

      <button
        v-tooltip.bottom="'Refresh link count'"
        class="link-counter"
        type="button"
        :disabled="isBusy"
        @click="refreshLinkCount"
      >
        <span class="counter-number">{{ linkCount ?? '--' }}</span>
        <span class="counter-label">{{ linkLabel }}</span>
      </button>

      <div class="divider" aria-hidden="true" />

      <Button
        v-tooltip.bottom="'Close toolbar'"
        icon="pi pi-times"
        severity="secondary"
        text
        aria-label="Close toolbar"
        @click="closeToolbar"
      />
    </section>

    <section class="status-panel" :class="{ error: errorMessage }" aria-live="polite">
      <div v-if="currentMessage" class="status-message">
        <span>{{ currentMessage }}</span>
      </div>

      <dl class="status-metrics">
        <div>
          <dt>PDF</dt>
          <dd>{{ pdfCount ?? '--' }}</dd>
        </div>
        <div>
          <dt>Done</dt>
          <dd>{{ processedCount ?? '--' }}</dd>
        </div>
      </dl>
    </section>
  </main>
</template>
