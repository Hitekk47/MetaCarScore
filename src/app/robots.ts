import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://metacarscore.com'; // Remplace par ton domaine réel

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',       // Pas d'indexation des routes API
        '/duels?',     // On bloque les duels avec paramètres (contenu dupliqué infini)
        '/*?*',        // Optionnel: Bloque TOUTES les urls avec query params (ex: ?minPower=200) pour forcer l'indexation des pages canoniques
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}