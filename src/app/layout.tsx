import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/PwaRegister";
import { LanguageProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mayyat Committee Management App",
  description: "Mobile-first committee fund and member management.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <PwaRegister />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
