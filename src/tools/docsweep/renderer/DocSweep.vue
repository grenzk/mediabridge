<script setup lang="ts">
import { computed, ref } from 'vue'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'

type DocSweepSiteStatus = 'Not connected' | 'Verifying' | 'Ready' | 'Error'

type DocSweepSiteName = 'Vertiv' | 'Asset Library' | 'PD Cloud' | 'MASW'

type FooterStatus = 'ready' | 'warning' | 'error'

type DocSweepSite = {
  name: DocSweepSiteName
  status: DocSweepSiteStatus
  url: string
  matchUrl: string
  enabled: boolean
}

type SiteSummary = {
  site: string
  found: number
  notFound: number
  errors: number
  total: number
}

type SweepDocument = {
  row: number
  controlNumber: string
}

const excelFile = ref('')
const documents = ref<SweepDocument[]>([])

const isVerifying = ref(false)
const isRunning = ref(false)
const isSitesVerified = ref(false)
const isSweepInitialized = ref(false)

const sweepStatus = ref('Select an Excel file.')
const currentSite = ref('-')
const currentControlNumber = ref('-')
const completedCount = ref(0)
const totalCount = ref(0)
const sweepDocuments = ref<SweepDocument[]>([])

const sites = ref<DocSweepSite[]>([
  {
    name: 'Vertiv',
    status: 'Not connected',
    url: 'https://www.vertiv.com/en-us/',
    matchUrl: 'https://www.vertiv.com/en-us/',
    enabled: true,
  },
  {
    name: 'Asset Library',
    status: 'Not connected',
    url: 'https://asset-library.vertiv.com/#/home?tabName=HOME',
    matchUrl: 'https://asset-library.vertiv.com/',
    enabled: true,
  },
  {
    name: 'PD Cloud',
    status: 'Not connected',
    url: 'https://egup.fa.us2.oraclecloud.com/fscmUI/faces/FndOverview?pageParams=fndGlobalItemNodeId%3DitemNode_product_management_product_development&fndGlobalItemNodeId=itemNode_product_management_product_development&_adf.ctrl-state=CTzs-5yoqQZV_1&_adf.no-new-window-redirect=true&_afrLoop=2780622838863036&_afrWindowMode=2&_afrWindowId=null&_afrFS=16&_afrMT=screen&_afrMFW=944&_afrMFH=882&_afrMFDW=1920&_afrMFDH=1080&_afrMFC=8&_afrMFCI=0&_afrMFM=0&_afrMFR=96&_afrMFG=0&_afrMFS=0&_afrMFO=0',
    matchUrl:
      'https://egup.fa.us2.oraclecloud.com/fscmUI/faces/FndOverview?pageParams=fndGlobalItemNodeId%3DitemNode_product_management_product_development&fndGlobalItemNodeId=itemNode_product_management_product_development',
    enabled: true,
  },
  {
    name: 'MASW',
    status: 'Not connected',
    url: 'https://amerplmpwiap01.int.vertivco.com/File_Display_MBD/faces/UserManualDisplay.xhtml',
    matchUrl: 'https://amerplmpwiap01.int.vertivco.com/File_Display_MBD/faces/UserManualDisplay.xhtml',
    enabled: true,
  },
])

const summary = ref<SiteSummary[]>([
  {
    site: 'Vertiv',
    found: 0,
    notFound: 0,
    errors: 0,
    total: 0,
  },
  {
    site: 'Asset Library',
    found: 0,
    notFound: 0,
    errors: 0,
    total: 0,
  },
  {
    site: 'PD Cloud',
    found: 0,
    notFound: 0,
    errors: 0,
    total: 0,
  },
  {
    site: 'MASW',
    found: 0,
    notFound: 0,
    errors: 0,
    total: 0,
  },
])

const progress = computed(() => {
  if (totalCount.value === 0) {
    return 0
  }

  return Math.round((completedCount.value / totalCount.value) * 100)
})

const totalFound = computed(() => summary.value.reduce((total, item) => total + item.found, 0))

const totalNotFound = computed(() => summary.value.reduce((total, item) => total + item.notFound, 0))

const totalErrors = computed(() => summary.value.reduce((total, item) => total + item.errors, 0))

