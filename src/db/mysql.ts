/**
 * Database Service — MySQL Only (Laragon / phpMyAdmin)
 * Menyimpan data langsung ke MySQL tanpa SQLite.
 * Tabel: Petugas, AmbangBatas, SensorDebit, SensorKetinggian, SensorHujan, RiwayatAlarm
 */

import "dotenv/config";
import { WarningLevel, ThresholdSettings, AlarmLog } from "../types";

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

export async function initMySQLConnection(): Promise<boolean> {
  const host     = process.env.DB_HOST     || "localhost";
  const port     = Number(process.env.DB_PORT || 3306);
  const user     = process.env.DB_USER     || "root";
  const password = process.env.DB_PASSWORD || "";
  const database = process.env.DB_NAME     || "ews_banjir";

  try {
    const mysqlModule = await import("mysql2/promise" as any).catch(() => null);
    if (!mysqlModule) {
      console.error("[MySQL] Paket 'mysql2' tidak ditemukan. Jalankan: npm install mysql2");
      return false;
    }

    const mysql = mysqlModule.default || mysqlModule;
    const pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 3000,
    });

    // Test koneksi
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();

    mysqlPool = pool;
    isMysqlConnected = true;
    console.log(`\n✅ [MySQL] Terhubung ke ${host}:${port}/${database}\n`);
    return true;
  } catch (err: any) {
    console.error(`❌ [MySQL] Gagal konek: ${err?.message}`);
    console.error("   Pastikan Laragon/MySQL aktif dan database 'ews_banjir' sudah dibuat.");
    isMysqlConnected = false;
    mysqlPool = null;
    return false;
  }
}

/** Helper: jalankan query MySQL, lempar error jika tidak konek */
async function query(sql: string, params: any[] = []): Promise<any> {
  if (!mysqlPool || !isMysqlConnected) {
    throw new Error("MySQL tidak terhubung. Pastikan Laragon aktif.");
  }
  try {
    const [rows] = await mysqlPool.query(sql, params);
    return rows;
  } catch (err: any) {
    console.error(`[MySQL] Query gagal: ${err?.message}`);
    console.error(`[MySQL] SQL: ${sql.trim().split("\n")[0]}`);
    console.error(`[MySQL] Params: ${JSON.stringify(params)}`);
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
): Promise<void> {
  const { waktu_catat, tanggal_catat } = getWaktuTanggalNow();
  await query(
    `INSERT INTO SensorKetinggian (tinggi_air, jarak_sensor, status_level, status_relay, status_buzzer, waktu_catat, tanggal_catat)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tinggi, jarak, level, relay ? 1 : 0, buzzer ? 1 : 0, waktu_catat, tanggal_catat],
  );
  console.log(`[MySQL] ✅ SensorKetinggian saved: tinggi=${tinggi}, level=${level}`);
}

export async function ambilTinggiTerbaru(): Promise<any> {
  const rows = await query(
    "SELECT * FROM SensorKetinggian ORDER BY id DESC LIMIT 1",
  );
  return rows[0] ?? null;
}

export async function ambilGrafikTinggi(limit = 24): Promise<any[]> {
  const rows = await query(
    `SELECT id, tinggi_air, jarak_sensor, status_level, status_relay, status_buzzer, waktu_catat, tanggal_catat
     FROM SensorKetinggian ORDER BY id DESC LIMIT ?`,
    [limit],
  );
  return (rows as any[]).reverse();
}

// =====================================================================
// SensorDebit
// =====================================================================
export async function simpanDataDebit(
  debit: number,
  kecepatan: number,
): Promise<void> {
  const { waktu_catat, tanggal_catat } = getWaktuTanggalNow();
  await query(
    `INSERT INTO SensorDebit (debit_air, kecepatan_arus, waktu_catat, tanggal_catat)
     VALUES (?, ?, ?, ?)`,
    [debit, kecepatan, waktu_catat, tanggal_catat],
  );
  console.log(`[MySQL] ✅ SensorDebit saved: debit=${debit}`);
}

export async function ambilDebitTerbaru(): Promise<any> {
  const rows = await query(
    "SELECT * FROM SensorDebit ORDER BY id DESC LIMIT 1",
  );
  return rows[0] ?? null;
}

export async function ambilGrafikDebit(limit = 24): Promise<any[]> {
  const rows = await query(
    `SELECT id, debit_air, kecepatan_arus, waktu_catat, tanggal_catat
     FROM SensorDebit ORDER BY id DESC LIMIT ?`,
    [limit],
  );
  return (rows as any[]).reverse();
}

// =====================================================================
// SensorHujan
// =====================================================================
export async function simpanDataHujan(
  nilaiHujan: number,
  persenHujan: number,
  kondisiCuaca: string,
): Promise<void> {
  const { waktu_catat, tanggal_catat } = getWaktuTanggalNow();
  await query(
    `INSERT INTO SensorHujan (nilai_hujan, persen_hujan, kondisi_cuaca, waktu_catat, tanggal_catat)
     VALUES (?, ?, ?, ?, ?)`,
    [nilaiHujan, persenHujan, kondisiCuaca, waktu_catat, tanggal_catat],
  );
  console.log(`[MySQL] ✅ SensorHujan saved: nilai=${nilaiHujan}, persen=${persenHujan}%, cuaca=${kondisiCuaca}`);
}

export async function ambilHujanTerbaru(): Promise<any> {
  const rows = await query(
    "SELECT * FROM SensorHujan ORDER BY id DESC LIMIT 1",
  );
  return rows[0] ?? null;
}

export async function ambilGrafikHujan(limit = 24): Promise<any[]> {
  const rows = await query(
    `SELECT id, nilai_hujan, persen_hujan, kondisi_cuaca, waktu_catat, tanggal_catat
     FROM SensorHujan ORDER BY id DESC LIMIT ?`,
    [limit],
  );
  return (rows as any[]).reverse();
}

// =====================================================================
// AmbangBatas
// =====================================================================
export async function ambilDataBatas(): Promise<ThresholdSettings> {
  const rows = await query("SELECT * FROM AmbangBatas WHERE id = 1");
  const row = rows[0];
  if (!row) {
    return {
      sensor_mount_height_cm: 250,
      level_aman_max: 120,
      level_waspada_max: 160,
      level_siaga_max: 200,
      flow_warning_lpm: 45.0,
      rain_heavy_pct: 65.0,
      auto_relay_enabled: true,
      auto_buzzer_enabled: true,
    };
  }
  return {
    sensor_mount_height_cm: Number(row.tinggi_tiang ?? 250),
    level_aman_max: Number(row.batas_aman ?? 120),
    level_waspada_max: Number(row.batas_waspada ?? 160),
    level_siaga_max: Number(row.batas_siaga ?? 200),
    level_bahaya_min: Number(row.batas_siaga ?? 200),
    flow_warning_lpm: Number(row.batas_debit ?? 45),
    rain_heavy_pct: Number(row.batas_hujan ?? 65),
    auto_relay_enabled: Boolean(row.otomatis_relay),
    auto_buzzer_enabled: Boolean(row.otomatis_buzzer),
  };
}

export async function ubahBatas(s: Partial<ThresholdSettings>): Promise<boolean> {
  const current = await ambilDataBatas();
  const next = { ...current, ...s };
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
  await query(
    `INSERT INTO RiwayatAlarm (id_alarm, waktu_bunyi, tanggal_bunyi, status_level, alasan_pemicu, dihentikan_oleh, durasi_detik)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, waktu_catat, tanggal_catat, level, alasan, stoppedBy, durasi],
  );
  console.log(`✅ [MySQL] RiwayatAlarm (${id}) dicatat.`);
  return id;
}

