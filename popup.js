// 格式化时间
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 显示历史记录
async function displayHistory() {
  const historyList = document.getElementById('history-list');
  const records = await window.redirectHistory.getRecords();

  if (records.length === 0) {
    historyList.innerHTML = '<div class="history-item">暂无跳转记录</div>';
    return;
  }

  // 只显示最近的10条记录
  const recentRecords = records.slice(0, 10);
  historyList.innerHTML = recentRecords.map(record => `
    <div class="history-item">
      <div class="timestamp">${formatDate(record.timestamp)}</div>
      <div class="url">从：${record.from}</div>
      <div class="url">到：${record.success ? record.to : record.error}</div>
      <div class="${record.success ? 'success' : 'error'}">
        ${record.success ? '✓ 成功' : '✗ 失败'}
      </div>
    </div>
  `).join('');
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 加载保存的设置
  const result = await chrome.storage.sync.get(['enabled']);
  document.getElementById('enableExtension').checked = result.enabled !== false;

  // 显示历史记录
  await displayHistory();

  // 启用开关事件处理
  document.getElementById('enableExtension').addEventListener('change', (event) => {
    chrome.storage.sync.set({
      enabled: event.target.checked
    });
  });

  // 清除历史按钮事件处理
  document.getElementById('clearHistory').addEventListener('click', async () => {
    if (confirm('确定要清除所有历史记录吗？')) {
      await window.redirectHistory.clearRecords();
      await displayHistory();
    }
  });
}); 