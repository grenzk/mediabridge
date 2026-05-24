# Chrome for Testing

Place the Windows 64-bit Chrome for Testing contents in this folder so the app
can launch a browser that is not controlled by enterprise Chrome policies.

Expected development path:

```text
vendor/chrome-win64/chrome.exe
```

During packaging, Electron Builder copies this folder to:

```text
resources/chrome-win64/chrome.exe
```

The executable must remain outside `app.asar`, because Chromium needs to run as
a real filesystem executable.
