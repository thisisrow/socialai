import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
  host: true,
  port: 5173,
  allowedHosts: [
      'edc83f2ff121.ngrok-free.app'
    ],
},

})
