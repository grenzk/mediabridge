<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type {
  ArticleFlowCompletionAction,
  ArticleFlowImportPlan,
  ArticleFlowRunResult,
} from '../../../shared/types/knowledgeworks'

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

    <section class="article-flow-workspace" aria-labelledby="article-flow-source-title">
      <section class="article-flow-command">
        <div class="command-heading">
          <div>
            <h1 id="article-flow-source-title">Source folder</h1>
            <span class="source-name" :title="importPlan?.rootPath">{{ sourceFolderName }}</span>
          </div>

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

        <div class="destination-row">
          <span>Destination</span>
          <strong>Current eGain folder</strong>
        </div>

        <div class="completion-row">
          <span id="completion-action-label">Completion action</span>
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
      </section>

      <section class="plan-section" aria-labelledby="import-plan-title">
        <div class="plan-heading">
          <h2 id="import-plan-title">Import plan</h2>
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
            <span
              ><strong>{{ importPlan.ignoredPaths.length }}</strong> ignored</span
            >
          </div>
        </div>

        <div v-if="!importPlan" class="plan-empty">
          <i class="pi pi-folder-open" aria-hidden="true" />
          <span>No import plan loaded.</span>
        </div>

        <div v-else class="plan-content">
          <ol v-if="importPlan.articles.length" class="article-list" aria-label="Articles to import">
            <li v-for="article in importPlan.articles" :key="article.sourcePath">
              <i class="pi pi-file" aria-hidden="true" />
              <span>
                <strong>{{ article.title }}</strong>
                <small :title="article.relativeSourcePath">{{ article.relativeSourcePath }}</small>
              </span>
            </li>
          </ol>
          <p v-else class="plan-empty compact">No HTML articles found in this folder.</p>

          <details class="plan-details">
            <summary>Folder hierarchy</summary>
            <ul>
              <li v-for="folderPath in importPlan.folderPaths" :key="folderPath.join('/')">
                {{ folderPath.join(' > ') }}
              </li>
            </ul>
          </details>

          <details v-if="importPlan.ignoredPaths.length" class="plan-details">
            <summary>Ignored items</summary>
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
  grid-template-rows: 72px minmax(0, 1fr) 64px;
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
  font-size: 1.05rem;
  font-weight: 600;
  line-height: 1.35rem;
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
}

:deep(.article-flow-icon-button.p-button:enabled:hover) {
  border-color: var(--kw-text-muted);
  background: var(--kw-surface-hover);
}

.article-flow-workspace {
  min-height: 0;
  overflow-y: auto;
  padding: 20px 24px 24px;
}

.article-flow-command {
  display: grid;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--kw-border-subtle);
}

.command-heading,
.destination-row,
.completion-row,
.plan-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.command-heading > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.command-heading h1,
.plan-heading h2 {
  margin: 0;
  color: var(--kw-text-light);
  font-size: 0.88rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.source-name {
  overflow: hidden;
  color: var(--kw-text-muted);
  font-size: 0.8rem;
  line-height: 1.15rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.choose-folder-button.p-button),
:deep(.run-import-button.p-button) {
  min-width: 132px;
  height: 44px;
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
}

:deep(.choose-folder-button.p-button) {
  color: var(--kw-text-light);
  border-color: var(--kw-border);
  background: var(--kw-surface);
}

:deep(.choose-folder-button.p-button:enabled:hover) {
  border-color: var(--kw-text-muted);
  background: var(--kw-surface-hover);
}

.destination-row > span,
.completion-row > span {
  color: var(--kw-text-muted);
  font-size: 0.8rem;
  font-weight: 500;
}

.destination-row > strong {
  color: var(--kw-text-light);
  font-size: 0.8rem;
  font-weight: 600;
}

.completion-control {
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
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
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

.completion-control button:disabled {
  cursor: default;
  opacity: 0.7;
}

.article-flow-shell :is(button, summary):focus-visible,
:deep(.article-flow-shell .p-button:focus-visible) {
  outline: 2px solid var(--kw-focus);
  outline-offset: 2px;
}

.plan-section {
  display: grid;
  gap: 14px;
  padding-top: 20px;
}

.plan-counts {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  color: var(--kw-text-muted);
  font-size: 0.74rem;
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
  min-height: 148px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0;
  color: var(--kw-text-disabled);
  border: 1px dashed var(--kw-border);
  border-radius: 10px;
  font-size: 0.82rem;
}

.plan-empty.compact {
  min-height: 80px;
}

.plan-content {
  display: grid;
  gap: 12px;
}

.article-list,
.plan-details ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.article-list {
  display: grid;
  border: 1px solid var(--kw-border);
  border-radius: 10px;
  background: var(--kw-surface);
}

.article-list li {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 8px 12px;
}

.article-list li + li {
  border-top: 1px solid var(--kw-border-subtle);
}

.article-list li > i {
  color: var(--kw-focus);
  font-size: 0.9rem;
}

.article-list li > span {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.article-list strong,
.article-list small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-list strong {
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.15rem;
}

.article-list small {
  color: var(--kw-text-muted);
  font-size: 0.72rem;
  line-height: 1rem;
}

.plan-details {
  border-top: 1px solid var(--kw-border-subtle);
}

.plan-details summary {
  display: flex;
  min-height: 44px;
  align-items: center;
  padding: 10px 2px;
  color: var(--kw-text-muted);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.plan-details ul {
  display: grid;
  gap: 6px;
  padding: 0 2px 12px 20px;
  color: var(--kw-text-muted);
  font-size: 0.74rem;
  line-height: 1.1rem;
}

.article-flow-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  border-top: 1px solid var(--kw-border-subtle);
  background: var(--kw-canvas);
}

.article-flow-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--kw-text-muted);
  font-size: 0.76rem;
  font-weight: 500;
}

.article-flow-status > i {
  width: 14px;
  flex: 0 0 auto;
  color: var(--kw-text-disabled);
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
  color: var(--kw-text-light);
  border-color: var(--kw-focus);
  background: var(--kw-primary);
}

:deep(.run-import-button.p-button:enabled:hover) {
  border-color: var(--kw-text-light);
  background: var(--kw-primary-hover);
}

:deep(.run-import-button.p-button:enabled:active) {
  border-color: var(--kw-primary-pressed);
  background: var(--kw-primary-pressed);
}

@media (max-width: 700px) {
  .article-flow-workspace {
    padding: 16px;
  }

  .command-heading,
  .completion-row {
    align-items: stretch;
    flex-direction: column;
  }

  :deep(.choose-folder-button.p-button),
  .completion-control {
    width: 100%;
  }

  .completion-control {
    grid-template-columns: repeat(2, 1fr);
  }

  .article-flow-footer {
    grid-template-columns: minmax(0, 1fr) 124px;
    padding-inline: 16px;
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
