# KnowledgeWorks Design

Status: In progress

## Summary

KnowledgeWorks will turn the existing MediaBridge desktop application into a modular eGain automation suite. It will provide one compact hub for launching a controlled browser, opening MediaBridge, opening ArticleFlow, viewing logs, and accessing future tools.

The suite will remain one Electron application, one installer per operating system, and one running main process. Each tool will keep its own window, user interface, IPC namespace, and automation workflow.

The migration is incremental. MediaBridge behavior must remain stable while its renderer and linking core move to TypeScript 6. ArticleFlow also uses TypeScript 6 from its first implementation.

## Product Structure

```text
KnowledgeWorks
|-- Global browser control
|-- Global log console
|-- Shared updates and settings
|-- MediaBridge
|   `-- Compact linking toolbar
|-- ArticleFlow
|   `-- Article operations workspace
`-- Future tools
```

### Names

- **KnowledgeWorks** is the visible suite and hub name.
- **MediaBridge** remains the linking tool.
- **ArticleFlow** is the article creation, publishing, archiving, and organization tool.
- **eGain Automation Suite** can appear as a descriptive subtitle where additional context is useful.

## Goals

- Provide one clear entry point for current and future eGain automation tools.
- Share the controlled browser, browser profile, logs, updates, and configuration.
- Keep each tool's UI and automation logic independently understandable.
- Prevent duplicate application, browser, hub, toolbar, and log windows.
- Preserve the existing MediaBridge behavior until each replacement path is verified.
- Continue producing Windows x64 and macOS builds from one codebase.
- Introduce TypeScript without requiring a MediaBridge rewrite.

## Non-Goals

- Rewriting shared Electron platform services solely for language consistency.
- Implementing ArticleFlow automation during the hub foundation work.
- Splitting the tools into separate installers or repositories.
- Renaming every existing IPC channel and file in one change.
- Building a plugin framework or dynamic third-party extension system.
- Changing the browser profile, CDP port, update source, or packaging identity during the initial migration.
- Finalizing every visual detail before the hub behavior is proven.

## Hub Wireframe

The hub should be a compact native utility window, approximately 460 by 300 pixels. Tool entries should be rows rather than dashboard cards.

```text
+----------------------------------------------------+
| KW  KnowledgeWorks        Launch Browser   Logs  * |
+----------------------------------------------------+
| MB  MediaBridge       Linking toolbar         Open |
| AF  ArticleFlow       Article workspace       Open |
| +   Future tool       Coming soon                  |
+----------------------------------------------------+
| [Connected] Browser                         v1.2.0 |
+----------------------------------------------------+
```

The hub should not contain workflow forms, target counts, or automation results. Those belong to the relevant tool.

## Window Model

### Hub Window

- Normal framed utility window.
- Opens once and focuses the existing instance on repeated requests.
- Owns the global browser action and browser connection status.
- Opens or focuses tool windows.
- Opens or focuses the global log console.
- Can be reopened through the dock, taskbar, application menu, or a second application launch.

### MediaBridge Window

- Keeps the existing compact, frameless, always-on-top toolbar behavior.
- Continues to own linking mode selection, target counting, and linking actions.
- Eventually removes its browser Launch button after the hub action is proven.
- May retain a small shortcut to the global log console.

### ArticleFlow Window

- Uses a normal resizable application window.
- Owns article operation forms, validation, batch progress, results, and confirmations.
- Does not launch or manage Chrome directly.
- Uses shared browser and logging services through IPC.

### Log Window

- One global console for the entire suite.
- Opening it again focuses the existing window.
- Remains independent of tool window lifetimes.
- Shows the source, level, timestamp, message, and optional detail.

### Window Lifecycle

- A second KnowledgeWorks launch focuses or recreates the hub.
- Opening a tool that is already open focuses its existing window.
- Closing a tool closes only that tool.
- Closing the hub does not close active tool or log windows.
- Closing the last window quits the application on Windows.
- Activating the application on macOS recreates or focuses the hub.
- Explicit application quit closes every suite window.
- The controlled browser closes on application exit only when `MEDIABRIDGE_CLOSE_BROWSER_ON_EXIT=1`.

## Global Browser Control

Browser control belongs to the Electron main process because every tool uses the same browser session.

### States

```text
idle -> launching -> connected
  ^         |            |
  |         v            v
  +------- error <--- disconnected
