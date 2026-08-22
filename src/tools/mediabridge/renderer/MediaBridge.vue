<script setup lang="ts">
import { useMediaLinking } from './composables/useMediaLinking.ts'
import { useToolbarActions } from './composables/useToolbarActions.ts'

const toolbarActions = useToolbarActions()
const { currentMessage, errorMessage, isBusy, reportActionError, showProgressDots } = toolbarActions
const {
  chooseLinkingType,
  doneTargetCount,
  isCountingTargets,
  isLinkingTypeMenuOpen,
  isRunningMediaLinking,
  isStoppingTargetCount,
  isStoppingMediaLinking,
  linkingOptions,
  refreshTargetCount,
  runMediaLinking,
  selectedLinkingType,
  selectedLinkingTypeConfig,
  stopMediaLinking,
  stopTargetCount,
  targetCount,
  targetLabel,
  targetSingularLabel,
  toggleLinkingTypeMenu,
  unlinkedTargetCount,
} = useMediaLinking(toolbarActions)

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
</script>

<template>
  <main class="toolbar-shell app-dark">
    <section class="toolbar" aria-label="MediaBridge toolbar">
      <div class="brand" aria-label="MediaBridge">
        <span class="brand-mark">MB</span>
      </div>

      <div
        v-tooltip.bottom="isRunningMediaLinking ? 'Stop automation' : `Run ${selectedLinkingTypeConfig.label}`"
        class="run-control"
        :class="{ open: isLinkingTypeMenuOpen }"
      >
        <button
          class="run-button"
          type="button"
          :disabled="isStoppingMediaLinking || (isBusy && !isRunningMediaLinking)"
          :aria-label="isRunningMediaLinking ? 'Stop link automation' : 'Run selected link automation'"
          @click="isRunningMediaLinking ? stopMediaLinking() : runMediaLinking()"
        >
          <i :class="isRunningMediaLinking ? 'pi pi-stop' : 'pi pi-play'" aria-hidden="true" />
          <span>{{ isRunningMediaLinking ? 'Stop' : 'Run' }}</span>
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
        v-tooltip.bottom="isCountingTargets ? 'Stop counting' : `Refresh ${targetSingularLabel} count`"
        class="target-counter"
        type="button"
        :disabled="isStoppingTargetCount || (isBusy && !isCountingTargets)"
        :aria-label="isCountingTargets ? 'Stop counting targets' : `Refresh ${targetSingularLabel} count`"
        @click="isCountingTargets ? stopTargetCount() : refreshTargetCount()"
      >
        <span class="counter-number">
          <i v-if="isCountingTargets" class="pi pi-stop" aria-hidden="true" />
          <template v-else>{{ targetCount ?? '--' }}</template>
        </span>
        <span class="counter-label">{{ isCountingTargets ? 'Stop' : targetLabel }}</span>
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
        class="close-button"
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

      <div v-if="!isLinkingTypeMenuOpen" class="status-tray">
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
      </div>
    </section>
  </main>
</template>
