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
