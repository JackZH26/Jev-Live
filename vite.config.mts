import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({ plugins: [vue()], base: './', build:{rollupOptions:{input:{main:'index.html',overlay:'overlay.html'}}}, server: { host: '127.0.0.1', port: 5173, strictPort: true } });