const totalResults = computed(() => summary.value.reduce((total, item) => total + item.total, 0))

const successRate = computed(() => {
  if (totalResults.value === 0) {
    return 0
  }

  return Math.round((totalFound.value / totalResults.value) * 1000) / 10
})

async function showLogs(): Promise<void> {
  await window.knowledgeworks.openLogs()
}

async function selectExcelFile(): Promise<void> {
  if (isRunning.value) {
    return
  }

  const result = await window.docsweep.selectExcelFile()

  if (!result.ok || !result.filePath) {
    return
  }

  const loadResult = await window.docsweep.loadExcel(result.filePath)

  if (!loadResult.ok) {
    excelFile.value = ''
    documents.value = []
    isSitesVerified.value = false
    footerStatus.value = 'error'
    sweepStatus.value = loadResult.error ?? 'Unable to load the Excel file.'

    return
  }

  excelFile.value = result.filePath
  documents.value = loadResult.documents
  isSweepInitialized.value = false

  isSitesVerified.value = false
  footerStatus.value = 'warning'
  sweepStatus.value = `Loaded ${documents.value.length} control number(s). Verify enabled sites before starting.`
}

async function openSite(url: string, matchUrl: string): Promise<void> {
  await window.docsweep.openSite(url, matchUrl)
}

async function verifySites(): Promise<void> {
  if (isVerifying.value) {
    return
  }

  isSitesVerified.value = false

  const includedSites = sites.value.filter(site => site.enabled).map(site => site.name)

  if (includedSites.length === 0) {
    sweepStatus.value = 'Select at least one site to verify.'
    return
  }

  isVerifying.value = true
  sweepStatus.value = 'Checking sites...'

  for (const site of sites.value) {
    if (site.enabled) {
      site.status = 'Verifying'
    }
  }

  try {
    const result = await window.docsweep.verifySites(includedSites)

    if (!result.ok) {
      footerStatus.value = 'error'
      sweepStatus.value = result.error ?? 'Site verification failed.'

      for (const site of sites.value) {
        if (site.enabled) {
          site.status = 'Error'
        }
      }

      return
    }

    for (const verification of result.results) {
      const site = sites.value.find(item => item.name === verification.name)

      if (!site) {
        continue
      }

      site.status = verification.status
    }

    const allEnabledSitesReady =
      result.results.length === includedSites.length && result.results.every(site => site.status === 'Ready')

    isSitesVerified.value = allEnabledSitesReady

    footerStatus.value = allEnabledSitesReady && canStartSweep.value ? 'ready' : 'warning'

    sweepStatus.value = allEnabledSitesReady
      ? 'All enabled sites are ready.'
      : 'One or more enabled sites are not ready.'
  } finally {
    isVerifying.value = false
  }
}

const canStartSweep = computed(() => {
  if (!excelFile.value.trim()) {
    return false
  }

  if (documents.value.length === 0) {
    return false
  }

  const enabledSites = sites.value.filter(site => site.enabled)

  if (enabledSites.length === 0) {
    return false
  }

  return isSitesVerified.value && enabledSites.every(site => site.status === 'Ready')
})

function invalidateSiteVerification(): void {
  isSitesVerified.value = false
  isSweepInitialized.value = false
  footerStatus.value = 'warning'
  sweepStatus.value = 'Site configuration changed. Verify sites again.'
}

async function startSweep(): Promise<void> {
  if (!canStartSweep.value || isRunning.value) {
    footerStatus.value = 'warning'
    return
  }

  isRunning.value = true
  footerStatus.value = 'warning'
  sweepStatus.value = 'Starting sweep...'

  completedCount.value = 0
  totalCount.value = documents.value.length
  currentSite.value = '-'
  currentControlNumber.value = '-'

  sweepDocuments.value = documents.value.map(document => ({
    row: document.row,
    controlNumber: document.controlNumber,
  }))

  try {
    if (sweepDocuments.value.length === 0) {
      throw new Error('No control numbers are available for the sweep.')
    }

    isSweepInitialized.value = true
    sweepStatus.value = `Sweep initialized with ${sweepDocuments.value.length} control number(s).`

    // Site sweep logic will be implemented in the next feature.
  } catch (error) {
    footerStatus.value = 'error'
    sweepStatus.value = error instanceof Error ? error.message : 'Failed to initialize sweep.'
  } finally {
    isRunning.value = false
  }
}

