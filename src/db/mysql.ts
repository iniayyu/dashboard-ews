/**
 * Database Service — MySQL with In-Memory Mock Fallback for AI Studio
 * Persists data to MySQL if connected, otherwise falls back gracefully
 * to an in-memory mock store so the application runs without external dependencies.
 */

import "dotenv/config";
import {
  WarningLevel,
  ThresholdSettings,
  AlarmLog,
  FloodEvent,
  HistoryPoint,
} from "../types";

// =====================================================================
// KONEKSI MYSQL POOL
// =====================================================================
let mysqlPool: any = null;
let isMysqlConnected = false;

function getWaktuTanggalNow() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const waktu_catat = `${hh}:${mm}:${ss}`; // selalu HH:MM:SS
  const tanggal_catat = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; // YYYY-MM-DD
  return { waktu_catat, tanggal_catat };
}

// In-Memory Mock Storage (active when external MySQL is unavailable)
const mockStore = {
  tinggi: [
    {
      id: 1,
      tinggi_air: 2.5,
      jarak_sensor: 17.5,
      status_level: "AMAN",
      status_relay: 0,
      status_buzzer: 0,
      waktu_catat: "07:00:00",
      tanggal_catat: new Date().toISOString().slice(0, 10),
    },
    {
      id: 2,
      tinggi_air: 4.8,
      jarak_sensor: 15.2,
      status_level: "WASPADA",
      status_relay: 0,
      status_buzzer: 0,
      waktu_catat: "08:30:00",
      tanggal_catat: new Date().toISOString().slice(0, 10),
    },
  ] as any[],
  debit: [
    {
      id: 1,
      debit_air: 12.0,
      kecepatan_arus: 0.42,
      waktu_catat: "07:00:00",
      tanggal_catat: new Date().toISOString().slice(0, 10),
    },
    {
      id: 2,
      debit_air: 34.0,
      kecepatan_arus: 1.21,
      waktu_catat: "08:30:00",
      tanggal_catat: new Date().toISOString().slice(0, 10),
    },
  ] as any[],
  hujan: [
    {
      id: 1,
      nilai_hujan: 3800,
      persen_hujan: 10.0,
      kondisi_cuaca: "Cerah Berawan",
      waktu_catat: "07:00:00",
      tanggal_catat: new Date().toISOString().slice(0, 10),
    },
    {
      id: 2,
      nilai_hujan: 1800,
      persen_hujan: 55.0,
      kondisi_cuaca: "Hujan Sedang",
      waktu_catat: "08:30:00",
      tanggal_catat: new Date().toISOString().slice(0, 10),
    },
  ] as any[],
  batas: {
    sensor_mount_height_cm: 20,
    level_aman_max: 3,
    level_waspada_max: 6,
    level_siaga_max: 10,
    level_bahaya_min: 10,
    flow_warning_lpm: 45.0,
    rain_heavy_pct: 65.0,
    auto_relay_enabled: true,
    auto_buzzer_enabled: true,
  } as ThresholdSettings,
  alarm: [
    {
      id_alarm: "ALM-101",
      waktu_bunyi: "03:18:00",
      tanggal_bunyi: new Date().toISOString().slice(0, 10),
      status_level: "SIAGA" as WarningLevel,
      alasan_pemicu: "Ketinggian air melampaui batas Siaga (> 6 cm)",
      dihentikan_oleh: "Otomatis (Sistem)",
      durasi_detik: 45,
    },
  ] as any[],
  petugas: [
    {
      id_petugas: "ADM-01",
      nama_lengkap: "Bambang Sutrisno",
      password: "password123",
      login_terakhir: "Baru saja",
    },
    {
      id_petugas: "ADM-02",
      nama_lengkap: "Rudi Hermawan",
      password: "password123",
      login_terakhir: "Kemarin",
    },
  ] as any[],
};

let lastMysqlError = "";
let lastConnectAttempt = 0;

export function getMysqlError(): string {
  return lastMysqlError;
}

export async function ensureMySQLConnection(): Promise<boolean> {
  if (isMysqlReady()) return true;
  // Coba reconnect maksimal setiap 4 detik jika sebelumnya gagal
  if (Date.now() - lastConnectAttempt < 4000) return false;
  lastConnectAttempt = Date.now();
  return await initMySQLConnection();
}

