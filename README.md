# KnowledgeWorks

KnowledgeWorks is a desktop automation hub for eGain workflows. Its first tool,
MediaBridge, links documents, images, and articles from source systems into the
eGain article editor.

## What It Does

- Opens a shared controlled Chromium browser for KnowledgeWorks tools.
- Opens or focuses MediaBridge from a compact tool hub.
- Counts links in the article editor source, including matching document links.
- Runs the existing media-linking workflow that inserts media server document
  links into matching article text and adds the selected document class to those
  anchors.
- Provides a compact floating toolbar inspired by QuickTime and snipping-tool
  controls.

## Development

```sh
npm install
npm run dev
```

Use the browser button in the KnowledgeWorks Hub, then open MediaBridge. Open the
article page and media page in the controlled browser before counting links or
running the script.

The planned architecture and incremental migration are documented in
[KnowledgeWorks Design](docs/KNOWLEDGEWORKS_DESIGN.md).

You can still run the original command-line automation with:

```sh
npm run script:media-linking
```

That command connects to `MEDIABRIDGE_CDP_PORT`, or port `9222` by default.

The ArticleFlow prototype reads a filesystem taxonomy and prints its import plan
without changing eGain:

```sh
npm run script:articleflow -- --root "Sample Product"
```

The selected root directory is created under the eGain folder currently selected
in the controlled browser. ArticleFlow recreates missing folders recursively and
creates an article for each `.htm` or `.html` file. Execution is opt-in, and
check-in is the default final action:

```sh
npm run script:articleflow -- --root "Sample Product" --action check-in --execute
```

Before execution, select the intended parent folder in the controlled eGain
browser without selecting an article. ArticleFlow uses that folder's context
menu when it needs to add a direct child, then verifies the destination shown in
the New Article dialog before creating each article.

ArticleFlow scans every article-list page in each destination folder before
creating content. An exact title match is treated as an existing article and is
skipped, so interrupted imports can be run again without overwriting completed
articles.

Use `--action publish` only when every planned article should be published.

## Testing

Run the focused automation unit tests with:

```sh
npm test
```

To display every individual test in the terminal, run:

```sh
npm run test:verbose
```

Run the strict TypeScript check for the KnowledgeWorks renderer, Electron code,
shared modules, MediaBridge, ArticleFlow, and tests with:

```sh
npm run typecheck
```

Use Node.js 22.18 or newer when running the MediaBridge command-line automation
directly from source. Packaged applications use the Node.js runtime embedded in
Electron.

The suite covers linking mode configuration, target classification, linked-state
detection, and skipped-target log formatting. Browser-driven eGain workflows
still require manual testing against the controlled browser.

## Desktop Builds

```sh
npm run package
npm run dist:mac
npm run dist:win
```

Electron supports Windows and macOS. Cross-building Windows installers from
macOS may require additional signing or packaging tools depending on the target.
