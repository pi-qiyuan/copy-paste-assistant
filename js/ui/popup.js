document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const elements = {
    addBtn: document.getElementById('addBtn'),
    itemNameInput: document.getElementById('itemName'),
    itemContentInput: document.getElementById('itemContent'),
    itemList: document.getElementById('itemList'),
    categorySelect: document.getElementById('categorySelect'),
    editCatBtn: document.getElementById('editCatBtn'),
    deleteCatBtn: document.getElementById('deleteCatBtn'),
    showAddCatBtn: document.getElementById('showAddCatBtn'),
    addCatForm: document.getElementById('addCatForm'),
    newCatNameInput: document.getElementById('newCatNameInput'),
    confirmAddCatBtn: document.getElementById('confirmAddCatBtn'),
    toggleSearchBtn: document.getElementById('toggleSearchBtn'),
    searchContainer: document.getElementById('searchContainer'),
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    addItemForm: document.getElementById('addItemForm'),
    toggleAddItemBtn: document.getElementById('toggleAddItemBtn'),
    toggleRemarkBtn: document.getElementById('toggleRemarkBtn'),
    remarkContainer: document.getElementById('remarkContainer'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    fileInput: document.getElementById('fileInput'),
    deleteGroupModal: document.getElementById('deleteGroupModal'),
    showFloatingBtnCheckbox: document.getElementById('showFloatingBtnCheckbox'),
    milestoneBanner: document.getElementById('milestoneBanner')
  };

  const modalButtons = {
    deleteOnly: document.getElementById('btnDeleteGroupOnly'),
    deleteAll: document.getElementById('btnDeleteGroupAll'),
    clearItems: document.getElementById('btnClearGroupItems'),
    cancel: document.getElementById('btnCancelDelete')
  };

  // --- State ---
  let state = {
    editingId: null,
    currentCategoryId: StorageManager.DEFAULT_CAT_ID,
    isSearchMode: false,
    isAddCatMode: false,
    isAddItemMode: true,
    userPrefExpanded: true
  };

  // --- Initialization ---
  function initApp() {
    initI18n();
    bindEvents();
    StorageManager.getData((data) => {
      state.currentCategoryId = data.lastCategoryId;
      state.userPrefExpanded = data.isAddItemFormExpanded;
      
      if (elements.showFloatingBtnCheckbox) {
        elements.showFloatingBtnCheckbox.checked = data.showFloatingButton !== false;
      }

      if (state.currentCategoryId !== 'recent' && !data.categories.some(c => c.id === state.currentCategoryId)) {
        state.currentCategoryId = StorageManager.DEFAULT_CAT_ID;
      }
      refreshList();
      loadDraft();
      checkMilestones(data);
    });
  }

  function checkMilestones(data) {
    const { stats, processedMilestones } = data;
    if (!stats) return;

    const milestones = [
      {
        id: 'efficiency_master',
        condition: stats.totalActions >= 50,
        text: chrome.i18n.getMessage('milestone_1_text'),
        actionText: chrome.i18n.getMessage('milestone_1_action'),
        actionUrl: `https://chrome.google.com/webstore/detail/${chrome.runtime.id}/reviews`
      },
      {
        id: 'library_builder',
        condition: stats.totalItemsCreated >= 20,
        text: chrome.i18n.getMessage('milestone_1_text'),
        actionText: chrome.i18n.getMessage('milestone_1_action'),
        actionUrl: 'https://ko-fi.com/qiyuanyang'
      },
      {
        id: 'efficiency_expert',
        condition: (Date.now() - stats.installTime > 15 * 24 * 60 * 60 * 1000) && stats.totalActions >= 200,
        text: chrome.i18n.getMessage('milestone_3_text'),
        actionText: chrome.i18n.getMessage('milestone_3_action'),
        actionUrl: `https://chrome.google.com/webstore/detail/${chrome.runtime.id}/reviews`
      }
    ];

    // Find the first milestone that is reached but not processed
    const activeMilestone = milestones.find(m => m.condition && !processedMilestones.includes(m.id));
    
    if (activeMilestone) {
      PopupRenderer.renderMilestoneBanner(elements.milestoneBanner, activeMilestone, (id) => {
        StorageManager.getData((currentData) => {
          const processed = currentData.processedMilestones || [];
          if (!processed.includes(id)) {
            processed.push(id);
            StorageManager.setData({ processedMilestones: processed });
          }
        });
      });
    } else {
      elements.milestoneBanner.style.display = 'none';
    }
  }

  function updateUIState() {
    const { 
      searchContainer, toggleSearchBtn, addCatForm, toggleAddItemBtn, 
      addItemForm, toggleRemarkBtn, remarkContainer 
    } = elements;

    // 1. Search Bar
    const showSearch = state.isSearchMode || toggleSearchBtn.classList.contains('active');
    searchContainer.style.display = showSearch ? 'block' : 'none';
    toggleSearchBtn.classList.toggle('active', showSearch);
    
    // 2. Add Category Form
    addCatForm.style.display = state.isAddCatMode ? 'flex' : 'none';

    // 3. Add Item Controls
    const isSpecialView = state.isSearchMode || state.isAddCatMode || state.currentCategoryId === 'recent';
    toggleAddItemBtn.style.display = isSpecialView ? 'none' : 'block';
    toggleAddItemBtn.classList.toggle('active', state.isAddItemMode);
    
    const shouldShowAddForm = (state.isAddItemMode && !isSpecialView) || state.editingId;
    addItemForm.style.display = shouldShowAddForm ? 'flex' : 'none';
  }

  function refreshList(query = '') {
    StorageManager.getData((data) => {
      const processedItems = DataService.getProcessedItems(data.items, {
        query,
        currentCategoryId: state.currentCategoryId,
        isSearchMode: state.isSearchMode,
        recentItemIds: data.recentItemIds
      });

      PopupRenderer.renderCategoryDropdown(elements.categorySelect, {
        categories: data.categories,
        currentCategoryId: state.currentCategoryId,
        isSearchMode: state.isSearchMode,
        addItemForm: elements.addItemForm,
        editBtn: elements.editCatBtn,
        deleteBtn: elements.deleteCatBtn
      });
      
      PopupRenderer.renderItems(elements.itemList, processedItems, {
        categories: data.categories,
        query,
        isSearchMode: state.isSearchMode,
        currentCategoryId: state.currentCategoryId
      });

      // Auto-expand logic
      if (!state.isSearchMode && !state.isAddCatMode && state.currentCategoryId !== 'recent') {
        const categoryItemsCount = data.items.filter(i => (i.categoryId || StorageManager.DEFAULT_CAT_ID) === state.currentCategoryId).length;
        state.isAddItemMode = categoryItemsCount === 0 ? true : state.userPrefExpanded;
      }

      updateUIState();
    });
  }

  // --- Event Bindings ---
  function bindEvents() {
    // Draft handling
    elements.itemContentInput.addEventListener('input', saveDraft);
    elements.itemNameInput.addEventListener('input', saveDraft);

    // List Delegation
    elements.itemList.addEventListener('click', handleListClick);
    elements.itemList.addEventListener('change', handleListChange);

    // Search
    elements.toggleSearchBtn.addEventListener('click', () => {
      const isActive = elements.toggleSearchBtn.classList.toggle('active');
      state.isSearchMode = false;
      state.isAddCatMode = false;
      if (isActive) {
        elements.searchInput.value = '';
        elements.searchInput.focus();
      }
      refreshList();
    });

    const debouncedSearch = debounce((query) => {
      state.isSearchMode = query.length > 0;
      elements.clearSearch.style.display = state.isSearchMode ? 'block' : 'none';
      refreshList(query);
    }, 200);

    elements.searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value.trim().toLowerCase()));

    elements.clearSearch.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.isSearchMode = false;
      elements.clearSearch.style.display = 'none';
      refreshList();
      elements.searchInput.focus();
    });

    // Category
    elements.showAddCatBtn.addEventListener('click', () => {
      state.isAddCatMode = !state.isAddCatMode;
      if (state.isAddCatMode) {
        elements.toggleSearchBtn.classList.remove('active');
        state.isSearchMode = false;
        elements.newCatNameInput.focus();
      }
      updateUIState();
    });

    elements.categorySelect.addEventListener('change', (e) => {
      state.currentCategoryId = e.target.value;
      StorageManager.setData({ lastCategoryId: state.currentCategoryId });
      if (!state.isSearchMode) refreshList();
    });

    elements.confirmAddCatBtn.addEventListener('click', handleAddCategory);
    elements.editCatBtn.addEventListener('click', handleEditCategory);
    elements.deleteCatBtn.addEventListener('click', () => {
      if (state.currentCategoryId !== StorageManager.DEFAULT_CAT_ID && state.currentCategoryId !== 'recent') {
        elements.deleteGroupModal.style.display = 'flex';
      }
    });

    // Modal Events
    elements.deleteGroupModal.addEventListener('click', (e) => {
      if (e.target === elements.deleteGroupModal) elements.deleteGroupModal.style.display = 'none';
    });
    modalButtons.cancel.addEventListener('click', () => elements.deleteGroupModal.style.display = 'none');
    modalButtons.deleteOnly.addEventListener('click', () => deleteCategoryAction('only_group'));
    modalButtons.deleteAll.addEventListener('click', () => deleteCategoryAction('all'));
    modalButtons.clearItems.addEventListener('click', () => deleteCategoryAction('clear_items'));

    // Item Actions
    elements.toggleAddItemBtn.addEventListener('click', () => {
      state.isAddItemMode = !state.isAddItemMode;
      state.userPrefExpanded = state.isAddItemMode;
      StorageManager.setData({ isAddItemFormExpanded: state.userPrefExpanded });
      if (state.isAddItemMode) elements.itemContentInput.focus();
      updateUIState();
    });

    elements.toggleRemarkBtn.addEventListener('click', () => {
      elements.remarkContainer.style.display = 'block';
      elements.toggleRemarkBtn.style.display = 'none';
      elements.itemNameInput.focus();
    });

    elements.addBtn.addEventListener('click', handleAddItem);

    // Settings
    if (elements.showFloatingBtnCheckbox) {
      elements.showFloatingBtnCheckbox.addEventListener('change', (e) => {
        StorageManager.setData({ showFloatingButton: e.target.checked });
      });
    }

    // Backup
    elements.exportBtn.addEventListener('click', handleExport);
    elements.importBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleImport);
  }

  // --- Event Handlers ---
  function handleListClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const id = btn.getAttribute('data-id');
    StorageManager.getData((data) => {
      const item = data.items.find(i => i.id === id);
      if (!item) return;

      if (btn.classList.contains('copy-btn')) {
        copyToClipboard(item.content, btn);
        StorageManager.trackUsage(id);
      } else if (btn.classList.contains('insert-btn')) {
        insertToPage(item.content, btn);
        StorageManager.trackUsage(id);
      } else if (btn.classList.contains('pin-btn')) {
        togglePin(id);
      } else if (btn.classList.contains('delete-btn')) {
        deleteItem(id);
      } else if (btn.classList.contains('edit-btn')) {
        startEditing(item);
      } else if (btn.classList.contains('move-btn')) {
        const box = document.getElementById(`move-box-${id}`);
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
      } else if (btn.classList.contains('expand-btn')) {
        toggleItemExpansion(id, btn);
      }
    });
  }

  function handleListChange(e) {
    if (e.target.classList.contains('move-selector')) {
      const itemId = e.target.getAttribute('data-id');
      const targetCatId = e.target.value;
      if (targetCatId) moveItem(itemId, targetCatId);
    }
  }

  function handleAddCategory() {
    const name = elements.newCatNameInput.value.trim();
    if (!name) return;
    StorageManager.getData((data) => {
      const newId = Date.now().toString();
      data.categories.push({ id: newId, name });
      state.currentCategoryId = newId;
      StorageManager.setData({ categories: data.categories, lastCategoryId: state.currentCategoryId }, () => {
        elements.newCatNameInput.value = '';
        state.isAddCatMode = false;
        refreshList();
      });
    });
  }

  function handleEditCategory() {
    if (state.currentCategoryId === StorageManager.DEFAULT_CAT_ID || state.currentCategoryId === 'recent') return;
    const oldName = elements.categorySelect.options[elements.categorySelect.selectedIndex].text;
    const newName = prompt(chrome.i18n.getMessage('prompt_new_category_name'), oldName);
    if (newName && newName.trim() !== oldName) {
      StorageManager.getData((data) => {
        const categories = data.categories.map(cat => cat.id === state.currentCategoryId ? { ...cat, name: newName.trim() } : cat);
        StorageManager.setData({ categories }, () => refreshList());
      });
    }
  }

  function deleteCategoryAction(type) {
    StorageManager.getData((data) => {
      let { categories, items } = data;
      if (type === 'only_group') {
        categories = categories.filter(cat => cat.id !== state.currentCategoryId);
        items = items.map(i => i.categoryId === state.currentCategoryId ? { ...i, categoryId: StorageManager.DEFAULT_CAT_ID } : i);
        state.currentCategoryId = StorageManager.DEFAULT_CAT_ID;
      } else if (type === 'all') {
        categories = categories.filter(cat => cat.id !== state.currentCategoryId);
        items = items.filter(i => i.categoryId !== state.currentCategoryId);
        state.currentCategoryId = StorageManager.DEFAULT_CAT_ID;
      } else if (type === 'clear_items') {
        items = items.filter(i => i.categoryId !== state.currentCategoryId);
      }
      
      StorageManager.setData({ categories, items, lastCategoryId: state.currentCategoryId }, () => {
        elements.deleteGroupModal.style.display = 'none';
        refreshList();
      });
    });
  }

  function handleAddItem() {
    const name = elements.itemNameInput.value.trim();
    const content = elements.itemContentInput.value.trim();
    if (!content) return alert(chrome.i18n.getMessage('alert_fill_content'));

    StorageManager.getData((data) => {
      let items = data.items;
      if (state.editingId) {
        items = items.map(i => i.id === state.editingId ? { ...i, name, content } : i);
        state.editingId = null;
        elements.addBtn.innerText = chrome.i18n.getMessage('add_item_btn');
        StorageManager.setData({ items }, () => {
          showToast(chrome.i18n.getMessage('status_added'));
          finishAdd();
        });
      } else {
        const catId = state.currentCategoryId === 'recent' ? StorageManager.DEFAULT_CAT_ID : state.currentCategoryId;
        const newItem = { id: Date.now().toString(), name, content, categoryId: catId, isPinned: false };
        items.push(newItem);
        
        // Use sequential updates to avoid storage race conditions
        StorageManager.setData({ items }, () => {
          StorageManager.incrementItemsCreated((newStats) => {
            showToast(chrome.i18n.getMessage('status_added'));
            checkMilestones({ ...data, stats: newStats });
            finishAdd();
          });
        });
      }
    });
  }

  function finishAdd() {
    elements.itemNameInput.value = '';
    elements.itemContentInput.value = '';
    elements.remarkContainer.style.display = 'none';
    elements.toggleRemarkBtn.style.display = 'block';
    chrome.storage.local.remove('draftItem');
    refreshList();
  }

  // --- Sub-logics ---
  function togglePin(id) {
    StorageManager.getData((data) => {
      const items = data.items.map(i => i.id === id ? { ...i, isPinned: !i.isPinned } : i);
      StorageManager.setData({ items }, () => refreshList());
    });
  }

  function deleteItem(id) {
    StorageManager.getData((data) => {
      const items = data.items.filter(i => i.id !== id);
      const recentIds = data.recentItemIds.filter(rid => rid !== id);
      const remainingInCategory = items.filter(i => (i.categoryId || StorageManager.DEFAULT_CAT_ID) === state.currentCategoryId).length;
      if (remainingInCategory === 0) state.isAddItemMode = true;
      StorageManager.setData({ items, recentItemIds: recentIds }, () => refreshList());
    });
  }

  function moveItem(itemId, targetCatId) {
    StorageManager.getData((data) => {
      const items = data.items.map(i => i.id === itemId ? { ...i, categoryId: targetCatId } : i);
      StorageManager.setData({ items }, () => refreshList());
    });
  }

  function startEditing(item) {
    state.editingId = item.id;
    elements.itemNameInput.value = item.name || "";
    elements.itemContentInput.value = item.content;
    elements.addBtn.innerText = chrome.i18n.getMessage('update_item_btn');
    state.isSearchMode = state.isAddCatMode = false;
    state.isAddItemMode = true;

    if (item.name) {
      elements.remarkContainer.style.display = 'block';
      elements.toggleRemarkBtn.style.display = 'none';
    }
    refreshList();
    elements.itemContentInput.focus();
  }

  function toggleItemExpansion(id, btn) {
    const contentDiv = document.getElementById(`content-${id}`);
    const isExpanding = contentDiv.classList.contains('collapsed');
    contentDiv.classList.toggle('collapsed', !isExpanding);
    contentDiv.classList.toggle('expanded', isExpanding);
    btn.innerText = chrome.i18n.getMessage(isExpanding ? 'btn_collapse' : 'btn_expand');
  }

  function saveDraft() {
    if (state.editingId) return;
    chrome.storage.local.set({ draftItem: { name: elements.itemNameInput.value, content: elements.itemContentInput.value } });
  }

  function loadDraft() {
    chrome.storage.local.get(['pendingItem', 'draftItem'], (res) => {
      const target = res.pendingItem || res.draftItem;
      if (target && (target.content || target.name)) {
        elements.itemNameInput.value = target.name || "";
        elements.itemContentInput.value = target.content || "";
        state.isAddItemMode = true;
        if (target.name) {
          elements.remarkContainer.style.display = 'block';
          elements.toggleRemarkBtn.style.display = 'none';
        }
        updateUIState();
        if (res.pendingItem) {
          chrome.storage.local.remove('pendingItem');
          saveDraft();
        }
      }
    });
  }

  function handleExport() {
    StorageManager.getData((data) => {
      const text = BackupService.generateExportText(data);
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const importedData = BackupService.parseBackupText(event.target.result);
      if (importedData.items.length === 0 && importedData.categories.length <= 1) {
        alert(`${chrome.i18n.getMessage('alert_import_format_error')} ${chrome.i18n.getMessage('support_email')}`);
      } else if (confirm(chrome.i18n.getMessage('confirm_import_backup'))) {
        StorageManager.setData({ categories: importedData.categories, items: importedData.items, lastCategoryId: StorageManager.DEFAULT_CAT_ID }, () => {
          alert(chrome.i18n.getMessage('alert_import_success'));
          window.location.reload();
        });
      }
      elements.fileInput.value = '';
    };
    reader.readAsText(file);
  }

  initApp();
});
