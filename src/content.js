// 监听页面上的文章点击事件
let selectedArticleUrl = null;
let selectedArticleTitle = null;

// 调试日志函数
function debugLog(message, data = null) {
  const logStyle = 'background: #0066cc; color: white; padding: 2px 5px; border-radius: 3px;';
  if (data) {
    console.log('%c[CNKI下载器]', logStyle, message, data);
  } else {
    console.log('%c[CNKI下载器]', logStyle, message);
  }
}

// 监听复选框变化
document.addEventListener('change', (e) => {
  const checkbox = e.target;
  debugLog('检测到复选框变化:', { checked: checkbox.checked, element: checkbox });

  if (checkbox.type === 'checkbox') {
    const checkboxTd = checkbox.closest('td');
    debugLog('找到checkbox所在的td:', checkboxTd);

    if (checkboxTd) {
      const row = checkboxTd.closest('tr');
      debugLog('找到所在行:', row);

      if (row) {
        const titleLink = row.querySelector('a.fz14');
        debugLog('查找文章链接:', titleLink);

        if (titleLink && checkbox.checked) {
          selectedArticleUrl = titleLink.href;
          selectedArticleTitle = titleLink.textContent.trim();
          debugLog('成功获取文章信息:', {
            title: selectedArticleTitle,
            url: selectedArticleUrl
          });

          // 更新选中效果
          updateSelectedArticle(row);

          // 使用修改后的下载处理函数
          handleArticleDownload(selectedArticleUrl)
            .then(result => {
              if (result && result.error) {
                debugLog('下载过程出错:', result.error);
                alert(`下载失败: ${result.error}`);
              }
            })
            .catch(error => {
              debugLog('下载过程出错:', error);
              alert(`下载失败: ${error.message}`);
            });

        } else if (!checkbox.checked) {
          // 如果取消选中，清除选择状态
          selectedArticleUrl = null;
          selectedArticleTitle = null;
          updateSelectedArticle(null);
        }
      }
    }
  }
});

// 监听文章链接点击
document.addEventListener('click', (e) => {
  const titleLink = e.target.closest('a.fz14');
  if (titleLink) {
    selectedArticleUrl = titleLink.href;
    selectedArticleTitle = titleLink.textContent.trim();
    console.log('点击文章:', {
      title: selectedArticleTitle,
      url: selectedArticleUrl
    });
    // 通知扩展当前选中的文章URL
    chrome.runtime.sendMessage({
      action: 'articleSelected',
      url: selectedArticleUrl,
      title: selectedArticleTitle
    });
    
    // 更新选中效果
    updateSelectedArticle(titleLink.closest('tr'));
  }
});

// 处理文章下载流程
async function handleArticleDownload(articleUrl) {
  debugLog('开始处理文章下载:', articleUrl);
  
  try {
    // 检查扩展是否有效
    if (!chrome.runtime?.id) {
      throw new Error('扩展已重新加载，请刷新页面');
    }

    // 直接在当前页面打开新标签页
    const newTab = window.open(articleUrl, '_blank');
    
    // 发送消息到新标签页
    const checkInterval = setInterval(() => {
      try {
        // 检查扩展是否还有效
        if (!chrome.runtime?.id) {
          clearInterval(checkInterval);
          throw new Error('扩展已重新加载，请刷新页面');
        }

        if (newTab && newTab.document) {
          try {
            const pdfDownBtn = newTab.document.querySelector('#pdfDown');
            if (pdfDownBtn) {
              debugLog('找到PDF下载按钮');
              pdfDownBtn.click();
              clearInterval(checkInterval);
              // 等待下载开始后关闭标签页
              setTimeout(() => {
                try {
                  newTab.close();
                } catch (e) {
                  debugLog('关闭标签页失败:', e);
                }
              }, 2000);
              return;
            }
          } catch (e) {
            clearInterval(checkInterval);
            return sendDownloadMessage(articleUrl);
          }
        }
      } catch (e) {
        clearInterval(checkInterval);
        throw new Error('扩展已重新加载，请刷新页面');
      }
    }, 500);

    // 设置超时，避免无限等待
    setTimeout(() => {
      try {
        clearInterval(checkInterval);
        return sendDownloadMessage(articleUrl);
      } catch (e) {
        throw new Error('下载超时，请重试');
      }
    }, 5000);

  } catch (error) {
    debugLog('下载处理出错:', error);
    if (error.message.includes('扩展已重新加载')) {
      alert('扩展已更新，请刷新页面后重试');
      return { error: '扩展已更新，请刷新页面后重试' };
    }
    return { error: error.message };
  }
}

