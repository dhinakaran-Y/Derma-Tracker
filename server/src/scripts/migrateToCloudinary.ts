/**
 * Migration Script: Clone all existing local data in `server/uploads` to Cloudinary
 * and update MongoDB references.
 *
 * Usage:
 *   npx ts-node src/scripts/migrateToCloudinary.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { env } from '../config/env';
import * as cloudinaryService from '../services/cloudinaryService';
import { Visit } from '../models/Visit';
import { Hospital } from '../models/Hospital';
import { Medicine } from '../models/Medicine';

// Detect uploads directory (whether run from server root or repo root)
const possibleUploadDirs = [
  path.join(process.cwd(), 'uploads'),
  path.join(process.cwd(), 'server', 'uploads'),
  path.join(__dirname, '../../uploads'),
];

let UPLOADS_DIR = possibleUploadDirs.find((d) => fs.existsSync(d) && fs.statSync(d).isDirectory()) || path.join(process.cwd(), 'uploads');

// Map of uploaded local filepath / filename to Cloudinary secure URL
const fileUrlMap = new Map<string, string>();

async function uploadFileToCloudinary(
  filePath: string,
  folder: string,
  publicId?: string
): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await cloudinaryService.uploadImage(buffer, path.basename(filePath), {
    folder,
    publicId,
    overwrite: true,
  });
  return result.secure_url;
}

/**
 * Recursively clone all files in the uploads folder to Cloudinary,
 * maintaining the hospital-wise folder hierarchy.
 */
async function cloneUploadsDirectory(): Promise<void> {
  console.log(`\n📂 Scanning uploads directory: ${UPLOADS_DIR}`);

  const hospitalsDir = path.join(UPLOADS_DIR, 'hospitals');
  if (!fs.existsSync(hospitalsDir)) {
    console.log('No hospitals directory found in uploads.');
    return;
  }

  const hospitals = fs.readdirSync(hospitalsDir);

  for (const hospName of hospitals) {
    const hospPath = path.join(hospitalsDir, hospName);
    if (!fs.statSync(hospPath).isDirectory()) continue;

    console.log(`\n🏥 Processing Hospital: "${hospName}"`);
    const baseHospFolder = cloudinaryService.buildHospitalFolder(hospName);

    // 1. Process logo and banner
    const hospEntries = fs.readdirSync(hospPath);
    for (const file of hospEntries) {
      const fullPath = path.join(hospPath, file);
      if (fs.statSync(fullPath).isFile()) {
        const lower = file.toLowerCase();
        let publicId: string | undefined;
        if (lower.startsWith('hospital-logo')) publicId = 'hospital-logo';
        else if (lower.startsWith('hospital-banner')) publicId = 'hospital-banner';

        if (publicId) {
          try {
            console.log(`  ⬆️  Uploading ${publicId} (${file})...`);
            const url = await uploadFileToCloudinary(fullPath, baseHospFolder, publicId);
            fileUrlMap.set(file, url);
            fileUrlMap.set(fullPath, url);
            console.log(`  ✅ ${file} → ${url}`);
          } catch (err: any) {
            console.error(`  ❌ Failed to upload ${file}:`, err.message);
          }
        }
      }
    }

    // 2. Process medicines
    const medicinesDir = path.join(hospPath, 'medicines');
    if (fs.existsSync(medicinesDir) && fs.statSync(medicinesDir).isDirectory()) {
      const medFiles = fs.readdirSync(medicinesDir);
      const medFolder = cloudinaryService.buildMedicineFolder(hospName);

      for (const medFile of medFiles) {
        const fullPath = path.join(medicinesDir, medFile);
        if (!fs.statSync(fullPath).isFile()) continue;

        try {
          console.log(`  💊 Uploading medicine: ${medFile}...`);
          const url = await uploadFileToCloudinary(fullPath, medFolder);
          fileUrlMap.set(medFile, url);
          fileUrlMap.set(fullPath, url);
          console.log(`  ✅ ${medFile} → ${url}`);
        } catch (err: any) {
          console.error(`  ❌ Failed to upload medicine ${medFile}:`, err.message);
        }
      }
    }

    // 3. Process patients
    const patientsDir = path.join(hospPath, 'patients');
    if (fs.existsSync(patientsDir) && fs.statSync(patientsDir).isDirectory()) {
      const patientFolders = fs.readdirSync(patientsDir);

      for (const pFolder of patientFolders) {
        const pPath = path.join(patientsDir, pFolder);
        if (!fs.statSync(pPath).isDirectory()) continue;

        const scalpFolder = `derma-tracker/hospitals/${hospName}/patients/${pFolder}`;
        const photos = fs.readdirSync(pPath);

        for (const photo of photos) {
          const fullPath = path.join(pPath, photo);
          if (!fs.statSync(fullPath).isFile()) continue;

          try {
            console.log(`  📸 Uploading scalp photo: ${photo} (${pFolder})...`);
            const url = await uploadFileToCloudinary(fullPath, scalpFolder);
            fileUrlMap.set(photo, url);
            fileUrlMap.set(fullPath, url);
            console.log(`  ✅ ${photo} → ${url}`);
          } catch (err: any) {
            console.error(`  ❌ Failed to upload scalp photo ${photo}:`, err.message);
          }
        }
      }
    }
  }
}

