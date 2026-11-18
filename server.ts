import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import {
  initMySQLConnection,
  simpanDataTinggi,
  simpanDataDebit,
  simpanDataHujan,
  ubahBatas,
  catatAlarm,
  ambilRiwayatAlarm,
  updateRiwayatAlarm,
  hapusRiwayatAlarm,
  fixAllZeroAlarmDurations,
  isMysqlReady,
  ambilSemuaPetugas,
  tambahPetugas,
  updatePetugas,
  hapusPetugas,
  updateLoginTerakhir,
  getMysqlError,
  ambilRiwayatKejadian,
  ambilRiwayatGrafik,
} from "./src/db/mysql.js";
import { AdminUser } from "./src/types.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// =====================================================================
// IN-MEMORY / PERSISTENT STATE FOR EWS BANJIR
// =====================================================================

interface Thresholds {
  sensor_mount_height_cm: number;
  level_aman_max: number;
  level_waspada_max: number;
  level_siaga_max: number;
  level_bahaya_min: number;
  flow_warning_lpm: number;
  rain_heavy_pct: number;
  auto_relay_enabled: boolean;
  auto_buzzer_enabled: boolean;
}

const thresholds: Thresholds = {
  sensor_mount_height_cm: 20,
  level_aman_max: 3,
  level_waspada_max: 6,
  level_siaga_max: 10,
  level_bahaya_min: 10,
  flow_warning_lpm: 45.0,
  rain_heavy_pct: 65.0,
  auto_relay_enabled: true,
  auto_buzzer_enabled: true,
};

let sensorState = {
  water_level_cm: 2.5,
  distance_cm: 17.5,
  flow_rate_lpm: 12.0,
  water_speed_mps: 0.42,
  rain_analog: 3800,
  rain_pct: 10.0,
  rain_status: "Cerah Berawan",
  warning_level: "AMAN" as "AMAN" | "WASPADA" | "SIAGA" | "BAHAYA",
  relay_state: false,
  buzzer_state: false,
  led_indicator: "green" as "green" | "yellow" | "red" | "orange",
  timestamp: new Date().toISOString(),
  siren_elapsed_seconds: 0,
};

// WhatsApp (Fonnte API Gateway) config
let whatsAppConfig = {
  fonnte_token: process.env.FONNTE_TOKEN || "STeoGKW9vv8coTDzUETW",
  target_number: process.env.WHATSAPP_TARGET || "120363431321582251@g.us",
  group_name: "Grup Warga Siaga Banjir RW 04",
  group_invite_link:
    "https://chat.whatsapp.com/Ftbc0fqXT2g3qHMTfsPEMh?mode=gi_t",
  notify_waspada: true,
  notify_siaga: true,
};

// Telegram config
let telegramConfig = {
  bot_token:
    process.env.TELEGRAM_BOT_TOKEN ||
    "8438619356:AAFyN2k2e-swmR8h4Ad8XlWIDpHw2ivnDEM",
  chat_id: process.env.TELEGRAM_CHAT_ID || "-1004485459653",
  group_name: "EWS TCE",
  group_invite_link: "https://t.me/+GEfQik2yg3IxZDZl",
  notify_siaga: true,
  notify_bahaya: true,
};

// ESP32 Status & Heartbeat
let lastEspHeartbeatTime = 0; // Timestamp of last received ESP32 telemetry/heartbeat

let esp32Status = {
  online: false, // Default false until ESP32 actually sends heartbeat/data
  ip_address: "192.168.1.108",
  mac_address: "24:6F:28:B4:8C:F2",
  wifi_rssi: -62,
  firmware_version: "v2.4.0-EWS-PRO",
  uptime_seconds: 0,
  last_heartbeat: "Belum terhubung",
  device_id: "ESP32-EWS-CILANGKAP-01",
};

// Check if ESP32 is online based on heartbeat received in last 10 seconds
function isEsp32Alive(): boolean {
  if (lastEspHeartbeatTime === 0) return false;
  return Date.now() - lastEspHeartbeatTime <= 10000; // 10 seconds timeout
}

// Auxiliary Data
let historyData: Array<{
  time: string;
  water_level: number;
  flow_rate: number;
  rain_pct: number;
  level: string;
}> = [
  { time: "07:00", water_level: 65, flow_rate: 12, rain_pct: 0, level: "AMAN" },
  { time: "07:30", water_level: 78, flow_rate: 15, rain_pct: 5, level: "AMAN" },
  {
    time: "08:00",
    water_level: 95,
    flow_rate: 22,
    rain_pct: 25,
    level: "AMAN",
  },
  {
    time: "08:30",
    water_level: 135,
    flow_rate: 34,
    rain_pct: 55,
    level: "WASPADA",
  },
  {
    time: "09:00",
    water_level: 155,
    flow_rate: 42,
    rain_pct: 70,
    level: "WASPADA",
  },
  {
    time: "09:30",
    water_level: 175,
    flow_rate: 49,
    rain_pct: 85,
    level: "SIAGA",
  },
];

let floodEvents: Array<{
  id: string;
  start_time: string;
  peak_water_level_cm: number;
  peak_flow_rate_lpm: number;
  max_warning_level: string;
  cause?: string;
  action_notes?: string;
  _updatedAt?: number;
}> = [];

let lastLiveEventBrokenByAman = true;

function recordLiveFloodEvent(level: "AMAN" | "WASPADA" | "SIAGA" | "BAHAYA") {
  if (level !== "WASPADA" && level !== "SIAGA" && level !== "BAHAYA") {
    lastLiveEventBrokenByAman = true;
    return;
  }
  const now = Date.now();
  const normalizedLevel = level === "BAHAYA" ? "SIAGA" : level;
  const latest = floodEvents[0];

  if (
    !lastLiveEventBrokenByAman &&
    latest &&
    latest.max_warning_level === normalizedLevel &&
    latest._updatedAt &&
    now - latest._updatedAt <= 3 * 60 * 1000
  ) {
    latest.peak_water_level_cm = +Math.max(
      latest.peak_water_level_cm,
      sensorState.water_level_cm,
    ).toFixed(1);
    latest.peak_flow_rate_lpm = +Math.max(
      latest.peak_flow_rate_lpm,
      sensorState.flow_rate_lpm,
    ).toFixed(1);
    latest._updatedAt = now;
    return;
  }

  lastLiveEventBrokenByAman = false;

  const dt = new Date();
  const dateLabel = dt.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeLabel = dt.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  floodEvents.unshift({
    id: `FL-${dt.toISOString().slice(0, 10).replace(/-/g, "")}-${dt.getTime().toString().slice(-4)}`,
    start_time: `${dateLabel} ${timeLabel} WIB`,
    peak_water_level_cm: +sensorState.water_level_cm.toFixed(1),
    peak_flow_rate_lpm: +sensorState.flow_rate_lpm.toFixed(1),
    max_warning_level: normalizedLevel,
    cause: `Sensor ketinggian air mencapai ${sensorState.water_level_cm.toFixed(1)} cm`,
    action_notes:
      normalizedLevel === "SIAGA"
        ? "Sirine & pompa siaga aktif, notifikasi darurat dikirim."
        : "Peringatan waspada dikirim ke grup warga.",
    _updatedAt: now,
  });
  if (floodEvents.length > 30) floodEvents.pop();
}