```

- **Idle**: no CDP endpoint has been detected.
- **Launching**: Chrome has been spawned and KnowledgeWorks is waiting for CDP.
- **Connected**: the configured CDP endpoint is responding.
- **Disconnected**: a previously available browser is no longer responding.
- **Error**: launching or connecting failed.

### Required Behavior

- Reuse an existing controlled browser when its CDP endpoint is available.
- Deduplicate concurrent launch requests.
- Prevent repeated clicks from creating multiple Chrome windows.
- Continue using the persistent profile under Electron's `userData` directory.
- Keep the configured CDP port and startup timeout behavior.
- Keep bundled Chrome for Testing on Windows and the existing browser discovery behavior on macOS.
- Publish browser status changes to every interested renderer.
- Never close Chrome merely because an individual tool window closes.

### Hub Action

The global action should display one of:

- `Launch Browser`
- `Launching...`
- `Browser Connected`
- `Show Browser` if reliably focusing Chrome can be implemented cross-platform

The first implementation does not require `Show Browser`.

## Global Logging

The existing log collection already lives in the main process. It will become an explicit shared service rather than state embedded in `electron/main.js`.

### Log Entry

```ts
type LogLevel = 'info' | 'success' | 'error'

interface LogEntry {
  id: number
  timestamp: string
  level: LogLevel
  source: 'App' | 'Browser' | 'Updates' | 'MediaBridge' | 'ArticleFlow'
  message: string
  detail?: string
}
```

### Required Behavior

- Keep one bounded in-memory list, initially limited to 500 entries.
- Preserve logs when a tool or the log window closes.
- Publish updates only to active subscribers.
- Accept logs from main-process services, automation workflows, and renderer-facing errors.
- Redact credentials, access tokens, sensitive query values, and browser session data.
- Keep tool status bars concise while sending detailed errors and skipped records to the global console.
- Keep Clear as a global action.

Filtering by source or level can be added later and is not required for the first hub release.

## Main-Process Ownership

The Electron main process remains the suite coordinator.

```text
Electron main process
|-- Application lifecycle
|-- Window registry
|   |-- Hub
|   |-- MediaBridge
|   |-- ArticleFlow
|   `-- Logs
|-- Browser service
|-- Log service
|-- Update service
|-- Settings and runtime configuration
`-- IPC registration
```

The main process should own state that must survive renderer closure. Renderer components should own only presentation and local interaction state.

### Services

- **Window registry** creates, focuses, and closes named windows.
- **Browser service** launches Chrome, checks CDP readiness, and publishes connection state.
- **Log service** stores, clears, and publishes global log entries.
- **Update service** checks, downloads, and installs suite updates.
- **Runtime configuration** resolves paths, ports, timeouts, and environment overrides.

Services should be extracted only when a migration phase needs them. Existing modules should be reused instead of replaced wholesale.

## Renderer Ownership

Each renderer view should have a single purpose:

- `Hub` displays tools and shared environment status.
- `MediaBridge` displays linking controls and compact action state.
- `ArticleFlow` displays article operation workflows.
- `LogConsole` displays global logs.

The existing query-based renderer selection can support the first hub milestone:

```text
?view=hub
?view=mediabridge
?view=article-flow
?view=logs
```

Separate Vite entry points should be introduced only if the shared bundle becomes a measurable problem.

## IPC Boundaries

New shared capabilities should use explicit namespaces:

```text
app:get-version
app:open-tool
app:quit

browser:get-status
browser:launch
browser:status-changed

logs:open
logs:get
logs:clear
logs:write
logs:updated

mediabridge:get-target-count
mediabridge:run-linking
mediabridge:minimize
mediabridge:close

