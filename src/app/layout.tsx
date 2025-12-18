import './globals.css'
import type { Metadata } from 'next'
import Header from '@/components/Header'

export const metadata: Metadata = {
  title: 'Absensi Sinergi',
  description: 'Sistem absensi berbasis QR untuk event',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/SINERGI LOGO - MASTER.png' },
    ],
    shortcut: '/favicon.svg',
    apple: '/SINERGI LOGO - MASTER.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="bg-gray-50 text-gray-900">
        <Header />
        <main className="container py-6">
          {children}
        </main>
        <footer className="border-t text-sm text-gray-500">
          <div className="container py-4">© {new Date().getFullYear()} Absensi Sinergi</div>
        </footer>
      </body>
    </html>
  )
}
