/**
 * Popup Interface Rendering Module
 * Purely responsible for generating HTML based on provided data.
 */
const PopupRenderer = {
  /**
   * Render category dropdown menu
   * @param {HTMLElement} selectElement 
   * @param {Object} config - { categories, currentCategoryId, isSearchMode, addItemForm, editBtn, deleteBtn }
   */
  renderCategoryDropdown(selectElement, config) {
    const { categories, currentCategoryId, isSearchMode, addItemForm, editBtn, deleteBtn } = config;
    selectElement.innerHTML = '';
    
    // Recently used option
    const recentOption = document.createElement('option');
    recentOption.value = 'recent';
    recentOption.textContent = chrome.i18n.getMessage('recently_used');
    if (currentCategoryId === 'recent') recentOption.selected = true;
    selectElement.appendChild(recentOption);

    // Dynamic categories
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      if (cat.id === currentCategoryId) option.selected = true;
      selectElement.appendChild(option);
    });

    // Disable/Enable buttons (Special categories: Default and Recently Used)
    const isSpecial = currentCategoryId === StorageManager.DEFAULT_CAT_ID || currentCategoryId === 'recent';
    [editBtn, deleteBtn].forEach(btn => {
      btn.style.opacity = isSpecial ? '0.3' : '1';
      btn.style.pointerEvents = isSpecial ? 'none' : 'auto';
    });
  },

  /**
   * Render item list
   * @param {HTMLElement} container 
   * @param {Array} items - Already filtered and sorted items
   * @param {Object} context - { categories, query, isSearchMode, currentCategoryId }
   */
  renderItems(container, items, context) {
    const { categories, query, isSearchMode, currentCategoryId } = context;
    container.innerHTML = '';
    
    if (!items || items.length === 0) {
      const isRecentView = currentCategoryId === 'recent';
      const msgKey = isSearchMode ? 'no_matching_items' : (isRecentView ? 'no_recent_items' : 'no_items_in_category');
      container.innerHTML = `<div class="empty-msg">${chrome.i18n.getMessage(msgKey)}</div>`;
      return;
    }

    items.forEach(item => {
      const catObj = categories.find(c => c.id === (item.categoryId || StorageManager.DEFAULT_CAT_ID));
      const catName = catObj ? catObj.name : chrome.i18n.getMessage('unknown_category');
      const isRecentView = currentCategoryId === 'recent';
      const showCategoryTag = isSearchMode || isRecentView;
      
      const isUserRemark = !!(item.name && item.name.trim());
      let displayName = isUserRemark 
        ? item.name 
        : item.content.substring(0, 20) + (item.content.length > 20 ? chrome.i18n.getMessage('ellipsis') : "");
      
      let displayContent = escapeHtml(item.content);
      displayName = escapeHtml(displayName);
      
      if (isSearchMode && query) {
        displayName = highlightText(displayName, query);
        displayContent = highlightText(displayContent, query);
      }

      // Improved heuristic: more than 80 chars or contains any newline
      const isLongContent = item.content.length > 80 || item.content.includes('\n');

      const itemDiv = document.createElement('div');
      itemDiv.className = `item ${item.isPinned ? 'pinned' : ''}`;
      itemDiv.innerHTML = `
        <div class="item-header">
          <div class="item-title-wrapper">
            <span class="item-name ${isUserRemark ? 'user-remark' : 'auto-preview'}">
              ${item.isPinned && !isRecentView && !isSearchMode ? '<span class="pin-icon">📌</span>' : ''}
              ${displayName}
              ${showCategoryTag ? `<span class="category-tag">[${escapeHtml(catName)}]</span>` : ''}
            </span>
          </div>
          <div class="item-mgmt-actions">
            ${(!isSearchMode && !isRecentView) ? `
              <button class="mgmt-btn pin-btn ${item.isPinned ? 'active' : ''}" data-id="${item.id}" title="${item.isPinned ? chrome.i18n.getMessage('btn_unpin') : chrome.i18n.getMessage('btn_pin')}">
                ${item.isPinned ? '📍' : '📌'}
              </button>
            ` : ''}
            <button class="mgmt-btn edit-btn" data-id="${item.id}" title="${chrome.i18n.getMessage('btn_edit')}">✎</button>
            <button class="mgmt-btn move-btn" data-id="${item.id}" title="${chrome.i18n.getMessage('btn_move')}">📂</button>
            <button class="mgmt-btn delete-btn danger" data-id="${item.id}" title="${chrome.i18n.getMessage('btn_delete')}">🗑</button>
          </div>
        </div>
        <div id="content-${item.id}" class="item-content ${isLongContent ? 'collapsed' : ''}">${displayContent}</div>
        ${isLongContent ? `
          <div class="expand-toggle">
            <button class="expand-btn" data-id="${item.id}">${chrome.i18n.getMessage('btn_expand')}</button>
          </div>
        ` : ''}
        <div id="move-box-${item.id}" class="move-container" style="display:none;">
          <select class="move-selector" data-id="${item.id}">
            <option value="">${chrome.i18n.getMessage('move_to_category')}</option>
            ${categories.map(c => `<option value="${c.id}" ${c.id === item.categoryId ? 'disabled' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="item-main-actions">
          <button class="main-action-btn insert-btn" data-id="${item.id}">
            <span>📥</span> ${chrome.i18n.getMessage('btn_insert')}
          </button>
          <button class="main-action-btn copy-btn" data-id="${item.id}">
            <span>📋</span> ${chrome.i18n.getMessage('btn_copy')}
          </button>
        </div>
      `;
      container.appendChild(itemDiv);
    });
  },

  /**
   * Render milestone banner
   * @param {HTMLElement} container 
   * @param {Object} milestone {id, text, actionText, actionUrl}
   * @param {Function} onClose 
   */
  renderMilestoneBanner(container, milestone, onClose) {
    if (!milestone) {
      container.style.display = 'none';
      return;
    }

    container.innerHTML = `
      <span class="milestone-close">&times;</span>
      <div class="milestone-content">${milestone.text}</div>
      <div class="milestone-actions">
        <button class="milestone-btn" id="milestoneActionBtn">${milestone.actionText}</button>
      </div>
    `;

    container.style.display = 'flex';

    container.querySelector('.milestone-close').onclick = () => {
      container.style.display = 'none';
      onClose(milestone.id);
    };

    container.querySelector('#milestoneActionBtn').onclick = () => {
      window.open(milestone.actionUrl, '_blank');
      onClose(milestone.id);
      container.style.display = 'none';
    };
  }
};
