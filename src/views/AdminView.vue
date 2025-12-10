<template>
  <div class="admin-container">
    <!-- 登录界面 -->
    <div v-if="!isAuthenticated" class="login-container">
      <div class="login-box">
        <h1>🔐 {{ adminPageTitle }}</h1>
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <label for="password">管理密钥:</label>
            <input
              id="password"
              type="password"
              v-model="loginPassword"
              placeholder="请输入管理密钥"
              required
              class="form-input"
            />
          </div>
          <button type="submit" class="login-btn" :disabled="loading">
            {{ loading ? '验证中...' : '登录' }}
          </button>
        </form>
        <div v-if="loginError" class="error-message">
          {{ loginError }}
        </div>
      </div>
    </div>

    <!-- 管理界面 -->
    <div v-else class="admin-dashboard">
      <!-- 顶部导航 -->
      <header class="admin-header">
        <div class="header-content">
          <h1>🛠️ {{ adminPageTitle }}</h1>
          <div class="header-actions">
            <button @click="emergencyReset" class="emergency-btn" hidden="true">🚨 紧急重置</button>
            <button @click="debugLoadData" class="debug-btn" hidden="true">🔍 调试加载</button>
            <span class="user-info">管理员</span>
            <button @click="logout" class="logout-btn">退出</button>
          </div>
        </div>
      </header>

      <!-- 主要内容 -->
      <main class="admin-main">
        <!-- 加载状态显示 -->
        <div v-if="loading" class="loading-overlay">
          <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>正在加载数据...</p>
            <button @click="skipLoading" class="skip-loading-btn">跳过加载</button>
          </div>
        </div>

        <div class="admin-tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'categories' }"
            @click="activeTab = 'categories'"
          >
            📁 分类管理
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'sites' }"
            @click="switchToSiteTab"
          >
            🌐 站点管理
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'settings' }"
            @click="activeTab = 'settings'"
          >
            ⚙️ 系统设置
          </button>
        </div>

        <!-- 分类管理 -->
        <div v-if="activeTab === 'categories'" class="tab-content">
          <CategoryManager
            :categories="categories"
            @update="handleCategoriesUpdate"
            @save="saveToGitHub"
            @viewSites="switchToSiteManager"
            :loading="saving"
          />
        </div>

        <!-- 站点管理 -->
        <div v-if="activeTab === 'sites'" class="tab-content">
          <SiteManager
            :categories="categories"
            :initialSelectedCategoryId="selectedCategoryId"
            @update="handleCategoriesUpdate"
            @save="saveToGitHub"
            :loading="saving"
          />
        </div>

        <!-- 系统设置 -->
        <div v-if="activeTab === 'settings'" class="tab-content">
          <SystemSettings />
        </div>
      </main>
    </div>

    <!-- 自定义弹框 -->
    <CustomDialog
      :visible="dialogVisible"
      :type="dialogType"
      :title="dialogTitle"
      :message="dialogMessage"
      :details="dialogDetails"
      @close="closeDialog"
      @confirm="closeDialog"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import CategoryManager from '../components/admin/CategoryManager.vue'
import SiteManager from '../components/admin/SiteManager.vue'
import SystemSettings from '../components/admin/SystemSettings.vue'
import CustomDialog from '../components/admin/CustomDialog.vue'
import { useGitHubAPI } from '../apis/useGitHubAPI.js'

const router = useRouter()
const { saveCategoriesToGitHub, loadCategoriesFromGitHub } = useGitHubAPI()

// 认证状态
const isAuthenticated = ref(false)
const loginPassword = ref('')
const loginError = ref('')
const loading = ref(false)
const saving = ref(false)

// 管理界面状态
const activeTab = ref('categories')
const categories = ref([])
const navTitle = ref('猫猫导航') 
const selectedCategoryId = ref('') 

// 环境变量配置的标题
const envAdminTitle = import.meta.env.VITE_ADMIN_TITLE
const envSiteTitle = import.meta.env.VITE_SITE_TITLE

// 计算属性：智能处理后台标题
// 修复逻辑：如果配置了 VITE_ADMIN_TITLE，就直接用它，不再拼接。
// 只有在没配置后台标题时，才自动使用 "导航站管理 - 网站名"
const adminPageTitle = computed(() => {
  if (envAdminTitle) {
    return envAdminTitle // 用户自定义了，完全听用户的
  }
  // 用户没定义，使用默认格式
  const siteName = envSiteTitle || navTitle.value || '猫猫导航'
  return `导航站管理 - ${siteName}`
})

// 紧急兜底
setTimeout(() => {
  if (loading.value) {
    console.warn('检测到loading状态异常，强制重置')
    loading.value = false
    if (categories.value.length === 0) {
      categories.value = [{ id: 'default', name: '默认分类', icon: '📁', order: 0, sites: [] }]
    }
  }
}, 5000)

// 自定义弹框状态
const dialogVisible = ref(false)
const dialogType = ref('success')
const dialogTitle = ref('')
const dialogMessage = ref('')
const dialogDetails = ref([])

// 更新浏览器标题 (Tab上的文字)
const updateDocTitle = () => {
  document.title = adminPageTitle.value
}

// 验证管理员密钥
const handleLogin = async () => {
  loading.value = true
  loginError.value = ''

  try {
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD
    if (!adminPassword) {
      throw new Error('管理密钥未配置，请配置环境变量')
    }

    if (loginPassword.value === adminPassword) {
      isAuthenticated.value = true
      localStorage.setItem('admin_authenticated', 'true')
      setTimeout(async () => {
        try {
          await loadCategories()
        } catch (error) {
          console.error('登录后数据加载失败:', error)
          loading.value = false
        }
      }, 500)
    } else {
      throw new Error('密钥错误，请重新输入')
    }
  } catch (error) {
    loginError.value = error.message
  } finally {
    if (!isAuthenticated.value) {
      loading.value = false
    }
  }
}

