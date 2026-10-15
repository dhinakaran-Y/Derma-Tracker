# 🌿 Derma Tracker

> **Next-Generation Clinical ERP & Trichology Intelligence Platform for Modern Dermatology Practices**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.3-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%208.9-brightgreen.svg)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-orange.svg)](https://socket.io/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Status](https://img.shields.io/badge/Deployment-Live-success.svg)](https://derma-tracker-brown.vercel.app/)

---

## 🌐 Live Links & Repository

- **Live Production Application:** [https://derma-tracker-brown.vercel.app/](https://derma-tracker-brown.vercel.app/)
- **GitHub Repository:** [https://github.com/dhinakaran-Y/Derma-Tracker](https://github.com/dhinakaran-Y/Derma-Tracker)
- **License:** [MIT License](LICENSE)

---

## 📑 Table of Contents

1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [Module-Wise Breakdown & Workflows](#-module-wise-breakdown--workflows)
   - [1. Reception & Front Desk Terminal](#1-reception--front-desk-terminal)
   - [2. Doctor Consultation Terminal](#2-doctor-consultation-terminal)
   - [3. Phototrichogram & Mobile Camera Pairing](#3-phototrichogram--mobile-camera-pairing)
   - [4. Dispensary & Medication Dispensing](#4-dispensary--medication-dispensing)
   - [5. Stock & Inventory Management](#5-stock--inventory-management)
   - [6. Billing, Invoicing & Razorpay Payments](#6-billing-invoicing--razorpay-payments)
   - [7. Patient Health & Recovery Portal](#7-patient-health--recovery-portal)
   - [8. Administrator & Operations Console](#8-administrator--operations-console)
4. [User Roles & Access Permissions Matrix](#-user-roles--access-permissions-matrix)
5. [Tech Stack](#-tech-stack)
6. [Project Structure](#-project-structure)
7. [Application Visual Tour & Screenshots](#-application-visual-tour--screenshots)
8. [Getting Started](#-getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Environment Variables](#environment-variables)
   - [Database Seeding & Default Credentials](#database-seeding--default-credentials)
   - [Running the Application](#running-the-application)
9. [API Documentation](#-api-documentation)
10. [Database Architecture & Schema Relationships](#-database-architecture--schema-relationships)
11. [Security, Data Protection & Healthcare Compliance](#-security-data-protection--healthcare-compliance)
12. [Deployment Guide](#-deployment-guide)
13. [Roadmap & Future Enhancements](#-roadmap--future-enhancements)
14. [Contributing Guidelines](#-contributing-guidelines)
15. [License](#-license)
16. [Authors & Acknowledgments](#-authors--acknowledgments)

---

## 📖 Overview

**Derma Tracker** (branded as *DermaTrack*) is a specialized, multi-station Enterprise Resource Planning (ERP) platform purpose-built for dermatology clinics, scalp care hospitals, and trichology treatment centers.

### The Problem It Solves
Traditional hospital management systems (HMS) treat dermatology like general outpatient medicine, ignoring the visual, procedural, and longitudinal nuances of dermatological care. Practitioners face multiple operational bottlenecks:
- **Disjointed Clinical Photography:** Dermatologists struggle to safely capture, store, and compare micro-phototrichograms and scalp lesion photographs over months of hair regrowth regimens.
- **Queue Chaos & Communication Gaps:** Front-desk receptionists, doctors, and dispensary pharmacists lack real-time synchronization, resulting in missed prescriptions, delayed check-ins, and duplicate manual entry.
- **Cumbersome Billing & Multi-Tier GST:** Skin clinics dispense consultations, compounding serums, clinical procedures (PRP, laser), and laboratory diagnostic tests—each attracting varying statutory GST rates and requiring dual tax invoicing (CGST/SGST).
- **Patient Engagement Deficit:** Hair regrowth journeys take 6–12 months; without visual proof of follicular density gains or recovery milestone timelines, patient compliance drops significantly.

### Who It Is For
- **Dermatologists & Trichologists:** Experience a streamlined consultation workbench equipped with Norwood-Hamilton & Ludwig staging, DLQI sliders, instant lab ordering, before/after visual comparison sliders, and remote smartphone camera pairing.
- **Reception & Front Desk Staff:** Orchestrate walk-ins and appointments through live-synced queues with drag-and-drop reordering, auto-fee calculations, and immediate UPI QR invoice generation.
- **Dispensary Pharmacists (Medication Givers):** Receive verified digital prescriptions in real time, view batch numbers and near-expiry warnings, dispense medications, and collect payments.
- **Inventory & Stock Managers:** Oversee batch-level stock valuation (purchase vs. retail cost), automated reorder alerts, expiry risk trackers, and image-rich drug catalogues.
- **Clinic Administrators:** Inspect immutable audit logs of sensitive clinical file access, track payment channels, generate GST breakdown reports, and manage multi-practitioner rosters.
- **Patients:** Access a passwordless, mobile-optimized health hub to track personalized 4-stage recovery timelines, inspect high-magnification trichoscopy photos, view lab orders, and pay invoices via Razorpay.

---

## ✨ Key Features

### 🏥 Clinical & Diagnostic Excellence
- **Norwood-Hamilton & Ludwig Trichology Staging:** Standardized staging selectors for male and female pattern androgenetic alopecia.
- **Phototrichogram Visual Comparison:** High-definition side-by-side comparison and interactive before/after split slider for baseline vs. follow-up consultations.
- **Scalp Examination Checklist:** Rapid recording of dandruff severity, erythema, hair pull test ($\ge 6$ hairs), and scalp sebum balance.
- **Dermatology Life Quality Index (DLQI):** Built-in scoring system ($0–30$) with automated psychological impact classifications (*No effect* to *Extremely large effect*).
- **Vitals & BMI History Tracking:** Real-time BMI computation and longitudinal dual-axis trajectory graphs for weight and BMI progression.
- **Dual Doctor Workflow Engine:** Instant switching between **Full App Digital Workflow** (end-to-end digital EMR) and **Prescription Booklet Hybrid Workflow** (handwritten booklet assisted by digital photography and vitals).

### 📱 Hardware-Free Remote Capture
- **Universal Mobile Camera Pairing:** Pair any doctor or clinic smartphone with the desktop consultation terminal using a secure, zero-password QR code.
- **Integrated Cloudflare Quick Tunnel:** Automated reverse tunneling through `cloudflared` to enable cellular data (4G/5G) mobile capture without requiring hospital Wi-Fi configuration.
- **Direct WebRTC / HTML5 Media Streaming:** Capture high-resolution scalp photos with instant push into the patient's active visit record via Socket.io.

### ⚡ Real-Time Operational Choreography
- **WebSocket-Powered Queue Synchronization:** Instant bi-directional state broadcast across Reception, Doctor Consultation, and Pharmacy stations via Socket.io.
- **Drag-and-Drop Queue Reordering:** Front-desk staff can adjust patient priority on the fly with real-time sync to doctor screens.
- **Doctor Duty & Availability States:** Live toggling between On Duty and Off Duty status with automatic patient queue routing.

### 💊 Pharmacy, Formulary & Inventory Control
- **Batch-Level Expiry & Inventory Tracking:** Detailed tracking of batch numbers, purchase costs, retail margins, expiry countdowns, and automated reorder alerts.
- **Real-Time Dispensation Verification:** Prescription queue showing pending, partially fulfilled, and dispensed medications.
- **Medication Image Catalog:** Pre-seeded catalog of 19+ clinical dermatological medications (topical retinoids, minoxidil formulations, calcipotriol, antifungal tablets, hair serums) with image upload support.

### 💳 Statutory Billing & Omnichannel Payments
- **Automated GST Splitting:** Automated CGST and SGST tax computation across Consultations (18%), Procedures (18%), Medications (5%), and Diagnostics (12%).
- **Dual Payment QR Engine:** Support for both instant Static UPI QR (zero fees) and dynamic Razorpay webhook-verified QR codes.
- **Professional PDF Invoice Generation:** Clean, exportable tax invoices built with `jspdf` and `jspdf-autotable`, including currency in words and statutory clinic headers.

### 🛡️ Enterprise Security & Patient Privacy
- **Passwordless Patient Authentication:** 6-digit cryptographic CSPRNG OTP login via Android SMS Gateway or Baileys WhatsApp Web automation, complete with 15-minute brute-force lockout after 5 failed attempts.
- **Sharp EXIF Scrubbing & Magic-Byte Validation:** Server-side sanitization of uploaded images stripping camera serial numbers, GPS tags, and verifying file signatures.
- **HIPAA/DISHA-Aligned Audit Logging:** Immutable audit trail recording mutations and sensitive medical file viewings with actor identity, timestamp, IP address, and role.

---

## 🔍 Module-Wise Breakdown & Workflows

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          DERMATRACK OPERATIONAL WORKFLOW                        │
└─────────────────────────────────────────────────────────────────────────────────┘

 [ PATIENT ARRIVAL ]
         │
         ▼
 ┌──────────────────────┐         WebSocket
 │  Reception Terminal  │ ────────────────────────┐
 │  - Register / Search │                         │
 │  - Check-in to Queue │                         ▼
 └──────────────────────┘              ┌──────────────────────┐
         │                             │  Doctor Consultation │
         │ (Waiting in Lobby)          │  - Norwood Staging   │
         │                             │  - Mobile Camera QR  │
         ▼                             │  - DLQI & Vitals     │
 ┌──────────────────────┐              │  - E-Prescription    │
 │  Front Desk Billing  │              └──────────────────────┘
 │  - Consult Invoicing │                         │
 │  - Static/Dynamic QR │                         │ (Prescription Sent)
 └──────────────────────┘                         ▼
                                       ┌──────────────────────┐
                                       │ Dispensary Station   │
                                       │ - Verify Batches     │
                                       │ - Dispense Meds      │
                                       │ - Collect & Settle   │
                                       └──────────────────────┘
                                                  │
                                                  ▼
                                       ┌──────────────────────┐
                                       │ Patient Portal       │
                                       │ - 4-Stage Roadmap    │
                                       │ - Before/After Slide │
                                       │ - Invoices & Rx      │
                                       └──────────────────────┘
```

### 1. Reception & Front Desk Terminal
- **Path:** `/receptionist`
- **Purpose:** Front-desk patient onboarding, queue routing, and consultation fee settlement.
- **Key Workflows:**
  - **Patient Registration:** Fast search by phone number, patient ID, or name. For new patients, captures demographics, blood group, known allergies, height, baseline weight, and past medical history (PCOS, diabetes, thyroid disorders).
  - **Check-in & Doctor Assignment:** Assigns an on-duty dermatologist, calculates whether the patient qualifies for First Visit vs. Follow-up consultation fees, and enqueues the ticket.
  - **Queue Management:** Displays live waiting times, patient tags (`Initial` / `Follow-up`), and drag-and-drop table ordering.
  - **Payment Collection:** Collects consultation fees upfront or marks as *Pending* to be billed together with pharmacy orders.

### 2. Doctor Consultation Terminal
- **Path:** `/doctor`
- **Purpose:** Comprehensive clinical workbench for diagnostic evaluation, photography, prescriptions, and lab ordering.
- **Key Workflows:**
  - **Patient Queue Intake:** Real-time list of waiting patients. Clicking a patient marks the visit as *In Progress* and informs reception.
  - **Clinical Diagnostics & Staging:** One-click Norwood-Hamilton (Stages I to VII) or Ludwig scale classification, alopecia diagnostic selection, and Scalp Health Checklist entry (scaling, erythema, pull test).
  - **Dermatology Life Quality Index (DLQI):** Interactive slider computing psychological quality of life impact scores in real time.
  - **E-Prescription & Formulary Search:** Intelligent autocomplete searching the clinic's internal pharmacy by brand name, active formulation, or dosage format. Supports dosage notes, duration (days), and teratogenic warnings.
  - **Laboratory Diagnostic Orders:** Quick-order chips for standard scalp workups (Trichogram, Scalp Dermoscopy, Fungal KOH Mount, Serum Ferritin & Iron Panel, Thyroid Profile, Vitamin D3/B12).
  - **Follow-up Scheduler:** Sets suggested clinical revisit intervals (1 week, 2 weeks, 1 month, 2 months, 3 months, 6 months).

### 3. Phototrichogram & Mobile Camera Pairing
- **Path:** `/doctor/device-pair`, `/doctor/gallery`, `/mobile/[token]`
- **Purpose:** High-resolution clinical scalp photography without expensive proprietary hardware.
- **Key Workflows:**
  - **Pairing Terminal:** Doctor clicks *Device Pairing* to reveal an instant pairing QR code backed by a Cloudflare Quick Tunnel URL.
  - **Mobile Web Application:** Scanning the QR on any Android or iOS smartphone opens a streamlined capture interface without login.
  - **Live Photo Push:** Taking a photograph on the phone streams the image through Sharp sanitization directly into the active consultation screen via WebSockets.
  - **Visual Comparison:** Doctors open the phototrichogram comparison gallery to inspect high-magnification follicular images side-by-side or using a split slider.

### 4. Dispensary & Medication Dispensing
- **Path:** `/medication-giver`
- **Purpose:** Pharmacy order fulfillment, batch allocation, and point-of-sale checkout.
- **Key Workflows:**
  - **Pending Orders Queue:** Automatically receives prescriptions when doctors finalize consultations or when receptionists submit physical booklet fulfillment requests.
  - **Batch Allocation & Safety:** Displays available batches sorted by earliest expiry date (FEFO - First Expired, First Out) with real-time stock deductions.
  - **Point of Sale Settlement:** Triggers static counter QR or dynamic Razorpay QR for dispensing charges.

### 5. Stock & Inventory Management
- **Path:** `/stock-manager`
- **Purpose:** Central pharmaceutical inventory control and supply chain monitoring.
- **Key Workflows:**
  - **Formulary Master:** Add and update medications, forms (serums, ointments, lotions, tablets), reorder thresholds, and drug photos.
  - **Batch & Expiry Records:** Manage multiple batches per drug with purchase prices, selling prices, and manufacturing dates.
  - **Reorder & Expiry Intelligence:** Highlights stock reaching minimum thresholds and batches expiring within 90 days.

### 6. Billing, Invoicing & Razorpay Payments
- **Path:** `/receptionist` (Billing Tab), `/patient` (Bills Tab)
- **Purpose:** Multi-category statutory invoicing, payment tracking, and automated reconciliation.
- **Key Workflows:**
  - **Line-Item Generation:** Combines Consultations, Dispensed Medicines, Clinical Procedures, and Laboratory Tests onto a single invoice.
  - **GST Breakdown:** Automatically calculates item-wise tax rates (5%, 12%, 18%) and splits totals into CGST and SGST accounts.
  - **Payment Verification:** Webhook-backed Razorpay payment verification (`/api/billing/razorpay/webhook`) updating invoice statuses to *Paid* upon HMAC confirmation.

### 7. Patient Health & Recovery Portal
- **Path:** `/patient`
- **Purpose:** Passwordless patient portal for tracking treatment progress and self-service care.
- **Key Workflows:**
  - **Passwordless OTP Login:** Patients log in using their registered mobile number, receiving an OTP via SMS or WhatsApp.
  - **4-Stage Treatment Roadmap:** Displays recovery journey across 4 clinical milestones:
    1. *Stage 1 (Month 0):* Baseline Assessment & Trichoscopy
    2. *Stage 2 (Months 1–2):* Follicular Stabilization & Shedding Control
    3. *Stage 3 (Months 3–6):* Active Terminal Regrowth & Density Gain
    4. *Stage 4 (Month 6+):* Hairline Consolidation & Long-Term Maintenance
  - **Trichoscopy Visual Archive:** Patients inspect their own high-resolution scalp photos and follicular density trajectories.
  - **Digital Records & Self-Pay:** View past e-prescriptions, ordered lab tests, and settle pending clinic invoices via Razorpay checkout.

### 8. Administrator & Operations Console
- **Path:** `/admin`
- **Purpose:** Clinic governance, financial intelligence, staff provisioning, and compliance oversight.
- **Key Workflows:**
  - **Executive Analytics:** Real-time KPI cards covering total collections, month-to-date revenue, active doctors, and inventory valuation.
  - **Staff Management:** Add, edit, suspend, or delete clinic employee accounts (Doctors, Receptionists, Pharmacists, Stock Managers).
  - **GST Tax Matrix:** Configure custom GST rates per service category.
  - **Audit Logs:** Filterable, exportable CSV logs tracking sensitive file views and data mutations.
  - **WhatsApp Service Terminal:** Scan WhatsApp Web QR to initialize Baileys automated OTP delivery.

---

## 👥 User Roles & Access Permissions Matrix

| Module / Route | Admin | Doctor | Receptionist | MedicationGiver | StockManager | Patient |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Admin Operations (`/admin`)** | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Doctor Workbench (`/doctor`)** | ❌ | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| **Camera Pairing (`/doctor/device-pair`)**| ❌ | ✅ Full | ❌ | ❌ | ❌ | ❌ |
| **Front Desk Queue (`/receptionist`)** | ✅ View | ❌ | ✅ Full | ❌ | ❌ | ❌ |
| **Patient Registration** | ✅ | ❌ | ✅ Full | ❌ | ❌ | ❌ |
| **Medication Dispensing (`/medication-giver`)**| ✅ Full | ❌ | ❌ | ✅ Full | ❌ | ❌ |
| **Inventory & Batches (`/stock-manager`)**| ✅ Full | ❌ | ❌ | ❌ | ✅ Full | ❌ |
| **Billing & Invoicing** | ✅ Full | ❌ | ✅ Full | ✅ View/Settle | ❌ | ✅ View/Pay |
| **Audit Logs Inspection** | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Clinic GST Configuration** | ✅ Full | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Patient Health Hub (`/patient`)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Full |

---

## 💻 Tech Stack

### Architecture Overview
Derma Tracker is designed as a decoupled client-server architecture:
- **Frontend:** Next.js 16 (React 19) App Router providing server-rendered pages and interactive client terminals.
- **Backend:** Node.js Express 4.21 TypeScript REST and WebSocket server.
- **Database:** MongoDB Atlas with Mongoose 8.9 ODM.

| Layer | Technology | Version | Purpose |
|:---|:---|:---:|:---|
| **Frontend Framework** | Next.js | `16.3.3` | React App Router, SSR, dynamic routing, and API proxy rewrites |
| **UI Library** | React | `19.2.8` | Component rendering and client state management |
| **Styling** | TailwindCSS | `^4.0.0` | Modern CSS utility framework using `@tailwindcss/postcss` |
| **Icons** | Lucide React | `^1.37.0` | Comprehensive clinical and interface iconography |
| **Data Visualization** | Recharts | `^3.10.1` | Dual-axis vitals progression, BMI, and follicular density charts |
| **Calendar Suite** | React Big Calendar | `^1.20.0` | Doctor appointment scheduling and time slot management |
| **PDF Generation** | jsPDF & AutoTable | `^4.2.1` | Client-side statutory GST invoice export |
| **Barcode / QR** | html5-qrcode & react-qr-code | `^2.3.8` | QR rendering and webcam/mobile scanning |
| **Client Notifications**| Sonner | `^2.0.8` | Responsive toast alert system |
| **HTTP Client** | Axios | `^1.20.0` | Interceptor-configured REST client with cookie and Bearer auth |
| **Real-Time Client** | Socket.io Client | `^4.8.3` | Live queue, duty status, and mobile photo synchronization |
| **Backend Framework** | Express | `4.21.0` | REST API routing, rate limiting, and middleware pipeline |
| **Language & Engine** | Node.js & TypeScript | `5.7.0` | Strongly-typed enterprise backend development |
| **Database & ODM** | MongoDB & Mongoose | `8.9.0` | Document datastore, schema indexing, and change hooks |
| **Real-Time Engine** | Socket.io | `4.8.3` | Role-based and user-based room dispatching |
| **Validation** | Zod | `3.24.0` | Request body schema parsing and sanitization |
| **Authentication** | JWT & BcryptJS | `9.0.3` / `3.0.3` | Dual cookie/Bearer JWT sessions with salted password hashes |
| **Image Processing** | Sharp | `0.33.0` | EXIF metadata scrubbing, resizing, and web optimization |
| **Cloud Storage** | Cloudinary SDK | `2.11.0` | Secure cloud storage for clinical scalp photography |
| **Payment Gateway** | Razorpay Node SDK | `2.9.8` | Dynamic QR orders and HMAC-SHA256 webhook verification |
| **Messaging & OTP** | Baileys | `7.0.0-rc14` | Direct WhatsApp Web automation for passwordless OTP delivery |
| **SMS Gateway** | Android SMS Gateway | REST | HTTP client integration with Android physical SMS gateways |
| **Reverse Tunneling** | Cloudflare Tunnel (`cloudflared`) | Native | Secure HTTPS tunneling for mobile pairing without port forwarding |

---

## 📂 Project Structure

```bash
derma-tracker/
├── assets/
│   ├── app-screenshots/            # 26 visual UI screenshots of all modules
│   └── images/                     # Clinical photography & pre-seeded medication images
│       ├── scalp/                  # High-magnification scalp & trichogram photos
│       ├── lab-test-report-img/    # Pathology and dermatoscopy diagnostic samples
│       ├── patent-info-book-img/   # Physical prescription booklet reference imagery
│       ├── Shampoo-img/            # Shampoo formulary packaging images
│       ├── serum-img/              # Alopecia and minoxidil serum packaging images
│       └── tablet-img/             # Oral medication blister pack images
├── client/                         # Next.js 16 React 19 Frontend Application
│   ├── app/                        # App Router Pages
│   │   ├── admin/                  # Administrator & Operations console
│   │   ├── capture/[token]/        # Legacy capture redirect handler
│   │   ├── doctor/                 # Doctor consultation terminal
│   │   │   ├── device-pair/        # Mobile camera QR pairing station
│   │   │   ├── gallery/            # Phototrichogram comparison gallery
│   │   │   └── vitals/             # Longitudinal vitals & BMI trend page
│   │   ├── login/                  # Staff & Patient unified authentication page
│   │   ├── medication-giver/       # Dispensary & prescription fulfillment queue
│   │   ├── mobile/[token]/         # Smartphone mobile capture terminal
│   │   ├── patient/                # Patient health & recovery portal
│   │   ├── receptionist/           # Front desk check-in, queue & billing station
│   │   ├── register-hospital/      # Multi-tenant clinic onboarding flow
│   │   ├── stock-manager/          # Pharmacy inventory, batch & expiry station
│   │   ├── layout.tsx              # Root HTML wrapper with theme & auth providers
│   │   └── page.tsx                # Enterprise marketing landing page & product tour
│   ├── components/                 # Reusable UI Component Library
│   │   ├── CompareSlider.tsx       # Interactive before/after split slider
│   │   ├── InvoicePDFModal.tsx     # GST tax invoice calculation & PDF generator
│   │   ├── MobileCameraModal.tsx   # Native smartphone camera capture modal
│   │   ├── ScalpCameraModal.tsx    # Desktop webcam & USB trichoscope capture modal
│   │   ├── DynamicQRModal.tsx      # Razorpay dynamic payment QR modal
│   │   ├── CounterQRModal.tsx      # Static counter UPI payment QR modal
│   │   ├── landing/                # Full marketing landing page component suite
│   │   ├── Sidebar.tsx             # Responsive role-aware sidebar navigation
│   │   └── Topbar.tsx              # Station header, duty toggles & profile drawer
│   ├── hooks/                      # Custom React Hooks
│   │   ├── useAuth.tsx             # Authentication context and role validation
│   │   ├── useSocket.ts            # Socket.io connection and room lifecycle hook
│   │   └── useTheme.tsx            # Light/Dark mode state management
│   ├── lib/                        # Client Utilities
│   │   ├── api.ts                  # Axios client with credentials & auth interceptors
│   │   ├── socket.ts               # Singleton Socket.io client initializer
│   │   ├── formatExpiry.tsx        # Color-coded expiration badge formatter
│   │   └── imageCompression.ts    # Client-side canvas image downscaling
│   └── package.json                # Frontend dependencies and Next.js scripts
├── server/                         # Node.js Express 4.21 TypeScript Backend
│   ├── src/
│   │   ├── config/                 # System Configurations
│   │   │   ├── db.ts               # MongoDB Mongoose connection manager
│   │   │   ├── env.ts              # Strongly-typed environment variable loader
│   │   │   ├── socket.ts           # Socket.io server and room event router
│   │   │   └── tunnelManager.ts    # Automated Cloudflare quick tunnel lifecycle
│   │   ├── middleware/             # Express Middlewares
│   │   │   ├── authMiddleware.ts   # JWT verification and user hydration
│   │   │   ├── roleMiddleware.ts   # Role-based access control guards
│   │   │   ├── auditMiddleware.ts  # Clinical audit logging middleware
│   │   │   ├── rateLimitMiddleware.ts # Brute-force protection & route limiters
│   │   │   ├── uploadMiddleware.ts # Multer, Sharp EXIF stripper & magic-byte check
│   │   │   └── errorMiddleware.ts  # Centralized AppError handler
│   │   ├── models/                 # Mongoose Schemas & Data Models
│   │   │   ├── User.ts             # Clinic staff accounts (Admin, Doctor, etc.)
│   │   │   ├── Patient.ts          # Patient demographic and medical profiles
│   │   │   ├── Visit.ts            # Clinical consultations, vitals, staging, Rx
│   │   │   ├── Appointment.ts      # Booked doctor time slots
│   │   │   ├── Medicine.ts         # Drug formulary, stock batches, and pricing
│   │   │   ├── Invoice.ts          # Multi-item tax invoices and payment ledger
│   │   │   ├── AuditLog.ts         # Immutable regulatory action audit trails
│   │   │   ├── ClinicSettings.ts   # GST rules, working hours, and payment VPAs
│   │   │   ├── DevicePairing.ts    # Active mobile smartphone pairing sessions
│   │   │   ├── Hospital.ts         # Multi-tenant clinic and hospital profiles
│   │   │   └── OTP.ts              # Temporary verification codes with TTL index
│   │   ├── routes/                 # Express REST Endpoints
│   │   │   ├── authRoutes.ts       # Staff password login & patient OTP auth
│   │   │   ├── adminRoutes.ts      # Staff CRUD, reports, settings, audit logs
│   │   │   ├── doctorRoutes.ts     # Consultation queue, vitals, notes, protocols
│   │   │   ├── receptionistRoutes.ts # Registration, queue orchestration, fee checks
│   │   │   ├── pharmacyRoutes.ts   # Prescription queue, booklet fulfillment, logs
│   │   │   ├── stockRoutes.ts      # Medicines, batches, reorder thresholds
│   │   │   ├── billingRoutes.ts    # Invoices, payments, Razorpay order/verify
│   │   │   ├── clientRoutes.ts     # Patient portal self-service endpoints
│   │   │   ├── devicePairingRoutes.ts # Remote smartphone camera pairing
│   │   │   ├── tunnelRoutes.ts     # Cloudflare quick tunnel control
│   │   │   └── uploadRoutes.ts     # Static and protected image file serving
│   │   ├── scripts/
│   │   │   └── seed.ts             # Database seeder (hospital, staff, medicines)
│   │   ├── services/               # Third-Party Integrations
│   │   │   ├── cloudinaryService.ts # Cloudinary direct asset uploader
│   │   │   ├── otpDispatcher.ts    # Smart router between SMS and WhatsApp
│   │   │   ├── smsGateway.ts       # Android SMS Gateway HTTP integration
│   │   │   └── whatsappService.ts  # Baileys WhatsApp Web automation
│   │   ├── utils/
│   │   │   └── ensureDemoAccounts.ts # Automatic synchronization of demo users
│   │   └── server.ts               # Server bootstrapping, route mounting & graceful exit
│   └── package.json                # Backend dependencies and ts-node-dev scripts
├── dev.js                          # Root orchestrator running Server & Client concurrently
├── package.json                    # Workspace root scripts
└── README.md                       # Comprehensive system documentation
```

---

## 📸 Application Visual Tour & Screenshots

All high-resolution production application captures are preserved in [`assets/app-screenshots/`](assets/app-screenshots/).

| Screen Description | Route / Station | Image Reference |
|:---|:---|:---:|
| **Administrator Executive Overview** | `/admin` | ![Admin Overview](assets/app-screenshots/1.png) |
| **Financial & Operational Intelligence** | `/admin` | ![Admin Analytics](assets/app-screenshots/2.png) |
| **Role-Based Staff Management (RBAC)** | `/admin` | ![Staff Management](assets/app-screenshots/3.png) |
| **Regulatory & Security Audit Logs** | `/admin` | ![Audit Trail](assets/app-screenshots/4.png) |
| **Reception Live Patient Queue** | `/receptionist` | ![Reception Queue](assets/app-screenshots/5.png) |
| **Front-Desk Patient Check-In & Search**| `/receptionist` | ![Patient Check-in](assets/app-screenshots/6.png) |
| **Clinical Patient Registration Form** | `/receptionist` | ![Patient Registration](assets/app-screenshots/7.png) |
| **Front-Desk Billing & Invoicing Ledger**| `/receptionist` | ![Billing Ledger](assets/app-screenshots/8.png) |
| **Payment QR Gateway Configuration** | `/receptionist` | ![Payment Settings](assets/app-screenshots/9.png) |
| **Doctor Consultation Terminal** | `/doctor` | ![Doctor Terminal](assets/app-screenshots/10.png) |
| **E-Prescription & Lab Test Ordering** | `/doctor` | ![Prescription Ordering](assets/app-screenshots/11.png) |
| **Longitudinal Vitals & BMI Analytics** | `/doctor/vitals/[id]` | ![Vitals Graph](assets/app-screenshots/12.png) |
| **Phototrichogram Interactive Split Slider**| `/doctor/gallery` | ![Phototrichogram Slider](assets/app-screenshots/13.png) |
| **Phototrichogram Side-by-Side Dual View** | `/doctor/gallery` | ![Side by Side Comparison](assets/app-screenshots/14.png) |
| **Mobile Device Pairing Station (QR)** | `/doctor/device-pair` | ![Device Pairing](assets/app-screenshots/15.png) |
| **Consultation Workflow Selector** | `/doctor` | ![Workflow Settings](assets/app-screenshots/16.png) |
| **Dispensary Prescription Queue** | `/medication-giver` | ![Dispensary Queue](assets/app-screenshots/17.png) |
| **Batch-Level Dispensation Modal** | `/medication-giver` | ![Dispense Modal](assets/app-screenshots/18.png) |
| **Dispensary Medicine Formulary** | `/medication-giver` | ![Formulary Catalogue](assets/app-screenshots/19.png) |
| **Medication Dispensation History** | `/medication-giver` | ![Dispensation History](assets/app-screenshots/20.png) |
| **Inventory Control & Reorder Station** | `/stock-manager` | ![Inventory Station](assets/app-screenshots/21.png) |
| **Batch & Expiry Records Management** | `/stock-manager` | ![Batch Records](assets/app-screenshots/22.png) |
| **Patient Care Hub & Active Regimen** | `/patient` | ![Patient Hub](assets/app-screenshots/23.png) |
| **4-Stage Trichology Recovery Timeline** | `/patient` | ![Recovery Milestones](assets/app-screenshots/24.png) |
| **Clinical Records, Vitals & Past Rx** | `/patient` | ![Patient Records](assets/app-screenshots/25.png) |
| **Smartphone Mobile Capture Interface** | `/mobile/[token]` | ![Mobile Terminal](assets/app-screenshots/26.jpeg) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js:** `v18.18.0` or higher (`v20+` recommended)
- **Package Manager:** `npm` (v9 or v10)
- **Database:** MongoDB Atlas cluster URI or local MongoDB daemon (`v6.0+`)
- **Operating System:** Linux, macOS, or Windows (WSL2 recommended)

---

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/dhinakaran-Y/Derma-Tracker.git
   cd Derma-Tracker
   ```

2. **Install Root Dependencies:**
   ```bash
   npm install
   ```

3. **Install Backend Server Dependencies:**
   ```bash
   cd server
   npm install
   cd ..
   ```

4. **Install Frontend Client Dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

---

### Environment Variables

#### Backend Configuration (`server/.env`)
Create a file named `.env` inside the `server/` directory:

```bash
cp server/.env.example server/.env
```

| Variable | Description | Example / Default Value |
|:---|:---|:---|
| `MONGODB_URI` | MongoDB connection connection string | `mongodb+srv://<user>:<pwd>@cluster.mongodb.net/derma-tracker` |
| `JWT_SECRET` | 32+ character secret key for JWT session signing | `super_secret_jwt_key_derma_track_2026` |
| `PORT` | HTTP port on which Express server listens | `5000` |
| `CLIENT_URL` | Origin URL of the Next.js client for CORS | `http://localhost:3000` |
| `NODE_ENV` | Application environment mode | `development` (or `production`) |
| `PUBLIC_APP_URL` | Public domain for phone QR pairing | `https://derma-tracker-brown.vercel.app` |
| `RAZORPAY_KEY_ID` | Razorpay Merchant Key ID | `rzp_test_xxxxxxxxxxxx` |
| `RAZORPAY_KEY_SECRET`| Razorpay Merchant Secret Key | `xxxxxxxxxxxxxxxxxxxxxxxx` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret key for verifying payment webhooks | `your_webhook_secret_key` |
| `SMS_GATEWAY_URL` | Endpoint of Android SMS Gateway app | `https://api.sms-gate.app` |
| `SMS_GATEWAY_USERNAME` | SMS Gateway cloud account username | `sms_gateway_user` |
| `SMS_GATEWAY_PASSWORD` | SMS Gateway cloud account password | `sms_gateway_password` |
| `SMS_GATEWAY_DEVICE_ID`| Optional target Android phone device ID | `device_abc123` |
| `WHATSAPP_ENABLED` | Enable Baileys WhatsApp OTP delivery | `false` |
| `HARDCODE_DEV_OTP` | Lock OTP to `123456` for easy local testing | `true` |
| `LOCALSTORAGE_ENABLED` | Store photos on local disk (`server/uploads`) | `true` |
| `CLOUDINARY_ENABLED` | Upload photos to Cloudinary CDN | `false` |
| `CLOUDINARY_CLOUD_NAME`| Cloudinary Cloud Name | `your_cloudinary_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `your_cloudinary_key` |
| `CLOUDINARY_API_SECRET`| Cloudinary API Secret | `your_cloudinary_secret` |

#### Frontend Configuration (`client/.env.local`)
Create a file named `.env.local` inside the `client/` directory:

```bash
cp client/.env.example client/.env.local
```

| Variable | Description | Example / Default Value |
|:---|:---|:---|
| `NEXT_PUBLIC_SERVER_URL` | Backend server root origin (no trailing slash) | `http://localhost:5000` |
| `NEXT_PUBLIC_API_URL` | Full API root endpoint | `http://localhost:5000/api` |

---

### Database Seeding & Default Credentials

DermaTrack includes an automated demo synchronizer and a comprehensive seed script that provisions a flagship hospital, clinic settings, default staff across all 5 roles, a test patient, and 19 clinical dermatological medications.

Run the seed script:
```bash
npm run seed
```

#### Pre-Configured Demo Accounts

| Role | Login Identifier (Email / Username) | Password | Default Purpose |
|:---|:---|:---:|:---|
| **Administrator** | `aruna_hair_care@gmail.com` *(or `aruna_hair_care`)* | `pass123` | Clinic settings, staff management, audit logs |
| **Dermatologist** | `aruna.vimal@gmail.com` *(or `vimal`)* | `pass123` | Patient queue, staging, prescriptions, photo comparison |
| **Receptionist** | `aruna.sharmi@gmail.com` *(or `sharmi`)* | `pass123` | Patient check-in, queue management, billing |
| **Medication Giver**| `aruna.kavitha@gmail.com` *(or `kavitha`)* | `pass123` | Prescription fulfillment & medication dispensing |
| **Stock Manager** | `aruna.yakavi@gmail.com` *(or `yakavi`)* | `pass123` | Drug inventory, batch tracking, expiry monitoring |
| **Patient Portal** | Phone: `0123456789` | OTP: `123456` | Recovery milestones, scalp photos, self-pay billing |

> **Note on Startup:** The server runs `ensureDemoAccounts()` on every boot, ensuring these accounts remain available for local testing even if records are modified.

---

### Running the Application

#### Development Mode (Concurrent Orchestration)
Start both the Express backend and the Next.js frontend with a single command from the project root:

```bash
npm run dev
```

This runs `dev.js`, which starts:
- 🚀 **Backend Server:** `http://localhost:5000`
- 💻 **Frontend Portal:** `http://localhost:3000` (listening on `0.0.0.0` for LAN access)

#### Running Services Individually
```bash
# Terminal 1: Backend API
npm run dev:server

# Terminal 2: Frontend Next.js Client
npm run dev:client
```

#### Production Build & Run
```bash
# Build both services
npm run build

# Start production server
npm run start
```

---

## 📡 API Documentation

All API routes are mounted under `/api` (with fallback resolution at root `/` for backward compatibility).

### Authentication & Sessions (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `POST` | `/api/auth/staff/login` | Authenticate staff by email/username and password | Public (Rate-limited) |
| `POST` | `/api/auth/otp/send` | Request 6-digit OTP via SMS or WhatsApp | Public (Rate-limited) |
| `POST` | `/api/auth/otp/verify` | Verify OTP code and issue 7-day patient JWT | Public |
| `POST` | `/api/auth/logout` | Clear HTTP-only session cookie | Public |
| `GET` | `/api/auth/me` | Fetch active profile and clinic hospital context | Authenticated |

### Administrator Endpoints (`/api/admin`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `GET` | `/api/admin/staff` | List all staff members in the clinic | Admin Only |
| `POST` | `/api/admin/staff` | Create a new staff account | Admin Only |
| `PATCH`| `/api/admin/staff/:id` | Update staff details and role | Admin Only |
| `PATCH`| `/api/admin/staff/:id/status`| Toggle staff status (`Active` / `Suspended`) | Admin Only |
| `PATCH`| `/api/admin/staff/:id/password`| Reset staff password | Admin Only |
| `DELETE`| `/api/admin/staff/:id` | Soft-delete or remove staff account | Admin Only |
| `GET` | `/api/admin/settings` | Retrieve clinic settings, hours, and GST rules | Admin Only |
| `PATCH`| `/api/admin/settings` | Update clinic operational configuration | Admin Only |
| `GET` | `/api/admin/audit-log` | Inspect audit trail of sensitive reads & mutations | Admin Only |
| `GET` | `/api/admin/reports/summary` | Consolidated clinic collections & inventory valuation | Admin Only |
| `GET` | `/api/admin/reports/fast-movers`| Top 5 dispensed medications by volume | Admin Only |
| `GET` | `/api/admin/reports/expiry-risk`| Batches expiring within 90 days | Admin Only |

### Doctor Consultation Endpoints (`/api/doctor`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `GET` | `/api/doctor/queue` | Fetch today's patient queue for logged-in doctor | Doctor Only |
| `GET` | `/api/doctor/protocols` | Evidence-based alopecia clinical treatment protocols | Doctor Only |
| `GET` | `/api/doctor/patient/:id/vitals` | Longitudinal vitals and BMI history for a patient | Doctor Only |
| `PATCH`| `/api/doctor/visits/:id/start` | Mark consultation as *In Progress* | Doctor Only |
| `PATCH`| `/api/doctor/visits/:id` | Save diagnosis, Norwood stage, DLQI, Rx, lab tests | Doctor Only |
| `POST` | `/api/doctor/visits/:id/images` | Upload clinical scalp photograph | Doctor Only |
| `DELETE`| `/api/doctor/visits/:id/images/:imageId`| Remove uploaded scalp photograph | Doctor Only |
| `PATCH`| `/api/doctor/duty-status` | Toggle On Duty / Off Duty availability | Doctor Only |
| `POST` | `/api/doctor/pairing/generate`| Generate temporary mobile pairing session | Doctor Only |

### Receptionist & Queue Endpoints (`/api/receptionist`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `POST` | `/api/receptionist/patients` | Register new patient with baseline vitals | Receptionist / Admin |
| `GET` | `/api/receptionist/patients` | Search registered patients by phone or name | Receptionist / Admin |
| `POST` | `/api/receptionist/check-in` | Enqueue patient, assign doctor, set fee status | Receptionist / Admin |
| `GET` | `/api/receptionist/queue` | Real-time active waiting lobby queue | Receptionist / Admin |
| `PATCH`| `/api/receptionist/queue/reorder` | Update queue display sequence numbers | Receptionist / Admin |
| `PATCH`| `/api/receptionist/queue/:id/fee-status`| Update consultation fee (`Paid` / `Pending`) | Receptionist / Admin |
| `POST` | `/api/receptionist/queue/:id/cancel`| Cancel waiting queue ticket | Receptionist / Admin |
| `GET` | `/api/receptionist/fee-detection/:pId/:dId`| Calculate Initial vs. Follow-up fee | Receptionist / Admin |

### Pharmacy & Dispensary Endpoints (`/api/pharmacy`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `GET` | `/api/pharmacy/pending` | Fetch prescriptions awaiting fulfillment | MedicationGiver / Admin |
| `POST` | `/api/pharmacy/dispense` | Dispense medications with batch deduction | MedicationGiver / Admin |
| `POST` | `/api/pharmacy/booklet-fulfill`| Fulfill handwritten prescription booklet | MedicationGiver / Admin |
| `GET` | `/api/pharmacy/catalogue` | Active formulary pricing and batch stock | Staff |
| `GET` | `/api/pharmacy/dispense-log` | Audit trail of dispensed medications | Staff |
| `GET` | `/api/pharmacy/sales-analytics`| Real-time pharmacy sales revenue metrics | Staff |

### Inventory & Stock Endpoints (`/api/stock`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `GET` | `/api/stock/medicines` | Complete inventory catalogue with batch details | StockManager / Admin |
| `POST` | `/api/stock/medicines` | Register new pharmaceutical formulation | StockManager / Admin |
| `PATCH`| `/api/stock/medicines/:id` | Update medication description and reorder level | StockManager / Admin |
| `POST` | `/api/stock/medicines/:id/batches`| Add new batch (batch #, expiry, cost, price) | StockManager / Admin |
| `DELETE`| `/api/stock/medicines/:id/batches/:bId`| Decommission batch | StockManager / Admin |
| `GET` | `/api/stock/reorder-alerts` | Retrieve items below reorder threshold | StockManager / Admin |
| `GET` | `/api/stock/reports/overview`| Total stock valuation at purchase vs. retail | StockManager / Admin |

### Invoicing & Billing Endpoints (`/api/billing`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `POST` | `/api/billing/invoices` | Generate multi-item tax invoice with GST | Receptionist / Admin |
| `GET` | `/api/billing/invoices` | List invoices with date, status, and search filters| Receptionist / Admin |
| `GET` | `/api/billing/invoices/:id` | Retrieve single invoice details | Authenticated |
| `POST` | `/api/billing/invoices/:id/payments` | Record offline cash, card, or UPI payment | Receptionist / Admin |
| `POST` | `/api/billing/invoices/:id/razorpay/order`| Create Razorpay order for online payment | Authenticated |
| `POST` | `/api/billing/invoices/:id/razorpay/verify`| Verify payment signature and mark as *Paid* | Authenticated |
| `POST` | `/api/billing/razorpay/webhook` | Asynchronous Razorpay webhook receiver | HMAC Signature |

### Patient Self-Service Portal (`/api/client`)
| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `GET` | `/api/client/dashboard` | Active patient care summary and next visit | Patient Only |
| `GET` | `/api/client/progress` | 4-stage recovery milestones and scalp photos | Patient Only |
| `GET` | `/api/client/records` | Past clinical consultation notes and Rx | Patient Only |
| `GET` | `/api/client/bills` | Unpaid and settled invoices with payment links | Patient Only |
| `GET` | `/api/client/appointments` | Patient scheduled appointments | Patient Only |
| `GET` | `/api/client/doctors` | Available clinic specialists for booking | Patient Only |
| `PATCH`| `/api/client/my-profile` | Update contact address and location | Patient Only |

---

## 🗄️ Database Architecture & Schema Relationships

DermaTrack uses MongoDB with strongly typed Mongoose schemas, foreign-key indexing, and virtual relationships.

```
┌──────────────┐         1:N         ┌──────────────┐
│   Hospital   │ ──────────────────> │     User     │ (Staff: Admin, Doctor, etc.)
└──────────────┘                     └──────────────┘
       │                                     │
       │ 1:N                                 │ 1:N
       ▼                                     ▼
┌──────────────┐         1:N         ┌──────────────┐         1:N         ┌──────────────┐
│   Patient    │ ──────────────────> │    Visit     │ <────────────────── │   Medicine   │
└──────────────┘                     └──────────────┘ (Prescriptions)     └──────────────┘
       │                                     │                                   │ (Batches)
       │ 1:N                                 │ 1:1                               ▼
       ▼                                     ▼                            ┌──────────────┐
┌──────────────┐                     ┌──────────────┐                     │  DispenseLog │
│ Appointment  │                     │   Invoice    │                     └──────────────┘
└──────────────┘                     └──────────────┘
                                             │
                                             ▼
                                     ┌──────────────┐
                                     │  Payment Txn │
                                     └──────────────┘
```

### Core Collections Overview

1. **`hospitals` ([Hospital.ts](server/src/models/Hospital.ts)):** Multi-tenant clinic metadata (name, address, GSTIN, contact numbers, branding logo).
2. **`users` ([User.ts](server/src/models/User.ts)):** Clinic staff members, encrypted credentials, role definition, on-duty status, consultation fees, and specialization.
3. **`patients` ([Patient.ts](server/src/models/Patient.ts)):** Patient demographics, unique UHID (`PAT-000001`), emergency contacts, allergies, blood group, baseline weight, and medical history.
4. **`visits` ([Visit.ts](server/src/models/Visit.ts)):** Clinical encounter records storing visit type, queue position, vitals (`weightKg`, `heightCm`, `bmi`), trichology assessment (Norwood/Ludwig stage, scalp signs checklist, DLQI score), e-prescriptions, ordered lab tests, and photo attachments.
5. **`medicines` ([Medicine.ts](server/src/models/Medicine.ts)):** Drug formulary master with sub-document arrays for batches (`batchNumber`, `expiryDate`, `purchaseCost`, `sellingPrice`, `quantity`), reorder alerts, and virtual `totalStock`.
6. **`invoices` ([Invoice.ts](server/src/models/Invoice.ts)):** Financial ledger containing invoice numbers (`INV-2026-0001`), line items with specific GST rates, subtotal, CGST/SGST splits, grand total, and payment transaction history.
7. **`appointments` ([Appointment.ts](server/src/models/Appointment.ts)):** Doctor slot bookings with UTC date boundaries, status flags (`Booked`, `Completed`, `Cancelled`), and walk-in source tags.
8. **`auditlogs` ([AuditLog.ts](server/src/models/AuditLog.ts)):** Immutable audit trails capturing user role, actor ID, action description, accessed medical resource, IP address, and browser user-agent.
9. **`devicepairings` ([DevicePairing.ts](server/src/models/DevicePairing.ts)):** Cryptographic pairing tokens linking doctor consultation sessions to remote smartphones for mobile camera photo capture.
10. **`otps` ([OTP.ts](server/src/models/OTP.ts)):** Short-lived verification codes with MongoDB TTL index (expires in 300 seconds), consecutive attempt counters, and lockout timestamps.

---

## 🔒 Security, Data Protection & Healthcare Compliance

DermaTrack is engineered with clinical data privacy and regulatory hygiene as primary concerns.

### 1. Dual-Tier Authentication & RBAC
- **Staff Protection:** Email/Username + password authentication protected by `bcryptjs` (salt factor 12) with HTTP-only, `SameSite=lax` (or `none` in production) JWT cookies and Bearer token fallback.
- **Patient Protection:** Passwordless phone verification using cryptographically secure pseudorandom numbers (`crypto.randomInt`).
- **Account Lockout:** 5 consecutive failed verification attempts trigger an automatic 15-minute account lockout (`OTP_LOCKED`). Rolling rate limiting allows a maximum of 3 OTP requests per phone per 10 minutes.

### 2. Clinical Photography & Media Sanitization
- **EXIF Stripping:** Smartphone cameras embed sensitive metadata in image headers (GPS coordinates of doctor's location, device serial numbers, exact timestamps). DermaTrack processes every incoming image through `sharp`, stripping all EXIF metadata before writing to disk or Cloudinary.
- **Magic-Byte Signature Verification:** Uploads are validated against binary magic bytes to prevent executable file masking.
- **Upload Caps:** Strict 5MB-per-photo limits and 25MB JSON payload caps prevent denial-of-service memory exhaustion.

### 3. Payment Gateway Integrity
- **HMAC-SHA256 Verification:** Incoming Razorpay payment webhooks are verified against `RAZORPAY_WEBHOOK_SECRET` using raw request buffers before mutating invoice payment records.
- **Tamper Resistance:** Line item prices and GST calculations are computed strictly server-side; client payment requests cannot override price parameters.

### 4. Patient Data Privacy & Compliance Notes
- **DISHA & HIPAA Alignment:** Access to sensitive patient clinical records (scalp macro-photos, lab reports, past diagnoses) triggers an entry in `AuditLog`.
- **Statutory Tax Integrity:** Invoices use sequential, gapless numbering (`INV-YYYY-XXXX`) compliant with statutory GST audit rules. Cancelled visits retain their foreign key relationship to invoices to preserve financial auditability.

---

## 🚢 Deployment Guide

### Architecture for Production Deployment
```
                         ┌────────────────────────────────────────┐
                         │           Vercel / Cloudflare          │
                         │          (Next.js 16 Frontend)        │
                         └────────────────────────────────────────┘
                                              │
                                              │ HTTPS / WSS
                                              ▼
 ┌────────────────────────┐      ┌────────────────────────────────┐
 │     Cloudinary CDN     │ <─── │        Render / Railway        │
 │   (Scalp Photography)  │      │   (Express TypeScript Server)  │
 └────────────────────────┘      └────────────────────────────────┘
                                              │
                                              │ Mongoose TLS
                                              ▼
                                 ┌────────────────────────────────┐
                                 │      MongoDB Atlas Cluster     │
                                 └────────────────────────────────┘
```

### 1. Deploying the Backend (Render / Railway / DigitalOcean)
1. Fork or push this repository to GitHub.
2. In **Render** (or your preferred PaaS), create a new **Web Service** connected to your repository.
3. Configure the build settings:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
4. Configure the environment variables in the dashboard:
   - Set `NODE_ENV=production`
   - Set `MONGODB_URI` to your MongoDB Atlas connection string.
   - Set `JWT_SECRET` to a strong random string.
   - Set `CLIENT_URL` to your production frontend domain (e.g., `https://derma-tracker-brown.vercel.app`).
   - Configure Razorpay, Cloudinary, and SMS credentials as needed.

### 2. Deploying the Frontend (Vercel)
1. In the **Vercel Dashboard**, click **Add New Project** and select the repository.
2. Configure project settings:
   - **Framework Preset:** Next.js
   - **Root Directory:** `client`
3. Configure the environment variables:
   - `NEXT_PUBLIC_SERVER_URL`: Your backend URL (e.g., `https://derma-tracker-api.onrender.com`)
   - `NEXT_PUBLIC_API_URL`: Your backend API URL (e.g., `https://derma-tracker-api.onrender.com/api`)
4. Click **Deploy**. Vercel will automatically build the Next.js application with TailwindCSS and output the optimized bundle.

---

## 🗺️ Roadmap & Future Enhancements

- [ ] **AI-Assisted Follicular Unit Density Estimation:** Automated computer vision pipeline to estimate follicular counts per cm² from trichoscopy macro-photos.
- [ ] **Automated WhatsApp Follow-Up Reminders:** Automated WhatsApp messaging for upcoming follow-up appointments and treatment milestones via Baileys.
- [ ] **Multi-Branch Multi-Tenancy:** Complete tenant isolation for multi-clinic chains with centralized inventory transfers and cross-branch patient history sharing.
- [ ] **DICOM / HL7 Interoperability:** Export patient records into standard medical imaging and health record exchange formats.
- [ ] **Offline-First PWA Mode:** Progressive Web App caching enabling doctors to view patient history and record consultation notes during network disruptions.

---

## 🤝 Contributing Guidelines

Contributions are welcome from the dermatology, health-tech, and open-source communities!

1. **Fork the Repository** on GitHub.
2. **Create a Feature Branch:**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Commit Your Changes:**
   ```bash
   git commit -m 'feat: Add amazing clinical feature'
   ```
4. **Push to the Branch:**
   ```bash
   git push origin feature/amazing-feature
   ```
5. **Open a Pull Request:** Describe the rationale, testing steps, and relevant screenshots or API contracts.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for complete details.

```
MIT License

Copyright (c) 2026 Dhinakaran Y

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

## 📬 Authors & Acknowledgments

- **Lead Developer & Maintainer:** **Dhinakaran Y**
  - **GitHub:** [@dhinakaran-Y](https://github.com/dhinakaran-Y)
  - **Repository:** [dhinakaran-Y/Derma-Tracker](https://github.com/dhinakaran-Y/Derma-Tracker)
  - **Live Application:** [derma-tracker-brown.vercel.app](https://derma-tracker-brown.vercel.app/)

*Special thanks to the clinical dermatologists, trichology consultants, and open-source contributors whose operational feedback shaped the workflow architecture of DermaTrack.*
