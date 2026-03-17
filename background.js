// 监听剪贴板变化
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'URL_DETECTED') {
    handleUrl(request.url);
  }
});

// URL验证函数 (与content.js中相同)
function isValidUrl(string) {
  try {
    // 先尝试解码URL，处理可能的多层编码
    let processedUrl = string;
    // 最多尝试解码5次，避免无限循环
    for (let i = 0; i < 5; i++) {
      if (!processedUrl.includes('%')) break;
      try {
        const decoded = decodeURIComponent(processedUrl);
        if (decoded === processedUrl) break;
        processedUrl = decoded;
      } catch (e) {
        break;
      }
    }
    
    // 检查是否为有效URL
    const urlObj = new URL(processedUrl);
    
    // 检查域名是否包含无效字符，如逗号、空格等
    const hostname = urlObj.hostname;
    if (/[,\s<>"'()]/.test(hostname)) {
      return false;
    }
    
    // 检查是否为可疑的域名组合
    if (hostname.includes('netlify') && hostname.includes('xn--')) {
      return false;
    }
    
    // 检查域名部分是否过长（可能是尝试绕过检测）
    if (hostname.length > 100) {
      return false;
    }
    
    // 检查域名中的Punycode部分
    const xnCount = (hostname.match(/xn--/g) || []).length;
    if (xnCount > 3) {
      return false;
    }
    
    // 检查URL本身是否过长
    if (processedUrl.length > 2000) {
      return false;
    }
    
    return true;
  } catch (err) {
    return false;
  }
}

// 处理URL
async function handleUrl(url) {
  try {
    // 验证URL格式和安全性
    if (!isValidUrl(url)) {
      console.error('检测到无效或不安全的URL:', url);
      return;
    }
    
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // 在当前标签页打开URL
    await chrome.tabs.update(activeTab.id, {url: url});
  } catch (error) {
    console.error('无效的URL或发生错误:', error);
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