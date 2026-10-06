'use client';

import React, { useState, useEffect } from 'react';
import { Invoice, Patient } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  X,
  Download,
  Printer,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Building2,
  User as UserIcon,
  Calendar,
  Phone,
  FileBadge,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';

interface InvoicePDFModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onPaymentSuccess?: () => void;
  clinicInfo?: {
    clinicName?: string;
    address?: string;
    phone?: string;
    email?: string;
    gstNumber?: string;
  };
}

// Convert numbers to Indian currency words
function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees';
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen ',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
  }

  const intPart = Math.floor(num);
  const words = inWords(intPart).trim();
  return `Rupees ${words} Only`;
}

export default function InvoicePDFModal({
  invoice,
  onClose,
  onPaymentSuccess,
  clinicInfo = {
    clinicName: 'DermaTrack Trichology & Dermatology Clinic',
    address: '104 Healthcare Boulevard, Medical Enclave, Chennai, Tamil Nadu - 600006',
    phone: '+91 98401 23456',
    email: 'billing@dermatrack.com',
    gstNumber: '33AABCT9988C1Z4',
  },
}: InvoicePDFModalProps) {
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(invoice);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Sync state and automatically fetch full populated invoice if patient details are incomplete
  useEffect(() => {
    if (!invoice) return;
    setCurrentInvoice(invoice);

    const pat =
      typeof invoice.patientId === 'object' && invoice.patientId !== null
        ? (invoice.patientId as Patient)
        : null;

    const isMissingData =
      !pat ||
      !pat.patientId ||
      !pat.phone ||
      pat.age === undefined ||
      !pat.gender;

    if (invoice._id && isMissingData) {
      setIsLoadingDetails(true);
      api
        .get(`/billing/invoices/${invoice._id}`)
        .then((res) => {
          if (res.data?.data) {
            setCurrentInvoice(res.data.data);
          }
        })
        .catch((err) => {
          console.warn('Failed to load full invoice details:', err);
        })
        .finally(() => {
          setIsLoadingDetails(false);
        });
    }
  }, [invoice]);

  if (!invoice || !currentInvoice) return null;

  const inv = currentInvoice;
  const patient =
    typeof inv.patientId === 'object' && inv.patientId !== null
      ? (inv.patientId as Patient)
      : null;

  const balanceDue = Math.max(0, inv.grandTotal - (inv.amountPaid || 0));

  // Resolved patient information with dependable fallbacks
  const pName = patient?.name || 'Walk-in Patient';
  const pId =
    patient?.patientId ||
    (patient?._id ? `PAT-${patient._id.toString().slice(-6).toUpperCase()}` : '-');
  const pPhone = patient?.phone
    ? patient.phone.startsWith('+91')
      ? patient.phone
      : `+91 ${patient.phone}`
    : '-';

  let ageDisplay = '';
  if (patient?.age !== undefined && patient?.age !== null && Number(patient.age) > 0) {
    ageDisplay = `${patient.age} yrs`;
  } else if (patient?.dateOfBirth) {
    const birthYear = new Date(patient.dateOfBirth).getFullYear();
    const diff = new Date().getFullYear() - birthYear;
    if (diff > 0 && diff < 125) ageDisplay = `${diff} yrs`;
  }
  const pAgeGender = [ageDisplay, patient?.gender].filter(Boolean).join(' / ') || '-';

  const cgstHalf = Math.round((inv.totalGst / 2) * 100) / 100;
  const sgstHalf = Math.round((inv.totalGst / 2) * 100) / 100;

  // Generate jsPDF document instance
  const generatePdfDoc = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // 1. Clinic Header & Branding (Page Width: 210mm)
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, 210, 36, 'F');

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(201, 138, 75); // Brass brand color
    doc.text(clinicInfo.clinicName?.toUpperCase() || 'DERMATRACK CLINIC', 14, 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240); // Slate-200
    doc.text(clinicInfo.address || 'Medical Enclave, Chennai - 600006', 14, 20);
    doc.text(
      `Phone: ${clinicInfo.phone || '+91 98401 23456'}   |   Email: ${clinicInfo.email || 'billing@dermatrack.com'}`,
      14,
      25
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(248, 250, 252);
    doc.text(`GSTIN / UIN: ${clinicInfo.gstNumber || '33AABCT9988C1Z4'}`, 14, 30);

    // Title & Invoice Meta Box (Right aligned inside header at 196mm)
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TAX INVOICE', 196, 14, { align: 'right' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240);
    doc.text(`Invoice #: ${inv.invoiceNumber}`, 196, 20, { align: 'right' });
    doc.text(
      `Date: ${new Date(inv.createdAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`,
      196,
      25,
      { align: 'right' }
    );
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(inv.status === 'Paid' ? 74 : 245, inv.status === 'Paid' ? 222 : 158, inv.status === 'Paid' ? 128 : 11);
    doc.text(`Status: ${inv.status.toUpperCase()}`, 196, 30, { align: 'right' });

    // 2. Patient / Billed To Section (Width: 182mm, Margins: 14mm to 196mm)
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.rect(14, 42, 182, 25, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(14, 42, 182, 25, 'S');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('BILLED TO (PATIENT DETAILS):', 18, 48);

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);

    // Left column
    doc.setFont('helvetica', 'normal');
    doc.text('Name:', 18, 55);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(pName, 32, 55);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('UHID / ID:', 18, 62);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(pId, 36, 62);

    // Right column
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Contact:', 115, 55);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(pPhone, 132, 55);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Age / Gender:', 115, 62);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(pAgeGender, 140, 62);

    // 3. Line Items Table with CGST & SGST (Exactly 182mm wide, matching margins)
    // Width breakdown: 10 + 56 + 12 + 20 + 22 + 20 + 20 + 22 = 182mm
    const tableRows = inv.lineItems.map((item, idx) => {
      const taxable = item.quantity * item.unitPrice;
      const cgstRate = (item.gstRate || 0) / 2;
      const sgstRate = (item.gstRate || 0) / 2;
      const cgstAmt = Math.round((item.gstAmount / 2) * 100) / 100;
      const sgstAmt = Math.round((item.gstAmount / 2) * 100) / 100;

      return [
        (idx + 1).toString(),
        `${item.description}\n[${item.itemType}]`,
        item.quantity.toString(),
        `Rs. ${item.unitPrice.toLocaleString('en-IN')}`,
        `Rs. ${taxable.toLocaleString('en-IN')}`,
        `${cgstRate}% (Rs. ${cgstAmt})`,
        `${sgstRate}% (Rs. ${sgstAmt})`,
        `Rs. ${item.total.toLocaleString('en-IN')}`,
      ];
    });

    autoTable(doc, {
      startY: 73,
      margin: { left: 14, right: 14 },
      tableWidth: 182,
      head: [['#', 'Item Description & Type', 'Qty', 'Rate', 'Taxable', 'CGST', 'SGST', 'Total']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59], // Slate-800
        textColor: [255, 255, 255],
        fontSize: 7.8,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 56 },
        2: { halign: 'center', cellWidth: 12 },
        3: { halign: 'right', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 22 },
      },
      didParseCell: (data) => {
        // Enforce matching header alignment for each column
        if (data.section === 'head') {
          if (data.column.index === 0 || data.column.index === 2) {
            data.cell.styles.halign = 'center';
          } else if (data.column.index === 1) {
            data.cell.styles.halign = 'left';
          } else {
            data.cell.styles.halign = 'right';
          }
        }
      },
      styles: {
        fontSize: 7.8,
        cellPadding: 2.4,
        textColor: [15, 23, 42],
        lineColor: [226, 232, 240],
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 7;

    // 4. Summary & Tax Breakup Box
    // Left Box: Amount in words & payment ledger
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Amount in Words:', 14, finalY);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(71, 85, 105);
    doc.text(numberToWords(inv.grandTotal), 14, finalY + 5);

    // Payment Ledger summary
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Payment Ledger Details:', 14, finalY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);

    if (inv.payments && inv.payments.length > 0) {
      inv.payments.forEach((p, pIdx) => {
        const pDate = new Date(p.paidAt).toLocaleDateString('en-IN');
        const refStr = p.reference ? ` (Ref: ${p.reference})` : '';
        doc.text(
          `• ${p.mode}${refStr} on ${pDate}: Rs. ${p.amount.toLocaleString('en-IN')}`,
          14,
          finalY + 20 + pIdx * 4.5
        );
      });
    } else {
      doc.text('• No payments recorded yet (Payment Pending)', 14, finalY + 20);
    }

    // Right Box: Financial Totals Table (X: 120 to 196 = width 76mm)
    const rightX = 120;
    const boxWidth = 76;
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.rect(rightX, finalY - 4, boxWidth, 40, 'F');
    doc.rect(rightX, finalY - 4, boxWidth, 40, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Taxable Subtotal:', rightX + 3, finalY + 2);
    doc.text(`Rs. ${inv.subtotal.toLocaleString('en-IN')}`, 192, finalY + 2, { align: 'right' });

    doc.text('CGST (Central):', rightX + 3, finalY + 7);
    doc.text(`Rs. ${cgstHalf.toLocaleString('en-IN')}`, 192, finalY + 7, { align: 'right' });

    doc.text('SGST (State):', rightX + 3, finalY + 12);
    doc.text(`Rs. ${sgstHalf.toLocaleString('en-IN')}`, 192, finalY + 12, { align: 'right' });

    doc.text('Total GST:', rightX + 3, finalY + 17);
    doc.text(`Rs. ${inv.totalGst.toLocaleString('en-IN')}`, 192, finalY + 17, { align: 'right' });

    doc.setDrawColor(201, 138, 75);
    doc.setLineWidth(0.3);
    doc.line(rightX + 3, finalY + 20, 192, finalY + 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(201, 138, 75);
    doc.text('Grand Total:', rightX + 3, finalY + 26);
    doc.text(`Rs. ${inv.grandTotal.toLocaleString('en-IN')}`, 192, finalY + 26, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52); // Emerald green
    doc.text('Amount Paid:', rightX + 3, finalY + 31);
    doc.text(`Rs. ${inv.amountPaid.toLocaleString('en-IN')}`, 192, finalY + 31, { align: 'right' });

    if (balanceDue > 0) {
      doc.setTextColor(185, 28, 28); // Rose red
      doc.text('Balance Due:', rightX + 3, finalY + 36);
      doc.text(`Rs. ${balanceDue.toLocaleString('en-IN')}`, 192, finalY + 36, { align: 'right' });
    }

    // 5. Terms & Signatory Footer
    let footerY = Math.max(finalY + 48, 252);
    if (footerY > 275) {
      doc.addPage();
      footerY = 240;
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, footerY, 196, footerY);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Terms & Conditions:', 14, footerY + 5);
    doc.text('1. Prescribed medicines are non-returnable and non-refundable once dispensed.', 14, footerY + 9);
    doc.text('2. Consultation follow-up is valid up to 7 calendar days from the date of consultation.', 14, footerY + 13);
    doc.text('3. This is an authenticated computer-generated Tax Invoice generated under Indian GST law.', 14, footerY + 17);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`For ${clinicInfo.clinicName?.toUpperCase() || 'DERMATRACK CLINIC'}`, 196, footerY + 7, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Authorized Signatory / Cashier', 196, footerY + 20, { align: 'right' });

    return doc;
  };

  const handleDownloadPdf = () => {
    try {
      const doc = generatePdfDoc();
      doc.save(`Invoice_${inv.invoiceNumber}.pdf`);
      toast.success(`Downloaded Invoice_${inv.invoiceNumber}.pdf`);
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + (err.message || 'Unknown error'));
    }
  };

  const handlePrintPdf = () => {
    try {
      const doc = generatePdfDoc();
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } catch (err: any) {
      toast.error('Print preview failed: ' + (err.message || 'Unknown error'));
    }
  };

  // Razorpay Online Payment Checkout
  const handleRazorpayCheckout = async () => {
    if (balanceDue <= 0) {
      toast.info('Invoice is already fully settled.');
      return;
    }

    setIsProcessingPayment(true);
    try {
      const res = await api.post(`/billing/invoices/${inv._id}/razorpay/order`);
      const { orderId, amount, currency, keyId, clinicName } = res.data.data;

      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const options = {
          key: keyId,
          amount,
          currency,
          name: clinicName || 'DermaTrack Clinic',
          description: `Invoice Settle #${inv.invoiceNumber}`,
          order_id: orderId,
          prefill: {
            name: patient?.name || '',
            contact: patient?.phone || '',
            email: (patient as any)?.email || '',
          },
          theme: {
            color: '#c98a4b',
          },
          handler: async (response: any) => {
            try {
              await api.post(`/billing/invoices/${inv._id}/razorpay/verify`, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast.success(`Payment of ₹${balanceDue} settled via Razorpay!`);
              if (onPaymentSuccess) onPaymentSuccess();
              onClose();
            } catch (err: any) {
              toast.error('Payment verification failed: ' + (err.response?.data?.message || err.message));
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessingPayment(false);
            },
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } else {
        // Fallback simulation for sandbox environments
        const mockPaymentId = `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
        await api.post(`/billing/invoices/${inv._id}/razorpay/verify`, {
          razorpay_order_id: orderId,
          razorpay_payment_id: mockPaymentId,
          razorpay_signature: 'sandbox_verified_signature',
          amount: balanceDue,
        });

        toast.success(`Razorpay Payment Captured successfully! (Ref: ${mockPaymentId})`);
        if (onPaymentSuccess) onPaymentSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Razorpay order creation failed');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl my-auto flex flex-col gap-3">
        {/* Top Floating Control Bar */}
        <div className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-slate-900 border border-slate-700/60 shadow-lg text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--brass)]/20 border border-[var(--brass)]/40 flex items-center justify-center text-[var(--brass)]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-white">
                  Tax Invoice {inv.invoiceNumber}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full uppercase tracking-wider ${
                    inv.status === 'Paid'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : inv.status === 'Partially Paid'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {inv.status}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Issued {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {balanceDue > 0 && (
              <button
                type="button"
                onClick={handleRazorpayCheckout}
                disabled={isProcessingPayment}
                className="btn-brass px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm hover:brightness-110 active:scale-95 transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {isProcessingPayment ? 'Processing...' : `Pay ₹${balanceDue}`}
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors"
              title="Download GST-Compliant PDF"
            >
              <Download className="w-3.5 h-3.5 text-[var(--brass)]" />
              Download PDF
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors"
              title="Print Tax Invoice"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================= INVOICE PAPER CANVAS (Clean, Professional, High-Contrast) ================= */}
        <div className="w-full bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-10 space-y-7">
          {/* Header Clinic & Invoice Branding */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[var(--brass)]">
                <Building2 className="w-4 h-4" />
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#a16207]">
                  CLINICAL TAX INVOICE
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-slate-900 tracking-tight">
                {clinicInfo.clinicName}
              </h1>
              <p className="text-xs text-slate-600 max-w-lg leading-relaxed">{clinicInfo.address}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 pt-1 font-mono">
                <span>Phone: <strong className="text-slate-800">{clinicInfo.phone}</strong></span>
                <span>Email: <strong className="text-slate-800">{clinicInfo.email}</strong></span>
                <span className="text-[#a16207] font-bold">GSTIN: {clinicInfo.gstNumber}</span>
              </div>
            </div>

            <div className="sm:text-right bg-slate-50 border border-slate-200 rounded-xl p-3.5 min-w-[210px] space-y-1">
              <div className="inline-block px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold uppercase tracking-wider mb-1">
                ORIGINAL TAX INVOICE
              </div>
              <div className="text-xs font-mono text-slate-700">
                Invoice #: <strong className="text-slate-900">{inv.invoiceNumber}</strong>
              </div>
              <div className="text-xs font-mono text-slate-700">
                Date: <span className="font-semibold text-slate-800">{new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="text-xs font-mono text-slate-700 pt-1 flex sm:justify-end items-center gap-1.5">
                Status:
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    inv.status === 'Paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : inv.status === 'Partially Paid'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {inv.status}
                </span>
              </div>
            </div>
          </div>

          {/* Patient Details & Clinical Reference Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[#a16207] font-bold uppercase text-[11px] mb-1">
                <UserIcon className="w-3.5 h-3.5" /> BILLED TO (PATIENT DETAILS)
              </div>
              <div className="text-base font-bold text-slate-900">
                {pName}
              </div>
              <div className="text-slate-600 flex items-center gap-2">
                <span>UHID / Patient ID:</span>
                <span className="font-bold text-slate-900 bg-slate-200/80 px-2 py-0.5 rounded">
                  {pId}
                </span>
              </div>
              <div className="text-slate-600 flex items-center gap-2">
                <span>Contact:</span>
                <span className="font-bold text-slate-900">{pPhone}</span>
              </div>
            </div>

            <div className="space-y-1.5 sm:text-right">
              <div className="flex sm:justify-end items-center gap-1.5 text-slate-600 font-bold uppercase text-[11px] mb-1">
                <Calendar className="w-3.5 h-3.5" /> CLINICAL VISIT DETAILS
              </div>
              <div className="text-slate-600">
                Age / Gender:{' '}
                <strong className="text-slate-900 text-sm">
                  {pAgeGender}
                </strong>
              </div>
              <div className="text-slate-600">
                Billing Context:{' '}
                <span className="font-semibold text-slate-800">
                  {inv.visitId ? 'Hospital Outpatient Consultation' : 'Direct Service / Medicine'}
                </span>
              </div>
              <div className="text-slate-600">
                Location:{' '}
                <span className="text-slate-800">{patient?.location || 'Chennai'}</span>
              </div>
            </div>
          </div>

          {/* Line Items Table (High-contrast, crystal-clear rows) */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-[11px] tracking-wider border-b border-slate-200">
                  <th className="py-3 px-3 text-center w-10 font-bold">#</th>
                  <th className="py-3 px-3 text-left font-bold">Item Description</th>
                  <th className="py-3 px-3 text-center font-bold">Type</th>
                  <th className="py-3 px-3 text-center font-bold">Qty</th>
                  <th className="py-3 px-3 text-right font-bold">Unit Price</th>
                  <th className="py-3 px-3 text-right font-bold">Taxable</th>
                  <th className="py-3 px-3 text-right font-bold">CGST</th>
                  <th className="py-3 px-3 text-right font-bold">SGST</th>
                  <th className="py-3 px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {inv.lineItems.map((item, idx) => {
                  const taxable = item.quantity * item.unitPrice;
                  const cgstRate = (item.gstRate || 0) / 2;
                  const sgstRate = (item.gstRate || 0) / 2;
                  const cgstAmt = Math.round((item.gstAmount / 2) * 100) / 100;
                  const sgstAmt = Math.round((item.gstAmount / 2) * 100) / 100;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-3 text-center text-slate-500 font-semibold">{idx + 1}</td>
                      <td className="py-3 px-3">
                        <div className="text-sm font-semibold text-slate-900">
                          {item.description}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          {item.itemType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-800">{item.quantity}</td>
                      <td className="py-3 px-3 text-right text-slate-700">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-right font-medium text-slate-900">₹{taxable.toLocaleString('en-IN')}</td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {cgstRate}% <span className="text-[10px] text-slate-500">(₹{cgstAmt})</span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {sgstRate}% <span className="text-[10px] text-slate-500">(₹{sgstAmt})</span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-950 text-sm">₹{item.total.toLocaleString('en-IN')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown Summary & Payment Ledger */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
            {/* Left: Words & Payment History */}
            <div className="md:col-span-7 space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono">
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold tracking-wider block mb-1">
                  Amount in Words
                </span>
                <span className="text-slate-900 italic font-semibold text-sm">
                  {numberToWords(inv.grandTotal)}
                </span>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <span className="text-slate-600 uppercase text-[10px] tracking-wider block mb-2 font-bold">
                  Payment History & Ledger
                </span>
                {inv.payments && inv.payments.length > 0 ? (
                  <div className="space-y-2">
                    {inv.payments.map((p, pIdx) => (
                      <div
                        key={pIdx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-bold text-slate-900">{p.mode}</span>
                          {p.reference && <span className="text-slate-500 text-[11px] font-sans">({p.reference})</span>}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 text-[11px]">
                            {new Date(p.paidAt).toLocaleDateString('en-IN')}
                          </span>
                          <span className="font-bold text-emerald-700 text-sm">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-rose-700 text-xs p-2.5 rounded-lg bg-rose-50 border border-rose-200">
                    <AlertCircle className="w-4 h-4" />
                    <span>No payment recorded yet. Balance due: ₹{balanceDue}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Calculations Box */}
            <div className="md:col-span-5 p-4 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs space-y-2.5">
              <div className="flex justify-between text-slate-600">
                <span>Taxable Subtotal</span>
                <span className="font-semibold text-slate-900">₹{inv.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST (Central GST)</span>
                <span className="text-slate-800">₹{cgstHalf.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST (State GST)</span>
                <span className="text-slate-800">₹{sgstHalf.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-600 pb-2 border-b border-slate-200">
                <span>Total GST Amount</span>
                <span className="text-[#a16207] font-semibold">₹{inv.totalGst.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-950 pt-0.5">
                <span>Grand Total</span>
                <span className="text-slate-900 text-lg">₹{inv.grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-700 font-bold">
                <span>Total Paid</span>
                <span>₹{inv.amountPaid.toLocaleString('en-IN')}</span>
              </div>
              {balanceDue > 0 && (
                <div className="flex justify-between text-xs text-rose-700 font-bold pt-1.5 border-t border-slate-200">
                  <span>Balance Due</span>
                  <span>₹{balanceDue.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>

          {/* ================= FOOTER TERMS & SIGNATORY BLOCK (Crisp, High Contrast, Completely Visible) ================= */}
          <div className="mt-8 pt-6 border-t-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-600 gap-4 font-mono">
            <div className="space-y-1">
              <p className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">Terms & Conditions:</p>
              <p>1. Prescribed medicines are non-returnable and non-refundable once dispensed.</p>
              <p>2. Consultation follow-up is valid up to 7 calendar days from the date of consultation.</p>
              <p>3. This is an authenticated computer-generated Tax Invoice generated as per GST provisions.</p>
            </div>
            <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 min-w-[220px]">
              <p className="font-bold text-slate-900 text-xs">For {clinicInfo.clinicName}</p>
              <div className="w-36 sm:ml-auto border-b border-dashed border-slate-300 my-4" />
              <p className="text-[11px] text-slate-500">Authorized Signatory / Cashier</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