const footerStatus = ref<FooterStatus>('warning')

const footerStatusMessage = computed(() => {
  if (footerStatus.value === 'error') {
    return sweepStatus.value
  }

  if (isRunning.value) {
    return sweepStatus.value
  }

  if (isSweepInitialized.value) {
    return sweepStatus.value
  }

  if (canStartSweep.value) {
    return 'Ready to start sweep.'
  }

  if (!excelFile.value.trim()) {
    return 'Select an Excel file.'
  }

  if (documents.value.length === 0) {
    return 'Load a valid Excel file.'
  }

  const enabledSites = sites.value.filter(site => site.enabled)

  if (enabledSites.length === 0) {
    return 'Select at least one site.'
  }

  if (!isSitesVerified.value) {
    return 'Verify enabled sites before starting.'
  }

  if (!enabledSites.every(site => site.status === 'Ready')) {
    return 'One or more enabled sites are not ready.'
  }

  return sweepStatus.value
})
</script>

<template>
  <main class="docsweep-shell">
    <!-- =====================================================
         HEADER
         ===================================================== -->
    <header class="docsweep-header">
      <div class="docsweep-brand" aria-label="DocSweep">
        <div class="docsweep-mark">
          <span>DS</span>
        </div>

        <span class="docsweep-title">DocSweep</span>
      </div>

      <Button
        v-tooltip.bottom="'Show logs'"
        icon="pi pi-code"
        class="docsweep-icon-button"
        text
        aria-label="Show logs"
        @click="showLogs"
      />
    </header>

    <!-- =====================================================
         DASHBOARD
         ===================================================== -->
    <section class="dashboard-grid">
      <!-- ===================================================
           1. CONFIGURATION
           =================================================== -->
      <article class="dashboard-card configuration-card">
        <header class="card-header">
          <div class="card-title">
            <i class="pi pi-cog" aria-hidden="true" />
            <span>CONFIGURATION</span>
          </div>
        </header>

        <div class="configuration-body">
          <!-- Excel File -->
          <div class="configuration-input">
            <div class="field-row">
              <label for="excel-file">Excel File</label>

              <div class="input-with-button">
                <InputText
                  id="excel-file"
                  v-model="excelFile"
                  placeholder="Select Excel input file"
                  :disabled="isRunning"
                />

                <Button
                  icon="pi pi-folder-open"
                  label="Browse"
                  severity="secondary"
                  outlined
                  :disabled="isRunning"
                  @click="selectExcelFile"
                />
              </div>
            </div>

            <div class="configuration-actions">
              <Button
                label="Verify Sites"
                icon="pi pi-shield"
                severity="secondary"
                outlined
                :loading="isVerifying"
                :disabled="isRunning"
                @click="verifySites"
              />
            </div>
          </div>

          <!-- Connected Sites -->
          <div class="connected-sites">
            <div class="section-label">Connected Sites</div>

            <div class="sites-table">
              <div class="sites-table-header">
                <span>Site</span>
                <span>Status</span>
                <span class="include-header">Include</span>
              </div>

              <div v-for="site in sites" :key="site.name" class="site-row">
                <div class="site-name">
                  <span class="site-icon">
                    <i class="pi pi-globe" aria-hidden="true" />
                  </span>

                  <strong>{{ site.name }}</strong>
                </div>

                <div class="site-status" :class="`status-${site.status.toLowerCase().replaceAll(' ', '-')}`">
                  <i class="pi pi-circle-fill" aria-hidden="true" />

                  <span>{{ site.status }}</span>
                </div>

                <div class="site-actions">
                  <ToggleSwitch
                    v-model="site.enabled"
                    @update:model-value="invalidateSiteVerification"
                    :disabled="isRunning"
                    :aria-label="`Enable ${site.name} for sweep`"
                  />

                  <Button
                    icon="pi pi-external-link"
                    severity="secondary"
                    text
                    rounded
                    aria-label="Open site"
                    @click="openSite(site.url, site.matchUrl)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <!-- ===================================================
           2. SWEEP PROGRESS
           =================================================== -->
      <article class="dashboard-card progress-card">
        <header class="card-header">
          <div class="card-title">
            <i class="pi pi-chart-line" aria-hidden="true" />

            <span>SWEEP PROGRESS</span>
          </div>
        </header>

        <div class="progress-content">
          <!-- Progress information -->
          <div class="progress-details">
            <div class="progress-detail">
              <span>Current Site</span>
              <strong>{{ currentSite }}</strong>
            </div>

            <div class="progress-detail">
              <span>Current Control Number</span>
              <strong>{{ currentControlNumber }}</strong>
            </div>

            <div class="progress-detail">
              <span>Progress</span>

              <strong> {{ completedCount }} / {{ totalCount }} ({{ progress }}%) </strong>
            </div>
          </div>

          <!-- Progress visualization -->
          <div class="progress-visual">
            <div class="progress-circle">
              <span>{{ progress }}%</span>
            </div>

            <div class="progress-caption">{{ completedCount }} of {{ totalCount }} completed</div>

            <ProgressBar :value="progress" :show-value="false" />
          </div>
        </div>
      </article>

      <!-- ===================================================
           3. SUMMARY
           =================================================== -->
      <article class="dashboard-card summary-card">
        <header class="card-header">
          <div class="card-title">
            <i class="pi pi-chart-bar" aria-hidden="true" />

            <span>SUMMARY</span>
          </div>
        </header>

        <div class="summary-table-wrapper">
          <table class="summary-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Found</th>
                <th>Not Found</th>
                <th>Errors</th>
                <th>Total</th>
                <th>Success Rate</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="item in summary" :key="item.site">
                <td>
                  <strong>{{ item.site }}</strong>
                </td>

                <td class="found-value">
                  {{ item.found }}
                </td>

                <td class="not-found-value">
                  {{ item.notFound }}
                </td>

                <td class="error-value">
                  {{ item.errors }}
                </td>

                <td>
                  {{ item.total }}
                </td>

                <td>
                  <div class="success-rate">
                    <span> {{ item.total ? Math.round((item.found / item.total) * 1000) / 10 : 0 }}% </span>

                    <ProgressBar :value="item.total ? (item.found / item.total) * 100 : 0" :show-value="false" />
                  </div>
                </td>
              </tr>

              <!-- TOTAL -->
              <tr class="summary-total">
                <td>TOTAL</td>

                <td class="found-value">
                  {{ totalFound }}
                </td>

                <td class="not-found-value">
                  {{ totalNotFound }}
                </td>

                <td class="error-value">
                  {{ totalErrors }}
                </td>

                <td>
                  {{ totalResults }}
                </td>

                <td>
                  <div class="success-rate">
                    <span>{{ successRate }}%</span>

                    <ProgressBar :value="successRate" :show-value="false" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </section>

    <!-- =====================================================
         FOOTER
         ===================================================== -->
    <footer class="docsweep-footer">
      <div class="footer-status">
        <span class="footer-status-dot" :class="`footer-status-${footerStatus}`" />

        <span>{{ footerStatusMessage }}</span>
      </div>

      <Button
        label="Start Sweep"
        icon="pi pi-play"
        :loading="isRunning"
        :disabled="isRunning || !canStartSweep"
        class="start-sweep-button"
        @click="startSweep"
      />
    </footer>
  </main>
