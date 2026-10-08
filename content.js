(() => {
  if (globalThis.__stabilo) return true;
  if (!globalThis.Highlight || !CSS.highlights) return false;
  globalThis.__stabilo = true;

  // TODO: Persist quotes, surrounding context, and notes in chrome.storage.local.
  // Restoration needs reliable text anchoring and ambiguous-match handling.
  const entries = new Map();
  const paint = new Highlight();
  CSS.highlights.set('stabilo-selection', paint);
  let pendingRange = null;
  let activeEntry = null;
  let selectedEntry = null;
  let returnFocus = null;
  let readingRange = null;
  let lastVisited = null;
  let removedEntry = null;
  let editorAnchor = null;

  const host = document.createElement('div');
  host.lang = 'en';
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0 auto auto 0!important;z-index:2147483647!important;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { color-scheme: light; }
      * { box-sizing: border-box; }
      button, textarea { margin:0; }
      [hidden] { display: none !important; }
      .panel { position:fixed; padding:8px; border:1px solid #ded9c9; border-radius:10px; background:#fffdf7; color:#282820; box-shadow:0 4px 20px #0002; font:14px/1.5 system-ui,sans-serif; max-width:calc(100vw - 16px); }
      button { font:inherit; cursor:pointer; border:0; border-radius:6px; padding:7px 11px; background:#ffe27a; color:#282820; }
      button:focus-visible, textarea:focus-visible { outline:2px solid #786000; outline-offset:2px; }
      button { display:inline-flex; align-items:center; justify-content:center; gap:6px; min-height:32px; line-height:1; }
      button:hover { background:#f5d45f; }
      button:active { background:#ebc64a; }
      button svg { display:block; flex:none; width:18px; height:18px; pointer-events:none; }
      #selection { padding:3px; border-radius:10px; overflow:visible; }
      #highlight { width:32px; height:32px; padding:7px; border-radius:6px; }
      #highlight[data-remove="true"] { background:#fff0db; color:#9c3025; }
      #highlight[data-remove="true"]:hover { background:#ffe0cd; }
      .editor { width:290px; max-height:calc(100dvh - 16px); overflow:auto; }
      .editor-toolbar { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
      label { display:block; font-weight:600; margin:0 0 6px; }
      textarea { display:block; width:100%; min-height:90px; resize:vertical; font:inherit; padding:8px; border:1px solid #817b6c; border-radius:6px; background:white; color:#282820; }
      .hint { font-size:11px; color:#706b5f; margin:6px 0 0; }
      .remove { padding:7px 8px; background:#fff0e9; color:#9c3025; }
      .remove:hover { background:#ffe0d3; }
      .remove:active { background:#ffd0bd; }
      #undo-panel { display:flex; align-items:center; gap:12px; left:16px; bottom:16px; }
      .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
      @media (forced-colors: active) {
        .panel, button, textarea { border:1px solid ButtonText; }
        button:focus-visible, textarea:focus-visible { outline:2px solid Highlight; }
      }
    </style>
    <div class="panel" id="selection" hidden><button type="button" id="highlight" aria-keyshortcuts="Alt+Shift+H" aria-label="Highlight selection" title="Highlight selection"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3 7 7-9 9-7-7Z"/><path d="m5 12-2 5 4 4 5-2M3 21h6"/></svg></button></div>
    <div class="panel editor" id="editor" role="dialog" aria-label="Highlight note" aria-describedby="quote" hidden>
      <p class="sr-only" id="quote"></p>
      <div class="editor-toolbar"><button type="button" class="remove" id="remove" aria-label="Remove highlight" title="Remove highlight"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 3 7 7-11 11H6l-4-4Z"/><path d="m8 11 7 7M10 21h11"/></svg><span>Remove</span></button><button type="button" id="done">Done</button></div>
      <label for="note">Note</label>
      <textarea id="note" aria-describedby="note-hint" placeholder="Add a note…"></textarea>
      <p class="hint" id="note-hint">Saved for this page session. Lost on reload.</p>
    </div>
    <div class="panel" id="undo-panel" hidden><span>Highlight removed</span><button type="button" id="undo">Undo</button></div>
    <div class="sr-only" id="status" role="status" aria-live="polite" aria-atomic="true"></div>`;
  document.documentElement.append(host);
  const selectionPanel = shadow.getElementById('selection');
  const editor = shadow.getElementById('editor');
  const note = shadow.getElementById('note');
  const highlightButton = shadow.getElementById('highlight');
  const undoPanel = shadow.getElementById('undo-panel');
  const undoButton = shadow.getElementById('undo');

  function announce(message) {
    shadow.getElementById('status').textContent = message;
  }

  function rememberFocus(range) {
    if (document.activeElement !== host) returnFocus = document.activeElement;
    readingRange = range;
  }

  function restoreFocus() {
    let target = returnFocus;
    if (!target?.isConnected || target === document.body || target === document.documentElement) {
      const node = readingRange?.startContainer;
      target = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    }
    if (!target?.isConnected) return;
    const temporary = !target.hasAttribute('tabindex') && target.tabIndex < 0;
    if (temporary) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener('blur', () => target.removeAttribute('tabindex'), { once: true });
    }
    target.focus({ preventScroll: true });
  }

  function close(restore = true) {
    const hadFocus = document.activeElement === host;
    selectionPanel.hidden = true;
    editor.hidden = true;
    activeEntry = null;
    if (restore && hadFocus) restoreFocus();
  }

  function openEditor(entry, rect = entry.range.getBoundingClientRect()) {
    dismissUndo();
    rememberFocus(entry.range);
    editorAnchor = entry.range.getBoundingClientRect();
    lastVisited = entry;
    activeEntry = entry;
    selectionPanel.hidden = true;
    note.value = entry.note;
    shadow.getElementById('quote').textContent = `Highlighted text: ${entry.range.toString()}`;
    position(editor, rect);
    note.focus({ preventScroll: true });
  }

  function position(panel, rect) {
    panel.hidden = false;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    panel.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - width - 8))}px`;
    const below = rect.bottom + 6;
    const top = below + height <= innerHeight - 8 ? below : rect.top - height - 6;
    panel.style.top = `${Math.max(8, Math.min(top, innerHeight - height - 8))}px`;
  }

  function editable(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
  }

  function selectedRange() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed || !selection.toString().trim()) return null;
    const range = selection.getRangeAt(0);
    if (editable(range.startContainer) || editable(range.endContainer)) return null;
    // Only ordinary document text; embedded/shadow-root documents are out of scope.
    if (range.startContainer.getRootNode() !== document || range.endContainer.getRootNode() !== document) return null;
    return range.cloneRange();
  }

  function containingEntry(range) {
    return [...entries.values()].reverse().find(entry =>
      entry.range.startContainer.isConnected && entry.range.endContainer.isConnected &&
      entry.range.compareBoundaryPoints(Range.START_TO_START, range) <= 0 &&
      entry.range.compareBoundaryPoints(Range.END_TO_END, range) >= 0);
  }

  function removeEntry(entry) {
    paint.delete(entry.range);
    entries.delete(entry.range);
    removedEntry = entry;
    undoPanel.hidden = false;
    announce('Highlight removed. Press Tab to undo.');
  }

  function dismissUndo() {
    const focused = shadow.activeElement === undoButton;
    undoPanel.hidden = true;
    removedEntry = null;
    if (focused) restoreFocus();
  }

  undoButton.addEventListener('click', () => {
    const entry = removedEntry;
    if (!entry) return;
    const valid = !entry.range.collapsed && entry.range.startContainer.isConnected && entry.range.endContainer.isConnected;
    if (valid) {
      entries.set(entry.range, entry);
      paint.add(entry.range);
    }
    dismissUndo();
    announce(valid ? 'Highlight restored.' : 'This text is no longer available.');
  });

  function offerSelection() {
    if (!editor.hidden) return;
    pendingRange = selectedRange();
    selectionPanel.hidden = !pendingRange;
    selectedEntry = pendingRange ? containingEntry(pendingRange) : null;
    const label = selectedEntry ? 'Remove highlight' : 'Highlight selection';
    highlightButton.title = label;
    highlightButton.setAttribute('aria-label', label);
    highlightButton.dataset.remove = String(Boolean(selectedEntry));
    highlightButton.querySelector('svg').innerHTML = selectedEntry
      ? '<path d="m14 3 7 7-11 11H6l-4-4Z"/><path d="m8 11 7 7M10 21h11"/>'
      : '<path d="m14 3 7 7-9 9-7-7Z"/><path d="m5 12-2 5 4 4 5-2M3 21h6"/>';
    if (pendingRange) {
      rememberFocus(pendingRange);
      // Follow the selection's focus end, including selections dragged backwards.
      const selection = window.getSelection();
      const endpoint = pendingRange.cloneRange();
      endpoint.setStart(selection.focusNode, selection.focusOffset);
      endpoint.collapse(true);
      const rect = [...endpoint.getClientRects()].find(box => box.height > 0);
      position(selectionPanel, rect || pendingRange.getBoundingClientRect());
    }
  }

  // Keep the document selection intact while clicking the floating button.
  shadow.getElementById('highlight').addEventListener('pointerdown', (event) => event.preventDefault());
  shadow.getElementById('highlight').addEventListener('click', () => {
    if (!pendingRange || !pendingRange.startContainer.isConnected || !pendingRange.endContainer.isConnected) return close();
    if (selectedEntry) {
      removeEntry(selectedEntry);
    } else {
      dismissUndo();
      const entry = { range: pendingRange, note: '' };
      entries.set(entry.range, entry);
      paint.add(entry.range);
      announce('Highlight added. Press Alt+Shift+N to edit a highlight note.');
    }
    selectedEntry = null;
    pendingRange = null;
    window.getSelection()?.removeAllRanges();
    close();
  });

  note.addEventListener('input', () => {
    if (activeEntry) activeEntry.note = note.value;
  });
  shadow.getElementById('done').addEventListener('click', () => close());
  shadow.getElementById('remove').addEventListener('click', () => {
    if (activeEntry) {
      removeEntry(activeEntry);
    }
    close();
  });

  document.addEventListener('pointerup', (event) => {
    if (!event.composedPath().includes(host)) setTimeout(offerSelection, 0);
  }, true);
  document.addEventListener('keyup', (event) => {
    if (!event.composedPath().includes(host) && (event.key === 'Shift' || event.key.startsWith('Arrow'))) offerSelection();
  });
  // Non-modal editor: Tab can leave; Escape/Done return to the reading position.
  shadow.addEventListener('focusout', () => {
    setTimeout(() => { if (!shadow.activeElement) close(false); }, 0);
  });
  document.addEventListener('keydown', (event) => {
    if (event.isComposing || event.defaultPrevented) return;
    const inside = event.composedPath().includes(host);
    if (event.key === 'Escape' && (!editor.hidden || !selectionPanel.hidden || !undoPanel.hidden)) {
      event.preventDefault();
      event.stopPropagation();
      close();
      dismissUndo();
      return;
    }
    if (inside || editable(event.target)) return;
    if (event.key === 'Tab' && !event.shiftKey && !selectionPanel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      highlightButton.focus({ preventScroll: true });
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && !undoPanel.hidden) {
      event.preventDefault();
      event.stopPropagation();
      undoButton.focus({ preventScroll: true });
      return;
    }
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
    if (event.code === 'KeyH') {
      offerSelection();
      if (!pendingRange) return;
      event.preventDefault();
      event.stopPropagation();
      highlightButton.click();
    } else if (event.code === 'KeyN') {
      event.preventDefault();
      event.stopPropagation();
      const live = [...entries.values()].filter(entry =>
        entry.range.startContainer.isConnected && entry.range.endContainer.isConnected);
      if (!live.length) { announce('No highlights on this page.'); return; }
      const entry = live[(live.indexOf(lastVisited) + 1) % live.length];
      const node = entry.range.startContainer;
      (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement).scrollIntoView({ block: 'center', behavior: 'instant' });
      openEditor(entry);
    }
  }, true);
  document.addEventListener('pointerdown', (event) => {
    if (!event.composedPath().includes(host)) close(false);
  }, true);
  document.addEventListener('click', (event) => {
    if (event.composedPath().includes(host) || selectedRange()) return;
    // Rectangles follow wrapping and zoom without rewriting the page's DOM.
    for (const entry of [...entries.values()].reverse()) {
      if (!entry.range.startContainer.isConnected || !entry.range.endContainer.isConnected) {
        paint.delete(entry.range);
        entries.delete(entry.range);
        continue;
      }
      const rect = [...entry.range.getClientRects()].find((box) =>
        event.clientX >= box.left && event.clientX <= box.right &&
        event.clientY >= box.top && event.clientY <= box.bottom);
      if (!rect) continue;
      event.preventDefault();
      event.stopPropagation();
      openEditor(entry, { left: event.clientX, top: rect.top, bottom: rect.bottom });
      break;
    }
  }, true);
  document.addEventListener('scroll', (event) => {
    if (event.composedPath().includes(host)) return;
    // Ignore a queued scroll event from keyboard navigation that already
    // positioned the editor at this location.
    if (activeEntry) {
      const rect = activeEntry.range.getBoundingClientRect();
      if (rect.top === editorAnchor.top && rect.left === editorAnchor.left) return;
    }
    close();
  }, true);
  window.addEventListener('resize', () => {
    if (activeEntry) position(editor, activeEntry.range.getBoundingClientRect());
    else close();
  });
  offerSelection();
  return true;
})();
