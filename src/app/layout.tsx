import type { Metadata } from "next";
import { DM_Sans } from "next/font/google"; // On reprend la font du POC
import "./globals.css";
import { cn } from "@/lib/utils"; // Utilitaire pour fusionner les classes proprement

// Configuration de la police
const dmSans = DM_Sans({ 
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"], // On charge les graisses nécessaires
  variable: "--font-dm-sans",
});
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
  ? new URL(process.env.NEXT_PUBLIC_SITE_URL) 
  : new URL('http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: baseUrl,
  title: {
    template: '%s | MetaCarScore', 
    default: "MetaCarScore : L'Agrégateur de Critiques Automobiles (Notes & Avis)",
  },
  openGraph: {
    title: "MetaCarScore : L'Agrégateur de Critiques Automobiles",
    description: "Un seul score pour chaque voiture. MetaCarScore agrège les notes de toute la presse automobile mondiale.",
    url: baseUrl,
    siteName: 'MetaCarScore',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        url: '/share-card.png',
        width: 1200,
        height: 630,
        alt: 'MetaCarScore - Agrégateur de Critiques Automobiles',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "MetaCarScore : L'Agrégateur de Critiques Automobiles",
    description: "Un seul score pour chaque voiture. MetaCarScore agrège les notes de toute la presse automobile mondiale.",
    images: ['/share-card.png'], 
  },  
  description: "Un seul score pour chaque voiture. MetaCarScore agrège les notes de toute la presse automobile mondiale (20 000+ essais) pour vous donner le verdict final sur chaque modèle.",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: "MetaCarScore",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/apple-icon.png' }, // Pour iOS
    ],
  },  
  };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body 
        className={cn(
          "min-h-screen bg-[#f8fafc] font-sans antialiased",
          dmSans.variable
        )}
        suppressHydrationWarning={true}
      >
        {children}
      </body>
    </html>
  );
}