// 新增辅助函数处理消息发送
function sendDownloadMessage(articleUrl) {
  return new Promise((resolve) => {
    try {
      // 检查扩展是否有效
      if (!chrome.runtime?.id) {
        resolve({ error: '扩展已重新加载，请刷新页面' });
        return;
      }

      const messageTimeout = setTimeout(() => {
        resolve({ error: '下载请求超时' });
      }, 10000);

      chrome.runtime.sendMessage({
        action: 'downloadPDFInBackground',
        url: articleUrl,
        title: selectedArticleTitle || 'document'
      }, (response) => {
        clearTimeout(messageTimeout);
        
        if (chrome.runtime.lastError) {
          debugLog('消息发送错误:', chrome.runtime.lastError);
          resolve({ error: chrome.runtime.lastError.message });
          return;
        }

        resolve(response || { success: true });
      });
    } catch (error) {
      resolve({ error: '扩展通信错误，请刷新页面重试' });
    }
  });
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadCurrentPDF') {
    try {
      // 检查是否在文章详情页（支持WebVPN环境）
      if (window.location.href.includes('/article/detail') || 
          window.location.href.includes('/article/abstract') ||
          window.location.href.includes('.webvpn.') && 
          (window.location.href.includes('/kns8/Detail') || 
           window.location.href.includes('/kns8/defaultresult/index'))) {
        // 在详情页面，直接尝试下载
        handlePDFDownload(sendResponse);
        
        // 如果设置了自动关闭，则下载后关闭标签页
        if (request.autoClose) {
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'closeCurrentTab' });
          }, 1000);
        }
      } else if (selectedArticleUrl) {
        // 在列表页面，需要先打开详情页
        // 确保URL包含WebVPN前缀
        const redirectUrl = selectedArticleUrl.includes('.webvpn.') ? 
          selectedArticleUrl : 
          selectedArticleUrl.replace('https://', 'https://kns-cnki-net-443.webvpn.zisu.edu.cn/');
        
        sendResponse({ 
          success: true, 
          needsRedirect: true,
          redirectUrl: redirectUrl
        });
      } else {
        sendResponse({ success: false, error: '请先选择要下载的文章' });
      }
    } catch (error) {
      console.error('PDF下载错误:', error);
      sendResponse({ success: false, error: '下载失败：' + error.message });
    }
    return true;
  }

  if (request.action === 'startBatchDownload') {
    // 获取所有选中的文章
    const selectedRows = document.querySelectorAll('input[type="checkbox"]:checked');
    const articles = Array.from(selectedRows).map(checkbox => {
      const row = checkbox.closest('tr');
      const titleLink = row.querySelector('a.fz14');
      return {
        title: titleLink.textContent.trim(),
        url: titleLink.href
      };
    });
    
    if (articles.length === 0) {
      sendResponse({ success: false, error: '请先选择要下载的文章' });
      return;
    }

    // 发送批量下载信息
    sendResponse({ 
      success: true, 
      total: articles.length,
      articles: articles
    });
    return true;
  }

  if (request.action === 'downloadPDFInBackground') {
    // 在后台打开文章详情页
    chrome.tabs.create({ 
      url: request.url, 
      active: false 
    }, tab => {
      // 监听标签页加载完成
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          // 移除监听器
          chrome.tabs.onUpdated.removeListener(listener);
          
          // 在文章详情页面执行脚本查找并点击下载按钮
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
              const pdfDownBtn = document.querySelector('#pdfDown');
              if (pdfDownBtn) {
                pdfDownBtn.click();
                // 下载开始后关闭标签页
                setTimeout(() => {
                  chrome.runtime.sendMessage({ action: 'closeCurrentTab' });
                }, 1000);
                return true;
              }
              return false;
            }
          }, (results) => {
            if (!results || !results[0]?.result) {
              sendResponse({ error: '未找到PDF下载按钮' });
            }
            // 关闭临时打开的标签页
            setTimeout(() => {
              chrome.tabs.remove(tab.id);
            }, 2000);
          });
        }
      });
    });
    return true; // 保持消息通道开放
  }
});

