/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@azure/msal-node'],
  },
}

module.exports = nextConfig