articleflow:<operation>
```

Existing `session:*` and `toolbar:*` channels can remain during migration. They should be renamed only when their callers are moved, with tests around the contract.

### IPC Rules

- Expose capability-specific preload functions rather than raw `ipcRenderer`.
- Validate mode names and structured payloads in the main process.
- Return predictable result objects.
- Convert unknown failures into user-safe messages and detailed global logs.
- Do not expose filesystem, process, shell, or browser internals to renderers.
- Keep `contextIsolation: true` and `nodeIntegration: false`.

## TypeScript Strategy

The KnowledgeWorks application renderer, MediaBridge, and ArticleFlow use strict, isolated TypeScript configurations. Shared Electron platform services can remain JavaScript until converting a service provides a concrete maintenance benefit.

### Initial Toolchain

- TypeScript 6
- Vue Single-File Components with `<script setup lang="ts">`
- `vue-tsc --noEmit` for Vue-aware type checking
- Strict mode for ArticleFlow
- Vite for renderer transpilation

### Scope

TypeScript applies to:

- KnowledgeWorks Hub, Log Console, and renderer composition.
- MediaBridge renderer components and composables.
- MediaBridge linking automation, helpers, domain types, and tool-specific IPC handlers.
- ArticleFlow renderer components and composables.
- ArticleFlow domain models and validation.
- ArticleFlow IPC request and result contracts.
- ArticleFlow automation modules when a main-process TypeScript build target is introduced.

It does not currently require conversion of:

- Suite-wide Electron platform services with stable JavaScript contracts.
- The CommonJS preload boundary.

### Interoperability

- Electron 39 uses Node.js 22 type stripping to execute MediaBridge's erasable TypeScript modules directly.
- MediaBridge runtime imports use explicit `.ts` extensions and avoid TypeScript syntax that requires code generation.
- ArticleFlow TypeScript continues to be transpiled through Vite.
- Type checking remains a build requirement even though Electron can strip types at runtime.
- Shared types should be created only for contracts used by at least two modules.
- Do not duplicate runtime constants as disconnected TypeScript unions; derive types from shared constants where practical.

TypeScript 7 should be reconsidered after its compiler API and Vue tooling integration are stable enough to avoid a side-by-side TypeScript 6 setup.

## Code Organization

KnowledgeWorks uses a modular monolith: one application and installer with explicit ownership boundaries for the suite, shared integrations, and each tool.

```text
electron/
|-- ipc/
|   |-- browser-handlers.js
|   |-- log-handlers.js
|   |-- app-handlers.js
|   `-- toolbar-handlers.js
|-- platform/
|   |-- app-menu.js
|   |-- auto-updater.js
|   |-- browser-service.js
|   |-- log-service.js
|   |-- runtime-icon.js
|   `-- windows.js
|-- tools/
|   `-- mediabridge/
|       |-- handlers.js
|       `-- unlinked-target-logs.js
|-- preload.cjs
`-- main.js

src/
|-- app/
|   `-- renderer/
|       |-- Hub.vue
|       |-- LogConsole.vue
|       |-- main.ts
|       `-- styles.css
|-- shared/
|   |-- browser/
|   |-- config/
|   |-- egain/
|   |   `-- editor/
|   `-- types/
`-- tools/
    |-- articleflow/
    |   `-- renderer/
    `-- mediabridge/
        |-- automation/
        |-- helpers/
        |-- renderer/
        `-- scripts/

tests/
|-- electron/
|   `-- platform/
`-- tools/
    `-- mediabridge/
