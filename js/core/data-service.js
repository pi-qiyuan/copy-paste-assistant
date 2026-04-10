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

    // Helper to extract timestamp from ID
    const getTimestamp = (id) => {
      const match = String(id).match(/(\d+)/);
      return match ? parseInt(match[0], 10) : 0;
    };

    let filteredItems;

    if (isSearchMode && query) {
      const lowerQuery = query.toLowerCase();
      filteredItems = items
        .filter(item => 
          (item.name && item.name.toLowerCase().includes(lowerQuery)) || 
          (item.content && item.content.toLowerCase().includes(lowerQuery))
        )
        .sort((a, b) => getTimestamp(b.id) - getTimestamp(a.id));
    } else if (isRecentView) {
      filteredItems = recentItemIds
        .map(id => items.find(item => item.id === id))
        .filter(i => !!i);
    } else {
      filteredItems = items
        .filter(item => (item.categoryId || StorageManager.DEFAULT_CAT_ID) === currentCategoryId)
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) {
            return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
          }
          return getTimestamp(b.id) - getTimestamp(a.id);
        });
    }

    return filteredItems;
  }
};
