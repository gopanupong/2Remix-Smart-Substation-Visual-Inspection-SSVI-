import express from "express";
import multer from "multer";
import { Pool } from "pg";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Use memoryStorage so files are never written to Vercel's disk
const upload = multer({ storage: multer.memoryStorage() });

// Database Pool (Lazy initialization to prevent crash on Vercel if URL is missing)
let dbPool: Pool | null = null;

function getDbPool() {
  if (dbPool) return dbPool;
  if (!process.env.DATABASE_URL) return null;
  try {
    dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    return dbPool;
  } catch (err) {
    console.error("Failed to create DB pool:", err);
    return null;
  }
}

async function initDb() {
  const pool = getDbPool();
  if (!pool) {
    console.warn("DATABASE_URL not found. Database features will be disabled.");
    return;
  }
  try {
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS substations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inspection_logs (
        id SERIAL PRIMARY KEY,
        employee_id TEXT NOT NULL,
        substation_name TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        gps_lat DOUBLE PRECISION,
        gps_lng DOUBLE PRECISION,
        image_urls TEXT[],
        status TEXT DEFAULT 'completed',
        categories TEXT
      );
    `);

    // Seed substations if empty
    const checkSub = await pool.query("SELECT COUNT(*) FROM substations");
    if (parseInt(checkSub.rows[0].count) === 0) {
      console.log("Seeding substations data...");
      const SUBSTATIONS = [
        { id: "tha-sai-1", name: "สถานีไฟฟ้าท่าทราย 1 (จุดจ่ายไฟชั่วคราว)", lat: 13.565, lng: 100.275 },
        { id: "bang-pla", name: "สถานีไฟฟ้าบางปลา", lat: 13.525, lng: 100.245 },
        { id: "samut-sakhon-2", name: "สถานีไฟฟ้าสมุทรสาคร 2", lat: 13.545, lng: 100.265 },
        { id: "tha-sai-2", name: "สถานีไฟฟ้าท่าทราย 2 (ชั่วคราว)", lat: 13.568, lng: 100.278 },
        { id: "samut-sakhon-16", name: "สถานีไฟฟ้าสมุทรสาคร 16", lat: 13.585, lng: 100.295 },
        { id: "samut-sakhon-16-temp", name: "สถานีไฟฟ้าสมุทรสาคร 16 (ชั่วคราว)", lat: 13.588, lng: 100.298 },
        { id: "krathum-baen-2", name: "สถานีไฟฟ้ากระทุ่มแบน 2", lat: 13.655, lng: 100.265 },
        { id: "krathum-baen-1", name: "สถานีไฟฟ้ากระทุ่มแบน 1", lat: 13.645, lng: 100.275 },
        { id: "samut-sakhon-10", name: "สถานีไฟฟ้าสมุทรสาคร 10", lat: 13.555, lng: 100.285 },
        { id: "krathum-baen-6", name: "สถานีไฟฟ้ากระทุ่มแบน 6", lat: 13.665, lng: 100.255 },
        { id: "krathum-baen-6-temp", name: "สถานีไฟฟ้ากระทุ่มแบน 6 (ชั่วคราว)", lat: 13.668, lng: 100.258 },
        { id: "samut-sakhon-10-temp", name: "สถานีไฟฟ้าสมุทรสาคร 10 (ชั่วคราว)", lat: 13.558, lng: 100.288 },
        { id: "samut-sakhon-7", name: "สถานีไฟฟ้าสมุทรสาคร 7", lat: 13.535, lng: 100.255 },
        { id: "samut-sakhon-1", name: "สถานีไฟฟ้าสมุทรสาคร 1", lat: 13.548, lng: 100.272 },
        { id: "samut-sakhon-9", name: "สถานีไฟฟ้าสมุทรสาคร 9", lat: 13.562, lng: 100.282 },
        { id: "samut-sakhon-12-temp", name: "สถานีไฟฟ้าสมุทรสาคร 12 (ชั่วคราว)", lat: 13.572, lng: 100.292 },
        { id: "samut-sakhon-17-temp", name: "สถานีไฟฟ้าสมุทรสาคร 17 (ชั่วคราว)", lat: 13.56442, lng: 100.260875 },
        { id: "samut-sakhon-3", name: "สถานีไฟฟ้าสมุทรสาคร 3", lat: 13.552, lng: 100.262 },
        { id: "sala-ya", name: "สถานีไฟฟ้าศาลายา", lat: 13.795, lng: 100.325 },
        { id: "phutthamonthon-2", name: "สถานีไฟฟ้าพุทธมณฑล 2", lat: 13.785, lng: 100.315 },
        { id: "phutthamonthon-3", name: "สถานีไฟฟ้าพุทธมณฑล 3", lat: 13.775, lng: 100.305 },
        { id: "u-thong-1", name: "สถานีไฟฟ้าอู่ทอง 1", lat: 14.375, lng: 99.895 },
        { id: "song-phi-nong-1", name: "สถานีไฟฟ้าสองพี่น้อง 1", lat: 14.225, lng: 100.045 },
        { id: "song-phi-nong-2", name: "สถานีไฟฟ้าสองพี่น้อง 2", lat: 14.235, lng: 100.055 },
        { id: "u-thong-2-temp", name: "สถานีไฟฟ้าอู่ทอง 2 (ชั่วคราว)", lat: 14.385, lng: 99.905 },
        { id: "suphan-buri-1", name: "สถานีไฟฟ้าสุพรรณบุรี 1", lat: 14.475, lng: 100.122 },
        { id: "bang-pla-ma", name: "สถานีไฟฟ้าบางปลาม้า", lat: 14.415, lng: 100.145 },
        { id: "suphan-buri-2", name: "สถานีไฟฟ้าสุพรรณบุรี 2", lat: 14.455, lng: 100.105 },
        { id: "dan-chang", name: "สถานีไฟฟ้าด่านช้าง", lat: 14.838, lng: 99.695 },
        { id: "lao-khwan", name: "สถานีไฟฟ้าเลาขวัญ", lat: 14.595, lng: 99.775 },
        { id: "doem-bang", name: "สถานีไฟฟ้าเดิมบางนางบวช", lat: 14.855, lng: 100.045 },
        { id: "bang-len-1", name: "สถานีไฟฟ้าบางเลน 1", lat: 14.025, lng: 100.165 },
        { id: "don-tum", name: "สถานีไฟฟ้าดอนตูม", lat: 13.955, lng: 100.085 },
        { id: "kamphaeng-saen", name: "สถานีไฟฟ้ากำแพงแสน", lat: 14.005, lng: 99.995 },
        { id: "bang-len-3-temp", name: "สถานีไฟฟ้าบางเลน 3 (ชั่วคราว)", lat: 14.035, lng: 100.175 },
        { id: "nakhon-chai-si-1", name: "สถานีไฟฟ้านครชัยศรี 1", lat: 13.805, lng: 100.185 },
        { id: "nakhon-chai-si-2", name: "สถานีไฟฟ้านครชัยศรี 2", lat: 13.815, lng: 100.195 },
        { id: "sam-phran-3", name: "สถานีไฟฟ้าสามพราน 3", lat: 13.725, lng: 100.215 },
        { id: "don-chedi", name: "สถานีไฟฟ้าดอนเจดีย์", lat: 14.635, lng: 99.915 },
        { id: "sam-chuk", name: "สถานีไฟฟ้าสามชุก", lat: 14.755, lng: 100.095 },
        { id: "si-prachan-temp", name: "สถานีไฟฟ้าศรีประจันต์ (ชั่วคราว)", lat: 14.625, lng: 100.142 },
        { id: "samut-sakhon-5", name: "สถานีไฟฟ้าสมุทรสาคร 5", lat: 13.525, lng: 100.235 },
        { id: "ban-phaeo", name: "สถานีไฟฟ้าบ้านแพ้ว", lat: 13.585, lng: 100.105 },
        { id: "ban-phaeo-2", name: "สถานีไฟฟ้าบ้านแพ้ว 2", lat: 13.595, lng: 100.115 },
        { id: "samut-sakhon-4", name: "สถานีไฟฟ้าสมุทรสาคร 4", lat: 13.515, lng: 100.225 },
        { id: "samut-sakhon-11", name: "สถานีไฟฟ้าสมุทรสาคร 11", lat: 13.575, lng: 100.285 },
        { id: "samut-sakhon-15", name: "สถานีไฟฟ้าสมุทรสาคร 15", lat: 13.595, lng: 100.305 },
        { id: "ekkachai-2", name: "สถานีไฟฟ้าเอกชัย 2", lat: 13.585, lng: 100.325 },
        { id: "ekkachai-1", name: "สถานีไฟฟ้าเอกชัย 1", lat: 13.575, lng: 100.315 },
        { id: "sin-sakhon", name: "สถานีไฟฟ้าสินสาคร", lat: 13.545, lng: 100.345 },
        { id: "samut-sakhon-6", name: "สถานีไฟฟ้าสมุทรสาคร 6", lat: 13.535, lng: 100.245 },
        { id: "samut-sakhon-8-temp", name: "สถานีไฟฟ้าสมุทรสาคร 8 (ชั่วคราว)", lat: 13.555, lng: 100.265 },
        { id: "om-noi-2", name: "สถานีไฟฟ้าอ้อมน้อย 2", lat: 13.705, lng: 100.315 },
        { id: "krathum-baen-4", name: "สถานีไฟฟ้ากระทุ่มแบน 4", lat: 13.675, lng: 100.275 },
        { id: "krathum-baen-5", name: "สถานีไฟฟ้ากระทุ่มแบน 5", lat: 13.685, lng: 100.285 },
        { id: "om-noi-5", name: "สถานีไฟฟ้าอ้อมน้อย 5", lat: 13.715, lng: 100.325 },
        { id: "sam-phran-1", name: "สถานีไฟฟ้าสามพราน 1", lat: 13.705, lng: 100.225 },
        { id: "om-noi-4", name: "สถานีไฟฟ้าอ้อมน้อย 4", lat: 13.725, lng: 100.335 },
        { id: "om-yai-2", name: "สถานีไฟฟ้าอ้อมใหญ่ 2", lat: 13.715, lng: 100.285 },
        { id: "om-noi-1", name: "สถานีไฟฟ้าอ้อมน้อย 1", lat: 13.695, lng: 100.305 },
        { id: "om-noi-3", name: "สถานีไฟฟ้าอ้อมน้อย 3", lat: 13.715, lng: 100.315 },
        { id: "om-noi-1-temp", name: "สถานีไฟฟ้าอ้อมน้อย 1 (ชั่วคราว)", lat: 13.698, lng: 100.308 },
        { id: "om-yai-1", name: "สถานีไฟฟ้าอ้อมใหญ่ 1", lat: 13.705, lng: 100.275 },
        { id: "om-yai-3", name: "สถานีไฟฟ้าอ้อมใหญ่ 3", lat: 13.725, lng: 100.295 },
        { id: "om-yai-4", name: "สถานีไฟฟ้าอ้อมใหญ่ 4", lat: 13.735, lng: 100.305 },
        { id: "sam-phran-4", name: "สถานีไฟฟ้าสามพราน 4", lat: 13.735, lng: 100.235 },
        { id: "sam-phran-2", name: "สถานีไฟฟ้าสามพราน 2", lat: 13.715, lng: 100.215 },
        { id: "nakhon-pathom-1", name: "สถานีไฟฟ้านครปฐม 1", lat: 13.815, lng: 100.045 },
        { id: "nakhon-pathom-2", name: "สถานีไฟฟ้านครปฐม 2", lat: 13.825, lng: 100.055 },
        { id: "nakhon-pathom-3", name: "สถานีไฟฟ้านครปฐม 3", lat: 13.835, lng: 100.065 },
        { id: "nakhon-pathom-4-temp", name: "สถานีไฟฟ้านครปฐม 4 (ชั่วคราว)", lat: 13.845, lng: 100.075 },
        { id: "tha-maka-1", name: "สถานีไฟฟ้าท่ามะกา 1", lat: 13.915, lng: 99.765 },
        { id: "tha-maka-2", name: "สถานีไฟฟ้าท่ามะกา 2", lat: 13.925, lng: 99.775 },
        { id: "ban-pong-1", name: "สถานีไฟฟ้าบ้านโป่ง 1", lat: 13.815, lng: 99.875 },
        { id: "tha-muang-2", name: "สถานีไฟฟ้าท่าม่วง 2", lat: 13.823637, lng: 99.635521 },
        { id: "tha-muang-1", name: "สถานีไฟฟ้าท่าม่วง 1", lat: 13.9756569, lng: 99.6288131 },
        { id: "dan-makham-tia", name: "สถานีไฟฟ้าด่านมะขามเตี้ย", lat: 13.855, lng: 99.415 },
        { id: "sai-yok", name: "สถานีไฟฟ้าไทรโยค", lat: 14.115, lng: 99.145 },
        { id: "kanchanaburi-4-temp", name: "สถานีไฟฟ้ากาญจนบุรี 4 (ชั่วคราว)", lat: 13.8889578, lng: 99.1824492 },
        { id: "kanchanaburi-1", name: "สถานีไฟฟ้ากาญจนบุรี 1", lat: 14.015, lng: 99.525 },
        { id: "phanom-thuan", name: "สถานีไฟฟ้าพนมทวน", lat: 14.1196038, lng: 99.6827973 },
        { id: "kanchanaburi-3", name: "สถานีไฟฟ้ากาญจนบุรี 3", lat: 14.035, lng: 99.545 },
        { id: "kanchanaburi-2", name: "สถานีไฟฟ้ากาญจนบุรี 2", lat: 14.025, lng: 99.535 },
        { id: "bo-phloi", name: "สถานีไฟฟ้าบ่อพลอย", lat: 14.325, lng: 99.515 },
        { id: "bo-phloi-2-temp", name: "สถานีไฟฟ้าบ่อพลอย 2 (ชั่วคราว)", lat: 14.335, lng: 99.525 },
      ];

      for (const sub of SUBSTATIONS) {
        await pool.query(
          "INSERT INTO substations (id, name, lat, lng) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
          [sub.id, sub.name, sub.lat, sub.lng]
        );
      }
    }

    console.log("PostgreSQL initialized.");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
}

app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "SSVI API is running" });
});

// Get all substations
app.get("/api/substations", async (req, res) => {
  const pool = getDbPool();
  if (!pool) return res.status(500).json({ error: "Database not configured" });
  try {
    const result = await pool.query("SELECT * FROM substations ORDER BY name ASC");
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upload inspection with Supabase Storage and Postgres
app.post("/api/upload-inspection", upload.array("photos"), async (req: any, res: any) => {
  const { employeeId, substationName, lat, lng, timestamp, categories } = req.body;
  const files = req.files as any[];

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase credentials not configured" });
  }

  try {
    const imageUrls: string[] = [];
    const dateObj = timestamp ? new Date(timestamp) : new Date();

    // 1. Upload to Supabase Storage
    for (const file of files) {
      const fileName = `inspections/${substationName}/${Date.now()}_${file.originalname}`;
      const { data, error } = await supabase.storage
        .from('inspections') // Make sure this bucket exists in Supabase
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('inspections')
        .getPublicUrl(fileName);
      
      imageUrls.push(publicUrl);
    }

    // 2. Log to Database
    const pool = getDbPool();
    if (pool) {
      await pool.query(
        "INSERT INTO inspection_logs (employee_id, substation_name, gps_lat, gps_lng, image_urls, timestamp, categories) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [employeeId || "Unknown", substationName, lat, lng, imageUrls, dateObj, categories]
      );
    }

    res.json({ success: true, imageUrls });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Stats from Postgres
app.get("/api/dashboard-stats", async (req, res) => {
  const { month, year } = req.query;
  const pool = getDbPool();
  if (!pool) return res.status(500).json({ error: "Database not configured" });

  try {
    let query = "SELECT * FROM inspection_logs";
    const params: any[] = [];

    if (month && year) {
      query += " WHERE EXTRACT(MONTH FROM timestamp) = $1 AND EXTRACT(YEAR FROM timestamp) = $2";
      params.push(month, year);
    }

    query += " ORDER BY timestamp DESC";
    const result = await pool.query(query, params);
    const logs = result.rows;

    // Calculate completion (similar logic to Sheets version)
    const REQUIRED_CATEGORIES = ['building', 'yard', 'roof', 'annunciation', 'battery', 'grounding', 'security', 'fence', 'lighting', 'checklist'];
    const substationCompletion = new Map<string, Set<string>>();

    logs.forEach(log => {
      const name = log.substation_name;
      if (!substationCompletion.has(name)) {
        substationCompletion.set(name, new Set());
      }
      const cats = (log.categories || "").split(',').filter(Boolean);
      cats.forEach((cat: string) => {
        if (REQUIRED_CATEGORIES.includes(cat)) {
          substationCompletion.get(name)?.add(cat);
        }
      });
    });

    let completedCount = 0;
    substationCompletion.forEach((cats) => {
      if (cats.size >= REQUIRED_CATEGORIES.length) {
        completedCount++;
      }
    });

    res.json({
      total: completedCount,
      totalSubmissions: logs.length,
      recent: logs,
    });
  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  try {
    await initDb();
  } catch (e) {
    console.error("DB Init failed:", e);
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else {
    // In production (Vercel), we serve static files from dist
    const distPath = path.join(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        if (req.path.startsWith('/api')) return;
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    // Always listen in production if not on Vercel (which uses the exported app)
    if (process.env.RUN_SERVER === "true") {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  }
}

// Start the server
startServer().catch(err => {
  console.error("Critical server startup error:", err);
});

export default app;

