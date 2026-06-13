<script setup>
import { computed, onBeforeMount, ref } from 'vue'

/**
 * @typedef {{
 *   disabled?: boolean,
 *   label: string,
 *   statusLabel: string,
 * }} LinkingTypeConfig
 *
 * @typedef {{
 *   count?: number,
 *   documentCount?: number,
 *   mode?: string,
 *   ok?: boolean,
 *   processedCount?: number,
 *   skippedCount?: number,
 * }} ActionResult
 *
 * @typedef {{
 *   disabled: boolean,
 *   label: string,
 *   value: string,
 * }} LinkingOption
 */

const appVersion = ref(null)
const linkCount = ref(null)
const documentCount = ref(null)
const processedCount = ref(null)
const status = ref('PDF')
const busyAction = ref('')
const errorMessage = ref('')
const selectedLinkingType = ref('pdf')
const isLinkingTypeMenuOpen = ref(false)

/** @type {Record<string, LinkingTypeConfig>} */
const linkingTypes = {
  pdf: { label: 'PDF', statusLabel: 'PDF' },
  word: { label: 'Word', statusLabel: 'Word' },
  excel: { label: 'Excel', statusLabel: 'Excel' },
  image: { label: 'Image', statusLabel: 'Image' },
  article: { label: 'Article', statusLabel: 'Article' },
}

const isBusy = computed(() => busyAction.value !== '')
const linkLabel = computed(() => {
  if (selectedLinkingType.value === 'image') {
    return linkCount.value === 1 ? 'Image' : 'Images'
  }

  return linkCount.value === 1 ? 'Link' : 'Links'
})
const currentMessage = computed(() => errorMessage.value || status.value)
const showProgressDots = computed(() => isBusy.value && !errorMessage.value)
const selectedLinkingTypeConfig = computed(() => linkingTypes[selectedLinkingType.value])
const selectedTargetLabel = computed(() => (selectedLinkingType.value === 'image' ? 'images' : 'links'))
const selectedCountLabel = computed(() => (selectedLinkingType.value === 'image' ? 'image' : 'link'))
const linkingOptions = computed(() =>
  Object.entries(linkingTypes).map(([value, linkingType]) => ({
    disabled: linkingType.disabled ?? false,
    value,
    label: linkingType.label,
  })),
)

/**
 * Runs a toolbar action while keeping status text, busy state, and error
 * logging consistent across browser, count, and linking commands.
 *
 * @param {string} name
 * @param {() => Promise<ActionResult>} action
 * @param {(result: ActionResult) => string} successMessage
 * @returns {Promise<void>}
 */
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
    await writeRendererErrorLog(name, error)
    errorMessage.value = 'Needs attention. See logs.'
    status.value = 'Needs attention'
  } finally {
    busyAction.value = ''
  }
}

/**
 * Opens or connects to the controlled browser.
 *
 * @returns {Promise<void>}
 */
function launchBrowser() {
  return runAction(
    'Opening browser',
    () => window.mediabridge.launchBrowser(),
    () => 'Browser open',
  )
}

/**
 * Reads the packaged app version for the status badge.
 *
 * @returns {Promise<void>}
 */
async function showAppVersion() {
  appVersion.value = await window.mediabridge.getAppVersion()
}

/**
 * Counts targets for the selected linking mode.
 *
 * @returns {Promise<void>}
 */
function refreshLinkCount() {
  return runAction(
    `Counting ${selectedTargetLabel.value}`,
    () => window.mediabridge.getLinkCount(selectedLinkingType.value),
    (result) => {
      const noun =
        selectedLinkingType.value === 'image'
          ? result.documentCount === 1
            ? 'image'
            : 'images'
          : `${result.mode} ${result.documentCount === 1 ? 'link' : 'links'}`

      return `${result.documentCount} ${noun} ready`
    },
  )
}

/**
 * Runs the selected linking automation mode.
 *
 * @returns {Promise<void>}
 */
function runMediaLinking() {
  return runAction(
    'Running script',
    () => window.mediabridge.runMediaLinking(selectedLinkingType.value),
    (result) => {
      const noun =
        selectedLinkingType.value === 'image'
          ? result.processedCount === 1
            ? 'image'
            : 'images'
          : `${result.mode} ${result.processedCount === 1 ? 'link' : 'links'}`
      const skippedText = result.skippedCount ? `, skipped ${result.skippedCount} missing` : ''

      return `Inserted ${result.processedCount} ${noun}${skippedText}`
    },
  )
}

/**
 * Resets display state after the user changes linking modes.
 */
function selectLinkingType() {
  status.value = selectedLinkingTypeConfig.value.statusLabel
  errorMessage.value = ''
  linkCount.value = null
  documentCount.value = null
  processedCount.value = null
}

function toggleLinkingTypeMenu() {
  if (isBusy.value) {
    return
  }

  isLinkingTypeMenuOpen.value = !isLinkingTypeMenuOpen.value
}

/**
 * Selects a linking mode from the dropdown menu.
 *
 * @param {LinkingOption} option
 */
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

function minimizeToolbar() {
  window.mediabridge.minimizeToolbar()
}

async function openLogs() {
  try {
    await window.mediabridge.openLogs()
  } catch (error) {
    await writeRendererErrorLog('Logs', error)
    errorMessage.value = 'Needs attention. See logs.'
    status.value = 'Needs attention'
  }
}

/**
 * Sends renderer-facing errors to the shared log window without masking the
 * toolbar's own fallback error display.
 *
 * @param {string} scope
 * @param {unknown} error
 * @returns {Promise<void>}
 */
async function writeRendererErrorLog(scope, error) {
  try {
    await window.mediabridge.writeLog('error', scope, 'Renderer received an action error.', getErrorMessage(error))
  } catch {
    // Keep toolbar errors visible even if the log bridge itself fails.
  }
}

/**
 * Converts unknown thrown values into readable status/log text.
 *
 * @param {unknown} error
 * @returns {string}
 */
function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

onBeforeMount(async () => await showAppVersion())
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
        :class="{ open: isLinkingTypeMenuOpen }"
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
        v-tooltip.bottom="`Refresh ${selectedCountLabel} count`"
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
        v-tooltip.bottom="'Show logs'"
        icon="pi pi-code"
        severity="secondary"
        text
        aria-label="Show logs"
        @click="openLogs"
      />

      <Button
        v-tooltip.bottom="'Minimize toolbar'"
        icon="pi pi-minus"
        severity="secondary"
        text
        aria-label="Minimize toolbar"
        @click="minimizeToolbar"
      />

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
      <div v-if="isLinkingTypeMenuOpen" class="linking-type-menu" role="listbox" aria-label="Link automation type">
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
        <span v-if="showProgressDots" class="progress-dots" aria-hidden="true">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </div>

      <div class="status-tray">
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

        <div v-if="appVersion" class="version-badge" aria-label="MediaBridge version">
          <span class="sr-only">Version</span>
          <span>v{{ appVersion }}</span>
        </div>
      </div>
    </section>
  </main>
</template>
