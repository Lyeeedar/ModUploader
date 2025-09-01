import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';
import RendererPlugin from 'vite-plugin-electron-renderer';
import ReactPlugin from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { rmSync } from 'fs';
import pkg from './package.json' assert { type: 'json' };

const isDEV = process.env.NODE_ENV === 'development';
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  rmSync('dist-electron', { recursive: true, force: true });

  return {
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    base: './',
    root: resolve('./'),
    publicDir: resolve('./assets'),
    build: {
      sourcemap: isDEV,
      minify: !isDEV,
      assetsDir: '',
      outDir: resolve('./dist-electron'),
      rollupOptions: {
        external: ['steamworks.js'],
        output: {
          entryFileNames: `[name].js`,
          chunkFileNames: `[name].js`,
          assetFileNames: `[name].[ext]`,
        },
      },
    },
    plugins: [
      ReactPlugin(),
      electron({
        main: {
          entry: 'electron/main/index.ts',
          onstart(args) {
            if (process.env.VSCODE_DEBUG) {
              console.log('[startup] Electron App');
            } else {
              args.startup();
            }
          },
          vite: {
            build: {
              sourcemap: isDEV,
              minify: !isDEV,
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: [
                  ...Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
                  'steamworks.js'
                ],
              },
            },
            define: {
              'process.env.NODE_ENV': JSON.stringify(isDEV ? 'development' : 'production'),
            },
          },
        },
        preload: {
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: isDEV ? 'inline' : undefined,
              minify: !isDEV,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: [
                  ...Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
                  'steamworks.js'
                ],
              },
            },
          },
        },
        renderer: {},
      }),
      RendererPlugin(),
    ],
  };
});