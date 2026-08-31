<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue'
import type { KnowledgeWorksBrowserState, KnowledgeWorksBrowserStatus } from '../../shared/types/knowledgeworks'

const browserButtonLabels: Record<KnowledgeWorksBrowserState, string> = {
  connected: 'Open browser',
  disconnected: 'Reconnect',
  error: 'Try again',
  idle: 'Launch browser',
  launching: 'Launching...',
}
const browserButtonIcons: Record<KnowledgeWorksBrowserState, string> = {
  connected: 'pi pi-external-link',
  disconnected: 'pi pi-refresh',
  error: 'pi pi-refresh',
  idle: 'pi pi-external-link',
  launching: 'pi pi-spinner pi-spin',
}
const browserStatusIcons: Record<KnowledgeWorksBrowserState, string> = {
  connected: 'pi pi-check-circle',
  disconnected: 'pi pi-times-circle',
  error: 'pi pi-exclamation-circle',
  idle: 'pi pi-circle',
  launching: 'pi pi-spinner pi-spin',
}
const browserStatusLabels: Record<KnowledgeWorksBrowserState, string> = {
  connected: 'Browser connected',
  disconnected: 'Browser disconnected',
  error: 'Launch failed',
  idle: 'Browser not connected',
  launching: 'Connecting...',
}

const appVersion = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const browserStatus = ref<KnowledgeWorksBrowserStatus>({ state: 'idle' })
const isOpeningArticleFlow = ref(false)
const isOpeningMediaBridge = ref(false)
let removeBrowserStatusListener: (() => void) | undefined
let browserStatusTimer: ReturnType<typeof setInterval> | undefined

const browserButtonLabel = computed(() => browserButtonLabels[browserStatus.value.state])
const browserButtonIcon = computed(() => browserButtonIcons[browserStatus.value.state])
const browserStatusIcon = computed(() => browserStatusIcons[browserStatus.value.state])
const browserStatusLabel = computed(() => browserStatusLabels[browserStatus.value.state])

const isBrowserActionDisabled = computed(() => browserStatus.value.state === 'launching')

/**
 * Opens or focuses the MediaBridge toolbar.
 */
async function openMediaBridge() {
  errorMessage.value = null
  isOpeningMediaBridge.value = true

  try {
    await window.knowledgeworks.openTool('mediabridge')
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    isOpeningMediaBridge.value = false
  }
}

/**
 * Opens or focuses the ArticleFlow import window.
 */
async function openArticleFlow() {
  errorMessage.value = null
  isOpeningArticleFlow.value = true

  try {
    await window.knowledgeworks.openTool('articleflow')
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  } finally {
    isOpeningArticleFlow.value = false
  }
}

/**
 * Opens or focuses the shared log console.
 */
async function openLogs() {
  errorMessage.value = null

  try {
    await window.knowledgeworks.openLogs()
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

/**
 * Launches or reconnects to the shared controlled browser.
 */
async function launchBrowser() {
  errorMessage.value = null

  try {
    await window.knowledgeworks.launchBrowser()
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

/**
 * Reads the installed suite version.
 */
async function showAppVersion() {
  appVersion.value = await window.knowledgeworks.getAppVersion()
}

/**
 * Refreshes the browser connection state without launching a browser.
 */
async function refreshBrowserStatus() {
  try {
    browserStatus.value = await window.knowledgeworks.getBrowserStatus()
  } catch (error) {
    errorMessage.value = getErrorMessage(error)
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
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

  if (browserStatusTimer !== undefined) {
    clearInterval(browserStatusTimer)
  }
})
</script>

<template>
  <main class="hub-shell app-dark">
    <div class="hub-titlebar" aria-hidden="true"></div>

    <header class="hub-header">
      <div class="hub-brand" aria-label="KnowledgeWorks">
        <span class="hub-brand-mark" aria-hidden="true">KW</span>
        <h1>KnowledgeWorks</h1>
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
      <h2 id="hub-tools-title">Automation tools</h2>

      <div class="tool-grid">
        <button
          v-tooltip.bottom="'Link files and articles in eGain'"
          class="tool-launcher"
          type="button"
          :aria-busy="isOpeningMediaBridge"
          :disabled="isOpeningMediaBridge"
          aria-label="Open MediaBridge: Link files and articles in eGain"
          @click="openMediaBridge"
        >
          <span class="tool-mark media-mark" aria-hidden="true">MB</span>
          <strong>MediaBridge</strong>
          <i v-if="isOpeningMediaBridge" class="pi pi-spinner pi-spin tool-loading" aria-hidden="true" />
        </button>

        <button
          v-tooltip.bottom="'Create and manage eGain articles'"
          class="tool-launcher"
          type="button"
          :aria-busy="isOpeningArticleFlow"
          :disabled="isOpeningArticleFlow"
          aria-label="Open ArticleFlow: Create and manage eGain articles"
          @click="openArticleFlow"
        >
          <span class="tool-mark article-mark" aria-hidden="true">AF</span>
          <strong>ArticleFlow</strong>
          <i v-if="isOpeningArticleFlow" class="pi pi-spinner pi-spin tool-loading" aria-hidden="true" />
        </button>
      </div>
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
  grid-template-rows: 36px 76px 1fr 40px;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--kw-text-light);
  background: var(--kw-quiet-surface);
}

.hub-titlebar {
  -webkit-app-region: drag;
  border-bottom: 1px solid var(--kw-border-subtle);
  background: var(--kw-canvas);
}

.hub-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 44px;
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

.hub-brand h1 {
  overflow: hidden;
  margin: 0;
  color: var(--kw-text-light);
  font-size: 1.1rem;
  font-weight: 650;
  line-height: 1.5rem;
  text-overflow: ellipsis;
  white-space: nowrap;
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
.tool-launcher:focus-visible {
  outline: 2px solid var(--kw-focus);
  outline-offset: 1px;
}

.browser-button {
  width: 156px;
  justify-self: end;
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
  grid-template-rows: auto 1fr;
  align-content: stretch;
  gap: 16px;
  min-height: 0;
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
}

.hub-tools h2 {
  margin: 0;
  color: var(--kw-text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(4, 120px);
  align-content: start;
  justify-content: center;
  gap: 10px;
}

.tool-mark {
  width: 48px;
  height: 48px;
  color: var(--kw-text-light);
  border: 2px solid var(--kw-primary);
  border-radius: 8px;
  background: var(--kw-surface);
  font-size: 1.06rem;
}

.media-mark,
.article-mark {
  color: var(--kw-text-light);
}

.media-mark::after,
.article-mark::after {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 4px;
  height: 4px;
  content: '';
  background: var(--kw-accent);
}

.tool-launcher {
  position: relative;
  display: grid;
  width: 120px;
  height: 120px;
  padding: 12px 8px 10px;
  cursor: pointer;
  color: var(--kw-text-light);
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  place-items: center;
  align-content: center;
  gap: 12px;
  transition:
    border-color 120ms ease-out,
    background-color 120ms ease-out;
}

.tool-launcher:not(:disabled):hover,
.tool-launcher:focus-visible {
  border-color: var(--kw-primary);
  background: var(--kw-surface-hover);
}

.tool-launcher:disabled {
  cursor: wait;
}

.tool-launcher:active {
  border-color: var(--kw-focus);
  background: var(--kw-surface);
}

.tool-launcher strong {
  overflow: hidden;
  max-width: 100%;
  color: var(--kw-text-light);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.25rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-loading {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--kw-focus);
  font-size: 0.82rem;
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
