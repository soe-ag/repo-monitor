import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Repo Health Monitor',
  description: 'GitHub repository health scanning with Next.js + Convex',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
