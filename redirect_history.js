// 记录跳转历史
class RedirectHistory {
  constructor() {
    this.MAX_RECORDS = 100; // 最多保存100条记录
  }

  // 添加跳转记录
  async addRecord(fromUrl, toUrl) {
    try {
      const records = await this.getRecords();
      const newRecord = {
        from: fromUrl,
        to: toUrl,
        timestamp: new Date().toISOString(),
        success: true
      };

      records.unshift(newRecord); // 在开头添加新记录
      
      // 如果记录超过最大数量，删除旧记录
      if (records.length > this.MAX_RECORDS) {
        records.length = this.MAX_RECORDS;
      }

      await chrome.storage.local.set({ 'redirectHistory': records });
    } catch (error) {
      console.error('保存跳转记录失败:', error);
    }
  }

  // 添加失败记录
  async addFailRecord(fromUrl, error) {
    try {
      const records = await this.getRecords();
      const newRecord = {
        from: fromUrl,
        error: error,
        timestamp: new Date().toISOString(),
        success: false
      };

      records.unshift(newRecord);
      
      if (records.length > this.MAX_RECORDS) {
        records.length = this.MAX_RECORDS;
      }

      await chrome.storage.local.set({ 'redirectHistory': records });
    } catch (error) {
      console.error('保存失败记录失败:', error);
    }
  }

  // 获取所有记录
  async getRecords() {
    try {
      const result = await chrome.storage.local.get('redirectHistory');
      return result.redirectHistory || [];
    } catch (error) {
      console.error('获取跳转记录失败:', error);
      return [];
    }
  }

  // 清除所有记录
  async clearRecords() {
    try {
      await chrome.storage.local.remove('redirectHistory');
    } catch (error) {
      console.error('清除跳转记录失败:', error);
    }
  }
}

// 创建全局实例
window.redirectHistory = new RedirectHistory(); 