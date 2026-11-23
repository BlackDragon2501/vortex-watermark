import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vórtex Watermark - Marca de agua en lotes, sin límites",
  description: "Vórtex Watermark, de Vortex Company: aplica tu logo o texto como marca de agua a lotes de imágenes y PDFs, con posición, opacidad, rotación, mosaico y descarga en ZIP. Gratis, sin anuncios y 100% local.",
  keywords: ["Vórtex Watermark", "marca de agua", "watermark online", "logo sobre fotos", "marca de agua PDF", "proceso por lotes", "sin anuncios"],
  authors: [{ name: "Vortex Company" }],
  icons: {
    icon:
      "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#161616"/><circle cx="24" cy="24" r="17" fill="none" stroke="#e879f9" stroke-width="3.5"/><path d="M24 10a14 14 0 1 1-9.9 4.1" fill="none" stroke="#f0abfc" stroke-width="3.5" stroke-linecap="round"/><path d="M24 17a7 7 0 1 0 7 7" fill="none" stroke="#f0abfc" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="24" r="3" fill="#f0abfc"/></svg>`
      ),
  },
  openGraph: {
    title: "Vórtex Watermark - Marca de agua en lotes, sin límites",
    description: "Vórtex Watermark, de Vortex Company: aplica tu logo o texto como marca de agua a lotes de imágenes y PDFs, con posición, opacidad, rotación, mosaico y descarga en ZIP. Gratis, sin anuncios y 100% local.",
    siteName: "Vórtex Watermark - Marca de agua en lotes, sin límites",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f0f10",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="antialiased bg-[#0f0f10] text-[#ececf1]">{children}</body>
    </html>
  );
}
