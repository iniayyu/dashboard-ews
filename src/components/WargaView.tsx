import React from "react";
import {
  ShieldAlert,
  MapPin,
  ArrowRight,
  Volume2,
  MessageCircle,
  ExternalLink,
  QrCode,
  Clock,
} from "lucide-react";
import {
  SensorState,
  ThresholdSettings,
  FloodEvent,
  TelegramConfig,
  WhatsAppConfig,
  HistoryPoint,
} from "../types";
import { WaterLevelGauge } from "./WaterLevelGauge";
import { SensorCard } from "./SensorCard";
import { HistoricalCharts } from "./HistoricalCharts";

interface WargaViewProps {
  sensorState: SensorState;
  thresholds: ThresholdSettings;
  telegramConfig?: TelegramConfig;
  whatsAppConfig?: WhatsAppConfig;
  history: HistoryPoint[];
  floodEvents: FloodEvent[];
  espOnline: boolean;
  onPlaySirenTest: () => void;
  onOpenTelegramModal: () => void;
}

export const WargaView: React.FC<WargaViewProps> = ({
  sensorState,
  thresholds,
  telegramConfig,
  whatsAppConfig,
  history,
  floodEvents,
  espOnline,
  onPlaySirenTest,
  onOpenTelegramModal,
}) => {
  const waterLevelCm = Number(sensorState?.water_level_cm ?? 0);
  const distanceCm = Number(sensorState?.distance_cm ?? 0);
  const flowRateLpm = Number(sensorState?.flow_rate_lpm ?? 0);
  const waterSpeedMps = Number(sensorState?.water_speed_mps ?? 0);
  const rainPct = Number(sensorState?.rain_pct ?? 0);
  const rainAnalog = Number(sensorState?.rain_analog ?? 0);

  const warningLevel = sensorState?.warning_level ?? "AMAN";

  const rainStatus = sensorState?.rain_status ?? "Cerah";

  const relayState = Boolean(sensorState?.relay_state ?? false);
  const buzzerState = Boolean(sensorState?.buzzer_state ?? false);

  const ledIndicator = sensorState?.led_indicator ?? "green";

  const timestamp = sensorState?.timestamp ?? new Date().toISOString();

  const safeFloodEvents = Array.isArray(floodEvents) ? floodEvents : [];
  const safeHistory = Array.isArray(history) ? history : [];

  const groupName =
    whatsAppConfig?.group_name ||
    telegramConfig?.group_name ||
    "Grup Warga Siaga Banjir RW 04";

  const groupInviteLink =
    whatsAppConfig?.group_invite_link ||
    telegramConfig?.group_invite_link ||
    "https://chat.whatsapp.com/GEfQik2yg3IxZDZl";

  const getBannerAlert = () => {
    switch (warningLevel) {
      case "SIAGA":
        return {
          title: "PERINGATAN DARURAT: STATUS SIAGA",
          desc: `Ketinggian air telah melampaui batas siaga (>${thresholds.level_waspada_max} cm). Sirine & pompa aktif. Warga diimbau segera mengamankan barang berharga dan bersiap siaga!`,
          bg: "bg-rose-50 border-rose-300 text-rose-900",
          badge: "bg-rose-600 text-white",
          border: "border-l-4 border-l-rose-600",
          colorText: "text-rose-700",
        };

      case "WASPADA":
        return {
          title: "PEMANTAUAN AKTIF: STATUS WASPADA",
          desc: "Arus dan volume air meningkat akibat hujan. Tetap tenang, pantau update berkala di grup WhatsApp warga, dan amankan dokumen penting.",
          bg: "bg-amber-50 border-amber-300 text-amber-950",
          badge: "bg-amber-500 text-slate-900",
          border: "border-l-4 border-l-amber-500",
          colorText: "text-amber-700",
        };

      default:
        return {
          title: "KONDISI TERKENDALI: STATUS NORMAL (AMAN)",
          desc: "Aliran sungai terpantau stabil di bawah ambang batas normal. Sistem sensor telemetri ESP32 aktif memantau kondisi lapangan 24 jam.",
          bg: "bg-emerald-50 border-emerald-300 text-emerald-950",
          badge: "bg-emerald-600 text-white",
          border: "border-l-4 border-l-emerald-600",
          colorText: "text-emerald-700",
        };
    }
  };

  const alertInfo = getBannerAlert();

  return (
    <div className="space-y-12">
      {/* ========================================================
          1. HERO SECTION
      ======================================================== */}

      <section id="beranda" className="pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT */}
          <div className="lg:col-span-7 space-y-5">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Sistem Monitoring & Peringatan Dini Banjir Berbasis IoT
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              Membantu warga memantau kondisi air sungai, membaca data sensor
              secara realtime, melihat panduan kesiapsiagaan darurat banjir, dan
              menerima notifikasi peringatan langsung melalui grup WhatsApp.
            </p>

            {/* BUTTONS */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#monitoring-publik"
                className="px-6 py-3 rounded-xl bg-[#0066cc] hover:bg-blue-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <span>Lihat Monitoring Publik</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <button
                onClick={onOpenTelegramModal}
                className="px-5 py-3 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-800 font-bold text-sm transition-all flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4 text-blue-600" />
                <span>Grup WhatsApp Warga</span>
              </button>
            </div>

            {/* DEVICE STATUS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-3 h-3 rounded-full ${
                    espOnline ? "bg-emerald-500 animate-ping" : "bg-rose-500"
                  }`}
                />

                <div>
                  <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                    STATUS PERANGKAT ESP32
                  </span>

                  <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                    {espOnline
                      ? "ONLINE • REALTIME / CEK SENSOR TIAP 3 DTK"
                      : "OFFLINE • MENUNGGU REKONEKSI"}
                  </span>
                </div>
              </div>

              <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-4">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] block">
                  TERAKHIR DIPERBARUI
                </span>

                <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                  {(() => {
                    const d = new Date(timestamp);
                    if (!isNaN(d.getTime())) {
                      return `${d.toLocaleDateString("id-ID")} ${d.toLocaleTimeString("id-ID")} WIB`;
                    }
                    return `${new Date().toLocaleDateString("id-ID")} ${timestamp || new Date().toLocaleTimeString("id-ID")} WIB`;
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    RINGKASAN TELEMETRI LAPANGAN
                  </span>

                  <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                    Posko Taman Cipulir Estate
                  </h3>
                </div>

                <div
                  className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${alertInfo.badge}`}
                >
                  {warningLevel}
                </div>
              </div>

              {/* METRICS */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* WATER LEVEL */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-medium block">
                    Ketinggian Air
                  </span>

                  <div className="text-2xl font-black text-[#0066cc] mt-1 tabular-nums">
                    {waterLevelCm.toFixed(1)}{" "}
                    <span className="text-xs font-semibold text-slate-500">
                      cm
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Tiang sensor: {thresholds.sensor_mount_height_cm} cm
                  </span>
                </div>

                {/* FLOW */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-medium block">
                    Debit Aliran Air
                  </span>

                  <div className="text-2xl font-black text-slate-800 mt-1 tabular-nums">
                    {flowRateLpm.toFixed(1)}{" "}
                    <span className="text-xs font-semibold text-slate-500">
                      L/m
                    </span>
                  </div>

                  <span className="text-[11px] text-blue-700 font-bold mt-1 block">
                    ~{waterSpeedMps.toFixed(2)} m/detik
                  </span>
                </div>

                {/* RAIN */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-medium block">
                    Curah Hujan Posko
                  </span>

                  <div className="text-2xl font-black text-sky-700 mt-1 tabular-nums">
                    {rainPct.toFixed(0)}%
                  </div>

                  <span className="text-[11px] text-slate-600 font-semibold mt-1 block">
                    {rainStatus}
                  </span>
                </div>

                {/* RELAY LED & BUZZER */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 font-medium block">
                    Relay LED / Buzzer
                  </span>

                  <div className="text-base font-black text-slate-800 mt-2">
                    {relayState ? (
                      <span className="text-emerald-700">RELAY LED: ON</span>
                    ) : (
                      <span className="text-slate-600">RELAY LED: OFF</span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Buzzer:{" "}
                    {buzzerState ? (
                      <span className="text-rose-600 font-bold animate-pulse">
                        ON ({sensorState?.siren_elapsed_seconds ?? 1} dtk)
                      </span>
                    ) : (
                      "OFF"
                    )}
                  </span>
                </div>
              </div>

              {/* LOCATION */}
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center gap-2.5 text-xs text-blue-900">
                <MapPin className="w-4 h-4 text-[#0066cc] shrink-0" />

                <span className="font-semibold">
                  Lokasi Penerapan: Taman Cipulir Estate, Cipadu Jaya, Tangerang
                  Selatan
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          2. MONITORING PUBLIK REALTIME
      ======================================================== */}

      <section id="monitoring-publik" className="scroll-mt-24 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
              PEMANTAUAN TERKINI
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Monitoring Publik Realtime
            </h2>
          </div>

          <button
            onClick={onPlaySirenTest}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs flex items-center gap-2 transition-colors"
          >
            <Volume2 className="w-4 h-4 text-blue-600" />

            <span className="hidden sm:inline">Uji Nada Sirine Peringatan</span>
          </button>
        </div>

        {/* STATUS CARD */}
        <div
          className={`p-6 rounded-2xl border ${alertInfo.bg} ${alertInfo.border} shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4`}
        >
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`p-3 rounded-2xl ${alertInfo.badge} shrink-0 shadow-sm`}
            >
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`px-2.5 py-0.5 rounded text-xs font-extrabold uppercase ${alertInfo.badge}`}
                >
                  Status: {warningLevel}
                </span>

                <span className="text-xs font-medium text-slate-600">
                  Waktu Pantau:{" "}
                  {new Date(timestamp).toLocaleTimeString("id-ID")} WIB
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                {alertInfo.title}
              </h3>

              <p className="text-sm text-slate-700 mt-1 max-w-4xl leading-relaxed font-medium">
                {alertInfo.desc}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <a
              href="#grafik-riwayat"
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 font-bold text-xs shadow-2xs inline-flex items-center gap-2"
            >
              <span>Pantau Grafik Sensor</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* SENSOR */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col">
            <WaterLevelGauge
              waterLevelCm={waterLevelCm}
              distanceCm={distanceCm}
              warningLevel={warningLevel}
              thresholds={thresholds}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col">
            <SensorCard
              flowRateLpm={flowRateLpm}
              waterSpeedMps={waterSpeedMps}
              rainPct={rainPct}
              rainAnalog={rainAnalog}
              rainStatus={rainStatus}
              relayState={relayState}
              buzzerState={buzzerState}
              ledIndicator={ledIndicator}
              warningLevel={warningLevel}
              sirenElapsedSeconds={sensorState?.siren_elapsed_seconds}
              isAdmin={false}
            />
          </div>
        </div>

        {/* KARTU PANDUAN BATAS AMBANG KETINGGIAN AIR (AMAN, WASPADA, SIAGA) */}
        <div
          id="panduan-level"
          className="scroll-mt-24 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                STANDAR OPERASIONAL PROSEDUR (SOP) POSKO
              </span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-0.5">
                Klasifikasi Batas Ketinggian Air Sungai & Tindakan Warga
              </h3>
            </div>
            <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200 self-start sm:self-auto">
              Tinggi Tiang Sensor:{" "}
              <strong className="text-slate-800 font-mono">
                {thresholds.sensor_mount_height_cm} cm
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. LEVEL AMAN */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-black uppercase tracking-wider">
                    LEVEL 1: AMAN
                  </span>
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-emerald-300"></span>
                </div>
                <div className="text-2xl font-black text-emerald-950 font-mono mt-2">
                  0 — {thresholds.level_aman_max}{" "}
                  <span className="text-sm font-semibold text-emerald-700">
                    cm
                  </span>
                </div>
                <p className="text-xs text-emerald-900 mt-2 leading-relaxed">
                  Debit dan muka air normal di dalam alur sungai. Arus
                  terkendali tanpa risiko limpasan.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-200/80 text-[11px] text-emerald-800 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>🟢 Indikator:</span>
                  <span className="font-normal">LED Hijau Menyala</span>
                </div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>📢 Arahan:</span>
                  <span className="font-normal">
                    Aktivitas normal warga berjalan biasa.
                  </span>
                </div>
              </div>
            </div>

            {/* 2. LEVEL WASPADA */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-900 text-xs font-black uppercase tracking-wider">
                    LEVEL 2: WASPADA
                  </span>
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-400 ring-2 ring-amber-300"></span>
                </div>
                <div className="text-2xl font-black text-amber-950 font-mono mt-2">
                  &gt; {thresholds.level_aman_max} —{" "}
                  {thresholds.level_waspada_max}{" "}
                  <span className="text-sm font-semibold text-amber-800">
                    cm
                  </span>
                </div>
                <p className="text-xs text-amber-950 mt-2 leading-relaxed">
                  Muka air meningkat mendekati bibir tanggul kali akibat hujan
                  deras di kawasan hulu.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-200/80 text-[11px] text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>🟡 Indikator:</span>
                  <span className="font-normal">
                    LED Kuning + Notifikasi WhatsApp
                  </span>
                </div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>📢 Arahan:</span>
                  <span className="font-normal">
                    Warga bersiap, amankan dokumen & barang berharga.
                  </span>
                </div>
              </div>
            </div>

            {/* 3. LEVEL SIAGA */}
            <div className="p-4 rounded-2xl bg-rose-50/70 border-2 border-rose-300 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-xs font-black uppercase tracking-wider">
                    LEVEL 3: SIAGA
                  </span>
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-600 ring-2 ring-rose-300 animate-pulse"></span>
                </div>
                <div className="text-2xl font-black text-rose-950 font-mono mt-2">
                  &gt; {thresholds.level_waspada_max}{" "}
                  <span className="text-sm font-semibold text-rose-700">
                    cm
                  </span>
                </div>
                <p className="text-xs text-rose-950 mt-2 leading-relaxed">
                  Status darurat! Air meluap ke pemukiman warga RT 03/04. Sistem
                  otomatis menyalakan pompa drainase.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-rose-200/80 text-[11px] text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>🔴 Indikator:</span>
                  <span className="font-normal">
                    Sirine Bunyi + Pompa ON + Broadcast Darurat
                  </span>
                </div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>📢 Arahan:</span>
                  <span className="font-normal">
                    Evakuasi mandiri segera ke titik kumpul aman!
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          3. GRAFIK REALTIME & RIWAYAT DATA SENSOR
      ======================================================== */}

      <section id="grafik-riwayat" className="scroll-mt-24 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
              VISUALISASI & REKAM DATA
            </span>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              Grafik Realtime & Riwayat Data Sensor
            </h2>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-2xs">
            <Clock className="w-4 h-4 text-blue-600" />
            <span>
              Pembaruan Terakhir:{" "}
              <strong className="text-slate-800 font-mono">
                {new Date(timestamp).toLocaleTimeString("id-ID")} WIB
              </strong>
            </span>
          </div>
        </div>

        {/* GRAFIK REALTIME */}
        <HistoricalCharts history={safeHistory} thresholds={thresholds} />
      </section>

      {/* ========================================================
          4. SALURAN KOMUNIKASI WHATSAPP WARGA (FONNTE GATEWAY)
      ======================================================== */}

      <section id="bot-telegram" className="scroll-mt-24 space-y-6">
        <div>
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
            KOMUNIKASI WARGA SIAGA
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            WhatsApp Bot & Grup Siaga Warga ({groupName})
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Warga dapat bergabung ke grup WhatsApp untuk menerima peringatan
            siaga darurat otomatis dan menanyakan kondisi air kapan saja via
            Fonnte Gateway.
          </p>
        </div>

        {/* KARTU RESMI WHATSAPP LEBAR PENUH (FULL WIDTH TANPA RUANG KOSONG) */}
        <div className="w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 lg:p-9 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 block">
                  AKSES GRUP WHATSAPP RESMI
                </span>
                <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                  {groupName}
                </h3>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
              ● Siaran Otomatis Aktif
            </span>
          </div>

          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* QR CODE CONTAINER (LEFT) */}
            <div className="w-52 h-52 shrink-0 bg-white p-3 rounded-2xl border-2 border-slate-200 flex items-center justify-center shadow-xs">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=6&color=0066cc&data=${encodeURIComponent(
                  groupInviteLink,
                )}`}
                alt={`QR Code Grup WhatsApp ${groupName}`}
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            {/* KETERANGAN & AKSI LANGSUNG (RIGHT / EXPANDS TO FULL WIDTH) */}
            <div className="flex-1 space-y-4 w-full">
              <div>
                <p className="font-bold text-slate-800 text-sm sm:text-base mb-1">
                  Pindai QR Code di samping menggunakan kamera WhatsApp di
                  ponsel Anda atau tekan tombol di bawah:
                </p>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Grup resmi ini difungsikan khusus untuk menyebarkan informasi
                  ketinggian air dan peringatan siaga darurat secara otomatis
                  dari sistem telemetri sensor ESP32 posko.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">
                    📢 Peringatan Dini Otomatis
                  </span>
                  <span className="text-slate-600 text-[11px] leading-relaxed">
                    Sistem langsung menyiarkan pesan darurat saat air naik ke
                    batas{" "}
                    <strong className="text-amber-700">
                      Waspada (&gt;{thresholds.level_aman_max} cm)
                    </strong>{" "}
                    atau{" "}
                    <strong className="text-rose-700">
                      Siaga (&gt;{thresholds.level_waspada_max} cm)
                    </strong>
                    .
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">
                    ⚡ Telemetri Realtime
                  </span>
                  <span className="text-slate-600 text-[11px] leading-relaxed">
                    Terhubung langsung ke mikrokontroler ESP32 melalui Fonnte
                    WhatsApp Gateway untuk pemantauan 24 jam.
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">
                  Tautan Undangan Grup:
                </span>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-[#0066cc] break-all select-all">
                  {groupInviteLink}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <a
                  href={groupInviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-6 rounded-xl bg-[#0066cc] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Gabung Grup WhatsApp Sekarang</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={onOpenTelegramModal}
                  className="py-3 px-5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <QrCode className="w-4 h-4 text-blue-700" />
                  <span>Perbesar QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          5. RIWAYAT KEJADIAN BANJIR
      ======================================================== */}

      <section id="riwayat-kejadian" className="scroll-mt-24 space-y-6">
        <div>
          <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">
            CATATAN RIWAYAT
          </span>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Riwayat Kejadian Banjir Terbaru
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pencatatan resmi insiden luapan sungai dan tindakan mitigasi yang
            telah dilakukan posko.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4">ID Kejadian</th>
                  <th className="p-4">Waktu Mulai</th>
                  <th className="p-4">Status Maksimal</th>
                  <th className="p-4">Ketinggian Puncak</th>
                  <th className="p-4">Debit Puncak</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700">
                {safeFloodEvents.slice(0, 5).map((evt) => (
                  <tr
                    key={evt.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="p-4 font-mono font-bold text-blue-700">
                      {evt.id}
                    </td>

                    <td className="p-4 whitespace-nowrap text-slate-600">
                      {evt.start_time}
                    </td>

                    <td className="p-4">
                      {(() => {
                        const raw = evt.max_warning_level as string;
                        const displayLevel = raw === "BAHAYA" ? "SIAGA" : raw;
                        return (
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-bold ${
                              displayLevel === "SIAGA"
                                ? "bg-rose-100 text-rose-800"
                                : displayLevel === "WASPADA"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {displayLevel}
                          </span>
                        );
                      })()}
                    </td>

                    <td className="p-4 font-mono font-bold text-slate-900">
                      {evt.peak_water_level_cm} cm
                    </td>

                    <td className="p-4 font-mono text-slate-700">
                      {evt.peak_flow_rate_lpm} L/min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
