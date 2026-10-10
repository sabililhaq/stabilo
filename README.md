# Stabilo

A minimal Chrome/Edge extension to highlight text, add an optional note, and remove highlights.

## Why?

As a non-native English speaker, I sometimes find articles with advanced vocabulary difficult to follow. Highlighting key passages and putting their meaning into my own words helps me understand what I read.

Existing tools like Web Highlights already do this well. I just want something smaller and simpler for my own reading: highlighting and notes, with very little else.

## Install

1. Download this repository (**Code → Download ZIP**) and extract it, or clone it.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.

## Use

Open an article. Stabilo activates automatically—select text and click the small marker icon below where you released the pointer. Click a highlight to add or edit a note, or remove it. You can also select text within an existing highlight and click the eraser icon to remove that highlight.

After removing a highlight, click **Undo** (or press Tab, then Enter) to restore it and its note. Undo stays available for four seconds, or until your next highlight action or Escape. Scrolling the article closes the note editor.

**Highlights and notes are temporary and disappear on reload or when you leave the page.** Regular web pages only; PDFs and browser pages aren't supported.

Allow site access for Stabilo to run automatically. You can restrict access to specific sites in your browser’s extension settings. After installing or updating, refresh any already-open articles.

No account, backend, or build step. Everything stays in your browser.

## Keyboard

Select text (Shift + arrow keys, or browser caret browsing), then press Tab and Enter to highlight or erase. You can also use **Alt+Shift+H**. Press **Alt+Shift+N** to cycle through existing highlight notes. Close a note before using the shortcut again. Escape or Done returns focus to the article; Tab can leave the note editor. Shortcuts do not run in editable fields.

## TODO

- Save highlights and notes locally with `chrome.storage.local`.
- Restore them when revisiting an article.

## Development

Open `tests/browser.html` in Chrome to run the interaction smoke test. Run `python3 package.py` to create a ZIP in `dist/`.

Accessibility checks cover keyboard handlers, focus restoration, descriptions, and live-region updates in Chrome. Manual VoiceOver/NVDA verification is still pending.