// 处理PDF下载
function handlePDFDownload(sendResponse) {
  debugLog('开始处理PDF下载');
  
  // 首先尝试通过 ID 查找 PDF 下载按钮
  const pdfDownBtn = document.querySelector('#pdfDown');
  if (pdfDownBtn) {
    debugLog('找到ID为pdfDown的下载按钮');
    pdfDownBtn.click();
    sendResponse({ success: true });
    return;
  }
  
  debugLog('未找到ID为pdfDown的按钮，尝试其他方式');
  
  // 如果没找到，再尝试其他方式查找下载按钮
  const pdfButtons = Array.from(document.querySelectorAll('a, button')).filter(el => 
    el.textContent.includes('PDF下载') || 
    el.getAttribute('title')?.includes('PDF下载') ||
    el.getAttribute('href')?.includes('download.aspx') ||
    el.getAttribute('href')?.includes('download/order')
  );
  debugLog('找到的其他PDF下载按钮:', pdfButtons);

  if (pdfButtons.length > 0) {
    debugLog('点击找到的PDF下载按钮');
    pdfButtons[0].click();
    sendResponse({ success: true });
  } else {
    debugLog('尝试查找下载链接');
    // 尝试查找下载链接
    const downloadLinks = document.querySelectorAll('a[href*="download/order"], a[href*="download.aspx"]');
    debugLog('找到的下载链接:', downloadLinks);

    if (downloadLinks.length > 0) {
      const downloadUrl = downloadLinks[0].href;
      debugLog('准备创建下载表单:', downloadUrl);

      // 创建下载表单
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = downloadUrl;
      form.target = '_blank';
      
      // 添加必要的参数
      const params = {
        'filename': document.querySelector('.title, h1, .brief')?.textContent?.trim() || 'document',
        'dflag': 'pdfdown',
        'showcol': '1'
      };
      debugLog('表单参数:', params);

      Object.entries(params).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      // 提交表单
      debugLog('提交下载表单');
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
      
      sendResponse({ success: true });
    } else {
      debugLog('未找到任何下载链接');
      sendResponse({ success: false, error: '未找到PDF下载按钮或下载链接' });
    }
  }
}

// 修改样式添加逻辑
function addCustomStyles() {
  if (!document.head) {
    // 如果 head 还不存在，等待 DOM 加载完成
    window.addEventListener('DOMContentLoaded', addCustomStyles);
    return;
  }

  const style = document.createElement('style');
  style.textContent = `
    /* 表格行样式优化 */
    tr.selected {
      background-color: rgba(0, 113, 227, 0.08) !important;
      transition: background-color 0.3s ease;
    }
    tr.selected td {
      background-color: transparent !important;
    }
    tr:hover {
      background-color: rgba(0, 113, 227, 0.04);
    }
    
    /* 文章标题样式优化 */
    .fz14 {
      transition: all 0.3s ease;
      text-decoration: none !important;
    }
    tr.selected .fz14 {
      color: #0071e3 !important;
      font-weight: 500;
    }
    
    /* 下载按钮容器样式 */
    .cnki-download-buttons {
      display: inline-flex !important;
      align-items: center;
      gap: 8px;
      margin-left: 10px;
      vertical-align: middle;
    }
    
    /* 下载按钮基础样式 */
    .cnki-download-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      white-space: nowrap;
      height: 26px;
      line-height: 1;
    }
    
    /* 主要按钮样式 */
    .cnki-download-btn.primary {
      background-color: #1e80ff;
      color: white;
    }
    .cnki-download-btn.primary:hover {
      background-color: #1b76ed;
    }
    .cnki-download-btn.primary:active {
      background-color: #1867d0;
    }
    
    /* 次要按钮样式 */
    .cnki-download-btn.secondary {
      background-color: #f5f6f7;
      color: #1e80ff;
      border-color: #e4e6eb;
    }
    .cnki-download-btn.secondary:hover {
      background-color: #e8f3ff;
      border-color: #1e80ff;
    }
    .cnki-download-btn.secondary:active {
      background-color: #dcebff;
    }
  `;
  document.head.appendChild(style);
}

// 调用样式添加函数
addCustomStyles();

// 添加选中效果
function updateSelectedArticle(element) {
  // 移除之前的选中效果
  document.querySelectorAll('tr.selected').forEach(el => {
    el.classList.remove('selected');
  });
  
  // 添加新的选中效果
  if (element) {
    element.classList.add('selected');
  }
}

