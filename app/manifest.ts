import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Meteorn Hub',
    short_name: 'MeteornHub',
    description: 'A comprehensive game management and ticket tracking system.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/meteorn-hub-logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/meteorn-hub-logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
