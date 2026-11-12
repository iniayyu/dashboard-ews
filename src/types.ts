export type WarningLevel = "AMAN" | "WASPADA" | "SIAGA";
export type LedColor = "green" | "yellow" | "orange" | "red";

export interface SensorState {
  water_level_cm: number;
  distance_cm: number;
  flow_rate_lpm: number;
  water_speed_mps: number;
  rain_analog: number;
  rain_pct: number;
  rain_status: string;
  warning_level: WarningLevel;
  relay_state: boolean;
  buzzer_state: boolean;
  led_indicator: LedColor;
  timestamp: string;
  siren_elapsed_seconds?: number;
}

export interface ThresholdSettings {
  id?: number;
  sensor_mount_height_cm: number;
  level_aman_max: number;
  level_waspada_max: number;
  level_siaga_max: number;
  level_bahaya_min?: number;
  flow_warning_lpm: number;
  rain_heavy_pct: number;
  auto_relay_enabled: boolean;
  auto_buzzer_enabled: boolean;
  diperbarui_pada?: string;
}

export interface AdminUser {
  id: string;
  name: string;
  username: string;
  password?: string;
  role?: string;
  last_login?: string;
}

export interface AlarmLog {
  id: string;
  timestamp: string;
  level: WarningLevel;
  trigger_reason: string;
  stopped_by: string;
  duration_seconds: number;
  dibuat_pada?: string;
}

export interface FloodEvent {
  id: string;
  start_time: string;
  peak_water_level_cm: number;
  peak_flow_rate_lpm: number;
  max_warning_level: WarningLevel;
  cause?: string;
  action_notes?: string;
}

export interface HistoryPoint {
  time: string;
  water_level: number;
  flow_rate: number;
  rain_pct: number;
  level: WarningLevel;
}

export interface TelegramConfig {
  bot_token?: string;
  has_token?: boolean;
  chat_id?: string;
  group_name?: string;
  group_invite_link?: string;
  notify_siaga?: boolean;
  notify_bahaya?: boolean;
}

export interface WhatsAppConfig {
  fonnte_token?: string;
  has_token?: boolean;
  target_number?: string;
  group_name?: string;
  group_invite_link?: string;
  notify_waspada?: boolean;
  notify_siaga?: boolean;
}

export interface Esp32Status {
  online: boolean;
  ip_address: string;
  mac_address: string;
  wifi_rssi: number;
  firmware_version: string;
  uptime_seconds: number;
  last_heartbeat: string;
  device_id: string;
}

export interface DatabaseStatus {
  connected: boolean;
  driver: "sqlite" | "mysql";
  database_file?: string;
  last_sync?: string;
}

export interface TelegramChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
}
