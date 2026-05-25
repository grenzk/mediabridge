# MediaBridge

MediaBridge is an Electron toolbar for running the media-linking automation
against an open article editor and media library.

## What It Does

- Opens a controlled Chromium browser for the pages you want to automate.
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

Use the browser button in the toolbar, then open the article page and media page
in that browser before counting links or running the script.

You can still run the original command-line automation with:

```sh
npm run script:media-linking
```

That command expects `CDP_URL` in your environment.

## Desktop Builds

```sh
npm run package
npm run dist:mac
npm run dist:win
```

Electron supports Windows and macOS. Cross-building Windows installers from
macOS may require additional signing or packaging tools depending on the target.
