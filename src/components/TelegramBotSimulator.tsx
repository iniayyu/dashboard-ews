import React, { useState } from "react";
import { Send, Bot, Users, ExternalLink, QrCode } from "lucide-react";
import { SensorState, TelegramChatMessage } from "../types";

interface TelegramBotSimulatorProps {
  sensorState: SensorState;
  groupName: string;
  inviteLink: string;
}

export const TelegramBotSimulator: React.FC<TelegramBotSimulatorProps> = ({
  sensorState,
  groupName,
  inviteLink,
}) => {
  const initialWelcomeMsg: TelegramChatMessage = {
    id: "msg-1",
    sender: "bot",
    text: `🤖 *Bot Siaga Banjir Posko EWS*\n\nHalo Warga! Selamat datang di bot pemantau banjir otomatis Cilangkap/Cipayung.\n\nSilakan klik salah satu tombol pertanyaan di bawah atau ketik langsung apa yang ingin Anda tanyakan.`,
    time: "08:00",
  };

  const [messages, setMessages] = useState<TelegramChatMessage[]>([
    initialWelcomeMsg,
    {
      id: "msg-2",
      sender: "bot",
      text: `📢 *Update Otomatis:* Status saat ini *${sensorState.warning_level}*. Ketinggian air sungai *${sensorState.water_level_cm} cm*, kecepatan arus *${sensorState.flow_rate_lpm} L/min*. Tetap tenang dan waspada!`,
      time: "Baru saja",
    },
  ]);

  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg: TelegramChatMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: queryText,
      time: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    // Keep the welcome message + current interaction so the card stays aligned without needing a scrollbar
    setMessages([initialWelcomeMsg, userMsg]);
    setInputVal("");
    setIsTyping(true);

    try {
      const lower = queryText.toLowerCase();
      let cmd = queryText;
      if (
        lower.includes("tinggi") ||
        lower.includes("ketinggian") ||
        lower.includes("kedalaman")
      ) {
        cmd = "/ketinggian";
      } else if (
        lower.includes("kecepatan") ||
        lower.includes("arus") ||
        lower.includes("debit") ||
        lower.includes("aliran")
      ) {
        cmd = "/kecepatan";
      } else if (
        lower.includes("hujan") ||
        lower.includes("gerimis") ||
        lower.includes("cuaca")
      ) {
        cmd = "/hujan";
      } else if (
        lower.includes("evakuasi") ||
        lower.includes("mengungsi") ||
        lower.includes("titik kumpul") ||
        lower.includes("aman")
      ) {
        cmd = "/evakuasi";
      } else if (
        lower.includes("bantuan") ||
        lower.includes("kontak") ||
        lower.includes("posko") ||
        lower.includes("nomor")
      ) {
        cmd = "/posko";
      } else if (
        lower.includes("status") ||
        lower.includes("kondisi") ||
        lower.includes("aman")
      ) {
        cmd = "/status";
      }

      const res = await fetch("/api/telegram/bot-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });

      const data = await res.json();
      setTimeout(() => {
        setIsTyping(false);
        setMessages([
          initialWelcomeMsg,
          userMsg,
          {
            id: `bot-${Date.now()}`,
            sender: "bot",
            text: data.reply,
            time:
              data.timestamp ||
              new Date().toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
        ]);
      }, 400);
    } catch {
      setIsTyping(false);
      setMessages([
        initialWelcomeMsg,
        userMsg,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: `📊 Ketinggian Air: ${sensorState.water_level_cm} cm | Arus: ${sensorState.flow_rate_lpm} L/min | Status: ${sensorState.warning_level}`,
          time: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    }
  };

  const quickCommands = [
    { label: "📊 Status Terkini", cmd: "/status" },
    { label: "📏 Berapa Ketinggian Air Hari Ini?", cmd: "/ketinggian" },
    { label: "🌊 Berapa Kecepatan Aliran Air?", cmd: "/kecepatan" },
    { label: "🌧️ Apakah Hujan Lebat?", cmd: "/hujan" },
    { label: "🏃‍♂️ Di Mana Titik Evakuasi?", cmd: "/evakuasi" },
    { label: "📞 Nomor Posko", cmd: "/posko" },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full flex-1">
      {/* Telegram Group Header: Clean Blue */}
      <div className="bg-[#0088cc] text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-white shadow-inner">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm sm:text-base">
                {groupName}
              </h4>
              <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-semibold">
                Grup Resmi
              </span>
            </div>
            <p className="text-xs text-white/90">
              312 anggota · Bot Siaga Otomatis 24 Jam
            </p>
          </div>
        </div>

        {/* Join Real Group & QR Trigger */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQrModal(true)}
            className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            title="Tampilkan QR Code"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">QR Code</span>
          </button>
          <a
            href={inviteLink || "https://t.me"}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-white text-[#0088cc] hover:bg-blue-50 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <span>Gabung</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Telegram Chat Message History (No Scrollbar, expands to match right column) */}
      <div className="flex-1 p-4 sm:p-5 space-y-3.5 bg-slate-50 flex flex-col justify-between">
        <div className="space-y-3.5">
          <div className="text-center my-1">
            <span className="text-[11px] bg-slate-200/80 text-slate-600 px-3 py-1 rounded-full font-medium">
              Simulasi Percakapan Bot Telegram untuk Warga
            </span>
          </div>

          {messages.map((msg) => {
            const isBot = msg.sender === "bot";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}
              >
                <div
                  className={`max-w-[88%] sm:max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm shadow-2xs leading-relaxed whitespace-pre-wrap ${
                    isBot
                      ? "bg-white border border-slate-200 text-slate-800 rounded-tl-xs"
                      : "bg-[#0088cc] text-white rounded-tr-xs font-medium"
                  }`}
                >
                  {isBot && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 mb-1">
                      <Bot className="w-4 h-4" />
                      <span>EWS Siaga Bot Cilangkap</span>
                    </div>
                  )}
                  <div
                    dangerouslySetInnerHTML={{
                      __html: msg.text
                        .replace(
                          /\*(.*?)\*/g,
                          '<strong class="font-extrabold text-blue-900">$1</strong>',
                        )
                        .replace(/\n/g, "<br/>"),
                    }}
                  />
                  <div
                    className={`text-[10px] mt-1.5 text-right ${
                      isBot ? "text-slate-400" : "text-blue-100"
                    }`}
                  >
                    {msg.time}
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3 py-2 rounded-xl w-fit border border-slate-200">
              <Bot className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="italic">
                Bot sedang membaca sensor terbaru...
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Preset Quick Chips for Elderly / Citizens */}
      <div className="bg-white border-t border-slate-200 p-3 flex flex-wrap gap-1.5 shrink-0">
        {quickCommands.map((qc) => (
          <button
            key={qc.cmd}
            onClick={() => handleSendQuery(qc.cmd)}
            className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold transition-colors shadow-2xs"
          >
            {qc.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendQuery(inputVal);
        }}
        className="bg-white p-3 border-t border-slate-200 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Ketik pertanyaan (contoh: ketinggian air hari ini berapa?)..."
          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
        />
        <button
          type="submit"
          disabled={!inputVal.trim()}
          className="p-2.5 bg-[#0088cc] hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-colors shadow-2xs"
          title="Kirim pesan"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* QR Code Modal for joining group */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <h3 className="font-extrabold text-slate-900 text-lg mb-1">
              QR Code Grup Telegram Warga
            </h3>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Arahkan kamera ponsel Anda ke QR code di bawah untuk bergabung
              langsung ke grup siaga banjir warga Cilangkap/Cipayung.
            </p>

            <div className="w-52 h-52 mx-auto bg-white p-3 rounded-2xl border-2 border-slate-200 flex flex-col items-center justify-center shadow-sm">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=6&color=1e3a8a&data=${encodeURIComponent(
                  inviteLink || "https://t.me/+GEfQik2yg3IxZDZl",
                )}`}
                alt="QR Code Grup Telegram EWS TCE"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>

            <div className="mt-4 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-blue-700 break-all select-all">
              {inviteLink}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowQrModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                Tutup
              </button>
              <a
                href={inviteLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 bg-[#0088cc] hover:bg-blue-700 text-white rounded-xl text-xs font-bold text-center"
              >
                Buka Telegram
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
