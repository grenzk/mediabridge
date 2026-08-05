<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type {
  ArticleFlowCompletionAction,
  ArticleFlowImportPlan,
  ArticleFlowRunResult,
} from '../../../shared/types/knowledgeworks'
import SourceStructureTree from './SourceStructureTree.vue'

type ArticleFlowStatusTone = 'idle' | 'ready' | 'running' | 'success' | 'error'

const completionAction = ref<ArticleFlowCompletionAction>('check-in')
const importPlan = ref<ArticleFlowImportPlan | null>(null)
const isSelectingRoot = ref(false)
const isRunning = ref(false)
const statusMessage = ref('No source folder selected.')
const statusTone = ref<ArticleFlowStatusTone>('idle')

const sourceFolderName = computed(() => {
  const rootPath = importPlan.value?.rootPath

  return rootPath?.split(/[\\/]/).filter(Boolean).at(-1) ?? 'No folder selected'
})
const sourceFilePaths = computed(
  () =>
    importPlan.value?.articles.map(article => [
      sourceFolderName.value,
      ...article.relativeSourcePath.split(/[\\/]/).filter(Boolean),
    ]) ?? [],
)
const canRun = computed(() => importPlan.value !== null && !isSelectingRoot.value && !isRunning.value)
const statusIcon = computed(() => {
  const icons: Record<ArticleFlowStatusTone, string> = {
    error: 'pi pi-exclamation-circle',
    idle: 'pi pi-circle',
    ready: 'pi pi-file-check',
    running: 'pi pi-spinner pi-spin',
    success: 'pi pi-check-circle',
  }

  return icons[statusTone.value]
})

/**
 * Opens the native directory picker and scans the selected taxonomy.
 */
async function selectRoot() {
  isSelectingRoot.value = true
  statusMessage.value = 'Reading source folder...'
  statusTone.value = 'running'

  try {
    const result = await window.articleflow.selectRoot()

    if (result.canceled) {
      statusMessage.value = importPlan.value ? 'Plan unchanged.' : 'No source folder selected.'
      statusTone.value = importPlan.value ? 'ready' : 'idle'
      return
    }

    if (!result.plan) {
      throw new Error('ArticleFlow did not return an import plan.')
    }

    importPlan.value = result.plan
    statusMessage.value = formatPlanStatus(result.plan)
    statusTone.value = 'ready'
  } catch (error) {
    statusMessage.value = getErrorMessage(error)
    statusTone.value = 'error'
  } finally {
    isSelectingRoot.value = false
  }
}

/**
 * Rebuilds and runs the selected plan against the current eGain folder.
 */
async function runImport() {
  const plan = importPlan.value

  if (!plan) {
    return
  }

  isRunning.value = true
  statusMessage.value = 'Import in progress. See logs for details.'
  statusTone.value = 'running'

  try {
    const result = await window.articleflow.runImport(plan.rootPath, completionAction.value)

    setResultStatus(result)
  } catch (error) {
    statusMessage.value = getErrorMessage(error)
    statusTone.value = 'error'
  } finally {
    isRunning.value = false
  }
}

/**
 * Opens or focuses the shared KnowledgeWorks log window.
 */
async function openLogs() {
  try {
    await window.knowledgeworks.openLogs()
  } catch (error) {
    statusMessage.value = getErrorMessage(error)
    statusTone.value = 'error'
  }
}

function setResultStatus(result: ArticleFlowRunResult) {
  const action = completionAction.value === 'check-in' ? 'checked in' : 'published'
  const parts = [`${formatCount(result.createdArticleCount, 'article')} ${action}`]

  if (result.existingArticleCount > 0) {
    parts.push(`${formatCount(result.existingArticleCount, 'article')} already existed`)
  }

  if (!result.ok) {
    parts.push(`${formatCount(result.failedArticles.length, 'article')} failed`)
    statusMessage.value = `${parts.join('; ')}. See logs.`
    statusTone.value = 'error'
    return
  }

  statusMessage.value = `${parts.join('; ')}.`
  statusTone.value = 'success'
}

