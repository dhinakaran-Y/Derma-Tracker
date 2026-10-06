/**
 * seedMedicines.ts — Populate the pharmacy catalogue with REAL dermatology
 * & trichology medicines observed at the clinic + additional common prescriptions.
 *
 * Data sourced from:
 *   assets/images/serum-img/     → Hair serums (Minoxidil / Finasteride topicals)
 *   assets/images/Shampoo-img/   → Medicated shampoos
 *   assets/images/tablet-img/    → Oral tablets / capsules
 *   Web research                 → Popular Indian derma-trichology brands
 *
 * Run:
 *   npx ts-node src/scripts/seedMedicines.ts          (adds only, no-dups)
 *   npx ts-node src/scripts/seedMedicines.ts --reset   (wipes + re-seeds)
 */

import mongoose from 'mongoose';
import { env } from '../config/env';
import { Medicine, MedicineCategory } from '../models/Medicine';
import { Hospital } from '../models/Hospital';

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

interface SeedMedicine {
  name: string;
  genericName: string;
  description: string;
  category: MedicineCategory;
  manufacturer: string;
  imageUrl?: string;
  sellingPrice: number;
  costPrice: number;
  reorderLevel: number;
  unit: string;
  batch: {
    batchNumber: string;
    quantity: number;
    expiryDate: Date;
    purchasePrice: number;
  };
}

// ─────────────────────────────────────────────────────────
// COMPLETE MEDICINE CATALOGUE
// ─────────────────────────────────────────────────────────

