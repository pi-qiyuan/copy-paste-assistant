/**
 * Data Processing Service
 * Handles filtering, sorting, and business logic for the UI
 */
const DataService = {
  /**
   * Filter and sort items based on current UI state
   * @param {Array} items - Raw items from storage
   * @param {Object} options - { query, currentCategoryId, isSearchMode, recentItemIds }
   * @returns {Array} - Processed items
   */
  getProcessedItems(items, options) {
    const { query, currentCategoryId, isSearchMode, recentItemIds } = options;
    const isRecentView = currentCategoryId === 'recent';

    let filteredItems;

    if (isSearchMode && query) {
      const lowerQuery = query.toLowerCase();
      filteredItems = items.filter(item => 
        (item.name && item.name.toLowerCase().includes(lowerQuery)) || 
        (item.content && item.content.toLowerCase().includes(lowerQuery))
      );
    } else if (isRecentView) {
      filteredItems = recentItemIds
        .map(id => items.find(item => item.id === id))
        .filter(i => !!i);
    } else {
      filteredItems = items
        .filter(item => (item.categoryId || StorageManager.DEFAULT_CAT_ID) === currentCategoryId)
        .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    }

    return filteredItems;
  }
};
