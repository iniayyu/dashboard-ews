#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// =====================================================================
// 1. PENGATURAN WI-FI & URL SERVER LOKAL
// =====================================================================
const char* WIFI_SSID     = "LabRiset";   // <-- Ganti dengan Hotspot HP Anda
const char* WIFI_PASSWORD = "L4bR1set";  // <-- Sandi Hotspot HP Anda

// ✅ PERBAIKAN: Tambahkan port 3000 & hapus spasi setelah "http://"
// Ganti 10.209.189.95 dengan IPv4 Address laptop Anda (cek lewat ipconfig di CMD)
const char* SERVER_URL    = "http://10.209.189.95:3000/api/sensor/telemetry";
const char* STATUS_URL    = "http://10.209.189.95:3000/api/status";
const char* DEVICE_ID     = "ESP32-EWS-CILANGKAP-01";

// =====================================================================
// 2. PEMETAAN PIN HARDWARE
// =====================================================================
#define PIN_TRIG          25   // D25
#define PIN_ECHO          26   // D26
#define PIN_FLOW_SENSOR   27   // D27
#define PIN_RAIN_ANALOG   33   // D33

// Jarak sensor ke DASAR toples (cm). Sesuaikan dengan hasil ukur nyata.
const float TINGGI_TOPLES_CM = 14.0;

// Pengaturan ultrasonik
const float JARAK_MAX_CM       = 30.0;   // di atas ini diabaikan

// Ambang status (cm tinggi air)
const float BATAS_SIAGA_CM     = 9.0;
const float BATAS_WASPADA_CM   = 5.0;

// =====================================================================
// VARIABEL PENGHITUNG DEBIT & TIMER
// =====================================================================
volatile int pulseCount = 0;
float flowRateLpm = 0.0;
unsigned long oldTime = 0;
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL_MS = 3500;   // kirim tiap 3.5 detik

// =====================================================================
// STATUS AKTUATOR (dari response server)
// =====================================================================
bool relayState  = false;   // Pompa Drainase
bool buzzerState = false;   // Sirine/Buzzer

void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=================================================");
  Serial.println("   SMART EWS BANJIR - FULL SYSTEM ONLINE         ");
  Serial.println("=================================================");
  Serial.println("• Wadah Toples Kali: 14.0 cm                     ");
  Serial.println("• Sensor Ultrasonik: TRIG 25, ECHO 26            ");
  Serial.println("• Sensor Debit/Arus: PIN 27                      ");
  Serial.println("• Sensor Air Hujan : PIN 33                      ");
  Serial.println("=================================================");

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_RAIN_ANALOG, INPUT);

  pinMode(PIN_FLOW_SENSOR, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR), pulseCounter, RISING);

  Serial.print("Menghubungkan ke Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 25) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ Wi-Fi Berhasil Terhubung!");
    Serial.print("IP ESP32: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n⚠️ Belum tersambung Wi-Fi, sensor tetap aktif lokal.");
  }

  oldTime = millis();
}

