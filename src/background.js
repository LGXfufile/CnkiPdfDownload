// 监听下载请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startDownload') {
    // 处理下载逻辑
    sendResponse({ success: true });
  }
});

// 监听来自popup和content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'closeCurrentTab' && sender.tab) {
    // 关闭当前标签页
    chrome.tabs.remove(sender.tab.id);
    return true;
  }

  if (request.action === 'downloadCurrentPDF') {
    // 获取当前标签页
    chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
      try {
        // 发送消息到content script
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'downloadCurrentPDF' });
        
        if (response.needsRedirect && response.redirectUrl) {
          // 需要先跳转到文章详情页
          await chrome.tabs.update(tab.id, { url: response.redirectUrl });
          
          // 等待页面加载完成
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
              // 移除监听器
              chrome.tabs.onUpdated.removeListener(listener);
              
              // 页面加载完成后，再次尝试下载
              setTimeout(async () => {
                await chrome.tabs.sendMessage(tab.id, { action: 'downloadCurrentPDF' });
              }, 2000); // 给页面2秒钟加载时间
            }
          });
        }
        
        sendResponse(response);
      } catch (error) {
        console.error('下载处理错误:', error);
        sendResponse({ success: false, error: error.message });
      }
    });
    return true; // 保持消息通道开放
  }

  if (request.action === 'openArticleAndDownload') {
    // 在新标签页中打开文章
    chrome.tabs.create({ url: request.url, active: false }, (tab) => {
      // 监听标签页加载完成
      function handleTabUpdate(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          // 移除监听器
          chrome.tabs.onUpdated.removeListener(handleTabUpdate);
          
          // 等待页面完全加载
          setTimeout(() => {
            // 在文章页面执行下载操作
            chrome.tabs.sendMessage(tab.id, { 
              action: 'downloadCurrentPDF',
              autoClose: true
            });
          }, 2000);
        }
      }
      
      chrome.tabs.onUpdated.addListener(handleTabUpdate);
    });
    
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'batchDownload') {
    // 处理批量下载
    const urls = request.urls;
    let currentIndex = 0;
    
    function downloadNext() {
      if (currentIndex >= urls.length) {
        sendResponse({ success: true, message: '批量下载完成' });
        return;
      }

      const url = urls[currentIndex];
      // 在新标签页中打开文章
      chrome.tabs.create({ url: url, active: false }, (tab) => {
        // 监听标签页加载完成
        function handleTabUpdate(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            // 移除监听器
            chrome.tabs.onUpdated.removeListener(handleTabUpdate);
            
            // 等待页面完全加载
            setTimeout(() => {
              // 在文章页面执行下载操作
              chrome.tabs.sendMessage(tab.id, { 
                action: 'downloadCurrentPDF',
                autoClose: true
              }, () => {
                // 下载完成后继续下一个
                currentIndex++;
                downloadNext();
              });
            }, 2000);
          }
        }
        
        chrome.tabs.onUpdated.addListener(handleTabUpdate);
      });
    }

    // 开始批量下载
    downloadNext();
    return true;
  }
});
