import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import replace from '@rollup/plugin-replace';
import path from 'path';
import { resolvePkgPath } from '../rollup/utils.js';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    replace({
      __DEV__: true,
      preventAssignment: false,
    }),
  ],
  resolve: {
    alias: [
      {
        find: 'react',
        replacement: resolvePkgPath('react'),
      },
      {
        find: 'react-dom',
        replacement: resolvePkgPath('react-dom'),
      },
      {
        find: 'react-noop-renderer',
        replacement: resolvePkgPath('react-noop-renderer'),
      },
      {
        find: 'hostConfig',
        replacement: path.resolve(
          resolvePkgPath('react-dom'),
          'src/hostConfig.ts'
        ),
      },
    ],
  },
  optimizeDeps: {
    force: true,
  },
});