</template>

<style scoped>
/* =========================================================
   DOCSWEEP SHELL
   ========================================================= */

.docsweep-shell {
  display: grid;

  grid-template-rows:
    60px
    minmax(0, 1fr)
    64px;

  width: 100%;
  height: 100%;

  min-width: 1000px;
  min-height: 0;

  overflow: hidden;

  color: var(--kw-text-light);
  background: var(--kw-quiet-surface);
}

/* =========================================================
   HEADER
   ========================================================= */

.docsweep-header {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 16px;
  min-width: 0;

  padding: 10px 16px;

  border-bottom: 1px solid var(--kw-border-subtle);

  background: var(--kw-quiet-header);
}

.docsweep-brand {
  display: flex;

  min-width: 0;

  align-items: center;

  gap: 12px;
}

.docsweep-mark {
  position: relative;

  display: grid;

  width: 40px;
  height: 40px;

  flex: 0 0 40px;

  place-items: center;

  color: var(--kw-text-light);

  border: 2px solid var(--kw-primary);
  border-radius: 8px;

  background: var(--kw-surface);

  font-size: 1rem;
  font-weight: 700;

  line-height: 1;
}

.docsweep-mark::after {
  position: absolute;

  right: 3px;
  bottom: 3px;

  width: 4px;
  height: 4px;

  content: '';

  background: var(--kw-accent);
}

