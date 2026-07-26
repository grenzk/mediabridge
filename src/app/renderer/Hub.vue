<script setup>
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue'

/** @type {import('vue').Ref<null | string>} */
const appVersion = ref(null)
/** @type {import('vue').Ref<null | string>} */
const errorMessage = ref(null)
/** @type {import('vue').Ref<import('../../shared/types/knowledgeworks').KnowledgeWorksBrowserStatus>} */
const browserStatus = ref({ state: 'idle' })
const isOpeningMediaBridge = ref(false)
/** @type {undefined | (() => void)} */
let removeBrowserStatusListener
/** @type {undefined | ReturnType<typeof setInterval>} */
let browserStatusTimer

const browserButtonLabel = computed(() => {
  const labels = {
    connected: 'Open browser',
    disconnected: 'Reconnect',
    error: 'Try again',
    idle: 'Launch browser',
    launching: 'Launching...',
  }

  return labels[browserStatus.value.state]
})

const browserButtonIcon = computed(() => {
  const icons = {
    connected: 'pi pi-external-link',
    disconnected: 'pi pi-refresh',
    error: 'pi pi-refresh',
    idle: 'pi pi-external-link',
    launching: 'pi pi-spinner pi-spin',
  }

  return icons[browserStatus.value.state]
})

const browserStatusIcon = computed(() => {
  const icons = {
    connected: 'pi pi-check-circle',
    disconnected: 'pi pi-times-circle',
    error: 'pi pi-exclamation-circle',
    idle: 'pi pi-circle',
    launching: 'pi pi-spinner pi-spin',
  }

  return icons[browserStatus.value.state]
})

const browserStatusLabel = computed(() => {
  const labels = {
    connected: 'Browser connected',
    disconnected: 'Browser disconnected',
    error: 'Launch failed',
    idle: 'Browser not connected',
    launching: 'Connecting...',
  }

  return labels[browserStatus.value.state]
})

const isBrowserActionDisabled = computed(() => browserStatus.value.state === 'launching')

/**
 * Opens or focuses the MediaBridge toolbar.
 *
 * @returns {Promise<void>}
 */
async function openMediaBridge() {
  errorMessage.value = null
  isOpeningMediaBridge.value = true

  try {
    await window.knowledgeworks.openTool('mediabridge')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isOpeningMediaBridge.value = false
  }
}

/**
 * Opens or focuses the shared log console.
 *
 * @returns {Promise<void>}
 */