const MEDICINES: SeedMedicine[] = [

  // ╔═══════════════════════════════════════════════════════╗
  // ║  SERUMS & TOPICAL SOLUTIONS (from clinic photos)     ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'Kera-FM 5%',
    genericName: 'Minoxidil & Finasteride Topical Solution',
    description: 'Topical hair growth solution with 5% Minoxidil and Finasteride. Fortified with dual penetration enhancers and natural moisturizing factor. For external use on scalp. Apply 1-2ml daily at night.',
    category: 'Serum',
    manufacturer: 'Ipca Laboratories',
    imageUrl: '/api/uploads/public/kera-fm-5.jpg',
    sellingPrice: 850,
    costPrice: 520,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'KFM-2025-A1', quantity: 30, expiryDate: new Date('2027-08-31'), purchasePrice: 520 },
  },
  {
    name: 'Androanagen Solution 5%',
    genericName: 'Minoxidil Topical Solution USP 5.0% w/v',
    description: 'Dermatologically tested, alcohol-free Minoxidil topical solution for androgenetic alopecia. 100ml bottle with dropper. Promotes hair regrowth and slows hair loss. Apply twice daily.',
    category: 'Serum',
    manufacturer: 'Torrent Pharmaceuticals',
    imageUrl: '/api/uploads/public/androanagen-5.jpg',
    sellingPrice: 780,
    costPrice: 480,
    reorderLevel: 12,
    unit: 'Bottle (100ml)',
    batch: { batchNumber: 'ANG-2025-B2', quantity: 25, expiryDate: new Date('2027-06-30'), purchasePrice: 480 },
  },
  {
    name: 'Inbilt-F',
    genericName: 'Minoxidil & Finasteride Lipid Solution (Cetosomes)',
    description: 'Patented Cetosomes penetration booster technology by Glenmark. Minoxidil + Finasteride lipid solution enriched with moisturizers & antioxidants. 60ml for topical scalp application, daily at night.',
    category: 'Serum',
    manufacturer: 'Glenmark Pharmaceuticals',
    imageUrl: '/api/uploads/public/inbilt-f.jpg',
    sellingPrice: 920,
    costPrice: 580,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'INB-2025-C3', quantity: 20, expiryDate: new Date('2027-09-30'), purchasePrice: 580 },
  },
  {
    name: 'Strandz 5% Liposomal',
    genericName: 'Minoxidil 5% Liposomal Topical Solution',
    description: 'Liposomal minoxidil with patented technology for improved penetration and targeted delivery. 60ml bottle for topical use only. Better absorption than conventional minoxidil solutions.',
    category: 'Serum',
    manufacturer: 'Eris Oaknet (Eris Lifesciences)',
    imageUrl: '/api/uploads/public/strandz-5.jpg',
    sellingPrice: 890,
    costPrice: 540,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'STZ-2025-D4', quantity: 18, expiryDate: new Date('2027-07-31'), purchasePrice: 540 },
  },
  {
    name: 'Strandz F (Minoxidil 5% + Finasteride 0.1%)',
    genericName: 'Minoxidil 5% & Finasteride 0.1% Lipid Solution + Procapil + Redensyl + Anagain + Caffeine',
    description: 'Premium alcohol-free hair growth solution combining Minoxidil 5% with Finasteride 0.1%, Procapil, Redensyl, Anagain, Caffeine, and Transcutol P. Advanced multi-peptide formula for male pattern baldness.',
    category: 'Serum',
    manufacturer: 'Eris Oaknet (Eris Lifesciences)',
    imageUrl: '/api/uploads/public/strandz-f.jpg',
    sellingPrice: 1050,
    costPrice: 680,
    reorderLevel: 8,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'SZF-2025-E5', quantity: 15, expiryDate: new Date('2027-10-31'), purchasePrice: 680 },
  },

  // ╔═══════════════════════════════════════════════════════╗
  // ║  SHAMPOOS (from clinic photo + common prescriptions) ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'CosmoQ Shampoo',
    genericName: 'Hydrating Anti-Frizz Dermatology Shampoo',
    description: 'Aesthetic Science everyday shampoo that restores hydration and prevents hair frizz. 200ml dermatology-grade formula. Suitable for daily use on all hair types.',
    category: 'Shampoo',
    manufacturer: 'Aesthetic Science',
    imageUrl: '/api/uploads/public/cosmoq-shampoo.jpg',
    sellingPrice: 550,
    costPrice: 340,
    reorderLevel: 15,
    unit: 'Bottle (200ml)',
    batch: { batchNumber: 'CSQ-2025-F1', quantity: 35, expiryDate: new Date('2027-12-31'), purchasePrice: 340 },
  },
  {
    name: 'Ketoconazole Shampoo 2% (Ketocip)',
    genericName: 'Ketoconazole 2% w/v Medicated Shampoo',
    description: 'Antifungal medicated shampoo with 2% ketoconazole. Treats dandruff, seborrheic dermatitis, and pityriasis versicolor. Also provides mild anti-androgenic effect supporting hair retention. Use 2-3 times per week.',
    category: 'Shampoo',
    manufacturer: 'Cipla Ltd.',
    sellingPrice: 350,
    costPrice: 210,
    reorderLevel: 15,
    unit: 'Bottle (100ml)',
    batch: { batchNumber: 'KTZ-2025-I1', quantity: 40, expiryDate: new Date('2027-06-30'), purchasePrice: 210 },
  },
  {
    name: 'Zinc Pyrithione Shampoo 1%',
    genericName: 'Zinc Pyrithione 1% w/v Anti-Dandruff Shampoo',
    description: 'Anti-dandruff shampoo containing 1% zinc pyrithione. Controls flaking, itching, and scalp irritation caused by dandruff and seborrheic dermatitis. For regular use.',
    category: 'Shampoo',
    manufacturer: 'Johnson & Johnson',
    sellingPrice: 280,
    costPrice: 160,
    reorderLevel: 15,
    unit: 'Bottle (100ml)',
    batch: { batchNumber: 'ZPT-2025-O1', quantity: 30, expiryDate: new Date('2028-01-31'), purchasePrice: 160 },
  },
  {
    name: 'Sebowash Shampoo',
    genericName: 'Ketoconazole 2% Shampoo',
    description: 'Premium antifungal shampoo by Cipla for stubborn dandruff, seborrheic dermatitis, and fungal infections of the scalp. Clinically proven ketoconazole 2% formula. Apply and leave for 3-5 minutes.',
    category: 'Shampoo',
    manufacturer: 'Cipla Ltd.',
    sellingPrice: 395,
    costPrice: 245,
    reorderLevel: 12,
    unit: 'Bottle (100ml)',
    batch: { batchNumber: 'SBW-2025-S1', quantity: 28, expiryDate: new Date('2027-11-30'), purchasePrice: 245 },
  },
  {
    name: 'Scalpe Plus Shampoo',
    genericName: 'Ketoconazole 1% + Zinc Pyrithione 1% Shampoo',
    description: 'Dual-action anti-dandruff shampoo with ketoconazole and zinc pyrithione. For moderate-to-severe dandruff and itchy scalp. Gentle enough for regular use.',
    category: 'Shampoo',
    manufacturer: 'Glenmark Pharmaceuticals',
    sellingPrice: 360,
    costPrice: 220,
    reorderLevel: 12,
    unit: 'Bottle (75ml)',
    batch: { batchNumber: 'SCP-2025-S2', quantity: 25, expiryDate: new Date('2027-08-31'), purchasePrice: 220 },
  },

  // ╔═══════════════════════════════════════════════════════╗
  // ║  TABLETS (from clinic photos + common prescriptions)  ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'Duman 0.5mg',
    genericName: 'Dutasteride Tablets IP 0.5mg',
    description: 'Dutasteride 0.5mg film-coated tablets by Intas Pharmaceuticals. 5-alpha reductase inhibitor for androgenetic alopecia. MFD Dec 2024, EXP Nov 2027. MRP ₹208 for 10 tabs. Store below 25°C, protect from light.',
    category: 'Tablet',
    manufacturer: 'Intas Pharmaceuticals Ltd.',
    imageUrl: '/api/uploads/public/duman-dutasteride.jpg',
    sellingPrice: 208,
    costPrice: 130,
    reorderLevel: 20,
    unit: 'Strip (10 tabs)',
    batch: { batchNumber: 'DMN-N2403390', quantity: 50, expiryDate: new Date('2027-11-30'), purchasePrice: 130 },
  },
  {
    name: 'Finasteride 1mg (Finpecia)',
    genericName: 'Finasteride Tablets IP 1mg',
    description: 'Finasteride 1mg by Cipla for male androgenetic alopecia. Blocks DHT conversion to slow hair loss and promote regrowth. Take 1 tablet daily. Prescription only. Women of childbearing age should not handle.',
    category: 'Tablet',
    manufacturer: 'Cipla Ltd.',
    sellingPrice: 320,
    costPrice: 190,
    reorderLevel: 25,
    unit: 'Strip (30 tabs)',
    batch: { batchNumber: 'FIN-2025-J1', quantity: 60, expiryDate: new Date('2027-12-31'), purchasePrice: 190 },
  },
  {
    name: 'Finax 1mg',
    genericName: 'Finasteride Tablets IP 1mg',
    description: 'Dr. Reddy\'s finasteride for male pattern hair loss. 5-alpha reductase type II inhibitor. Reduces scalp DHT by approximately 70%. Take 1 tablet daily with or without food.',
    category: 'Tablet',
    manufacturer: "Dr. Reddy's Laboratories",
    sellingPrice: 290,
    costPrice: 175,
    reorderLevel: 20,
    unit: 'Strip (15 tabs)',
    batch: { batchNumber: 'FNX-2025-T1', quantity: 45, expiryDate: new Date('2027-10-31'), purchasePrice: 175 },
  },
  {
    name: 'Biotin 10000mcg',
    genericName: 'Biotin (Vitamin B7) Tablets',
    description: 'High-dose Biotin (Vitamin B7) supplement at 10000mcg. Supports hair growth, strengthens nails, and improves skin health. Essential for keratin infrastructure. Take 1 tablet daily after meals.',
    category: 'Tablet',
    manufacturer: 'HealthKart / Abbott',
    sellingPrice: 450,
    costPrice: 280,
    reorderLevel: 25,
    unit: 'Bottle (60 tabs)',
    batch: { batchNumber: 'BIO-2025-H1', quantity: 35, expiryDate: new Date('2028-03-31'), purchasePrice: 280 },
  },
  {
    name: 'Iron & Folic Acid',
    genericName: 'Ferrous Fumarate 152mg + Folic Acid 1.5mg',
    description: 'Iron and folic acid supplement for telogen effluvium caused by iron deficiency anemia. Essential for oxygen delivery to hair follicles. Take 1 tablet daily after meals.',
    category: 'Tablet',
    manufacturer: 'Sun Pharmaceutical',
    sellingPrice: 85,
    costPrice: 45,
    reorderLevel: 30,
    unit: 'Strip (30 tabs)',
    batch: { batchNumber: 'IFA-2025-K1', quantity: 100, expiryDate: new Date('2028-06-30'), purchasePrice: 45 },
  },
  {
    name: 'Prednisolone 5mg',
    genericName: 'Prednisolone Tablets IP 5mg',
    description: 'Oral corticosteroid for alopecia areata flares and severe inflammatory scalp conditions. Short-term immunosuppressive therapy. Dose as directed by physician. Taper gradually.',
    category: 'Tablet',
    manufacturer: 'Cadila Healthcare (Zydus)',
    sellingPrice: 35,
    costPrice: 18,
    reorderLevel: 30,
    unit: 'Strip (10 tabs)',
    batch: { batchNumber: 'PRD-2025-P1', quantity: 80, expiryDate: new Date('2027-10-31'), purchasePrice: 18 },
  },
  {
    name: 'Doxycycline 100mg',
    genericName: 'Doxycycline Hyclate Capsules IP 100mg',
    description: 'Tetracycline antibiotic for acne vulgaris, rosacea, and inflammatory scalp folliculitis. Take 1 capsule twice daily after meals with full glass of water. Avoid sun exposure during treatment.',
    category: 'Capsule',
    manufacturer: 'Ranbaxy (Sun Pharma)',
    sellingPrice: 120,
    costPrice: 65,
    reorderLevel: 20,
    unit: 'Strip (10 capsules)',
    batch: { batchNumber: 'DOX-2025-U1', quantity: 50, expiryDate: new Date('2027-09-30'), purchasePrice: 65 },
  },
  {
    name: 'Isotretinoin 20mg (Tretiva)',
    genericName: 'Isotretinoin Soft Gelatin Capsules 20mg',
    description: 'Systemic retinoid for severe nodulocystic acne unresponsive to conventional therapy. Reduces sebum production by up to 90%. Strict pregnancy prevention required. Monthly blood tests needed.',
    category: 'Capsule',
    manufacturer: 'Intas Pharmaceuticals Ltd.',
    sellingPrice: 280,
    costPrice: 170,
    reorderLevel: 15,
    unit: 'Strip (10 capsules)',
    batch: { batchNumber: 'ISO-2025-V1', quantity: 30, expiryDate: new Date('2027-08-31'), purchasePrice: 170 },
  },
  {
    name: 'Hydroxychloroquine 200mg',
    genericName: 'Hydroxychloroquine Sulphate Tablets IP 200mg',
    description: 'Immunomodulator used in discoid lupus erythematosus, lichen planus, and some forms of alopecia. Anti-inflammatory and photoprotective properties. Regular eye exams required during therapy.',
    category: 'Tablet',
    manufacturer: 'Ipca Laboratories',
    sellingPrice: 110,
    costPrice: 60,
    reorderLevel: 15,
    unit: 'Strip (10 tabs)',
    batch: { batchNumber: 'HCQ-2025-W1', quantity: 40, expiryDate: new Date('2028-02-28'), purchasePrice: 60 },
  },
  {
    name: 'Methotrexate 7.5mg',
    genericName: 'Methotrexate Tablets IP 7.5mg',
    description: 'Disease-modifying antirheumatic drug for severe psoriasis, psoriatic arthritis, and recalcitrant alopecia areata. Once weekly dosing. Requires regular liver function and blood count monitoring.',
    category: 'Tablet',
    manufacturer: 'Zydus Cadila',
    sellingPrice: 75,
    costPrice: 40,
    reorderLevel: 10,
    unit: 'Strip (4 tabs)',
    batch: { batchNumber: 'MTX-2025-X1', quantity: 25, expiryDate: new Date('2027-07-31'), purchasePrice: 40 },
  },

  // ╔═══════════════════════════════════════════════════════╗
  // ║  CAPSULES (from clinic photo + common prescriptions)  ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'Duttos 0.5mg',
    genericName: 'Dutasteride Soft Gelatin Capsules IP 0.5mg',
    description: 'Dr. Reddy\'s dutasteride soft gelatin capsules. Dual 5-alpha reductase inhibitor (Type I & II) for advanced androgenetic alopecia. More potent DHT suppression than finasteride. Take 1 capsule daily.',
    category: 'Capsule',
    manufacturer: "Dr. Reddy's Laboratories",
    imageUrl: '/api/uploads/public/duttos-capsules.jpg',
    sellingPrice: 240,
    costPrice: 155,
    reorderLevel: 20,
    unit: 'Strip (10 capsules)',
    batch: { batchNumber: 'DTS-2025-G2', quantity: 40, expiryDate: new Date('2027-09-30'), purchasePrice: 155 },
  },
  {
    name: 'Calcitriol + Calcium + Zinc',
    genericName: 'Calcitriol 0.25mcg + Calcium Carbonate 500mg + Zinc 7.5mg',
    description: 'Triple combination supplement for Vitamin D deficiency-related hair loss. Supports bone health and hair follicle cycling. Take 1 capsule daily after meals.',
    category: 'Capsule',
    manufacturer: 'Macleods Pharmaceuticals',
    sellingPrice: 180,
    costPrice: 100,
    reorderLevel: 20,
    unit: 'Strip (15 capsules)',
    batch: { batchNumber: 'CCZ-2025-L1', quantity: 45, expiryDate: new Date('2027-11-30'), purchasePrice: 100 },
  },
  {
    name: 'Omega-3 Fatty Acid Capsules',
    genericName: 'EPA 180mg + DHA 120mg Omega-3 Fish Oil',
    description: 'Essential fatty acid supplement supporting scalp health and hair density. Anti-inflammatory properties reduce follicular inflammation. Take 1 capsule twice daily with meals.',
    category: 'Capsule',
    manufacturer: 'Abbott India',
    sellingPrice: 310,
    costPrice: 190,
    reorderLevel: 20,
    unit: 'Bottle (30 capsules)',
    batch: { batchNumber: 'OMG-2025-Y1', quantity: 35, expiryDate: new Date('2028-04-30'), purchasePrice: 190 },
  },

  // ╔═══════════════════════════════════════════════════════╗
  // ║  ADDITIONAL SERUMS & SOLUTIONS (from web research)    ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'Mintop Forte 5% Solution',
    genericName: 'Minoxidil Topical Solution USP 5%',
    description: 'Dr. Reddy\'s flagship minoxidil solution for androgenetic alopecia. Clinically proven to regrow hair in 80% of men. Apply 1ml twice daily to affected areas. Results visible in 3-6 months.',
    category: 'Solution',
    manufacturer: "Dr. Reddy's Laboratories",
    sellingPrice: 680,
    costPrice: 420,
    reorderLevel: 15,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'MTP-2025-Z1', quantity: 30, expiryDate: new Date('2027-12-31'), purchasePrice: 420 },
  },
  {
    name: 'Tugain 5% Solution',
    genericName: 'Minoxidil Topical Solution USP 5% w/v',
    description: 'Cipla\'s widely prescribed minoxidil solution for male pattern baldness. Stimulates hair follicles and prolongs the anagen phase. Apply twice daily to dry scalp with dropper.',
    category: 'Solution',
    manufacturer: 'Cipla Ltd.',
    sellingPrice: 650,
    costPrice: 400,
    reorderLevel: 12,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'TGN-2025-AA', quantity: 25, expiryDate: new Date('2027-10-31'), purchasePrice: 400 },
  },
  {
    name: 'Morr 5% Solution',
    genericName: 'Minoxidil Topical Solution 5%',
    description: 'Intas Pharmaceuticals minoxidil solution for hereditary hair loss. Vasodilator that improves blood flow to hair follicles. With precision dropper for targeted application.',
    category: 'Solution',
    manufacturer: 'Intas Pharmaceuticals Ltd.',
    sellingPrice: 620,
    costPrice: 380,
    reorderLevel: 12,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'MRR-2025-AB', quantity: 22, expiryDate: new Date('2027-08-31'), purchasePrice: 380 },
  },
  {
    name: 'Minoxidil 2% Solution (Women)',
    genericName: 'Minoxidil Topical Solution USP 2% w/v',
    description: 'Lower-concentration minoxidil specifically for female pattern hair loss (FPHL). 2% concentration minimizes facial hair side effects while promoting scalp hair growth. Apply once daily.',
    category: 'Solution',
    manufacturer: 'Torrent Pharmaceuticals',
    sellingPrice: 620,
    costPrice: 380,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'MNX2-2025-Q1', quantity: 20, expiryDate: new Date('2027-07-31'), purchasePrice: 380 },
  },
  {
    name: 'Hair4U 5% Solution',
    genericName: 'Minoxidil Topical Solution USP 5%',
    description: 'Glenmark\'s minoxidil solution for vertex and mid-scalp hair thinning. Easy-to-use spray applicator for uniform coverage. Contains excipients for reduced scalp irritation.',
    category: 'Solution',
    manufacturer: 'Glenmark Pharmaceuticals',
    sellingPrice: 720,
    costPrice: 440,
    reorderLevel: 10,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'H4U-2025-AC', quantity: 20, expiryDate: new Date('2028-01-31'), purchasePrice: 440 },
  },

  // ╔═══════════════════════════════════════════════════════╗
  // ║  LOTIONS & OINTMENTS                                  ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'Clobetasol Propionate 0.05% Lotion',
    genericName: 'Clobetasol Propionate Topical Lotion USP',
    description: 'Super-potent topical corticosteroid lotion for alopecia areata patches, psoriasis, and severe dermatitis. Apply thin layer to affected area twice daily for 2-4 weeks max. Avoid face/groin.',
    category: 'Lotion',
    manufacturer: 'Glenmark Pharmaceuticals',
    sellingPrice: 290,
    costPrice: 170,
    reorderLevel: 10,
    unit: 'Bottle (30ml)',
    batch: { batchNumber: 'CLB-2025-M1', quantity: 20, expiryDate: new Date('2027-05-31'), purchasePrice: 170 },
  },
  {
    name: 'Tacrolimus Ointment 0.1%',
    genericName: 'Tacrolimus Monohydrate 0.1% Ointment',
    description: 'Calcineurin inhibitor immunomodulator for atopic dermatitis, vitiligo, and facial eczema. Steroid-free anti-inflammatory alternative. Apply thin layer twice daily. Avoid UV exposure.',
    category: 'Ointment',
    manufacturer: 'Sun Dermatics',
    sellingPrice: 490,
    costPrice: 310,
    reorderLevel: 10,
    unit: 'Tube (20g)',
    batch: { batchNumber: 'TAC-2025-N1', quantity: 15, expiryDate: new Date('2027-08-31'), purchasePrice: 310 },
  },
  {
    name: 'Betamethasone Dipropionate 0.05% Lotion',
    genericName: 'Betamethasone Dipropionate Topical Lotion',
    description: 'Potent corticosteroid lotion for inflammatory scalp conditions, psoriasis, and dermatitis. Easy to apply on hairy areas. Apply once or twice daily as directed. Avoid prolonged use.',
    category: 'Lotion',
    manufacturer: 'Cadila Healthcare (Zydus)',
    sellingPrice: 185,
    costPrice: 105,
    reorderLevel: 12,
    unit: 'Bottle (30ml)',
    batch: { batchNumber: 'BMD-2025-AD', quantity: 25, expiryDate: new Date('2027-11-30'), purchasePrice: 105 },
  },
  {
    name: 'Tretinoin Cream 0.025%',
    genericName: 'Tretinoin (All-Trans Retinoic Acid) Cream 0.025%',
    description: 'Topical retinoid for acne vulgaris, photoaging, and post-inflammatory hyperpigmentation. Increases cell turnover and unclogs pores. Apply pea-sized amount at night. Use sunscreen during day.',
    category: 'Ointment',
    manufacturer: 'Johnson & Johnson (Retino-A)',
    sellingPrice: 230,
    costPrice: 140,
    reorderLevel: 15,
    unit: 'Tube (20g)',
    batch: { batchNumber: 'TRT-2025-AE', quantity: 30, expiryDate: new Date('2027-06-30'), purchasePrice: 140 },
  },
  {
    name: 'Adapalene Gel 0.1% (Deriva)',
    genericName: 'Adapalene Topical Gel 0.1%',
    description: 'Third-generation retinoid gel for comedonal and inflammatory acne. Better tolerated than tretinoin with fewer irritation side effects. Apply once daily at bedtime to clean dry skin.',
    category: 'Ointment',
    manufacturer: 'Galderma India',
    sellingPrice: 270,
    costPrice: 165,
    reorderLevel: 15,
    unit: 'Tube (15g)',
    batch: { batchNumber: 'ADP-2025-AF', quantity: 28, expiryDate: new Date('2028-02-28'), purchasePrice: 165 },
  },
  {
    name: 'Clindamycin + Adapalene Gel (Deriva CMS)',
    genericName: 'Clindamycin 1% + Adapalene 0.1% Gel',
    description: 'Combination antibiotic + retinoid gel for moderate inflammatory acne. Clindamycin reduces bacteria while adapalene normalizes skin cell turnover. Apply once daily at bedtime.',
    category: 'Ointment',
    manufacturer: 'Galderma India',
    sellingPrice: 340,
    costPrice: 210,
    reorderLevel: 12,
    unit: 'Tube (15g)',
    batch: { batchNumber: 'DCA-2025-AG', quantity: 22, expiryDate: new Date('2027-09-30'), purchasePrice: 210 },
  },
  {
    name: 'Calcipotriol Ointment 0.005%',
    genericName: 'Calcipotriol (Calcipotriene) 50mcg/g Ointment',
    description: 'Vitamin D3 analog for chronic plaque psoriasis. Regulates keratinocyte proliferation and differentiation. Apply thin layer to psoriatic plaques twice daily. Max 100g per week.',
    category: 'Ointment',
    manufacturer: 'Glenmark Pharmaceuticals',
    sellingPrice: 380,
    costPrice: 235,
    reorderLevel: 8,
    unit: 'Tube (30g)',
    batch: { batchNumber: 'CAL-2025-AH', quantity: 15, expiryDate: new Date('2027-07-31'), purchasePrice: 235 },
  },
  {
    name: 'Mupirocin Ointment 2%',
    genericName: 'Mupirocin 2% Topical Ointment',
    description: 'Topical antibiotic for impetigo, folliculitis, and secondary skin infections. Effective against Staphylococcus aureus and Streptococcus. Apply to affected area 3 times daily for 5-10 days.',
    category: 'Ointment',
    manufacturer: 'GlaxoSmithKline (GSK)',
    sellingPrice: 165,
    costPrice: 95,
    reorderLevel: 15,
    unit: 'Tube (5g)',
    batch: { batchNumber: 'MUP-2025-AI', quantity: 35, expiryDate: new Date('2028-03-31'), purchasePrice: 95 },
  },

  // ╔═══════════════════════════════════════════════════════╗
  // ║  OILS                                                 ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'Follihair Oil',
    genericName: 'Biotin + Argan Oil + Vitamin E Hair Growth Oil',
    description: 'Dermatologist-recommended hair growth oil with biotin, redensyl, argan oil, and vitamin E. Nourishes scalp and strengthens hair from root. Massage into scalp 2-3 times per week.',
    category: 'Oil',
    manufacturer: 'Abbott India',
    sellingPrice: 420,
    costPrice: 260,
    reorderLevel: 15,
    unit: 'Bottle (100ml)',
    batch: { batchNumber: 'FLH-2025-AJ', quantity: 30, expiryDate: new Date('2028-05-31'), purchasePrice: 260 },
  },
  {
    name: 'Rogaine Minoxidil 2% Oil',
    genericName: 'Minoxidil 2% w/v in Oil Base',
    description: 'Oil-based minoxidil formulation for patients who find alcohol-based solutions drying. Easier to apply and less scalp irritation. For female pattern hair loss. Apply once daily at bedtime.',
    category: 'Oil',
    manufacturer: 'Johnson & Johnson',
    sellingPrice: 750,
    costPrice: 460,
    reorderLevel: 8,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'RGN-2025-AK', quantity: 15, expiryDate: new Date('2027-09-30'), purchasePrice: 460 },
  },

  // ╔═══════════════════════════════════════════════════════╗
  // ║  NEAR-EXPIRY BATCHES (for testing expiry alerts UI)   ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'Minoxidil 10% Solution (High Strength)',
    genericName: 'Minoxidil Topical Solution 10% w/v',
    description: 'High-concentration minoxidil for treatment-resistant androgenetic alopecia. Prescription only — used under strict dermatologist supervision due to increased side effect risk.',
    category: 'Solution',
    manufacturer: 'Mankind Pharma',
    sellingPrice: 950,
    costPrice: 600,
    reorderLevel: 5,
    unit: 'Bottle (60ml)',
    batch: { batchNumber: 'M10-2025-AL', quantity: 10, expiryDate: new Date('2026-12-15'), purchasePrice: 600 },
  },
  {
    name: 'Fluconazole 150mg',
    genericName: 'Fluconazole Tablets IP 150mg',
    description: 'Systemic antifungal for severe seborrheic dermatitis, tinea capitis, and fungal scalp infections unresponsive to topical therapy. Take single dose or weekly as directed.',
    category: 'Tablet',
    manufacturer: 'Pfizer India',
    sellingPrice: 95,
    costPrice: 50,
    reorderLevel: 15,
    unit: 'Strip (4 tabs)',
    batch: { batchNumber: 'FLU-2025-AM', quantity: 20, expiryDate: new Date('2026-11-30'), purchasePrice: 50 },
  },
  {
    name: 'Cyclosporine 50mg',
    genericName: 'Cyclosporine Soft Gelatin Capsules 50mg',
    description: 'Potent immunosuppressant for severe alopecia areata totalis/universalis and recalcitrant psoriasis. Requires regular monitoring of kidney function, blood pressure, and drug levels.',
    category: 'Capsule',
    manufacturer: 'Panacea Biotec',
    sellingPrice: 450,
    costPrice: 290,
    reorderLevel: 5,
    unit: 'Strip (5 capsules)',
    batch: { batchNumber: 'CYC-2025-AN', quantity: 12, expiryDate: new Date('2026-10-31'), purchasePrice: 290 },
  },

  // ╔═══════════════════════════════════════════════════════╗
  // ║  ADDITIONAL SUPPLEMENTS & SPECIALTY                   ║
  // ╚═══════════════════════════════════════════════════════╝

  {
    name: 'Follihair Tablet',
    genericName: 'Biotin + Amino Acids + Minerals + Vitamins',
    description: 'Comprehensive hair supplement with biotin, zinc, iron, selenium, folic acid, amino acids (L-Cysteine, L-Methionine), and vitamins. Supports healthy hair growth cycle. Take 1 tablet daily.',
    category: 'Tablet',
    manufacturer: 'Abbott India',
    sellingPrice: 520,
    costPrice: 330,
    reorderLevel: 20,
    unit: 'Strip (15 tabs)',
    batch: { batchNumber: 'FHT-2025-AO', quantity: 40, expiryDate: new Date('2028-01-31'), purchasePrice: 330 },
  },
  {
    name: 'Deriphyllin Retard 150mg',
    genericName: 'Etofylline + Theophylline Sustained Release',
    description: 'Vasodilator combination sometimes used off-label in trichology for improving scalp blood flow. Etofylline 231mg + Theophylline 69mg. Take 1 tablet twice daily after meals.',
    category: 'Tablet',
    manufacturer: 'Zydus Cadila',
    sellingPrice: 65,
    costPrice: 38,
    reorderLevel: 20,
    unit: 'Strip (15 tabs)',
    batch: { batchNumber: 'DPR-2025-R1', quantity: 30, expiryDate: new Date('2027-09-30'), purchasePrice: 38 },
  },
  {
    name: 'Zinc Acetate 50mg',
    genericName: 'Zinc Acetate Tablets 50mg (Elemental Zinc ~15mg)',
    description: 'Zinc supplementation for telogen effluvium and alopecia areata. Zinc deficiency is linked to hair shedding. Supports immune function and wound healing. Take 1 tablet daily with meals.',
    category: 'Tablet',
    manufacturer: 'Macleods Pharmaceuticals',
    sellingPrice: 95,
    costPrice: 55,
    reorderLevel: 25,
    unit: 'Strip (10 tabs)',
    batch: { batchNumber: 'ZNC-2025-AP', quantity: 50, expiryDate: new Date('2028-06-30'), purchasePrice: 55 },
  },
  {
    name: 'Minoxidil 5% Foam (Mintop)',
    genericName: 'Minoxidil 5% Topical Foam',
    description: 'Foam formulation of minoxidil 5% by Dr. Reddy\'s. Propylene glycol-free — ideal for patients with sensitive scalps or contact allergies. Quick-drying, no dripping. Apply once daily.',
    category: 'Serum',
    manufacturer: "Dr. Reddy's Laboratories",
    sellingPrice: 1100,
    costPrice: 720,
    reorderLevel: 8,
    unit: 'Can (60g)',
    batch: { batchNumber: 'MTF-2025-AQ', quantity: 15, expiryDate: new Date('2027-11-30'), purchasePrice: 720 },
  },
  {
    name: 'Anthralin Cream 1%',
    genericName: 'Dithranol (Anthralin) 1% Cream',
    description: 'Topical treatment for psoriasis and alopecia areata. Short-contact therapy: apply for 20-30 minutes then wash off. Causes skin staining — use gloves. Start with low concentration.',
    category: 'Ointment',
    manufacturer: 'Stiefel (GSK)',
    sellingPrice: 340,
    costPrice: 200,
    reorderLevel: 8,
    unit: 'Tube (50g)',
    batch: { batchNumber: 'ANT-2025-AR', quantity: 12, expiryDate: new Date('2027-06-30'), purchasePrice: 200 },
  },
  {
    name: 'Spironolactone 25mg',
    genericName: 'Spironolactone Tablets IP 25mg',
    description: 'Anti-androgen diuretic used off-label for female pattern hair loss and hormonal acne. Blocks androgen receptors and reduces sebum. Take 1-2 tablets daily. Not for use in men. Monitor potassium.',
    category: 'Tablet',
    manufacturer: 'RPG Life Sciences',
    sellingPrice: 55,
    costPrice: 30,
    reorderLevel: 20,
    unit: 'Strip (15 tabs)',
    batch: { batchNumber: 'SPR-2025-AS', quantity: 45, expiryDate: new Date('2028-04-30'), purchasePrice: 30 },
  },
];

