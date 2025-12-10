import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 加载当前环境的环境变量
  // process.cwd() 获取当前工作目录
  // '' 表示加载所有环境变量，包括 VITE_ 开头和系统变量
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      vue(),
      vueDevTools(),
      // 自定义插件：处理 HTML 标题注入，解决闪烁问题
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          // 获取环境变量中的标题，如果没有则使用默认值
          const title = env.VITE_SITE_TITLE || '猫猫导航'
          // 将 HTML 中的 <title>...</title> 替换为环境变量的值
          return html.replace(
            /<title>(.*?)<\/title>/,
            `<title>${title}</title>`
          )
        }
      }
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
