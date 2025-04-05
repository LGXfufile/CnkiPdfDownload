(()=>{chrome.runtime.onMessage.addListener(((e,t,r)=>{"startDownload"===e.action&&r({success:!0})})),chrome.runtime.onMessage.addListener(((e,t,r)=>{if("closeCurrentTab"===e.action&&t.tab)return chrome.tabs.remove(t.tab.id),!0;if("downloadCurrentPDF"===e.action)return chrome.tabs.query({active:!0,currentWindow:!0},(async([e])=>{try{const t=await chrome.tabs.sendMessage(e.id,{action:"downloadCurrentPDF"});t.needsRedirect&&t.redirectUrl&&(await chrome.tabs.update(e.id,{url:t.redirectUrl}),chrome.tabs.onUpdated.addListener((function t(r,o){r===e.id&&"complete"===o.status&&(chrome.tabs.onUpdated.removeListener(t),setTimeout((async()=>{await chrome.tabs.sendMessage(e.id,{action:"downloadCurrentPDF"})}),2e3))}))),r(t)}catch(t){console.error("下载处理错误:",t),r({success:!1,error:t.message})}})),!0;if("openArticleAndDownload"===e.action)return chrome.tabs.create({url:e.url,active:!1},(e=>{function t(r,o){r===e.id&&"complete"===o.status&&(chrome.tabs.onUpdated.removeListener(t),setTimeout((()=>{chrome.tabs.sendMessage(e.id,{action:"downloadCurrentPDF",autoClose:!0})}),2e3))}chrome.tabs.onUpdated.addListener(t)})),r({success:!0}),!0;if("batchDownload"===e.action){const s=e.urls;let n=0;function o(){if(n>=s.length)return void r({success:!0,message:"批量下载完成"});const e=s[n];chrome.tabs.create({url:e,active:!1},(e=>{function t(r,s){r===e.id&&"complete"===s.status&&(chrome.tabs.onUpdated.removeListener(t),setTimeout((()=>{chrome.tabs.sendMessage(e.id,{action:"downloadCurrentPDF",autoClose:!0},(()=>{n++,o()}))}),2e3))}chrome.tabs.onUpdated.addListener(t)}))}return o(),!0}if("silentDownloadPDF"===e.action)return chrome.tabs.create({url:e.url,active:!1},(e=>{chrome.tabs.onUpdated.addListener((function t(o,s){o===e.id&&"complete"===s.status&&(chrome.tabs.onUpdated.removeListener(t),chrome.scripting.executeScript({target:{tabId:e.id},function:()=>{const e=document.querySelector("#pdfDown");return!!e&&(e.click(),!0)}},(t=>{setTimeout((()=>{chrome.tabs.remove(e.id)}),2e3),t&&t[0]?.result?r({success:!0}):r({error:"未找到PDF下载按钮"})})))}))})),!0;if("silentBatchDownload"===e.action){const c=e.articles;let a=0;function o(){if(a>=c.length)return void r({success:!0});const e=c[a];chrome.tabs.create({url:e.url,active:!1},(e=>{chrome.tabs.onUpdated.addListener((function t(r,s){r===e.id&&"complete"===s.status&&(chrome.tabs.onUpdated.removeListener(t),chrome.scripting.executeScript({target:{tabId:e.id},function:()=>{const e=document.querySelector("#pdfDown");return!!e&&(e.click(),!0)}},(()=>{setTimeout((()=>{chrome.tabs.remove(e.id),a++,setTimeout(o,2e3)}),2e3)})))}))}))}return o(),!0}}))})();