/**
 * Storage Management Module
 */

const StorageManager = {
  DEFAULT_CAT_ID: 'default',

  /**
   * Get default category object
   */
  getDefaultCategory() {
    return {
      id: this.DEFAULT_CAT_ID,
      name: chrome.i18n.getMessage('default_category'),
      isDefault: true
    };
  },

  /**
   * Ensure the category list contains the default category, and handle translation and sorting
   * @param {Array} categories 
   * @returns {Array}
   */
  ensureDefaultCategory(categories) {
    if (!Array.isArray(categories)) categories = [];
    
    const defaultIdx = categories.findIndex(cat => cat.id === this.DEFAULT_CAT_ID);
    
    if (defaultIdx === -1) {
      return [this.getDefaultCategory(), ...categories];
    } else {
      // Ensure the name is always the latest translation
      categories[defaultIdx].name = chrome.i18n.getMessage('default_category');
      categories[defaultIdx].isDefault = true;
      
      // Move default category to the first position
      if (defaultIdx > 0) {
        const defaultCat = categories.splice(defaultIdx, 1)[0];
        categories.unshift(defaultCat);
      }
      return categories;
    }
  },

  /**
   * Get all data
   */
  getData(callback) {
    chrome.storage.sync.get({
      categories: [this.getDefaultCategory()],
      items: [],
      lastCategoryId: this.DEFAULT_CAT_ID,
      recentItemIds: [],
      isAddItemFormExpanded: true, // Default to true for first use
      showFloatingButton: true,     // Default to true
      stats: {
        totalActions: 0,
        totalItemsCreated: 0,
        installTime: Date.now()
      },
      processedMilestones: []
    }, (result) => {
      result.categories = this.ensureDefaultCategory(result.categories);
      callback(result);
    });
  },

  /**
   * Save data
   */
  setData(data, callback) {
    if (data.categories) {
      data.categories = this.ensureDefaultCategory(data.categories);
    }
    chrome.storage.sync.set(data, callback);
  },

  /**
   * Record usage history and update stats
   */
  trackUsage(itemId) {
    chrome.storage.sync.get({ recentItemIds: [], stats: {} }, (result) => {
      let ids = result.recentItemIds.filter(id => id !== itemId);
      ids.unshift(itemId);
      if (ids.length > 10) ids = ids.slice(0, 10);
      
      const stats = result.stats || {};
      stats.totalActions = (stats.totalActions || 0) + 1;
      
      chrome.storage.sync.set({ 
        recentItemIds: ids,
        stats: stats
      });
    });
  },

  /**
   * Increment total items created stat
   */
  incrementItemsCreated(callback) {
    chrome.storage.sync.get({ stats: null }, (result) => {
      let stats = result.stats;
      if (!stats) {
        stats = { totalActions: 0, totalItemsCreated: 0, installTime: Date.now() };
      }
      stats.totalItemsCreated = (stats.totalItemsCreated || 0) + 1;
      chrome.storage.sync.set({ stats: stats }, () => {
        if (callback) callback(stats);
      });
    });
  }
};