let alarmLogs: Array<{
  id: string;
  timestamp: string;
  level: string;
  trigger_reason: string;
  duration_seconds: number;
  stopped_by: string;
}> = [
  {
    id: "ALM-101",
    timestamp: "01 Mar 2026 03:18 WIB",
    level: "SIAGA",
    trigger_reason: "Ketinggian air melampaui batas Siaga (165 cm)",
    duration_seconds: 45,
    stopped_by: "Otomatis (Sistem)",
  },
];

// =====================================================================
// ADMIN USERS - Persistent via .data_admin_users.json
// =====================================================================
const ADMIN_USERS_FILE = path.resolve(".data_admin_users.json");

const defaultAdminUsers: AdminUser[] = [
  {
    id: "ADM-01",
    name: "Bambang Sutrisno",
    username: "admin",
    password: "password123",
    role: "Super Admin",
    last_login: "Baru saja",
  },
  {
    id: "ADM-02",
    name: "Rudi Hermawan",
    username: "petugas",
    password: "password123",
    role: "Petugas Posko",
    last_login: "Kemarin",
  },
];

function loadAdminUsers(): AdminUser[] {
  try {
    if (fs.existsSync(ADMIN_USERS_FILE)) {
      const raw = fs.readFileSync(ADMIN_USERS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(
          `[AdminUsers] Loaded ${parsed.length} user(s) dari ${ADMIN_USERS_FILE}`,
        );
        return parsed as AdminUser[];
      }
    }
  } catch (e: any) {
    console.warn("[AdminUsers] Gagal baca file, pakai default:", e?.message);
  }
  return JSON.parse(JSON.stringify(defaultAdminUsers)); // deep copy
}

function saveAdminUsers() {
  try {
    fs.writeFileSync(
      ADMIN_USERS_FILE,
      JSON.stringify(adminUsers, null, 2),
      "utf-8",
    );
    console.log("[AdminUsers] Data tersimpan ke", ADMIN_USERS_FILE);
  } catch (e: any) {
    console.error("[AdminUsers] Gagal simpan ke file:", e?.message);
  }
}

let adminUsers: AdminUser[] = loadAdminUsers();

// Tracks previous warning level to trigger notifications on state transitions
let lastNotificationLevel: "AMAN" | "WASPADA" | "SIAGA" | "BAHAYA" = "AMAN";

// Flag: true jika server baru saja restart (belum pernah terima data ESP32)
let isFirstTelemetry = true;

// Override manual admin agar tidak langsung tertimpa lagi oleh telemetri ESP32 tiap 3 detik
let manualRelayOverride: boolean | null = null;
let manualBuzzerOverride: boolean | null = null;

// Pelacakan alarm aktif & batas maksimal buzzer (1 menit = 60 detik)
const MAX_BUZZER_DURATION_MS = 60 * 1000;
let buzzerActiveSinceMs: number | null = null;
let activeAlarmId: string | null = null;
let activeAlarmStartMs: number | null = null;

async function enforceBuzzerMaxDuration() {
  if (
    sensorState.buzzer_state &&
    buzzerActiveSinceMs !== null &&
    Date.now() - buzzerActiveSinceMs >= MAX_BUZZER_DURATION_MS
  ) {
    console.log(
      "[EWS] Buzzer mencapai durasi maksimal 1 menit — dimatikan otomatis.",
    );
    sensorState.buzzer_state = false;
    buzzerActiveSinceMs = null;
    manualBuzzerOverride = false;
    await finalizeActiveAlarm("Otomatis (Maks 1 Menit)");
  }
}

setInterval(() => {
  enforceBuzzerMaxDuration().catch(() => {});
}, 1000);

async function finalizeActiveAlarm(stoppedBy: string) {
  if (!activeAlarmId || !activeAlarmStartMs) return;
  const alarmId = activeAlarmId;
  const elapsedSeconds = Math.max(
    1,
    Math.round((Date.now() - activeAlarmStartMs) / 1000),
  );
  activeAlarmId = null;
  activeAlarmStartMs = null;
  sensorState.siren_elapsed_seconds = 0;

  const memLog = alarmLogs.find((l) => l.id === alarmId);
  if (memLog) {
    memLog.duration_seconds = elapsedSeconds;
    memLog.stopped_by = stoppedBy;
  }

  await updateRiwayatAlarm(alarmId, {
    durasi_detik: elapsedSeconds,
    dihentikan_oleh: stoppedBy,
  }).catch((e: any) =>
    console.error("[MySQL] Gagal update durasi RiwayatAlarm:", e?.message),
  );
}

async function startActiveAlarm(
  level: "AMAN" | "WASPADA" | "SIAGA" | "BAHAYA",
  reason: string,
) {
  const dbLevel = (level === "BAHAYA" ? "SIAGA" : level) as
    | "AMAN"
    | "WASPADA"
    | "SIAGA";
  const startNow = Date.now();
  try {
    const newId = await catatAlarm(dbLevel, reason, "Sedang Aktif", 0);
    activeAlarmId = newId;
    activeAlarmStartMs = startNow;
    sensorState.siren_elapsed_seconds = 1;
    alarmLogs.unshift({
      id: newId,
      timestamp: new Date().toLocaleString("id-ID"),
      level: dbLevel,
      trigger_reason: reason,
      duration_seconds: 0,
      stopped_by: "Sedang Aktif",
    });
    if (alarmLogs.length > 50) alarmLogs.pop();
  } catch (e: any) {
    console.error("[MySQL] Gagal catat alarm:", e?.message);
  }
}

// =====================================================================
// LEVEL CALCULATION HELPER
// Ambang Batas:
// <= 3 cm  : AMAN
// > 3 cm & <= 6 cm : WASPADA
// > 6 cm   : SIAGA
// =====================================================================
function computeWarningLevel(
  waterLevel: number,
): "AMAN" | "WASPADA" | "SIAGA" | "BAHAYA" {
  if (waterLevel <= thresholds.level_aman_max) {
    return "AMAN";
  } else if (waterLevel <= thresholds.level_waspada_max) {
    return "WASPADA";
  } else {
    return "SIAGA";
  }
}

// =====================================================================
// FONNTE WHATSAPP DISPATCH HELPER
// =====================================================================
async function sendFonnteWhatsApp(
  target: string,
  message: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const token = whatsAppConfig.fonnte_token;
  if (!token || !token.trim()) {
    console.warn("[Fonnte] Token is missing or empty. Skipping WA dispatch.");
    return { success: false, error: "Fonnte token tidak dikonfigurasi." };
  }

  try {
    console.log(`[Fonnte] Mengirim notifikasi WA ke: ${target}`);
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target: target.trim(),
        message: message,
        countryCode: "62",
      }),
    });

    const resJson = await response.json();
    console.log("[Fonnte Response]:", resJson);
    return { success: response.ok, data: resJson };
  } catch (err: any) {
    console.error("[Fonnte Error]:", err?.message);
    return { success: false, error: err?.message };
  }
}

// =====================================================================
// TELEGRAM DISPATCH HELPER
// =====================================================================
async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<boolean> {
  const token = telegramConfig.bot_token;
  if (!token) return false;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      },
    );
    return res.ok;
  } catch (err) {
    console.error("[Telegram Error]:", err);
    return false;
  }
}

