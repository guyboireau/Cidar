import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    // src/lib/supabase.ts lève au chargement du module si ces variables manquent.
    // Les fournir ici rend `pnpm test` reproductible sans .env local et garantit
    // qu'un test ne pointe jamais vers une vraie instance Supabase.
    env: {
      VITE_SUPABASE_URL: 'https://mock-url.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx'],
    },
  },
})
