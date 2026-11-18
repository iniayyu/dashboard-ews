import React, { useEffect, useState } from "react";
import {
  Activity,
  Sliders,
  History,
  AlertTriangle,
  Cpu,
  FileSpreadsheet,
  Users,
  Send,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Wifi,
  ArrowLeft,
  ChevronRight,
  MessageCircle,
  Clock,
  Edit3,
} from "lucide-react";

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
} from "../types";

import { WaterLevelGauge } from "./WaterLevelGauge";
import { SensorCard } from "./SensorCard";
import { HistoricalCharts } from "./HistoricalCharts";

interface AdminViewProps {
  sensorState: SensorState;
  thresholds: ThresholdSettings;
  telegramConfig?: TelegramConfig;
  whatsAppConfig?: WhatsAppConfig;
  esp32Status: Esp32Status;
  history: HistoryPoint[];
  floodEvents: FloodEvent[];
  alarmLogs: AlarmLog[];
  adminUsers: AdminUser[];
  currentUser: AdminUser;

  onReturnToWarga: () => void;
  onUpdateThresholds: (newThresholds: ThresholdSettings) => Promise<void>;
  onUpdateTelegram?: (newConfig: Partial<TelegramConfig>) => Promise<void>;
  onSendTelegramBroadcast?: (message?: string) => Promise<{
    status?: string;
    ok?: boolean;
    success?: boolean;
    mode?: string;
    simulated?: boolean;
    message?: string;
    error?: string;
  }>;
  onUpdateWhatsApp?: (newConfig: Partial<WhatsAppConfig>) => Promise<void>;
  onSendWhatsAppBroadcast?: (
    message?: string,
    target?: string,
  ) => Promise<{
    status?: string;
    ok?: boolean;
    success?: boolean;
    mode?: string;
    simulated?: boolean;
    message?: string;
    error?: string;
  }>;
  onToggleRelay: () => Promise<void>;
  onToggleBuzzer: () => Promise<void>;
  onAddFloodEvent?: (cause: string, notes: string) => Promise<void>;
  onAddAdminUser: (
    name: string,
    username: string,
    password: string,
    role: string,
  ) => Promise<void>;
  onDeleteAdminUser: (id: string) => Promise<void>;
  onUpdateAdminUser?: (
    id: string,
    data: {
      name?: string;
      username?: string;
      password?: string;
      role?: string;
    },
  ) => Promise<boolean>;
  databaseStatus?: DatabaseStatus | null;
  onTestDatabase?: () => Promise<void>;
  onSyncDatabase?: () => Promise<void>;
  onUpdateAlarmDuration?: (
    id: string,
    duration_seconds: number,
  ) => Promise<boolean>;
  onDeleteAlarmLog?: (id: string) => Promise<boolean>;
  onFixAll60Alarms?: () => Promise<boolean>;
}

type AdminTab =
  | "realtime"
  | "charts"
  | "events"
  | "thresholds"
  | "notifications"
  | "alarms"
  | "admins";

const TAB_SLUGS: Record<AdminTab, string> = {
  realtime: "monitoring",
  charts: "grafik",
  events: "kejadian",
  thresholds: "threshold",
  notifications: "whatsapp",
  alarms: "alarm",
  admins: "admin",
};

const tabFromPath = (): AdminTab =>
  (Object.keys(TAB_SLUGS) as AdminTab[]).find(
    (t) => TAB_SLUGS[t] === window.location.pathname.split("/")[2],
  ) ?? "realtime";