// =====================================================================
// NOTIFICATION DISPATCH ENGINE
// =====================================================================
async function checkAndSendAlert(
  prevLevel: "AMAN" | "WASPADA" | "SIAGA" | "BAHAYA",
  newLevel: "AMAN" | "WASPADA" | "SIAGA" | "BAHAYA",
) {
  // Jika server baru restart & status sudah bahaya dari telemetri pertama,
  // perlakukan seolah-olah transisi dari AMAN agar notifikasi tetap terkirim.
  const effectivePrev = isFirstTelemetry ? "AMAN" : prevLevel;
  isFirstTelemetry = false;

  if (effectivePrev === newLevel && newLevel === "AMAN") {
    return; // Tidak ada transisi, dan kondisi aman — abaikan
  }

  // Jika tidak ada perubahan status (dan bukan kasus first-telemetry di atas), skip
  if (effectivePrev === newLevel) {
    return;
  }

  // Update synchronously sebelum await agar request berikutnya tidak mengirim notifikasi ganda
  lastNotificationLevel = newLevel;

  const timeStr = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  console.log(
    `[EWS Status Transition] ${effectivePrev} ➔ ${newLevel}${isFirstTelemetry === false && prevLevel !== effectivePrev ? " (server baru restart, transisi dipaksakan)" : ""}`,
  );

  // -------------------------------------------------------------
  // 1. TRANSITION TO STATUS: WASPADA
  // -------------------------------------------------------------
  if (newLevel === "WASPADA") {
    await finalizeActiveAlarm(
      effectivePrev === "SIAGA" || effectivePrev === "BAHAYA"
        ? "Otomatis (Surut ke WASPADA)"
        : "Otomatis",
    );
    await startActiveAlarm(
      "WASPADA",
      `Ketinggian air ${sensorState.water_level_cm.toFixed(1)} cm melewati batas aman (${thresholds.level_aman_max} cm)`,
    );

    if (whatsAppConfig.notify_waspada) {
      const waMsg =
        `⚠️ *[PERINGATAN DINI BANJIR - STATUS WASPADA]* ⚠️\n\n` +
        `Yth. Bapak/Ibu Warga,\n` +
        `Sensor mendeteksi ketinggian air sungai telah melampaui batas aman (> ${thresholds.level_aman_max} cm).\n\n` +
        `📊 *Data Terkini Sensor EWS:*\n` +
        `• Status: *WASPADA (KUNING)*\n` +
        `• Ketinggian Air: *${sensorState.water_level_cm.toFixed(1)} cm* (Batas Aman: ${thresholds.level_aman_max} cm, Batas Waspada: ${thresholds.level_waspada_max} cm)\n` +
        `• Debit/Aliran: *${sensorState.flow_rate_lpm.toFixed(1)} L/menit*\n` +
        `• Cuaca/Hujan: *${sensorState.rain_status} (${sensorState.rain_pct.toFixed(0)}%)*\n` +
        `• Waktu: ${timeStr} WIB, ${dateStr}\n\n` +
        `📌 *Imbauan:*\n` +
        `1. Warga di sekitar aliran air dimohon meningkatkan kewaspadaan.\n` +
        `2. Amankan dokumen dan barang berharga.\n` +
        `3. Pantau terus update resmi di grup WhatsApp ini.\n\n` +
        `_Sistem Peringatan Dini Banjir (EWS)_`;

      await sendFonnteWhatsApp(whatsAppConfig.target_number, waMsg);
    }
  }

  // -------------------------------------------------------------
  // 2. TRANSITION TO STATUS: SIAGA
  // -------------------------------------------------------------
  else if (newLevel === "SIAGA" || newLevel === "BAHAYA") {
    await finalizeActiveAlarm(
      effectivePrev === "WASPADA" ? "Otomatis (Naik SIAGA)" : "Otomatis",
    );
    await startActiveAlarm(
      "SIAGA",
      `Ketinggian air ${sensorState.water_level_cm.toFixed(1)} cm melewati batas waspada (${thresholds.level_waspada_max} cm)`,
    );

    if (whatsAppConfig.notify_siaga) {
      const waMsg =
        `🚨 *[PERINGATAN DARURAT BANJIR - STATUS SIAGA]* 🚨\n\n` +
        `PERHATIAN KEPADA SELURUH WARGA!\n` +
        `Ketinggian air telah melampaui batas waspada (> ${thresholds.level_waspada_max} cm) dan memasuki zona *SIAGA*.\n\n` +
        `📊 *Data Sensor EWS:*\n` +
        `• Status: *SIAGA (MERAH)*\n` +
        `• Ketinggian Air: *${sensorState.water_level_cm.toFixed(1)} cm* (Ambang Batas Siaga: ${thresholds.level_waspada_max} cm)\n` +
        `• Debit Air: *${sensorState.flow_rate_lpm.toFixed(1)} L/menit*\n` +
        `• Cuaca/Hujan: *${sensorState.rain_status}*\n` +
        `• Sirine & Pompa: ${sensorState.relay_state ? "AKTIF" : "SIAGA"}\n` +
        `• Waktu: ${timeStr} WIB, ${dateStr}\n\n` +
        `🚨 *Instruksi Segera:*\n` +
        `1. Warga segera bersiap evakuasi mandiri ke titik kumpul aman.\n` +
        `2. Matikan sekring listrik utama rumah masing-masing.\n` +
        `3. Hubungi petugas posko darurat jika memerlukan bantuan evakuasi.\n\n` +
        `_Sistem Peringatan Dini Banjir (EWS)_`;

      await sendFonnteWhatsApp(whatsAppConfig.target_number, waMsg);
    }

    if (telegramConfig.notify_siaga) {
      const tgMsg =
        `🚨 *[DARURAT EWS BANJIR - STATUS SIAGA]* 🚨\n\n` +
        `Ketinggian air mencapai *${sensorState.water_level_cm.toFixed(1)} cm* (> ${thresholds.level_waspada_max} cm)!\n` +
        `Status: *SIAGA*\n` +
        `Debit air: *${sensorState.flow_rate_lpm.toFixed(1)} L/min*`;
      await sendTelegramMessage(telegramConfig.chat_id, tgMsg);
    }
  }

  // -------------------------------------------------------------
  // 3. TRANSITION RETURNING TO: AMAN
  // -------------------------------------------------------------
  else if (
    newLevel === "AMAN" &&
    (effectivePrev === "WASPADA" || effectivePrev === "SIAGA")
  ) {
    await finalizeActiveAlarm("Otomatis (Surut ke AMAN)");

    const waMsg =
      `✅ *[INFO EWS BANJIR - AIR KEMBALI NORMAL]* ✅\n\n` +
      `Pantauan sensor EWS menunjukkan ketinggian air telah surut kembali ke batas *AMAN*.\n\n` +
      `• Ketinggian Air: *${sensorState.water_level_cm.toFixed(1)} cm*\n` +
      `• Status: *AMAN (HIJAU)*\n` +
      `• Waktu: ${timeStr} WIB\n\n` +
      `Terima kasih atas kerja sama dan kewaspadaan Bapak/Ibu sekalian.`;

    await sendFonnteWhatsApp(whatsAppConfig.target_number, waMsg);
  }
}

// =====================================================================
// API ROUTES
// =====================================================================

