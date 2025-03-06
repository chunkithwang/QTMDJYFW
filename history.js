// 格式化时间
function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 显示历史记录
async function displayHistory() {
  const historyList = document.getElementById('history-list');
  const records = await window.redirectHistory.getRecords();

  if (records.length === 0) {
    historyList.innerHTML = '<div class="empty-message">暂无跳转记录</div>';
    return;
  }

  historyList.innerHTML = records.map(record => `
    <div class="history-item">
      <div class="timestamp">${formatDate(record.timestamp)}</div>
      <div class="url">${record.from}</div>
      <div class="url">${record.success ? record.to : record.error}</div>
      <div class="${record.success ? 'success' : 'error'}">
        ${record.success ? '成功' : '失败'}
      </div>
    </div>
  `).join('');
}

// 导出CSV
function exportCSV() {
  window.redirectHistory.getRecords().then(records => {
    const csvContent = [
      ['时间', '来源URL', '目标URL/错误信息', '状态'],
      ...records.map(record => [
        formatDate(record.timestamp),
        record.from,
        record.success ? record.to : record.error,
        record.success ? '成功' : '失败'
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `跳转历史_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  });
}

// 绑定事件处理
document.addEventListener('DOMContentLoaded', () => {
  // 显示初始数据
  displayHistory();

  // 刷新按钮
  document.getElementById('refresh').addEventListener('click', displayHistory);

  // 清除按钮
  document.getElementById('clear').addEventListener('click', async () => {
    if (confirm('确定要清除所有历史记录吗？')) {
      await window.redirectHistory.clearRecords();
      displayHistory();
    }
  });

  // 导出按钮
  document.getElementById('export').addEventListener('click', exportCSV);
}); 