void loop() {
  // Hitung debit air tiap 1 detik (YF-S201)
  if ((millis() - oldTime) > 1000) {
    detachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR));
    unsigned long now = millis();
    flowRateLpm = ((1000.0 / (now - oldTime)) * pulseCount) / 7.5;
    oldTime = now;
    pulseCount = 0;
    attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR), pulseCounter, RISING);
  }

  // Siklus pembacaan & pengiriman tiap 3.5 detik
  if (millis() - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = millis();

    // -----------------------------------------------------------------
    // 1. BACA SENSOR ULTRASONIK (10 TEMBAKAN + ANTI-GEMA DINDING)
    // -----------------------------------------------------------------
    float totalJarak = 0.0;
    int sampleValid = 0;
    int sampleDekat = 0;
    int sampleTimeout = 0;

    for (int i = 0; i < 10; i++) {
      digitalWrite(PIN_TRIG, LOW);
      delayMicroseconds(4);
      digitalWrite(PIN_TRIG, HIGH);
      delayMicroseconds(10);
      digitalWrite(PIN_TRIG, LOW);

      long dur = pulseIn(PIN_ECHO, HIGH, 25000);

      if (dur == 0) {
        sampleTimeout++;
      } else {
        float d = (dur * 0.0343) / 2.0;
        if (d >= 1.0 && d < 2.5) {
          sampleDekat++;
        } else if (d >= 2.5 && d <= JARAK_MAX_CM) {
          totalJarak += d;
          sampleValid++;
        }
      }
      delay(60);
    }

    static float lastCleanDistance = TINGGI_TOPLES_CM;
    float distanceCm = lastCleanDistance;
    bool sensorTerlaluDekat = false;

    if (sampleDekat >= 6) {
      distanceCm = 0.0;
      lastCleanDistance = 0.0;
      sensorTerlaluDekat = true;
    } else if (sampleValid >= 2) {
      distanceCm = totalJarak / sampleValid;
      lastCleanDistance = distanceCm;
    }

    // Tinggi Air = Tinggi Toples - Jarak Sensor ke Air
    float waterLevelCm = TINGGI_TOPLES_CM - distanceCm;
    if (waterLevelCm < 0) waterLevelCm = 0;
    if (waterLevelCm > TINGGI_TOPLES_CM) waterLevelCm = TINGGI_TOPLES_CM;

    String waterStatus = "AMAN";
    if (sensorTerlaluDekat || waterLevelCm >= BATAS_SIAGA_CM) {
      waterStatus = "🚨 SIAGA (BANJIR MELUAP)";
    } else if (waterLevelCm >= BATAS_WASPADA_CM) {
      waterStatus = "⚠️ WASPADA (AIR NAIK)";
    } else {
      waterStatus = "✅ AMAN (AIR NORMAL)";
    }

    // -----------------------------------------------------------------
    // 2. KECEPATAN & DEBIT AIR (YF-S201)
    // -----------------------------------------------------------------
    float waterSpeedMps = flowRateLpm / 28.0;

    // -----------------------------------------------------------------
    // 3. CURAH HUJAN (PIN 33)
    // -----------------------------------------------------------------
    int rainAnalog = analogRead(PIN_RAIN_ANALOG);
    float rainPct = ((4095.0 - (float)rainAnalog) / 4095.0) * 100.0;
    if (rainPct < 0) rainPct = 0;
    if (rainPct > 100) rainPct = 100;

    String rainStatus = "Cerah Berawan";
    if (rainPct > 65.0) {
      rainStatus = "Hujan Lebat";
    } else if (rainPct > 35.0) {
      rainStatus = "Hujan Sedang";
    } else if (rainPct > 10.0) {
      rainStatus = "Gerimis";
    }

    // -----------------------------------------------------------------
    // LAPORAN SERIAL MONITOR
    // -----------------------------------------------------------------
    Serial.println("-------------------------------------------------");
    Serial.printf("📏 [KETINGGIAN AIR TOPLES 14 CM]\n");
    Serial.printf("   Jarak ke Air      : %.1f cm\n", distanceCm);
    Serial.printf("   Sampel valid      : %d | Dekat: %d | Timeout: %d\n",
                  sampleValid, sampleDekat, sampleTimeout);
    Serial.printf("   Tinggi Air Kali   : %.1f cm [%s]\n", waterLevelCm, waterStatus.c_str());

    Serial.printf("🌊 [DEBIT & KECEPATAN]\n");
    Serial.printf("   Debit Aliran Air  : %.2f L/menit\n", flowRateLpm);
    Serial.printf("   Kecepatan Arus    : %.2f m/s\n", waterSpeedMps);

    Serial.printf("🌧️ [CURAH HUJAN PIN 33]\n");
    Serial.printf("   Nilai ADC         : %d | Tingkat Basah: %.1f%% (%s)\n",
                  rainAnalog, rainPct, rainStatus.c_str());

    // -----------------------------------------------------------------
    // 4. KIRIM DATA KE WEBSITE EWS (JSON POST) & BACA BALASAN SERVER
    // -----------------------------------------------------------------
    if (WiFi.status() == WL_CONNECTED) {
      WiFiClient client;
      HTTPClient http;
      http.setTimeout(4000);
      http.begin(client, SERVER_URL);
      http.addHeader("Content-Type", "application/json");
      http.setUserAgent("ESP32-EWS");

      // Susun payload JSON
      StaticJsonDocument<300> doc;
      doc["water_level_cm"]  = round(waterLevelCm * 10.0) / 10.0;
      doc["distance_cm"]     = round(distanceCm * 10.0) / 10.0;
      doc["flow_rate_lpm"]   = round(flowRateLpm * 10.0) / 10.0;
      doc["water_speed_mps"] = round(waterSpeedMps * 100.0) / 100.0;
      doc["rain_analog"]     = rainAnalog;
      doc["rain_pct"]        = round(rainPct * 10.0) / 10.0;
      doc["rain_status"]     = rainStatus;
      doc["device_id"]       = DEVICE_ID;

      String payload;
      serializeJson(doc, payload);

      int httpResponse = http.POST(payload);

      if (httpResponse > 0) {
        Serial.printf("✅ Terkirim ke Web! HTTP Respon: %d\n", httpResponse);

        // ✅ BARU: Baca balasan server untuk kontrol relay & buzzer
        String responseBody = http.getString();
        StaticJsonDocument<256> respDoc;
        DeserializationError err = deserializeJson(respDoc, responseBody);

        if (!err && respDoc["success"] == true) {
          // Server mengembalikan id tabel yang tersimpan
          int idKetinggian = respDoc["saved"]["sensor_ketinggian_id"] | 0;
          int idDebit      = respDoc["saved"]["sensor_debit_id"]      | 0;
          int idHujan      = respDoc["saved"]["sensor_hujan_id"]      | 0;
          Serial.printf("   📦 Tersimpan → Ketinggian ID:%d | Debit ID:%d | Hujan ID:%d\n",
                        idKetinggian, idDebit, idHujan);
        }
      } else {
        Serial.printf("❌ Gagal kirim: %s\n", http.errorToString(httpResponse).c_str());
      }

      http.end();

      // -----------------------------------------------------------------
      // 5. BACA STATUS AKTUATOR DARI SERVER (relay & buzzer)
      // -----------------------------------------------------------------
      HTTPClient httpStatus;
      httpStatus.setTimeout(3000);
      httpStatus.begin(client, STATUS_URL);

      int statusCode = httpStatus.GET();
      if (statusCode == 200) {
        String statusBody = httpStatus.getString();
        StaticJsonDocument<512> statusDoc;
        DeserializationError errStatus = deserializeJson(statusDoc, statusBody);

        if (!errStatus) {
          bool newRelay  = statusDoc["sensorState"]["relay_state"]  | false;
          bool newBuzzer = statusDoc["sensorState"]["buzzer_state"] | false;
          String level   = statusDoc["sensorState"]["warning_level"] | "AMAN";

          if (newRelay != relayState || newBuzzer != buzzerState) {
            relayState  = newRelay;
            buzzerState = newBuzzer;
            Serial.printf("🔄 Perintah Server → Relay: %s | Buzzer: %s | Level: %s\n",
                          relayState  ? "ON 🟢" : "OFF ⚫",
                          buzzerState ? "ON 🔴" : "OFF ⚫",
                          level.c_str());
          }
        }
      }

      httpStatus.end();
      client.stop();

    } else {
      Serial.println("⚠️ Wi-Fi terputus, menunggu koneksi otomatis...");
      WiFi.reconnect();
    }

    // -----------------------------------------------------------------
    // Status aktuator terkini
    // -----------------------------------------------------------------
    Serial.printf("🔌 Aktuator → Relay (Pompa): %s | Buzzer (Sirine): %s\n",
                  relayState  ? "ON" : "OFF",
                  buzzerState ? "ON" : "OFF");
    Serial.println("-------------------------------------------------\n");
  }
}