export async function initMySQLConnection(): Promise<boolean> {
  const configuredHost = process.env.DB_HOST || "127.0.0.1";
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME || "ews_banjir";

  const mysqlModule = await import("mysql2/promise" as any).catch(() => null);
  if (!mysqlModule) {
    lastMysqlError = "Paket 'mysql2' tidak ditemukan.";
    console.warn(
      "[MySQL] Paket 'mysql2' tidak ditemukan. Menggunakan fallback in-memory.",
    );
    isMysqlConnected = false;
    return false;
  }

  const mysql = mysqlModule.default || mysqlModule;
  // Di Node.js 18+/22 (Windows), "localhost" sering resolve ke ::1 (IPv6) sedangkan Laragon/XAMPP listen di 127.0.0.1 (IPv4)
  const hostsToTry =
    configuredHost === "localhost"
      ? ["127.0.0.1", "localhost"]
      : [configuredHost];

  for (const host of hostsToTry) {
    try {
      const pool = mysql.createPool({
        host,
        port,
        user,
        password,
        database,
        dateStrings: true,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
        connectTimeout: 5000,
      });

      // Test koneksi
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();

      mysqlPool = pool;
      isMysqlConnected = true;
      lastMysqlError = "";
      console.log(`\n✅ [MySQL] Terhubung ke ${host}:${port}/${database}\n`);
      return true;
    } catch (err: any) {
      lastMysqlError = err?.message || "Gagal menghubungi host MySQL";
    }
  }

  console.warn(
    `[MySQL] Belum terhubung (${lastMysqlError}). Menggunakan mode in-memory sementara.`,
  );
  isMysqlConnected = false;
  mysqlPool = null;
  return false;
}

/** Helper: jalankan query MySQL, fallback ke null jika tidak konek */
async function query(sql: string, params: any[] = []): Promise<any> {
  await ensureMySQLConnection();
  if (!mysqlPool || !isMysqlConnected) {
    return null;
  }
  try {
    const [rows] = await mysqlPool.query(sql, params);
    return rows;
  } catch (err: any) {
    console.error(`[MySQL] Query error: ${err?.message}`);
    if (
      err?.code === "PROTOCOL_CONNECTION_LOST" ||
      err?.code === "ECONNREFUSED" ||
      err?.code === "ECONNRESET"
    ) {
      isMysqlConnected = false;
      mysqlPool = null;
    }
    throw err;
  }
}

export function isMysqlReady(): boolean {
  return isMysqlConnected && mysqlPool !== null;
}

