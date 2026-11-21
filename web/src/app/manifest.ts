import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SuperKid · alertas de granizo",
    short_name: "SuperKid",
    description: "Alertas de granizo, tormenta y lluvia para Mendoza.",
    start_url: "/",
    display: "standalone",
    background_color: "#170A2B",
    theme_color: "#170A2B",
    lang: "es-AR",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
