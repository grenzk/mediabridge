<script setup>
import { computed, ref } from 'vue'

const linkCount = ref(null)
const pdfCount = ref(null)
const processedCount = ref(null)
const status = ref('')
const busyAction = ref('')
const errorMessage = ref('')
const selectedLinkingType = ref('pdf')

const linkingTypes = {
  pdf: { label: 'PDF', statusLabel: 'PDF' },
  xls: { label: 'XLS', statusLabel: 'XLS' },
  docs: { label: 'Docs', statusLabel: 'Docs' },
  article: { label: 'Article', statusLabel: 'Article' },
}

const isBusy = computed(() => busyAction.value !== '')
const linkLabel = computed(() => {
  return linkCount.value === 1 ? 'Link' : 'Links'
})
const currentMessage = computed(() => errorMessage.value || status.value)
const selectedLinkingTypeConfig = computed(
  () => linkingTypes[selectedLinkingType.value],
)
const linkingOptions = computed(() =>
  Object.entries(linkingTypes).map(([value, item]) => ({
    value,
    label: item.label,
  })),
)

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
  if (selectedLinkingType.value !== 'pdf') {
    status.value = `${selectedLinkingTypeConfig.value.statusLabel} automation is not ready yet`
    errorMessage.value = ''

    return
  }

  return runAction(
    'Running script',
    () => window.sessionjack.runMediaLinking(),
    result => `Inserted ${result.processedCount} PDF links`,
  )
}

function selectLinkingType() {
  status.value = selectedLinkingTypeConfig.value.statusLabel
  errorMessage.value = ''
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
        class="launch-button"
        icon="pi pi-external-link"
        label="Launch"
        severity="secondary"
        text
        :loading="busyAction === 'Opening browser'"
        aria-label="Launch browser"
        @click="launchBrowser"
      />

      <div
        v-tooltip.bottom="`Run ${selectedLinkingTypeConfig.label}`"
        class="run-control"
      >
        <button
          class="run-button"
          type="button"
          :disabled="isBusy"
          aria-label="Run selected link automation"
          @click="runMediaLinking"
        >
          <i class="pi pi-play" aria-hidden="true" />
          <span>Run</span>
        </button>

        <select
          v-model="selectedLinkingType"
          class="run-select"
          aria-label="Select link automation type"
          :disabled="isBusy"
          @change="selectLinkingType"
        >
          <option
            v-for="option in linkingOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
        <i class="pi pi-chevron-down run-chevron" aria-hidden="true" />
      </div>

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