// =====================================================================
// SensorKetinggian
// =====================================================================
export async function simpanDataTinggi(
  tinggi: number,
  jarak: number,
  level: "AMAN" | "WASPADA" | "SIAGA",
  relay: boolean,
  buzzer: boolean,
): Promise<number> {
  const { waktu_catat, tanggal_catat } = getWaktuTanggalNow();
  await ensureMySQLConnection();
  if (isMysqlReady()) {
    try {
      const result = await query(
        `INSERT INTO SensorKetinggian (tinggi_air, jarak_sensor, status_level, status_relay, status_buzzer, waktu_catat, tanggal_catat)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tinggi,
          jarak,
          level,
          relay ? 1 : 0,
          buzzer ? 1 : 0,
          waktu_catat,
          tanggal_catat,
        ],
      );
      const insertId = Number(result?.insertId || 0);
      console.log(
        `[MySQL] ✅ SensorKetinggian saved (ID:${insertId}): tinggi=${tinggi}, level=${level}`,
      );
      return insertId;
    } catch (e: any) {
      console.warn(
        `[MySQL] Gagal simpan tinggi, menyimpan ke memory: ${e?.message}`,
      );
    }
  }

  const nextId = (mockStore.tinggi[mockStore.tinggi.length - 1]?.id || 0) + 1;
  mockStore.tinggi.push({
    id: nextId,
    tinggi_air: tinggi,
    jarak_sensor: jarak,
    status_level: level,
    status_relay: relay ? 1 : 0,
    status_buzzer: buzzer ? 1 : 0,
    waktu_catat,
    tanggal_catat,
  });
  if (mockStore.tinggi.length > 100) mockStore.tinggi.shift();
  console.log(
    `[Memory] ✅ SensorKetinggian saved: tinggi=${tinggi}, level=${level}`,
  );
  return 0;
}

export async function ambilTinggiTerbaru(): Promise<any> {
  if (isMysqlReady()) {
    try {
      const rows = await query(
        "SELECT * FROM SensorKetinggian ORDER BY id DESC LIMIT 1",
      );
      if (rows && rows[0]) return rows[0];
    } catch {}
  }
  return mockStore.tinggi[mockStore.tinggi.length - 1] ?? null;
}

export async function ambilGrafikTinggi(limit = 24): Promise<any[]> {
  if (isMysqlReady()) {
    try {
      const rows = await query(
        `SELECT id, tinggi_air, jarak_sensor, status_level, status_relay, status_buzzer, waktu_catat, tanggal_catat
         FROM SensorKetinggian ORDER BY id DESC LIMIT ?`,
        [limit],
      );
      if (rows) return (rows as any[]).reverse();
    } catch {}
  }
  return mockStore.tinggi.slice(-limit);
}

// =====================================================================
// SensorDebit
// =====================================================================
export async function simpanDataDebit(
  debit: number,
  kecepatan: number,
): Promise<number> {
  const { waktu_catat, tanggal_catat } = getWaktuTanggalNow();
  await ensureMySQLConnection();
  if (isMysqlReady()) {
    try {
      const result = await query(
        `INSERT INTO SensorDebit (debit_air, kecepatan_arus, waktu_catat, tanggal_catat)
         VALUES (?, ?, ?, ?)`,
        [debit, kecepatan, waktu_catat, tanggal_catat],
      );
      const insertId = Number(result?.insertId || 0);
      console.log(
        `[MySQL] ✅ SensorDebit saved (ID:${insertId}): debit=${debit}`,
      );
      return insertId;
    } catch (e: any) {
      console.warn(
        `[MySQL] Gagal simpan debit, menyimpan ke memory: ${e?.message}`,
      );
    }
  }

  const nextId = (mockStore.debit[mockStore.debit.length - 1]?.id || 0) + 1;
  mockStore.debit.push({
    id: nextId,
    debit_air: debit,
    kecepatan_arus: kecepatan,
    waktu_catat,
    tanggal_catat,
  });
  if (mockStore.debit.length > 100) mockStore.debit.shift();
  console.log(`[Memory] ✅ SensorDebit saved: debit=${debit}`);
  return 0;
}

export async function ambilDebitTerbaru(): Promise<any> {
  if (isMysqlReady()) {
    try {
      const rows = await query(
        "SELECT * FROM SensorDebit ORDER BY id DESC LIMIT 1",
      );
      if (rows && rows[0]) return rows[0];
    } catch {}
  }
  return mockStore.debit[mockStore.debit.length - 1] ?? null;
}

export async function ambilGrafikDebit(limit = 24): Promise<any[]> {
  if (isMysqlReady()) {
    try {
      const rows = await query(
        `SELECT id, debit_air, kecepatan_arus, waktu_catat, tanggal_catat
         FROM SensorDebit ORDER BY id DESC LIMIT ?`,
        [limit],
      );
      if (rows) return (rows as any[]).reverse();
    } catch {}
  }
  return mockStore.debit.slice(-limit);
}

// =====================================================================
// SensorHujan
// =====================================================================
export async function simpanDataHujan(
  nilaiHujan: number,
  persenHujan: number,
  kondisiCuaca: string,
): Promise<number> {
  const { waktu_catat, tanggal_catat } = getWaktuTanggalNow();
  await ensureMySQLConnection();
  if (isMysqlReady()) {
    try {
      const result = await query(
        `INSERT INTO SensorHujan (nilai_hujan, persen_hujan, kondisi_cuaca, waktu_catat, tanggal_catat)
         VALUES (?, ?, ?, ?, ?)`,
        [nilaiHujan, persenHujan, kondisiCuaca, waktu_catat, tanggal_catat],
      );
      const insertId = Number(result?.insertId || 0);
      console.log(
        `[MySQL] ✅ SensorHujan saved (ID:${insertId}): nilai=${nilaiHujan}, persen=${persenHujan}%, cuaca=${kondisiCuaca}`,
      );
      return insertId;
    } catch (e: any) {
      console.warn(
        `[MySQL] Gagal simpan hujan, menyimpan ke memory: ${e?.message}`,
      );
    }
  }

  const nextId = (mockStore.hujan[mockStore.hujan.length - 1]?.id || 0) + 1;
  mockStore.hujan.push({
    id: nextId,
    nilai_hujan: nilaiHujan,
    persen_hujan: persenHujan,
    kondisi_cuaca: kondisiCuaca,
    waktu_catat,
    tanggal_catat,
  });
  if (mockStore.hujan.length > 100) mockStore.hujan.shift();
  console.log(
    `[Memory] ✅ SensorHujan saved: nilai=${nilaiHujan}, persen=${persenHujan}%, cuaca=${kondisiCuaca}`,
  );
  return 0;
}

export async function ambilHujanTerbaru(): Promise<any> {
  if (isMysqlReady()) {
    try {
      const rows = await query(
        "SELECT * FROM SensorHujan ORDER BY id DESC LIMIT 1",
      );
      if (rows && rows[0]) return rows[0];
    } catch {}
  }
  return mockStore.hujan[mockStore.hujan.length - 1] ?? null;
}

export async function ambilGrafikHujan(limit = 24): Promise<any[]> {
  if (isMysqlReady()) {
    try {
      const rows = await query(
        `SELECT id, nilai_hujan, persen_hujan, kondisi_cuaca, waktu_catat, tanggal_catat
         FROM SensorHujan ORDER BY id DESC LIMIT ?`,
        [limit],
      );
      if (rows) return (rows as any[]).reverse();
    } catch {}
  }
  return mockStore.hujan.slice(-limit);
}

// =====================================================================
// AmbangBatas
// =====================================================================
export async function ambilDataBatas(): Promise<ThresholdSettings> {
  if (isMysqlReady()) {
    try {
      const rows = await query("SELECT * FROM AmbangBatas WHERE id = 1");
      const row = rows?.[0];
      if (row) {
        return {
          sensor_mount_height_cm: Number(row.tinggi_tiang ?? 20),
          level_aman_max: Number(row.batas_aman ?? 3),
          level_waspada_max: Number(row.batas_waspada ?? 6),
          level_siaga_max: Number(row.batas_siaga ?? 10),
          level_bahaya_min: Number(row.batas_siaga ?? 10),
          flow_warning_lpm: Number(row.batas_debit ?? 45),
          rain_heavy_pct: Number(row.batas_hujan ?? 65),
          auto_relay_enabled: Boolean(row.otomatis_relay),
          auto_buzzer_enabled: Boolean(row.otomatis_buzzer),
        };
      }
    } catch {}
  }
  return mockStore.batas;
}

export async function ubahBatas(
  s: Partial<ThresholdSettings>,
): Promise<boolean> {
  mockStore.batas = { ...mockStore.batas, ...s };
  if (isMysqlReady()) {
    try {
      const next = mockStore.batas;
      await query(
        `UPDATE AmbangBatas SET
           tinggi_tiang = ?, batas_aman = ?, batas_waspada = ?, batas_siaga = ?,
           batas_debit = ?, batas_hujan = ?, otomatis_relay = ?, otomatis_buzzer = ?,
           diperbarui_pada = NOW()
         WHERE id = 1`,
        [
          next.sensor_mount_height_cm,
          next.level_aman_max,
          next.level_waspada_max,
          next.level_siaga_max,
          next.flow_warning_lpm,
          next.rain_heavy_pct,
          next.auto_relay_enabled ? 1 : 0,
          next.auto_buzzer_enabled ? 1 : 0,
        ],
      );
    } catch (e: any) {
      console.warn(`[MySQL] Gagal update AmbangBatas: ${e?.message}`);
    }
  }
  return true;
}

// =====================================================================
// RiwayatAlarm
// =====================================================================
export async function catatAlarm(
  level: WarningLevel,
  alasan: string,
  stoppedBy = "Otomatis",
  durasi = 0,
): Promise<string> {
  const id = `ALM-${Date.now()}`;
  const { waktu_catat, tanggal_catat } = getWaktuTanggalNow();

  if (isMysqlReady()) {
    try {
      await query(
        `INSERT INTO RiwayatAlarm (id_alarm, waktu_bunyi, tanggal_bunyi, status_level, alasan_pemicu, dihentikan_oleh, durasi_detik)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, waktu_catat, tanggal_catat, level, alasan, stoppedBy, durasi],
      );
      console.log(`✅ [MySQL] RiwayatAlarm (${id}) dicatat.`);
      return id;
    } catch (e: any) {
      console.warn(`[MySQL] Gagal simpan RiwayatAlarm: ${e?.message}`);
    }
  }

  mockStore.alarm.unshift({
    id_alarm: id,
    waktu_bunyi: waktu_catat,
    tanggal_bunyi: tanggal_catat,
    status_level: level,
    alasan_pemicu: alasan,
    dihentikan_oleh: stoppedBy,
    durasi_detik: durasi,
  });
  if (mockStore.alarm.length > 50) mockStore.alarm.pop();
  console.log(`✅ [Memory] RiwayatAlarm (${id}) dicatat.`);
  return id;
}

