<template>
  <div class="popup-container">
    <el-container>
      <el-header class="apple-style-header">
        <div class="header-content">
          <img src="../assets/1.jpg" alt="Logo" class="logo">
          <h1>CNKI PDF Downloader Pro</h1>
        </div>
      </el-header>
      
      <el-main class="apple-style-main">
        <div class="feature-section">
          <h2 class="section-title">PDF Download Manager</h2>
          <div class="pro-badge">Professional</div>
          
          <div class="action-buttons">
            <button class="apple-button primary" @click="downloadCurrent" :disabled="downloading">
              <div class="button-content">
                <el-icon class="button-icon"><Download /></el-icon>
                <span>Download Current PDF</span>
              </div>
            </button>

            <div class="divider">
              <span class="divider-text">Batch Download</span>
            </div>

            <button class="apple-button secondary" @click="startBatchDownload" :disabled="batchDownloading">
              <div class="button-content">
                <el-icon class="button-icon"><Files /></el-icon>
                <span>Download All PDFs</span>
              </div>
            </button>
          </div>
          
          <div v-if="downloadStats.total > 0" class="progress-section">
            <div class="progress-bar-wrapper">
              <div class="progress-bar" :style="{ width: downloadStats.progress + '%' }"></div>
            </div>
            <div class="progress-text">
              Downloaded: {{ downloadStats.completed }}/{{ downloadStats.total }}
            </div>
          </div>
        </div>
      </el-main>
      
      <el-footer class="apple-style-footer">
        <button class="settings-button" @click="openSettings">
          <el-icon><Setting /></el-icon>
          <span>Settings</span>
        </button>
        <span class="version">v1.0.0</span>
      </el-footer>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Download, Files, Setting } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const downloading = ref(false)
const batchDownloading = ref(false)
const selectedArticle = ref(null)
const downloadStats = ref({
  total: 0,
  completed: 0,
  progress: 0
})

// 监听文章选择消息
onMounted(() => {
  chrome.runtime.onMessage.addListener((request, sender) => {
    if (request.action === 'articleSelected') {
      selectedArticle.value = request.url;
      ElMessage.success('文章已选择');
    }
  });
});

const downloadCurrent = async () => {
  if (!selectedArticle.value) {
    ElMessage.warning('请先选择要下载的文章');
    return;
  }

  try {
    downloading.value = true;
    
    // 发送下载请求到background script
    const response = await chrome.runtime.sendMessage({
      action: 'downloadCurrentPDF'
    });

    if (response.success) {
      if (response.needsRedirect) {
        ElMessage.info('正在跳转到文章页面...');
      } else {
        ElMessage.success('PDF下载已开始');
      }
    } else {
      ElMessage.error(response.error || '下载失败');
    }
  } catch (error) {
    ElMessage.error('下载失败：' + error.message);
  } finally {
    downloading.value = false;
  }
}

const startBatchDownload = async () => {
  try {
    batchDownloading.value = true;
    
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 发送批量下载请求到content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'startBatchDownload'
    });

    if (response.success) {
      downloadStats.value.total = response.total;
      downloadStats.value.completed = 0;
      downloadStats.value.progress = 0;
      
      // 开始逐个下载文章
      for (const article of response.articles) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'downloadCurrentPDF',
            url: article.url
          });
          downloadStats.value.completed++;
          downloadStats.value.progress = (downloadStats.value.completed / downloadStats.value.total) * 100;
        } catch (error) {
          console.error(`Failed to download article: ${article.title}`, error);
        }
      }
      
      ElMessage.success('批量下载完成');
    } else {
      ElMessage.error(response.error || '批量下载失败');
    }
  } catch (error) {
    ElMessage.error('批量下载失败：' + error.message);
  } finally {
    batchDownloading.value = false;
  }
}

const openSettings = () => {
  // Implementation will be added
}
</script>

<style scoped>
.popup-container {
  width: 400px;
  min-height: 500px;
  background: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}

.apple-style-header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e5e5e5;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  align-items: center;
  padding: 16px 0;
  gap: 12px;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  object-fit: cover;
}

h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
}

.apple-style-main {
  padding: 32px 24px;
}

.feature-section {
  text-align: center;
}

.section-title {
  font-size: 28px;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0 0 8px;
}

.pro-badge {
  display: inline-block;
  background: #2ecc71;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 32px;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;
}

.apple-button {
  width: 100%;
  padding: 16px 24px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.apple-button.primary {
  background: #0071e3;
  color: white;
}

.apple-button.primary:hover {
  background: #0077ed;
}

.apple-button.secondary {
  background: #4cd964;
  color: white;
}

.apple-button.secondary:hover {
  background: #53e86a;
}

.apple-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.button-icon {
  font-size: 20px;
}

.divider {
  position: relative;
  text-align: center;
  margin: 24px 0;
}

.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #e5e5e5;
}

.divider-text {
  background: white;
  padding: 0 16px;
  color: #86868b;
  position: relative;
  font-size: 14px;
}

.progress-section {
  margin-top: 32px;
}

.progress-bar-wrapper {
  width: 100%;
  height: 6px;
  background: #f5f5f7;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #0071e3;
  transition: width 0.3s ease;
}

.progress-text {
  margin-top: 8px;
  color: #86868b;
  font-size: 14px;
}

.apple-style-footer {
  border-top: 1px solid #e5e5e5;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-button {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #86868b;
  font-size: 14px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.settings-button:hover {
  background: #f5f5f7;
}

.version {
  color: #86868b;
  font-size: 14px;
}

/* Element Plus 样式覆盖 */
:deep(.el-message) {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style> 