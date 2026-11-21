import type { Metadata, Viewport } from "next";
import { Anton, Inter, Special_Elite } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/SwRegister";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// máquina de escribir: etiquetas chicas con look de ficha vieja
const elite = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-elite" });

export const metadata: Metadata = {
  title: "SuperKid · alertas de granizo en Mendoza",
  description: "Radar y alertas oficiales de Mendoza resumidas por departamento. No reemplaza las alertas oficiales.",
  appleWebApp: { capable: true, title: "SuperKid", statusBarStyle: "black-translucent" },
};
export const viewport: Viewport = { themeColor: "#170A2B", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${anton.variable} ${inter.variable} ${elite.variable} antialiased`}>
      <body className="min-h-dvh">
        <div className="mx-auto min-h-dvh max-w-[480px] bg-night">{children}</div>
        <SwRegister />
      </body>
    </html>
  );
}
