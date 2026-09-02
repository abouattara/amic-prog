import EmbeddedPostgres from 'embedded-postgres'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '.postgres-data')
const alreadyExists = fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'postgres',
  port: 5432,
  persistent: true,
})

console.log('🐘 Starting embedded PostgreSQL on port 5432...')

if (!alreadyExists) {
  await pg.initialise()
}

await pg.start()

try {
  await pg.createDatabase('amic_academia')
  console.log('✅ Database "amic_academia" created')
} catch {
  // Already exists — expected on second run
}

console.log('✅ PostgreSQL ready: postgresql://postgres:postgres@localhost:5432/amic_academia')
console.log('   Press Ctrl+C to stop\n')

process.on('SIGINT', async () => {
  console.log('\n🛑 Stopping PostgreSQL...')
  await pg.stop()
  process.exit(0)
})