.docsweep-title {
  overflow: hidden;

  color: var(--kw-text-light);

  font-size: 1rem;
  font-weight: 700;

  text-overflow: ellipsis;
  white-space: nowrap;
}

/* =========================================================
   LOG BUTTON
   ========================================================= */

:deep(.docsweep-icon-button.p-button) {
  width: 40px;
  height: 40px;

  flex: 0 0 40px;

  padding: 0;

  color: var(--kw-text-light);

  border: 1px solid var(--kw-border);
  border-radius: 8px;

  background: transparent;

  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out;
}

:deep(.docsweep-icon-button.p-button:enabled:hover) {
  color: var(--kw-text-light) !important;

  border-color: var(--kw-text-muted);

  background: var(--kw-surface-hover);
}

:deep(.docsweep-icon-button.p-button:focus-visible) {
  outline: 2px solid var(--kw-focus);
  outline-offset: 1px;
}

:deep(.docsweep-icon-button .p-button-icon) {
  font-size: 0.95rem;
}

/* =========================================================
   WORKSPACE
   ========================================================= */

.dashboard-grid {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  display: grid;

  /*
   * Top row:
   *
   *   Configuration | Sweep Progress
   *
   * Bottom row:
   *
   *   Summary
   */

  grid-template-columns:
    minmax(0, 1fr)
    minmax(0, 1fr);
  grid-template-rows:
    auto
    auto;
  align-items: stretch;
  align-content: start;
  gap: 10px;
  padding: 12px 16px 14px;
  scrollbar-color: var(--kw-border) var(--kw-quiet-surface);
}

/* =========================================================
   DASHBOARD CARDS
   ========================================================= */

.dashboard-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--kw-border);
  border-radius: 10px;
  background: var(--kw-surface);
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  min-height: 38px;
  padding: 8px 12px;
  box-sizing: border-box;
  border-bottom: 1px solid var(--kw-border-subtle);
  background: var(--kw-quiet-header);
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--kw-text-light);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.card-title i {
  color: var(--kw-vertiv-color);
  font-size: 0.75rem;
}

/* =========================================================
   CONFIGURATION
   ========================================================= */

.configuration-card {
  grid-column: 1;
  grid-row: 1;

  min-width: 0;

  height: 100%;
}

/*
 * Single-column configuration.
 *
 * Excel File
 *     ↓
 * Verify Sites
 *     ↓
 * Connected Sites
 */

.configuration-body {
  display: flex;
  flex-direction: column;

  gap: 14px;

  padding: 12px 14px;

  box-sizing: border-box;
}

/* =========================================================
   EXCEL INPUT
   ========================================================= */

.configuration-input {
  width: 100%;
  min-width: 0;
}

.field-row {
  width: 100%;
  min-width: 0;

  display: grid;

  gap: 6px;
}

.field-row label {
  color: var(--kw-text-muted);

  font-size: 0.75rem;
  font-weight: 600;
}

.input-with-button {
  display: grid;

  width: 100%;
  min-width: 0;

  grid-template-columns:
    minmax(0, 1fr)
    auto;

  gap: 6px;

  align-items: center;
}

.input-with-button :deep(.p-inputtext) {
  width: 100%;
  min-width: 0;
  height: 34px;

  box-sizing: border-box;

  color: var(--kw-text-light);

  border: 1px solid var(--kw-border);
  border-radius: 7px;

  background: var(--kw-quiet-surface);

  font-size: 0.75rem;
}

.input-with-button :deep(.p-inputtext::placeholder) {
  color: var(--kw-text-disabled);
}

.input-with-button :deep(.p-inputtext:enabled:hover) {
  border-color: var(--kw-text-muted);
}

