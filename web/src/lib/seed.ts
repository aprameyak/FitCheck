// =============================================================================
// Demo Seeding
// =============================================================================
// Initialize demo data for testing without manual setup: a person photo and
// closet items. This is loaded on first run and can be cleared from settings.

import { readSetting, writeSetting } from "./storage";

const SEED_KEY = "fitcheck.seeded";

/** Create a simple solid-color demo person image as a Blob. */
function createDemoPersonImage(): Blob {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // Light neutral background
  ctx.fillStyle = "#f5f1ed";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Simple head (circle)
  ctx.fillStyle = "#d4a574";
  ctx.beginPath();
  ctx.arc(200, 120, 50, 0, Math.PI * 2);
  ctx.fill();

  // Simple body (rectangle)
  ctx.fillStyle = "#4a90e2";
  ctx.fillRect(140, 180, 120, 150);

  // Simple legs
  ctx.fillStyle = "#2c3e50";
  ctx.fillRect(160, 330, 25, 120);
  ctx.fillRect(215, 330, 25, 120);

  // Simple shoes
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(160, 450, 30, 20);
  ctx.fillRect(215, 450, 30, 20);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else throw new Error("Could not create blob from canvas");
    }, "image/png");
  }) as any;
}

/** Load demo closet data from the bundled JSON. */
async function loadDemoClosetData(): Promise<Array<{ id: string; owner: string; source: string; tags: Record<string, any>; price: string; wears: number; image_ref: string; created_at: string }>> {
  try {
    const response = await fetch("/closet.json");
    if (!response.ok) throw new Error("Failed to load closet.json");
    const data = await response.json();
    return data.garments || [];
  } catch (error) {
    console.warn("[seed] Could not load demo closet data", error);
    return [];
  }
}

/** Initialize demo data on first app load. */
export async function initializeSeedData(): Promise<void> {
  if (readSetting(SEED_KEY, "no") === "yes") {
    return; // Already seeded
  }

  try {
    // Seed person consent and photo
    writeSetting("fitcheck.personConsent", "yes");
    const personImage = await createDemoPersonImage();

    // Store person photo in IndexedDB
    const db = await openDb();
    const store = db.transaction("device", "readwrite").objectStore("device");
    await new Promise<void>((resolve, reject) => {
      const request = store.put(personImage, "person-photo");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Load demo closet (this will be fetched by screens as needed)
    const garments = await loadDemoClosetData();
    if (garments.length > 0) {
      writeSetting("fitcheck.demoClotheLoaded", "yes");
    }

    writeSetting(SEED_KEY, "yes");
    console.log("[seed] Demo data initialized successfully");
  } catch (error) {
    console.warn("[seed] Failed to initialize demo data", error);
  }
}

/** Open IndexedDB. */
async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("fitcheck", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("device");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB failed to open."));
  });
}

/** Clear all seed data. */
export async function clearSeedData(): Promise<void> {
  writeSetting(SEED_KEY, "no");
  writeSetting("fitcheck.personConsent", "no");
  writeSetting("fitcheck.demoClotheLoaded", "no");
  writeSetting("fitcheck.welcomed", "no");
  console.log("[seed] Demo data cleared");
}
