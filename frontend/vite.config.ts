import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Option A: Allow your specific ngrok domain
    allowedHosts: ['unempirical-hermila-enunciatory.ngrok-free.dev'],
  }
})