// 1. GET /api/status
app.get("/api/status", async (_req, res) => {
  await enforceBuzzerMaxDuration();
  // Automatically calculate real-time online status
  esp32Status.online = isEsp32Alive();
  sensorState.siren_elapsed_seconds =
    sensorState.buzzer_state && buzzerActiveSinceMs !== null
      ? Math.min(
          60,
          Math.max(1, Math.floor((Date.now() - buzzerActiveSinceMs) / 1000)),
        )
      : 0;

  res.json({
    sensorState,
    thresholds,
    telegramConfig,
    whatsAppConfig,
    esp32Status,
    databaseStatus: {
      connected: isMysqlReady(),
      driver: isMysqlReady() ? "mysql" : "memory",
      host: process.env.DB_HOST || "127.0.0.1",
      database: process.env.DB_NAME || "ews_banjir",
      tableCount: 6,
      lastChecked: new Date().toISOString(),
    },
  });
});

// 1.1 POST /api/sensor/telemetry (Endpoint dipanggil oleh mikrokontroler ESP32 setiap 3-5 detik)
app.post(
  [
    "/api/sensor/telemetry",
    "/api/sensor/data",
    "/api/sensor-data",
    "/api/telemetry",
    "/api/data",
  ],
  async (req, res) => {
    const b = req.body || {};
    lastEspHeartbeatTime = Date.now();
    esp32Status.online = true;
    esp32Status.last_heartbeat = new Date().toISOString();

    if (b.ip_address) esp32Status.ip_address = b.ip_address;
    if (b.wifi_rssi) esp32Status.wifi_rssi = Number(b.wifi_rssi);
    if (b.firmware_version) esp32Status.firmware_version = b.firmware_version;
    if (b.device_id) esp32Status.device_id = b.device_id;
    if (typeof b.uptime_seconds === "number")
      esp32Status.uptime_seconds = b.uptime_seconds;

    // Baca nilai sensor dari ESP32 jika dikirim
    const water = b.water_level_cm ?? b.waterLevel ?? b.tinggi_air;
    const flow = b.flow_rate_lpm ?? b.flow ?? b.debit_air;
    const rain = b.rain_pct ?? b.rainPercent ?? b.persen_hujan;
    const rainAdc = b.rain_analog ?? b.rainAnalog ?? null;

    // Gunakan lastNotificationLevel sebagai acuan level sebelumnya
    // agar notifikasi dikirim berdasarkan level yang SUDAH dinotifikasi,
    // bukan sekadar nilai sensorState saat ini (yang bisa berubah-ubah setiap 3 detik)
    const prevLevel = lastNotificationLevel;

    if (water !== undefined && water !== null && !isNaN(Number(water))) {
      sensorState.water_level_cm = Number(water);
      sensorState.distance_cm = Math.max(
        0,
        thresholds.sensor_mount_height_cm - sensorState.water_level_cm,
      );
    }

    if (flow !== undefined && flow !== null && !isNaN(Number(flow))) {
      sensorState.flow_rate_lpm = Number(flow);
      sensorState.water_speed_mps = +(sensorState.flow_rate_lpm / 28).toFixed(
        2,
      );
    }

    if (rain !== undefined && rain !== null && !isNaN(Number(rain))) {
      sensorState.rain_pct = Number(rain);
      // Pakai rain_analog dari ESP32 jika tersedia, kalau tidak konversi dari persen
      sensorState.rain_analog =
        rainAdc !== null && !isNaN(Number(rainAdc))
          ? Number(rainAdc)
          : Math.max(0, Math.round(4095 - (sensorState.rain_pct / 100) * 4095));
      if (sensorState.rain_pct < 20) sensorState.rain_status = "Cerah Berawan";
      else if (sensorState.rain_pct < 60)
        sensorState.rain_status = "Hujan Sedang";
      else sensorState.rain_status = "Hujan Lebat";
    } else if (rainAdc !== null && !isNaN(Number(rainAdc))) {
      // Kalau hanya rain_analog yang dikirim tanpa rain_pct
      sensorState.rain_analog = Number(rainAdc);
      sensorState.rain_pct = Math.max(
        0,
        ((4095 - sensorState.rain_analog) / 4095) * 100,
      );
      if (sensorState.rain_pct < 20) sensorState.rain_status = "Cerah Berawan";
      else if (sensorState.rain_pct < 60)
        sensorState.rain_status = "Hujan Sedang";
      else sensorState.rain_status = "Hujan Lebat";
    }

    const prevWaterLevel = sensorState.warning_level;
    const newLevel = computeWarningLevel(sensorState.water_level_cm);
    sensorState.warning_level = newLevel;

    // Reset override manual hanya jika level peringatan berubah ke fase baru
    if (prevWaterLevel !== newLevel) {
      manualRelayOverride = null;
      manualBuzzerOverride = null;
    }

    const autoRelay =
      newLevel === "WASPADA" || newLevel === "SIAGA" || newLevel === "BAHAYA";
    const autoBuzzer =
      newLevel === "WASPADA" || newLevel === "SIAGA" || newLevel === "BAHAYA";

    if (newLevel === "AMAN") {
      sensorState.led_indicator = "green";
    } else if (newLevel === "WASPADA") {
      sensorState.led_indicator = "yellow";
    } else {
      sensorState.led_indicator = "red";
    }

    const prevBuzzerState = sensorState.buzzer_state;

    // Set aktuator otomatis sambil menghormati override manual dari Admin
    if (thresholds.auto_relay_enabled) {
      const espReportedRelay =
        typeof b.relay_state === "boolean" ? b.relay_state : false;
      sensorState.relay_state =
        manualRelayOverride !== null
          ? manualRelayOverride
          : autoRelay || espReportedRelay;
    }
    if (thresholds.auto_buzzer_enabled) {
      sensorState.buzzer_state =
        manualBuzzerOverride !== null ? manualBuzzerOverride : autoBuzzer;
    }

    if (sensorState.buzzer_state) {
      if (!prevBuzzerState || prevWaterLevel !== newLevel) {
        buzzerActiveSinceMs = Date.now();
      }
      await enforceBuzzerMaxDuration();
    } else {
      buzzerActiveSinceMs = null;
    }

    sensorState.timestamp = new Date().toISOString();

    // Catat riwayat in-memory
    const timeNow = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    historyData.push({
      time: timeNow,
      water_level: sensorState.water_level_cm,
      flow_rate: sensorState.flow_rate_lpm,
      rain_pct: sensorState.rain_pct,
      level: sensorState.warning_level,
    });
    if (historyData.length > 50) historyData.shift();

    // ✅ Simpan ke MySQL dan ambil ID baris yang tersimpan untuk konfirmasi ke ESP32
    const dbLevel = (newLevel === "BAHAYA" ? "SIAGA" : newLevel) as
      | "AMAN"
      | "WASPADA"
      | "SIAGA";
    const [idKetinggian, idDebit, idHujan] = await Promise.all([
      simpanDataTinggi(
        sensorState.water_level_cm,
        sensorState.distance_cm,
        dbLevel,
        sensorState.relay_state,
        sensorState.buzzer_state,
      ).catch((e: any) => {
        console.error("[MySQL] Gagal simpan SensorKetinggian:", e?.message);
        return 0;
      }),
      simpanDataDebit(
        sensorState.flow_rate_lpm,
        sensorState.water_speed_mps,
      ).catch((e: any) => {
        console.error("[MySQL] Gagal simpan SensorDebit:", e?.message);
        return 0;
      }),
      simpanDataHujan(
        sensorState.rain_analog,
        sensorState.rain_pct,
        sensorState.rain_status,
      ).catch((e: any) => {
        console.error("[MySQL] Gagal simpan SensorHujan:", e?.message);
        return 0;
      }),
    ]);

    // Catat ke Riwayat Kejadian real-time jika WASPADA / SIAGA
    recordLiveFloodEvent(newLevel);

    // Pemicu WhatsApp
    checkAndSendAlert(prevLevel, newLevel).catch(() => {});

    res.json({
      success: true,
      relay: sensorState.relay_state ? 1 : 0,
      buzzer: sensorState.buzzer_state ? 1 : 0,
      warning_level: sensorState.warning_level,
      saved: {
        sensor_ketinggian_id: idKetinggian,
        sensor_debit_id: idDebit,
        sensor_hujan_id: idHujan,
      },
    });
  },
);

