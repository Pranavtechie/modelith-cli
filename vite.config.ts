import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'path';

export default defineConfig({
    server: {
        open: true,
    },
    preview: {
        open: true,
    },
    plugins: [
        react(),
        tailwindcss(),
        TanStackRouterVite({ autoCodeSplitting: true }),
    ],
    root: 'src/frontend/', // Source folder for frontend
    build: {
        outDir: '../../dist', // Output to root-level dist/
        emptyOutDir: true,
        chunkSizeWarningLimit: 700, // Increased to avoid warnings for vendor bundle
        sourcemap: true,
    },
    resolve: {
        alias: {
            '@frontend': path.resolve(__dirname, 'src/frontend/src/'),
            "@backend/*": path.resolve(__dirname, "src/backend/src/*"),
            '@db': path.resolve(__dirname, 'src/db'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@': path.resolve(__dirname, 'src'),
        },
    }
});