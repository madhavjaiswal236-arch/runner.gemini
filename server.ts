import express from "express";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

interface CodeEntry {
  code: string;
  durationMinutes: number;
  status: "unused" | "active" | "used";
  activatedAt: number | null;
  expiresAt: number | null;
  sessionToken: string | null;
}

const DB_FILE = path.join(process.cwd(), "codes-db.json");

// Default initial codes list for the owner to test immediately
const DEFAULT_CODES: CodeEntry[] = [
  // 10-Minute Passes (Bronze - 300 XP)
  { code: "XM10-K8P9-W3F4-X2TL", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-B5M7-N2Y6-P9QR", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-T1V4-L9X8-K3HW", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-F6D5-J2S1-C7ZP", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-G9R4-M5W3-A8VK", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-U7B6-H9D4-S1FX", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-Q3K8-Y2X7-P5LN", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-A9V2-F3W7-T8KM", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-J6D5-S4H1-C9ZQ", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-N3P8-M2L4-Y5X7", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-Z1V9-K2R8-W7TH", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-E5S4-B9D6-P3FJ", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-H8W7-F9X2-C1LK", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-D3R6-V9K2-S8QG", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-G5P8-Y1M4-N9ZT", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-A1B2-C3D4-E5F6", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-F7G8-H9J1-K2L3", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-M4N5-P6Q7-R8S9", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-T1U2-V3W4-X5Y6", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-Z7A8-B9C1-D2E3", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-H4D9-S2J8-K1W5", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-Y7N2-Q8K5-M3P9", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-W1T4-V8X9-Z2L5", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-A6B5-D3C7-F9E8", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-G1R9-H2S8-K3T7", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-J5M4-L6N3-P7Q2", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-R1S9-T2U8-V3W7", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-X5Y4-Z6A3-B7C2", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-D9E8-F1D7-G2H6", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-J4K3-L5M2-N6P1", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-Q9R8-S1T7-U2V6", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-W5X4-Y6Z3-A7B2", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-C9D8-E1F7-G2H6", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-J1K9-L2M8-N3P7", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-Q5R4-S6T3-U7V2", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-W1X9-Y2Z8-A3B7", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-C5D4-E6F3-G7H2", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-J9K8-L1M7-N2P6", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-Q1R9-S2T8-U3V7", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-W5X4-Y3Z7-A9B1", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-C2D9-E3F8-G4H7", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-J5K1-L6M2-N7P3", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-Q4R9-S5T1-U6V2", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-W7X3-Y8Z2-A9B4", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM10-C1D5-E2F6-G3H7", durationMinutes: 10, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  
  // 20-Minute Passes (Silver - 600 XP)
  { code: "XM20-H7N3-X9L2-K5WP", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-C4F8-P2T7-S9RQ", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-V1B6-Y9M3-K4WZ", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-D9S5-F2H8-C1LQ", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-G3W7-K9Y2-T5LP", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-A8V4-B6S1-P9ZN", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-J3D7-H9K2-M5FX", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-N1Q8-Y2T4-F7WR", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-Z5P9-W3C4-X8LK", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-E6T7-V9S2-K1HQ", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-M8L4-N3P7-G2Y5", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-R9X2-F8W6-T1KZ", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-K5H3-B9D4-P2SJ", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-W7V1-Y2M6-L8NQ", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-S3C8-K9D2-F1XP", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-A2B3-C4D5-E6F7", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-F8G9-H1J2-K3L4", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-M5N6-P7Q8-R9S1", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-T2U3-V4W5-X6Y7", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-Z8A9-B1C2-D3E4", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-H5D1-S3J9-K2W6", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-Y8N3-Q9K6-M4P1", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-W2T5-V9X1-Z3L6", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-A7B6-D4C8-F1E9", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-G2R1-H3S9-K4T8", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-J6M5-L7N4-P8Q3", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-R2S1-T3U9-V4W8", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-X6Y5-Z7A4-B8C3", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-D1E9-F2D8-G3H7", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-J5K4-L6M3-N7P2", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-Q1R9-S2T8-U3V7", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-W6X5-Y7Z4-A8B3", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-C1D9-E2F8-G3H7", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-J2K1-L3M9-N4P8", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-Q6R5-S7T4-U8V3", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-W2X1-Y3Z9-A4B8", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-C6D5-E7F4-G8H3", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-J1K9-L2M8-N3P7", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-Q2R1-S3T9-U4V8", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-W6X5-Y4Z8-A1B2", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-C3D1-E4F9-G5H8", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-J6K2-L7M3-N8P4", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-Q5R1-S6T2-U7V3", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-W8X4-Y9Z3-A1B5", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM20-C2D6-E3F7-G4H8", durationMinutes: 20, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  
  // 30-Minute Passes (Gold - 900 XP)
  { code: "XM30-Z9Q4-M3L1-K7P8", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-U2D5-W8B6-Y3V4", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-A8F1-N6M9-D3R5", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-V7G3-X9P2-S4LK", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-C1W8-Y2N5-H9TQ", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-K5S4-F9D6-P1RZ", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-J3B8-M2L9-Y4X5", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-T9V2-K8R1-W3FH", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-E5H6-B9D4-P7SJ", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-G8W7-F9X2-C1LQ", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-D3S6-V9K2-S8XG", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-N9P8-M2L4-Y5ZT", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-R7K3-F9X2-V8WL", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-S1B6-Y9M3-K4WZ", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-H4F8-P2T7-S9RQ", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-A3B4-C5D6-E7F8", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-F9G1-H2J3-K4L5", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-M6N7-P8Q9-R1S2", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-T3U4-V5W6-X7Y8", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-Z9A1-B2C3-D4E5", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-H6D2-S4J1-K3W7", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-Y9N4-Q1K7-M5P2", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-W3T6-V1X2-Z4L7", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-A8B7-D5C9-F2E1", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-G3R2-H4S1-K5T9", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-J7M6-L8N5-P9Q4", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-R3S2-T4U1-V5W9", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-X7Y6-Z8A5-B9C4", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-D2E1-F3D9-G4H8", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-J6K5-L7M4-N8P3", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-Q2R1-S3T9-U4V8", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-W7X6-Y8Z5-A9B4", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-C2D1-E3F9-G4H8", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-J3K2-L4M1-N5P9", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-Q7R6-S8T5-U9V4", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-W3X2-Y4Z1-A5B9", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-C7D6-E8F5-G9H4", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-J2K1-L3M9-N4P8", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-Q3R2-S4T1-U5V9", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-W7X6-Y5Z9-A2B3", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-C4D2-E5F1-G6H9", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-J7K3-L8M4-N9P5", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-Q6R2-S7T3-U8V4", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-W9X5-Y1Z4-A2B6", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
  { code: "XM30-C3D7-E4F8-G5H9", durationMinutes: 30, status: "unused", activatedAt: null, expiresAt: null, sessionToken: null },
];

let databaseCache: CodeEntry[] = [];

// Helper to load codes
async function loadDatabase() {
  let loadedFromDisk = false;
  try {
    const data = await fs.readFile(DB_FILE, "utf-8");
    databaseCache = JSON.parse(data);
    loadedFromDisk = true;
  } catch (err) {
    // If file doesn't exist, seed it with default codes
    databaseCache = [...DEFAULT_CODES];
    await saveDatabase();
  }

  if (loadedFromDisk) {
    // Purge mock codes from old runs if they exist
    const cleanCache = databaseCache.filter((item) => !item.code.startsWith("PLAY-"));

    // Add any missing default codes
    for (const defItem of DEFAULT_CODES) {
      if (!cleanCache.some((x) => x.code === defItem.code)) {
        cleanCache.push({ ...defItem });
      }
    }
    databaseCache = cleanCache;
    await saveDatabase();
  }
}

// Helper to save codes
async function saveDatabase() {
  try {
    await fs.writeFile(DB_FILE, JSON.stringify(databaseCache, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save codes database:", err);
  }
}

// Background cleanup worker to continuously verify and dispose of expired sessions
function runExpiredSessionsCleanup() {
  setInterval(async () => {
    let modified = false;
    const now = Date.now();
    for (const item of databaseCache) {
      if (item.status === "active" && item.expiresAt && now >= item.expiresAt) {
        console.log(`[CLEANUP] Disposing and banning code due to time expiration: ${item.code}`);
        item.status = "used";
        item.sessionToken = null;
        modified = true;
      }
    }
    if (modified) {
      await saveDatabase();
    }
  }, 3000); // Check every 3 seconds
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Load the initial DB
  await loadDatabase();
  runExpiredSessionsCleanup();

  // API Endpoints
  
  // Validate and activate a play code
  app.post("/api/validate-code", async (req, res) => {
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      res.status(400).json({ error: "Access code is required" });
      return;
    }

    const trimmedCode = code.trim().toUpperCase();
    const entryIndex = databaseCache.findIndex((x) => x.code.toUpperCase() === trimmedCode);

    if (entryIndex === -1) {
      res.status(400).json({ error: "Invalid access code. Please check and try again." });
      return;
    }

    const entry = databaseCache[entryIndex];

    if (entry.status === "used") {
      res.status(403).json({ error: "This code is expired, fully disposed, and permanently banned from reuse." });
      return;
    }

    if (entry.status === "active") {
      // If code is already active, check if it's expired
      const now = Date.now();
      if (entry.expiresAt && now >= entry.expiresAt) {
        entry.status = "used";
        entry.sessionToken = null;
        await saveDatabase();
        res.status(403).json({ error: "This code is expired, fully disposed, and permanently banned from reuse." });
        return;
      }

      // If active and has a session token, return existing session to allow reconnection/resume
      res.json({
        success: true,
        sessionToken: entry.sessionToken,
        durationMinutes: entry.durationMinutes,
        expiresAt: entry.expiresAt,
        message: "Resuming existing active session."
      });
      return;
    }

    // Activate the code (status: unused -> active)
    const sessionToken = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + entry.durationMinutes * 60 * 1000;

    entry.status = "active";
    entry.activatedAt = now;
    entry.expiresAt = expiresAt;
    entry.sessionToken = sessionToken;

    await saveDatabase();

    res.json({
      success: true,
      sessionToken,
      durationMinutes: entry.durationMinutes,
      expiresAt,
      message: "Access code successfully activated."
    });
  });

  // Verify dynamic session status and track remaining time
  app.post("/api/session-status", async (req, res) => {
    const { sessionToken } = req.body;
    if (!sessionToken || typeof sessionToken !== "string") {
      res.status(400).json({ status: "invalid", error: "Session token is required" });
      return;
    }

    const entry = databaseCache.find((x) => x.sessionToken === sessionToken);

    if (!entry) {
      res.json({ status: "invalid", error: "Session not found or already terminated." });
      return;
    }

    const now = Date.now();
    if (entry.expiresAt && now >= entry.expiresAt) {
      // Expire and dispose code permanently
      entry.status = "used";
      entry.sessionToken = null;
      await saveDatabase();
      res.json({ status: "expired", message: "Time has run out. Code permanently disposed." });
      return;
    }

    const remainingMs = entry.expiresAt ? entry.expiresAt - now : 0;
    res.json({
      status: "active",
      remainingMs,
      durationMinutes: entry.durationMinutes,
      expiresAt: entry.expiresAt
    });
  });

  // Void and permanently ban a session code voluntarily
  app.post("/api/void-session", async (req, res) => {
    const { sessionToken } = req.body;
    if (!sessionToken || typeof sessionToken !== "string") {
      res.status(400).json({ error: "Session token is required" });
      return;
    }

    const entry = databaseCache.find((x) => x.sessionToken === sessionToken);
    if (!entry) {
      res.status(404).json({ error: "Active session not found or already voided." });
      return;
    }

    // Mark as used, clear token, save database so it cannot be reused ever again
    entry.status = "used";
    entry.sessionToken = null;
    await saveDatabase();

    res.json({ success: true, message: "Session voluntarily terminated. Access key permanently voided and banned." });
  });

  // Admin: Get status of all codes
  app.get("/api/admin/status", (req, res) => {
    res.json({
      codes: databaseCache,
      summary: {
        total: databaseCache.length,
        unused: databaseCache.filter((c) => c.status === "unused").length,
        active: databaseCache.filter((c) => c.status === "active").length,
        used: databaseCache.filter((c) => c.status === "used").length,
      }
    });
  });

  // Admin: Bulk add codes
  app.post("/api/admin/add", async (req, res) => {
    const { codesList, durationMinutes } = req.body;

    if (!codesList || !Array.isArray(codesList) || !durationMinutes) {
      res.status(400).json({ error: "codesList (array of strings) and durationMinutes are required." });
      return;
    }

    const duration = parseInt(durationMinutes, 10);
    if (isNaN(duration) || ![10, 20, 30].includes(duration)) {
      res.status(400).json({ error: "Duration must be exactly 10, 20, or 30 minutes." });
      return;
    }

    const newEntries: CodeEntry[] = [];
    const duplicates: string[] = [];

    for (const codeStr of codesList) {
      if (typeof codeStr !== "string") continue;
      const cleanCode = codeStr.trim().toUpperCase();
      if (!cleanCode) continue;

      // Check if code already exists
      const exists = databaseCache.some((x) => x.code.toUpperCase() === cleanCode);
      if (exists) {
        duplicates.push(cleanCode);
        continue;
      }

      newEntries.push({
        code: cleanCode,
        durationMinutes: duration,
        status: "unused",
        activatedAt: null,
        expiresAt: null,
        sessionToken: null,
      });
    }

    if (newEntries.length > 0) {
      databaseCache.push(...newEntries);
      await saveDatabase();
    }

    res.json({
      success: true,
      addedCount: newEntries.length,
      duplicates,
      message: `Successfully added ${newEntries.length} new ${duration} minutes codes.`
    });
  });

  // Admin: Delete a specific code
  app.post("/api/admin/delete", async (req, res) => {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: "Code is required" });
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const index = databaseCache.findIndex((x) => x.code.toUpperCase() === cleanCode);

    if (index === -1) {
      res.status(404).json({ error: "Code not found" });
      return;
    }

    databaseCache.splice(index, 1);
    await saveDatabase();
    res.json({ success: true, message: `Code ${cleanCode} has been deleted.` });
  });

  // Admin: Reset entire database back to default seed codes
  app.post("/api/admin/reset-db", async (req, res) => {
    databaseCache = [...DEFAULT_CODES];
    await saveDatabase();
    res.json({ success: true, message: "Database has been reset to initial seed codes." });
  });

  // Vite Integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Full-stack runner server active at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server startup failure:", err);
});
