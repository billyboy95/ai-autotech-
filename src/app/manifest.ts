import type { MetadataRoute } from "next";
import { aiosWebManifest } from "@/lib/pwa/manifest";

export default function manifest(): MetadataRoute.Manifest {
  return aiosWebManifest();
}