export async function ambilRiwayatAlarm(): Promise<AlarmLog[]> {
  if (isMysqlReady()) {
    try {
      const rows = await query(
        `SELECT id_alarm, waktu_bunyi, tanggal_bunyi, status_level, alasan_pemicu, durasi_detik, dihentikan_oleh
         FROM RiwayatAlarm ORDER BY tanggal_bunyi DESC, waktu_bunyi DESC, id_alarm DESC LIMIT 50`,
      );
      if (rows && Array.isArray(rows)) {
        return (rows as any[]).map((r) => ({
          id: r.id_alarm,
          timestamp:
            `${r.tanggal_bunyi || ""} ${r.waktu_bunyi || ""}`.trim() ||
            "Hari ini",
          level: r.status_level as WarningLevel,
          trigger_reason: r.alasan_pemicu,
          stopped_by: r.dihentikan_oleh || "Otomatis",
          duration_seconds: Number(r.durasi_detik ?? 0),
        }));
      }
    } catch {}
  }

  return mockStore.alarm.map((r) => ({
    id: r.id_alarm,
    timestamp:
      `${r.tanggal_bunyi || ""} ${r.waktu_bunyi || ""}`.trim() || "Hari ini",
    level: r.status_level as WarningLevel,
    trigger_reason: r.alasan_pemicu,
    stopped_by: r.dihentikan_oleh || "Otomatis",
    duration_seconds: Number(r.durasi_detik ?? 0),
  }));
}

