/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    serverActions: {
      // Autorise toutes les origines (nécessaire pour Codespaces/Gitpod/Vercel Preview)
      allowedOrigins: [
        'localhost:3000', 
        '*.app.github.dev', 
        '*.vercel.app',
        'metacarscore.com'
      ],
    },
  },
};

module.exports = nextConfig;