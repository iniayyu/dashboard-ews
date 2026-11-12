-- =====================================================================
-- BASIS DATA SMART EWS BANJIR (SISTEM PERINGATAN DINI BANJIR)
-- KOMPATIBILITAS: phpMyAdmin / MySQL 5.7+ / MariaDB 10+
-- STRUKTUR TABEL 100% SESUAI ERD PENGGUNA (6 TABEL UTAMA)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `ews_banjir` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `ews_banjir`;

-- --------------------------------------------------------
-- 1. Tabel: Petugas
-- Mengelola data admin dan operator posko EWS
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `Petugas` (
  `id_petugas` VARCHAR(50) NOT NULL,
  `nama_lengkap` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `login_terakhir` VARCHAR(50) DEFAULT 'Belum pernah login',
  PRIMARY KEY (`id_petugas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. Tabel: AmbangBatas
-- Parameter batas peringatan sensor & otomasi relay/buzzer
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `AmbangBatas` (
  `id` INT NOT NULL DEFAULT 1,
  `tinggi_tiang` DOUBLE NOT NULL DEFAULT 250.0,
  `batas_aman` DOUBLE NOT NULL DEFAULT 120.0,
  `batas_waspada` DOUBLE NOT NULL DEFAULT 160.0,
  `batas_siaga` DOUBLE NOT NULL DEFAULT 200.0,
  `batas_debit` DOUBLE NOT NULL DEFAULT 45.0,
  `batas_hujan` DOUBLE NOT NULL DEFAULT 65.0,
  `otomatis_relay` TINYINT(1) NOT NULL DEFAULT 1,
  `otomatis_buzzer` TINYINT(1) NOT NULL DEFAULT 1,
  `diperbarui_pada` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. Tabel: SensorDebit
-- Data pembacaan Waterflow Sensor (YF-S201)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SensorDebit` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `debit_air` DOUBLE NOT NULL,
  `kecepatan_arus` DOUBLE NOT NULL,
  `waktu_catat` TIME NOT NULL,
  `tanggal_catat` DATE NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_debit_tanggal_waktu` (`tanggal_catat`, `waktu_catat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. Tabel: SensorKetinggian
-- Data pembacaan Sensor Ultrasonik (HC-SR04)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SensorKetinggian` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `tinggi_air` DOUBLE NOT NULL,
  `jarak_sensor` DOUBLE NOT NULL,
  `status_level` VARCHAR(20) NOT NULL DEFAULT 'AMAN',
  `status_relay` TINYINT(1) NOT NULL DEFAULT 0,
  `status_buzzer` TINYINT(1) NOT NULL DEFAULT 0,
  `waktu_catat` TIME NOT NULL,
  `tanggal_catat` DATE NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_tinggi_tanggal_waktu` (`tanggal_catat`, `waktu_catat`),
  INDEX `idx_tinggi_status` (`status_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. Tabel: SensorHujan
-- Data pembacaan Waterfall Rain Module (FC-37 / YL-83)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `SensorHujan` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `nilai_hujan` INT NOT NULL,
  `persen_hujan` DOUBLE NOT NULL,
  `kondisi_cuaca` VARCHAR(50) NOT NULL,
  `waktu_catat` TIME NOT NULL,
  `tanggal_catat` DATE NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_hujan_tanggal_waktu` (`tanggal_catat`, `waktu_catat`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. Tabel: RiwayatAlarm
-- Catatan pemicuan alarm sirine / buzzer & notifikasi
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `RiwayatAlarm` (
  `id_alarm` VARCHAR(50) NOT NULL,
  `waktu_bunyi` TIME NOT NULL,
  `tanggal_bunyi` DATE NOT NULL,
  `status_level` VARCHAR(20) NOT NULL,
  `alasan_pemicu` TEXT NOT NULL,
  `dihentikan_oleh` VARCHAR(100) DEFAULT 'Otomatis',
  `durasi_detik` INT DEFAULT 0,
  PRIMARY KEY (`id_alarm`),
  INDEX `idx_alarm_tanggal` (`tanggal_bunyi`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- DATA AWAL (SEED DATA)
-- =====================================================================

-- Petugas awal (password: password123)
INSERT INTO `Petugas` (`id_petugas`, `nama_lengkap`, `password`, `login_terakhir`) VALUES
('ADM-01', 'Bambang Sutrisno', 'password123', 'Baru saja'),
('ADM-02', 'Operator Posko', 'password123', 'Belum pernah login')
ON DUPLICATE KEY UPDATE `nama_lengkap` = VALUES(`nama_lengkap`), `password` = VALUES(`password`);

-- Ambang batas default
INSERT INTO `AmbangBatas` (`id`, `tinggi_tiang`, `batas_aman`, `batas_waspada`, `batas_siaga`, `batas_debit`, `batas_hujan`, `otomatis_relay`, `otomatis_buzzer`) VALUES
(1, 250.0, 120.0, 160.0, 200.0, 45.0, 65.0, 1, 1)
ON DUPLICATE KEY UPDATE `id` = 1;

-- Data simulasi sensor ketinggian (HC-SR04)
INSERT INTO `SensorKetinggian` (`tinggi_air`, `jarak_sensor`, `status_level`, `status_relay`, `status_buzzer`, `waktu_catat`, `tanggal_catat`) VALUES
(72.0, 178.0, 'AMAN', 0, 0, '08:00:00', CURDATE()),
(78.0, 172.0, 'AMAN', 0, 0, '09:00:00', CURDATE()),
(95.0, 155.0, 'AMAN', 0, 0, '10:00:00', CURDATE()),
(132.0, 118.0, 'WASPADA', 1, 0, '11:00:00', CURDATE()),
(168.0, 82.0, 'SIAGA', 1, 1, '12:00:00', CURDATE()),
(142.0, 108.0, 'WASPADA', 1, 0, '13:00:00', CURDATE()),
(110.0, 140.0, 'AMAN', 0, 0, '14:00:00', CURDATE()),
(85.4, 164.6, 'AMAN', 0, 0, '15:00:00', CURDATE());

-- Data simulasi sensor debit (YF-S201)
INSERT INTO `SensorDebit` (`debit_air`, `kecepatan_arus`, `waktu_catat`, `tanggal_catat`) VALUES
(14.0, 0.50, '08:00:00', CURDATE()),
(16.0, 0.58, '09:00:00', CURDATE()),
(22.0, 0.78, '10:00:00', CURDATE()),
(34.0, 1.15, '11:00:00', CURDATE()),
(46.0, 1.55, '12:00:00', CURDATE()),
(30.0, 1.05, '13:00:00', CURDATE()),
(21.0, 0.75, '14:00:00', CURDATE()),
(18.2, 0.65, '15:00:00', CURDATE());

-- Data simulasi sensor hujan (FC-37/YL-83)
INSERT INTO `SensorHujan` (`nilai_hujan`, `persen_hujan`, `kondisi_cuaca`, `waktu_catat`, `tanggal_catat`) VALUES
(3800, 5.0, 'Cerah', '08:00:00', CURDATE()),
(3600, 10.0, 'Cerah Berawan', '09:00:00', CURDATE()),
(3100, 25.0, 'Berawan', '10:00:00', CURDATE()),
(2100, 55.0, 'Hujan Sedang', '11:00:00', CURDATE()),
(1200, 75.0, 'Hujan Lebat', '12:00:00', CURDATE()),
(2400, 40.0, 'Gerimis', '13:00:00', CURDATE()),
(3200, 20.0, 'Mendung', '14:00:00', CURDATE()),
(3450, 15.0, 'Cerah Berawan', '15:00:00', CURDATE());

-- Riwayat alarm awal
INSERT INTO `RiwayatAlarm` (`id_alarm`, `waktu_bunyi`, `tanggal_bunyi`, `status_level`, `alasan_pemicu`, `dihentikan_oleh`, `durasi_detik`) VALUES
('ALM-1730000001', '12:00:00', CURDATE(), 'SIAGA', 'Ketinggian air mencapai 168.0 cm (Melewati ambang batas waspada)', 'Otomatis', 120)
ON DUPLICATE KEY UPDATE `id_alarm` = VALUES(`id_alarm`);
