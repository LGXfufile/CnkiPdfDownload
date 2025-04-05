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
              }, 2000);
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

  if (request.action === 'silentDownloadPDF') {
    // 在后台创建标签页
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
                return true;
              }
              return false;
            }
          }, (results) => {
            // 关闭临时打开的标签页
            setTimeout(() => {
              chrome.tabs.remove(tab.id);
            }, 2000);

            if (!results || !results[0]?.result) {
              sendResponse({ error: '未找到PDF下载按钮' });
            } else {
              sendResponse({ success: true });
            }
          });
        }
      });
    });
    return true; // 保持消息通道开放
  }

  if (request.action === 'silentBatchDownload') {
    const articles = request.articles;
    let currentIndex = 0;

    function downloadNext() {
      if (currentIndex >= articles.length) {
        sendResponse({ success: true });
        return;
      }

      const article = articles[currentIndex];
      chrome.tabs.create({ 
        url: article.url, 
        active: false 
      }, tab => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: () => {
                const pdfDownBtn = document.querySelector('#pdfDown');
                if (pdfDownBtn) {
                  pdfDownBtn.click();
                  return true;
                }
                return false;
              }
            }, () => {
              setTimeout(() => {
                chrome.tabs.remove(tab.id);
                currentIndex++;
                setTimeout(downloadNext, 2000); // 添加延迟避免请求过于频繁
              }, 2000);
            });
          }
        });
      });
    }

    downloadNext();
    return true;
  }

  if (request.action === 'batchDownloadWithSingleSave') {
    const articles = request.articles;
    let currentIndex = 0;
    
    console.log(`[批量下载] 开始处理 ${articles.length} 篇文章的下载队列`);
    
    async function processDownloadQueue() {
        if (currentIndex >= articles.length) {
            // 发送全部完成的通知
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'showNotification',
                message: `批量下载完成！共下载 ${articles.length} 篇文章`
            });
            sendResponse({ success: true });
            return;
        }

        const article = articles[currentIndex];
        console.log(`[批量下载] 正在处理第 ${currentIndex + 1}/${articles.length} 篇文章:`, article.title);
      
        try {
            const tab = await chrome.tabs.create({ 
                url: article.url, 
                active: false 
            });

            chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                if (tabId === tab.id && info.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: () => {
                            const pdfDownBtn = document.querySelector('#pdfDown');
                            if (pdfDownBtn) {
                                pdfDownBtn.click();
                                return true;
                            }
                            return false;
                        }
                    }, (results) => {
                        const success = results && results[0]?.result;
                        if (success) {
                            // 发送下载成功通知
                            chrome.tabs.sendMessage(sender.tab.id, {
                                action: 'showNotification',
                                message: `恭喜，第 ${currentIndex + 1} 篇文章下载成功！\n文章标题： ${article.title}`
                            });
                        }
                        
                        setTimeout(() => {
                            chrome.tabs.remove(tab.id);
                            currentIndex++;
                            setTimeout(processDownloadQueue, 2000);
                        }, 3000);
                    });
                }
            });
        } catch (error) {
            console.error(`[批量下载] 处理文章出错:`, error);
            // 发送错误通知
            chrome.tabs.sendMessage(sender.tab.id, {
                action: 'showNotification',
                message: `第 ${currentIndex + 1} 篇文章下载失败：${article.title}`
            });
            currentIndex++;
            setTimeout(processDownloadQueue, 2000);
        }
    }

    processDownloadQueue();
    return true;
  }
});

// 监听下载事件
chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
  // 检查是否是 PDF 文件
  if (downloadItem.filename.endsWith('.pdf')) {
    console.log(`[下载] 开始下载文件: ${downloadItem.filename}`);
    suggest();
  }
});

// 添加下载状态监听
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state) {
    console.log(`[下载] 文件下载状态变更:`, delta);
  }
});