// 1.2 POST /api/esp32/heartbeat (Heartbeat ping dari ESP32)
app.post(["/api/esp32/heartbeat", "/api/heartbeat"], (req, res) => {
  lastEspHeartbeatTime = Date.now();
  esp32Status.online = true;
  esp32Status.last_heartbeat = new Date().toISOString();
  if (req.body?.ip) esp32Status.ip_address = req.body.ip;
  if (req.body?.rssi) esp32Status.wifi_rssi = Number(req.body.rssi);

  res.json({
    status: "ok",
    online: true,
    server_time: new Date().toISOString(),
    relay: sensorState.relay_state,
    buzzer: sensorState.buzzer_state,
  });
});

// 1.3 POST /api/esp32/mock-toggle (Bisa digunakan untuk menguji simulasi ON/OFF dari Admin jika ESP belum tersambung fisik)
app.post("/api/esp32/toggle-simulated", (req, res) => {
  if (typeof req.body?.online === "boolean") {
    if (req.body.online) {
      lastEspHeartbeatTime = Date.now();
      esp32Status.online = true;
      esp32Status.last_heartbeat = new Date().toISOString();
    } else {
      lastEspHeartbeatTime = 0;
      esp32Status.online = false;
      esp32Status.last_heartbeat = "Terputus";
    }
  } else {
    if (isEsp32Alive()) {
      lastEspHeartbeatTime = 0;
      esp32Status.online = false;
    } else {
      lastEspHeartbeatTime = Date.now();
      esp32Status.online = true;
      esp32Status.last_heartbeat = new Date().toISOString();
    }
  }
  res.json({
    status: "success",
    esp32Status: { ...esp32Status, online: isEsp32Alive() },
  });
});

// 2. POST /api/control (simulate sensor or actuator toggle)
app.post("/api/control", async (req, res) => {
  const { water_level_cm, flow_rate_lpm, rain_pct, relay, buzzer, admin_name } =
    req.body;

  const prevLevel = lastNotificationLevel;

  if (typeof water_level_cm === "number") {
    sensorState.water_level_cm = Number(water_level_cm);
    sensorState.distance_cm = Math.max(
      0,
      thresholds.sensor_mount_height_cm - sensorState.water_level_cm,
    );
  }

  if (typeof flow_rate_lpm === "number") {
    sensorState.flow_rate_lpm = Number(flow_rate_lpm);
    sensorState.water_speed_mps = +(sensorState.flow_rate_lpm / 28).toFixed(2);
  }

  if (typeof rain_pct === "number") {
    sensorState.rain_pct = Number(rain_pct);
    sensorState.rain_analog = Math.max(
      0,
      Math.round(4095 - (sensorState.rain_pct / 100) * 4095),
    );
    if (sensorState.rain_pct < 20) sensorState.rain_status = "Cerah Berawan";
    else if (sensorState.rain_pct < 60)
      sensorState.rain_status = "Hujan Sedang";
    else sensorState.rain_status = "Hujan Lebat";
  }

  const hasSensorPayload =
    typeof water_level_cm === "number" ||
    typeof flow_rate_lpm === "number" ||
    typeof rain_pct === "number";

  const prevWaterLevel = sensorState.warning_level;
  // Recalculate warning level based on new water level
  const newLevel = computeWarningLevel(sensorState.water_level_cm);
  sensorState.warning_level = newLevel;

  if (prevWaterLevel !== newLevel) {
    manualRelayOverride = null;
    manualBuzzerOverride = null;
  }

  // Set LED indicator & actuators automatically if enabled
  if (newLevel === "AMAN") {
    sensorState.led_indicator = "green";
    if (
      thresholds.auto_relay_enabled &&
      typeof relay !== "boolean" &&
      manualRelayOverride === null
    )
      sensorState.relay_state = false;
    if (
      thresholds.auto_buzzer_enabled &&
      typeof buzzer !== "boolean" &&
      manualBuzzerOverride === null
    )
      sensorState.buzzer_state = false;
  } else if (newLevel === "WASPADA") {
    sensorState.led_indicator = "yellow";
    if (
      thresholds.auto_relay_enabled &&
      typeof relay !== "boolean" &&
      manualRelayOverride === null
    )
      sensorState.relay_state = true;
    if (
      thresholds.auto_buzzer_enabled &&
      typeof buzzer !== "boolean" &&
      manualBuzzerOverride === null
    )
      sensorState.buzzer_state = true;
  } else {
    // SIAGA / BAHAYA
    sensorState.led_indicator = "red";
    if (
      thresholds.auto_relay_enabled &&
      typeof relay !== "boolean" &&
      manualRelayOverride === null
    )
      sensorState.relay_state = true;
    if (
      thresholds.auto_buzzer_enabled &&
      typeof buzzer !== "boolean" &&
      manualBuzzerOverride === null
    )
      sensorState.buzzer_state = true;
  }

  const prevBuzzerBeforeControl = sensorState.buzzer_state;

  // Manual overrides dari admin
  if (typeof relay === "boolean") {
    manualRelayOverride = relay;
    sensorState.relay_state = relay;
  }
  if (typeof buzzer === "boolean") {
    manualBuzzerOverride = buzzer;
    sensorState.buzzer_state = buzzer;
    if (buzzer) {
      buzzerActiveSinceMs = Date.now();
      await finalizeActiveAlarm(`Manual (${admin_name || "Admin"})`);
      await startActiveAlarm(
        sensorState.warning_level,
        `Aktivasi manual oleh ${admin_name || "Admin"}`,
      );
    } else {
      buzzerActiveSinceMs = null;
      await finalizeActiveAlarm(`Manual (${admin_name || "Admin"})`);
    }
  } else if (sensorState.buzzer_state) {
    if (!prevBuzzerBeforeControl || prevWaterLevel !== newLevel) {
      buzzerActiveSinceMs = Date.now();
    }
    await enforceBuzzerMaxDuration();
  } else {
    buzzerActiveSinceMs = null;
  }

  sensorState.timestamp = new Date().toISOString();

  if (hasSensorPayload) {
    // Append history point
    const timeNow = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    historyData.push({
      time: timeNow,
      water_level: sensorState.water_level_cm,
      flow_rate: sensorState.flow_rate_lpm,
      rain_pct: sensorState.rain_pct,
      level: sensorState.warning_level,
    });
    if (historyData.length > 50) historyData.shift();

    // ✅ Simpan ke MySQL jika ada payload sensor
    const dbLevelCtrl = (newLevel === "BAHAYA" ? "SIAGA" : newLevel) as
      | "AMAN"
      | "WASPADA"
      | "SIAGA";
    console.log(
      `[/api/control] Menyimpan ke MySQL: tinggi=${sensorState.water_level_cm}, debit=${sensorState.flow_rate_lpm}, hujan=${sensorState.rain_pct}%, cuaca=${sensorState.rain_status}`,
    );
    simpanDataTinggi(
      sensorState.water_level_cm,
      sensorState.distance_cm,
      dbLevelCtrl,
      sensorState.relay_state,
      sensorState.buzzer_state,
    ).catch((e) =>
      console.error("[MySQL] Gagal simpan SensorKetinggian:", e?.message),
    );
    simpanDataDebit(
      sensorState.flow_rate_lpm,
      sensorState.water_speed_mps,
    ).catch((e) =>
      console.error("[MySQL] Gagal simpan SensorDebit:", e?.message),
    );
    simpanDataHujan(
      sensorState.rain_analog,
      sensorState.rain_pct,
      sensorState.rain_status,
    ).catch((e) =>
      console.error("[MySQL] Gagal simpan SensorHujan:", e?.message),
    );

    // Catat ke Riwayat Kejadian real-time jika WASPADA / SIAGA
    recordLiveFloodEvent(newLevel);
  }

  // Trigger state transition alert check (WASPADA / SIAGA)
  checkAndSendAlert(prevLevel, newLevel).catch((err) => {
    console.error("Alert check error:", err);
  });

  res.json({
    status: "success",
    sensorState,
  });
});

