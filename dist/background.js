(()=>{chrome.runtime.onMessage.addListener(((e,t,o)=>{"startDownload"===e.action&&o({success:!0})})),chrome.runtime.onMessage.addListener(((e,t,o)=>{if("closeCurrentTab"===e.action&&t.tab)return chrome.tabs.remove(t.tab.id),!0;if("downloadCurrentPDF"===e.action)return chrome.tabs.query({active:!0,currentWindow:!0},(async([e])=>{try{const t=await chrome.tabs.sendMessage(e.id,{action:"downloadCurrentPDF"});t.needsRedirect&&t.redirectUrl&&(await chrome.tabs.update(e.id,{url:t.redirectUrl}),chrome.tabs.onUpdated.addListener((function t(o,r){o===e.id&&"complete"===r.status&&(chrome.tabs.onUpdated.removeListener(t),setTimeout((async()=>{await chrome.tabs.sendMessage(e.id,{action:"downloadCurrentPDF"})}),2e3))}))),o(t)}catch(t){console.error("下载处理错误:",t),o({success:!1,error:t.message})}})),!0;if("openArticleAndDownload"===e.action)return chrome.tabs.create({url:e.url,active:!1},(e=>{function t(o,r){o===e.id&&"complete"===r.status&&(chrome.tabs.onUpdated.removeListener(t),setTimeout((()=>{chrome.tabs.sendMessage(e.id,{action:"downloadCurrentPDF",autoClose:!0})}),2e3))}chrome.tabs.onUpdated.addListener(t)})),o({success:!0}),!0;if("batchDownload"===e.action){const a=e.urls;let s=0;function r(){if(s>=a.length)return void o({success:!0,message:"批量下载完成"});const e=a[s];chrome.tabs.create({url:e,active:!1},(e=>{function t(o,a){o===e.id&&"complete"===a.status&&(chrome.tabs.onUpdated.removeListener(t),setTimeout((()=>{chrome.tabs.sendMessage(e.id,{action:"downloadCurrentPDF",autoClose:!0},(()=>{s++,r()}))}),2e3))}chrome.tabs.onUpdated.addListener(t)}))}return r(),!0}}))})();