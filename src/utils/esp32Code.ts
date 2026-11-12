export function getEsp32ArduinoCode(serverUrl: string = 'http://192.168.1.100:3000'): string {
  return `/*
 * =========================================================================
 * SISTEM PERINGATAN DINI BANJIR (EWS) BERBASIS ESP32
 * Sensor:
 *  1. HC-SR04 (Ultrasonic Water Level Sensor)
 *  2. YF-S201 (Water Flow / Kecepatan Arus Sensor)
 *  3. DC 3V-5V Raindrop / Rain Water Level Sensor
 * Output:
 *  - Relay (Pin D26) -> Pompa Air / Pintu Air
 *  - Buzzer (Pin D27) -> Sirine Peringatan
 *  - LED Hijau (D18), Kuning (D19), Merah (D21)
 * =========================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Library ArduinoJson v6/v7

// 1. Kredensial WiFi
const char* ssid = "NAMA_WIFI_ANDA";
const char* password = "PASSWORD_WIFI";

// 2. URL Server EWS (Ganti dengan IP / Domain server web ini)
const char* serverEndpoint = "${serverUrl}/api/sensor-data";

// 3. Konfigurasi Pinout ESP32
#define PIN_TRIG 5          // HC-SR04 Trig
#define PIN_ECHO 18         // HC-SR04 Echo
#define PIN_FLOW_SENSOR 4   // YF-S201 Signal (Interrupt Pin)
#define PIN_RAIN_ANALOG 34  // Rain Sensor AO (Analog ADC1)

#define PIN_RELAY 26        // Relay Output (Active LOW / HIGH)
#define PIN_BUZZER 27       // Buzzer Pasif / Aktif
#define PIN_LED_HIJAU 19    // LED Indikator Aman
#define PIN_LED_KUNING 22   // LED Indikator Waspada
#define PIN_LED_MERAH 23    // LED Indikator Siaga / Bahaya

// 4. Parameter Fisik Kali/Sungai (dalam cm)
const float TINGGI_TIANG_SENSOR = 250.0; // Jarak sensor ke dasar sungai saat kering

// 5. Variabel Flow Meter (YF-S201)
volatile unsigned long pulseCount = 0;
float flowRateLPM = 0.0;
unsigned long oldTime = 0;

// ISR Interrupt untuk YF-S201
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n[EWS] Memulai Inisialisasi EWS Banjir ESP32...");

  // Setup Pin Mode
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_FLOW_SENSOR, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR), pulseCounter, FALLING);

  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_HIJAU, OUTPUT);
  pinMode(PIN_LED_KUNING, OUTPUT);
  pinMode(PIN_LED_MERAH, OUTPUT);

  // Inisialisasi Kondisi Awal Output (Mati)
  digitalWrite(PIN_RELAY, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_LED_HIJAU, HIGH); // Standby Hijau

  // Koneksi WiFi
  WiFi.begin(ssid, password);
  Serial.print("[WiFi] Menghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\n[WiFi] Berhasil Terhubung! IP ESP32: " + WiFi.localIP().toString());
}

void loop() {
  // A. Baca HC-SR04 (Ultrasonic)
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000); // Timeout 30ms (~5 meter)
  float distanceCm = 0;
  float waterLevelCm = 0;

  if (duration > 0) {
    distanceCm = (duration * 0.0343) / 2.0;
    waterLevelCm = TINGGI_TIANG_SENSOR - distanceCm;
    if (waterLevelCm < 0) waterLevelCm = 0;
  } else {
    distanceCm = TINGGI_TIANG_SENSOR; // Gagal baca / di luar jangkauan
    waterLevelCm = 0;
  }

  // B. Hitung Flow Rate YF-S201 (Setiap interval 1 detik)
  if ((millis() - oldTime) > 1000) {
    detachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR));
    // Kalibrasi YF-S201: F = 7.5 * Q (L/min) -> Q = F / 7.5
    flowRateLPM = ((1000.0 / (millis() - oldTime)) * pulseCount) / 7.5;
    oldTime = millis();
    pulseCount = 0;
    attachInterrupt(digitalPinToInterrupt(PIN_FLOW_SENSOR), pulseCounter, FALLING);
  }

  // C. Baca Sensor Hujan (Analog ADC)
  int rainAnalog = analogRead(PIN_RAIN_ANALOG); // 0 (sangat basah) - 4095 (kering)
  int rainPct = map(4095 - rainAnalog, 0, 4095, 0, 100);
  if (rainPct < 0) rainPct = 0;
  if (rainPct > 100) rainPct = 100;

  Serial.printf("[SENSOR] Air: %.1f cm | Jarak: %.1f cm | Flow: %.1f L/m | Hujan: %d%%\\n", 
                waterLevelCm, distanceCm, flowRateLPM, rainPct);

  // D. Kirim Data ke Web Server EWS via HTTP POST
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverEndpoint);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["device_id"] = "ESP32-EWS-BENGAL-01";
    doc["distance_cm"] = distanceCm;
    doc["water_level_cm"] = waterLevelCm;
    doc["flow_rate_lpm"] = flowRateLPM;
    doc["rain_analog"] = rainAnalog;
    doc["rain_pct"] = rainPct;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("[HTTP] Server Response: " + response);

      // Parsing perintah aktuator dari server
      StaticJsonDocument<256> respDoc;
      DeserializationError err = deserializeJson(respDoc, response);
      if (!err) {
        int relayCmd = respDoc["relay"] | 0;
        int buzzerCmd = respDoc["buzzer"] | 0;
        const char* warningLevel = respDoc["warning_level"] | "AMAN";

        // Terapkan ke Output Fisik
        digitalWrite(PIN_RELAY, relayCmd ? HIGH : LOW);
        digitalWrite(PIN_BUZZER, buzzerCmd ? HIGH : LOW);

        // LED Indicator
        if (strcmp(warningLevel, "BAHAYA") == 0) {
          digitalWrite(PIN_LED_HIJAU, LOW);
          digitalWrite(PIN_LED_KUNING, LOW);
          digitalWrite(PIN_LED_MERAH, HIGH);
        } else if (strcmp(warningLevel, "SIAGA") == 0) {
          digitalWrite(PIN_LED_HIJAU, LOW);
          digitalWrite(PIN_LED_KUNING, HIGH);
          digitalWrite(PIN_LED_MERAH, HIGH);
        } else if (strcmp(warningLevel, "WASPADA") == 0) {
          digitalWrite(PIN_LED_HIJAU, LOW);
          digitalWrite(PIN_LED_KUNING, HIGH);
          digitalWrite(PIN_LED_MERAH, LOW);
        } else {
          digitalWrite(PIN_LED_HIJAU, HIGH);
          digitalWrite(PIN_LED_KUNING, LOW);
          digitalWrite(PIN_LED_MERAH, LOW);
        }
      }
    } else {
      Serial.printf("[HTTP] Gagal kirim error: %d\\n", httpResponseCode);
    }
    http.end();
  }

  delay(3000); // Polling setiap 3 detik
}
`;
}