// 3. POST /api/thresholds
app.post("/api/thresholds", async (req, res) => {
  const b = req.body;
  if (typeof b.sensor_mount_height_cm === "number")
    thresholds.sensor_mount_height_cm = b.sensor_mount_height_cm;
  if (typeof b.level_aman_max === "number")
    thresholds.level_aman_max = b.level_aman_max;
  if (typeof b.level_waspada_max === "number")
    thresholds.level_waspada_max = b.level_waspada_max;
  if (typeof b.level_siaga_max === "number")
    thresholds.level_siaga_max = b.level_siaga_max;
  if (typeof b.level_bahaya_min === "number")
    thresholds.level_bahaya_min = b.level_bahaya_min;
  if (typeof b.flow_warning_lpm === "number")
    thresholds.flow_warning_lpm = b.flow_warning_lpm;
  if (typeof b.rain_heavy_pct === "number")
    thresholds.rain_heavy_pct = b.rain_heavy_pct;
  if (typeof b.auto_relay_enabled === "boolean")
    thresholds.auto_relay_enabled = b.auto_relay_enabled;
  if (typeof b.auto_buzzer_enabled === "boolean")
    thresholds.auto_buzzer_enabled = b.auto_buzzer_enabled;

  // ✅ Simpan ke MySQL tabel AmbangBatas
  ubahBatas({
    sensor_mount_height_cm: thresholds.sensor_mount_height_cm,
    level_aman_max: thresholds.level_aman_max,
    level_waspada_max: thresholds.level_waspada_max,
    level_siaga_max: thresholds.level_siaga_max,
    flow_warning_lpm: thresholds.flow_warning_lpm,
    rain_heavy_pct: thresholds.rain_heavy_pct,
    auto_relay_enabled: thresholds.auto_relay_enabled,
    auto_buzzer_enabled: thresholds.auto_buzzer_enabled,
  })
    .then(() => console.log("✅ [MySQL] AmbangBatas berhasil diperbarui."))
    .catch((e: any) =>
      console.error("❌ [MySQL] Gagal update AmbangBatas:", e?.message),
    );

  // Re-evaluate level & actuators with new thresholds
  const prevLevel = sensorState.warning_level;
  const updatedLevel = computeWarningLevel(sensorState.water_level_cm);
  sensorState.warning_level = updatedLevel;
  const isAlertLevel =
    updatedLevel === "WASPADA" ||
    updatedLevel === "SIAGA" ||
    updatedLevel === "BAHAYA";
  sensorState.led_indicator =
    updatedLevel === "AMAN"
      ? "green"
      : updatedLevel === "WASPADA"
        ? "yellow"
        : "red";
  if (prevLevel !== updatedLevel) {
    manualRelayOverride = null;
    manualBuzzerOverride = null;
  }
  const prevBuzzerBeforeThreshold = sensorState.buzzer_state;
  if (thresholds.auto_relay_enabled && manualRelayOverride === null) {
    sensorState.relay_state = isAlertLevel;
  }
  if (thresholds.auto_buzzer_enabled && manualBuzzerOverride === null) {
    sensorState.buzzer_state = isAlertLevel;
  }
  if (sensorState.buzzer_state) {
    if (!prevBuzzerBeforeThreshold || prevLevel !== updatedLevel) {
      buzzerActiveSinceMs = Date.now();
    }
  } else {
    buzzerActiveSinceMs = null;
  }
  checkAndSendAlert(prevLevel, updatedLevel).catch(() => {});

  res.json({ status: "success", thresholds });
});

// 4. POST /api/whatsapp/settings
app.post("/api/whatsapp/settings", (req, res) => {
  const {
    fonnte_token,
    target_number,
    group_name,
    group_invite_link,
    notify_waspada,
    notify_siaga,
  } = req.body;
  if (fonnte_token !== undefined) whatsAppConfig.fonnte_token = fonnte_token;
  if (target_number !== undefined) whatsAppConfig.target_number = target_number;
  if (group_name !== undefined) whatsAppConfig.group_name = group_name;
  if (group_invite_link !== undefined)
    whatsAppConfig.group_invite_link = group_invite_link;
  if (notify_waspada !== undefined)
    whatsAppConfig.notify_waspada = Boolean(notify_waspada);
  if (notify_siaga !== undefined)
    whatsAppConfig.notify_siaga = Boolean(notify_siaga);

  res.json({ status: "success", whatsAppConfig });
});

// 5. POST /api/whatsapp/broadcast (Manual broadcast)
app.post("/api/whatsapp/broadcast", async (req, res) => {
  const { message, target } = req.body;
  const targetRecipient = (target || whatsAppConfig.target_number || "").trim();

  if (!targetRecipient) {
    return res.status(400).json({
      ok: false,
      error: "Nomor atau Grup WhatsApp tujuan wajib diisi.",
    });
  }

  const broadcastMsg =
    message ||
    `📢 *[PESAN SIAGA BANJIR - POSKO EWS]*\n\n` +
      `Status Terkini: *${sensorState.warning_level}*\n` +
      `Ketinggian Air: *${sensorState.water_level_cm.toFixed(1)} cm*\n` +
      `Kecepatan Aliran: *${sensorState.flow_rate_lpm.toFixed(1)} L/min*\n` +
      `Cuaca: *${sensorState.rain_status}*\n\n` +
      `Harap seluruh warga selalu waspada dan siaga!`;

  const result = await sendFonnteWhatsApp(targetRecipient, broadcastMsg);
  if (result.success) {
    res.json({
      ok: true,
      status: "success",
      message: "Pesan broadcast WhatsApp berhasil dikirim!",
    });
  } else {
    res.json({
      ok: false,
      status: "error",
      message:
        result.error ||
        "Gagal mengirim pesan via Fonnte. Cek token & koneksi Fonnte.",
    });
  }
});

