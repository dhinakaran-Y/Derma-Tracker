import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { Hospital } from '../models/Hospital';

/**
 * Ensures required demo accounts (Admin, Doctor, Receptionist, MedicationGiver, StockManager, and Patient)
 * exist and have their credentials synced to the requested demo values.
 */
export async function ensureDemoAccounts(): Promise<void> {
  try {
    const flagshipHospital = await Hospital.findOne({
      $or: [
        { shortName: { $regex: /aruna/i } },
        { name: { $regex: /aruna/i } },
        { email: 'aruna_hair_care@gmail.com' },
      ],
      status: 'Active',
    }) || await Hospital.findOne({ status: 'Active' });
    const hospitalId = flagshipHospital?._id;

    const demoStaff = [
      {
        email: 'aruna_hair_care@gmail.com',
        username: 'aruna_hair_care',
        fullName: 'Aruna Admin',
        role: 'Admin' as const,
        password: 'pass123',
      },
      {
        email: 'aruna.vimal@gmail.com',
        username: 'vimal',
        fullName: 'vimal',
        role: 'Doctor' as const,
        password: 'pass123',
        specialization: 'Dermatology & Trichology',
      },
      {
        email: 'aruna.sharmi@gmail.com',
        username: 'sharmi',
        fullName: 'sharmila',
        role: 'Receptionist' as const,
        password: 'pass123',
      },
      {
        email: 'aruna.kavitha@gmail.com',
        username: 'kavitha',
        fullName: 'aruna.kavitha',
        role: 'MedicationGiver' as const,
        password: 'pass123',
      },
      {
        email: 'aruna.yakavi@gmail.com',
        username: 'yakavi',
        fullName: 'aruna.yakavi',
        role: 'StockManager' as const,
        password: 'pass123',
      },
    ];

    for (const staff of demoStaff) {
      // Find specifically by email or username, prioritizing the Aruna hospital
      let user = await User.findOne({
        $or: [
          { email: staff.email.toLowerCase() },
          { username: staff.username.toLowerCase() },
        ],
        ...(hospitalId ? { hospitalId } : {}),
      });

      if (!user) {
        user = new User({
          username: staff.username,
          email: staff.email,
          fullName: staff.fullName,
          role: staff.role,
          passwordHash: staff.password,
          status: 'Active',
          hospitalId,
          specialization: (staff as any).specialization,
          isAvailable: true,
          isOnDuty: true,
        });
        await user.save();
        console.log(`✅ [DEMO-SYNC] Created ${staff.role} demo account: ${staff.email}`);
      } else {
        let changed = false;
        if (user.email !== staff.email) {
          user.email = staff.email;
          changed = true;
        }
        if (hospitalId && (!user.hospitalId || user.hospitalId.toString() !== hospitalId.toString())) {
          if (user.email === staff.email) {
            user.hospitalId = hospitalId;
            changed = true;
          }
        }
        if (user.status !== 'Active') {
          user.status = 'Active';
          changed = true;
        }
        // Verify password is working, otherwise reset to default
        const passwordMatches = await user.comparePassword(staff.password).catch(() => false);
        if (!passwordMatches) {
          user.passwordHash = staff.password;
          changed = true;
        }
        if (changed) {
          await user.save();
          console.log(`🔄 [DEMO-SYNC] Updated ${staff.role} demo account: ${staff.email}`);
        }
      }
    }

    // Ensure Demo Patient (phone: 0123456789)
    let patient = await Patient.findOne({ phone: '0123456789' });
    if (!patient) {
      // Check if existing patient PAT-000001 or 9876543210 can be migrated
      patient = await Patient.findOne({ phone: '9876543210' });
      if (patient) {
        patient.phone = '0123456789';
        patient.isActive = true;
        await patient.save();
        console.log(`🔄 [DEMO-SYNC] Migrated demo patient to phone: 0123456789`);
      } else {
        await Patient.create({
          patientId: 'PAT-000001',
          name: 'Aarav Mehta',
          phone: '0123456789',
          email: 'aarav.mehta@gmail.com',
          location: 'Chennai Central',
          gender: 'Male',
          isActive: true,
        });
        console.log(`✅ [DEMO-SYNC] Created demo patient with phone: 0123456789`);
      }
    }
  } catch (err: any) {
    console.warn(`⚠️ [DEMO-SYNC] Note on syncing demo accounts:`, err.message);
  }
}
