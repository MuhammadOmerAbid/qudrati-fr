/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    qualities: [75, 100],
  },
  async redirects() {
    return [
      {
        source: '/accounts/general-ledger/new',
        destination: '/accounts/general-ledger/create',
        permanent: false,
      },
    ]
  },
 
}

module.exports = nextConfig
