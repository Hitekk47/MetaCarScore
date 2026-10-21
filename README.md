# MetaCarScore

Toute la presse automobile synthétisée en un score unique.

---

*English follows French*

---

## À propos

MetaCarScore est un agrégateur de critiques automobiles qui transforme les essais de la presse professionnelle en une note unique et cohérente : le **MetaCarScore**. Notre mission est d'offrir une vision objective et synthétique du marché automobile en regroupant les avis d'experts. Depuis Juillet 2019, nous référençons des milliers d'essais pour vous aider à trouver le véhicule idéal.

## Fonctionnalités

- **Recherche Intelligente** : Trouvez rapidement n'importe quelle marque ou modèle.
- **Tops & Classements** : Découvrez les meilleurs véhicules par catégorie (Électrique, Hybride, Essence, Diesel, Break, Découvrable, Manuelle).
- **Mode Duel** : Comparez deux modèles côte à côte pour voir lequel l'emporte selon la presse.
- **Fiches Détaillées** : Accédez à l'historique complet des essais pour chaque modèle, avec les scores normalisés.

## Méthodologie

La transparence est au cœur de notre projet. Nous appliquons des règles strictes pour garantir la fiabilité de nos scores :

- **Sources Certifiées** : Nous ne retenons que la presse automobile professionnelle. Aucun avis utilisateur non vérifié.
- **Normalisation Universelle** : 5 étoiles, 20/20, ou système allemand : chaque notation est convertie mathématiquement en un score sur 100.
- **La Règle de 3** : Pour éviter les biais, le score global d’un véhicule nécessite au moins **3 médias distincts**. Sur les fiches filtrées, un « Score Filtré » peut être affiché dès **3 essais**.
- **Moyenne Pure** : Aucune pondération obscure. Le MetaCarScore est une moyenne arithmétique stricte.

## Stack Technique

Le projet est bâti avec les technologies les plus récentes pour des performances et une réactivité optimales :

- **Framework** : [Next.js 16](https://nextjs.org/)
- **Bibliothèque UI** : [React 19](https://react.dev/)
- **Styles** : [Tailwind CSS 3](https://tailwindcss.com/)
- **Base de données & Backend** : [Supabase](https://supabase.com/)
- **Tests** : [Bun](https://bun.sh/)

## Développement & Vision

Le développement est assisté par des agents IA, notamment Jules et Codex, sous la responsabilité du mainteneur humain. Le guide commun et les références de contexte sont dans [AGENTS.md](AGENTS.md).

Toute la base de données et le développement du site sont l'œuvre de **Hitekk47**.

## Installation

Configurer localement les variables publiques `NEXT_PUBLIC_SUPABASE_URL` et
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, sans versionner leurs valeurs. Puis :

```bash
npm ci
npm run dev
```

---

# MetaCarScore (English)

All automotive press reviews synthesized into a single score.

## About

MetaCarScore is an automotive review aggregator that transforms professional press tests into a single, consistent rating: the **MetaCarScore**. Our mission is to provide an objective and synthetic view of the automotive market by gathering expert opinions. Since July 2019, we have indexed thousands of reviews to help you find the perfect vehicle.

## Features

- **Smart Search**: Quickly find any brand or model.
- **Tops & Rankings**: Discover the best vehicles by category (Electric, Hybrid, Petrol, Diesel, Estate, Convertible, Manual).
- **Duel Mode**: Compare two models side-by-side to see which one wins according to the press.
- **Detailed Pages**: Access the full review history for each model, with normalized scores.

## Methodology

Transparency is at the heart of our project. We apply strict rules to ensure the reliability of our scores:

- **Certified Sources**: We only include professional automotive press reviews. No unverified user reviews.
- **Universal Normalization**: 5 stars, 20/20, or German system: each rating is mathematically converted into a score out of 100.
- **The Rule of 3**: To avoid bias, a vehicle’s global score requires at least **3 distinct media sources**. On filtered vehicle pages, a “Filtered Score” may be displayed from **3 reviews**.
- **Pure Average**: No obscure weighting. The MetaCarScore is a strict arithmetic mean.

## Tech Stack

The project is built with the latest technologies for optimal performance and responsiveness:

- **Framework**: [Next.js 16](https://nextjs.org/)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS 3](https://tailwindcss.com/)
- **Database & Backend**: [Supabase](https://supabase.com/)
- **Tests**: [Bun](https://bun.sh/)

## Development & Vision

Development is assisted by AI agents, including Jules and Codex, under the human maintainer’s responsibility. The shared guide and context references are in [AGENTS.md](AGENTS.md).

The entire database and website development are the work of **Hitekk47**.

## Installation

Configure the public `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
variables locally, without committing their values. Then:

```bash
npm ci
npm run dev
```
