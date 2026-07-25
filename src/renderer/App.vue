<script setup>
import { onBeforeMount, ref } from 'vue'
import { useMediaLinking } from './composables/useMediaLinking.js'
import { useToolbarActions } from './composables/useToolbarActions.js'

/** @type {import('vue').Ref<null | string>} */
const appVersion = ref(null)
const toolbarActions = useToolbarActions()
const { currentMessage, errorMessage, isBusy, reportActionError, showProgressDots } = toolbarActions
const {
  chooseLinkingType,
  doneTargetCount,
  isLinkingTypeMenuOpen,
  linkingOptions,
  refreshTargetCount,
  runMediaLinking,
  selectedLinkingType,
  selectedLinkingTypeConfig,
  targetCount,
  targetLabel,
  targetSingularLabel,
  toggleLinkingTypeMenu,
  unlinkedTargetCount,
} = useMediaLinking(toolbarActions)

/**
 * Reads the packaged app version for the status badge.
 *
 * @returns {Promise<void>}
 */
async function showAppVersion() {
  appVersion.value = await window.mediabridge.getAppVersion()
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
    await reportActionError('Logs', error)
  }
}

onBeforeMount(async () => await showAppVersion())
</script>

<template>
  <main class="toolbar-shell app-dark">
    <section class="toolbar" aria-label="MediaBridge toolbar">
      <div class="brand" aria-label="MediaBridge">
        <span class="brand-mark">MB</span>
      </div>

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
        v-tooltip.bottom="`Refresh ${targetSingularLabel} count`"
        class="target-counter"
        type="button"
        :disabled="isBusy"
        @click="refreshTargetCount"
      >
        <span class="counter-number">{{ targetCount ?? '--' }}</span>
        <span class="counter-label">{{ targetLabel }}</span>
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
            <dd>{{ unlinkedTargetCount ?? '--' }}</dd>
          </div>
          <div>
            <dt>Done</dt>
            <dd>{{ doneTargetCount ?? '--' }}</dd>
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
