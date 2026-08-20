<script setup lang="ts">
import { computed, ref } from 'vue'

type SiteStatus = 'Ready' | 'Not connected' | 'Checking'

type Site = {
  name: string
  status: SiteStatus
}

type SiteSummary = {
  site: string
  found: number
  notFound: number
  errors: number
  total: number
}

const excelFile = ref('')

const isVerifying = ref(false)
const isRunning = ref(false)

const sweepStatus = ref('Ready')
const currentSite = ref('-')
const currentControlNumber = ref('-')
const completedCount = ref(0)
const totalCount = ref(0)

const sites = ref<Site[]>([
  {
    name: 'Vertiv',
    status: 'Not connected',
  },
  {
    name: 'Asset Library',
    status: 'Not connected',
  },
  {
    name: 'PD Cloud',
    status: 'Not connected',
  },
  {
    name: 'MASW',
    status: 'Not connected',
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

async function verifySites() {
  isVerifying.value = true
  sweepStatus.value = 'Checking sites...'

  try {
    // TODO:
    // Replace this temporary implementation with the
    // actual Electron / Playwright site verification.
    await new Promise(resolve => setTimeout(resolve, 500))

    sites.value = sites.value.map(site => ({
      ...site,
      status: 'Not connected',
    }))

    sweepStatus.value = 'Ready'
  } finally {
    isVerifying.value = false
  }
}

async function startSweep() {
  if (!excelFile.value) {
    sweepStatus.value = 'Select an Excel file first.'
    return
  }

  isRunning.value = true
  sweepStatus.value = 'Starting sweep...'
  completedCount.value = 0
  totalCount.value = 0

  try {
    // TODO:
    // Replace this temporary implementation with the
    // actual DocSweep IPC call.
    await new Promise(resolve => setTimeout(resolve, 500))

    sweepStatus.value = 'Ready'
  } finally {
    isRunning.value = false
  }
}
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

                <Button icon="pi pi-folder-open" label="Browse" severity="secondary" outlined :disabled="isRunning" />
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
                <span />
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

                <Button icon="pi pi-external-link" severity="secondary" text rounded aria-label="Open site" />
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
        <span class="footer-status-dot" :class="{ running: isRunning }" />

        <span>{{ sweepStatus }}</span>
      </div>

      <Button
        label="Start Sweep"
        icon="pi pi-play"
        :loading="isRunning"
        :disabled="isRunning"
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

  border: 2px solid var(--kw-vertiv-color);
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
  min-width: 0;
}

.field-row {
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

  grid-template-columns:
    minmax(0, 1fr)
    auto;

  gap: 6px;

  align-items: center;
}

.input-with-button :deep(.p-inputtext) {
  width: 100%;
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

  grid-template-columns:
    minmax(110px, 1.2fr)
    minmax(90px, 1fr)
    28px;

  align-items: center;

  gap: 6px;

  padding: 4px 6px;

  box-sizing: border-box;
}

.sites-table-header {
  min-height: 30px;

  color: var(--kw-text-muted);

  background: var(--kw-quiet-surface);

  font-size: 0.7rem;
  font-weight: 700;
}

.site-row {
  min-height: 38px;

  border-top: 1px solid var(--kw-border-subtle);
}

.site-row:hover {
  background: var(--kw-surface-hover);
}

.site-name {
  display: flex;

  min-width: 0;

  align-items: center;

  gap: 7px;
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
  display: grid;

  width: 24px;
  height: 24px;

  flex: 0 0 24px;

  place-items: center;

  color: var(--kw-text-muted);

  border: 1px solid var(--kw-border);
  border-radius: 6px;

  background: var(--kw-quiet-surface);
}

.site-icon i {
  font-size: 0.65rem;
}

.site-status {
  display: flex;

  align-items: center;

  gap: 5px;

  font-size: 0.7rem;
  font-weight: 600;
}

.site-status i {
  font-size: 0.38rem;
}

.status-ready {
  color: var(--kw-success);
}

.status-not-connected {
  color: var(--kw-text-muted);
}

.status-checking {
  color: var(--kw-vertiv-color);
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
  width: 7px;
  height: 7px;

  flex: 0 0 7px;

  border-radius: 50%;

  background: var(--kw-success);
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
