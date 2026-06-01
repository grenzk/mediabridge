MediaBridge Changelog

June 1, 2026

Changed
- Included the config directory in the project files.

Fixed
- Fixed browser launch reuse so MediaBridge can attach to an already-running CDP browser without opening extra tabs.
- Fixed image linking so inline width and height attributes from dummy image tags are restored after linking.


May 30, 2026

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


May 29, 2026

Changed
- Prepared release version 0.2.2.


May 28, 2026

Fixed
- Fixed source editor updates to avoid filling the entire HTML through Playwright.
- Improved Windows stability when restoring linked files into the article editor.
- Updated the source editor value directly and dispatched input/change events so the article editor recognizes the HTML update without freezing.


May 27, 2026

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
