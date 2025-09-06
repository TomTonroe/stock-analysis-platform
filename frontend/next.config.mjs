/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  async rewrites() {
    return [
      { source: '/financial/:path*', destination: 'http://localhost:8000/financial/:path*' },
      { source: '/health', destination: 'http://localhost:8000/health' }
    ]
  }
}

export default nextConfig