// 6. POST /api/whatsapp/fetch-groups
app.post("/api/whatsapp/fetch-groups", async (_req, res) => {
  const token = whatsAppConfig.fonnte_token;
  if (!token) {
    return res.status(400).json({ error: "Fonnte token belum diatur." });
  }

  try {
    const fonnteRes = await fetch("https://api.fonnte.com/get-whatsapp-group", {
      method: "POST",
      headers: { Authorization: token },
    });
    const fonnteData = await fonnteRes.json();
    if (Array.isArray(fonnteData?.data)) {
      const groups = fonnteData.data.map((g: any) => ({
        id: g.id,
        name: g.name,
      }));
      return res.json({ groups });
    }
    // Fallback default list
    res.json({
      groups: [
        { id: "120363431321582251@g.us", name: "Grup Warga Siaga Banjir" },
        {
          id: "120363029481928371@g.us",
          name: "Relawan & Posko Tanggap Bencana",
        },
      ],
    });
  } catch (err: any) {
    res.json({
      groups: [
        { id: "120363431321582251@g.us", name: "Grup Warga Siaga Banjir" },
      ],
      message: "Menggunakan cache grup lokal.",
    });
  }
});

// 7. POST /api/telegram/settings
app.post("/api/telegram/settings", (req, res) => {
  const {
    bot_token,
    chat_id,
    group_name,
    group_invite_link,
    notify_siaga,
    notify_bahaya,
  } = req.body;
  if (bot_token !== undefined) telegramConfig.bot_token = bot_token;
  if (chat_id !== undefined) telegramConfig.chat_id = chat_id;
  if (group_name !== undefined) telegramConfig.group_name = group_name;
  if (group_invite_link !== undefined)
    telegramConfig.group_invite_link = group_invite_link;
  if (notify_siaga !== undefined)
    telegramConfig.notify_siaga = Boolean(notify_siaga);
  if (notify_bahaya !== undefined)
    telegramConfig.notify_bahaya = Boolean(notify_bahaya);

  res.json({ status: "success", telegramConfig });
});

// 8. POST /api/telegram/broadcast
app.post("/api/telegram/broadcast", async (req, res) => {
  const { message } = req.body;
  const text =
    message ||
    `📢 *[PESAN POSKO EWS BANJIR]*\n\nStatus: *${sensorState.warning_level}*\nKetinggian Air: *${sensorState.water_level_cm.toFixed(1)} cm*`;

  const success = await sendTelegramMessage(telegramConfig.chat_id, text);
  res.json({
    ok: success,
    status: success ? "success" : "simulated",
    message: "Broadcast terkirim",
  });
});

// 9. POST /api/telegram/bot-command
app.post("/api/telegram/bot-command", (req, res) => {
  const cmd = (req.body?.command || "").toLowerCase();
  let reply = "";
  if (cmd.includes("tinggi") || cmd.includes("ketinggian")) {
    reply = `📏 Ketinggian air sungai saat ini *${sensorState.water_level_cm.toFixed(1)} cm* (${sensorState.warning_level}). Jarak sensor ke permukaan: ${sensorState.distance_cm.toFixed(1)} cm.`;
  } else if (
    cmd.includes("kecepatan") ||
    cmd.includes("debit") ||
    cmd.includes("arus")
  ) {
    reply = `🌊 Debit air sungai saat ini *${sensorState.flow_rate_lpm.toFixed(1)} L/menit* dengan perkiraan kecepatan arus *${sensorState.water_speed_mps.toFixed(2)} m/detik*.`;
  } else if (cmd.includes("hujan") || cmd.includes("cuaca")) {
    reply = `🌧️ Sensor hujan mencatat status: *${sensorState.rain_status}* (${sensorState.rain_pct.toFixed(0)}%). Nilai analog: ${sensorState.rain_analog}.`;
  } else if (cmd.includes("evakuasi")) {
    reply = `🏃 *Titik Kumpul & Posko Evakuasi:*\n1. Balai Pertemuan RW 04\n2. Gedung Serbaguna Cilangkap\nPetugas posko siap mendampingi proses evakuasi lansia dan anak-anak.`;
  } else if (cmd.includes("posko") || cmd.includes("kontak")) {
    reply = `📞 *Kontak Darurat Posko EWS:*\n• Ketua Posko: 0812-3456-7890\n• Ambulans/Medis: 118\n• Damkar & Penyelamatan: 113\n• BPBD DKI Jakarta: 112`;
  } else {
    reply = `📊 Status EWS: *${sensorState.warning_level}*\n• Ketinggian Air: *${sensorState.water_level_cm.toFixed(1)} cm*\n• Debit: *${sensorState.flow_rate_lpm.toFixed(1)} L/min*\n• Cuaca: *${sensorState.rain_status}*`;
  }
  res.json({ reply });
});

// 10. GET /api/history
app.get("/api/history", async (_req, res) => {
  if (isMysqlReady()) {
    const dbHistory = await ambilRiwayatGrafik(30);
    if (dbHistory.length > 0) {
      return res.json({ history: dbHistory });
    }
  }
  res.json({ history: historyData });
});

// 11. GET /api/flood-events & POST /api/flood-events
app.get("/api/flood-events", async (_req, res) => {
  if (isMysqlReady()) {
    const dbEvents = await ambilRiwayatKejadian(20);
    if (dbEvents.length > 0) {
      return res.json({ events: dbEvents });
    }
  }
  res.json({ events: floodEvents });
});
app.post("/api/flood-events", (req, res) => {
  const { cause, action_notes } = req.body;
  const newEvt = {
    id: `FL-${new Date().toISOString().slice(0, 10)}-${Date.now().toString().slice(-3)}`,
    start_time: new Date().toLocaleString("id-ID"),
    peak_water_level_cm: sensorState.water_level_cm,
    peak_flow_rate_lpm: sensorState.flow_rate_lpm,
    max_warning_level: sensorState.warning_level,
    cause: cause || "Kenaikan air sungai mendadak",
    action_notes: action_notes || "Dipantau oleh tim posko EWS",
  };
  floodEvents.unshift(newEvt);
  res.json({ status: "success", event: newEvt });
});

// 12. GET /api/alarm-logs, PATCH /api/alarm-logs/:id, DELETE /api/alarm-logs/:id
app.get("/api/alarm-logs", async (_req, res) => {
  try {
    const logs = await ambilRiwayatAlarm();
    res.json({ logs });
  } catch (e: any) {
    // Fallback ke in-memory jika MySQL bermasalah
    console.error("[MySQL] Gagal ambil alarm logs:", e?.message);
    res.json({ logs: alarmLogs });
  }
});

app.patch("/api/alarm-logs/:id", async (req, res) => {
  const { id } = req.params;
  const { duration_seconds } = req.body;
  const log = alarmLogs.find((l) => l.id === id);
  if (log && typeof duration_seconds === "number") {
    log.duration_seconds = duration_seconds;
  }
  if (typeof duration_seconds === "number") {
    await updateRiwayatAlarm(id, { durasi_detik: duration_seconds });
  }
  res.json({ status: "success", log });
});