export async function updateRiwayatAlarm(
  id: string,
  fields: { durasi_detik?: number; dihentikan_oleh?: string },
): Promise<boolean> {
  const mem = mockStore.alarm.find((a) => a.id_alarm === id);
  if (mem) {
    if (typeof fields.durasi_detik === "number")
      mem.durasi_detik = fields.durasi_detik;
    if (fields.dihentikan_oleh !== undefined)
      mem.dihentikan_oleh = fields.dihentikan_oleh;
  }

  if (isMysqlReady()) {
    try {
      const sets: string[] = [];
      const params: any[] = [];
      if (typeof fields.durasi_detik === "number") {
        sets.push("durasi_detik = ?");
        params.push(fields.durasi_detik);
      }
      if (fields.dihentikan_oleh !== undefined) {
        sets.push("dihentikan_oleh = ?");
        params.push(fields.dihentikan_oleh);
      }
      if (sets.length > 0) {
        params.push(id);
        await query(
          `UPDATE RiwayatAlarm SET ${sets.join(", ")} WHERE id_alarm = ?`,
          params,
        );
        console.log(`✅ [MySQL] RiwayatAlarm (${id}) diperbarui:`, fields);
      }
      return true;
    } catch (e: any) {
      console.warn(`[MySQL] Gagal update RiwayatAlarm: ${e?.message}`);
    }
  }
  return Boolean(mem);
}

