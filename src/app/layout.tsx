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
  title: "MetaCarScore - L'agrégateur de référence",
  description: "Toutes les critiques automobiles agrégées en un seul score.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      {/* AJOUT DE L'ATTRIBUT ICI 👇 */}
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