function formatPlanStatus(plan: ArticleFlowImportPlan) {
  return `${formatCount(plan.articles.length, 'article')} across ${formatCount(plan.folderPaths.length, 'folder')}.`
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function selectCompletionAction(action: ArticleFlowCompletionAction, event?: KeyboardEvent) {
  const control = event ? (event.currentTarget as HTMLElement).parentElement : null

  completionAction.value = action

  if (control) {
    void nextTick(() => {
      control.querySelector<HTMLElement>(`[data-action="${action}"]`)?.focus()
    })
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
</script>

<template>
  <main class="article-flow-shell app-dark">
    <header class="article-flow-header">
      <div class="article-flow-brand">
        <span class="article-flow-mark" aria-hidden="true">AF</span>
        <div>
          <strong>ArticleFlow</strong>
        </div>
      </div>

      <Button
        v-tooltip.bottom="'Show logs'"
        class="article-flow-icon-button"
        icon="pi pi-code"
        severity="secondary"
        text
        aria-label="Show logs"
        @click="openLogs"
      />
    </header>

    <section class="article-flow-workspace">
      <section class="setup-section" aria-labelledby="import-setup-title">
        <h1 id="import-setup-title" class="section-title">Import setup</h1>

        <div class="setup-panel">
          <div class="setup-row source-row">
            <span class="setup-label">Source folder</span>
            <strong class="setup-value source-name" :title="importPlan?.rootPath">{{ sourceFolderName }}</strong>

            <Button
              class="choose-folder-button"
              icon="pi pi-folder-open"
              :label="importPlan ? 'Change folder' : 'Choose folder'"
              severity="secondary"
              outlined
              :loading="isSelectingRoot"
              :disabled="isRunning"
              @click="selectRoot"
            />
          </div>

          <div class="setup-row destination-row">
            <span class="setup-label">Destination</span>
            <strong class="setup-value">Current eGain folder</strong>
          </div>

          <div class="setup-row completion-row">
            <span id="completion-action-label" class="setup-label">Completion action</span>
            <div class="completion-control" role="radiogroup" aria-labelledby="completion-action-label">
              <button
                type="button"
                data-action="check-in"
                :aria-checked="completionAction === 'check-in'"
                :class="{ selected: completionAction === 'check-in' }"
                :tabindex="completionAction === 'check-in' ? 0 : -1"
                role="radio"
                :disabled="isRunning"
                @click="selectCompletionAction('check-in')"
                @keydown.down.prevent="selectCompletionAction('publish', $event)"
                @keydown.right.prevent="selectCompletionAction('publish', $event)"
              >
                Check in
              </button>
              <button
                type="button"
                data-action="publish"
                :aria-checked="completionAction === 'publish'"
                :class="{ selected: completionAction === 'publish' }"
                :tabindex="completionAction === 'publish' ? 0 : -1"
                role="radio"
                :disabled="isRunning"
                @click="selectCompletionAction('publish')"
                @keydown.left.prevent="selectCompletionAction('check-in', $event)"
                @keydown.up.prevent="selectCompletionAction('check-in', $event)"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="plan-section" aria-labelledby="import-plan-title">
        <div class="plan-heading">
          <h2 id="import-plan-title" class="section-title">Import plan</h2>
          <div v-if="importPlan" class="plan-counts" aria-label="Import plan totals">
            <span
              ><strong>{{ importPlan.folderPaths.length }}</strong> folder{{
                importPlan.folderPaths.length === 1 ? '' : 's'
              }}</span
            >
            <span
              ><strong>{{ importPlan.articles.length }}</strong> article{{
                importPlan.articles.length === 1 ? '' : 's'
              }}</span
            >
            <span><strong>{{ importPlan.ignoredPaths.length }}</strong> ignored</span>
          </div>
        </div>

        <div v-if="!importPlan" class="plan-empty">
          <i class="pi pi-folder-open" aria-hidden="true" />
          <span>No import plan loaded.</span>
        </div>

        <div v-else class="plan-content">
          <div class="plan-panel">
            <details class="plan-details source-details" open>
              <summary>
                <span class="summary-label">
                  <i class="pi pi-chevron-right detail-chevron" aria-hidden="true" />
                  <span>Source structure</span>
                </span>
              </summary>
              <div class="source-tree-frame">
                <SourceStructureTree
                  :file-paths="sourceFilePaths"
                  :folder-paths="importPlan.folderPaths"
                />
              </div>
            </details>
          </div>

          <details v-if="importPlan.ignoredPaths.length" class="plan-details ignored-details">
            <summary>
              <span class="summary-label">
                <i class="pi pi-chevron-right detail-chevron" aria-hidden="true" />
                <span>Ignored items</span>
              </span>
              <strong>{{ importPlan.ignoredPaths.length }}</strong>
            </summary>
            <ul>
              <li v-for="ignoredPath in importPlan.ignoredPaths" :key="ignoredPath">{{ ignoredPath }}</li>
            </ul>
          </details>
        </div>
      </section>
    </section>

    <footer class="article-flow-footer">
      <span class="article-flow-status" :class="statusTone" aria-live="polite">
        <i :class="statusIcon" aria-hidden="true" />
        <span>{{ statusMessage }}</span>
      </span>

      <Button
        class="run-import-button"
        icon="pi pi-play"
        label="Run import"
        :loading="isRunning"
        :disabled="!canRun"
        @click="runImport"
      />
    </footer>
  </main>
</template>

<style scoped>
.article-flow-shell {
  display: grid;
  grid-template-rows: 72px minmax(0, 1fr) 68px;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--kw-text-light);
  background: var(--kw-quiet-surface);
}

.article-flow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--kw-border-subtle);
  background: var(--kw-quiet-header);
}

