// 监听页面点击事件，获取剪贴板内容
document.addEventListener('click', async (event) => {
  // 只在用户实际点击时尝试读取剪贴板
  if (event.isTrusted) {
    try {
      // 尝试使用新的异步API
      const text = await navigator.clipboard.readText().catch(() => {
        // 如果异步API失败，尝试使用传统方法
        const textarea = document.createElement('textarea');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        document.execCommand('paste');
        const text = textarea.value;
        document.body.removeChild(textarea);
        return text;
      });

      if (text && isValidUrl(text)) {
        chrome.runtime.sendMessage({
          type: 'URL_DETECTED',
          url: text
        });
      }
    } catch (error) {
      // 忽略剪贴板错误，避免打印到控制台
      return;
    }
  }
});

// URL验证函数
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

// 生成随机延迟时间
function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 通用的URL参数提取函数
function extractTargetUrl() {
  // 常见的URL参数名
  const possibleParams = ['target', 'url', 'link', 'redirect', 'dest', 'destination'];
  const urlParams = new URLSearchParams(window.location.search);
  
  for (const param of possibleParams) {
    const value = urlParams.get(param);
    if (value) {
      try {
        // 有些网站可能会对URL进行多次编码
        let decodedUrl = value;
        const maxDecodeAttempts = 5;
        
        // 控制解码次数，防止无限循环
        for (let i = 0; i < maxDecodeAttempts; i++) {
          if (!decodedUrl.includes('%')) break;
          
          try {
            const newDecoded = decodeURIComponent(decodedUrl);
            // 如果解码前后相同，说明已经完全解码
            if (newDecoded === decodedUrl) break;
            decodedUrl = newDecoded;
          } catch (decodeErr) {
            // 解码出错，使用当前结果
            break;
          }
        }
        
        // 检查解码后的URL是否安全
        if (isValidUrl(decodedUrl) && isSafeTargetUrl(decodedUrl)) {
          return decodedUrl;
        }
      } catch (e) {
        console.error('URL解码或验证失败:', e);
      }
    }
  }
  return null;
}