.input-with-button :deep(.p-inputtext:enabled:focus) {
  border-color: var(--kw-focus);

  box-shadow: 0 0 0 1px var(--kw-focus);
}

.input-with-button :deep(.p-button) {
  height: 34px;

  padding: 0 10px;

  color: var(--kw-text-light);

  border: 1px solid var(--kw-border);
  border-radius: 7px;

  background: transparent;

  font-size: 0.75rem;
}

.input-with-button :deep(.p-button:enabled:hover) {
  color: var(--kw-text-light) !important;

  border-color: var(--kw-text-muted);

  background: var(--kw-surface-hover);
}

/* =========================================================
   CONFIGURATION ACTIONS
   ========================================================= */

.configuration-actions {
  display: flex;

  margin-top: 10px;
}

.configuration-actions :deep(.p-button) {
  height: 32px;

  padding: 0 11px;

  border-radius: 7px;

  font-size: 0.65rem;
  font-weight: 600;
  color: var(--kw-text-light);
  border: 1px solid var(--kw-border);
}

.configuration-actions :deep(.p-button:enabled:hover) {
  color: var(--kw-text-light) !important;

  border-color: var(--kw-text-muted);

  background: var(--kw-surface-hover);
}

/* =========================================================
   CONNECTED SITES
   ========================================================= */

.connected-sites {
  min-width: 0;
}

.section-label {
  margin-bottom: 7px;
  color: var(--kw-text-light);
  font-size: 0.75rem;
  font-weight: 600;
}

.sites-table {
  width: 100%;
  overflow: hidden;
  border-radius: 4px;
}

.sites-table-header,
.site-row {
  display: grid;
  grid-template-columns: minmax(160px, 1.2fr) minmax(140px, 1fr) 96px;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  box-sizing: border-box;
}

.sites-table-header {
  min-height: 28px;
  padding: 0 8px;
  background: var(--kw-surface-hover);
  color: var(--kw-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  min-height: 30px;
  color: var(--kw-text-muted);
  background: var(--kw-quiet-surface);
  font-size: 0.7rem;
  font-weight: 700;
}

.site-row {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(120px, 1fr) 76px;
  align-items: center;
  min-height: 38px;
  padding: 0 8px;
  border-bottom: none;
}

.site-row:hover {
  background: var(--kw-surface-hover);
}

.site-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.site-name strong {
  overflow: hidden;
  color: var(--kw-text-light);
  font-size: 0.75rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  color: var(--kw-text-muted);
  border: 1px solid var(--kw-border);
  border-radius: 6px;
  font-size: 0.7rem;
}

.site-icon i {
  font-size: 0.65rem;
}

.site-status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--kw-text-muted);
  font-size: 0.7rem;
}

.site-status i {
  font-size: 0.4rem;
}

.status-not-connected {
  color: var(--kw-text-muted);
}

.status-verifying {
  color: var(--kw-accent);
}

.status-ready {
  color: var(--kw-success);
}

.status-error {
  color: var(--kw-danger);
}

.site-row :deep(.p-button) {
  width: 26px;
  height: 26px;

  padding: 0;

  color: var(--kw-text-muted);

  border-radius: 6px;
}

.site-row :deep(.p-button:enabled:hover) {
  color: var(--kw-text-light);

  background: var(--kw-surface-hover);
}

.include-header {
  text-align: center;
}

.site-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
}

/* Toggle switch */
.site-actions :deep(.p-toggleswitch) {
  width: 32px;
  height: 18px;
  flex: 0 0 32px;
}

/* Toggle track */
.site-actions :deep(.p-toggleswitch-slider) {
  width: 36px;
  height: 18px;
}

/* Toggle handle */
.site-actions :deep(.p-toggleswitch-handle) {
  width: 16px;
  height: 16px;
}

.site-actions :deep(.p-toggleswitch:not(.p-toggleswitch-checked) .p-toggleswitch-handle) {
  inset-inline-start: 2px;
}