export async function ambilRiwayatAlarm(): Promise<AlarmLog[]> {
  const rows = await query(
    `SELECT id_alarm, waktu_bunyi, tanggal_bunyi, status_level, alasan_pemicu, durasi_detik, dihentikan_oleh
     FROM RiwayatAlarm ORDER BY id_alarm DESC LIMIT 50`,
  );
  return (rows as any[]).map((r) => ({
    id: r.id_alarm,
    timestamp: `${r.tanggal_bunyi || ""} ${r.waktu_bunyi || ""}`.trim() || "Hari ini",
    level: r.status_level as WarningLevel,
    trigger_reason: r.alasan_pemicu,
    stopped_by: r.dihentikan_oleh || "Otomatis",
    duration_seconds: Number(r.durasi_detik ?? 0),
  }));
}

// =====================================================================
// Petugas (Admin Users) — sync dengan tabel MySQL
// =====================================================================

export async function ambilSemuaPetugas(): Promise<any[]> {
  const rows = await query(
    `SELECT id_petugas, nama_lengkap, password, login_terakhir FROM Petugas ORDER BY id_petugas`
  );
  return (rows as any[]).map((r) => ({
    id: r.id_petugas,
    name: r.nama_lengkap,
    username: r.id_petugas.toLowerCase().replace("-", ""), // derive dari id, tidak disimpan di DB
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
  await query(
    `INSERT INTO Petugas (id_petugas, nama_lengkap, password, login_terakhir)
     VALUES (?, ?, ?, 'Belum pernah')
     ON DUPLICATE KEY UPDATE
       nama_lengkap = VALUES(nama_lengkap),
       password     = VALUES(password)`,
    [id, name, password],
  );
  console.log(`✅ [MySQL] Petugas (${id}) disimpan.`);
}

export async function updatePetugas(
  id: string,
  fields: { name?: string; password?: string; last_login?: string },
): Promise<void> {
  const setClauses: string[] = [];
  const params: any[] = [];

  if (fields.name)       { setClauses.push("nama_lengkap = ?");  params.push(fields.name); }
  if (fields.password)   { setClauses.push("password = ?");       params.push(fields.password); }
  if (fields.last_login) { setClauses.push("login_terakhir = ?"); params.push(fields.last_login); }

  if (setClauses.length === 0) return;
  params.push(id);

  await query(`UPDATE Petugas SET ${setClauses.join(", ")} WHERE id_petugas = ?`, params);
  console.log(`✅ [MySQL] Petugas (${id}) diperbarui.`);
}

export async function hapusPetugas(id: string): Promise<void> {
  await query(`DELETE FROM Petugas WHERE id_petugas = ?`, [id]);
  console.log(`✅ [MySQL] Petugas (${id}) dihapus.`);
}

export async function updateLoginTerakhir(id: string): Promise<void> {
  const now = new Date();
  const waktu = now.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  await query(`UPDATE Petugas SET login_terakhir = ? WHERE id_petugas = ?`, [waktu, id]);
}
