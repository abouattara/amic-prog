import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from '@prisma/config'

// The Prisma CLI only auto-loads `.env`; this project keeps its variables in
// `.env.local` (Next.js convention), so load that first and fall back to `.env`.
for (const file of ['.env.local', '.env']) {
  const candidate = path.join(__dirname, file)
  if (fs.existsSync(candidate)) {
    process.loadEnvFile(candidate)
    break
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
