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
        TanStackRouterVite({ autoCodeSplitting: true }),
        react(),
        tailwindcss(),
    ],
    root: 'src/frontend/', // Source folder for frontend
    build: {
        outDir: '../../dist', // Output to root-level dist/
        emptyOutDir: true,
        chunkSizeWarningLimit: 700, // Increased to avoid warnings for vendor bundle
        rollupOptions: {
            input: path.resolve(__dirname, 'src/frontend/index.html'),
            output: {
                manualChunks: (id) => {
                    // React and core libraries
                    if (id.includes('node_modules/react') || 
                        id.includes('node_modules/react-dom') || 
                        id.includes('node_modules/@tanstack/react-router')) {
                        return 'react-core';
                    }
                    
                    // UI components from shadcn
                    if (id.includes('components/ui/')) {
                        return 'ui-components';
                    }
                    
                    // Markdown rendering
                    if (id.includes('node_modules/@uiw/react-markdown-preview') || 
                        id.includes('node_modules/markdown') || 
                        id.includes('node_modules/remark') || 
                        id.includes('node_modules/rehype')) {
                        return 'markdown';
                    }
                    
                    // Syntax highlighting
                    if (id.includes('node_modules/react-syntax-highlighter') || 
                        id.includes('node_modules/prismjs') || 
                        id.includes('node_modules/refractor')) {
                        return 'syntax-highlight';
                    }
                    
                    // Other vendor libraries
                    if (id.includes('node_modules/')) {
                        return 'vendor';
                    }
                }
            }
        },
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