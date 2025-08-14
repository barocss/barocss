import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CSSMA v4 - Real-time CSS Utility Engine',
  description: 'Revolutionary real-time CSS utility engine that generates styles instantly when DOM classes are detected. No build step required.',
  keywords: ['CSS', 'Real-time CSS', 'Runtime CSS', 'CSS Utilities', 'DOM Scanning', 'Arbitrary Values', 'Tailwind Alternative', 'Live CSS Generation'],
  authors: [{ name: 'CSSMA Team' }],
  openGraph: {
    title: 'CSSMA v4 - Real-time CSS Utility Engine',
    description: 'Revolutionary real-time CSS utility engine that generates styles instantly when DOM classes are detected. No build step required.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-white">
          {children}
        </div>
      </body>
    </html>
  )
}
