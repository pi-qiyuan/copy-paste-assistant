/**
 * Backup and Import Service Module
 */
const BackupService = {
  /**
   * Generate export text
   * @param {Object} data - Object containing categories and items
   * @returns {string}
   */
  generateExportText(data) {
    const now = new Date();
    const timeStr = now.toLocaleString();
    const catPrefix = chrome.i18n.getMessage('backup_category_prefix') || '# Category: ';
    
    let text = `============================================================\n`;
    text += `${chrome.i18n.getMessage('backup_header_title')}\n`;
    text += `${chrome.i18n.getMessage('backup_inst_1')}\n`;
    text += `${chrome.i18n.getMessage('backup_inst_2')}\n`;
    text += `${chrome.i18n.getMessage('backup_inst_3')}\n`;
    text += `${chrome.i18n.getMessage('backup_inst_4')}\n`;
    text += `${chrome.i18n.getMessage('backup_inst_5')}\n`;
    text += `${chrome.i18n.getMessage('backup_inst_6')}\n`;
    text += `============================================================\n\n`;

    data.categories.forEach(cat => {
      text += `${catPrefix}${cat.name}\n`;
      const catItems = data.items.filter(i => (i.categoryId || StorageManager.DEFAULT_CAT_ID) === cat.id);
      catItems.forEach(item => {
        text += `[${item.name}]${item.isPinned ? ' *' : ''}\n${item.content}\n\n---\n\n`;
      });
      text += "\n";
    });

    text += `\n============================================================\n`;
    text += `${chrome.i18n.getMessage('backup_footer_exported_by')} [${chrome.i18n.getMessage('extension_name')}] @ ${timeStr}\n`;
    text += `============================================================\n`;

    return text;
  },

  /**
   * Parse imported backup text
   * @param {string} text 
   * @returns {Object} { categories, items }
   */
  parseBackupText(text) {
    const lines = text.split(/\r?\n/);
    const categories = [];
    const items = [];
    
    let currentCatId = StorageManager.DEFAULT_CAT_ID;
    let currentItem = null;
    const defaultCatName = chrome.i18n.getMessage('default_category');
    const catPrefixRaw = chrome.i18n.getMessage('backup_category_prefix') || '# Category: ';
    const catPrefix = catPrefixRaw.trim();

    // Pre-populate with default category
    categories.push({ id: StorageManager.DEFAULT_CAT_ID, name: defaultCatName, isDefault: true });

    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // 1. Match category
      if (trimmedLine.startsWith(catPrefix)) {
        const catName = trimmedLine.replace(catPrefix, '').replace(':', '').trim();
        if (catName && catName !== defaultCatName) {
          let cat = categories.find(c => c.name === catName);
          if (!cat) {
            cat = { id: 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), name: catName };
            categories.push(cat);
          }
          currentCatId = cat.id;
        } else {
          currentCatId = StorageManager.DEFAULT_CAT_ID;
        }
        currentItem = null;
      } 
      // 2. Match item title
      else if (trimmedLine.startsWith('[') && trimmedLine.includes(']') && !trimmedLine.startsWith('[---]')) {
        const nameMatch = trimmedLine.match(/\[(.*?)\]/);
        if (nameMatch) {
          const itemName = nameMatch[1];
          const isPinned = trimmedLine.includes(']*') || trimmedLine.includes('] *');
          
          currentItem = {
            id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: itemName,
            content: '',
            categoryId: currentCatId,
            isPinned: isPinned
          };
          items.push(currentItem);
        }
      } 
      // 3. Accumulate content
      else if (currentItem) {
        if (trimmedLine !== '---' && !trimmedLine.startsWith('====')) {
          currentItem.content += (currentItem.content ? '\n' : '') + line;
        }
      }
    });

    // Clean up trailing whitespace from content
    items.forEach(item => {
      item.content = item.content.trim();
    });

    return { categories, items };
  }
};