.article-flow-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.article-flow-brand > div {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.article-flow-brand strong {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.5rem;
}

.article-flow-mark {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  color: var(--kw-text-light);
  border: 2px solid var(--kw-primary);
  border-radius: 8px;
  background: var(--kw-surface);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
}

.article-flow-mark::after {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 4px;
  height: 4px;
  content: '';
  background: var(--kw-accent);
}

:deep(.article-flow-icon-button.p-button) {
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  padding: 0;
  color: var(--kw-text-light);
  border: 1px solid var(--kw-border);
  border-radius: 8px;
  background: transparent;
  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out;
}

:deep(.article-flow-icon-button.p-button:enabled:hover) {
  color: var(--kw-text-light) !important;
  border-color: var(--kw-text-muted);
  background: var(--kw-surface-hover);
}

.article-flow-workspace {
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px 24px;
  scrollbar-color: var(--kw-border) var(--kw-quiet-surface);
}

.setup-section,
.plan-section {
  display: grid;
  gap: 12px;
}

.plan-section {
  margin-top: 24px;
}

.section-title {
  margin: 0;
  color: var(--kw-text-light);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.setup-panel,
.plan-panel,
.ignored-details {
  border: 1px solid var(--kw-border);
  border-radius: 10px;
  background: var(--kw-surface);
}

.setup-row {
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr) auto;
  min-height: 66px;
  align-items: center;
  gap: 12px 16px;
  padding: 10px 16px;
}

.setup-row + .setup-row {
  border-top: 1px solid var(--kw-border-subtle);
}

.setup-label {
  color: var(--kw-text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.125rem;
}

.setup-value {
  min-width: 0;
  color: var(--kw-text-light);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.125rem;
}

.destination-row .setup-value {
  grid-column: 2 / -1;
}

.source-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

:deep(.choose-folder-button.p-button),
:deep(.run-import-button.p-button) {
  height: 44px;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out,
    color 120ms ease-out;
}

:deep(.choose-folder-button.p-button) {
  min-width: 132px;
  color: var(--kw-text-light);
  border-color: var(--kw-border);
  background: transparent;
}

:deep(.choose-folder-button.p-button:enabled:hover) {
  color: var(--kw-text-light) !important;
  border-color: var(--kw-text-muted);
  background: var(--kw-surface-hover);
}

.completion-control {
  grid-column: 2 / -1;
  justify-self: end;
  display: grid;
  grid-template-columns: repeat(2, 104px);
  overflow: hidden;
  border: 1px solid var(--kw-border);
  border-radius: 8px;
  background: var(--kw-surface);
}

.completion-control button {
  height: 44px;
  padding: 0 14px;
  color: var(--kw-text-muted);
  border: 0;
  background: transparent;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 120ms ease-out,
    background-color 120ms ease-out;
}

.completion-control button + button {
  border-left: 1px solid var(--kw-border);
}

.completion-control button:hover:not(:disabled) {
  color: var(--kw-text-light);
  background: var(--kw-surface-hover);
}

.completion-control button.selected {
  color: var(--kw-text-light);
  background: var(--kw-primary);
}

.completion-control button.selected:hover:not(:disabled) {
  background: var(--kw-primary-hover);
}

.completion-control button.selected:active:not(:disabled) {
  background: var(--kw-primary-pressed);
}

.completion-control button:disabled {
  cursor: default;
  opacity: 0.7;
}

.article-flow-shell :is(button, summary):focus-visible,
:deep(.article-flow-shell .p-button:focus-visible) {
  outline: 2px solid var(--kw-focus);
  outline-offset: 2px;
}

.plan-counts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 16px;
  color: var(--kw-text-muted);
  font-size: 0.8125rem;
  line-height: 1.125rem;
}

.plan-counts span {
  white-space: nowrap;
}

.plan-counts strong {
  color: var(--kw-text-light);
  font-weight: 600;
}

.plan-empty {
  display: flex;
  min-height: 156px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0;
  color: var(--kw-text-disabled);
  border: 1px solid var(--kw-border);
  border-radius: 10px;
  background: var(--kw-surface);
  font-size: 0.8125rem;
}

.plan-empty.compact {
  min-height: 72px;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.plan-content {
  display: grid;
  gap: 12px;
}

.plan-panel {
  overflow: hidden;
}

.ignored-details ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.source-tree-frame {
  padding: 0 16px 16px 48px;
}

.plan-details summary {
  display: flex;
  min-height: 52px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 16px;
  color: var(--kw-text-light);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
  transition: background-color 120ms ease-out;
}

.plan-details summary::-webkit-details-marker {
  display: none;
}

.plan-details summary:hover {
  background: var(--kw-surface-hover);
}

.summary-label {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.detail-chevron {
  width: 12px;
  flex: 0 0 auto;
  color: var(--kw-text-muted);
  font-size: 0.6875rem;
  text-align: center;
  transition: transform 180ms ease-out;
}

.plan-details[open] .detail-chevron {
  transform: rotate(90deg);
}

.ignored-details {
  overflow: hidden;
}

.ignored-details summary > strong {
  color: var(--kw-text-light);
  font-size: 0.8125rem;
  font-weight: 600;
}

.ignored-details ul {
  display: grid;
  gap: 8px;
  padding: 0 16px 16px 48px;
  color: var(--kw-text-muted);
  font-size: 0.8125rem;
  line-height: 1.25rem;
}

.ignored-details li {
  overflow-wrap: anywhere;
}

.ignored-details ul {
  padding-top: 12px;
  border-top: 1px solid var(--kw-border-subtle);
}

.article-flow-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-top: 1px solid var(--kw-border-subtle);
  background: var(--kw-canvas);
}

.article-flow-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  color: var(--kw-text-muted);
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.125rem;
}

.article-flow-status > i {
  width: 18px;
  flex: 0 0 auto;
  color: var(--kw-text-disabled);
  font-size: 1rem;
  text-align: center;
}

.article-flow-status > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-flow-status.ready > i,
.article-flow-status.running > i {
  color: var(--kw-focus);
}

.article-flow-status.success > i {
  color: var(--kw-success);
}

.article-flow-status.error > i {
  color: var(--kw-danger);
}

:deep(.run-import-button.p-button) {
  min-width: 140px;
  color: var(--kw-text-light);
  border-color: var(--kw-focus);
  background: var(--kw-primary);
}

:deep(.run-import-button.p-button:enabled:hover) {
  color: var(--kw-text-light) !important;
  border-color: var(--kw-text-light);
  background: var(--kw-primary-hover);
}

:deep(.run-import-button.p-button:enabled:active) {
  border-color: var(--kw-primary-pressed);
  background: var(--kw-primary-pressed);
}

:deep(.run-import-button.p-button:disabled) {
  color: var(--kw-text-disabled);
  border-color: var(--kw-border);
  background: var(--kw-surface);
  opacity: 1;
}

:deep(.run-import-button .p-button-loading-icon) {
  display: block;
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  transform-origin: 50% 50%;
  backface-visibility: hidden;
  will-change: transform;
}

@media (max-width: 700px) {
  .article-flow-workspace {
    padding: 16px;
  }

  .plan-section {
    margin-top: 20px;
  }

  .setup-row {
    grid-template-columns: minmax(0, 1fr) auto;
    min-height: 0;
    gap: 8px 12px;
    padding: 12px;
  }

  .setup-label {
    grid-column: 1 / -1;
  }

  .setup-value {
    grid-column: 1;
  }

  .source-row :deep(.choose-folder-button.p-button) {
    grid-column: 2;
    grid-row: 2;
  }

  .destination-row .setup-value,
  .completion-control {
    grid-column: 1 / -1;
  }

  .completion-control {
    width: 100%;
    justify-self: stretch;
    grid-template-columns: repeat(2, 1fr);
  }

  .article-flow-footer {
    grid-template-columns: minmax(0, 1fr) auto;
    padding-inline: 16px;
  }

  :deep(.run-import-button.p-button) {
    min-width: 128px;
  }

  .ignored-details ul {
    padding-left: 36px;
  }

  .source-tree-frame {
    padding-left: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-flow-shell *,
  .article-flow-shell *::before,
  .article-flow-shell *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
