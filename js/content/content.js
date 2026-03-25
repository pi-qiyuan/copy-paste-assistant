(function() {
  let floatingIcon = null;
  let dropdownPanel = null;
  let lastFocusedElement = null;
  let hideTimeout = null;

  // 1. Listen for input focus
  document.addEventListener('focusin', (e) => {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) return;

    chrome.storage.sync.get({ showFloatingButton: true }, (result) => {
      if (chrome.runtime.lastError || !result.showFloatingButton) return;

      const el = e.target;
      const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
      const isContentEditable = el.contentEditable === 'true' || el.designMode === 'on';

      if (isInput || isContentEditable) {
        // Exclude types not suitable for floating widget
        if (el.type === 'password' || el.type === 'checkbox' || el.type === 'radio') return;
        
        clearTimeout(hideTimeout);
        lastFocusedElement = el;
        showIcon(el);
      }
    });
  });

  // Safe i18n helper
  function getI18nMsg(key, substitutions) {
    if (typeof chrome !== 'undefined' && chrome.i18n) {
      return chrome.i18n.getMessage(key, substitutions) || key;
    }
    return key;
  }

  document.addEventListener('focusout', () => {
    // Delay hiding to allow time for icon clicks
    hideTimeout = setTimeout(() => {
      if (floatingIcon && dropdownPanel?.style.display !== 'block') {
        floatingIcon.style.display = 'none';
      }
    }, 200);
  });

  // 2. Create and show icon
  function showIcon(el) {
    if (!floatingIcon) {
      floatingIcon = document.createElement('div');
      floatingIcon.className = 'cpa-floating-icon';
      floatingIcon.innerText = '📋';
      floatingIcon.title = getI18nMsg('content_floating_title');
      document.body.appendChild(floatingIcon);

      floatingIcon.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent loss of focus
        togglePanel();
      });
    }

    const rect = el.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // Smart positioning: try to place it to the right of the input to avoid blocking content
    const iconSize = 20;
    const margin = 4;
    let topPos, leftPos;

    // Vertical center for small inputs, top-aligned for large ones (like textareas)
    if (rect.height > 40) {
      topPos = rect.top + scrollTop + 8;
    } else {
      topPos = rect.top + scrollTop + (rect.height - iconSize) / 2;
    }

    // Check if there's enough space on the right
    if (rect.right + iconSize + margin < window.innerWidth) {
      leftPos = rect.right + scrollLeft + margin;
    } else {
      // If no space on right, place it inside the input at the right edge
      leftPos = rect.right + scrollLeft - iconSize - margin;
    }

    floatingIcon.style.top = topPos + 'px';
    floatingIcon.style.left = leftPos + 'px';
    floatingIcon.style.display = 'flex';
  }

  // 3. Toggle panel visibility
  function togglePanel() {
    if (dropdownPanel && dropdownPanel.style.display === 'block') {
      dropdownPanel.style.display = 'none';
      return;
    }

    if (!dropdownPanel) {
      dropdownPanel = document.createElement('div');
      dropdownPanel.className = 'cpa-dropdown-panel';
      document.body.appendChild(dropdownPanel);
      
      // Close when clicking outside
      document.addEventListener('mousedown', (e) => {
        if (dropdownPanel && !dropdownPanel.contains(e.target) && e.target !== floatingIcon) {
          dropdownPanel.style.display = 'none';
        }
      });
    }

    // Update panel position
    const iconRect = floatingIcon.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    dropdownPanel.style.top = (iconRect.bottom + scrollTop + 5) + 'px';
    dropdownPanel.style.left = (iconRect.left + scrollLeft - 190) + 'px';

    // Load data and render
    chrome.storage.sync.get({ items: [], recentItemIds: [] }, (result) => {
      if (chrome.runtime.lastError) return;
      renderPanelContent(result.items, result.recentItemIds);
    });

    dropdownPanel.style.display = 'block';
  }

  // 4. Render panel content
  function renderPanelContent(items, recentItemIds) {
    dropdownPanel.innerHTML = `<div class="cpa-section-title">${getI18nMsg('recently_used')}</div>`;
    
    const recentItems = recentItemIds
      .map(id => items.find(i => i.id === id))
      .filter(i => !!i);

    if (recentItems.length === 0) {
      dropdownPanel.innerHTML += `<div class="cpa-no-data">${getI18nMsg('content_no_usage')}</div>`;
    } else {
      recentItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cpa-item';
        const previewText = escapeHtml(item.content.substring(0, 10));
        const previewHtml = `<span class="cpa-item-content">${getI18nMsg('content_preview_format', [previewText])}</span>`;
        itemEl.innerHTML = `${escapeHtml(item.name || getI18nMsg('unnamed_item'))} ${previewHtml}`;
        itemEl.addEventListener('click', () => {
          insertContent(item.content, item.id);
          dropdownPanel.style.display = 'none';
        });
        dropdownPanel.appendChild(itemEl);
      });
    }

    // More categories can be added here...
  }

  // 5. Insertion logic
  function insertContent(text, itemId) {
    if (!lastFocusedElement) return;

    const el = lastFocusedElement;
    const isInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
    const isContentEditable = el.contentEditable === 'true' || el.designMode === 'on';

    if (isInput) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const value = el.value;
      el.value = value.slice(0, start) + text + value.slice(end);
      el.selectionStart = el.selectionEnd = start + text.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (isContentEditable) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
      }
    }

    // Record usage
    chrome.storage.sync.get({ recentItemIds: [] }, (result) => {
      if (chrome.runtime.lastError) return;
      let ids = result.recentItemIds.filter(id => id !== itemId);
      ids.unshift(itemId);
      if (ids.length > 10) ids = ids.slice(0, 10);
      chrome.storage.sync.set({ recentItemIds: ids });
    });
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

})();
