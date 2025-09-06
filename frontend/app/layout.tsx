import './globals.css'
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { ReactQueryProvider } from '../components/providers'

export const metadata: Metadata = {
  title: 'stock-analysis-platform',
  description: 'Live market charts, AI forecasts, and company insights',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="en">
      <body>
        <ReactQueryProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {children}
          </ThemeProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
