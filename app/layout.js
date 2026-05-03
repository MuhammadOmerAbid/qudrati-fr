import '@/styles/global.css'

export const metadata = {
  title: 'Qudarti Foods',
  description: 'Qudarti Foods Industrial Management System',
  icons: { icon: '/qudartinew.png' },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", margin: 0, minHeight: '100vh' }}>
        {children}
      </body>
    </html>
  )
}
