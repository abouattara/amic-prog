import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <Link href="/" className="mb-8 flex items-center gap-2 font-bold text-blue-600 text-lg">
        <BookOpen className="h-6 w-6" />
        Amic-Academia
      </Link>
      {children}
    </div>
  )
}
