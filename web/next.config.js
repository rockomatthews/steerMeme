/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'ipfs.io', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: 'cloudflare-ipfs.com', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: 'nftstorage.link', pathname: '/ipfs/**' },
      { protocol: 'https', hostname: '**.infura-ipfs.io', pathname: '/ipfs/**' }
    ]
  }
}

module.exports = nextConfig


