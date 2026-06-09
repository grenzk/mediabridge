MediaBridge Changelog

1.1.0 - June 9, 2026

Added
- Added Article linking mode for resolving eGain article ID placeholders from the article editor.
- Added article placeholder extraction for anchor href values containing ECV3 article IDs.
- Added editor locators for the Link Article toolbar button and Select Link Article modal.

Changed
- Updated linking automation so Article mode runs entirely inside the article editor without requiring the media server page.
- Updated toolbar linking options to include Article.
- Updated linking logs to describe generic targets instead of media-only files.
- Prepared release version 1.1.0.


1.0.2 - June 8, 2026

Changed
- Added an update-ready dialog so users can restart MediaBridge after an update downloads.
- Added a status bar version badge for easier installed-version checks.
- Refined the version badge layout and accessibility label.
- Prepared release version 1.0.2.


1.0.1 - June 7, 2026

Changed
- Added a startup log entry that shows the running MediaBridge version.
- Added GitHub Releases as the update source for packaged builds.
- Added startup update checks with status written to the log console.
- Removed the menu bar on Windows and Linux.
- Simplified the macOS app menu by removing Help and Services.
- Kept only Copy and Select All in the macOS Edit menu for log viewing.
- Prepared release version 1.0.1.

Fixed
- Fixed counter label clipping when Image mode is selected.


1.0.0 - June 6, 2026

Added
- Added native macOS and Windows app icons.

Changed
- Updated the toolbar logo to match the app icon.
- Improved toolbar typography and action alignment.
- Added run mode chevron rotation when the selector is open.
- Prepared release version 1.0.0.

Fixed
- Preserved source media attributes when restoring linked files.
- Preserved document class names such as drawing and downloadable markers.
- Preserved image style attributes from dummy image tags.


June 2, 2026

Fixed
- Fixed source HTML restoration so top-level commented metadata is preserved after linking.


0.3.0 - June 1, 2026

Added
- Added a separate log console window for viewing action details and errors.
- Added toolbar access to open and clear logs.

Changed
- Included the config directory in the project files.
- Prepared release version 0.3.0.

Fixed
- Fixed browser launch reuse so MediaBridge can attach to an already-running CDP browser without opening extra tabs.
- Fixed image linking so inline width and height attributes from dummy image tags are restored after linking.
- Fixed log output for image counts so it shows the actual number of unlinked image targets.


0.2.3 - May 30, 2026

Changed
- Increased the default browser startup wait time to reduce first-launch timing failures.
- Replaced CDP_URL with MEDIABRIDGE_CDP_PORT as the configurable browser connection setting.
- Added shared runtime helpers for deriving the CDP port and default CDP URL.
- Added .env.example listing available MediaBridge environment variables.
- Updated the CLI media-linking script to use the same CDP port behavior as the desktop app.
- Updated documentation to describe MEDIABRIDGE_CDP_PORT usage.
- Prepared release version 0.2.3.

Fixed
- Fixed reconnect behavior so MediaBridge can derive the browser CDP URL from the configured port.
- Fixed browser startup failures caused by Chrome taking longer to expose the remote debugging endpoint.
- Improved the missing article page error by showing which browser tabs MediaBridge can see.


0.2.2 - May 29, 2026

Changed
- Prepared release version 0.2.2.


May 28, 2026

Fixed
- Fixed source editor updates to avoid filling the entire HTML through Playwright.
- Improved Windows stability when restoring linked files into the article editor.
- Updated the source editor value directly and dispatched input/change events so the article editor recognizes the HTML update without freezing.


0.2.1 / 0.2.0 - May 27, 2026

Added
- Added image media linking support.
- Replaced the disabled Article option with Image.
- Added support for linking JPG, JPEG, PNG, and GIF images from the media library.
- Added image extraction from article editor HTML.
- Added image highlighting in the editor before inserting inline images.
- Added support for inserting media as inline images instead of links when Image mode is selected.
- Added animated busy dots while MediaBridge is counting or running.

Changed
- Updated article link targeting to use anchor elements instead of matching text nodes.
- Improved reliability when articles contain duplicate link text.
- Widened the toolbar counter so longer labels such as Image fit better.
- Updated counter/status behavior for the selected linking mode.
- Prepared release version 0.2.0.
- Prepared release version 0.2.1.

Fixed
- Fixed duplicate text matching issues by targeting article anchors directly.
- Fixed already-linked media targets being included in future linking runs.
- Fixed repeated runs by skipping links and images already pointing to the media service.
- Fixed missing media files stopping the entire process.
- Fixed linking so missing files are skipped and the rest of the files continue processing.
- Fixed the link/image counter resetting when the selected linking mode changes.
