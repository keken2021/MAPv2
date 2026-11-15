import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/* 
  file summary: vite and vitest configuration file.
  responsibilities: configures react plugin, tailwindcss plugin, and vitest test runner environment with jsdom setup.
  role in system: bundler and test configuration loaded by vite cli and vitest.
*/

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});

