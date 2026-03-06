import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    base: './',
    build: {
        rollupOptions: {
            input: {
                main: resolve(__dirname, '../index.html'),
                admin: resolve(__dirname, '../admin.html')
            },
            output: {
                manualChunks: {
                    phaser: ['phaser']
                }
            }
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true
    }
});
