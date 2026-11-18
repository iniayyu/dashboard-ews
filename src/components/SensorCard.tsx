import React from "react";
import { Waves, CloudRain, Power, Volume2 } from "lucide-react";
import { LedColor, WarningLevel } from "../types";

interface SensorCardProps {
  flowRateLpm: number;
  waterSpeedMps: number;
  rainPct: number;
  rainAnalog: number;
  rainStatus: string;
  relayState: boolean;
  buzzerState: boolean;
  ledIndicator: LedColor;
  warningLevel: WarningLevel;
  sirenElapsedSeconds?: number;
  onToggleRelay?: () => void;
  onToggleBuzzer?: () => void;
  isAdmin?: boolean;
}

export const SensorCard: React.FC<SensorCardProps> = ({
  flowRateLpm,
  waterSpeedMps,
  rainPct,
  rainAnalog,
  rainStatus,
  relayState,
  buzzerState,
  ledIndicator,
  warningLevel,
  sirenElapsedSeconds,
  onToggleRelay,
  onToggleBuzzer,
  isAdmin = false,
}) => {
  const safeFlow = Number(flowRateLpm ?? 0);
  const safeSpeed = Number(waterSpeedMps ?? 0);
  const safeRainPct = Number(rainPct ?? 0);
  const safeRainAdc = Math.round(Number(rainAnalog ?? 0));

  // Tampilan Warga (Publik): 2 Sensor ditumpuk vertikal dengan tinggi seimbang dengan WaterLevelGauge
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-4 h-full">
        {/* 1. YF-S201 Water Flow Sensor Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between flex-1 hover:border-blue-300 transition-colors min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md whitespace-nowrap">
                YF-S201 Flow Sensor
              </span>
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl shrink-0">
                <Waves className="w-4 h-4" />
              </div>
            </div>

            <h4 className="text-base font-bold text-slate-800 mt-2.5 leading-snug">
              Kecepatan & Debit Air
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Mengukur kelancaran dan derasnya aliran sungai
            </p>
          </div>

          <div className="my-3 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {safeFlow.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Liter/menit
              </span>
            </div>

            <div className="text-right">
              <span className="text-slate-400 text-[11px] block font-medium">
                Estimasi Arus:
              </span>
              <span className="font-bold text-blue-700 whitespace-nowrap text-xs">
                ~{safeSpeed.toFixed(2)} m/detik
              </span>
            </div>
          </div>

          <div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-500 ${
                  safeFlow > 45
                    ? "bg-rose-500"
                    : safeFlow > 25
                      ? "bg-amber-500"
                      : "bg-blue-600"
                }`}
                style={{ width: `${Math.min(100, (safeFlow / 60) * 100)}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">Karakter Arus:</span>
              <span
                className={`font-bold px-2.5 py-0.5 rounded text-[11px] whitespace-nowrap ${
                  safeFlow > 40
                    ? "bg-rose-100 text-rose-800"
                    : safeFlow > 15
                      ? "bg-blue-100 text-blue-800"
                      : "bg-emerald-100 text-emerald-800"
                }`}
              >
                {safeFlow > 40
                  ? "Arus Deras"
                  : safeFlow > 15
                    ? "Arus Sedang"
                    : "Arus Tenang"}
              </span>
            </div>
          </div>
        </div>

        {/* 2. DC 3V-5V Raindrop / Rain Sensor Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between flex-1 hover:border-blue-300 transition-colors min-w-0">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md whitespace-nowrap">
                Rain Level Sensor
              </span>
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl shrink-0">
                <CloudRain className="w-4 h-4" />
              </div>
            </div>

            <h4 className="text-base font-bold text-slate-800 mt-2.5 leading-snug">
              Intensitas Curah Hujan
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Deteksi tetesan air hujan di posko pemantau
            </p>
          </div>

          <div className="my-3 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
                {safeRainPct.toFixed(0)}%
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Kadar Air
              </span>
            </div>

            <div className="text-right">
              <span className="text-slate-400 text-[11px] block font-medium">
                Kondisi:
              </span>
              <span className="font-bold text-sky-700 text-xs">
                {rainStatus}
              </span>
            </div>
          </div>

          <div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-500 ${
                  safeRainPct > 70
                    ? "bg-rose-500"
                    : safeRainPct > 35
                      ? "bg-sky-500"
                      : "bg-slate-400"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, safeRainPct))}%` }}
              />
            </div>
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">Sensor Analog ADC:</span>
              <span className="font-mono font-semibold text-slate-700 whitespace-nowrap tabular-nums">
                {safeRainAdc} / 4095
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tampilan Admin (dengan kontrol Relay, Buzzer, dan LED)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 1. YF-S201 Water Flow Sensor Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors min-w-0">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md whitespace-nowrap">
              YF-S201 Flow Sensor
            </span>
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl shrink-0">
              <Waves className="w-4 h-4" />
            </div>
          </div>

          <h4 className="text-base font-bold text-slate-800 mt-3 leading-snug">
            Kecepatan & Debit Air
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Mengukur kelancaran dan derasnya aliran sungai
          </p>
        </div>

        <div className="my-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {safeFlow.toFixed(1)}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Liter/menit
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-xs font-medium">
            <span className="text-slate-500">Estimasi Arus:</span>
            <span className="font-bold text-blue-700 whitespace-nowrap">
              ~{safeSpeed.toFixed(2)} m/detik
            </span>
          </div>
        </div>

        <div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-500 ${
                safeFlow > 45
                  ? "bg-rose-500"
                  : safeFlow > 25
                    ? "bg-amber-500"
                    : "bg-blue-600"
              }`}
              style={{ width: `${Math.min(100, (safeFlow / 60) * 100)}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500">Karakter Arus:</span>
            <span
              className={`font-bold px-2.5 py-0.5 rounded text-[11px] whitespace-nowrap ${
                safeFlow > 40
                  ? "bg-rose-100 text-rose-800"
                  : safeFlow > 15
                    ? "bg-blue-100 text-blue-800"
                    : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {safeFlow > 40
                ? "Arus Deras"
                : safeFlow > 15
                  ? "Arus Sedang"
                  : "Arus Tenang"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. DC 3V-5V Raindrop / Rain Sensor Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors min-w-0">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-1 rounded-md whitespace-nowrap">
              Rain Level Sensor
            </span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl shrink-0">
              <CloudRain className="w-4 h-4" />
            </div>
          </div>

          <h4 className="text-base font-bold text-slate-800 mt-3 leading-snug">
            Intensitas Curah Hujan
          </h4>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Deteksi tetesan air hujan di posko pemantau
          </p>
        </div>

        <div className="my-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {safeRainPct.toFixed(0)}%
            </span>
            <span className="text-xs font-semibold text-slate-500">
              Kadar Air
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-xs font-medium">
            <span className="text-slate-500">Kondisi Saat Ini:</span>
            <span className="font-bold text-sky-700 text-right">
              {rainStatus}
            </span>
          </div>
        </div>

        <div>
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-500 ${
                safeRainPct > 70
                  ? "bg-rose-500"
                  : safeRainPct > 35
                    ? "bg-sky-500"
                    : "bg-slate-400"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, safeRainPct))}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500">Sensor Analog ADC:</span>
            <span className="font-mono font-semibold text-slate-700 whitespace-nowrap tabular-nums">
              {safeRainAdc} / 4095
            </span>
          </div>
        </div>
      </div>

      {/* 3. Output Actuators (Relay, Buzzer, LED) - Khusus Admin */}
      <div className="sm:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-colors min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md">
              Aktuator ESP32
            </span>
            <h4 className="text-base font-bold text-slate-800 mt-2 leading-snug">
              Status Relay LED & Buzzer
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Relay LED, buzzer sirine, dan LED posko
            </p>
          </div>

          {/* 3-Color LED Indicators */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-full border border-slate-200 shrink-0">
            <span
              title="LED Hijau (Aman)"
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                ledIndicator === "green" || warningLevel === "AMAN"
                  ? "bg-emerald-500 ring-2 ring-emerald-300 shadow-xs"
                  : "bg-emerald-200"
              }`}
            />
            <span
              title="LED Kuning (Waspada)"
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                ledIndicator === "yellow" || warningLevel === "WASPADA"
                  ? "bg-amber-400 ring-2 ring-amber-300 shadow-xs"
                  : "bg-amber-200"
              }`}
            />
            <span
              title="LED Merah (Siaga)"
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                ledIndicator === "red" ||
                ledIndicator === "orange" ||
                warningLevel === "SIAGA"
                  ? "bg-rose-600 ring-2 ring-rose-300 animate-pulse shadow-xs"
                  : "bg-rose-200"
              }`}
            />
          </div>
        </div>

        {/* Relay and Buzzer Box */}
        <div className="my-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-semibold">Relay LED</span>
              <Power
                className={`w-4 h-4 shrink-0 ${relayState ? "text-emerald-600" : "text-slate-400"}`}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-sm font-black tracking-wide ${relayState ? "text-emerald-700" : "text-slate-500"}`}
              >
                {relayState ? "ON" : "OFF"}
              </span>
              {onToggleRelay && (
                <button
                  type="button"
                  onClick={onToggleRelay}
                  title={
                    relayState
                      ? "Klik untuk mematikan Relay LED"
                      : "Klik untuk menyalakan Relay LED"
                  }
                  aria-label={
                    relayState ? "Matikan Relay LED" : "Nyalakan Relay LED"
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    relayState ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      relayState ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              )}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-semibold">Buzzer Sirine</span>
              <Volume2
                className={`w-4 h-4 shrink-0 ${buzzerState ? "text-emerald-600 animate-pulse" : "text-slate-400"}`}
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={`text-sm font-black tracking-wide ${
                    buzzerState
                      ? "text-rose-600 animate-pulse"
                      : "text-slate-500"
                  }`}
                >
                  {buzzerState ? "ON" : "OFF"}
                </span>
                {buzzerState &&
                  typeof sirenElapsedSeconds === "number" &&
                  sirenElapsedSeconds > 0 && (
                    <span className="text-[11px] font-semibold text-rose-500">
                      ({Math.min(60, sirenElapsedSeconds)}/60 dtk)
                    </span>
                  )}
              </div>
              {onToggleBuzzer && (
                <button
                  type="button"
                  onClick={onToggleBuzzer}
                  title={
                    buzzerState
                      ? "Klik untuk mematikan Buzzer"
                      : "Klik untuk membunyikan Buzzer"
                  }
                  aria-label={
                    buzzerState ? "Matikan Buzzer" : "Nyalakan Buzzer"
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    buzzerState ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      buzzerState ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Tingkat Status Sistem:
          </span>
          <span className="font-extrabold text-blue-900 uppercase">
            {warningLevel}
          </span>
        </div>
      </div>
    </div>
  );
};