// 修改添加下载按钮的函数
function addDownloadButtons() {
  debugLog('开始添加下载按钮');
  
  // 使用 let 而不是 const，因为变量可能会被重新赋值
  let themeButton = document.querySelector('.theme-title, .subject-title, [data-type="subject"], button.subject');
  
  if (!themeButton) {
    // 尝试通过文本内容查找
    const buttons = Array.from(document.querySelectorAll('button, div'));
    const themeBtn = buttons.find(btn => btn.textContent.includes('主题'));
    
    if (!themeBtn) {
      debugLog('未找到主题按钮，将在1秒后重试');
      setTimeout(addDownloadButtons, 1000);
      return;
    } else {
      themeButton = themeBtn; // 现在可以重新赋值了
    }
  }

  // 检查是否已经添加过按钮
  if (document.querySelector('.cnki-download-buttons')) {
    debugLog('下载按钮已存在，无需重复添加');
    return;
  }

  // 创建下载按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'cnki-download-buttons';
  buttonContainer.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: 10px;
    vertical-align: middle;
  `;

  // 创建单个下载按钮
  const singleDownloadBtn = document.createElement('button');
  singleDownloadBtn.textContent = '单个下载';
  singleDownloadBtn.className = 'cnki-download-btn secondary';
  singleDownloadBtn.style.cssText = `
    background-color: #f5f6f7;
    color: #1e80ff;
    border: 1px solid #e4e6eb;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    height: 26px;
    line-height: 1;
  `;
  singleDownloadBtn.onclick = () => {
    if (selectedArticleUrl) {
      handleArticleDownload(selectedArticleUrl);
    } else {
      alert('请先选择要下载的文章');
    }
  };

  // 创建批量下载按钮
  const batchDownloadBtn = document.createElement('button');
  batchDownloadBtn.textContent = '批量下载';
  batchDownloadBtn.className = 'cnki-download-btn primary';
  batchDownloadBtn.style.cssText = `
    background-color: #1e80ff;
    color: white;
    border: none;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    height: 26px;
    line-height: 1;
  `;
  batchDownloadBtn.onclick = async () => {
    try {
      // 检查扩展是否有效
      if (!chrome.runtime?.id) {
        alert('扩展已更新，请刷新页面后重试');
        return;
      }

      const selectedCheckboxes = document.querySelectorAll('input[type="checkbox"]:checked');
      if (selectedCheckboxes.length === 0) {
        alert('请先选择要下载的文章');
        return;
      }
      
      const articles = Array.from(selectedCheckboxes).map(checkbox => {
        const row = checkbox.closest('tr');
        const titleLink = row.querySelector('a.fz14');
        return titleLink ? {
          url: titleLink.href,
          title: titleLink.textContent.trim()
        } : null;
      }).filter(article => article !== null);

      // 使用队列处理下载
      for (const article of articles) {
        try {
          debugLog('开始下载文章:', article.title);
          const result = await handleArticleDownload(article.url);
          
          if (result && result.error) {
            debugLog(`文章 "${article.title}" 下载失败:`, result.error);
          } else {
            debugLog(`文章 "${article.title}" 下载已开始`);
          }
          
          // 在每次下载之间添加延迟
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
          debugLog(`文章 "${article.title}" 下载出错:`, error);
          continue;
        }
      }
    } catch (error) {
      debugLog('批量下载出错:', error);
      alert('下载过程出错，请刷新页面重试');
    }
  };

  // 添加按钮到容器
  buttonContainer.appendChild(singleDownloadBtn);
  buttonContainer.appendChild(batchDownloadBtn);

  try {
    // 将按钮容器插入到主题按钮的前面
    const parentElement = themeButton.parentNode;
    if (parentElement) {
      parentElement.insertBefore(buttonContainer, themeButton);
      debugLog('下载按钮添加完成');
    } else {
      throw new Error('未找到主题按钮的父元素');
    }
  } catch (error) {
    debugLog('添加按钮时出错:', error);
    setTimeout(addDownloadButtons, 1000);
  }
}

// 修改初始化逻辑
function initializeExtension() {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
      addCustomStyles();
      addDownloadButtons();
      setupObserver();
    });
  } else {
    addCustomStyles();
    addDownloadButtons();
    setupObserver();
  }
}

// 设置观察者的函数
function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        if (!document.querySelector('.cnki-download-buttons')) {
          addDownloadButtons();
          break;
        }
      }
    }
  });

  const mainContent = document.querySelector('.main-content, #content, main');
  if (mainContent) {
    observer.observe(mainContent, {
      childList: true,
      subtree: true
    });
  } else {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 确保在页面卸载时停止观察
  window.addEventListener('unload', () => {
    observer.disconnect();
  });
}

// 启动扩展
initializeExtension();
