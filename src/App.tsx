/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { Header } from "./components/Header";
import { WargaView } from "./components/WargaView";
import { AdminView } from "./components/AdminView";
import { LoginModal } from "./components/LoginModal";

import {
  SensorState,
  ThresholdSettings,
  TelegramConfig,
  WhatsAppConfig,
  Esp32Status,
  HistoryPoint,
  FloodEvent,
  AlarmLog,
  AdminUser,
  DatabaseStatus,
} from "./types";

import {
  playBuzzerBeep,
  startEmergencySiren,
  stopEmergencySiren,
} from "./utils/audioAlert";

import { ExternalLink, Shield } from "lucide-react";

export default function App() {
  // =====================================================
  // VIEW / NAVIGATION
  // =====================================================

  const viewFromPath = () =>
    /^\/admin(\/|$)/.test(window.location.pathname) ? "admin" : "warga";

  const [currentView, setCurrentView] = useState<"warga" | "admin">(
    viewFromPath,
  );

  // Sinkronkan URL (/admin) dengan tampilan, termasuk tombol back/forward browser
  useEffect(() => {
    if (viewFromPath() !== currentView) {
      window.history.pushState(
        null,
        "",
        currentView === "admin" ? "/admin" : "/",
      );
    }
  }, [currentView]);

  useEffect(() => {
    const onPop = () => setCurrentView(viewFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const [activeNavSection, setActiveNavSection] = useState<string>("beranda");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

  // =====================================================
  // CURRENT ADMIN USER
  // =====================================================

  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    try {
      const saved = localStorage.getItem("ews_admin_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // =====================================================
  // SENSOR STATE
  // =====================================================

  const [sensorState, setSensorState] = useState<SensorState>({
    water_level_cm: 2.5,
    distance_cm: 17.5,
    flow_rate_lpm: 12.0,
    water_speed_mps: 0.42,
    rain_analog: 3800,
    rain_pct: 10.0,
    rain_status: "Cerah Berawan",
    warning_level: "AMAN",
    relay_state: false,
    buzzer_state: false,
    led_indicator: "green",
    timestamp: new Date().toISOString(),
  });

  // =====================================================
  // THRESHOLDS
  // =====================================================

  const [thresholds, setThresholds] = useState<ThresholdSettings>(() => {
    try {
      const saved = localStorage.getItem("ews_thresholds");
      if (saved) {
        return {
          sensor_mount_height_cm: 20,
          level_aman_max: 3,
          level_waspada_max: 6,
          level_siaga_max: 10,
          level_bahaya_min: 10,
          flow_warning_lpm: 45.0,
          rain_heavy_pct: 65.0,
          auto_relay_enabled: true,
          auto_buzzer_enabled: true,
          ...JSON.parse(saved),
        };
      }
    } catch {}
    return {
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
  });

  // =====================================================
  // TELEGRAM CONFIG
  // =====================================================

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    bot_token: "8438619356:AAFyN2k2e-swmR8h4Ad8XlWIDpHw2ivnDEM",
    has_token: true,
    chat_id: "-1004485459653",
    group_name: "EWS TCE",
    group_invite_link: "https://t.me/+GEfQik2yg3IxZDZl",
    notify_siaga: true,
    notify_bahaya: true,
  });

  // =====================================================
  // WHATSAPP CONFIG (FONNTE GATEWAY)
  // =====================================================

  const [whatsAppConfig, setWhatsAppConfig] = useState<WhatsAppConfig>({
    fonnte_token: "STeoGKW9vv8coTDzUETW",
    has_token: true,
    target_number: "120363431321582251@g.us",
    group_name: "Grup Warga Siaga Banjir",
    group_invite_link:
      "https://chat.whatsapp.com/Ftbc0fqXT2g3qHMTfsPEMh?mode=gi_t",
    notify_waspada: true,
    notify_siaga: true,
  });

  // =====================================================
  // ESP32 STATUS
  // =====================================================

  const [esp32Status, setEsp32Status] = useState<Esp32Status>({
    online: false,
    ip_address: "192.168.1.108",
    mac_address: "24:6F:28:B4:8C:F2",
    wifi_rssi: -62,
    firmware_version: "v2.4.0-EWS-PRO",
    uptime_seconds: 0,
    last_heartbeat: "Belum terhubung",
    device_id: "ESP32-EWS-CILANGKAP-01",
  });

  // =====================================================
  // AUXILIARY DATA
  // =====================================================

  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [floodEvents, setFloodEvents] = useState<FloodEvent[]>([]);
  const [alarmLogs, setAlarmLogs] = useState<AlarmLog[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(
    null,
  );

  // =====================================================
  // SIREN
  // =====================================================

  const [sirenActive, setSirenActive] = useState(false);
  const previousLevelRef = useRef<string>("AMAN");

  // Force page to top when first opened
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, []);

  // =====================================================
  // FETCH STATUS
  // =====================================================

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) {
        console.warn("Gagal mengambil /api/status:", res.status);
        return;
      }

      const data = await res.json();

      // SENSOR
      if (data.sensorState) {
        setSensorState((prev) => ({
          ...prev,
          ...data.sensorState,
        }));
      }

      // THRESHOLDS
      if (data.thresholds) {
        setThresholds((prev) => {
          const next = {
            sensor_mount_height_cm:
              data.thresholds.sensor_mount_height_cm ??
              data.thresholds.mountHeight ??
              prev.sensor_mount_height_cm,
            level_aman_max:
              data.thresholds.level_aman_max ??
              data.thresholds.aman ??
              prev.level_aman_max,
            level_waspada_max:
              data.thresholds.level_waspada_max ??
              data.thresholds.waspada ??
              prev.level_waspada_max,
            level_siaga_max:
              data.thresholds.level_siaga_max ??
              data.thresholds.siaga ??
              prev.level_siaga_max,
            level_bahaya_min:
              data.thresholds.level_bahaya_min ??
              data.thresholds.bahaya ??
              prev.level_bahaya_min,
            flow_warning_lpm:
              data.thresholds.flow_warning_lpm ??
              data.thresholds.flowWarning ??
              prev.flow_warning_lpm,
            rain_heavy_pct:
              data.thresholds.rain_heavy_pct ??
              data.thresholds.heavyRain ??
              prev.rain_heavy_pct,
            auto_relay_enabled:
              data.thresholds.auto_relay_enabled ??
              data.thresholds.autoRelay ??
              prev.auto_relay_enabled,
            auto_buzzer_enabled:
              data.thresholds.auto_buzzer_enabled ??
              data.thresholds.autoBuzzer ??
              prev.auto_buzzer_enabled,
          };

          const isUnchanged =
            prev.sensor_mount_height_cm === next.sensor_mount_height_cm &&
            prev.level_aman_max === next.level_aman_max &&
            prev.level_waspada_max === next.level_waspada_max &&
            prev.level_siaga_max === next.level_siaga_max &&
            prev.level_bahaya_min === next.level_bahaya_min &&
            prev.flow_warning_lpm === next.flow_warning_lpm &&
            prev.rain_heavy_pct === next.rain_heavy_pct &&
            prev.auto_relay_enabled === next.auto_relay_enabled &&
            prev.auto_buzzer_enabled === next.auto_buzzer_enabled;

          return isUnchanged ? prev : next;
        });
      }

      // TELEGRAM
      if (data.telegramConfig) {
        setTelegramConfig((prev) => ({
          ...prev,
          ...data.telegramConfig,
          has_token: true,
        }));
      }

      // WHATSAPP (FONNTE)
      if (data.whatsAppConfig) {
        setWhatsAppConfig((prev) => ({
          ...prev,
          ...data.whatsAppConfig,
          has_token: Boolean(
            data.whatsAppConfig.fonnte_token &&
            data.whatsAppConfig.fonnte_token.trim(),
          ),
        }));
      }

      // ESP32
      if (data.esp32Status) {
        setEsp32Status((prev) => ({
          ...prev,
          ...data.esp32Status,
        }));
      }

      // DATABASE STATUS
      if (data.databaseStatus) {
        setDatabaseStatus(data.databaseStatus);
      }

      // WARNING SOUND
      const currentWarningLevel = data.sensorState?.warning_level ?? "AMAN";
      if (
        (currentWarningLevel === "SIAGA" || currentWarningLevel === "BAHAYA") &&
        previousLevelRef.current !== "SIAGA" &&
        previousLevelRef.current !== "BAHAYA"
      ) {
        playBuzzerBeep(1000, 500);
      } else if (
        currentWarningLevel === "WASPADA" &&
        previousLevelRef.current !== "WASPADA"
      ) {
        // Chime for waspada transition
        playBuzzerBeep(800, 250);
      }

      previousLevelRef.current = currentWarningLevel;
    } catch (err) {
      console.warn("Status poll warning:", err);
    }
  };

  // =====================================================
  // FETCH AUXILIARY DATA
  // =====================================================

  const fetchAuxiliaryData = async () => {
    try {
      const [histRes, evtRes, almRes, usrRes] = await Promise.all([
        fetch("/api/history"),
        fetch("/api/flood-events"),
        fetch("/api/alarm-logs"),
        fetch("/api/admin/users"),
      ]);

      if (histRes.ok) {
        const d = await histRes.json();
        setHistory(Array.isArray(d.history) ? d.history : []);
      }

      if (evtRes.ok) {
        const d = await evtRes.json();
        setFloodEvents(Array.isArray(d.events) ? d.events : []);
      }

      if (almRes.ok) {
        const d = await almRes.json();
        setAlarmLogs(Array.isArray(d.logs) ? d.logs : []);
      }

      if (usrRes.ok) {
        const d = await usrRes.json();
        setAdminUsers(Array.isArray(d.users) ? d.users : []);
      }
    } catch (err) {
      console.warn("Auxiliary data fetch error:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchAuxiliaryData();

    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleToggleSiren = () => {
    if (sirenActive) {
      stopEmergencySiren();
      setSirenActive(false);
    } else {
      startEmergencySiren();
      setSirenActive(true);
    }
  };

  const handleLoginSuccess = (user: AdminUser) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("ews_admin_user", JSON.stringify(user));
    } catch (err) {
      console.warn("Gagal menyimpan sesi admin:", err);
    }
    setCurrentView("admin");
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("ews_admin_user");
    } catch (err) {
      console.warn("Gagal menghapus sesi admin:", err);
    }
    setCurrentView("warga");
    setActiveNavSection("beranda");
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  };

  const handleUpdateThresholds = async (newThresholds: ThresholdSettings) => {
    try {
      setThresholds(newThresholds);
      try {
        localStorage.setItem("ews_thresholds", JSON.stringify(newThresholds));
      } catch {}

      const res = await fetch("/api/thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newThresholds),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.thresholds) {
          setThresholds(data.thresholds);
        }
        await fetchStatus();
      }
    } catch (err) {
      console.error("Gagal update thresholds:", err);
    }
  };

  const handleUpdateTelegram = async (newConfig: Partial<TelegramConfig>) => {
    try {
      const res = await fetch("/api/telegram/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error("Gagal update Telegram:", err);
    }
  };

  const handleSendTelegramBroadcast = async (message?: string) => {
    const res = await fetch("/api/telegram/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    return await res.json();
  };

  const handleUpdateWhatsApp = async (newConfig: Partial<WhatsAppConfig>) => {
    try {
      const res = await fetch("/api/whatsapp/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch (err) {
      console.error("Gagal update WhatsApp:", err);
    }
  };

  const handleSendWhatsAppBroadcast = async (
    message?: string,
    target?: string,
  ) => {
    const res = await fetch("/api/whatsapp/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, target }),
    });
    return await res.json();
  };

  const handleToggleRelay = async () => {
    const newState = !sensorState.relay_state;
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relay: newState }),
      });
      setSensorState((prev) => ({
        ...prev,
        relay_state: newState,
      }));
      playBuzzerBeep(600, 100);
    } catch (err) {
      console.error("Gagal toggle relay:", err);
    }
  };

  const handleToggleBuzzer = async () => {
    const newState = !sensorState.buzzer_state;
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buzzer: newState,
          admin_name:
            currentUser?.name || currentUser?.username || "Bambang Sutrisno",
        }),
      });
      setSensorState((prev) => ({
        ...prev,
        buzzer_state: newState,
      }));
      if (newState) {
        playBuzzerBeep(1200, 400);
      }
      fetchAuxiliaryData();
    } catch (err) {
      console.error("Gagal toggle buzzer:", err);
    }
  };

  const handleSimulateSensor = async (
    water: number,
    flow: number,
    rain: number,
  ) => {
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          water_level_cm: water,
          flow_rate_lpm: flow,
          rain_pct: rain,
        }),
      });
      await fetchStatus();
      await fetchAuxiliaryData();
      playBuzzerBeep(800, 150);
    } catch (err) {
      console.error("Gagal simulasi sensor:", err);
    }
  };

  const handleAddFloodEvent = async (cause: string, notes: string) => {
    try {
      const res = await fetch("/api/flood-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cause,
          action_notes: notes,
        }),
      });
      if (res.ok) {
        await fetchAuxiliaryData();
      }
    } catch (err) {
      console.error("Gagal menambahkan kejadian banjir:", err);
    }
  };

  const handleAddAdminUser = async (
    name: string,
    username: string,
    password: string,
    role: string,
  ) => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username, password, role }),
      });
      if (res.ok) {
        await fetchAuxiliaryData();
      }
    } catch (err) {
      console.error("Gagal tambah admin:", err);
    }
  };

  const handleDeleteAdminUser = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAuxiliaryData();
      }
    } catch (err) {
      console.error("Gagal hapus admin:", err);
    }
  };

  const handleUpdateAdminUser = async (
    id: string,
    data: {
      name?: string;
      username?: string;
      password?: string;
      role?: string;
    },
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchAuxiliaryData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Gagal perbarui data petugas:", err);
      return false;
    }
  };

  const handleUpdateAlarmDuration = async (
    id: string,
    duration_seconds: number,
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/alarm-logs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration_seconds }),
      });
      if (res.ok) {
        await fetchAuxiliaryData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Gagal ubah durasi alarm:", err);
      return false;
    }
  };

  const handleDeleteAlarmLog = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/alarm-logs/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAuxiliaryData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Gagal hapus log alarm:", err);
      return false;
    }
  };

  const handleFixAll60Alarms = async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/alarm-logs/fix-all-durations", {
        method: "POST",
      });
      if (res.ok) {
        await fetchAuxiliaryData();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Gagal perbaiki durasi alarm:", err);
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <Header
        currentView={currentView}
        setCurrentView={setCurrentView}
        activeNavSection={activeNavSection}
        setActiveNavSection={setActiveNavSection}
        warningLevel={sensorState.warning_level}
        espOnline={esp32Status.online}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        sirenActive={sirenActive}
        onToggleSiren={handleToggleSiren}
        onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentView === "warga" ? (
          <WargaView
            sensorState={sensorState}
            thresholds={thresholds}
            telegramConfig={telegramConfig}
            whatsAppConfig={whatsAppConfig}
            history={history}
            floodEvents={floodEvents}
            espOnline={esp32Status.online}
            onPlaySirenTest={handleToggleSiren}
            onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
          />
        ) : currentUser ? (
          <AdminView
            sensorState={sensorState}
            thresholds={thresholds}
            telegramConfig={telegramConfig}
            whatsAppConfig={whatsAppConfig}
            esp32Status={esp32Status}
            history={history}
            floodEvents={floodEvents}
            alarmLogs={alarmLogs}
            adminUsers={adminUsers}
            currentUser={currentUser}
            databaseStatus={databaseStatus}
            onReturnToWarga={() => setCurrentView("warga")}
            onUpdateThresholds={handleUpdateThresholds}
            onUpdateTelegram={handleUpdateTelegram}
            onSendTelegramBroadcast={handleSendTelegramBroadcast}
            onUpdateWhatsApp={handleUpdateWhatsApp}
            onSendWhatsAppBroadcast={handleSendWhatsAppBroadcast}
            onToggleRelay={handleToggleRelay}
            onToggleBuzzer={handleToggleBuzzer}
            onSimulateSensor={handleSimulateSensor}
            onAddFloodEvent={handleAddFloodEvent}
            onAddAdminUser={handleAddAdminUser}
            onUpdateAdminUser={handleUpdateAdminUser}
            onDeleteAdminUser={handleDeleteAdminUser}
            onUpdateAlarmDuration={handleUpdateAlarmDuration}
            onDeleteAlarmLog={handleDeleteAlarmLog}
            onFixAll60Alarms={handleFixAll60Alarms}
          />
        ) : (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl max-w-md mx-auto p-8 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mx-auto mb-4 font-bold">
              <Shield className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Akses Terbatas Petugas
            </h3>

            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Silakan masuk dengan akun terdaftar untuk mengakses dashboard
              kontrol dan konfigurasi sensor EWS.
            </p>

            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="px-6 py-2.5 bg-[#0066cc] hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
            >
              Buka Form Login Admin
            </button>
          </div>
        )}
      </main>

      {currentView === "warga" && (
        <footer className="border-t border-slate-200 bg-white py-5 text-xs text-slate-500 mt-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">
              © 2026 Smart EWS Banjir — Sistem Peringatan Dini Berbasis IoT
              ESP32
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Sensor: HC-SR04 • YF-S201 • Rain Water Level • ESP32
            </span>
          </div>
        </footer>
      )}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {isTelegramModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 no-scrollbar overflow-y-auto"
          onClick={() => setIsTelegramModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 max-w-sm w-full text-center shadow-2xl relative my-auto max-h-[92vh] flex flex-col no-scrollbar overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setIsTelegramModalOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors text-sm font-bold z-10"
              aria-label="Tutup Modal"
            >
              ✕
            </button>

            <div className="mb-1 mt-0.5">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                QR Code Grup Resmi
              </span>
            </div>

            <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl mb-1">
              {whatsAppConfig.group_name || "Grup WhatsApp Siaga Banjir"}
            </h3>

            <p className="text-xs text-slate-600 mb-3.5 leading-relaxed max-w-xs mx-auto">
              Arahkan kamera HP ke kode QR di bawah untuk langsung bergabung ke
              grup WhatsApp warga dan menerima peringatan darurat otomatis.
            </p>

            <div className="w-44 h-44 sm:w-48 sm:h-48 mx-auto bg-white p-2.5 rounded-2xl border-2 border-slate-200 flex items-center justify-center shadow-xs mb-3 shrink-0">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=6&color=0066cc&data=${encodeURIComponent(
                  whatsAppConfig.group_invite_link ||
                    "https://chat.whatsapp.com/Ftbc0fqXT2g3qHMTfsPEMh?mode=gi_t",
                )}`}
                alt="QR Code Grup WhatsApp Siaga Banjir"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-blue-700 break-all mb-3.5 select-all">
              {whatsAppConfig.group_invite_link}
            </div>

            <div className="flex gap-2.5 pt-0.5 mt-auto">
              <button
                type="button"
                onClick={() => setIsTelegramModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Tutup
              </button>

              <a
                href={whatsAppConfig.group_invite_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 bg-[#0066cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <span>Buka WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