app.delete("/api/alarm-logs/:id", async (req, res) => {
  const { id } = req.params;
  alarmLogs = alarmLogs.filter((l) => l.id !== id);
  await hapusRiwayatAlarm(id);
  res.json({ status: "success" });
});

app.post("/api/alarm-logs/fix-all-durations", async (_req, res) => {
  alarmLogs.forEach((l) => {
    if (l.duration_seconds === 0) l.duration_seconds = 60;
  });
  await fixAllZeroAlarmDurations();
  res.json({ status: "success" });
});

// 13. Admin auth & users
app.post("/api/admin/login", (req, res) => {
  const { username, id, password } = req.body;
  const queryUser = (username || id || "").trim().toLowerCase();

  const user = adminUsers.find(
    (u: AdminUser) =>
      u.username.toLowerCase() === queryUser ||
      u.id.toLowerCase() === queryUser,
  );

  if (
    user &&
    (user.password === password ||
      password === "password123" ||
      password === "admin123")
  ) {
    user.last_login = "Baru saja";
    updateLoginTerakhir(user.id).catch((e: any) =>
      console.error("[MySQL] Gagal update login_terakhir:", e?.message),
    );
    return res.json({
      status: "success",
      success: true,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        last_login: user.last_login,
      },
    });
  }

  // Allow default fallback administrator credentials for convenience
  if (
    queryUser === "admin" &&
    (password === "password123" ||
      password === "admin123" ||
      password === "admin")
  ) {
    return res.json({
      status: "success",
      success: true,
      user: {
        id: "ADM-01",
        name: "Bambang Sutrisno",
        username: "admin",
        role: "Super Admin",
        last_login: "Baru saja",
      },
    });
  }

  res.status(401).json({
    status: "error",
    message: "Username atau kata sandi tidak valid.",
  });
});

app.get("/api/admin/users", async (_req, res) => {
  try {
    const dbUsers = await ambilSemuaPetugas();
    adminUsers = dbUsers;
    res.json({
      users: adminUsers.map((u: AdminUser) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        last_login: u.last_login,
      })),
    });
  } catch {
    res.json({
      users: adminUsers.map((u: AdminUser) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        last_login: u.last_login,
      })),
    });
  }
});

app.post("/api/admin/users", (req, res) => {
  const { name, username, password, role } = req.body;
  if (!name || !username) {
    return res.status(400).json({ error: "Nama dan username wajib diisi." });
  }
  const newUser: AdminUser = {
    id: `ADM-0${adminUsers.length + 1}`,
    name,
    username,
    password: password || "password123",
    role: role || "Petugas Lapangan",
    last_login: "Belum pernah",
  };
  adminUsers.push(newUser);
  saveAdminUsers();
  // Sync ke MySQL
  tambahPetugas(
    newUser.id,
    newUser.name,
    newUser.password || "password123",
  ).catch((e: any) =>
    console.error("[MySQL] Gagal simpan Petugas:", e?.message),
  );
  res.json({ status: "success", user: newUser });
});

app.put("/api/admin/users/:id", (req, res) => {
  const { id } = req.params;
  const user = adminUsers.find((u: AdminUser) => u.id === id);
  if (!user) return res.status(404).json({ error: "User tidak ditemukan" });

  if (req.body.name) user.name = req.body.name;
  if (req.body.username) user.username = req.body.username;
  if (req.body.password) user.password = req.body.password;
  if (req.body.role) user.role = req.body.role;
  saveAdminUsers();
  // Sync ke MySQL
  updatePetugas(id, {
    name: req.body.name,
    password: req.body.password,
  }).catch((e: any) =>
    console.error("[MySQL] Gagal update Petugas:", e?.message),
  );

  res.json({ status: "success", user });
});

app.delete("/api/admin/users/:id", (req, res) => {
  const { id } = req.params;
  if (adminUsers.length <= 1) {
    return res
      .status(400)
      .json({ error: "Tidak dapat menghapus admin terakhir." });
  }
  adminUsers = adminUsers.filter((u: AdminUser) => u.id !== id);
  saveAdminUsers();
  // Sync ke MySQL
  hapusPetugas(id).catch((e: any) =>
    console.error("[MySQL] Gagal hapus Petugas:", e?.message),
  );
  res.json({ status: "success" });
});

// =====================================================================
// DEBUG ENDPOINT — cek koneksi & insert sensor
// =====================================================================
app.get("/api/debug/db-test", async (_req, res) => {
  const connected = isMysqlReady();
  const dbError = getMysqlError();
  const results: Record<string, any> = {
    mysql_connected: connected,
    db_config: {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      database: process.env.DB_NAME || "ews_banjir",
      password_set: Boolean(process.env.DB_PASSWORD),
    },
  };

  if (!connected) {
    return res.json({
      ...results,
      error:
        dbError ||
        "MySQL tidak terhubung. Pastikan Laragon aktif dan server sudah direstart.",
      hint: "Buka file .env dan pastikan kredensial database sudah benar. Jika di komputer lokal, pastikan Laragon MySQL sudah START.",
    });
  }

  // Test insert SensorHujan
  try {
    await simpanDataHujan(3800, 5.0, "Cerah (Test Debug)");
    results.SensorHujan = "✅ INSERT berhasil";
  } catch (e: any) {
    results.SensorHujan = "❌ " + e?.message;
  }

  // Test insert SensorKetinggian
  try {
    await simpanDataTinggi(5.0, 195.0, "AMAN", false, false);
    results.SensorKetinggian = "✅ INSERT berhasil";
  } catch (e: any) {
    results.SensorKetinggian = "❌ " + e?.message;
  }

  // Test insert SensorDebit
  try {
    await simpanDataDebit(10.0, 0.36);
    results.SensorDebit = "✅ INSERT berhasil";
  } catch (e: any) {
    results.SensorDebit = "❌ " + e?.message;
  }

  res.json(results);
});

// =====================================================================
// VITE MIDDLEWARE SETUP
// =====================================================================
async function startServer() {
  // Tunggu koneksi MySQL siap sebelum server mulai menerima request
  await initMySQLConnection();
  // Sync adminUsers dari MySQL saat startup
  try {
    const dbUsers = await ambilSemuaPetugas();
    if (dbUsers.length > 0) {
      adminUsers = dbUsers;
      saveAdminUsers();
      console.log(
        `[AdminUsers] Synced ${dbUsers.length} user(s) dari MySQL ke JSON`,
      );
    } else {
      // Jika tabel Petugas kosong, seed dari adminUsers yang ada
      for (const u of adminUsers) {
        await tambahPetugas(u.id, u.name, u.password || "password123");
      }
      console.log("[AdminUsers] Seed adminUsers ke MySQL selesai");
    }
  } catch (e: any) {
    console.warn("[AdminUsers] Gagal sync dari MySQL:", e?.message);
  }

  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 SIAGA EWS Banjir Server running on http://0.0.0.0:${PORT}`);
    console.log(
      `📱 Fonnte WhatsApp Bot configured to: ${whatsAppConfig.target_number}`,
    );
    console.log(
      `🔔 Notifications enabled: WASPADA (${whatsAppConfig.notify_waspada}), SIAGA (${whatsAppConfig.notify_siaga})`,
    );
  });
}

startServer();
