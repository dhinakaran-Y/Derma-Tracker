'use client';

import React, { useState, useRef, useEffect } from 'react';
import QRCode from 'react-qr-code';
import {
  X,
  Download,
  FileText,
  Printer,
  Share2,
  Copy,
  Check,
  QrCode,
  Smartphone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'sonner';

interface CounterQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  vpa: string;
  displayName: string;
  clinicName?: string;
  counterTitle?: string;
  defaultAmount?: number;
}

export function CounterQRModal({
  isOpen,
  onClose,
  vpa,
  displayName,
  clinicName = 'DermaTrack Clinic',
  counterTitle = 'RECEPTION & CASHLESS COUNTER',
  defaultAmount,
}: CounterQRModalProps) {
  const [copied, setCopied] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>(
    defaultAmount ? String(defaultAmount) : ''
  );
  const [includeAmount, setIncludeAmount] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState(false);
  const standeeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveVpa = vpa || 'clinic@upi';
  const effectiveName = displayName || clinicName || 'DermaTrack Clinic';
  const parsedAmount = includeAmount && parseFloat(customAmount) > 0 ? parseFloat(customAmount) : undefined;

  // Build UPI standard deep link
  const upiUrl = parsedAmount
    ? `upi://pay?pa=${encodeURIComponent(effectiveVpa)}&pn=${encodeURIComponent(effectiveName)}&am=${parsedAmount}&cu=INR&tn=${encodeURIComponent('Clinic Payment')}`
    : `upi://pay?pa=${encodeURIComponent(effectiveVpa)}&pn=${encodeURIComponent(effectiveName)}&cu=INR&tn=${encodeURIComponent('Clinic Payment')}`;

  // Copy UPI Link / ID to Clipboard
  const handleCopyUPI = async () => {
    try {
      await navigator.clipboard.writeText(effectiveVpa);
      setCopied(true);
      toast.success(`Copied UPI ID: ${effectiveVpa}`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy UPI ID');
    }
  };

  // Convert SVG QR to Canvas Data URL
  const getQRImageDataUrl = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const svg = document.getElementById('counter-qr-code-svg');
      if (!svg) {
        reject(new Error('QR SVG element not found'));
        return;
      }
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // High-res 800x800 canvas for crisp print / download
        canvas.width = 800;
        canvas.height = 800;
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 800, 800);
          ctx.drawImage(img, 40, 40, 720, 720);
        }
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  };

  // 1. Download as High-Resolution JPG
  const handleDownloadJPG = async () => {
    setIsExporting(true);
    try {
      const qrDataUrl = await getQRImageDataUrl();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      // 900x1200 Standee Poster Format
      canvas.width = 900;
      canvas.height = 1200;

      // Background
      ctx.fillStyle = '#0f172a'; // Deep slate
      ctx.fillRect(0, 0, 900, 1200);

      // Gradient accent banner on top
      const grad = ctx.createLinearGradient(0, 0, 900, 180);
      grad.addColorStop(0, '#c98a4b');
      grad.addColorStop(1, '#eab308');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 900, 18);

      // Clinic Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(clinicName.toUpperCase(), 450, 90);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '22px monospace';
      ctx.fillText(counterTitle.toUpperCase(), 450, 130);

      // Card container for QR
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(110, 170, 680, 820, 28);
      ctx.fill();

      // "SCAN & PAY WITH ANY UPI APP" banner
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 26px helvetica, sans-serif';
      ctx.fillText('SCAN & PAY WITH ANY UPI APP', 450, 235);

      // Draw QR image
      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise((resolve) => {
        qrImg.onload = resolve;
      });
      ctx.drawImage(qrImg, 200, 270, 500, 500);

      // Amount (if included)
      if (parsedAmount) {
        ctx.fillStyle = '#16a34a';
        ctx.font = 'bold 36px monospace';
        ctx.fillText(`AMOUNT: ₹${parsedAmount}`, 450, 810);
      }

      // Display Name & VPA
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px helvetica, sans-serif';
      ctx.fillText(effectiveName, 450, parsedAmount ? 860 : 830);

      ctx.fillStyle = '#c98a4b';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(effectiveVpa, 450, parsedAmount ? 900 : 870);

      // Supported Apps row
      ctx.fillStyle = '#64748b';
      ctx.font = '19px monospace';
      ctx.fillText('PhonePe  •  Google Pay  •  Paytm  •  BHIM  •  Any UPI App', 450, parsedAmount ? 950 : 930);

      // Footer
      ctx.fillStyle = '#94a3b8';
      ctx.font = '18px monospace';
      ctx.fillText('Instant Payment Confirmation • Secure & Direct', 450, 1070);

      ctx.fillStyle = '#64748b';
      ctx.font = '14px monospace';
      ctx.fillText('Generated by DermaTrack Health Clinic Systems', 450, 1120);

      // Trigger download
      const link = document.createElement('a');
      link.download = `${effectiveName.toLowerCase().replace(/\s+/g, '-')}-counter-qr.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      toast.success('Counter QR downloaded as JPG!');
    } catch (err: any) {
      toast.error('Failed to export JPG: ' + (err?.message || 'Error'));
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Download as Printable Standee PDF
  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const qrDataUrl = await getQRImageDataUrl();
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Header Banner (Navy/Slate)
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 42, 'F');

      // Top Gold Accent Bar
      doc.setFillColor(201, 138, 75);
      doc.rect(0, 0, 210, 4, 'F');

      // Header Text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(clinicName.toUpperCase(), 105, 20, { align: 'center' });

      doc.setFont('courier', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(201, 138, 75);
      doc.text(counterTitle.toUpperCase(), 105, 30, { align: 'center' });

      // Standee White Box Frame
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.6);
      doc.roundedRect(25, 50, 160, 200, 6, 6, 'FD');

      // "Scan to Pay" title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text('SCAN & PAY WITH ANY UPI APP', 105, 68, { align: 'center' });

      // Embed High-Res QR code
      doc.addImage(qrDataUrl, 'JPEG', 50, 78, 110, 110);

      // Amount (if included)
      let yOffset = 198;
      if (parsedAmount) {
        doc.setFont('courier', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(22, 163, 74);
        doc.text(`AMOUNT: Rs. ${parsedAmount}`, 105, yOffset, { align: 'center' });
        yOffset += 10;
      }

      // Payee Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(effectiveName, 105, yOffset, { align: 'center' });

      // UPI VPA
      doc.setFont('courier', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(201, 138, 75);
      doc.text(effectiveVpa, 105, yOffset + 7, { align: 'center' });

      // Supported Apps Row
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Google Pay  •  PhonePe  •  Paytm  •  BHIM  •  Any Bank UPI', 105, yOffset + 17, {
        align: 'center',
      });

      // Bottom Instructions
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Please verify the payee name on your UPI screen before paying.', 105, 260, {
        align: 'center',
      });
      doc.text('Payments are recorded instantly in the clinic billing register.', 105, 266, {
        align: 'center',
      });

      doc.save(`${effectiveName.toLowerCase().replace(/\s+/g, '-')}-standee.pdf`);
      toast.success('Counter QR Standee downloaded as PDF!');
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + (err?.message || 'Error'));
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Share with Printer (Desk Print)
  const handlePrint = () => {
    window.print();
  };

  // 4. Share (Web Share API / Copy Link)
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${clinicName} - UPI Payment QR`,
          text: `Pay ${effectiveName} using UPI VPA: ${effectiveVpa}`,
          url: upiUrl,
        });
        toast.success('Shared successfully!');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyUPI();
        }
      }
    } else {
      // Fallback
      try {
        await navigator.clipboard.writeText(upiUrl);
        toast.success('Payment UPI deep link copied to clipboard!');
      } catch {
        handleCopyUPI();
      }
    }
  };

  return (
    <>
      {/* Print Stylesheet injection to print ONLY the standee */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #counter-print-standee,
          #counter-print-standee * {
            visibility: visible !important;
          }
          #counter-print-standee {
            position: fixed !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 150mm !important;
            box-shadow: none !important;
            border: 2px solid #000 !important;
            padding: 10mm !important;
            background: #fff !important;
            color: #000 !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-lg surface-card rounded-2xl border border-[var(--border-light)] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                <QrCode className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-[var(--text)]">
                  {counterTitle || 'Clinic Counter Static QR Code'}
                </h3>
                <p className="text-[11px] font-mono text-[var(--text-dim)]">
                  Printable Standee & Cashless QR for Counter
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-[var(--surface-3)] flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Standee Preview Card Container */}
          <div className="p-6 space-y-5">
            {/* Amount Configuration Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-mono">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAmount}
                  onChange={(e) => setIncludeAmount(e.target.checked)}
                  className="rounded border-[var(--border)] text-[var(--brass)] focus:ring-[var(--brass)] cursor-pointer"
                />
                <span className="text-[var(--text)] font-semibold">Embed Preset Amount</span>
              </label>

              {includeAmount && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[var(--text-dim)]">₹</span>
                  <input
                    type="number"
                    min={1}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="500"
                    className="w-24 px-2 py-1 text-xs bg-[var(--surface-card)] border border-[var(--border)] rounded text-[var(--text)] font-bold focus:outline-none focus:border-[var(--brass)]"
                  />
                </div>
              )}
            </div>

            {/* Standee Visual Card (Also targets print) */}
            <div
              id="counter-print-standee"
              ref={standeeRef}
              className="relative mx-auto w-full max-w-sm rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 p-6 text-center text-white shadow-2xl border-2 border-[var(--brass)]/40 overflow-hidden"
            >
              {/* Gold Top Accent Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-[var(--brass)] to-amber-400" />

              {/* Clinic Banner */}
              <div className="space-y-0.5 mb-4">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--brass)]/20 text-[var(--brass)] border border-[var(--brass)]/30">
                  <Sparkles className="w-3 h-3" />
                  <span>OFFICIAL COUNTER PAYMENT</span>
                </div>
                <h4 className="font-display font-bold text-base tracking-tight text-white pt-1">
                  {clinicName}
                </h4>
                <p className="text-[11px] font-mono text-slate-400">Scan &amp; Pay with Any UPI App</p>
              </div>

              {/* Scannable QR Code */}
              <div className="flex justify-center my-3">
                <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-slate-800">
                  <QRCode
                    id="counter-qr-code-svg"
                    value={upiUrl}
                    size={180}
                    level="H"
                  />
                </div>
              </div>

              {/* Preset Amount Display if active */}
              {parsedAmount && (
                <div className="my-2 py-1 px-3 bg-emerald-500/15 border border-emerald-500/30 rounded-lg inline-block">
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    Amount: ₹{parsedAmount}
                  </span>
                </div>
              )}

              {/* Payee Info */}
              <div className="space-y-1 mt-2">
                <p className="font-display text-sm font-bold text-white tracking-wide">
                  {effectiveName}
                </p>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--brass)] bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/60">
                  <span>{effectiveVpa}</span>
                  <button
                    type="button"
                    onClick={handleCopyUPI}
                    title="Copy UPI ID"
                    className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Supported UPI Apps Badges */}
              <div className="pt-4 border-t border-slate-800/80 mt-4 space-y-1.5">
                <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-slate-400">
                  <Smartphone className="w-3 h-3 text-slate-500" />
                  <span>PhonePe • GPay • Paytm • BHIM • Cred • Any UPI</span>
                </div>
                <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-slate-500">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span>Instant verified clinic receipt</span>
                </div>
              </div>
            </div>

            {/* Actions Toolbar: Download JPG, PDF, Print, Share */}
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-mono text-[var(--text-dim)] uppercase tracking-wider text-center">
                Export &amp; Share Options
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Download JPG */}
                <button
                  type="button"
                  onClick={handleDownloadJPG}
                  disabled={isExporting}
                  className="py-2.5 px-2 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center gap-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--brass)] transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  title="Download counter QR standee as JPG image"
                >
                  <Download className="w-4 h-4 text-blue-500" />
                  <span>Save as JPG</span>
                </button>

                {/* Download PDF */}
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                  className="py-2.5 px-2 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center gap-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--brass)] transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  title="Download printable A4 standee as PDF"
                >
                  <FileText className="w-4 h-4 text-rose-500" />
                  <span>Save as PDF</span>
                </button>

                {/* Share with Printer */}
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isExporting}
                  className="py-2.5 px-2 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center gap-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--brass)] transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  title="Print directly to reception desk printer"
                >
                  <Printer className="w-4 h-4 text-emerald-500" />
                  <span>Print Standee</span>
                </button>

                {/* Share */}
                <button
                  type="button"
                  onClick={handleShare}
                  disabled={isExporting}
                  className="py-2.5 px-2 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center gap-1.5 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--brass)] transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  title="Share UPI payment link or QR"
                >
                  <Share2 className="w-4 h-4 text-violet-500" />
                  <span>Share QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
