/**
 * Tests du NotificationProvider : sélection par env, isolation des échecs email,
 * fallback mock si clé absente.
 *
 * Les tests d'intégration (email failure isolation) utilisent la vraie DB.
 * Les tests de factory sont des tests unitaires purs (pas de DB).
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  MockNotificationProvider,
  ResendEmailProvider,
  createNotificationProvider,
} from '@/services/notification-provider'

const P = `notif_prov_${Date.now()}`
let userId: string

// ── Setup : un utilisateur de test ───────────────────────────────────────────

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      firstName: 'Provider',
      lastName: 'Test',
      email: `${P}@t.com`,
      passwordHash: 'x',
      role: 'STUDENT',
      profile: { create: {} },
    },
  })
  userId = user.id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { userId } })
  await prisma.profile.deleteMany({ where: { userId } })
  await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
})

// ── Factory : sélection du provider ─────────────────────────────────────────

describe('createNotificationProvider : sélection par EMAIL_PROVIDER', () => {
  it('EMAIL_PROVIDER=mock → MockNotificationProvider', () => {
    vi.stubEnv('EMAIL_PROVIDER', 'mock')
    const p = createNotificationProvider()
    expect(p).toBeInstanceOf(MockNotificationProvider)
    vi.unstubAllEnvs()
  })

  it('EMAIL_PROVIDER absent → MockNotificationProvider (défaut)', () => {
    vi.stubEnv('EMAIL_PROVIDER', '')
    const p = createNotificationProvider()
    // chaîne vide → fallback mock
    expect(p).toBeInstanceOf(MockNotificationProvider)
    vi.unstubAllEnvs()
  })

  it('EMAIL_PROVIDER=resend sans clé → MockNotificationProvider (fallback avec warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('EMAIL_PROVIDER', 'resend')
    vi.stubEnv('EMAIL_API_KEY', '')
    const p = createNotificationProvider()
    expect(p).toBeInstanceOf(MockNotificationProvider)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('EMAIL_API_KEY absent'))
    vi.unstubAllEnvs()
    warnSpy.mockRestore()
  })

  it('EMAIL_PROVIDER=resend avec clé → ResendEmailProvider', () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend')
    vi.stubEnv('EMAIL_API_KEY', 're_test_key_for_unit_test')
    const p = createNotificationProvider()
    expect(p).toBeInstanceOf(ResendEmailProvider)
    vi.unstubAllEnvs()
  })

  it('EMAIL_PROVIDER inconnu → MockNotificationProvider (fallback avec warn)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('EMAIL_PROVIDER', 'sendgrid')
    const p = createNotificationProvider()
    expect(p).toBeInstanceOf(MockNotificationProvider)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('inconnu'))
    vi.unstubAllEnvs()
    warnSpy.mockRestore()
  })
})

// ── ResendEmailProvider : isolation des échecs email ─────────────────────────

describe('ResendEmailProvider : la DB est toujours alimentée, l\'email est best-effort', () => {
  it('envoi réussi → notification en DB + log', async () => {
    const sendFn = vi.fn().mockResolvedValue({ data: { id: 'email_123' }, error: null })
    const mockClient = { emails: { send: sendFn } }
    const provider = new ResendEmailProvider(mockClient)

    await provider.send({
      userId,
      event: 'QUIZ_PASSED',
      title: 'Quiz réussi',
      body: 'Bravo !',
      sourceId: `${P}-send-ok`,
    })

    const n = await prisma.notification.findFirst({
      where: { userId, sourceId: `${P}-send-ok` },
    })
    expect(n).not.toBeNull()
    expect(n?.event).toBe('QUIZ_PASSED')
    expect(sendFn).toHaveBeenCalledOnce()
    // L'email est envoyé à l'adresse récupérée depuis la DB
    expect(sendFn.mock.calls[0][0].to).toBe(`${P}@t.com`)
  })

  it('échec d\'envoi email (error dans response) → DB notification créée, aucune exception', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sendFn = vi.fn().mockResolvedValue({ data: null, error: { message: 'Resend API error' } })
    const mockClient = { emails: { send: sendFn } }
    const provider = new ResendEmailProvider(mockClient)

    await expect(
      provider.send({
        userId,
        event: 'CERTIFICATE_AVAILABLE',
        title: 'Certificat disponible',
        body: 'Votre certificat est prêt.',
        sourceId: `${P}-send-fail`,
      }),
    ).resolves.toBeUndefined() // ne rejette pas

    // DB toujours alimentée
    const n = await prisma.notification.findFirst({
      where: { userId, sourceId: `${P}-send-fail` },
    })
    expect(n).not.toBeNull()

    // L'erreur est loggée
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('échec envoi'),
      expect.anything(),
    )
    errorSpy.mockRestore()
  })

  it('exception réseau lors de l\'envoi → DB notification créée, aucune exception propagée', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const sendFn = vi.fn().mockRejectedValue(new Error('Network timeout'))
    const mockClient = { emails: { send: sendFn } }
    const provider = new ResendEmailProvider(mockClient)

    await expect(
      provider.send({
        userId,
        event: 'NEW_COURSE',
        title: 'Nouvelle formation',
        body: 'Une formation est disponible.',
        sourceId: `${P}-send-throw`,
      }),
    ).resolves.toBeUndefined()

    const n = await prisma.notification.findFirst({
      where: { userId, sourceId: `${P}-send-throw` },
    })
    expect(n).not.toBeNull()

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('exception lors de l\'envoi'),
      expect.any(Error),
    )
    errorSpy.mockRestore()
  })

  it('email fourni dans params → utilisé directement (pas de requête DB)', async () => {
    const sendFn = vi.fn().mockResolvedValue({ data: { id: 'email_456' }, error: null })
    const mockClient = { emails: { send: sendFn } }
    const provider = new ResendEmailProvider(mockClient)

    await provider.send({
      userId,
      event: 'PAYMENT_SUCCESS',
      title: 'Paiement confirmé',
      body: 'Votre paiement a été traité.',
      email: 'direct@exemple.com',
      sourceId: `${P}-email-param`,
    })

    expect(sendFn.mock.calls[0][0].to).toBe('direct@exemple.com')
  })

  it('userId inexistant (pas d\'email en DB) → notification non créée (FK), exception attendue', async () => {
    const sendFn = vi.fn().mockResolvedValue({ data: { id: 'x' }, error: null })
    const mockClient = { emails: { send: sendFn } }
    const provider = new ResendEmailProvider(mockClient)

    // FK violation sur userId inexistant — prisma.notification.create() rejette
    await expect(
      provider.send({
        userId: 'user-inexistant-xyz',
        event: 'QUIZ_PASSED',
        title: 'T',
        body: 'B',
        sourceId: `${P}-fk-fail`,
      }),
    ).rejects.toThrow()

    // L'email n'est pas envoyé car l'étape DB échoue avant
    expect(sendFn).not.toHaveBeenCalled()
  })
})

// ── MockNotificationProvider ─────────────────────────────────────────────────

describe('MockNotificationProvider : persist en DB, pas d\'envoi email', () => {
  it('crée la notification en DB', async () => {
    const provider = new MockNotificationProvider()
    await provider.send({
      userId,
      event: 'ACCOUNT_CREATED',
      title: 'Bienvenue',
      body: 'Compte créé.',
      sourceId: `${P}-mock-test`,
    })

    const n = await prisma.notification.findFirst({
      where: { userId, sourceId: `${P}-mock-test` },
    })
    expect(n).not.toBeNull()
    expect(n?.event).toBe('ACCOUNT_CREATED')
  })
})
