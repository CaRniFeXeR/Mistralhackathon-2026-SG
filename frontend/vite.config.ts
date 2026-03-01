import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to all interfaces so the dev server is reachable from Windows host
    // when running inside WSL2.  Access: http://<WSL-IP>:5173
    host: true,
    port: 5173,
  },
})
