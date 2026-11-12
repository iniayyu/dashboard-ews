import React, { useRef, useState } from "react";
import {
  User,
  LogOut,
  Shield,
  Activity,
  Radio,
  ChevronDown,
  MessageCircle,
  Menu,
  X,
} from "lucide-react";

import { WarningLevel, AdminUser } from "../types";

interface HeaderProps {
  currentView: "warga" | "admin";
  setCurrentView: (view: "warga" | "admin") => void;
  activeNavSection: string;
  setActiveNavSection: (section: string) => void;
  warningLevel: WarningLevel;
  espOnline: boolean;
  currentUser: AdminUser | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  sirenActive: boolean;
  onToggleSiren: () => void;
  onOpenTelegramModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  setCurrentView,
  activeNavSection,
  setActiveNavSection,
  warningLevel,
  espOnline,
  currentUser,
  onOpenLogin,
  onLogout,
  sirenActive: _sirenActive,
  onToggleSiren: _onToggleSiren,
  onOpenTelegramModal,
}) => {
  const headerRef = useRef<HTMLElement | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "beranda", label: "Beranda" },
    { id: "monitoring-publik", label: "Monitoring Sensor" },
    { id: "panduan-level", label: "Panduan Batas Air" },
    { id: "grafik-riwayat", label: "Grafik & Riwayat" },
    { id: "bot-telegram", label: "Grup WhatsApp" },
    { id: "riwayat-kejadian", label: "Riwayat Kejadian" },
  ];

  const scrollToSection = (id: string) => {
    setActiveNavSection(id);
    setIsMobileMenuOpen(false);
    if (id === "beranda") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const getWarningConfig = () => {
    switch (warningLevel) {
      case "SIAGA":
        return {
          label: "SIAGA",
          wrapper: "bg-rose-50 border-rose-200 text-rose-700",
          dot: "bg-rose-500 animate-pulse",
        };

      case "WASPADA":
        return {
          label: "WASPADA",
          wrapper: "bg-amber-50 border-amber-200 text-amber-700",
          dot: "bg-amber-500 animate-pulse",
        };

      default:
        return {
          label: "AMAN",
          wrapper: "bg-emerald-50 border-emerald-200 text-emerald-700",
          dot: "bg-emerald-500",
        };
    }
  };

  const warningConfig = getWarningConfig();

  const handleSwitchView = () => {
    if (currentView === "admin") {
      setCurrentView("warga");
      setActiveNavSection("beranda");

      window.setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }, 50);

      return;
    }

    setCurrentView("admin");
  };

  /* =======================================================================
      1. TAMPILAN USERS (WARGA) - STRUKTUR FLOATING PILL NAVBAR DENGAN TEMA KITA
  ======================================================================= */
  if (currentView === "warga") {
    return (
      <header
        ref={headerRef}
        className="sticky top-0 z-40 w-full bg-slate-50/80 backdrop-blur-md transition-all"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5">
          <div className="relative bg-white/95 border border-slate-200/90 rounded-2xl px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-sm backdrop-blur-md">
            {/* BRAND LOGO & SYSTEM TITLE (Logo + Brand Typography) */}
            <div
              onClick={() => scrollToSection("beranda")}
              className="flex items-center gap-2.5 cursor-pointer select-none shrink-0"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-[#0066cc] to-sky-400 p-[1.5px] shadow-sm flex items-center justify-center">
                <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-[#0066cc]" />
                </div>
              </div>

              <span className="text-slate-900 font-extrabold text-sm sm:text-base tracking-tight font-sans whitespace-nowrap">
                Smart EWS
              </span>
            </div>

            {/* HORIZONTAL NAV LINKS (Text links with Blue Underline on Active) */}
            <nav className="hidden lg:flex items-center justify-center gap-5 xl:gap-8 flex-1 mx-4">
              {navItems.map((item) => {
                const isActive = activeNavSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={`relative py-1 text-xs xl:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? "text-[#0066cc] font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span>{item.label}</span>
                    {isActive && (
                      <span className="absolute -bottom-1.5 left-0 right-0 h-[2.5px] bg-[#0066cc] rounded-full shadow-xs" />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* RIGHT SIDE ACTIONS (Solid Blue CTA Button, Mobile Toggle) */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Blue CTA Button */}
              {currentUser ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSwitchView}
                    title="Buka Panel Administrator"
                    className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#0066cc] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Activity className="w-4 h-4" />
                    <span>Administrator</span>
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    title="Keluar Akun Admin"
                    aria-label="Keluar dari akun admin"
                    className="p-2 sm:p-2.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors shadow-2xs cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenLogin}
                  title="Login Petugas Admin"
                  className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#0066cc] hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                >
                  <User className="w-4 h-4" />
                  <span>Login Admin</span>
                </button>
              )}

              {/* Mobile Hamburger Button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu navigasi"
                className="lg:hidden p-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="lg:hidden mt-2 bg-white/95 border border-slate-200 rounded-2xl p-3 shadow-xl backdrop-blur-md">
              <div className="flex flex-col space-y-1">
                {navItems.map((item) => {
                  const isActive = activeNavSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className={`text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        isActive
                          ? "bg-blue-50 text-[#0066cc] border-l-2 border-[#0066cc] font-bold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>
    );
  }

  /* =======================================================================
      2. TAMPILAN ADMIN - CLEAN WHITE TOOLBAR DENGAN BORDER CARD SESUAI REVISI
  ======================================================================= */
  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 w-full bg-white shadow-sm"
    >
      <div className="bg-white border-b border-slate-200">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* LOGO DAN NAMA SISTEM */}
            <div className="flex items-center gap-2 min-w-0 shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-sm">
                <Shield className="w-5 h-5" />
              </div>

              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-slate-800 leading-tight whitespace-nowrap">
                  SMART EWS BANJIR
                </span>

                <span className="text-[10px] text-slate-500 leading-tight">
                  Panel Administrator Posko
                </span>
              </div>
            </div>

            {/* ACTION BAR ADMIN */}
            <div className="flex items-center justify-end gap-2 sm:gap-3 min-w-0">
              {/* STATUS SISTEM */}
              <div
                className={`hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg border ${warningConfig.wrapper}`}
                title={`Status sistem: ${warningConfig.label}`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${warningConfig.dot}`}
                />

                <div className="flex flex-col leading-tight">
                  <span className="text-[9px] uppercase font-bold tracking-wide opacity-70">
                    Status Sistem
                  </span>

                  <span className="text-xs font-extrabold">
                    {warningConfig.label}
                  </span>
                </div>
              </div>

              {/* STATUS ESP32 */}
              <div
                className="hidden sm:flex px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold items-center gap-1.5 shadow-2xs"
                title={
                  espOnline
                    ? "ESP32 terhubung realtime"
                    : "ESP32 sedang offline"
                }
              >
                <Radio
                  className={`w-4 h-4 shrink-0 ${
                    espOnline
                      ? "text-emerald-600 animate-pulse"
                      : "text-rose-500"
                  }`}
                />
                <span>ESP32 {espOnline ? "Online" : "Offline"}</span>
              </div>

              {/* WHATSAPP */}
              <button
                type="button"
                onClick={onOpenTelegramModal}
                title="Grup WhatsApp Warga"
                className="hidden sm:flex px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold items-center gap-1.5 transition-colors shadow-2xs"
              >
                <MessageCircle className="w-4 h-4 text-blue-700" />
                <span>Grup WhatsApp</span>
              </button>

              {/* MENU ADMIN */}
              {currentUser && (
                <div className="relative group">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <User className="w-4 h-4 text-blue-700" />

                    <span className="hidden lg:inline max-w-28 truncate">
                      {currentUser.name || currentUser.username}
                    </span>

                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
                    <div className="w-52 bg-white border border-slate-200 rounded-xl shadow-xl p-2">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1">
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {currentUser.name || currentUser.username}
                        </p>

                        <p className="text-[10px] text-slate-500 truncate">
                          {currentUser.role || "Administrator"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleSwitchView}
                        className="w-full px-3 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors"
                      >
                        <Activity className="w-4 h-4" />
                        Tampilan Warga
                      </button>

                      <button
                        type="button"
                        onClick={onLogout}
                        className="w-full px-3 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Keluar dari Admin
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
