<script setup>
import { computed, ref } from 'vue'

const linkCount = ref(null)
const documentCount = ref(null)
const processedCount = ref(null)
const status = ref('PDF')
const busyAction = ref('')
const errorMessage = ref('')
const selectedLinkingType = ref('pdf')
const isLinkingTypeMenuOpen = ref(false)

const linkingTypes = {
  pdf: { label: 'PDF', statusLabel: 'PDF' },
  word: { label: 'Word', statusLabel: 'Word' },
  excel: { label: 'Excel', statusLabel: 'Excel' },
  article: { disabled: true, label: 'Article', statusLabel: 'Article' },
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
    disabled: item.disabled ?? false,
    value,
    label: item.label,
  })),
)

async function runAction(name, action, successMessage) {
  busyAction.value = name
  errorMessage.value = ''
  status.value = name
  isLinkingTypeMenuOpen.value = false

  try {
    const result = await action()

    if (result?.count !== undefined) {
      linkCount.value = result.count
    }

    if (result?.documentCount !== undefined) {
      documentCount.value = result.documentCount
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
    () => window.mediabridge.launchBrowser(),
    () => 'Browser open',
  )
}

function refreshLinkCount() {
  if (selectedLinkingType.value === 'article') {
    status.value = 'Article automation is not ready yet'
    errorMessage.value = ''

    return
  }

  return runAction(
    'Counting links',
    () => window.mediabridge.getLinkCount(selectedLinkingType.value),
    result => `${result.documentCount} ${result.mode} links found`,
  )
}

function runMediaLinking() {
  if (selectedLinkingType.value === 'article') {
    status.value = 'Article automation is not ready yet'
    errorMessage.value = ''

    return
  }

  return runAction(
    'Running script',
    () => window.mediabridge.runMediaLinking(selectedLinkingType.value),
    result => `Inserted ${result.processedCount} ${result.mode} links`,
  )
}

function selectLinkingType() {
  status.value = selectedLinkingTypeConfig.value.statusLabel
  errorMessage.value = ''
  documentCount.value = null
  processedCount.value = null
}

function toggleLinkingTypeMenu() {
  if (isBusy.value) {
    return
  }

  isLinkingTypeMenuOpen.value = !isLinkingTypeMenuOpen.value
}

function chooseLinkingType(option) {
  if (option.disabled) {
    return
  }

  selectedLinkingType.value = option.value
  isLinkingTypeMenuOpen.value = false
  selectLinkingType()
}

function closeToolbar() {
  window.mediabridge.closeToolbar()
}
</script>

<template>
  <main class="toolbar-shell app-dark">
    <section class="toolbar" aria-label="MediaBridge toolbar">
      <div class="brand" aria-label="MediaBridge">
        <span class="brand-mark">MB</span>
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

        <button
          class="run-mode-button"
          type="button"
          aria-label="Select link automation type"
          :aria-expanded="isLinkingTypeMenuOpen"
          :disabled="isBusy"
          @click="toggleLinkingTypeMenu"
        >
          <i class="pi pi-chevron-down run-chevron" aria-hidden="true" />
        </button>
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
      <div
        v-if="isLinkingTypeMenuOpen"
        class="linking-type-menu"
        role="listbox"
        aria-label="Link automation type"
      >
        <button
          v-for="option in linkingOptions"
          :key="option.value"
          class="linking-type-option"
          :class="{ selected: option.value === selectedLinkingType }"
          type="button"
          role="option"
          :aria-selected="option.value === selectedLinkingType"
          :disabled="option.disabled"
          @click="chooseLinkingType(option)"
        >
          {{ option.label }}
        </button>
      </div>

      <div v-else-if="currentMessage" class="status-message">
        <span>{{ currentMessage }}</span>
      </div>

      <dl class="status-metrics">
        <div>
          <dt>Found</dt>
          <dd>{{ documentCount ?? '--' }}</dd>
        </div>
        <div>
          <dt>Done</dt>
          <dd>{{ processedCount ?? '--' }}</dd>
        </div>
      </dl>
    </section>
  </main>
</template>
