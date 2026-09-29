# Stabilo

A tiny Chrome/Edge extension for reading difficult passages: highlight text, attach a plain-language note, and keep reading.

No dependencies, build step, account, analytics, network requests, or backend. One highlight color. **Everything is temporary: reloading or leaving the document loses highlights and notes.**

## Install locally

1. Download and extract the release ZIP, or clone this repository.
2. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge).
3. Enable **Developer mode**, choose **Load unpacked**, and select this folder (the one containing `manifest.json`).
4. Keep that folder on your computer. Pin Stabilo from the browser's Extensions menu for easy access.

To update, replace the files in the same folder and click Reload on the extension card. Reload your article afterward; existing temporary highlights will be lost.

## Read and highlight

1. Open an ordinary web article and click the extension icon to enable highlighting for that document. Close the popup.
2. Select a word or passage, then click **Highlight**. Selections can span inline formatting and paragraphs.
3. Click the highlighted text to write or edit an optional note. Notes update as you type; **Done**, Escape, or clicking outside closes the editor.
4. Click **Remove highlight** in the editor to delete that highlight and its note.

Only `activeTab` and `scripting` permissions are requested. Clicking the icon grants access to that page; the extension does not automatically run on every website. Enable it again after navigating or reloading.

## Scope and limitations

- Current desktop Chrome and Edge; CSS Custom Highlight API required (Chrome 105+).
- Regular document text only. Browser-internal pages, extension stores, built-in PDF viewers, iframe contents, shadow-root text, and editable fields are outside this version's scope.
- Websites that replace article text dynamically may invalidate highlights. There is no restoration or anchoring yet.
- Overlapping highlights are allowed; clicking opens the newest overlapping highlight first.
- Selection can use the mouse or Shift + arrow keys. Editing an existing highlight currently requires clicking it.

## Files

- `manifest.json`: Manifest V3, permissions, and toolbar popup.
- `popup.*`: activation and readable status/error feedback.
- `content.js`: in-memory ranges and notes, CSS Highlight registry, and isolated floating controls.

Highlights use browser text ranges without wrapping or modifying article elements. Floating controls live in a shadow root to isolate their styles.

## Package for GitHub Releases

From this directory:

```sh
python3 package.py
```

This creates `dist/stabilo-0.1.0.zip`. Upload it as a GitHub release asset. Users extract the ZIP before choosing **Load unpacked**. GitHub releases do not provide automatic browser updates; publishing to the Chrome Web Store can come later.

## TODO

- Persist highlights and notes in `chrome.storage.local` (extension-owned storage, not website `localStorage`).
- Restore by page URL, exact quote, surrounding text, and position hints; leave ambiguous or missing passages unresolved.
- Add keyboard access to existing highlights.
- Consider store publishing after testing the everyday reading workflow.

## Manual smoke test

The repository also includes `tests/browser.html`: open it in Chrome to run nine automated interaction checks against the real content script. This checks browser behavior, not extension installation or permissions; verify those by loading the unpacked extension.

- Activate on an article, including a selection made before activation.
- Highlight across a link/bold text and across paragraphs; check that layout stays intact.
- Add a note, dismiss/reopen, edit it, and remove the highlight.
- Make overlapping highlights, remove the newer one, and verify the older remains.
- Scroll, resize, select with Shift + arrows, and dismiss with Escape.
- Confirm typing in an input or editable region does not offer highlighting.
- Reopen the extension popup several times: controls should not duplicate.
- Reload: all highlights and notes should disappear.
- Open on `chrome://extensions`: confirm a readable unsupported-page message.
