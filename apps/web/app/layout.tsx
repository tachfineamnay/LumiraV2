import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import { StripeProvider } from "../context/StripeProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Oracle Lumira | Guidance Spirituelle",
  description: "Découvrez votre cartographie vibratoire et votre guidance spirituelle dans un sanctuaire de luxe.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full">
      <body className={`${inter.variable} ${playfair.variable} font-sans h-full bg-void text-divine selection:bg-gold/30 antialiased`}>
        <StripeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </StripeProvider>
      </body>
    </html>
  );
}