/**
 * Synchronize MongoDB documents so that image references use the Cloudinary URLs.
 */
async function syncDatabase(): Promise<void> {
  console.log('\n🔄 Synchronizing MongoDB database records...');

  // 1. Update Hospital records (logoUrl, imageUrl)
  const hospitals = await Hospital.find({});
  for (const hosp of hospitals) {
    let updated = false;

    if (hosp.logoUrl && !hosp.logoUrl.startsWith('http')) {
      const filename = path.basename(hosp.logoUrl);
      const url = fileUrlMap.get(filename);
      if (url) {
        hosp.logoUrl = url;
        updated = true;
      }
    }

    if (hosp.imageUrl && !hosp.imageUrl.startsWith('http')) {
      const filename = path.basename(hosp.imageUrl);
      const url = fileUrlMap.get(filename);
      if (url) {
        hosp.imageUrl = url;
        updated = true;
      }
    }

    if (updated) {
      await hosp.save();
      console.log(`  ✅ Hospital branding updated: "${hosp.name}"`);
    }
  }

  // 2. Update Medicine records (imageUrl)
  const medicines = await Medicine.find({});
  for (const med of medicines) {
    if (med.imageUrl && !med.imageUrl.startsWith('http')) {
      const filename = path.basename(med.imageUrl);
      const url = fileUrlMap.get(filename);
      if (url) {
        med.imageUrl = url;
        await med.save();
        console.log(`  ✅ Medicine updated: "${med.name}"`);
      }
    }
  }

  // 3. Update Visit records (scalpImages)
  const visits = await Visit.find({ scalpImages: { $exists: true, $ne: [] } });
  for (const visit of visits) {
    let updated = false;
    const newImages = visit.scalpImages.map((img) => {
      if (img.startsWith('http')) return img;
      const filename = path.basename(img);
      const url = fileUrlMap.get(filename);
      if (url) {
        updated = true;
        return url;
      }
      return img;
    });

    if (updated) {
      visit.scalpImages = newImages;
      await visit.save();
      console.log(`  ✅ Visit scalp images updated: visit ID ${visit._id}`);
    }
  }
}

async function main() {
  if (!cloudinaryService.isEnabled()) {
    console.error('❌ Cloudinary is not enabled or credentials are missing/invalid in server/.env');
    console.error('Please verify CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
    process.exit(1);
  }

  console.log('🚀 Connecting to MongoDB...');
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  console.log('☁️  Starting cloning process to Cloudinary...\n');

  await cloneUploadsDirectory();
  await syncDatabase();

  console.log('\n🎉 All data cloned to Cloudinary and database references synchronized!');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('💥 Cloning process failed:', err);
  process.exit(1);
});
