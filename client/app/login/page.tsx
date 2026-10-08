'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { toast } from 'sonner';
import Link from 'next/link';
import { Shield, ArrowRight, Sun, Moon, CheckCircle2, Lock, Building2, Eye, EyeOff, Smartphone, Phone } from 'lucide-react';
import { RockerToggle } from '../../components/RockerToggle';
import { api } from '../../lib/api';

export default function LoginPage() {
  const { loginStaff, sendPatientOtp, verifyPatientOtp, loading, user, patient, userType } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [authMode, setAuthMode] = useState<'staff' | 'patient'>('staff');

  // Staff Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);

  // Patient Form
  const [phone, setPhone] = useState('');
  const [otpChannel, setOtpChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [patientLoading, setPatientLoading] = useState(false);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [sentChannel, setSentChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [waAvailable, setWaAvailable] = useState(true); // OPT 4: WA status

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // OPT 4: Check WhatsApp availability on mount
  useEffect(() => {
    api.get('/whatsapp/status')
      .then((res) => setWaAvailable(res.data?.data?.connected ?? false))
      .catch(() => setWaAvailable(false));
  }, []);

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }
    setStaffLoading(true);
    try {
      await loginStaff(username, password);
      toast.success('Logged in successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setStaffLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    setPatientLoading(true);
    try {
      const res = await sendPatientOtp(phone, otpChannel);
      setOtpSent(true);
      setSentChannel(res.channel as 'sms' | 'whatsapp' ?? otpChannel);
      setResendTimer(30);
      if (res.devOtp) {
        setDevOtpHint(res.devOtp);
        toast.info(`Dev Mode OTP: ${res.devOtp}`);
      } else if (res.fallback) {
        // OPT 3: WhatsApp fell back to SMS
        toast.warning('WhatsApp unavailable — OTP sent via SMS instead');
      } else {
        const channelLabel = otpChannel === 'whatsapp' ? 'WhatsApp' : 'SMS';
        toast.success(`OTP sent via ${channelLabel}`);
      }
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setPatientLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = val.slice(-1);
    setOtpDigits(newDigits);

    // Auto-advance
    if (val && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      toast.error('Please enter complete 6-digit OTP');
      return;
    }
    setPatientLoading(true);
    try {
      await verifyPatientOtp(phone, fullOtp);
      toast.success('Authenticated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid or expired OTP');
    } finally {
      setPatientLoading(false);
    }
  };

  // Resend OTP — same channel, resets digit boxes and dev hint
  const handleResendOtp = async () => {
    setOtpDigits(['', '', '', '', '', '']);
    setDevOtpHint(null);
    setPatientLoading(true);
    try {
      const res = await sendPatientOtp(phone, sentChannel);
      setResendTimer(30);
      if (res.devOtp) {
        setDevOtpHint(res.devOtp);
        toast.info(`Development Mode: OTP is ${res.devOtp}`);
      } else {
        const channelLabel = sentChannel === 'whatsapp' ? 'WhatsApp' : 'SMS';
        toast.success(`New OTP sent via ${channelLabel}`);
      }
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setPatientLoading(false);
    }
  };

  const quickFillStaff = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] relative overflow-hidden flex-col gap-6">
      {/* Subtle Background Glow */}
      <div className="absolute w-96 h-96 rounded-full bg-[var(--brass)]/5 blur-3xl -top-20 -left-20 pointer-events-none" />
      <div className="absolute w-96 h-96 rounded-full bg-[var(--success)]/5 blur-3xl -bottom-20 -right-20 pointer-events-none" />

      {/* Theme Toggle Top Right */}
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          type="button"
          className="p-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <div className="w-full max-w-md surface-card p-8 relative z-10 shadow-2xl border border-[var(--border-light)]">
        {/* Logo and Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[var(--brass)] mx-auto flex items-center justify-center text-white font-bold text-lg shadow-[0_0_20px_rgba(201,138,75,0.4)] mb-3">
            DT
          </div>
          <h2 className="font-display text-xl font-bold tracking-tight text-[var(--text)]">
            DERMATRACK CLINICAL ERP
          </h2>
          <p className="text-xs text-[var(--text-dim)] mt-1">
            Trichology & Scalp Dermatology Management System
          </p>
        </div>

        {/* Role Segmented Switch */}
        <div className="flex justify-center mb-6">
          <RockerToggle
            options={[
              { label: 'STAFF ACCESS', value: 'staff' },
              { label: 'PATIENT PORTAL', value: 'patient' },
            ]}
            value={authMode}
            onChange={(val) => {
              setAuthMode(val as 'staff' | 'patient');
              setOtpSent(false);
            }}
          />
        </div>

        {/* ================= STAFF LOGIN FORM ================= */}
        {authMode === 'staff' && (
          <form onSubmit={handleStaffSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                Username or Admin Email
              </label>
              <div className="relative">
                <Shield className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                <input
                  type="text"
                  required
                  placeholder="admin, dr.ananya, admin@clinic.com..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--text-dim)] hover:text-[var(--brass)] transition-colors rounded focus:outline-none"
                  title={showPassword ? 'Hide password' : 'Show password'}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-[var(--brass)]" />
                  ) : (
                    <Eye className="w-4 h-4 hover:text-[var(--brass)]" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={staffLoading}
              className="w-full btn-brass py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2 mt-2"
            >
              {staffLoading ? 'Authenticating...' : 'Sign in to Workstation'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Demo Quick Presets */}
            <div className="mt-6 pt-4 border-t border-[var(--border)]">
              <span className="block font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2 text-center">
                Demo Accounts Quick-Fill:
              </span>
              <div className="flex flex-wrap gap-1.5 justify-center">
                <button
                  type="button"
                  onClick={() => quickFillStaff('admin', 'admin123')}
                  className="text-[11px] font-mono px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--brass)]"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => quickFillStaff('dr.ananya', 'doctor123')}
                  className="text-[11px] font-mono px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--brass)]"
                >
                  Doctor
                </button>
                <button
                  type="button"
                  onClick={() => quickFillStaff('receptionist', 'staff123')}
                  className="text-[11px] font-mono px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--brass)]"
                >
                  Receptionist
                </button>
                <button
                  type="button"
                  onClick={() => quickFillStaff('medgiver', 'staff123')}
                  className="text-[11px] font-mono px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--brass)]"
                >
                  Pharmacy
                </button>
                <button
                  type="button"
                  onClick={() => quickFillStaff('stockmanager', 'staff123')}
                  className="text-[11px] font-mono px-2 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] rounded text-[var(--text-dim)] hover:text-[var(--brass)]"
                >
                  Stock
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ================= PATIENT OTP FORM ================= */}
        {authMode === 'patient' && (
          <div className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Registered Mobile Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] font-mono tracking-wider"
                    />
                  </div>
                  <span className="text-[11px] text-[var(--text-dim)] mt-1 block">
                    Demo phone: <code className="text-[var(--brass)]">9876543210</code> (Aarav Mehta)
                  </span>
                </div>

              {/* Channel Picker */}
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-2">
                    Receive OTP Via
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* SMS Option */}
                    <button
                      type="button"
                      id="otp-channel-sms"
                      onClick={() => setOtpChannel('sms')}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm font-medium transition-all duration-200 ${
                        otpChannel === 'sms'
                          ? 'bg-[var(--brass-glow)] border-[var(--brass)] text-[var(--brass)] shadow-[0_0_12px_rgba(201,138,75,0.2)]'
                          : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--brass)]/50 hover:text-[var(--text)]'
                      }`}
                    >
                      <Smartphone className="w-4 h-4 shrink-0" />
                      <span className="font-mono text-xs">Via SMS</span>
                      {otpChannel === 'sms' && (
                        <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />
                      )}
                    </button>

                    {/* WhatsApp Option */}
                    <button
                      type="button"
                      id="otp-channel-whatsapp"
                      onClick={() => waAvailable && setOtpChannel('whatsapp')}
                      disabled={!waAvailable}
                      title={!waAvailable ? 'WhatsApp is currently unavailable on this server' : undefined}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm font-medium transition-all duration-200 ${
                        !waAvailable
                          ? 'opacity-40 cursor-not-allowed bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-dim)]'
                          : otpChannel === 'whatsapp'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                            : 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-dim)] hover:border-emerald-500/50 hover:text-[var(--text)]'
                      }`}
                    >
                      {/* WhatsApp SVG icon */}
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      <span className="font-mono text-xs">WhatsApp</span>
                      {otpChannel === 'whatsapp' && (
                        <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />
                      )}
                    </button>
                  </div>
                  {!waAvailable && (
                    <div className="mt-2 text-[11px] text-[var(--text-dim)]">
                      <span>WhatsApp OTP is currently unavailable. Please use SMS.</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={patientLoading}
                  className="w-full btn-brass py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                >
                  {patientLoading ? 'Sending OTP...' : 'Send Verification Code'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="text-center">
                  <span className="text-xs text-[var(--text-dim)]">
                    Code sent to{' '}
                    <span className="text-[var(--text)] font-mono font-medium">+91 {phone}</span>
                    {' '}via{' '}
                    <span className={`font-semibold ${
                      sentChannel === 'whatsapp' ? 'text-emerald-400' : 'text-[var(--brass)]'
                    }`}>
                      {sentChannel === 'whatsapp' ? '💬 WhatsApp' : '📱 SMS'}
                    </span>
                  </span>
                  {devOtpHint && (
                    <div className="mt-2 p-2 bg-[var(--brass-glow)] border border-[var(--brass)]/30 rounded text-xs font-mono text-[var(--brass)]">
                      ⚡ Dev Mode OTP: <strong>{devOtpHint}</strong>
                    </div>
                  )}
                </div>

                {/* 6-Digit Box Input */}
                <div className="flex justify-between gap-2 my-4">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-11 h-12 text-center text-lg font-mono font-bold bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)] focus:ring-1 focus:ring-[var(--brass)]"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={patientLoading}
                  className="w-full btn-brass py-2.5 rounded-md text-sm font-medium flex items-center justify-center gap-2"
                >
                  {patientLoading ? 'Verifying...' : 'Verify & Enter Portal'}
                  <CheckCircle2 className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-[var(--text-dim)] hover:text-[var(--text)] underline font-mono"
                  >
                    Change Number
                  </button>
                  <button
                    type="button"
                    disabled={resendTimer > 0 || patientLoading}
                    onClick={handleResendOtp}
                    className={`font-mono ${
                      resendTimer > 0 ? 'text-[var(--text-dim)]' : 'text-[var(--brass)] hover:underline'
                    }`}
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* New Hospital / Clinic Registration CTA */}
      <div className="w-full max-w-md p-4 bg-[var(--surface-2)]/80 backdrop-blur-sm border border-[var(--border)] rounded-xl flex items-center justify-between text-xs z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--brass-glow)] border border-[var(--brass)]/30 flex items-center justify-center text-[var(--brass)] shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-[var(--text)] block">Are you a Hospital or Clinic?</span>
            <span className="text-[11px] text-[var(--text-dim)] block">Set up your multi-module clinical ERP</span>
          </div>
        </div>
        <Link
          href="/register-hospital"
          className="btn-brass px-3 py-1.5 rounded-md text-xs font-mono font-medium flex items-center gap-1 shrink-0 ml-2"
        >
          <span>Register</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
