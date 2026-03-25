/**
 * Utility Functions Module
 */

/**
 * Escape HTML characters to prevent XSS
 * @param {string} text 
 * @returns {string}
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Highlight matching text in search results
 * @param {string} text 
 * @param {string} query 
 * @returns {string}
 */
function highlightText(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Debounce function to limit execution frequency
 * @param {Function} func 
 * @param {number} wait 
 * @returns {Function}
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Show a toast notification
 * @param {string} message 
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

/**
 * Copy text to clipboard
 * @param {string} text 
 * @param {HTMLElement} btn - The button clicked, used to show feedback
 */
function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const oldText = btn.innerHTML;
    btn.innerHTML = `<span>✔</span> ${chrome.i18n.getMessage('status_copied')}`;
    setTimeout(() => {
      btn.innerHTML = oldText;
    }, 1500);
  }).catch(err => {
    console.error('Clipboard copy failed:', err);
  });
}

/**
 * Insert text into the active page's input field
 * @param {string} text 
 * @param {HTMLElement} btn - The button clicked, used to show feedback
 */
async function insertToPage(text, btn) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (textToInsert) => {
        const activeEl = document.activeElement;
        if (!activeEl) return false;
        const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
        const isContentEditable = activeEl.contentEditable === 'true' || activeEl.designMode === 'on';
        if (isInput) {
          const start = activeEl.selectionStart;
          const end = activeEl.selectionEnd;
          activeEl.value = activeEl.value.slice(0, start) + textToInsert + activeEl.value.slice(end);
          activeEl.selectionStart = activeEl.selectionEnd = start + textToInsert.length;
          activeEl.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        } else if (isContentEditable) {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(document.createTextNode(textToInsert));
            range.collapse(false);
            return true;
          }
        }
        return false;
      },
      args: [text]
    });

    if (results && results[0].result) {
      const oldText = btn.innerHTML;
      btn.innerHTML = `<span>✔</span> ${chrome.i18n.getMessage('status_inserted')}`;
      setTimeout(() => {
        btn.innerHTML = oldText;
      }, 1500);
    } else {
      alert(chrome.i18n.getMessage('alert_no_input_box'));
    }
  } catch (e) {
    console.error('Insert failed:', e);
    alert(chrome.i18n.getMessage('alert_insert_failed'));
  }
}

/**
 * Initialize internationalization for the current document
 * Supports [data-i18n], [data-i18n-placeholder], and [data-i18n-title]
 */
function initI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = chrome.i18n.getMessage(key);
    if (message) el.textContent = message;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const message = chrome.i18n.getMessage(key);
    if (message) el.placeholder = message;
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const message = chrome.i18n.getMessage(key);
    if (message) el.title = message;
  });
}