export async function hapusRiwayatAlarm(id: string): Promise<boolean> {
  mockStore.alarm = mockStore.alarm.filter((a) => a.id_alarm !== id);
  if (isMysqlReady()) {
    try {
      await query(`DELETE FROM RiwayatAlarm WHERE id_alarm = ?`, [id]);
      console.log(`✅ [MySQL] RiwayatAlarm (${id}) dihapus.`);
      return true;
    } catch (e: any) {
      console.warn(`[MySQL] Gagal hapus RiwayatAlarm: ${e?.message}`);
    }
  }
  return true;
}

export async function fixAllZeroAlarmDurations(): Promise<boolean> {
  mockStore.alarm.forEach((a) => {
    if (Number(a.durasi_detik ?? 0) === 0) a.durasi_detik = 60;
  });
  if (isMysqlReady()) {
    try {
      await query(
        `UPDATE RiwayatAlarm SET durasi_detik = 60 WHERE durasi_detik = 0 OR durasi_detik IS NULL`,
      );
      return true;
    } catch (e: any) {
      console.warn(`[MySQL] Gagal perbaiki durasi alarm: ${e?.message}`);
    }
  }
  return true;
}

// =====================================================================
// Riwayat Kejadian (dihasilkan otomatis dari data SensorKetinggian & SensorDebit)
// =====================================================================
function formatTanggalIndo(tanggalStr: string, waktuStr: string): string {
  try {
    const [y, m, d] = String(tanggalStr).slice(0, 10).split("-").map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      const tgl = dt.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      return `${tgl} ${String(waktuStr || "").slice(0, 8)} WIB`.trim();
    }
  } catch {}
  return `${tanggalStr} ${waktuStr}`.trim();
}

function toEpochMs(tanggalStr: string, waktuStr: string): number {
  const iso = `${String(tanggalStr).slice(0, 10)}T${String(waktuStr || "00:00:00").slice(0, 8)}`;
  const t = Date.parse(iso);
  return isNaN(t) ? 0 : t;
}

