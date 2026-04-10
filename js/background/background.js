// Import storage management logic
importScripts('../core/storage-manager.js');

const ROOT_MENU_ID = "copy_paste_root";

const ADD_TO_ASSISTANT_ID = "addToAssistant";
const RECENT_MENU_ID = "recent_usage";
const ITEM_PREFIX = "item_";

// Debouncing and locking to prevent concurrent updates
let isUpdating = false;
let updateTimeout = null;

// Update context menus with debouncing
function updateContextMenusDebounced() {
  if (updateTimeout) clearTimeout(updateTimeout);
  updateTimeout = setTimeout(updateContextMenus, 150);
}

// Update context menus
function updateContextMenus() {
  if (isUpdating) {
    updateContextMenusDebounced();
    return;
  }
  isUpdating = true;

  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) { }

    // 1. Create root menu
    chrome.contextMenus.create({
      id: ROOT_MENU_ID,
      title: chrome.i18n.getMessage('extension_name'),
      contexts: ["selection", "editable"]
    }, () => {
      if (chrome.runtime.lastError) { /* Ignore duplicate or other errors */ }
    });

    // 2. Add "Add to Assistant" menu
    chrome.contextMenus.create({
      id: ADD_TO_ASSISTANT_ID,
      parentId: ROOT_MENU_ID,
      title: chrome.i18n.getMessage('ctx_add_to_assistant'),
      contexts: ["selection"]
    }, () => {
      if (chrome.runtime.lastError) { /* Ignore duplicate or other errors */ }
    });

    // 3. Dynamically load categories, items, and recently used
    StorageManager.getData((result) => {
      const { categories, items, recentItemIds } = result;

      // --- 3.1 Create "Recently Used" submenu ---
      chrome.contextMenus.create({
        id: RECENT_MENU_ID,
        parentId: ROOT_MENU_ID,
        title: chrome.i18n.getMessage('recently_used'),
        contexts: ["editable"]
      }, () => {
        if (chrome.runtime.lastError) { /* Ignore duplicate or other errors */ }
      });

      const recentItems = (recentItemIds || [])
        .map(id => items.find(i => i.id === id))
        .filter(i => !!i);

      if (recentItems.length === 0) {
        chrome.contextMenus.create({
          id: "recent_empty",
          parentId: RECENT_MENU_ID,
          title: chrome.i18n.getMessage('ctx_no_records'),
          enabled: false,
          contexts: ["editable"]
        }, () => {
          if (chrome.runtime.lastError) { /* Ignore duplicate or other errors */ }
        });
      } else {
        recentItems.forEach((item, index) => {
          const displayTitle = item.name || (item.content.substring(0, 20) + chrome.i18n.getMessage('ellipsis'));
          chrome.contextMenus.create({
            id: ITEM_PREFIX + "recent_" + item.id + "_" + index,
            parentId: RECENT_MENU_ID,
            title: displayTitle,
            contexts: ["editable"]
          }, () => {
            if (chrome.runtime.lastError) { /* Ignore duplicate or other errors */ }
          });
        });
      }

      // --- 3.2 Create menus by category ---
      categories.forEach(category => {
        const categoryMenuId = "cat_" + category.id;
        chrome.contextMenus.create({
          id: categoryMenuId,
          parentId: ROOT_MENU_ID,
          title: category.name,
          contexts: ["editable"]
        }, () => {
          if (chrome.runtime.lastError) { /* Ignore duplicate or other errors */ }
        });

        const categoryItems = items.filter(item => (item.categoryId || 'default') === category.id);
        if (categoryItems.length === 0) {
          chrome.contextMenus.create({
            id: "empty_" + category.id,
            parentId: categoryMenuId,
            title: chrome.i18n.getMessage('ctx_no_items'),
            enabled: false,
            contexts: ["editable"]
          }, () => {
            if (chrome.runtime.lastError) { /* Ignore duplicate or other errors */ }
          });
        } else {
          categoryItems.forEach((item, index) => {
            const displayTitle = item.name || (item.content.substring(0, 20) + chrome.i18n.getMessage('ellipsis'));
            chrome.contextMenus.create({
              id: ITEM_PREFIX + item.id + "_" + index,
              parentId: categoryMenuId,
              title: displayTitle,
              contexts: ["editable"]
            }, () => {
              if (chrome.runtime.lastError) { /* Ignore duplicate or other errors */ }
            });
          });
        }
      });
      
      isUpdating = false;
    });
  });
}

// Listen for installation and startup
chrome.runtime.onInstalled.addListener(updateContextMenus);
chrome.runtime.onStartup.addListener(updateContextMenus);

// Listen for storage changes to update menus in real-time
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && (changes.items || changes.categories || changes.recentItemIds)) {
    updateContextMenusDebounced();
  }
});

// Listen for menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === ADD_TO_ASSISTANT_ID) {
    // Handle "Add to Assistant"
    const selectedText = info.selectionText;
    if (selectedText) {
      chrome.storage.local.set({
        pendingItem: {
          name: '',
          content: selectedText
        }
      }, () => {
        // Open a standalone popup window
        chrome.windows.create({
          url: 'popup.html',
          type: 'popup',
          width: 440,
          height: 620,
          focused: true
        });
      });
    }
  } else if (info.menuItemId.startsWith(ITEM_PREFIX)) {
    // Handle item click for insertion
    const parts = info.menuItemId.split('_');
    const itemId = parts[parts.length - 2]; // Second to last is ID
    
    chrome.storage.sync.get({ items: [] }, (result) => {
      const item = result.items.find(i => i.id === itemId);
      if (item) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (text) => {
            const el = document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
              const start = el.selectionStart;
              const end = el.selectionEnd;
              el.value = el.value.slice(0, start) + text + el.value.slice(end);
              el.selectionStart = el.selectionEnd = start + text.length;
              el.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (el && (el.contentEditable === 'true' || el.designMode === 'on')) {
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(text));
                range.collapse(false);
              }
            }
          },
          args: [item.content]
        });
        // Update recently used
        StorageManager.trackUsage(itemId);
      }
    });
  }
});
