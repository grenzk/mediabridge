<script setup>
import { computed, onBeforeMount, onBeforeUnmount, ref } from 'vue'

/** @type {import('vue').Ref<null | string>} */
const appVersion = ref(null)
/** @type {import('vue').Ref<null | string>} */
const errorMessage = ref(null)
/** @type {import('vue').Ref<import('./mediabridge').KnowledgeWorksBrowserStatus>} */
const browserStatus = ref({ state: 'idle' })
const isOpeningMediaBridge = ref(false)
/** @type {undefined | (() => void)} */
let removeBrowserStatusListener
/** @type {undefined | ReturnType<typeof setInterval>} */
let browserStatusTimer

const browserButtonLabel = computed(() => {
  const labels = {
    connected: 'Connected',
    disconnected: 'Reconnect',
    error: 'Try Again',
    idle: 'Launch',
    launching: 'Launching',
  }

  return labels[browserStatus.value.state]
})

const browserStatusLabel = computed(() => {
  const labels = {
    connected: 'Browser connected',
    disconnected: 'Browser disconnected',
    error: 'Browser connection failed',
    idle: 'Browser offline',
    launching: 'Connecting to browser',
  }

  return labels[browserStatus.value.state]
})

const isBrowserActionDisabled = computed(() => ['connected', 'launching'].includes(browserStatus.value.state))

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
        icon="pi pi-external-link"
        :label="browserButtonLabel"
        severity="secondary"
        text
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
      <h1 id="hub-tools-title">Tools</h1>

      <article class="tool-row">
        <span class="tool-mark media-mark" aria-hidden="true">MB</span>
        <div class="tool-copy">
          <div class="tool-name">
            <strong>MediaBridge</strong>
            <span>Linking toolbar</span>
          </div>
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
          <div class="tool-name">
            <strong>ArticleFlow</strong>
            <span>Article workspace</span>
          </div>
        </div>
        <Button class="open-tool-button" icon="pi pi-lock" label="Soon" severity="secondary" disabled />
      </article>
    </section>

    <footer class="hub-footer" :class="{ error: errorMessage }" aria-live="polite">
      <span class="hub-status">
        <span v-if="!errorMessage" class="status-dot" :class="browserStatus.state" aria-hidden="true"></span>
        {{ errorMessage ?? browserStatusLabel }}
      </span>
      <span v-if="appVersion" class="hub-version">v{{ appVersion }}</span>
    </footer>
  </main>
</template>

<style scoped>
.hub-shell {
  display: grid;
  grid-template-rows: auto 1fr 30px;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #111418;
  color: #f6f7f8;
}

.hub-header {
  display: grid;
  grid-template-columns: minmax(158px, 1fr) 126px 36px;
  align-items: center;
  gap: 7px;
  min-height: 58px;
  padding: 9px 12px;
  border-bottom: 1px solid rgb(255 255 255 / 10%);
  background: #171b20;
}

.hub-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.hub-brand-mark,
.tool-mark {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  color: #111418;
  font-weight: 850;
  line-height: 1;
}

.hub-brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #dce4ec;
  font-size: 0.78rem;
}

.hub-title {
  min-width: 0;
}

.hub-title strong {
  overflow: hidden;
  font-size: 0.88rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hub-header :deep(.p-button) {
  height: 36px;
  border-radius: 7px;
  color: #f8fafc;
  background: rgb(255 255 255 / 7%);
  border: 1px solid rgb(255 255 255 / 12%);
  font-size: 0.72rem;
  font-weight: 700;
}

.hub-header :deep(.p-button:enabled:hover) {
  background: rgb(255 255 255 / 13%);
  border-color: rgb(255 255 255 / 18%);
}

.browser-button {
  width: 126px;
}

.browser-button:disabled {
  opacity: 0.72;
}

.hub-icon-button {
  width: 36px;
  padding: 0;
}

.hub-tools {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  padding: 12px;
}

.hub-tools h1 {
  margin: 0 0 1px;
  color: rgb(255 255 255 / 56%);
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
}

.tool-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 76px;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 8px 10px;
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  background: rgb(255 255 255 / 5%);
}

.tool-row.unavailable {
  background: rgb(255 255 255 / 3%);
}

.tool-mark {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  font-size: 0.74rem;
}

.media-mark {
  background: #f7d54a;
}

.article-mark {
  color: #e8eef7;
  background: #395f88;
}

.tool-copy {
  min-width: 0;
}

.tool-name {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.tool-name strong {
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-name span {
  flex: 0 0 auto;
  padding: 3px 5px;
  color: rgb(255 255 255 / 55%);
  border-radius: 4px;
  background: rgb(255 255 255 / 7%);
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
}

.open-tool-button {
  width: 76px;
  height: 34px;
  border-radius: 7px;
  font-size: 0.7rem;
  font-weight: 750;
}

.tool-row:not(.unavailable) .open-tool-button {
  color: #111418;
  background: #f7d54a;
  border-color: #f7d54a;
}

.tool-row:not(.unavailable) .open-tool-button:enabled:hover {
  color: #111418;
  background: #fde16a;
  border-color: #fde16a;
}

.tool-row.unavailable .open-tool-button {
  color: rgb(255 255 255 / 45%);
  background: rgb(255 255 255 / 5%);
  border-color: rgb(255 255 255 / 8%);
}

.hub-footer {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  color: rgb(255 255 255 / 45%);
  border-top: 1px solid rgb(255 255 255 / 8%);
  background: #0d1014;
  font-size: 0.64rem;
  font-weight: 650;
}

.hub-footer.error {
  color: #fecaca;
}

.hub-status {
  display: flex;
  overflow: hidden;
  align-items: center;
  gap: 6px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #69727d;
}

.status-dot.launching {
  background: #5ea5e8;
}

.status-dot.connected {
  background: #54b87a;
}

.status-dot.disconnected,
.status-dot.error {
  background: #e18383;
}

.hub-version {
  flex: 0 0 auto;
}
</style>
