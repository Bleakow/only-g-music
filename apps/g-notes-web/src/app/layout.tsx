import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/features/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "G Notes — Escritor inteligente para compositores",
  description:
    "El cuaderno inteligente para compositores. La IA no reemplaza al artista, la potencia. Parte del ecosistema Only G Music.",
  applicationName: "G Notes",
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0c0a12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