export const AdminView: React.FC<AdminViewProps> = ({
  sensorState,
  thresholds,
  whatsAppConfig,
  esp32Status,
  history,
  floodEvents,
  alarmLogs,
  adminUsers,
  currentUser,
  databaseStatus: _databaseStatus,
  onReturnToWarga,
  onUpdateThresholds,
  onUpdateWhatsApp,
  onSendWhatsAppBroadcast,
  onToggleRelay,
  onToggleBuzzer,
  onAddAdminUser,
  onDeleteAdminUser,
  onTestDatabase: _onTestDatabase,
  onSyncDatabase: _onSyncDatabase,
  onUpdateAlarmDuration,
  onDeleteAlarmLog,
  onFixAll60Alarms: _onFixAll60Alarms,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>(tabFromPath);

  const [editingAlarm, setEditingAlarm] = useState<AlarmLog | null>(null);
  const [editDurationSecs, setEditDurationSecs] = useState<number>(0);
  const [savingAlarmEdit, setSavingAlarmEdit] = useState(false);

  const handleSaveAlarmDuration = async () => {
    if (!editingAlarm || !onUpdateAlarmDuration) return;
    try {
      setSavingAlarmEdit(true);
      const ok = await onUpdateAlarmDuration(editingAlarm.id, editDurationSecs);
      if (ok) {
        setEditingAlarm(null);
      }
    } finally {
      setSavingAlarmEdit(false);
    }
  };

  const handleDeleteAlarm = async (id: string) => {
    if (!onDeleteAlarmLog) return;
    if (!window.confirm(`Hapus catatan riwayat alarm ${id}?`)) return;
    await onDeleteAlarmLog(id);
  };

  useEffect(() => {
    const path = `/admin/${TAB_SLUGS[activeTab]}`;
    if (window.location.pathname === path) return;
    const bare = /^\/admin\/?$/.test(window.location.pathname);
    window.history[bare ? "replaceState" : "pushState"](null, "", path);
  }, [activeTab]);

  useEffect(() => {
    const onPop = () => setActiveTab(tabFromPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const [_localThresholds, setLocalThresholds] =
    useState<ThresholdSettings>(thresholds);

  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdSavedSuccess, setThresholdSavedSuccess] = useState(false);
  const [showThresholdSuccessModal, setShowThresholdSuccessModal] =
    useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const thresholdTouchedRef = React.useRef(false);

  const [thresholdDraft, setThresholdDraft] = useState({
    sensor_mount_height_cm: String(thresholds.sensor_mount_height_cm ?? 20),
    level_aman_max: String(thresholds.level_aman_max ?? 3),
    level_waspada_max: String(thresholds.level_waspada_max ?? 6),
    level_siaga_max: String(thresholds.level_siaga_max ?? 10),
    flow_warning_lpm: String(thresholds.flow_warning_lpm ?? 45),
    rain_heavy_pct: String(thresholds.rain_heavy_pct ?? 65),
    auto_relay_enabled: thresholds.auto_relay_enabled ?? true,
    auto_buzzer_enabled: thresholds.auto_buzzer_enabled ?? true,
  });

  const [fonnteToken, setFonnteToken] = useState(
    whatsAppConfig?.fonnte_token || "STeoGKW9vv8coTDzUETW",
  );
  const [targetNumber, setTargetNumber] = useState(
    whatsAppConfig?.target_number || "120363431321582251@g.us",
  );
  const [waGroupName, setWaGroupName] = useState(
    whatsAppConfig?.group_name || "Grup Warga Siaga Banjir",
  );
  const [waInviteLink, setWaInviteLink] = useState(
    whatsAppConfig?.group_invite_link ||
      "https://chat.whatsapp.com/Ftbc0fqXT2g3qHMTfsPEMh?mode=gi_t",
  );
  const [waNotifyWaspada, setWaNotifyWaspada] = useState(
    whatsAppConfig?.notify_waspada ?? true,
  );
  const [waNotifySiaga, setWaNotifySiaga] = useState(
    whatsAppConfig?.notify_siaga ?? true,
  );

  const [savingWhatsApp, setSavingWhatsApp] = useState(false);
  const [whatsAppSavedSuccess, setWhatsAppSavedSuccess] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null);

  const [customWaBroadcastMsg, setCustomWaBroadcastMsg] = useState("");
  const [waBroadcastLoading, setWaBroadcastLoading] = useState(false);
  const [waBroadcastResult, setWaBroadcastResult] = useState<string | null>(
    null,
  );

  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<
    { id: string; name: string }[]
  >([]);
  const [fetchGroupMsg, setFetchGroupMsg] = useState<string | null>(null);

  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [unlockAddAdminInputs, setUnlockAddAdminInputs] = useState(false);

  useEffect(() => {
    if (!thresholdTouchedRef.current) {
      setLocalThresholds(thresholds);
      setThresholdDraft({
        sensor_mount_height_cm: String(
          thresholds.sensor_mount_height_cm ?? 250,
        ),
        level_aman_max: String(thresholds.level_aman_max ?? 120),
        level_waspada_max: String(thresholds.level_waspada_max ?? 160),
        level_siaga_max: String(thresholds.level_siaga_max ?? 200),
        flow_warning_lpm: String(thresholds.flow_warning_lpm ?? 45),
        rain_heavy_pct: String(thresholds.rain_heavy_pct ?? 65),
        auto_relay_enabled: thresholds.auto_relay_enabled ?? true,
        auto_buzzer_enabled: thresholds.auto_buzzer_enabled ?? true,
      });
    }
  }, [thresholds]);

  const waTouchedRef = React.useRef(false);

  useEffect(() => {
    if (whatsAppConfig && !waTouchedRef.current) {
      setFonnteToken(whatsAppConfig.fonnte_token || "STeoGKW9vv8coTDzUETW");
      setTargetNumber(
        whatsAppConfig.target_number || "120363431321582251@g.us",
      );
      setWaGroupName(whatsAppConfig.group_name || "Grup Warga Siaga Banjir");
      setWaInviteLink(
        whatsAppConfig.group_invite_link ||
          "https://chat.whatsapp.com/Ftbc0fqXT2g3qHMTfsPEMh?mode=gi_t",
      );
      setWaNotifyWaspada(whatsAppConfig.notify_waspada ?? true);
      setWaNotifySiaga(whatsAppConfig.notify_siaga ?? true);
    }
  }, [whatsAppConfig]);

  const menuItems: Array<{
    id: AdminTab;
    label: string;
    icon: React.ElementType;
  }> = [
    { id: "realtime", label: "Monitoring", icon: Activity },
    { id: "charts", label: "Grafik", icon: History },
    { id: "events", label: "Kejadian", icon: FileSpreadsheet },
    { id: "thresholds", label: "Threshold", icon: Sliders },
    { id: "notifications", label: "WhatsApp", icon: MessageCircle },
    { id: "alarms", label: "Alarm", icon: AlertTriangle },
    { id: "admins", label: "Admin", icon: Users },
  ];

  const activeMenu = menuItems.find((item) => item.id === activeTab);

  const isThresholdDirty =
    thresholdDraft.sensor_mount_height_cm !==
      String(thresholds.sensor_mount_height_cm ?? 250) ||
    thresholdDraft.level_aman_max !==
      String(thresholds.level_aman_max ?? 120) ||
    thresholdDraft.level_waspada_max !==
      String(thresholds.level_waspada_max ?? 160) ||
    thresholdDraft.level_siaga_max !==
      String(thresholds.level_siaga_max ?? 200) ||
    thresholdDraft.flow_warning_lpm !==
      String(thresholds.flow_warning_lpm ?? 45) ||
    thresholdDraft.rain_heavy_pct !== String(thresholds.rain_heavy_pct ?? 65) ||
    thresholdDraft.auto_relay_enabled !==
      (thresholds.auto_relay_enabled ?? true) ||
    thresholdDraft.auto_buzzer_enabled !==
      (thresholds.auto_buzzer_enabled ?? true);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();

    setThresholdError(null);
    setThresholdSavedSuccess(false);

    const mountHeight = Number(thresholdDraft.sensor_mount_height_cm);
    const amanMax = Number(thresholdDraft.level_aman_max);
    const waspadaMax = Number(thresholdDraft.level_waspada_max);
    const siagaMax = Number(thresholdDraft.level_siaga_max);
    const flowWarning = Number(thresholdDraft.flow_warning_lpm || 45);
    const rainHeavy = Number(thresholdDraft.rain_heavy_pct || 65);

    if (
      isNaN(mountHeight) ||
      mountHeight <= 0 ||
      isNaN(amanMax) ||
      amanMax <= 0 ||
      isNaN(waspadaMax) ||
      waspadaMax <= 0 ||
      isNaN(siagaMax) ||
      siagaMax <= 0
    ) {
      setThresholdError(
        "Semua nilai tinggi tiang, batas aman, waspada, dan siaga harus diisi dengan angka lebih besar dari 0 cm.",
      );
      return;
    }

    if (amanMax >= waspadaMax) {
      setThresholdError(
        `Batas Maksimal Aman (${amanMax} cm) harus lebih kecil dari Batas Waspada (${waspadaMax} cm).`,
      );
      return;
    }

    if (waspadaMax >= siagaMax) {
      setThresholdError(
        `Batas Maksimal Waspada (${waspadaMax} cm) harus lebih kecil dari Batas Siaga (${siagaMax} cm).`,
      );
      return;
    }

    if (siagaMax > mountHeight) {
      setThresholdError(
        `Batas Maksimal Siaga (${siagaMax} cm) tidak boleh lebih tinggi dari Tiang Sensor (${mountHeight} cm).`,
      );
      return;
    }

    try {
      setSavingThresholds(true);

      const payload: ThresholdSettings = {
        sensor_mount_height_cm: mountHeight,
        level_aman_max: amanMax,
        level_waspada_max: waspadaMax,
        level_siaga_max: siagaMax,
        level_bahaya_min: siagaMax,
        flow_warning_lpm:
          isNaN(flowWarning) || flowWarning <= 0 ? 45 : flowWarning,
        rain_heavy_pct: isNaN(rainHeavy) || rainHeavy <= 0 ? 65 : rainHeavy,
        auto_relay_enabled: Boolean(thresholdDraft.auto_relay_enabled),
        auto_buzzer_enabled: Boolean(thresholdDraft.auto_buzzer_enabled),
      };

      await onUpdateThresholds(payload);

      setLocalThresholds(payload);
      thresholdTouchedRef.current = false;

      try {
        localStorage.setItem("ews_thresholds", JSON.stringify(payload));
      } catch {}

      setThresholdSavedSuccess(true);
      setShowThresholdSuccessModal(true);

      window.setTimeout(() => {
        setThresholdSavedSuccess(false);
      }, 4000);
    } catch (error: any) {
      setThresholdError(
        error?.message || "Gagal menyimpan konfigurasi threshold.",
      );
    } finally {
      setSavingThresholds(false);
    }
  };

  const handleResetThresholds = () => {
    thresholdTouchedRef.current = false;
    setThresholdDraft({
      sensor_mount_height_cm: String(thresholds.sensor_mount_height_cm ?? 20),
      level_aman_max: String(thresholds.level_aman_max ?? 3),
      level_waspada_max: String(thresholds.level_waspada_max ?? 6),
      level_siaga_max: String(thresholds.level_siaga_max ?? 10),
      flow_warning_lpm: String(thresholds.flow_warning_lpm ?? 45),
      rain_heavy_pct: String(thresholds.rain_heavy_pct ?? 65),
      auto_relay_enabled: thresholds.auto_relay_enabled ?? true,
      auto_buzzer_enabled: thresholds.auto_buzzer_enabled ?? true,
    });
    setLocalThresholds(thresholds);
    setThresholdError(null);
  };

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhatsAppError(null);
    setWhatsAppSavedSuccess(false);

    try {
      setSavingWhatsApp(true);
      if (onUpdateWhatsApp) {
        await onUpdateWhatsApp({
          fonnte_token: fonnteToken.trim(),
          target_number: targetNumber.trim(),
          group_name: waGroupName.trim(),
          group_invite_link: waInviteLink.trim(),
          notify_waspada: waNotifyWaspada,
          notify_siaga: waNotifySiaga,
        });
      } else {
        await fetch("/api/whatsapp/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fonnte_token: fonnteToken.trim(),
            target_number: targetNumber.trim(),
            group_name: waGroupName.trim(),
            group_invite_link: waInviteLink.trim(),
            notify_waspada: waNotifyWaspada,
            notify_siaga: waNotifySiaga,
          }),
        });
      }
      setWhatsAppSavedSuccess(true);
      window.setTimeout(() => setWhatsAppSavedSuccess(false), 3000);
    } catch (err: any) {
      setWhatsAppError(err?.message || "Gagal menyimpan konfigurasi WhatsApp.");
    } finally {
      setSavingWhatsApp(false);
    }
  };

  const handleWaBroadcast = async () => {
    setWaBroadcastLoading(true);
    setWaBroadcastResult(null);

    try {
      let resData: any;
      if (onSendWhatsAppBroadcast) {
        resData = await onSendWhatsAppBroadcast(
          customWaBroadcastMsg.trim() || undefined,
          targetNumber.trim() || undefined,
        );
      } else {
        const res = await fetch("/api/whatsapp/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: customWaBroadcastMsg.trim() || undefined,
            target: targetNumber.trim() || undefined,
          }),
        });
        resData = await res.json();
      }

      if (
        resData?.ok ||
        resData?.status === "success" ||
        resData?.status === "simulated"
      ) {
        setWaBroadcastResult(
          `✅ ${resData?.message || "Pesan WhatsApp berhasil dikirim!"}`,
        );
        setCustomWaBroadcastMsg("");
      } else {
        setWaBroadcastResult(
          `❌ Gagal: ${resData?.message || resData?.error || "Gagal mengirim via Fonnte."}`,
        );
      }
    } catch (err: any) {
      setWaBroadcastResult(
        `❌ Kesalahan: ${err?.message || "Koneksi terputus"}`,
      );
    } finally {
      setWaBroadcastLoading(false);
    }
  };

  const handleFetchGroups = async () => {
    setFetchingGroups(true);
    setFetchGroupMsg(null);
    try {
      const res = await fetch("/api/whatsapp/fetch-groups", { method: "POST" });
      const data = await res.json();
      if (data?.groups && data.groups.length > 0) {
        setAvailableGroups(data.groups);
        setFetchGroupMsg(
          `✅ Ditemukan ${data.groups.length} grup WhatsApp! Silakan klik grup di bawah.`,
        );
      } else {
        setAvailableGroups([]);
        setFetchGroupMsg(
          data?.message ||
            "Belum ada grup yang terdeteksi di Fonnte. Pastikan nomor bot Fonnte Anda sudah masuk ke grup dan aktif.",
        );
      }
    } catch (err: any) {
      setFetchGroupMsg(
        `❌ Gagal mengambil grup: ${err?.message || "Koneksi terputus"}`,
      );
    } finally {
      setFetchingGroups(false);
    }
  };

  const downloadExcelTable = (
    filename: string,
    sheetTitle: string,
    headers: string[],
    rows: (string | number)[][],
  ) => {
    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          body { font-family: Calibri, Arial, sans-serif; }
          .title { font-size: 14pt; font-weight: bold; color: #0066cc; margin-bottom: 6px; }
          .subtitle { font-size: 10pt; color: #555555; margin-bottom: 12px; }
          th { background-color: #0066cc; color: #ffffff; font-weight: bold; border: 1px solid #004c99; padding: 8px 12px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 6px 12px; }
          .even { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="title">SMART EWS - Posko Banjir Taman Cipulir Estate</div>
        <div class="subtitle">${sheetTitle} — Waktu Unduh: ${new Date().toLocaleString("id-ID")} WIB</div>
        <table border="1">
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r, i) =>
                  `<tr class="${i % 2 === 0 ? "even" : ""}">
                    ${r
                      .map(
                        (c) =>
                          `<td>${String(c ?? "")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")}</td>`,
                      )
                      .join("")}
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${filename}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportExcelKejadian = () => {
    const headers = [
      "ID Insiden",
      "Waktu Kejadian",
      "Puncak Ketinggian (cm)",
      "Puncak Debit (L/min)",
      "Status Maksimal",
    ];

    const rows = floodEvents.map((e) => [
      e.id,
      e.start_time,
      e.peak_water_level_cm,
      e.peak_flow_rate_lpm,
      e.max_warning_level,
    ]);

    downloadExcelTable(
      `rekap_kejadian_banjir_${new Date().toISOString().slice(0, 10)}`,
      "Rekap Kejadian Banjir",
      headers,
      rows,
    );
  };

  const handleExportExcelAlarm = () => {
    const headers = [
      "ID Alarm",
      "Waktu Aktivasi",
      "Status Level",
      "Alasan Pemicu",
      "Durasi Berbunyi (Detik)",
      "Dihentikan Oleh",
    ];

    const rows = alarmLogs.map((a) => [
      a.id,
      a.timestamp,
      a.level,
      a.trigger_reason,
      a.duration_seconds,
      a.stopped_by,
    ]);

    downloadExcelTable(
      `riwayat_alarm_sirine_${new Date().toISOString().slice(0, 10)}`,
      "Riwayat Alarm & Sirine Posko",
      headers,
      rows,
    );
  };

  const handleAddAdmin = async () => {
    if (!newAdminName.trim()) {
      alert("Harap isi nama lengkap admin!");
      return;
    }

    if (!newAdminPassword || newAdminPassword.length < 4) {
      alert("Kata sandi minimal 4 karakter.");
      return;
    }

    try {
      setSavingAdmin(true);

      const generatedId = `ADM-0${adminUsers.length + 1}`;

      await onAddAdminUser(
        newAdminName.trim(),
        generatedId,
        newAdminPassword,
        "Admin Posko",
      );

      setShowAddAdminModal(false);

      alert(
        `✅ Akun admin berhasil ditambahkan!\n\n` +
          `• ID Login: ${generatedId}\n` +
          `• Nama: ${newAdminName.trim()}\n` +
          `• Kata Sandi: ${newAdminPassword}\n\n` +
          `Anda dapat keluar (logout) dan langsung mencoba login menggunakan ID "${generatedId}" atau nama "${newAdminName.trim()}".`,
      );

      setNewAdminName("");
      setNewAdminPassword("");
    } catch (error: any) {
      alert(error?.message || "Gagal membuat akun admin.");
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (user: AdminUser) => {
    if (user.id === currentUser.id) {
      alert("Akun yang sedang digunakan tidak dapat dihapus.");
      return;
    }

    const confirmed = window.confirm(
      `Hapus akun ${user.name} (${user.username}) dari sistem?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await onDeleteAdminUser(user.id);
    } catch (error: any) {
      alert(error?.message || "Gagal menghapus akun admin.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex flex-col md:flex-row min-h-screen">
        <aside
          className="
            hidden md:flex
            fixed left-0 top-0 bottom-0
            w-60 lg:w-64
            bg-white
            text-slate-800
            border-r border-slate-200
            flex-col
            z-40
            overflow-hidden
          "
        >
          <div className="px-6 pt-7 pb-6 shrink-0">
            <div className="text-2xl font-black tracking-tight text-[#0066cc]">
              SMART EWS
            </div>

            <div className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
              Panel Administrator
            </div>
          </div>

          <nav className="px-3 py-2 space-y-2 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`
                    w-full
                    flex
                    items-center
                    gap-3
                    px-4
                    py-3
                    rounded-lg
                    text-sm
                    font-semibold
                    transition-all
                    cursor-pointer
                    ${
                      isActive
                        ? "bg-blue-50 text-[#0066cc] border border-blue-100 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-[#0066cc]"
                    }
                  `}
                >
                  <Icon
                    className={`w-[18px] h-[18px] shrink-0 ${
                      isActive ? "text-[#0066cc]" : "text-slate-500"
                    }`}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-slate-200 shrink-0">
            <button
              type="button"
              onClick={onReturnToWarga}
              className="w-full px-4 py-3 rounded-xl bg-[#0066cc] text-white hover:bg-blue-700 text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Tampilan Warga</span>
            </button>
          </div>
        </aside>

        <div className="md:hidden bg-white text-slate-800 border-b border-slate-200 shadow-xs">
          <div className="px-3 py-2.5 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`
                      px-3 py-2 rounded-lg
                      flex items-center gap-1.5
                      text-xs font-bold cursor-pointer
                      ${
                        isActive
                          ? "bg-[#0066cc] text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#0066cc]"
                      }
                    `}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <main className="flex-1 md:ml-60 lg:ml-64 min-w-0 pt-0">
          <div className="px-4 sm:px-6 lg:px-8 pt-0 pb-6 lg:pb-8">
            <div className="mb-3">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {activeMenu?.label || "Monitoring"}
              </h1>

              <p className="text-sm text-slate-500 mt-1">
                Dashboard Kontrol & Telemetri EWS — Taman Cipulir Estate, Cipadu
                Jaya, Tangerang Selatan
              </p>
            </div>

            {/* 1. MONITORING */}
            {activeTab === "realtime" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
                  <div className="xl:col-span-5">
                    <WaterLevelGauge
                      waterLevelCm={sensorState.water_level_cm}
                      distanceCm={sensorState.distance_cm}
                      warningLevel={sensorState.warning_level}
                      thresholds={thresholds}
                    />
                  </div>

                  <div className="xl:col-span-7 flex flex-col justify-between">
                    <SensorCard
                      flowRateLpm={sensorState.flow_rate_lpm}
                      waterSpeedMps={sensorState.water_speed_mps}
                      rainPct={sensorState.rain_pct}
                      rainAnalog={sensorState.rain_analog}
                      rainStatus={sensorState.rain_status}
                      relayState={sensorState.relay_state}
                      buzzerState={sensorState.buzzer_state}
                      sirenElapsedSeconds={sensorState.siren_elapsed_seconds}
                      ledIndicator={sensorState.led_indicator}
                      warningLevel={sensorState.warning_level}
                      onToggleRelay={onToggleRelay}
                      onToggleBuzzer={onToggleBuzzer}
                      isAdmin={true}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. CHARTS */}
            {activeTab === "charts" && (
              <div className="space-y-6">
                <HistoricalCharts history={history} thresholds={thresholds} />
              </div>
            )}

            {/* 3. EVENTS */}
            {activeTab === "events" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">
                      Riwayat Kejadian Banjir
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Log insiden banjir yang terdeteksi otomatis oleh sensor
                      sistem EWS.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportExcelKejadian}
                      disabled={floodEvents.length === 0}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 text-xs font-bold flex items-center gap-1.5 border border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Export Excel</span>
                    </button>
                  </div>
                </div>

                {floodEvents.length === 0 ? (
                  <div className="py-14 text-center text-sm text-slate-400">
                    Belum ada data kejadian banjir.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">ID</th>
                          <th className="p-3.5">Waktu</th>
                          <th className="p-3.5">Level</th>
                          <th className="p-3.5">Puncak Air</th>
                          <th className="p-3.5">Debit</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {floodEvents.map((evt) => (
                          <tr key={evt.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-mono font-bold text-blue-700">
                              {evt.id}
                            </td>

                            <td className="p-3.5 whitespace-nowrap">
                              {evt.start_time}
                            </td>

                            <td className="p-3.5">
                              {(() => {
                                const raw = evt.max_warning_level as string;
                                const displayLevel =
                                  raw === "BAHAYA" ? "SIAGA" : raw;
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

                            <td className="p-3.5 font-mono font-bold text-slate-900">
                              {evt.peak_water_level_cm} cm
                            </td>

                            <td className="p-3.5 font-mono">
                              {evt.peak_flow_rate_lpm} L/min
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 4. THRESHOLD */}
            {activeTab === "thresholds" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                <div className="mb-6 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                      <Sliders className="w-5 h-5 text-[#0066cc]" />
                      Pengaturan Threshold & Ambang Batas
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Atur batas level ketinggian air, debit sungai, curah
                      hujan, dan logika otomatisasi sistem EWS.
                    </p>
                  </div>

                  {isThresholdDirty && (
                    <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1.5 animate-pulse self-start sm:self-center">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Ada Perubahan Belum Disimpan
                    </span>
                  )}
                </div>

                {thresholdSavedSuccess && (
                  <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>
                      Konfigurasi threshold berhasil disimpan dan langsung
                      diterapkan ke sistem!
                    </span>
                  </div>
                )}

                {thresholdError && (
                  <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>{thresholdError}</span>
                  </div>
                )}

                <form onSubmit={handleSaveThresholds} className="space-y-6">
                  {/* SENSOR MOUNT */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div>
                        <label className="block font-bold text-slate-800 text-xs">
                          Tinggi Tiang Sensor HC-SR04 (cm){" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Jarak posisi sensor dari dasar sungai untuk
                          menghitung:{" "}
                          <code>
                            Tinggi Air = Tinggi Tiang - Jarak Pantulan
                          </code>
                          .
                        </p>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-md self-start sm:self-auto">
                        Patokan Dasar Kali
                      </span>
                    </div>

                    <input
                      type="number"
                      min="10"
                      max="1000"
                      step="1"
                      value={thresholdDraft.sensor_mount_height_cm}
                      onChange={(e) => {
                        thresholdTouchedRef.current = true;
                        setThresholdDraft((prev) => ({
                          ...prev,
                          sensor_mount_height_cm: e.target.value,
                        }));
                      }}
                      className="w-full sm:w-64 bg-white border border-slate-300 rounded-xl px-4 py-2.5 font-mono font-bold text-sm text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Contoh: 250"
                    />
                  </div>

                  {/* 3 LEVELS: AMAN, WASPADA, SIAGA */}
                  <div className="space-y-2">
                    <label className="block font-bold text-slate-800 text-xs uppercase tracking-wider">
                      Batas Ketinggian Muka Air (Tinggi Muka Air Sungai)
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
                      {/* LEVEL AMAN */}
                      <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 flex flex-col justify-between h-full">
                        <div className="flex flex-col flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2 min-h-[44px]">
                            <label className="block font-bold text-emerald-900 text-xs leading-tight">
                              Batas Maksimal AMAN (cm)
                            </label>
                            <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded whitespace-nowrap">
                              LED Hijau
                            </span>
                          </div>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={thresholdDraft.level_aman_max}
                            onChange={(e) => {
                              thresholdTouchedRef.current = true;
                              setThresholdDraft((prev) => ({
                                ...prev,
                                level_aman_max: e.target.value,
                              }));
                            }}
                            className="w-full bg-white border border-emerald-300 rounded-xl px-4 py-2.5 font-mono font-bold text-emerald-900 text-sm focus:ring-2 focus:ring-emerald-500 mt-auto"
                            placeholder="Contoh: 120"
                          />
                        </div>
                        <p className="text-[11px] text-emerald-700 mt-2.5 leading-snug min-h-[32px] flex items-center">
                          <span>
                            Tinggi air 0 s/d{" "}
                            <strong>
                              {thresholdDraft.level_aman_max || 0} cm
                            </strong>{" "}
                            (Kondisi Normal)
                          </span>
                        </p>
                      </div>

                      {/* LEVEL WASPADA */}
                      <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 flex flex-col justify-between h-full">
                        <div className="flex flex-col flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2 min-h-[44px]">
                            <label className="block font-bold text-amber-900 text-xs leading-tight">
                              Batas Maksimal WASPADA (cm)
                            </label>
                            <span className="shrink-0 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded whitespace-nowrap">
                              LED Kuning & WA
                            </span>
                          </div>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={thresholdDraft.level_waspada_max}
                            onChange={(e) => {
                              thresholdTouchedRef.current = true;
                              setThresholdDraft((prev) => ({
                                ...prev,
                                level_waspada_max: e.target.value,
                              }));
                            }}
                            className="w-full bg-white border border-amber-300 rounded-xl px-4 py-2.5 font-mono font-bold text-amber-900 text-sm focus:ring-2 focus:ring-amber-500 mt-auto"
                            placeholder="Contoh: 160"
                          />
                        </div>
                        <p className="text-[11px] text-amber-800 mt-2.5 leading-snug min-h-[32px] flex items-center">
                          <span>
                            Tinggi air &gt;{thresholdDraft.level_aman_max || 0}{" "}
                            s/d{" "}
                            <strong>
                              {thresholdDraft.level_waspada_max || 0} cm
                            </strong>
                          </span>
                        </p>
                      </div>

                      {/* LEVEL SIAGA */}
                      <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 flex flex-col justify-between h-full">
                        <div className="flex flex-col flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2 min-h-[44px]">
                            <label className="block font-bold text-rose-900 text-xs leading-tight">
                              Batas Maksimal SIAGA (cm)
                            </label>
                            <span className="shrink-0 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded whitespace-nowrap">
                              LED Merah, Sirine & WA
                            </span>
                          </div>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={thresholdDraft.level_siaga_max}
                            onChange={(e) => {
                              thresholdTouchedRef.current = true;
                              setThresholdDraft((prev) => ({
                                ...prev,
                                level_siaga_max: e.target.value,
                              }));
                            }}
                            className="w-full bg-white border border-rose-300 rounded-xl px-4 py-2.5 font-mono font-bold text-rose-900 text-sm focus:ring-2 focus:ring-rose-500 mt-auto"
                            placeholder="Contoh: 200"
                          />
                        </div>
                        <p className="text-[11px] text-rose-700 mt-2.5 leading-snug min-h-[32px] flex items-center">
                          <span>
                            Tinggi air &gt;
                            {thresholdDraft.level_waspada_max || 0} s/d{" "}
                            <strong>
                              {thresholdDraft.level_siaga_max || 0} cm
                            </strong>{" "}
                            (Bahaya Darurat)
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* DEBIT & HUJAN */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block font-bold text-blue-900 text-xs">
                          Peringatan Debit Aliran Deras (L/min)
                        </label>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                          YF-S201
                        </span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={thresholdDraft.flow_warning_lpm}
                        onChange={(e) => {
                          thresholdTouchedRef.current = true;
                          setThresholdDraft((prev) => ({
                            ...prev,
                            flow_warning_lpm: e.target.value,
                          }));
                        }}
                        className="w-full bg-white border border-blue-300 rounded-xl px-4 py-2 font-mono font-bold text-xs focus:ring-2 focus:ring-blue-500"
                        placeholder="Contoh: 45.0"
                      />
                      <p className="text-[11px] text-blue-700 mt-1.5">
                        Aliran dikategorikan deras jika debit &ge;{" "}
                        <strong>
                          {thresholdDraft.flow_warning_lpm || 45} L/min
                        </strong>
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-sky-50/40 border border-sky-200">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block font-bold text-sky-900 text-xs">
                          Ambang Batas Hujan Lebat (%)
                        </label>
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                          Rain Sensor
                        </span>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        value={thresholdDraft.rain_heavy_pct}
                        onChange={(e) => {
                          thresholdTouchedRef.current = true;
                          setThresholdDraft((prev) => ({
                            ...prev,
                            rain_heavy_pct: e.target.value,
                          }));
                        }}
                        className="w-full bg-white border border-sky-300 rounded-xl px-4 py-2 font-mono font-bold text-xs focus:ring-2 focus:ring-sky-500"
                        placeholder="Contoh: 65"
                      />
                      <p className="text-[11px] text-sky-700 mt-1.5">
                        Cuaca diidentifikasi hujan lebat jika pembacaan &ge;{" "}
                        <strong>{thresholdDraft.rain_heavy_pct || 65}%</strong>
                      </p>
                    </div>
                  </div>

                  {/* AUTOMATION */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Otomatisasi Aktuator (Relay & Buzzer)
                    </div>

                    <label className="flex items-start gap-3 text-xs text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={thresholdDraft.auto_relay_enabled}
                        onChange={(e) => {
                          thresholdTouchedRef.current = true;
                          setThresholdDraft((prev) => ({
                            ...prev,
                            auto_relay_enabled: e.target.checked,
                          }));
                        }}
                        className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>
                        Otomatis nyalakan{" "}
                        <strong>Relay (Pompa Pembuang)</strong> saat status
                        mencapai{" "}
                        <strong className="text-amber-700">WASPADA</strong> atau{" "}
                        <strong className="text-rose-700">SIAGA</strong>
                      </span>
                    </label>

                    <label className="flex items-start gap-3 text-xs text-slate-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={thresholdDraft.auto_buzzer_enabled}
                        onChange={(e) => {
                          thresholdTouchedRef.current = true;
                          setThresholdDraft((prev) => ({
                            ...prev,
                            auto_buzzer_enabled: e.target.checked,
                          }));
                        }}
                        className="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                      />
                      <span>
                        Otomatis bunyikan <strong>Buzzer / Sirine Posko</strong>{" "}
                        saat status mencapai{" "}
                        <strong className="text-rose-700">SIAGA</strong>
                      </span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingThresholds}
                      className="px-6 py-2.5 bg-[#0066cc] hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      {savingThresholds
                        ? "Menyimpan Konfigurasi..."
                        : "Simpan Konfigurasi"}
                    </button>

                    {isThresholdDirty && (
                      <button
                        type="button"
                        onClick={handleResetThresholds}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Reset Perubahan
                      </button>
                    )}
                  </div>
                </form>
              </div>
            )}

            {/* 5. WHATSAPP GATEWAY (FONNTE) */}
            {activeTab === "notifications" && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <div className="mb-6 border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                        <MessageCircle className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                          WhatsApp Gateway (Fonnte API)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Kirim notifikasi peringatan banjir darurat otomatis ke
                          nomor HP & Grup WhatsApp warga saat status WASPADA
                          maupun SIAGA.
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border self-start sm:self-center ${
                        fonnteToken && fonnteToken.trim()
                          ? "bg-blue-50 text-blue-700 border-blue-300"
                          : "bg-amber-50 text-amber-700 border-amber-300"
                      }`}
                    >
                      {fonnteToken && fonnteToken.trim()
                        ? "● API Token Siap Digunakan"
                        : "○ Mode Simulasi (Belum Ada Token)"}
                    </span>
                  </div>

                  {whatsAppSavedSuccess && (
                    <div className="mb-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-600" />
                      Pengaturan WhatsApp Fonnte berhasil disimpan!
                    </div>
                  )}

                  {whatsAppError && (
                    <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                      {whatsAppError}
                    </div>
                  )}

                  <form onSubmit={handleSaveWhatsApp} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 1. TOKEN API */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-xs">
                          1. Token API Fonnte{" "}
                          <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={fonnteToken}
                          onChange={(e) => {
                            waTouchedRef.current = true;
                            setFonnteToken(e.target.value);
                          }}
                          placeholder="Salin dari menu Device di fonnte.com"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Didapat dari menu <em>Device &rarr; Token</em> di
                          website <strong>fonnte.com</strong>.
                        </p>
                      </div>

                      {/* 2. TARGET NUMBER / GROUP ID */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block font-bold text-slate-700 text-xs">
                            2. Nomor WhatsApp Tujuan / ID Grup{" "}
                            <span className="text-rose-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={handleFetchGroups}
                            disabled={fetchingGroups}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${fetchingGroups ? "animate-spin" : ""}`}
                            />
                            {fetchingGroups
                              ? "Mengambil grup..."
                              : "Tarik ID Grup Otomatis"}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={targetNumber}
                          onChange={(e) => {
                            waTouchedRef.current = true;
                            setTargetNumber(e.target.value);
                          }}
                          placeholder="Contoh: 120363431321582251@g.us atau 081234567890"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Gunakan <strong>ID Grup</strong> (akhiran{" "}
                          <code>@g.us</code>) agar bot mengirim ke grup warga,
                          atau nomor HP perseorangan.
                        </p>

                        {fetchGroupMsg && (
                          <div
                            className={`mt-2 p-2.5 rounded-lg text-xs leading-relaxed ${
                              fetchGroupMsg.startsWith("✅")
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {fetchGroupMsg}
                          </div>
                        )}

                        {availableGroups.length > 0 && (
                          <div className="mt-2 space-y-1.5 p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                            <span className="text-[11px] font-bold text-blue-900 block">
                              Daftar Grup Terdeteksi (Klik untuk pilih):
                            </span>
                            {availableGroups.map((grp) => (
                              <button
                                key={grp.id}
                                type="button"
                                onClick={() => {
                                  setTargetNumber(grp.id);
                                  if (grp.name) setWaGroupName(grp.name);
                                }}
                                className="w-full text-left p-2 rounded-lg bg-white border border-blue-200 hover:bg-blue-100 text-xs flex items-center justify-between transition-colors shadow-xs cursor-pointer"
                              >
                                <div>
                                  <span className="font-bold text-slate-800 block">
                                    {grp.name}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-500">
                                    {grp.id}
                                  </span>
                                </div>
                                <span className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded">
                                  Pilih Ini
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 3. NAMA GRUP */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-xs">
                          3. Nama Grup WhatsApp Warga
                        </label>
                        <input
                          type="text"
                          value={waGroupName}
                          onChange={(e) => setWaGroupName(e.target.value)}
                          placeholder="Contoh: Warga Siaga Banjir RW 04"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                      </div>

                      {/* 4. LINK UNDANGAN GRUP */}
                      <div>
                        <label className="block font-bold text-slate-700 mb-1 text-xs">
                          4. Link Undangan Grup WhatsApp Warga
                        </label>
                        <input
                          type="text"
                          value={waInviteLink}
                          onChange={(e) => setWaInviteLink(e.target.value)}
                          placeholder="https://chat.whatsapp.com/..."
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Link tautan agar warga bisa langsung bergabung ke grup
                          dari halaman web warga.
                        </p>
                      </div>
                    </div>

                    {/* PILIHAN NOTIFIKASI OTOMATIS */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-800 block mb-1">
                        Pilihan Level Pemicu Notifikasi WhatsApp Otomatis:
                      </span>
                      <div className="flex flex-wrap gap-6 text-xs">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={waNotifyWaspada}
                            onChange={(e) => {
                              waTouchedRef.current = true;
                              setWaNotifyWaspada(e.target.checked);
                            }}
                            className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                          />
                          <span>
                            Kirim otomatis saat status{" "}
                            <strong className="text-amber-700">WASPADA</strong>{" "}
                            (Kuning / Ketinggian &gt;{thresholds.level_aman_max}{" "}
                            cm)
                          </span>
                        </label>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={waNotifySiaga}
                            onChange={(e) => {
                              waTouchedRef.current = true;
                              setWaNotifySiaga(e.target.checked);
                            }}
                            className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                          />
                          <span>
                            Kirim otomatis saat status{" "}
                            <strong className="text-rose-700">SIAGA</strong>{" "}
                            (Merah Darurat / Ketinggian &gt;
                            {thresholds.level_waspada_max} cm)
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="submit"
                        disabled={savingWhatsApp}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        {savingWhatsApp
                          ? "Menyimpan..."
                          : "Simpan Konfigurasi WhatsApp"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* UJI KIRIM BROADCAST WHATSAPP */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Send className="w-4 h-4 text-blue-600" />
                      Uji Kirim Pesan WhatsApp (Test Broadcast)
                    </h4>
                    <span className="text-xs text-slate-400">
                      Tujuan:{" "}
                      <strong className="text-slate-700 font-mono">
                        {targetNumber || "Belum diisi"}
                      </strong>
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mb-3">
                    Uji coba apakah WhatsApp bot dapat mengirim pesan ke
                    nomor/grup target di atas:
                  </p>

                  <textarea
                    rows={3}
                    value={customWaBroadcastMsg}
                    onChange={(e) => setCustomWaBroadcastMsg(e.target.value)}
                    placeholder="Tulis pesan uji coba (kosongkan untuk mengirim template peringatan darurat otomatis sesuai level sensor saat ini)..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />

                  {waBroadcastResult && (
                    <div
                      className={`mt-3 p-3 rounded-xl border text-xs font-semibold ${
                        waBroadcastResult.startsWith("✅")
                          ? "bg-blue-50 border-blue-200 text-blue-800"
                          : "bg-rose-50 border-rose-200 text-rose-800"
                      }`}
                    >
                      {waBroadcastResult}
                    </div>
                  )}

                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      Mode:{" "}
                      {fonnteToken && fonnteToken.trim() ? (
                        <strong className="text-blue-700">
                          🟢 WhatsApp Riil (via Fonnte API)
                        </strong>
                      ) : (
                        <strong className="text-amber-700">
                          🟡 Mode Simulasi
                        </strong>
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={handleWaBroadcast}
                      disabled={waBroadcastLoading}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      {waBroadcastLoading
                        ? "Mengirim ke WhatsApp..."
                        : "Kirim Uji Coba WhatsApp"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 7. ALARMS */}
            {activeTab === "alarms" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-5">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      Riwayat Alarm & Sirine Posko
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Rekam jejak aktivasi sirine, durasi alarm berbunyi
                      real-time, dan petugas yang menghentikan.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportExcelAlarm}
                      disabled={alarmLogs.length === 0}
                      className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-800 text-xs font-bold flex items-center gap-1.5 border border-emerald-200 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Export Excel</span>
                    </button>
                  </div>
                </div>

                {alarmLogs.length === 0 ? (
                  <div className="py-14 text-center text-sm text-slate-400">
                    Belum ada riwayat alarm.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">ID</th>
                          <th className="p-3.5">Waktu</th>
                          <th className="p-3.5">Level</th>
                          <th className="p-3.5">Pemicu</th>
                          <th className="p-3.5">Durasi</th>
                          <th className="p-3.5">Dihentikan Oleh</th>
                          <th className="p-3.5 text-right">Aksi</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {[...alarmLogs]
                          .sort(
                            (a, b) =>
                              b.timestamp.localeCompare(a.timestamp) ||
                              b.id.localeCompare(a.id),
                          )
                          .map((alm) => (
                            <tr key={alm.id} className="hover:bg-slate-50">
                              <td className="p-3.5 font-mono font-bold text-blue-700">
                                {alm.id}
                              </td>

                              <td className="p-3.5 whitespace-nowrap">
                                {alm.timestamp}
                              </td>

                              <td className="p-3.5">
                                <span
                                  className={`px-2.5 py-1 rounded text-xs font-bold ${
                                    alm.level === "SIAGA"
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {alm.level}
                                </span>
                              </td>

                              <td className="p-3.5 max-w-xs text-slate-700">
                                {alm.trigger_reason}
                              </td>

                              <td className="p-3.5">
                                {alm.stopped_by?.includes("Sedang") ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>
                                      {sensorState.siren_elapsed_seconds ?? 0}s
                                      (Aktif)
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-mono bg-slate-100 text-slate-800 border border-slate-200">
                                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                                    <span>{alm.duration_seconds} dtk</span>
                                  </span>
                                )}
                              </td>

                              <td className="p-3.5 text-slate-600 font-medium">
                                {alm.stopped_by}
                              </td>

                              <td className="p-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {onUpdateAlarmDuration && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingAlarm(alm);
                                        setEditDurationSecs(
                                          alm.duration_seconds || 1,
                                        );
                                      }}
                                      className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                      title="Ubah Durasi Detik"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {onDeleteAlarmLog && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAlarm(alm.id)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                      title="Hapus Catatan Alarm"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 8. ADMINS */}
            {activeTab === "admins" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-700" />
                      Kelola Akun Admin
                    </h3>

                    <p className="text-xs text-slate-500 mt-1">
                      Kelola akun operator dan petugas posko.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setNewAdminName("");
                      setNewAdminPassword("");
                      setUnlockAddAdminInputs(false);
                      setShowAddAdminModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0066cc] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Admin
                  </button>
                </div>

                {adminUsers.length === 0 ? (
                  <div className="py-14 text-center text-sm text-slate-400">
                    Belum ada akun admin.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs sm:text-sm">
                      <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                        <tr>
                          <th className="p-3.5">ID Admin</th>
                          <th className="p-3.5">Nama Lengkap</th>
                          <th className="p-3.5">Login Terakhir</th>
                          <th className="p-3.5 text-right">Aksi</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100">
                        {adminUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50">
                            <td className="p-3.5 font-mono font-bold text-blue-700">
                              {user.id}
                            </td>

                            <td className="p-3.5 font-bold text-slate-900">
                              {user.name}
                            </td>

                            <td className="p-3.5 text-slate-500">
                              {user.last_login}
                            </td>

                            <td className="p-3.5 text-right">
                              {user.id === currentUser.id ? (
                                <span className="text-xs text-slate-400 font-medium">
                                  Akun aktif
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAdmin(user)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                                  title="Hapus Akun"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {showAddAdminModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl">
            <h4 className="font-extrabold text-slate-900 text-lg">
              Tambah Admin / Petugas
            </h4>

            <p className="text-xs text-slate-500 mt-1 mb-5">
              Buat akun akses admin baru untuk posko EWS.
            </p>

            <form
              autoComplete="off"
              onSubmit={(e) => e.preventDefault()}
              className="space-y-4"
            >
              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1.5">
                  Nama Lengkap
                </label>

                <input
                  type="text"
                  name="ews-new-petugas-fullname"
                  autoComplete="off"
                  readOnly={!unlockAddAdminInputs}
                  onFocus={() => setUnlockAddAdminInputs(true)}
                  onMouseDown={() => setUnlockAddAdminInputs(true)}
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 text-xs mb-1.5">
                  Kata Sandi
                </label>

                <input
                  type="password"
                  name="ews-new-petugas-passcode"
                  autoComplete="new-password"
                  readOnly={!unlockAddAdminInputs}
                  onFocus={() => setUnlockAddAdminInputs(true)}
                  onMouseDown={() => setUnlockAddAdminInputs(true)}
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Minimal 4 karakter"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-600 focus:bg-white"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                ℹ️ ID Admin berikutnya:{" "}
                <strong className="font-mono text-blue-700">
                  ADM-0{adminUsers.length + 1}
                </strong>{" "}
                (digunakan untuk login).
              </div>
            </form>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setNewAdminName("");
                  setNewAdminPassword("");
                  setUnlockAddAdminInputs(false);
                  setShowAddAdminModal(false);
                }}
                disabled={savingAdmin}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleAddAdmin}
                disabled={savingAdmin}
                className="px-5 py-2.5 bg-[#0066cc] hover:bg-blue-800 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {savingAdmin ? "Menyimpan..." : "Simpan Admin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showThresholdSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 shadow-2xl border border-emerald-200 text-center relative transform transition-all scale-100">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-4 font-bold shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <h3 className="text-lg font-extrabold text-slate-900 mb-1.5">
              Konfigurasi Tersimpan!
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              Parameter ambang batas EWS berhasil diperbarui dan langsung aktif
              di sistem.
            </p>

            <button
              type="button"
              onClick={() => setShowThresholdSuccessModal(false)}
              className="w-full py-3 bg-[#0066cc] hover:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              Oke, Mengerti
            </button>
          </div>
        </div>
      )}

      {editingAlarm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2 mb-1">
              <Clock className="w-5 h-5 text-blue-600" />
              Sesuaikan Durasi Alarm
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              ID Alarm:{" "}
              <strong className="font-mono text-blue-700">
                {editingAlarm.id}
              </strong>{" "}
              ({editingAlarm.level})
            </p>

            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Durasi Sirine Berbunyi (Detik):
            </label>
            <input
              type="number"
              min="1"
              max="3600"
              value={editDurationSecs}
              onChange={(e) =>
                setEditDurationSecs(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden mb-5"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingAlarm(null)}
                className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingAlarmEdit}
                onClick={handleSaveAlarmDuration}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 cursor-pointer"
              >
                {savingAlarmEdit ? "Menyimpan..." : "Simpan Durasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