async function openLogs() {
  errorMessage.value = null

  try {
    await window.knowledgeworks.openLogs()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

/**
 * Launches or reconnects to the shared controlled browser.
 *
 * @returns {Promise<void>}
 */
async function launchBrowser() {
  errorMessage.value = null

  try {
    await window.knowledgeworks.launchBrowser()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

/**
 * Reads the installed suite version.
 *
 * @returns {Promise<void>}
 */
async function showAppVersion() {
  appVersion.value = await window.knowledgeworks.getAppVersion()
}

/**
 * Refreshes the browser connection state without launching a browser.
 *
 * @returns {Promise<void>}
 */
async function refreshBrowserStatus() {
  try {
    browserStatus.value = await window.knowledgeworks.getBrowserStatus()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  }
}

onBeforeMount(async () => {
  removeBrowserStatusListener = window.knowledgeworks.onBrowserStatusChanged(status => {
    browserStatus.value = status
  })

  await Promise.all([showAppVersion(), refreshBrowserStatus()])
  browserStatusTimer = setInterval(refreshBrowserStatus, 5000)
})

onBeforeUnmount(() => {
  removeBrowserStatusListener?.()

  if (browserStatusTimer) {
    clearInterval(browserStatusTimer)
  }
})
</script>

<template>
  <main class="hub-shell app-dark">
    <header class="hub-header">
      <div class="hub-brand">
        <span class="hub-brand-mark" aria-hidden="true">KW</span>
        <div class="hub-title">
          <strong>KnowledgeWorks</strong>
        </div>
      </div>

      <Button
        class="browser-button"
        :class="browserStatus.state"
        :icon="browserButtonIcon"
        :label="browserButtonLabel"
        :loading="browserStatus.state === 'launching'"
        :disabled="isBrowserActionDisabled"
        @click="launchBrowser"
      />

      <Button
        v-tooltip.bottom="'Show logs'"
        class="hub-icon-button"
        icon="pi pi-code"
        severity="secondary"
        text
        aria-label="Show logs"
        @click="openLogs"
      />
    </header>

    <section class="hub-tools" aria-labelledby="hub-tools-title">
      <h1 id="hub-tools-title">Automation tools</h1>

      <article class="tool-row">
        <span class="tool-mark media-mark" aria-hidden="true">MB</span>
        <div class="tool-copy">
          <strong>MediaBridge</strong>
          <span>Link files and articles in eGain</span>
        </div>
        <Button
          class="open-tool-button"
          icon="pi pi-arrow-up-right"
          label="Open"
          :loading="isOpeningMediaBridge"
          @click="openMediaBridge"
        />
      </article>

      <article class="tool-row unavailable">
        <span class="tool-mark article-mark" aria-hidden="true">AF</span>
        <div class="tool-copy">
          <strong>ArticleFlow</strong>
          <span>Create and manage eGain articles</span>
        </div>
        <Button
          v-tooltip.bottom="'ArticleFlow is planned for a future release'"
          class="open-tool-button"
          icon="pi pi-lock"
          label="Soon"
          severity="secondary"
          disabled
        />
      </article>
    </section>

    <footer class="hub-footer" :class="{ error: errorMessage }" aria-live="polite">
      <span class="hub-status">
        <i
          :class="[
            errorMessage ? 'pi pi-exclamation-circle' : browserStatusIcon,
            errorMessage ? 'error' : browserStatus.state,
          ]"
          aria-hidden="true"
        />
        <strong class="hub-status-value" :class="errorMessage ? 'error' : browserStatus.state">
          {{ errorMessage ?? browserStatusLabel }}
        </strong>
      </span>
      <span v-if="appVersion" class="hub-version">v{{ appVersion }}</span>
    </footer>
  </main>
</template>

<style scoped>
.hub-shell {
  display: grid;
  grid-template-rows: 76px 1fr 40px;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--kw-text-light);
  background: var(--kw-quiet-surface);
}

.hub-header {
  display: grid;
  grid-template-columns: minmax(190px, 1fr) 156px 44px;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--kw-border-subtle);
  background: var(--kw-quiet-header);
}

.hub-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.hub-brand-mark,
.tool-mark {
  position: relative;
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  font-weight: 700;
  line-height: 1;
}

.hub-brand-mark {
  width: 44px;
  height: 44px;
  color: var(--kw-text-light);
  border: 2px solid var(--kw-primary);
  border-radius: 8px;
  background: var(--kw-surface);
  font-size: 0.9rem;
}

.hub-brand-mark::after {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 4px;
  height: 4px;
  content: '';
  background: var(--kw-accent);
}

.hub-title {
  min-width: 0;
}

.hub-title strong {
  overflow: hidden;
  font-size: 1.1rem;
  font-weight: 650;
  line-height: 1.5rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hub-header :deep(.p-button) {
  height: 44px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out;
}

.hub-header :deep(.p-button:focus-visible),
.open-tool-button:focus-visible {
  outline: 2px solid var(--kw-focus);
  outline-offset: 2px;
}

.browser-button {
  width: 156px;
  color: var(--kw-text-light);
  border-color: var(--kw-focus);
  background: var(--kw-primary);
}

.browser-button:enabled:hover {
  border-color: var(--kw-text-light);
  background: var(--kw-primary-hover);
}

.browser-button:enabled:active {
  border-color: var(--kw-primary-pressed);
  background: var(--kw-primary-pressed);
}

:deep(.hub-icon-button.p-button) {
  width: 44px;
  padding: 0;
  color: var(--kw-text-light);
  border: 1px solid var(--kw-border);
  background: transparent;
}

:deep(.hub-icon-button.p-button:enabled:hover) {
  border-color: var(--kw-text-muted);
  background: var(--kw-surface-hover);
}

.hub-tools {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 0;
  padding: 20px;
}

.hub-tools h1 {
  margin: 0;
  color: var(--kw-text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.tool-row {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) 84px;
  align-items: center;
  gap: 12px;
  min-height: 92px;
  padding: 12px 16px;
  border: 1px solid var(--kw-border);
  border-radius: 10px;
  background: var(--kw-surface);
}

.tool-row.unavailable {
  border-color: var(--kw-border-subtle);
}

.tool-mark {
  width: 44px;
  height: 44px;
  color: var(--kw-text-light);
  border: 1px solid var(--kw-border);
  border-radius: 8px;
  background: var(--kw-quiet-surface);
  font-size: 0.8rem;
}

.media-mark {
  color: var(--kw-focus);
  border-color: var(--kw-primary);
}

.article-mark {
  color: var(--kw-text-disabled);
}

.tool-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.tool-copy strong,
.tool-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-copy strong {
  color: var(--kw-text-light);
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.35rem;
}

.tool-copy span {
  color: var(--kw-text-muted);
  font-size: 0.76rem;
  line-height: 1.1rem;
}

.open-tool-button {
  width: 84px;
  height: 44px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
}

.tool-row:not(.unavailable) .open-tool-button {
  color: var(--kw-text-light);
  border-color: var(--kw-focus);
  background: var(--kw-primary);
}

.tool-row:not(.unavailable) .open-tool-button:enabled:hover {
  border-color: var(--kw-text-light);
  background: var(--kw-primary-hover);
}

.tool-row.unavailable .open-tool-button {
  color: var(--kw-text-disabled);
  border-color: var(--kw-border-subtle);
  background: var(--kw-quiet-surface);
  opacity: 1;
}

.hub-footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
  color: var(--kw-text-muted);
  border-top: 1px solid var(--kw-border-subtle);
  background: var(--kw-canvas);
  font-size: 0.72rem;
  font-weight: 500;
}

.hub-footer.error {
  color: var(--kw-danger);
}

.hub-status {
  display: flex;
  min-width: 0;
  overflow: hidden;
  align-items: center;
  gap: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hub-status-value {
  overflow: hidden;
  color: var(--kw-text-light);
  font-weight: 500;
  text-overflow: ellipsis;
}

.hub-status > i {
  width: 14px;
  flex: 0 0 auto;
  color: var(--kw-text-disabled);
  font-size: 0.78rem;
  text-align: center;
}

.hub-status > i.launching,
.hub-status-value.launching {
  color: var(--kw-focus);
}

.hub-status > i.connected,
.hub-status-value.connected {
  color: var(--kw-success);
}

.hub-status > i.disconnected,
.hub-status > i.error,
.hub-status-value.disconnected,
.hub-status-value.error {
  color: var(--kw-danger);
}

.hub-version {
  flex: 0 0 auto;
  font-family: ui-monospace, 'SFMono-Regular', Consolas, monospace;
}
</style>
