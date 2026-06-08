import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Use the same API URL as the client for the dev server proxy
// Falls back to localhost if VITE_API_URL is not set
const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8000'

// Configure allowed hosts for dev server (which domains can access)
// Set ALLOWED_HOSTS env var as comma-separated list, or use true to allow all
const allowedHostsConfig = (() => {
  const hosts = process.env.ALLOWED_HOSTS
  if (hosts) {
    return hosts.split(',').map(h => h.trim())
  }
  // Default: allow all hosts (use 'true' to restrict to specific domains)
  return true
})()

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core/': path.resolve(__dirname, './src/core/'),
      '@modules/': path.resolve(__dirname, './src/modules/'),
      '@styles/': path.resolve(__dirname, './src/styles/'),
      '@pages/': path.resolve(__dirname, './src/pages/'),
    },
  },
   server: {
     host: true,
     port: 5173,
     allowedHosts: allowedHostsConfig,
     proxy: {
       '/api/v1/auth': {
         target: API_URL,
         changeOrigin: true,
       },
       '/api/v1/chat': {
         target: API_URL,
         changeOrigin: true,
       },
       // Keep legacy paths for compatibility (if any)
       '/auth': {
         target: API_URL,
         changeOrigin: true,
       },
       '/chat': {
         target: API_URL,
         changeOrigin: true,
       },
     },
   },
})
