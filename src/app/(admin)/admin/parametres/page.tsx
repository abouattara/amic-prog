export const metadata = { title: 'Paramètres - Admin' }

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
      <p className="mt-2 text-sm text-gray-500">Configuration de la plateforme</p>

      <div className="mt-6 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800">Informations générales</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Setting label="Nom du site" value="Amic-Academia" />
            <Setting label="Langue par défaut" value="Français (fr)" />
            <Setting label="Devise" value="Franc CFA (XOF)" />
            <Setting label="Pays" value="Burkina Faso" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800">Paiement</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Setting label="Fournisseur" value="Mock Provider (dev)" />
            <Setting label="Webhook" value="/api/webhooks/payment" />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-800">Email</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Setting label="Fournisseur" value="Mock Provider (dev)" />
            <Setting label="Expéditeur" value="no-reply@amic-academia.com" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Setting({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-sm text-gray-900">{value}</div>
    </div>
  )
}
