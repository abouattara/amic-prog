/**
 * Crée (ou met à jour) un compte administrateur.
 *
 * Le mot de passe n'est JAMAIS écrit dans le code ni dans un fichier : il est
 * saisi au clavier, masqué, ou fourni via la variable d'environnement
 * ADMIN_PASSWORD pour un usage non interactif (CI).
 *
 * Usage :
 *   npm run db:create-admin
 *
 * Pour viser la production, exportez DATABASE_URL avant de lancer la commande.
 * Le script affiche toujours la base ciblée et demande confirmation avant d'écrire.
 *
 * Options :
 *   --update   autorise la mise à jour d'un compte existant (mot de passe / rôle)
 *   --yes      saute la confirmation interactive (pour la CI)
 *
 * Variables reconnues : ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRSTNAME, ADMIN_LASTNAME.
 * Hors terminal interactif, toute valeur manquante provoque un échec explicite
 * plutôt qu'une invite sans réponse possible.
 */
import readline from 'node:readline'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const args = process.argv.slice(2)
const ALLOW_UPDATE = args.includes('--update')
const SKIP_CONFIRM = args.includes('--yes')
const MIN_PASSWORD_LENGTH = 12
const INTERACTIVE = Boolean(process.stdin.isTTY)

class ConfigError extends Error {}

/** Refuse de poser une question quand personne ne peut y répondre. */
function requireInteractive(envVar) {
  if (!INTERACTIVE) {
    throw new ConfigError(
      `entrée non interactive : renseignez ${envVar} dans l'environnement, ou lancez le script depuis un terminal.`,
    )
  }
}

function ask(query, envVar) {
  requireInteractive(envVar)
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(query, (v) => (rl.close(), resolve(v.trim()))))
}

function askHidden(query, envVar) {
  requireInteractive(envVar)
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    let muted = false
    rl._writeToOutput = (str) => {
      if (!muted) rl.output.write(str)
    }
    rl.question(query, (value) => {
      rl.output.write('\n')
      rl.close()
      resolve(value)
    })
    muted = true
  })
}

/** Masque les identifiants d'une URL de connexion avant affichage. */
function describeTarget(url) {
  try {
    const u = new URL(url)
    return `${u.hostname}:${u.port || 5432}${u.pathname}`
  } catch {
    return '(URL illisible)'
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new ConfigError('DATABASE_URL absente. Lancez le script via « npm run db:create-admin ».')
  }

  const target = describeTarget(connectionString)
  console.log('\n🎯 Base ciblée :', target, '\n')

  const email = (process.env.ADMIN_EMAIL || (await ask('Email de l’administrateur : ', 'ADMIN_EMAIL'))).toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ConfigError(`email invalide : « ${email} »`)
  }

  const pool = new Pool({ connectionString })
  const db = new PrismaClient({ adapter: new PrismaPg(pool) })

  try {
    const existing = await db.user.findUnique({ where: { email }, select: { role: true } })

    if (existing && !ALLOW_UPDATE) {
      throw new ConfigError(
        `un compte existe déjà pour ${email} (rôle ${existing.role}).\n` +
          '   Relancez avec --update pour réinitialiser son mot de passe et le passer ADMIN.',
      )
    }

    // Identité demandée uniquement à la création : inutile lors d'une mise à jour.
    let firstName, lastName
    if (!existing) {
      firstName = process.env.ADMIN_FIRSTNAME || (await ask('Prénom : ', 'ADMIN_FIRSTNAME'))
      lastName = process.env.ADMIN_LASTNAME || (await ask('Nom : ', 'ADMIN_LASTNAME'))
      if (!firstName || !lastName) throw new ConfigError('prénom et nom sont obligatoires.')
    }

    let password = process.env.ADMIN_PASSWORD
    if (!password) {
      password = await askHidden(`Mot de passe (${MIN_PASSWORD_LENGTH} caractères minimum) : `, 'ADMIN_PASSWORD')
      const confirm = await askHidden('Confirmez le mot de passe : ', 'ADMIN_PASSWORD')
      if (password !== confirm) throw new ConfigError('les deux saisies diffèrent.')
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ConfigError(`mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`)
    }

    if (!SKIP_CONFIRM) {
      const action = existing ? 'Mettre à jour' : 'Créer'
      const go = await ask(`\n${action} l’admin « ${email} » sur ${target} ? (oui/non) `, 'rien (utilisez --yes)')
      if (!/^(o|oui|y|yes)$/i.test(go)) {
        console.log('Annulé — aucune écriture effectuée.')
        return
      }
    }

    const passwordHash = await bcrypt.hash(password, 12)

    if (existing) {
      await db.user.update({ where: { email }, data: { passwordHash, role: 'ADMIN', isActive: true } })
      console.log(`\n✅ Compte mis à jour : ${email} (rôle ADMIN, nouveau mot de passe)`)
    } else {
      await db.user.create({
        data: {
          email,
          firstName,
          lastName,
          passwordHash,
          role: 'ADMIN',
          profile: { create: { country: 'BF' } },
        },
      })
      console.log(`\n✅ Administrateur créé : ${email}`)
    }
  } finally {
    await db.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err instanceof ConfigError ? `\n❌ ${err.message}` : `\n❌ Échec : ${err.message}`)
  process.exit(1)
})
