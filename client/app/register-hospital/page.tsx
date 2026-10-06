'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { toast } from 'sonner';
import {
  Building2,
  Stethoscope,
  Building,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sun,
  Moon,
  Shield,
  Lock,
  Mail,
  Globe,
  Phone,
  MapPin,
  Image as ImageIcon,
  Sparkles,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
} from 'lucide-react';
import { HospitalBrandBadge, getHospitalInitials } from '../../components/HospitalBrandBadge';

export default function RegisterHospitalPage() {
  const router = useRouter();
  const { loginStaff, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Wizard Step (1: Type & Names, 2: Admin & Details, 3: Branding & Media, 4: Preview & Confirm)
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [facilityType, setFacilityType] = useState<'BigHospital' | 'Hospital' | 'Clinic'>('Clinic');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Media Upload State
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Real-time Field Conflict State
  const [conflicts, setConflicts] = useState<{ [key: string]: string }>({});
  const [checkingUniqueness, setCheckingUniqueness] = useState(false);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Debounced Uniqueness Check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!name && !shortName && !email && !websiteUrl) return;
      try {
        setCheckingUniqueness(true);
        const res = await api.post('/hospitals/validate-uniqueness', {
          name: name.trim() || undefined,
          shortName: shortName.trim() || undefined,
          email: email.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
        });
        setConflicts(res.data.conflicts || {});
      } catch {
        // Ignore validation query network error
      } finally {
        setCheckingUniqueness(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [name, shortName, email, websiteUrl]);

  // Handle Logo Upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file size must be less than 5MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Handle Facility Image Upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image file size must be less than 5MB');
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Validation before going to Step 2
  const handleNextToStep2 = () => {
    if (!name.trim()) {
      toast.error('Please enter the Hospital/Clinic Full Name');
      return;
    }
    if (!shortName.trim()) {
      toast.error('Please enter the Hospital Short Name');
      return;
    }
    if (conflicts.name) {
      toast.error(conflicts.name);
      return;
    }
    if (conflicts.shortName) {
      toast.error(conflicts.shortName);
      return;
    }
    setCurrentStep(2);
  };

  // Validation before going to Step 3
  const handleNextToStep3 = () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid administrator email address');
      return;
    }
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (conflicts.email) {
      toast.error(conflicts.email);
      return;
    }
    if (conflicts.websiteUrl) {
      toast.error(conflicts.websiteUrl);
      return;
    }
    setCurrentStep(3);
  };

  // Final Registration Submission
  const handleRegisterHospital = async () => {
    try {
      setLoading(true);

      let uploadedLogoUrl = '';
      let uploadedImageUrl = '';

      // Upload media if files selected
      if (logoFile || imageFile) {
        const formData = new FormData();
        if (logoFile) formData.append('logo', logoFile);
        if (imageFile) formData.append('image', imageFile);

        const mediaRes = await api.post('/hospitals/upload-media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (mediaRes.data?.data) {
          uploadedLogoUrl = mediaRes.data.data.logoUrl || '';
          uploadedImageUrl = mediaRes.data.data.imageUrl || '';
        }
      }

      // Register Hospital & Admin
      const payload = {
        type: facilityType,
        name: name.trim(),
        shortName: shortName.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        websiteUrl: websiteUrl.trim() || undefined,
        logoUrl: uploadedLogoUrl || undefined,
        imageUrl: uploadedImageUrl || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
      };

      const res = await api.post('/hospitals/register', payload);
      const { token } = res.data.data;
      if (token) localStorage.setItem('token', token);

      await refreshUser();

      toast.success(`🎉 ${shortName} registered successfully! Welcome to DermaTrack.`);
      router.push('/admin');
    } catch (err: any) {
      const errMsg =
        err.response?.data?.details?.[0]?.message ||
        err.response?.data?.error ||
        'Registration failed. Please check form details.';
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const initials = getHospitalInitials(shortName || name);

  return (
    <div className="min-h-screen bg-[var(--bg)] relative overflow-hidden py-10 px-4 flex flex-col justify-between">
      {/* Background Decorative Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[var(--brass)]/5 blur-3xl -top-32 -left-32 pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[var(--success)]/5 blur-3xl -bottom-32 -right-32 pointer-events-none" />

      {/* Header Bar */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-between mb-8 z-10">
        <Link href="/login" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-[var(--brass)] flex items-center justify-center text-white font-bold text-sm shadow-[0_0_12px_rgba(201,138,75,0.4)]">
            DT
          </div>
          <div>
            <span className="font-display font-bold text-sm tracking-wider text-[var(--text)] block group-hover:text-[var(--brass)] transition-colors">
              DERMATRACK ERP
            </span>
            <span className="font-mono text-[10px] text-[var(--text-dim)] uppercase tracking-wider block">
              Multi-Clinic Onboarding
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            type="button"
            className="p-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link
            href="/login"
            className="text-xs font-mono px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-all"
          >
            Existing Sign In
          </Link>
        </div>
      </div>

      {/* Main Multi-Step Container */}
      <div className="max-w-2xl mx-auto w-full surface-card p-6 sm:p-10 relative z-10 shadow-2xl border border-[var(--border-light)]">
        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3">
            {[
              { step: 1, label: 'Facility Type' },
              { step: 2, label: 'Admin Account' },
              { step: 3, label: 'Branding & Logo' },
              { step: 4, label: 'Review & Launch' },
            ].map((s) => (
              <div
                key={s.step}
                className={`flex items-center gap-1.5 text-xs font-mono ${
                  currentStep === s.step
                    ? 'text-[var(--brass)] font-bold'
                    : currentStep > s.step
                    ? 'text-[var(--success)]'
                    : 'text-[var(--text-dim)]'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    currentStep === s.step
                      ? 'bg-[var(--brass)] text-white shadow-[0_0_10px_rgba(201,138,75,0.5)]'
                      : currentStep > s.step
                      ? 'bg-[var(--success)] text-white'
                      : 'bg-[var(--surface-3)] text-[var(--text-dim)]'
                  }`}
                >
                  {currentStep > s.step ? <Check className="w-3.5 h-3.5" /> : s.step}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="w-full bg-[var(--surface-3)] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[var(--brass)] to-[#E0A96D] h-full transition-all duration-300 rounded-full"
              style={{ width: `${(currentStep / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* ================= STEP 1: ORGANIZATION TYPE & IDENTIFICATION ================= */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="font-display font-bold text-xl text-[var(--text)]">
                Select Your Healthcare Facility Type
              </h2>
              <p className="text-xs text-[var(--text-dim)] mt-1">
                DermaTrack scales to your clinical structure, department workflows, and surgical requirements.
              </p>
            </div>

            {/* 3 Facility Type Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'BigHospital',
                  title: 'Big Hospital',
                  subtitle: 'Multi-Department & Scalp Surgery Inpatient',
                  icon: Building2,
                },
                {
                  id: 'Hospital',
                  title: 'Hospital',
                  subtitle: 'Full Clinical Dermatology & Trichology Care',
                  icon: Building,
                },
                {
                  id: 'Clinic',
                  title: 'Clinic',
                  subtitle: 'Specialized Trichology & Practice Center',
                  icon: Stethoscope,
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = facilityType === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setFacilityType(item.id as any)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--brass-glow)] border-[var(--brass)] shadow-[0_0_15px_rgba(201,138,75,0.25)]'
                        : 'bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--border-light)]'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-md flex items-center justify-center mb-3 ${
                        isSelected ? 'bg-[var(--brass)] text-white' : 'bg-[var(--surface-3)] text-[var(--text-dim)]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-display font-bold text-sm text-[var(--text)]">{item.title}</h3>
                    <p className="text-[11px] text-[var(--text-dim)] mt-1 leading-snug">{item.subtitle}</p>
                  </div>
                );
              })}
            </div>

            {/* Full Name & Short Name */}
            <div className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Hospital / Clinic Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maga Health Care Trichology & Scalp Hospital"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!shortName) setShortName(e.target.value);
                  }}
                  className={`w-full px-3.5 py-2.5 text-sm bg-[var(--surface-2)] border rounded-md text-[var(--text)] focus:outline-none ${
                    conflicts.name ? 'border-[var(--error)]' : 'border-[var(--border)] focus:border-[var(--brass)]'
                  }`}
                />
                {conflicts.name && (
                  <span className="text-xs text-[var(--error)] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {conflicts.name}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Hospital Short Name (For Topbar & Badges) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maga Health Care"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 text-sm bg-[var(--surface-2)] border rounded-md text-[var(--text)] focus:outline-none ${
                    conflicts.shortName ? 'border-[var(--error)]' : 'border-[var(--border)] focus:border-[var(--brass)]'
                  }`}
                />
                {conflicts.shortName ? (
                  <span className="text-xs text-[var(--error)] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {conflicts.shortName}
                  </span>
                ) : shortName ? (
                  <div className="mt-2 flex items-center gap-2 p-2 bg-[var(--surface-2)] rounded border border-[var(--border)] text-xs font-mono text-[var(--text-dim)]">
                    <span>Generated Avatar Initials:</span>
                    <strong className="px-2 py-0.5 bg-[var(--brass)] text-white rounded font-bold">
                      {initials}
                    </strong>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleNextToStep2}
                className="btn-brass px-6 py-2.5 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <span>Continue to Administrator Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: ADMINISTRATOR & CONTACT DETAILS ================= */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="font-display font-bold text-xl text-[var(--text)]">
                Administrator & Contact Information
              </h2>
              <p className="text-xs text-[var(--text-dim)] mt-1">
                The Hospital Email and Password will serve as the primary Super Admin login for your clinic.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Hospital Admin Email ID *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input
                    type="email"
                    required
                    placeholder="admin@magahealthcare.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-9 pr-3.5 py-2.5 text-sm bg-[var(--surface-2)] border rounded-md text-[var(--text)] font-mono focus:outline-none ${
                      conflicts.email ? 'border-[var(--error)]' : 'border-[var(--border)] focus:border-[var(--brass)]'
                    }`}
                  />
                </div>
                {conflicts.email && (
                  <span className="text-xs text-[var(--error)] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {conflicts.email}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Admin Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-10 py-2.5 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brass)]"
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

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Re-enter Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full pl-9 pr-10 py-2.5 text-sm bg-[var(--surface-2)] border rounded-md text-[var(--text)] font-mono focus:outline-none ${
                        confirmPassword && password !== confirmPassword
                          ? 'border-[var(--error)]'
                          : 'border-[var(--border)] focus:border-[var(--brass)]'
                      }`}
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
                  {confirmPassword && password !== confirmPassword && (
                    <span className="text-xs text-[var(--error)] mt-1 block">Passwords do not match</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                  Official Website Link (Optional)
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                  <input
                    type="url"
                    placeholder="https://magahealthcare.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className={`w-full pl-9 pr-3.5 py-2.5 text-sm bg-[var(--surface-2)] border rounded-md text-[var(--text)] font-mono focus:outline-none ${
                      conflicts.websiteUrl ? 'border-[var(--error)]' : 'border-[var(--border)] focus:border-[var(--brass)]'
                    }`}
                  />
                </div>
                {conflicts.websiteUrl && (
                  <span className="text-xs text-[var(--error)] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {conflicts.websiteUrl}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Phone / Helpline (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] font-mono focus:outline-none focus:border-[var(--brass)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider mb-1.5">
                    Location / City (Optional)
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" />
                    <input
                      type="text"
                      placeholder="Chennai, Tamil Nadu"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-[var(--text)] focus:outline-none focus:border-[var(--brass)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="btn-surface px-4 py-2 rounded-md text-xs font-mono flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={handleNextToStep3}
                className="btn-brass px-6 py-2.5 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <span>Continue to Branding & Logo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: VISUAL BRANDING & MEDIA ================= */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="font-display font-bold text-xl text-[var(--text)]">
                Clinic Logo & Visual Assets
              </h2>
              <p className="text-xs text-[var(--text-dim)] mt-1">
                Upload your official clinic logo. If left blank, DermaTrack will automatically render elegant avatar initials (<strong>{initials}</strong>).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Logo Upload Box */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                  Hospital Logo (Square Recommended)
                </label>
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[var(--surface-3)] ${
                    logoPreview ? 'border-[var(--brass)] bg-[var(--brass-glow)]' : 'border-[var(--border)] bg-[var(--surface-2)]'
                  }`}
                >
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  {logoPreview ? (
                    <div className="text-center space-y-2">
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-20 h-20 rounded-lg object-contain mx-auto border border-[var(--brass)] bg-white/5"
                      />
                      <span className="text-xs font-mono text-[var(--brass)] block">Click to replace logo</span>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-[var(--surface-3)] text-[var(--brass)] flex items-center justify-center mx-auto">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-[var(--text)] block">Upload Logo Image</span>
                      <span className="text-[10px] text-[var(--text-dim)] block">PNG, JPG, WebP up to 5MB</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Facility Image Upload Box */}
              <div className="space-y-2">
                <label className="block text-xs font-mono text-[var(--text-dim)] uppercase tracking-wider">
                  Facility Image / Building Photo (Optional)
                </label>
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-[var(--surface-3)] ${
                    imagePreview ? 'border-[var(--brass)] bg-[var(--brass-glow)]' : 'border-[var(--border)] bg-[var(--surface-2)]'
                  }`}
                >
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  {imagePreview ? (
                    <div className="text-center space-y-2">
                      <img
                        src={imagePreview}
                        alt="Facility Preview"
                        className="w-28 h-20 rounded-lg object-cover mx-auto border border-[var(--brass)]"
                      />
                      <span className="text-xs font-mono text-[var(--brass)] block">Click to replace photo</span>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-[var(--surface-3)] text-[var(--text-dim)] flex items-center justify-center mx-auto">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-[var(--text)] block">Upload Clinic Photo</span>
                      <span className="text-[10px] text-[var(--text-dim)] block">Optional clinic facade or banner</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="btn-surface px-4 py-2 rounded-md text-xs font-mono flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="btn-brass px-6 py-2.5 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <span>Preview & Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: LIVE PREVIEW & CONFIRMATION ================= */}
        {currentStep === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="font-display font-bold text-xl text-[var(--text)]">
                Review & Live Branding Preview
              </h2>
              <p className="text-xs text-[var(--text-dim)] mt-1">
                Here is how your hospital branding, logo avatar, and hover tooltips will appear across all clinical workstations.
              </p>
            </div>

            {/* Live Interactive Mock Preview Card */}
            <div className="p-5 surface-card border border-[var(--brass)]/40 rounded-xl bg-gradient-to-br from-[#192224] to-[#111718] shadow-inner space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--brass)] pb-3 border-b border-[#232D30]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" /> Live Workstation Header Simulation
                </span>
                <span className="px-2 py-0.5 rounded bg-[var(--surface-3)] text-white text-[10px]">
                  {facilityType}
                </span>
              </div>

              {/* Simulated Sidebar Header */}
              <div className="p-3 bg-[#13191A] rounded-lg border border-[#263336] flex items-center justify-between">
                <HospitalBrandBadge
                  hospital={{
                    _id: 'preview',
                    name: name || 'Hospital Full Name',
                    shortName: shortName || 'Short Name',
                    type: facilityType,
                    email,
                    logoUrl: logoPreview || undefined,
                    imageUrl: imagePreview || undefined,
                    websiteUrl,
                    status: 'Active',
                  }}
                  roleName="Admin Console"
                  size="md"
                />

                <span className="text-[11px] font-mono text-[var(--text-dim)] hidden sm:inline">
                  (Hover over logo & name to preview tooltip)
                </span>
              </div>

              {/* Summary Specs */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-2">
                <div className="p-2.5 bg-[var(--surface-2)] rounded border border-[var(--border)]">
                  <span className="text-[var(--text-dim)] block text-[10px] uppercase">Admin Login ID:</span>
                  <strong className="text-[var(--text)] truncate block mt-0.5">{email}</strong>
                </div>
                <div className="p-2.5 bg-[var(--surface-2)] rounded border border-[var(--border)]">
                  <span className="text-[var(--text-dim)] block text-[10px] uppercase">Branding Fallback:</span>
                  <strong className="text-[var(--brass)] block mt-0.5">
                    {logoPreview ? 'Custom Uploaded Logo' : imagePreview ? 'Facility Photo' : `Initials Badge: "${initials}"`}
                  </strong>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="btn-surface px-4 py-2 rounded-md text-xs font-mono flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleRegisterHospital}
                className="btn-brass px-8 py-3 rounded-md text-sm font-bold flex items-center gap-2 shadow-[0_0_20px_rgba(201,138,75,0.4)]"
              >
                {loading ? 'Setting up Workstation...' : 'Launch Hospital Workstation'}
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-[var(--text-dim)] mt-8 z-10 font-mono">
        DermaTrack Digital Health Systems • Next-Gen Scalp Dermatology ERP
      </div>
    </div>
  );
}
