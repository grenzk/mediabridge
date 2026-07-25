# KnowledgeWorks

KnowledgeWorks is a desktop automation hub for eGain workflows. Its first tool,
MediaBridge, links documents, images, and articles from source systems into the
eGain article editor.

## What It Does

- Opens a shared controlled Chromium browser for KnowledgeWorks tools.
- Opens or focuses MediaBridge from a compact tool hub.
- Counts links in the article editor source, including matching document links.
- Runs the existing media-linking workflow that inserts media-library document
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

## Testing

Run the focused automation unit tests with:

```sh
npm test
```

To display every individual test in the terminal, run:

```sh
npm run test:verbose
```

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
