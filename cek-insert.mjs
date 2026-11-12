import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ews_banjir",
});

// Format waktu yang sama dengan fungsi getWaktuTanggalNow() di mysql.ts
const now = new Date();
const hh = String(now.getHours()).padStart(2, "0");
const mm = String(now.getMinutes()).padStart(2, "0");
const ss = String(now.getSeconds()).padStart(2, "0");
const waktu_catat   = `${hh}:${mm}:${ss}`;
const tanggal_catat = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

console.log(`\n🕐 waktu_catat  : ${waktu_catat}`);
console.log(`📅 tanggal_catat: ${tanggal_catat}\n`);

try {
  await conn.query(
    `INSERT INTO SensorKetinggian (tinggi_air, jarak_sensor, status_level, status_relay, status_buzzer, waktu_catat, tanggal_catat) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [5.5, 14.5, "WASPADA", 0, 0, waktu_catat, tanggal_catat]
  );
  console.log("✅ SensorKetinggian: INSERT berhasil!");
} catch(e) { console.error("❌ SensorKetinggian:", e.message); }

try {
  await conn.query(
    `INSERT INTO SensorDebit (debit_air, kecepatan_arus, waktu_catat, tanggal_catat) VALUES (?, ?, ?, ?)`,
    [12.5, 0.45, waktu_catat, tanggal_catat]
  );
  console.log("✅ SensorDebit: INSERT berhasil!");
} catch(e) { console.error("❌ SensorDebit:", e.message); }

try {
  await conn.query(
    `INSERT INTO SensorHujan (nilai_hujan, persen_hujan, kondisi_cuaca, waktu_catat, tanggal_catat) VALUES (?, ?, ?, ?, ?)`,
    [2100, 48.7, "Hujan Sedang", waktu_catat, tanggal_catat]
  );
  console.log("✅ SensorHujan: INSERT berhasil!");
} catch(e) { console.error("❌ SensorHujan:", e.message); }

await conn.end();
console.log("\n🔍 Kalau semua ✅ berarti format sudah benar — tinggal restart server.\n");
