import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        allowedHosts: ['.tunnel.runloop.ai'],
        proxy: {
            '/api': 'http://localhost:3000',
            '/docs': 'http://localhost:3000',
            '/health': 'http://localhost:3000',
        },
    },
});