// 检查是否是安全的目标URL
function isSafeTargetUrl(url) {
  try {
    // 先尝试解码URL，处理可能的多层编码
    let processedUrl = url;
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
    
    const targetUrl = new URL(processedUrl);
    
    // 检查是否为Punycode域名（以xn--开头的域名部分）
    const hostname = targetUrl.hostname;
    
    // 检查域名是否包含无效字符
    // 域名中不应包含逗号、空格等非法字符
    const hasInvalidChars = /[,\s<>"'()]/.test(hostname);
    if (hasInvalidChars) {
      return false;
    }
    
    const isPunycodeDomain = hostname.includes('xn--');
    
    // 避免重定向回中转页面
    const isSafeDomain = !hostname.includes('link.csdn.net') &&
                        !hostname.includes('link.zhihu.com') &&
                        !hostname.includes('weixin110.qq.com');
    
    // 如果是Punycode域名，需要额外验证
    if (isPunycodeDomain) {
      // 简单规则：域名不应过长，且不应包含过多的xn--前缀
      const xnCount = (hostname.match(/xn--/g) || []).length;
      if (xnCount > 3 || hostname.length > 100) {
        return false;
      }
      
      // 检查netlify子域名的可疑组合
      if (hostname.includes('netlify') && hostname.includes('xn--')) {
        // 很可能是恶意域名
        return false;
      }
    }
    
    return isSafeDomain;
  } catch (e) {
    return false;
  }
}

// 修改跳转函数
function safeRedirect(targetUrl) {
  const currentUrl = window.location.href;
  try {
    // 再次验证URL是否安全可靠
    if (!isValidUrl(targetUrl) || !isSafeTargetUrl(targetUrl)) {
      console.error('不安全的目标URL，拒绝跳转:', targetUrl);
      window.redirectHistory.addFailRecord(currentUrl, '不安全的目标URL: ' + targetUrl);
      return false;
    }
    
    // 使用全局变量
    window.redirectHistory.addRecord(currentUrl, targetUrl);
    
    // 执行跳转
    window.location.href = targetUrl;
    return true;
  } catch (error) {
    // 使用全局变量
    window.redirectHistory.addFailRecord(currentUrl, error.message);
    return false;
  }
}

// 处理微信安全页面
function handleWeixinPage() {
  // 检查页面状态
  const isErrorPage = document.body.textContent.includes('网络繁忙') || 
                     document.body.textContent.includes('请稍后再尝试') ||
                     document.body.textContent.includes('访问过于频繁') ||
                     document.body.textContent.includes('请求过于频繁') ||
                     document.body.textContent.includes('系统繁忙') ||
                     document.body.textContent.includes('Not Found') ||
                     document.body.textContent.includes('Could not find requested resource');
  
  if (isErrorPage) {
    // 如果是错误页面，尝试从referrer恢复
    const referrer = document.referrer;
    if (referrer && !referrer.includes('weixin110.qq.com')) {
      return safeRedirect(referrer);
    }
    
    // 如果没有有效的来源页面，检查历史记录中最后一个非微信页面
    if (window.history && window.history.length > 1) {
      window.history.back();
      return true;
    }
    
    // 记录失败
    redirectHistory.addFailRecord(window.location.href, '页面不存在或访问受限');
    return true;
  }

  // 检查是否是微信域名但URL包含可疑参数
  if (window.location.hostname === 'weixin110.qq.com') {
    const url = window.location.href;
    if (url.includes('pass_ticket=') || url.includes('exportkey=')) {
      // 尝试提取原始URL参数
      const urlParams = new URLSearchParams(window.location.search);
      const targetUrl = urlParams.get('url') || urlParams.get('target_url') || urlParams.get('redirect_url');
      
      if (targetUrl) {
        try {
          const decodedUrl = decodeURIComponent(targetUrl);
          if (!decodedUrl.includes('weixin110.qq.com')) {
            return safeRedirect(decodedUrl);
          }
        } catch(e) {
          redirectHistory.addFailRecord(url, 'URL解码失败: ' + e.message);
        }
      }
    }
  }

  // 尝试从页面中提取原始链接
  const originalUrl = extractWeixinOriginalUrl();
  if (originalUrl) {
    return safeRedirect(originalUrl);
  }

  // 直接查找页面中所有可能的按钮元素
  const allElements = document.getElementsByTagName('*');
  const clickDelay = getRandomDelay(800, 1500);
  
  setTimeout(() => {
    for (const element of allElements) {
      // 获取元素的文本内容
      const text = (element.textContent || '').toLowerCase().trim();
      // 获取元素的所有class名称
      const classes = (element.className || '').toLowerCase();
      // 获取元素的类型
      const tagName = element.tagName.toLowerCase();
      // 获取元素的role属性
      const role = (element.getAttribute('role') || '').toLowerCase();
      
      // 检查是否是可能的按钮
      const isButton = (
        tagName === 'button' ||
        tagName === 'a' ||
        role === 'button' ||
        classes.includes('btn') ||
        classes.includes('button') ||
        classes.includes('weui')
      );

      // 检查文本内容是否匹配
      const hasMatchingText = (
        text.includes('继续访问') ||
        text.includes('确认') ||
        text.includes('访问') ||
        text.includes('继续') ||
        text.includes('前往') ||
        text.includes('打开') ||
        text.includes('跳转')
      );

      if (isButton && hasMatchingText) {
        try {
          // 1. 尝试模拟真实的鼠标事件序列
          const events = [
            new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
          ];

          // 依次触发事件
          events.forEach(event => {
            element.dispatchEvent(event);
          });

          // 2. 如果是链接元素，尝试直接处理href
          if (tagName === 'a' && element.href) {
            if (element.href.startsWith('javascript:')) {
              // 提取并执行javascript代码
              const jsCode = element.href.slice(11).replace('confirm(', '').replace('alert(', '');
              try {
                new Function(jsCode)();
              } catch(e) {
                // 忽略执行错误
              }
            } else if (!element.href.includes('javascript:void(0)')) {
              window.location.href = element.href;
            }
          }

          // 3. 如果元素有onclick属性，尝试直接执行
          const onClickAttr = element.getAttribute('onclick');
          if (onClickAttr) {
            try {
              new Function(onClickAttr)();
            } catch(e) {
              // 忽略执行错误
            }
          }

          // 4. 最后尝试原生点击
          element.click();

          return true;
        } catch(e) {
          console.error('点击元素失败:', e);
          continue;
        }
      }
    }

    // 如果没找到可点击元素，延迟后重试
    setTimeout(handleWeixinPage, getRandomDelay(1000, 2000));
  }, clickDelay);

  return true;
}

// 提取微信安全页面中的原始链接
function extractWeixinOriginalUrl() {
  try {
    // 方法1：从页面文本中提取URL
    const pageText = document.body.textContent || '';
    const urlMatch = pageText.match(/https?:\/\/[^\s<>"']+/g);
    if (urlMatch) {
      for (const url of urlMatch) {
        // 进行更严格的URL验证
        if (isValidUrl(url) && isSafeTargetUrl(url)) {
          return url;
        }
      }
    }

    // 方法2：从链接元素中提取
    const links = document.querySelectorAll('a[href*="//"]');
    for (const link of links) {
      // 进行更严格的URL验证
      if (isValidUrl(link.href) && isSafeTargetUrl(link.href)) {
        return link.href;
      }
    }

    // 方法3：从URL参数中提取
    const urlParams = new URLSearchParams(window.location.search);
    const params = ['url', 'target', 'redirect_url', 'u', 'target_url'];
    for (const param of params) {
      const value = urlParams.get(param);
      if (value) {
        // 解码URL参数
        let decodedUrl = value;
        try {
          // 最多尝试解码5次
          for (let i = 0; i < 5; i++) {
            if (!decodedUrl.includes('%')) break;
            const newDecoded = decodeURIComponent(decodedUrl);
            if (newDecoded === decodedUrl) break;
            decodedUrl = newDecoded;
          }
          
          // 进行更严格的URL验证
          if (isValidUrl(decodedUrl) && isSafeTargetUrl(decodedUrl)) {
            return decodedUrl;
          }
        } catch (e) {
          // 解码失败，继续下一个参数
          continue;
        }
      }
    }

    // 方法4：从页面中的任何可能包含URL的元素中提取
    const elements = document.querySelectorAll('*');
    for (const element of elements) {
      const text = element.textContent || '';
      const matches = text.match(/https?:\/\/[^\s<>"']+/g);
      if (matches) {
        for (const url of matches) {
          // 进行更严格的URL验证
          if (isValidUrl(url) && isSafeTargetUrl(url)) {
            return url;
          }
        }
      }
    }

    return null;
  } catch (e) {
    console.error('提取原始链接失败:', e);
    return null;
  }
}

// 自动点击跳转按钮
function autoClickRedirectButton() {
  const hostname = window.location.hostname;

  // 优先处理微信安全页面
  if (hostname === 'weixin110.qq.com') {
    if (handleWeixinPage()) {
      return;
    }
  }

  // CSDN外链
  if (hostname === 'link.csdn.net') {
    // CSDN可能会对URL进行多次编码，所以使用通用提取函数
    const csdnTarget = extractTargetUrl();
    if (csdnTarget && isValidUrl(csdnTarget) && isSafeTargetUrl(csdnTarget)) {
      // 添加随机延迟，避免被微信拦截
      setTimeout(() => {
        safeRedirect(csdnTarget);
      }, getRandomDelay(300, 500));
      return;
    }

    // 如果URL参数提取失败，尝试查找页面中的链接
    const links = document.querySelectorAll('a[href*="//"]');
    for (const link of links) {
      if (!link.href.includes('csdn.net') && isValidUrl(link.href) && isSafeTargetUrl(link.href)) {
        setTimeout(() => {
          safeRedirect(link.href);
        }, getRandomDelay(300, 500));
        return;
      }
    }
  }
  
  // 知乎外链
  if (hostname.includes('link.zhihu.com')) {
    // 尝试直接从URL中提取目标
    const zhihuTarget = new URLSearchParams(window.location.search).get('target');
    if (zhihuTarget && isValidUrl(zhihuTarget) && isSafeTargetUrl(zhihuTarget)) {
      try {
        const decodedUrl = decodeURIComponent(zhihuTarget);
        if (isValidUrl(decodedUrl) && isSafeTargetUrl(decodedUrl)) {
          setTimeout(() => {
            safeRedirect(decodedUrl);
          }, getRandomDelay(200, 400));
          return;
        }
      } catch (e) {
        console.error('知乎链接解码失败:', e);
      }
    }
    
    // 如果URL中没有，尝试查找页面中的链接
    const links = document.querySelectorAll('a[href*="//"]');
    for (const link of links) {
      if (!link.href.includes('zhihu.com') && isValidUrl(link.href) && isSafeTargetUrl(link.href)) {
        setTimeout(() => {
          safeRedirect(link.href);
        }, getRandomDelay(200, 400));
        return;
      }
    }
  }

  // 通用中转页面处理（适用于大多数使用URL参数的网站）
  const targetUrl = extractTargetUrl();
  if (targetUrl && isValidUrl(targetUrl) && isSafeTargetUrl(targetUrl)) {
    // 保存原始URL到历史记录，以便返回
    const originalUrl = window.location.href;
    history.replaceState(null, '', originalUrl);
    
    setTimeout(() => {
      safeRedirect(targetUrl);
    }, getRandomDelay(200, 400));
    return;
  }
}

// 优化初始化延迟
setTimeout(() => {
  // 立即执行一次
  autoClickRedirectButton();

  // 页面加载完成后快速执行
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(autoClickRedirectButton, getRandomDelay(50, 100));
  });

  // 使用 requestAnimationFrame 在页面渲染时执行
  requestAnimationFrame(() => {
    setTimeout(autoClickRedirectButton, getRandomDelay(50, 100));
  });

  // 为了处理动态加载的内容，使用 MutationObserver
  const observer = new MutationObserver((mutations) => {
    if (mutations.some(mutation => mutation.addedNodes.length > 0)) {
      setTimeout(autoClickRedirectButton, getRandomDelay(50, 100));
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}, getRandomDelay(50, 100)); 