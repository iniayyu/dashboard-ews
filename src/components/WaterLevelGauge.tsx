import React from "react";
import { ThresholdSettings, WarningLevel } from "../types";

interface WaterLevelGaugeProps {
  waterLevelCm: number;
  distanceCm: number;
  warningLevel: WarningLevel;
  thresholds: ThresholdSettings;
}

export const WaterLevelGauge: React.FC<WaterLevelGaugeProps> = ({
  waterLevelCm,
  distanceCm,
  warningLevel,
  thresholds,
}) => {
  const maxHeight = thresholds.sensor_mount_height_cm || 250;
  const percentage = Math.min(
    100,
    Math.max(0, (waterLevelCm / maxHeight) * 100),
  );

  // 3-Level Status Color Theme: Aman, Waspada, Siaga
  const getStatusColor = () => {
    switch (warningLevel) {
      case "SIAGA":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          badge: "bg-rose-600 text-white",
          water: "from-rose-500 to-rose-600",
          label: "Siaga",
        };
      case "WASPADA":
        return {
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          badge: "bg-amber-500 text-slate-900",
          water: "from-amber-400 to-amber-500",
          label: "Waspada",
        };
      default:
        return {
          bg: "bg-emerald-50 text-emerald-800 border-emerald-200",
          badge: "bg-emerald-600 text-white",
          water: "from-sky-400 to-blue-500",
          label: "Aman",
        };
    }
  };

  const status = getStatusColor();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
              Sensor HC-SR04 Ultrasonic
            </span>
            <span className="text-xs text-slate-500">
              Tiang Pantau: {maxHeight} cm
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mt-1">
            Ketinggian Air Sungai
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Diukur secara otomatis dari permukaan air ke sensor jembatan
          </p>
        </div>

        {/* Big Large Water Value Display */}
        <div className="text-left sm:text-right bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="text-3xl font-extrabold text-blue-900 tabular-nums">
            {waterLevelCm.toFixed(1)}{" "}
            <span className="text-base font-semibold text-slate-600">cm</span>
          </div>
          <div className="text-xs text-slate-600 mt-0.5">
            Jarak pantul:{" "}
            <span className="font-mono font-medium text-slate-800">
              {distanceCm.toFixed(1)} cm
            </span>
          </div>
        </div>
      </div>

      {/* Cross section visual container */}
      <div className="relative w-full h-72 bg-gradient-to-b from-slate-50 to-blue-50/40 border border-slate-200 rounded-xl overflow-hidden flex">
        {/* Left: Ruler with 3 threshold marks */}
        <div className="w-16 h-full border-r border-slate-200 bg-white/90 flex flex-col justify-between py-2 px-2 text-[11px] font-semibold text-slate-600 select-none z-10">
          <div className="flex items-center justify-between text-rose-700">
            <span>{maxHeight}cm</span>
            <span className="w-2 h-0.5 bg-rose-500"></span>
          </div>
          <div className="flex items-center justify-between text-rose-600">
            <span>{thresholds.level_waspada_max}cm</span>
            <span className="w-2 h-0.5 bg-rose-500"></span>
          </div>
          <div className="flex items-center justify-between text-amber-700">
            <span>{thresholds.level_aman_max}cm</span>
            <span className="w-2 h-0.5 bg-amber-500"></span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>0 cm</span>
            <span className="w-2 h-0.5 bg-slate-400"></span>
          </div>
        </div>

        {/* Center: River Channel View */}
        <div className="relative flex-1 h-full overflow-hidden">
          {/* 3 Threshold Zone Bands: Siaga, Waspada, Aman */}
          <div
            className="absolute top-0 left-0 right-0 bg-rose-50/70 border-b border-dashed border-rose-300 pointer-events-none"
            style={{
              height: `${((maxHeight - thresholds.level_waspada_max) / maxHeight) * 100}%`,
            }}
          >
            <span className="absolute top-1 right-2 text-[10px] font-bold text-rose-700 bg-white/90 border border-rose-200 px-1.5 py-0.5 rounded shadow-2xs">
              Zona Siaga (&gt;{thresholds.level_waspada_max} cm)
            </span>
          </div>

          <div
            className="absolute left-0 right-0 bg-amber-50/60 border-b border-dashed border-amber-300 pointer-events-none"
            style={{
              top: `${((maxHeight - thresholds.level_waspada_max) / maxHeight) * 100}%`,
              height: `${((thresholds.level_waspada_max - thresholds.level_aman_max) / maxHeight) * 100}%`,
            }}
          >
            <span className="absolute top-1 right-2 text-[10px] font-bold text-amber-700 bg-white/90 border border-amber-200 px-1.5 py-0.5 rounded shadow-2xs">
              Zona Waspada ({thresholds.level_aman_max} -{" "}
              {thresholds.level_waspada_max} cm)
            </span>
          </div>

          {/* Ultrasonic Sensor Icon Box at top */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            <div className="px-3 py-1 bg-white border border-slate-300 rounded-lg shadow-sm flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">
                Transduser HC-SR04
              </span>
            </div>
            {/* Soft ultrasonic visual beam */}
            <div className="w-1 h-12 bg-gradient-to-b from-blue-500/60 via-blue-400/20 to-transparent" />
          </div>

          {/* Water Body (Animated height) */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${status.water} transition-all duration-700 ease-out`}
            style={{ height: `${percentage}%` }}
          >
            {/* Surface wave bar */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-white/40 border-t border-white/60 flex items-center justify-center">
              <span className="w-full h-0.5 bg-white/80 animate-pulse" />
            </div>

            {/* In-Water readout */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-900/40 backdrop-blur-xs px-3 py-1 rounded-full text-white text-xs font-bold tracking-wide">
                Kedalaman: {waterLevelCm.toFixed(1)} cm ({percentage.toFixed(0)}
                %)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer: 3-Level Legend (Aman, Waspada, Siaga) */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
            <span>&lt;{thresholds.level_aman_max}cm Aman</span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
            <span>
              {thresholds.level_aman_max}-{thresholds.level_waspada_max}cm
              Waspada
            </span>
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-3 h-3 rounded-full bg-rose-600 inline-block" />
            <span>&gt;{thresholds.level_waspada_max}cm Siaga</span>
          </span>
        </div>

        <div
          className={`px-2.5 py-1 rounded-md text-xs font-bold ${status.badge}`}
        >
          Status: {status.label}
        </div>
      </div>
    </div>
  );
};
