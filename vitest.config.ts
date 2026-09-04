import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/amic_academia',
      NEXTAUTH_SECRET: 'vitest-secret-for-signed-urls',
      STORAGE_PROVIDER: 'local',
    },
  },
})
