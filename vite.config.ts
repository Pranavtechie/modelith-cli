import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
    plugins: [
        TanStackRouterVite({ autoCodeSplitting: true }),
        react(),
        tailwindcss(),
    ],
    root: 'src/frontend', // Source folder for frontend
    build: {
        outDir: '../../dist', // Output to root-level dist/
        emptyOutDir: true,
        rollupOptions: {
            input: path.resolve(__dirname, 'src/frontend/main.tsx'),
        },
    },
    resolve: {
        alias: {
            '@frontend': path.resolve(__dirname, 'src/frontend/src/'), // Specific to frontend
            '@db': path.resolve(__dirname, 'src/db'), // Shared DB access
            '@utils': path.resolve(__dirname, 'src/utils'), // Shared utilities
            '@': path.resolve(__dirname, 'src'), // Main Source Folder
        },
    }
});