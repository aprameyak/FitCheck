// =============================================================================
// Mock API for Demo Mode
// =============================================================================
// When the backend isn't available, serve demo garments from closet.json
// for testing the UI without running the full ML engine.

import type { Garment } from "./client";

let cachedClosetData: Array<any> | null = null;

/** Load demo closet data from public assets. */
async function loadClosetData(): Promise<Garment[]> {
  if (cachedClosetData) return cachedClosetData;

  try {
    const response = await fetch("/closet.json");
    if (!response.ok) throw new Error("Failed to load closet.json");
    const data = await response.json();
    cachedClosetData = transformGarments(data.garments || []);
    return cachedClosetData;
  } catch (error) {
    console.warn("[mock-api] Could not load closet data", error);
    return [];
  }
}

/** Transform raw closet JSON to Garment format. */
function transformGarments(items: any[]): Garment[] {
  return items.map((item) => ({
    id: item.id,
    owner: item.owner,
    source: (item.source || "closet") as "closet" | "store" | "online",
    tags: item.tags,
    // Use a placeholder image; real seed images would be in /seed/
    image_url: generatePlaceholderImage(item.tags?.color_family || "gray"),
    wears: item.wears || 0,
    price: item.price || undefined,
    created_at: item.created_at,
  }));
}

/** Generate a data URL placeholder image for a color. */
function generatePlaceholderImage(colorFamily: string): string {
  const colorMap: Record<string, string> = {
    navy: "#001f3f",
    black: "#111111",
    white: "#ffffff",
    grey: "#888888",
    gray: "#888888",
    beige: "#f5e6d3",
    blue: "#0074d9",
    brown: "#8b4513",
  };
  const color = colorMap[colorFamily.toLowerCase()] || "#888888";

  const canvas = document.createElement("canvas");
  canvas.width = 200;
  canvas.height = 300;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(colorFamily, canvas.width / 2, canvas.height / 2);
  }
  return canvas.toDataURL("image/png");
}

/** Mock closet endpoint. */
export async function mockCloset(owner: string): Promise<Garment[]> {
  const allGarments = await loadClosetData();
  return allGarments.filter((g) => g.owner === owner);
}

/** Check if backend is available. */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch("/api/health", { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}