```

### Dependency Rules

- `src/app` may compose tool renderers and shared contracts.
- A tool may depend on `src/shared`, but tools must not import from one another.
- `src/shared` must not depend on a specific tool.
- `electron/platform` owns suite-wide desktop services and must not contain tool workflows.
- Tool-specific IPC orchestration belongs under `electron/tools/<tool>`.
- Tests mirror the production ownership boundary they verify.
- Code moves to `shared` only after it represents a stable suite-level integration or is used by more than one tool.

## Packaging and Portability

KnowledgeWorks remains portable as one shared codebase with platform-specific outputs:

- Windows x64 NSIS installer and ZIP.
- macOS DMG and ZIP for the supported architecture.
- Windows continues bundling Chrome for Testing.
- macOS continues using an installed supported browser unless bundling requirements change.
- Native icon formats remain `.ico` for Windows and `.icns` for macOS.

One executable cannot run unchanged on both operating systems. Portability means both builds come from the same source and expose the same suite behavior.

### Identity and Updates

During development and the initial migration:

- Keep `appId` as `com.mediabridge.toolbar`.
- Keep the existing GitHub Releases update source.
- Keep the existing browser profile path and environment variable names.
- Keep the package name until the KnowledgeWorks release is ready.

The visible product name can change to KnowledgeWorks for the major release. Technical identifier migration should be handled separately so existing installations continue updating rather than installing a duplicate application.

## Migration Plan

### Phase 1: Design Baseline

- Approve this document.
- Confirm the compact hub behavior and tool names.
- Make no runtime changes.

### Phase 2: Hub Shell

- Add a Hub renderer view.
- Add a Hub `BrowserWindow`.
- Add an IPC action that opens or focuses the existing MediaBridge toolbar.
- Show ArticleFlow as unavailable.
- Keep MediaBridge as the default startup window.

Acceptance:

- MediaBridge starts and behaves exactly as before.
- The hub can be opened in development.
- Repeated Hub or MediaBridge opens focus existing windows.

### Phase 3: Shared Browser Status

- Evolve the browser process controller into a shared browser service.
- Add browser status IPC and subscriptions.
- Add the global Launch Browser action to the hub.
- Keep the MediaBridge Launch button temporarily.

Acceptance:

- Either launch button reaches the same deduplicated browser service.
- Repeated clicks do not create duplicate browser windows.
- Closing any renderer does not close Chrome.

### Phase 4: Shared Logging

- Extract log state from `electron/main.js` into a log service.
- Rename the visible console to KnowledgeWorks Logs.
- Add the log action to the hub.
- Preserve existing MediaBridge log behavior.

Acceptance:

- Logs survive closing and reopening the log window.
- Browser, updates, app, and MediaBridge logs appear in one console.
- Only one log window exists.

### Phase 5: Hub Becomes the Entry Point

- Start the Hub by default.
- Open MediaBridge from the Hub.
- Remove the MediaBridge Launch button.
- Resize MediaBridge only after the control removal is reviewed.

Acceptance:

- Existing MediaBridge workflows remain unchanged after opening the toolbar.
- Users can reopen the Hub while a tool is active.
- Application second-instance behavior focuses the Hub.

### Phase 6: TypeScript 6 Foundation

- Add TypeScript 6 and `vue-tsc`.
- Add a strict ArticleFlow-specific TypeScript configuration.
- Add type-check scripts without enabling `checkJs` for MediaBridge.
- Add an unavailable ArticleFlow renderer shell.

Acceptance:

- Existing JavaScript builds without new diagnostics.
- ArticleFlow type checking runs independently.
- Tests, development startup, and packaging continue to work.

### Phase 7: ArticleFlow MVP

- Define the first ArticleFlow operation separately.
- Add its domain types, UI, IPC contract, automation, tests, and logs.
- Keep unrelated future operations out of the first release.

## Testing Strategy

Every phase must pass:

- Existing Vitest unit tests.
- Production renderer build.
- MediaBridge smoke test in development.
- Single-instance and duplicate-window checks.
- Browser reuse and first-launch checks.
- Unpacked Electron packaging on the development platform.

Before the KnowledgeWorks release:

- Test Windows x64 installer creation and upgrade behavior.
- Test macOS packaging.
- Verify the bundled Windows Chrome path and persistent profile.
- Verify update checks against a test release.
- Verify hub, toolbar, and log window close/reopen behavior.
- Verify no renderer has Node integration.

## Versioning

Development continues from MediaBridge `1.2.x`.

The first release that starts in the KnowledgeWorks hub and presents multiple tools should be `2.0.0` because it changes the product entry point and application structure. Internal foundation commits do not require a major version until that user-facing transition ships.

## Decision Record

The current decisions are:

1. Use one repository and one installer per platform.
2. Use KnowledgeWorks as the suite name.
3. Keep MediaBridge and ArticleFlow as separate tool windows.
4. Make browser control and logging global.
5. Keep MediaBridge behavior unchanged while migrating its owned modules incrementally to TypeScript.
6. Use TypeScript 6 for the KnowledgeWorks renderer, MediaBridge, and ArticleFlow with separate strict configurations.
7. Preserve the existing app identity and update channel until migration testing is complete.
8. Deliver the change through small, reversible phases.