// 退出登录
const logout = () => {
  isAuthenticated.value = false
  localStorage.removeItem('admin_authenticated')
  loginPassword.value = ''
  router.push('/')
}

// 调试加载数据
const debugLoadData = async () => {
  try {
    const data = await loadCategoriesFromGitHub()
    showDialog('success', '🎉 调试成功', '直接调用GitHub API成功', [`数据分类数: ${data.categories?.length || 0}`])
  } catch (error) {
    showDialog('error', '❌ 调试失败', error.message)
  }
}

// 加载分类数据
const loadCategories = async () => {
  loading.value = true
  try {
    const { mockData } = await import('../mock/mock_data.js')
    categories.value = mockData.categories || []
    navTitle.value = mockData.title || '猫猫导航'
    updateDocTitle() 
  } catch (error) {
    categories.value = []
    navTitle.value = '猫猫导航'
    updateDocTitle()
  } finally {
    loading.value = false
  }
}

const handleCategoriesUpdate = (newCategories) => {
  categories.value = newCategories
}

const switchToSiteManager = (categoryId) => {
  selectedCategoryId.value = categoryId
  activeTab.value = 'sites'
}

const switchToSiteTab = () => {
  selectedCategoryId.value = '' 
  activeTab.value = 'sites'
}

const showDialog = (type, title, message, details = []) => {
  dialogType.value = type
  dialogTitle.value = title
  dialogMessage.value = message
  dialogDetails.value = details
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
}

const skipLoading = async () => {
  loading.value = false
  try {
    const { mockData } = await import('../mock/mock_data.js')
    categories.value = mockData.categories || []
    navTitle.value = mockData.title || '猫猫导航'
  } catch (error) {
    categories.value = [{ id: 'default', name: '默认分类', icon: '📁', order: 0, sites: [] }]
  }
  updateDocTitle()
}

const saveToGitHub = async () => {
  saving.value = true
  try {
    await saveCategoriesToGitHub({
      categories: categories.value,
      title: navTitle.value
    })
    showDialog('success', '🎉 保存成功', '您的更改已成功保存到GitHub仓库！', ['• 更改将在 2-3 分钟内自动部署到线上'])
  } catch (error) {
    showDialog('error', '❌ 保存失败', '保存过程中发生错误', [`• 详情: ${error.message}`])
  } finally {
    saving.value = false
  }
}

const emergencyReset = () => {
  loading.value = false
  const loadingOverlay = document.querySelector('.loading-overlay')
  if (loadingOverlay) loadingOverlay.style.display = 'none'
}

onMounted(() => {
  updateDocTitle()
  loading.value = false
  const savedAuth = localStorage.getItem('admin_authenticated')
  if (savedAuth === 'true') {
    isAuthenticated.value = true
    import('../mock/mock_data.js').then(({ mockData }) => {
      categories.value = mockData.categories || []
      navTitle.value = mockData.title || '猫猫导航'
      updateDocTitle()
    }).catch(() => {
      categories.value = []
    })
  }
})
</script>

<style scoped>
.admin-container {
  min-height: 100vh;
  background: #2c3e50;
}

/* 登录界面样式 */
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
}

.login-box {
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 400px;
}

.login-box h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #2c3e50;
  font-size: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #555;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 12px;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #3498db;
}

.login-btn {
  width: 100%;
  padding: 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.login-btn:hover:not(:disabled) {
  background: #2980b9;
}

.login-btn:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.error-message {
  margin-top: 15px;
  padding: 10px;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  text-align: center;
  font-size: 14px;
}

/* 管理界面样式 */
.admin-dashboard {
  min-height: 100vh;
  background: #f5f7fa;
}

.admin-header {
  background: white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 30px;
  max-width: 1200px;
  margin: 0 auto;
}

.header-content h1 {
  color: #2c3e50;
  margin: 0;
  font-size: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-info {
  color: #7f8c8d;
  font-size: 14px;
}

.emergency-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
  margin-right: 15px;
}

.emergency-btn:hover {
  background: #c0392b;
}

.debug-btn {
  padding: 8px 16px;
  background: #f39c12;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
  margin-right: 15px;
}

.debug-btn:hover {
  background: #e67e22;
}

.logout-btn {
  padding: 8px 16px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.logout-btn:hover {
  background: #c0392b;
}

.admin-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 30px;
}

/* loading overlay 样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(3px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  background: white;
  padding: 40px;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.admin-tabs {
  display: flex;
  background: white;
  border-radius: 8px;
  padding: 5px;
  margin-bottom: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.tab-btn {
  flex: 1;
  padding: 12px 20px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #7f8c8d;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.tab-btn.active {
  background: #3498db;
  color: white;
}

.tab-btn:hover:not(.active) {
  background: #f8f9fa;
  color: #2c3e50;
}

.tab-content {
  background: white;
  border-radius: 8px;
  padding: 30px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

/* 跳过加载按钮样式 */
.skip-loading-btn {
  margin-top: 20px;
  padding: 10px 20px;
  background: #f39c12;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s ease;
}

.skip-loading-btn:hover {
  background: #e67e22;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header-content {
    padding: 15px 20px;
  }

  .admin-main {
    padding: 20px 15px;
  }

  .tab-content {
    padding: 20px 15px;
  }

  .admin-tabs {
    flex-direction: column;
  }

  .tab-btn {
    margin-bottom: 5px;
  }
}
</style>