export async function ambilRiwayatKejadian(limit = 20): Promise<FloodEvent[]> {
  if (!isMysqlReady()) return [];
  try {
    const [tinggiRows, debitRows] = await Promise.all([
      query(
        `SELECT id, tinggi_air, status_level, waktu_catat, tanggal_catat
         FROM SensorKetinggian
         ORDER BY id DESC LIMIT 400`,
      ),
      query(
        `SELECT id, debit_air, waktu_catat, tanggal_catat
         FROM SensorDebit
         ORDER BY id DESC LIMIT 400`,
      ),
    ]);

    if (!Array.isArray(tinggiRows) || tinggiRows.length === 0) {
      return [];
    }

    const debits = Array.isArray(debitRows) ? debitRows : [];
    const debitAt = (tanggal: string, waktu: string): number => {
      const targetMs = toEpochMs(tanggal, waktu);
      let best = 0;
      let bestDiff = Infinity;
      for (const d of debits) {
        if (
          String(d.tanggal_catat).slice(0, 10) !== String(tanggal).slice(0, 10)
        )
          continue;
        const diff = Math.abs(
          toEpochMs(d.tanggal_catat, d.waktu_catat) - targetMs,
        );
        if (diff < bestDiff && diff <= 15000) {
          bestDiff = diff;
          best = Number(d.debit_air ?? 0);
        }
      }
      return best;
    };

    const events: FloodEvent[] = [];
    let currentGroup: {
      latestRow: any;
      earliestRow: any;
      peakWater: number;
      peakFlow: number;
      maxLevel: WarningLevel;
    } | null = null;

    const flushGroup = () => {
      if (!currentGroup || events.length >= limit) return;
      const sTgl = String(currentGroup.latestRow.tanggal_catat).slice(0, 10);
      const sWkt = String(currentGroup.latestRow.waktu_catat).slice(0, 8);
      events.push({
        id: `FL-${sTgl.replace(/-/g, "")}-${currentGroup.latestRow.id}`,
        start_time: formatTanggalIndo(sTgl, sWkt),
        peak_water_level_cm: +currentGroup.peakWater.toFixed(1),
        peak_flow_rate_lpm: +currentGroup.peakFlow.toFixed(1),
        max_warning_level: currentGroup.maxLevel,
        cause: `Sensor ketinggian air mencapai ${currentGroup.peakWater.toFixed(1)} cm`,
        action_notes:
          currentGroup.maxLevel === "SIAGA"
            ? "Sirine & pompa siaga aktif, notifikasi darurat dikirim."
            : "Peringatan waspada dikirim ke grup warga.",
      });
      currentGroup = null;
    };

    for (const row of tinggiRows) {
      const rawStatus = String(row.status_level || "AMAN").toUpperCase();
      if (
        rawStatus !== "WASPADA" &&
        rawStatus !== "SIAGA" &&
        rawStatus !== "BAHAYA"
      ) {
        // Status AMAN memisahkan kejadian sebelumnya dan berikutnya
        flushGroup();
        if (events.length >= limit) break;
        continue;
      }

      const tgl = String(row.tanggal_catat).slice(0, 10);
      const wkt = String(row.waktu_catat).slice(0, 8);
      const rowMs = toEpochMs(tgl, wkt);
      const water = Number(row.tinggi_air ?? 0);
      const flow = debitAt(tgl, wkt);
      const lvl = (
        rawStatus === "WASPADA" ? "WASPADA" : "SIAGA"
      ) as WarningLevel;

      if (!currentGroup) {
        currentGroup = {
          latestRow: row,
          earliestRow: row,
          peakWater: water,
          peakFlow: flow,
          maxLevel: lvl,
        };
      } else {
        const prevMs = toEpochMs(
          String(currentGroup.earliestRow.tanggal_catat).slice(0, 10),
          String(currentGroup.earliestRow.waktu_catat).slice(0, 8),
        );
        if (
          currentGroup.maxLevel === lvl &&
          Math.abs(prevMs - rowMs) <= 3 * 60 * 1000
        ) {
          currentGroup.earliestRow = row;
          currentGroup.peakWater = Math.max(currentGroup.peakWater, water);
          currentGroup.peakFlow = Math.max(currentGroup.peakFlow, flow);
        } else {
          flushGroup();
          if (events.length >= limit) break;
          currentGroup = {
            latestRow: row,
            earliestRow: row,
            peakWater: water,
            peakFlow: flow,
            maxLevel: lvl,
          };
        }
      }
    }

    flushGroup();
    return events;
  } catch (e: any) {
    console.warn("[MySQL] Gagal ambil riwayat kejadian:", e?.message);
    return [];
  }
}

export async function ambilRiwayatGrafik(limit = 30): Promise<HistoryPoint[]> {
  if (!isMysqlReady()) return [];
  try {
    const [tinggiRows, debitRows, hujanRows] = await Promise.all([
      query(
        `SELECT id, tinggi_air, status_level, waktu_catat, tanggal_catat
         FROM SensorKetinggian ORDER BY id DESC LIMIT ?`,
        [limit],
      ),
      query(
        `SELECT id, debit_air, waktu_catat, tanggal_catat
         FROM SensorDebit ORDER BY id DESC LIMIT ?`,
        [limit],
      ),
      query(
        `SELECT id, persen_hujan, waktu_catat, tanggal_catat
         FROM SensorHujan ORDER BY id DESC LIMIT ?`,
        [limit],
      ),
    ]);

    if (!Array.isArray(tinggiRows) || tinggiRows.length === 0) return [];

    const orderedTinggi = [...tinggiRows].reverse();
    const orderedDebit = Array.isArray(debitRows)
      ? [...debitRows].reverse()
      : [];
    const orderedHujan = Array.isArray(hujanRows)
      ? [...hujanRows].reverse()
      : [];

    return orderedTinggi.map((t: any, idx: number) => ({
      time: String(t.waktu_catat || "").slice(0, 5),
      water_level: Number(t.tinggi_air ?? 0),
      flow_rate: Number(orderedDebit[idx]?.debit_air ?? 0),
      rain_pct: Number(orderedHujan[idx]?.persen_hujan ?? 0),
      level: (t.status_level || "AMAN") as WarningLevel,
    }));
  } catch {
    return [];
  }
}

// =====================================================================
// Petugas (Admin Users) — sync dengan tabel MySQL / mock
// =====================================================================