/* Open-site button */
.site-actions :deep(.p-button) {
  width: 26px;
  height: 26px;
  min-width: 26px;
  padding: 0;
  flex: 0 0 26px;

  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Open-site icon */
.site-actions :deep(.p-button .p-button-icon) {
  margin: 0;
  font-size: 0.75rem;
}

/* =========================================================
   SWEEP PROGRESS
   ========================================================= */

.progress-card {
  grid-column: 2;
  grid-row: 1;

  min-width: 0;

  height: 100%;
}

.progress-content {
  display: grid;

  grid-template-columns:
    minmax(0, 1fr)
    170px;

  height: calc(100% - 38px);
  min-height: 250px;

  gap: 18px;

  padding: 20px 18px;

  align-items: stretch;

  box-sizing: border-box;
}

.progress-details {
  display: flex;

  flex-direction: column;
  justify-content: center;

  gap: 12px;

  min-width: 0;
}

.progress-detail {
  display: grid;

  grid-template-columns:
    150px
    minmax(0, 1fr);

  gap: 12px;

  min-width: 0;

  font-size: 0.75rem;
}

.progress-detail span {
  color: var(--kw-text-muted);
}

.progress-detail strong {
  min-width: 0;

  overflow: hidden;

  color: var(--kw-text-light);

  font-size: 0.75rem;
  font-weight: 600;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-visual {
  display: flex;

  flex-direction: column;

  align-items: center;
  justify-content: center;

  gap: 10px;

  min-width: 0;

  padding-left: 18px;

  border-left: 1px solid var(--kw-border-subtle);
}

.progress-circle {
  display: grid;

  width: 100px;
  height: 100px;

  place-items: center;

  box-sizing: border-box;

  color: var(--kw-text-light);

  border: 8px solid var(--kw-border);

  border-top-color: var(--kw-vertiv-color);
  border-right-color: var(--kw-vertiv-color);

  border-radius: 50%;
}

.progress-circle span {
  font-size: 1.1rem;
  font-weight: 700;
}

.progress-caption {
  color: var(--kw-text-muted);

  font-size: 0.65rem;

  text-align: center;
}

.progress-visual :deep(.p-progressbar) {
  width: 120px;
  height: 6px;

  overflow: hidden;

  border-radius: 999px;

  background: var(--kw-border);
}

.progress-visual :deep(.p-progressbar-value) {
  background: var(--kw-vertiv-color);
}

/* =========================================================
   SUMMARY
   ========================================================= */

.summary-card {
  grid-column: 1 / -1;
  grid-row: 2;

  min-width: 0;
}

.summary-table-wrapper {
  width: 100%;

  overflow-x: auto;
}

.summary-table {
  width: 100%;

  border-collapse: collapse;

  font-size: 0.75rem;
}

.summary-table th,
.summary-table td {
  padding: 8px 10px;

  text-align: left;

  border-bottom: 1px solid var(--kw-border-subtle);
}

.summary-table th {
  color: var(--kw-text-muted);

  background: var(--kw-quiet-surface);

  font-size: 0.7rem;
  font-weight: 700;
}

.summary-table td {
  color: var(--kw-text-light);
}

.summary-table tbody tr:hover {
  background: var(--kw-surface-hover);
}

.found-value {
  color: var(--kw-success) !important;

  font-weight: 700;
}

.not-found-value {
  color: var(--kw-vertiv-color) !important;

  font-weight: 700;
}

.error-value {
  color: var(--kw-danger) !important;

  font-weight: 700;
}

.success-rate {
  display: grid;

  grid-template-columns:
    42px
    minmax(60px, 1fr);

  align-items: center;

  gap: 8px;
}

.success-rate :deep(.p-progressbar) {
  height: 5px;

  overflow: hidden;

  border-radius: 999px;

  background: var(--kw-border);
}

.success-rate :deep(.p-progressbar-value) {
  background: var(--kw-success);
}

.summary-total td {
  color: var(--kw-text-light);

  border-bottom: 0;

  font-weight: 700;
}

/* =========================================================
   FOOTER
   ========================================================= */

.docsweep-footer {
  display: flex;

  align-items: center;
  justify-content: space-between;

  gap: 16px;

  min-width: 0;

  padding: 8px 16px;

  border-top: 1px solid var(--kw-border-subtle);

  background: var(--kw-quiet-header);
}

.footer-status {
  display: flex;

  min-width: 0;

  align-items: center;

  gap: 8px;

  color: var(--kw-text-muted);

  font-size: 0.7rem;
}

.footer-status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 8px;
  border-radius: 50%;
  background: var(--kw-text-disabled);
}

.footer-status-dot.footer-status-ready {
  background: var(--kw-success);
}

.footer-status-dot.footer-status-warning {
  background: var(--kw-vertiv-color);
}

.footer-status-dot.footer-status-error {
  background: var(--kw-danger);
}

.footer-status-dot.running {
  background: var(--kw-primary);
}

:deep(.start-sweep-button.p-button) {
  min-width: 120px;
  height: 36px;

  color: var(--kw-text-light);

  border-color: var(--kw-vertiv-color);
  border-radius: 7px;

  background: var(--kw-vertiv-color);

  font-size: 0.7rem;
  font-weight: 600;
}

:deep(.start-sweep-button.p-button:enabled:hover) {
  color: var(--kw-text-light) !important;

  border-color: var(--kw-vertiv-hover);

  background: var(--kw-vertiv-hover);
}

:deep(.start-sweep-button.p-button:enabled:active) {
  border-color: var(--kw-vertiv-pressed);

  background: var(--kw-vertiv-pressed);
}

:deep(.start-sweep-button.p-button:disabled) {
  color: var(--kw-text-disabled);

  border-color: var(--kw-border);

  background: var(--kw-surface);

  opacity: 1;
}

/* =========================================================
   GENERAL PRIMEVUE OVERRIDES
   ========================================================= */

:deep(.p-button) {
  font-family: inherit;

  box-shadow: none;
}

:deep(.p-button:focus-visible) {
  outline: 2px solid var(--kw-focus);

  outline-offset: 1px;
}

:deep(.p-progressbar) {
  background: var(--kw-border);
}

:deep(.p-progressbar-value) {
  background: var(--kw-vertiv-color);
}

/* =========================================================
   SCROLLBAR
   ========================================================= */

.dashboard-grid::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.dashboard-grid::-webkit-scrollbar-track {
  background: var(--kw-quiet-surface);
}

.dashboard-grid::-webkit-scrollbar-thumb {
  border-radius: 999px;

  background: var(--kw-border);
}

.dashboard-grid::-webkit-scrollbar-thumb:hover {
  background: var(--kw-text-muted);
}

/* =========================================================
   RESPONSIVE
   ========================================================= */

@media (max-width: 900px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .configuration-card,
  .progress-card,
  .summary-card {
    grid-column: 1;
  }

  .configuration-card {
    grid-row: 1;
  }

  .progress-card {
    grid-row: 2;
  }

  .summary-card {
    grid-row: 3;
  }
}

@media (max-width: 700px) {
  .docsweep-shell {
    min-width: 0;
  }

  .docsweep-header {
    padding: 10px 12px;
  }

  .dashboard-grid {
    padding: 10px 12px 12px;
  }

  .input-with-button {
    grid-template-columns:
      minmax(0, 1fr)
      auto;
  }

  .progress-content {
    grid-template-columns: 1fr;
  }

  .progress-visual {
    padding-top: 10px;
    padding-left: 0;

    border-top: 1px solid var(--kw-border-subtle);
    border-left: 0;
  }

  .progress-detail {
    grid-template-columns:
      120px
      minmax(0, 1fr);
  }

  .sites-table-header,
  .site-row {
    grid-template-columns:
      minmax(100px, 1.2fr)
      minmax(80px, 1fr)
      28px;
  }
}

@media (max-width: 500px) {
  .input-with-button {
    grid-template-columns: 1fr;
  }

  .configuration-actions {
    width: 100%;
  }

  .configuration-actions :deep(.p-button) {
    width: 100%;
  }

  .docsweep-footer {
    padding-inline: 12px;
  }

  :deep(.start-sweep-button.p-button) {
    min-width: 110px;
  }

  .summary-table {
    min-width: 600px;
  }
}

/* =========================================================
   REDUCED MOTION
   ========================================================= */

@media (prefers-reduced-motion: reduce) {
  .docsweep-shell *,
  .docsweep-shell *::before,
  .docsweep-shell *::after {
    scroll-behavior: auto !important;

    transition-duration: 0.01ms !important;
  }
}
</style>
