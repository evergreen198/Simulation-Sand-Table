import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',  // 后端地址
        changeOrigin: true,               // 解决跨域
        rewrite: (path) => path           // 保留 /api 路径
        // 如果想去掉 /api 前缀：
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
