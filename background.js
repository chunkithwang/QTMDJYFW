// 监听剪贴板变化
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'URL_DETECTED') {
    handleUrl(request.url);
  }
});

// 处理URL
async function handleUrl(url) {
  try {
    // 验证URL格式
    new URL(url);
    
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // 在当前标签页打开URL
    await chrome.tabs.update(activeTab.id, {url: url});
  } catch (error) {
    console.error('Invalid URL or error occurred:', error);
  }
}

// 监听标签页创建事件
chrome.tabs.onCreated.addListener(async (tab) => {
  // 如果是空标签页，不进行处理
  if (tab.url === 'chrome://newtab/') {
    return;
  }

  try {
    // 获取最近的历史记录
    const history = await chrome.history.search({
      text: '',
      maxResults: 1,
      startTime: Date.now() - 1000 // 最近1秒内的历史
    });

    if (history.length > 0) {
      const lastUrl = history[0].url;
      // 在当前标签页打开URL，并关闭新创建的标签页
      await chrome.tabs.update(tab.openerTabId, {url: lastUrl});
      await chrome.tabs.remove(tab.id);
    }
  } catch (error) {
    console.error('Error handling new tab:', error);
  }
}); 