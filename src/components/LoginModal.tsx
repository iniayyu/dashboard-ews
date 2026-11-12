import React, { useEffect, useState } from "react";
import {
  Lock,
  User,
  AlertCircle,
  X,
  Shield,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { AdminUser } from "../types";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AdminUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError("");
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setError("ID Admin atau Username wajib diisi.");
      return;
    }

    if (!password) {
      setError("Kata sandi wajib diisi.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: cleanUsername,
          username: cleanUsername,
          password,
        }),
      });

      let data: any = {};

      try {
        data = await res.json();
      } catch {
        data = {};
      }

      const loginSuccess =
        res.ok && (data?.status === "success" || data?.success === true);

      if (loginSuccess) {
        const user: AdminUser = data?.user ?? {
          id: cleanUsername,
          name: "Administrator",
          username: cleanUsername,
          role: "Admin Posko",
        };

        onLoginSuccess(user);
        onClose();
        return;
      }

      setError(
        data?.message ||
          data?.error ||
          "Login gagal. Periksa kembali ID Admin/Username dan kata sandi Anda.",
      );
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      setError(
        "Gagal menghubungi server posko. Pastikan server SIAGA EWS sedang berjalan.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative">
        {/* Tombol close */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors p-1.5 rounded-xl hover:bg-slate-100 disabled:opacity-50"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center font-bold">
            <Shield className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-xl font-extrabold text-slate-900">
              Login Petugas Posko EWS
            </h3>

            <p className="text-xs text-slate-500 mt-0.5">
              Masuk dengan ID Admin / Username & kata sandi
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
          {/* ID Admin / Username */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              ID Admin atau Username
            </label>

            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                required
                autoComplete="username"
                disabled={loading}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white text-sm disabled:opacity-60 font-mono"
                placeholder="Contoh: admin, ADM-01, atau username Anda"
              />

              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              Kata Sandi
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                required
                autoComplete="current-password"
                disabled={loading}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white text-sm disabled:opacity-60"
                placeholder="Masukkan kata sandi..."
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex gap-3">
            {/* Batal */}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              Batal
            </button>

            {/* Login */}
            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="flex-1 py-3 bg-[#0066cc] hover:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <span>Masuk Dashboard</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
