(async () => {
  const status = document.getElementById('status');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      css: '::highlight(stabilo-selection) { background-color: #ffe27a; color: #242018; }',
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
    status.textContent = results[0]?.result === true
      ? 'Ready. Select text to highlight it. Click a highlight to add a note or remove it.'
      : 'This page does not support highlighting. Try a regular article in an updated browser.';
  } catch {
    status.textContent = 'Cannot run on this page. Try a regular website; browser pages, extension stores, and the built-in PDF viewer are not supported.';
  }
})();
