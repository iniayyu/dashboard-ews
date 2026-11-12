import React, { useState } from "react";
import { HistoryPoint, ThresholdSettings } from "../types";
import { TrendingUp, AlertTriangle, ShieldCheck, Activity } from "lucide-react";

interface HistoricalChartsProps {
  history: HistoryPoint[];
  thresholds: ThresholdSettings;
}

// Catmull-Rom spline to smooth cubic bezier curve
function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export const HistoricalCharts: React.FC<HistoricalChartsProps> = ({
  history,
  thresholds,
}) => {
  const [activeMetric, setActiveMetric] = useState<"water" | "flow" | "rain">(
    "water",
  );
  const [timeRange, setTimeRange] = useState<"1h" | "6h" | "24h" | "7d">("24h");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  let displayedHistory = history;
  if (timeRange === "1h") displayedHistory = history.slice(-4);
  else if (timeRange === "6h") displayedHistory = history.slice(-8);
  else if (timeRange === "24h") displayedHistory = history;
  else if (timeRange === "7d") displayedHistory = history;

  if (displayedHistory.length === 0) {
    displayedHistory = [
      {
        time: "08:00",
        water_level: 72,
        flow_rate: 14,
        rain_pct: 5,
        level: "AMAN",
      },
      {
        time: "09:00",
        water_level: 78,
        flow_rate: 16,
        rain_pct: 10,
        level: "AMAN",
      },
      {
        time: "10:00",
        water_level: 95,
        flow_rate: 22,
        rain_pct: 25,
        level: "AMAN",
      },
      {
        time: "11:00",
        water_level: 132,
        flow_rate: 34,
        rain_pct: 55,
        level: "WASPADA",
      },
      {
        time: "12:00",
        water_level: 168,
        flow_rate: 46,
        rain_pct: 75,
        level: "SIAGA",
      },
      {
        time: "13:00",
        water_level: 142,
        flow_rate: 30,
        rain_pct: 40,
        level: "WASPADA",
      },
      {
        time: "14:00",
        water_level: 110,
        flow_rate: 21,
        rain_pct: 20,
        level: "AMAN",
      },
      {
        time: "15:00",
        water_level: 85.4,
        flow_rate: 18.2,
        rain_pct: 15,
        level: "AMAN",
      },
    ];
  }

  const values = displayedHistory.map((h) => {
    if (activeMetric === "water") return h.water_level;
    if (activeMetric === "flow") return h.flow_rate;
    return h.rain_pct;
  });

  const currentVal = values.length > 0 ? values[values.length - 1] : 0;
  const maxVal = Math.max(
    ...values,
    activeMetric === "water" ? 220 : activeMetric === "flow" ? 60 : 100,
  );
  const minVal = 0;
  const range = maxVal - minVal || 1;

  // ViewBox dimensions with tight padding for edge-to-edge spanning
  const width = 1000;
  const height = 280;
  const padLeft = 48; // Compact left pad for Y labels
  const padRight = 20; // Compact right pad so curve stretches completely across
  const padTop = 30;
  const padBottom = 38;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = displayedHistory.map((h, i) => {
    const val =
      activeMetric === "water"
        ? h.water_level
        : activeMetric === "flow"
          ? h.flow_rate
          : h.rain_pct;
    const x = padLeft + (i / (displayedHistory.length - 1 || 1)) * chartW;
    const y = padTop + chartH - ((val - minVal) / range) * chartH;
    return { x, y, val, time: h.time, level: h.level };
  });

  const smoothLine = createSmoothPath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const smoothArea =
    points.length > 1
      ? `${smoothLine} L ${lastPoint.x} ${padTop + chartH} L ${firstPoint.x} ${padTop + chartH} Z`
      : "";

  const metricColor =
    activeMetric === "water"
      ? "#0066cc"
      : activeMetric === "flow"
        ? "#0284c7"
        : "#0891b2";
  const metricUnit =
    activeMetric === "water" ? "cm" : activeMetric === "flow" ? "L/min" : "%";

  const peakVal = Math.max(...values).toFixed(1);
  const avgVal = (
    values.reduce((a, b) => a + b, 0) / (values.length || 1)
  ).toFixed(1);

  // Y-axis tick values
  const yTicks =
    activeMetric === "water"
      ? [0, 60, 120, 160, 200]
      : activeMetric === "flow"
        ? [0, 15, 30, 45, 60]
        : [0, 25, 50, 75, 100];

  const siagaY =
    activeMetric === "water"
      ? padTop +
        chartH -
        ((thresholds.level_waspada_max - minVal) / range) * chartH
      : null;
  const waspadaY =
    activeMetric === "water"
      ? padTop +
        chartH -
        ((thresholds.level_aman_max - minVal) / range) * chartH
      : null;

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0066cc] animate-pulse"></span>
            <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Grafik Historis Pemantauan Air & Cuaca
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Visualisasi tren realtime sensor ketinggian air, debit turbin pipa,
            dan curah hujan
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metric Selector */}
          <div className="flex p-1 bg-slate-100/90 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveMetric("water");
                setHoveredIndex(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMetric === "water"
                  ? "bg-[#0066cc] text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Ketinggian Air
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMetric("flow");
                setHoveredIndex(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMetric === "flow"
                  ? "bg-[#0066cc] text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Debit Arus
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMetric("rain");
                setHoveredIndex(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeMetric === "rain"
                  ? "bg-[#0066cc] text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Curah Hujan
            </button>
          </div>

          {/* Time Range */}
          <div className="flex p-1 bg-slate-100/90 rounded-xl text-xs font-bold font-mono">
            {(["1h", "6h", "24h", "7d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1.5 rounded-lg uppercase text-[11px] transition-all cursor-pointer ${
                  timeRange === r
                    ? "bg-white text-slate-900 shadow-xs font-extrabold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. 4 Metric Cards spanning full width */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-medium">
              Nilai Terkini
            </span>
            <Activity className="w-3.5 h-3.5 text-[#0066cc]" />
          </div>
          <div className="text-2xl font-black text-[#0066cc] mt-1 tabular-nums">
            {Number(currentVal).toFixed(1)}{" "}
            <span className="text-xs font-semibold text-slate-500">
              {metricUnit}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-medium">
              Puncak Tertinggi
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
            {peakVal}{" "}
            <span className="text-xs font-semibold text-slate-500">
              {metricUnit}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-medium">
              Rata-Rata Terukur
            </span>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700 mt-1 tabular-nums">
            {avgVal}{" "}
            <span className="text-xs font-semibold text-slate-500">
              {metricUnit}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px] font-medium">
              Batas Siaga Acuan
            </span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-1 tabular-nums">
            {activeMetric === "water"
              ? `${thresholds.level_waspada_max} cm`
              : activeMetric === "flow"
                ? `${thresholds.flow_warning_lpm} L/min`
                : `${thresholds.rain_heavy_pct}%`}
          </div>
        </div>
      </div>

      {/* 3. True Full-Bleed SVG Chart */}
      <div className="w-full bg-slate-50/70 rounded-2xl p-2 sm:p-4 border border-slate-200 relative overflow-hidden">
        {/* Hover Information Banner inside chart box */}
        <div className="flex items-center justify-between px-2 pt-1 pb-2 text-[11px]">
          <span className="text-slate-500 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Garis skala:{" "}
            <strong className="text-slate-700">
              0 — {maxVal} {metricUnit}
            </strong>
          </span>
          {activePoint ? (
            <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs text-slate-800 font-mono font-bold">
              {activePoint.time} WIB • {activePoint.val.toFixed(1)} {metricUnit}{" "}
              ({activePoint.level || "NORMAL"})
            </span>
          ) : (
            <span className="text-slate-400 italic">
              Arahkan kursor ke titik grafik untuk detail
            </span>
          )}
        </div>

        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block select-none"
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={metricColor} stopOpacity="0.32" />
              <stop offset="60%" stopColor={metricColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={metricColor} stopOpacity="0.0" />
            </linearGradient>

            {/* Subtle drop shadow for data point highlights */}
            <filter
              id="pointShadow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* Danger zone soft background band (Siaga) */}
          {siagaY !== null && (
            <rect
              x={padLeft}
              y={padTop}
              width={chartW}
              height={Math.max(0, siagaY - padTop)}
              fill="#fee2e2"
              fillOpacity="0.4"
            />
          )}

          {/* Warning zone soft background band (Waspada) */}
          {siagaY !== null && waspadaY !== null && (
            <rect
              x={padLeft}
              y={siagaY}
              width={chartW}
              height={Math.max(0, waspadaY - siagaY)}
              fill="#fef3c7"
              fillOpacity="0.35"
            />
          )}

          {/* Vertical grid lines aligning with every data point */}
          {points.map((p, i) => (
            <line
              key={`v-grid-${i}`}
              x1={p.x}
              y1={padTop}
              x2={p.x}
              y2={padTop + chartH}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
          ))}

          {/* Horizontal grid lines & Y labels */}
          {yTicks.map((tickVal) => {
            const y = padTop + chartH - ((tickVal - minVal) / range) * chartH;
            return (
              <g key={`y-tick-${tickVal}`}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 3.5}
                  fill="#94a3b8"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Threshold Lines for Water Level */}
          {activeMetric === "water" && siagaY !== null && (
            <g>
              <line
                x1={padLeft}
                y1={siagaY}
                x2={width - padRight}
                y2={siagaY}
                stroke="#dc2626"
                strokeWidth="1.75"
                strokeDasharray="4 4"
              />
              <rect
                x={width - padRight - 145}
                y={siagaY - 18}
                width="145"
                height="16"
                rx="3"
                fill="#dc2626"
              />
              <text
                x={width - padRight - 72}
                y={siagaY - 6}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                Batas Siaga ({thresholds.level_waspada_max}cm)
              </text>
            </g>
          )}

          {activeMetric === "water" && waspadaY !== null && (
            <g>
              <line
                x1={padLeft}
                y1={waspadaY}
                x2={width - padRight}
                y2={waspadaY}
                stroke="#d97706"
                strokeWidth="1.75"
                strokeDasharray="4 4"
              />
              <rect
                x={width - padRight - 155}
                y={waspadaY - 18}
                width="155"
                height="16"
                rx="3"
                fill="#d97706"
              />
              <text
                x={width - padRight - 77}
                y={waspadaY - 6}
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
              >
                Batas Waspada ({thresholds.level_aman_max}cm)
              </text>
            </g>
          )}

          {/* Area Gradient fill under smooth curve */}
          {smoothArea && <path d={smoothArea} fill="url(#chartGradient)" />}

          {/* Smooth curved trend line */}
          <path
            d={smoothLine}
            fill="none"
            stroke={metricColor}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover Crosshair indicator */}
          {activePoint && (
            <line
              x1={activePoint.x}
              y1={padTop}
              x2={activePoint.x}
              y2={padTop + chartH}
              stroke={metricColor}
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.8"
            />
          )}

          {/* Data Points and Value Badges */}
          {points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            const isHigh =
              (p.val >= thresholds.level_waspada_max &&
                activeMetric === "water") ||
              (activeMetric === "flow" && p.val >= thresholds.flow_warning_lpm);
            const isWarning =
              !isHigh &&
              p.val >= thresholds.level_aman_max &&
              activeMetric === "water";

            const dotColor = isHigh
              ? "#dc2626"
              : isWarning
                ? "#d97706"
                : metricColor;

            return (
              <g
                key={`point-${i}`}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {/* Invisible hover hitbox */}
                <rect
                  x={p.x - 25}
                  y={padTop}
                  width="50"
                  height={chartH + padBottom}
                  fill="transparent"
                />

                {/* Outer pulsing ring for hover */}
                {isHovered && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="12"
                    fill={dotColor}
                    opacity="0.25"
                  />
                )}

                {/* Main Point Circle */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 6.5 : isHigh ? 5.5 : 4.5}
                  fill={dotColor}
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  filter="url(#pointShadow)"
                />

                {/* Numeric Pill above point */}
                <rect
                  x={p.x - 18}
                  y={p.y - 24}
                  width="36"
                  height="17"
                  rx="4"
                  fill="#ffffff"
                  stroke={
                    isHigh ? "#fca5a5" : isWarning ? "#fde68a" : "#cbd5e1"
                  }
                  strokeWidth={isHovered ? "1.5" : "1"}
                  filter="url(#pointShadow)"
                />
                <text
                  x={p.x}
                  y={p.y - 12}
                  fill={isHigh ? "#b91c1c" : isWarning ? "#b45309" : "#0f172a"}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {Math.round(p.val)}
                </text>

                {/* Bottom Time Label */}
                <text
                  x={p.x}
                  y={height - 12}
                  fill={isHovered ? "#0f172a" : "#64748b"}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight={isHovered ? "bold" : "500"}
                  textAnchor="middle"
                >
                  {p.time}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
