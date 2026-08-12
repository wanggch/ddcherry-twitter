import { defineConfig, build } from 'vite';
import { resolve } from 'path';
import { rename, rmdir, readFile, writeFile } from 'fs/promises';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: true,
    rollupOptions: {
      input: {
        'popup': resolve(__dirname, 'src/popup/popup.html'),
        'options': resolve(__dirname, 'src/options/options.html'),
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return '[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  publicDir: 'public',
  plugins: [
    {
      name: 'build-scripts',
      closeBundle: async () => {
        const distDir = resolve(__dirname, 'dist');
        const srcDir = resolve(distDir, 'src');
        
        // Fix paths in HTML files and move them
        for (const page of ['popup', 'options']) {
          const htmlPath = resolve(srcDir, `${page}/${page}.html`);
          try {
            let content = await readFile(htmlPath, 'utf-8');
            // Fix relative paths (../../ -> ./)
            content = content.replace(/\.\.\/\.\.\//g, './');
            await writeFile(resolve(distDir, `${page}.html`), content);
          } catch (e) {
            console.error(`Failed to process ${page}.html:`, e);
          }
        }
        
        // Clean up src directory
        try {
          await rmdir(resolve(srcDir, 'popup'), { recursive: true });
          await rmdir(resolve(srcDir, 'options'), { recursive: true });
          await rmdir(srcDir, { recursive: true });
        } catch (e) {}

        // Build content-script as IIFE
        await build({
          configFile: false,
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, 'src/content-script/contentScript.ts'),
              name: 'contentScript',
              formats: ['iife'],
              fileName: () => 'content-script.js',
            },
            rollupOptions: {
              output: {
                extend: true,
              },
            },
          },
        });

        // Build service-worker as IIFE
        await build({
          configFile: false,
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, 'src/background/serviceWorker.ts'),
              name: 'serviceWorker',
              formats: ['iife'],
              fileName: () => 'service-worker.js',
            },
            rollupOptions: {
              output: {
                extend: true,
              },
            },
          },
        });
      },
    },
  ],
});
