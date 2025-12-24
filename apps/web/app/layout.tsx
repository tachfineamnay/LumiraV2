import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { StripeProvider } from "../context/StripeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lumira V2 | Sanctuaire Spirituel",
  description: "Découvrez votre cartographie vibratoire et votre guidance spirituelle.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <body className={`${inter.className} h-full bg-slate-950 text-white selection:bg-indigo-500/30`}>
        <StripeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </StripeProvider>
      </body>
    </html>
  );
}