// ─────────────────────────────────────────────────────────
// SEED RUNNER
// ─────────────────────────────────────────────────────────

async function seedMedicines() {
  const doReset = process.argv.includes('--reset');

  console.log('💊 Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI);

  const defaultHospital = await Hospital.findOne({});
  const hospitalId = defaultHospital?._id;
  if (hospitalId) {
    console.log(`🏥 Associating catalogue with hospital: ${defaultHospital.name} (${hospitalId})`);
  }

  if (doReset) {
    await Medicine.deleteMany({});
    console.log('🧹 Cleared all existing medicines.');
  }

  let added = 0;
  let skipped = 0;

  const MEDICINE_IMAGE_MAP: Record<string, string> = {
    'Kera-FM 5%': '/api/uploads/public/kera-fm-5.jpg',
    'Androanagen Solution 5%': '/api/uploads/public/androanagen-5.jpg',
    'Inbilt-F': '/api/uploads/public/inbilt-f.jpg',
    'Strandz 5% Liposomal': '/api/uploads/public/strandz-5.jpg',
    'Strandz F (Minoxidil 5% + Finasteride 0.1%)': '/api/uploads/public/strandz-f.jpg',
    'Mintop Forte 5% Solution': '/api/uploads/public/mintop-forte-5.jpg',
    'Minoxidil 5% Foam (Mintop)': '/api/uploads/public/mintop-forte-5.jpg',
    'Minoxidil 10% Solution (High Strength)': '/api/uploads/public/mintop-forte-5.jpg',
    'Minoxidil 2% Solution (Women)': '/api/uploads/public/mintop-forte-5.jpg',
    'Tugain 5% Solution': '/api/uploads/public/tugain-solution.jpg',
    'Hair4U 5% Solution': '/api/uploads/public/tugain-solution.jpg',
    'Morr 5% Solution': '/api/uploads/public/tugain-solution.jpg',
    'CosmoQ Shampoo': '/api/uploads/public/cosmoq-shampoo.jpg',
    'Ketoconazole Shampoo 2% (Ketocip)': '/api/uploads/public/ketocip-shampoo.jpg',
    'Scalpe Plus Shampoo': '/api/uploads/public/scalpe-plus-shampoo.jpg',
    'Sebowash Shampoo': '/api/uploads/public/ketocip-shampoo.jpg',
    'Zinc Pyrithione Shampoo 1%': '/api/uploads/public/scalpe-plus-shampoo.jpg',
    'Duman 0.5mg': '/api/uploads/public/duman-dutasteride.jpg',
    'Finasteride 1mg (Finpecia)': '/api/uploads/public/finpecia-1mg.jpg',
    'Finax 1mg': '/api/uploads/public/finpecia-1mg.jpg',
    'Prednisolone 5mg': '/api/uploads/public/finpecia-1mg.jpg',
    'Deriphyllin Retard 150mg': '/api/uploads/public/finpecia-1mg.jpg',
    'Fluconazole 150mg': '/api/uploads/public/finpecia-1mg.jpg',
    'Hydroxychloroquine 200mg': '/api/uploads/public/finpecia-1mg.jpg',
    'Methotrexate 7.5mg': '/api/uploads/public/finpecia-1mg.jpg',
    'Spironolactone 25mg': '/api/uploads/public/finpecia-1mg.jpg',
    'Biotin 10000mcg': '/api/uploads/public/biotin-10000.jpg',
    'Zinc Acetate 50mg': '/api/uploads/public/biotin-10000.jpg',
    'Follihair Tablet': '/api/uploads/public/follihair-tablet.jpg',
    'Iron & Folic Acid': '/api/uploads/public/follihair-tablet.jpg',
    'Duttos 0.5mg': '/api/uploads/public/duttos-capsules.jpg',
    'Doxycycline 100mg': '/api/uploads/public/doxycycline-100.jpg',
    'Isotretinoin 20mg (Tretiva)': '/api/uploads/public/tretiva-capsules.jpg',
    'Cyclosporine 50mg': '/api/uploads/public/tretiva-capsules.jpg',
    'Calcitriol + Calcium + Zinc': '/api/uploads/public/duttos-capsules.jpg',
    'Omega-3 Fatty Acid Capsules': '/api/uploads/public/duttos-capsules.jpg',
    'Clobetasol Propionate 0.05% Lotion': '/api/uploads/public/clobetasol-lotion.jpg',
    'Betamethasone Dipropionate 0.05% Lotion': '/api/uploads/public/clobetasol-lotion.jpg',
    'Follihair Oil': '/api/uploads/public/follihair-oil.jpg',
    'Rogaine Minoxidil 2% Oil': '/api/uploads/public/follihair-oil.jpg',
    'Adapalene Gel 0.1% (Deriva)': '/api/uploads/public/adapalene-gel.jpg',
    'Clindamycin + Adapalene Gel (Deriva CMS)': '/api/uploads/public/adapalene-gel.jpg',
    'Tretinoin Cream 0.025%': '/api/uploads/public/adapalene-gel.jpg',
    'Anthralin Cream 1%': '/api/uploads/public/derma-tacrolimus.jpg',
    'Calcipotriol Ointment 0.005%': '/api/uploads/public/derma-tacrolimus.jpg',
    'Mupirocin Ointment 2%': '/api/uploads/public/derma-tacrolimus.jpg',
    'Tacrolimus Ointment 0.1%': '/api/uploads/public/derma-tacrolimus.jpg',
  };

  for (const med of MEDICINES) {
    // Check if medicine already exists (by exact name)
    const exists = await Medicine.findOne({ name: med.name });
    if (exists) {
      skipped++;
      console.log(`   ⏭️  Skip (exists): ${med.name}`);
      continue;
    }

    const finalImage = med.imageUrl || MEDICINE_IMAGE_MAP[med.name] || undefined;

    await Medicine.create({
      hospitalId,
      name: med.name,
      genericName: med.genericName,
      description: med.description,
      category: med.category,
      manufacturer: med.manufacturer,
      imageUrl: finalImage,
      sellingPrice: med.sellingPrice,
      costPrice: med.costPrice,
      reorderLevel: med.reorderLevel,
      unit: med.unit,
      batches: [
        {
          batchNumber: med.batch.batchNumber,
          quantity: med.batch.quantity,
          expiryDate: med.batch.expiryDate,
          purchasePrice: med.batch.purchasePrice,
          addedAt: new Date(),
        },
      ],
      isActive: true,
    });
    added++;
    console.log(`   ✅ Added: ${med.name} (${med.category}) — ₹${med.sellingPrice}`);
  }

  console.log('');
  console.log(`📊 Seed summary: ${added} added, ${skipped} skipped (already existed)`);
  console.log(`📦 Total medicines in catalogue: ${await Medicine.countDocuments()}`);

  await mongoose.disconnect();
  console.log('✅ Medicine seed complete!');
}

seedMedicines().catch((err) => {
  console.error('❌ Medicine seeding failed:', err);
  process.exit(1);
});
