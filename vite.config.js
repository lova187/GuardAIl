import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  // Настройки для GitHub Pages (если планируете деплой)
  base: process.env.NODE_ENV === 'production' ? '/guardai-self-defense/' : '/',
  
  // Настройки для MediaPipe
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision']
  },
  
  server: {
    host: true,
    port: 3000,
    // Заголовки для MediaPipe (важно для камеры)
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    // Настройки для больших файлов MediaPipe
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mediapipe: ['@mediapipe/tasks-vision']
        }
      }
    }
  },
  
  // Поддержка WASM файлов
  assetsInclude: ['**/*.wasm', '**/*.task']
})
