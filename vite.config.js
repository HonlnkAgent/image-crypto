import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// GitHub Pages 部署在子路径 /image-crypto/ 下，base 必须与之匹配，
// 否则打包后的 JS/CSS 资源会按根路径加载导致 404。
export default defineConfig({
  plugins: [vue()],
  base: '/image-crypto/',
  server: {
    host: '127.0.0.1',
    port: 5174
  }
})
