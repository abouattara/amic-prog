export const metadata = { title: 'Paramètres - Admin' }

/**
 * Résout le provider email réellement utilisé au runtime.
 * Reproduit la logique de repli de `createNotificationProvider()` afin que la page
 * n'affiche pas un provider configuré qui, faute de credentials, retombe sur mock.
 */
function resolveEmailProvider(): { effective: string; fallbackFrom?: string } {
  const configured = process.env.EMAIL_PROVIDER || 'mock'

  if (configured === 'smtp') {
    const hasCredentials = Boolean(process.env.EMAIL_SMTP_USER && process.env.EMAIL_SMTP_PASS)
    return hasCredentials ? { effective: 'smtp' } : { effective: 'mock', fallbackFrom: 'smtp' }
  }

  if (configured === 'resend') {
    return process.env.EMAIL_API_KEY
      ? { effective: 'resend' }
      : { effective: 'mock', fallbackFrom: 'resend' }
  }

  return configured === 'mock'
    ? { effective: 'mock' }
    : { effective: 'mock', fallbackFrom: configured }
}

const EMAIL_PROVIDER_LABELS: Record<string, string> = {
  mock: 'Mock Provider (dev)',
  smtp: 'SMTP',
  resend: 'Resend',
}

export default function AdminSettingsPage() {
  const email = resolveEmailProvider()
  const emailLabel = EMAIL_PROVIDER_LABELS[email.effective] ?? email.effective
  const paymentProvider = process.env.PAYMENT_PROVIDER ?? 'mock'
  const paymentLabel = paymentProvider === 'mock' ? 'Mock Provider (dev)' : paymentProvider

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
      <p className="mt-2 text-sm text-gray-500">Configuration de la plateforme</p>

      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800">Informations générales</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Setting label="Nom du site" value={process.env.APP_NAME || 'Amic-Academia'} />
            <Setting label="URL publique" value={process.env.APP_URL || 'non configurée'} />
            <Setting label="Langue par défaut" value="Français (fr)" />
            <Setting label="Devise" value="Franc CFA (XOF)" />
            <Setting label="Pays" value="Burkina Faso" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800">Paiement</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Setting label="Fournisseur" value={paymentLabel} />
            <Setting label="Webhook" value="/api/webhooks/payment" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800">Email</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Setting
              label="Fournisseur"
              value={emailLabel}
              hint={
                email.fallbackFrom &&
                `EMAIL_PROVIDER="${email.fallbackFrom}" est configuré mais ses identifiants sont absents — repli sur mock, aucun email réel n'est envoyé.`
              }
            />
            <Setting
              label="Expéditeur"
              value={process.env.EMAIL_FROM || 'non configuré'}
            />
            {email.effective === 'smtp' && (
              <Setting
                label="Serveur SMTP"
                value={`${process.env.EMAIL_SMTP_HOST ?? 'smtp.gmail.com'}:${process.env.EMAIL_SMTP_PORT ?? '587'}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Setting({ label, value, hint }: { label: string; value: string; hint?: string | false }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-sm text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-amber-600">{hint}</div>}
    </div>
  )
}