export async function ambilSemuaPetugas(): Promise<any[]> {
  if (isMysqlReady()) {
    try {
      const rows = await query(
        `SELECT id_petugas, nama_lengkap, password, login_terakhir FROM Petugas ORDER BY id_petugas`,
      );
      if (rows && Array.isArray(rows) && rows.length > 0) {
        return (rows as any[]).map((r) => ({
          id: r.id_petugas,
          name: r.nama_lengkap,
          username: r.id_petugas.toLowerCase().replace("-", ""),
          role: "Petugas Lapangan",
          password: r.password,
          last_login: r.login_terakhir || "Belum pernah",
        }));
      }
    } catch {}
  }

  return mockStore.petugas.map((r) => ({
    id: r.id_petugas,
    name: r.nama_lengkap,
    username: r.id_petugas.toLowerCase().replace("-", ""),
    role: "Petugas Lapangan",
    password: r.password,
    last_login: r.login_terakhir || "Belum pernah",
  }));
}

export async function tambahPetugas(
  id: string,
  name: string,
  password: string,
): Promise<void> {
  const existing = mockStore.petugas.find((p) => p.id_petugas === id);
  if (existing) {
    existing.nama_lengkap = name;
    existing.password = password;
  } else {
    mockStore.petugas.push({
      id_petugas: id,
      nama_lengkap: name,
      password: password,
      login_terakhir: "Belum pernah",
    });
  }

  if (isMysqlReady()) {
    try {
      await query(
        `INSERT INTO Petugas (id_petugas, nama_lengkap, password, login_terakhir)
         VALUES (?, ?, ?, 'Belum pernah')
         ON DUPLICATE KEY UPDATE
           nama_lengkap = VALUES(nama_lengkap),
           password     = VALUES(password)`,
        [id, name, password],
      );
      console.log(`✅ [MySQL] Petugas (${id}) disimpan.`);
    } catch (e: any) {
      console.warn(`[MySQL] Gagal simpan Petugas: ${e?.message}`);
    }
  }
}

export async function updatePetugas(
  id: string,
  fields: { name?: string; password?: string; last_login?: string },
): Promise<void> {
  const user = mockStore.petugas.find((p) => p.id_petugas === id);
  if (user) {
    if (fields.name) user.nama_lengkap = fields.name;
    if (fields.password) user.password = fields.password;
    if (fields.last_login) user.login_terakhir = fields.last_login;
  }

  if (isMysqlReady()) {
    try {
      const setClauses: string[] = [];
      const params: any[] = [];
      if (fields.name) {
        setClauses.push("nama_lengkap = ?");
        params.push(fields.name);
      }
      if (fields.password) {
        setClauses.push("password = ?");
        params.push(fields.password);
      }
      if (fields.last_login) {
        setClauses.push("login_terakhir = ?");
        params.push(fields.last_login);
      }
      if (setClauses.length > 0) {
        params.push(id);
        await query(
          `UPDATE Petugas SET ${setClauses.join(", ")} WHERE id_petugas = ?`,
          params,
        );
        console.log(`✅ [MySQL] Petugas (${id}) diperbarui.`);
      }
    } catch (e: any) {
      console.warn(`[MySQL] Gagal update Petugas: ${e?.message}`);
    }
  }
}

export async function hapusPetugas(id: string): Promise<void> {
  mockStore.petugas = mockStore.petugas.filter((p) => p.id_petugas !== id);
  if (isMysqlReady()) {
    try {
      await query(`DELETE FROM Petugas WHERE id_petugas = ?`, [id]);
      console.log(`✅ [MySQL] Petugas (${id}) dihapus.`);
    } catch (e: any) {
      console.warn(`[MySQL] Gagal hapus Petugas: ${e?.message}`);
    }
  }
}

export async function updateLoginTerakhir(id: string): Promise<void> {
  const now = new Date();
  const waktu = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const user = mockStore.petugas.find((p) => p.id_petugas === id);
  if (user) user.login_terakhir = waktu;

  if (isMysqlReady()) {
    try {
      await query(
        `UPDATE Petugas SET login_terakhir = ? WHERE id_petugas = ?`,
        [waktu, id],
      );
    } catch {}
  }
}
