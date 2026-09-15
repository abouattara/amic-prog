import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'Amic-Academia', template: '%s | Amic-Academia' },
  description: "Plateforme de formation en ligne pour l'Afrique francophone",
  keywords: ['formation en ligne', 'cours vidéo', 'certification', 'Afrique', 'Burkina Faso'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900">{children}</body>
    </html>
  )
}
