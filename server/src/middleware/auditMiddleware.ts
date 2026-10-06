import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { AuditLog } from '../models/AuditLog';

function generateDefaultDescription(method: string, url: string, resource: string, details?: any): string {
  // Staff & Admin
  if (url.includes('/admin/staff')) {
    if (method === 'POST') return `Created new staff account: ${details?.fullName || details?.username || 'Staff'} (${details?.role || 'Staff'})`;
    if (method === 'DELETE') return `Removed staff member account`;
    if (url.includes('/status')) return `${details?.status === 'Active' ? 'Activated' : 'Suspended'} staff account`;
    if (url.includes('/password')) return `Updated staff login password`;
    if (method === 'PATCH') return `Updated staff details: ${details?.fullName || 'Staff'}`;
  }
  if (url.includes('/admin/settings')) return 'Updated clinic configuration & hospitality settings';
  if (url.includes('/admin/gst-rules')) {
    if (method === 'POST') return `Created GST tax rule: ${details?.itemType || 'Service'} (${details?.gstRate ?? 0}%)`;
    if (method === 'PATCH') return `Updated GST tax rule: ${details?.itemType || 'Service'} (${details?.gstRate ?? 0}%)`;
    if (method === 'DELETE') return `Removed GST tax rule`;
  }

  // Patients & Reception
  if (url.includes('/receptionist/patients')) {
    if (method === 'POST') return `Registered new patient: ${details?.name || 'Patient'}${details?.phone ? ` (${details.phone})` : ''}`;
    if (method === 'PATCH') return `Updated patient profile: ${details?.name || 'Patient'}`;
  }
  if (url.includes('/receptionist/check-in')) {
    return `Checked in patient for consultation`;
  }

  // Doctors & Clinical Consultations
  if (url.includes('/doctor/visits')) {
    if (url.includes('/start')) return `Consultation started / ongoing with patient`;
    if (url.includes('/images')) return `Uploaded scalp clinical examination image`;
    if (details?.status === 'Completed') return `Consultation completed for patient`;
    if (details?.prescriptions) return `Updated prescriptions & clinical notes`;
    return `Updated patient clinical consultation notes`;
  }
  if (url.includes('/doctor/duty-status')) {
    return details?.isOnDuty ? 'Doctor clocked in on-duty for consultations' : 'Doctor clocked off-duty';
  }

  // Billing
  if (url.includes('/billing/invoices')) {
    if (url.includes('/payments')) return `Recorded payment of ₹${details?.amount || 0}${details?.mode ? ` via ${details.mode}` : ''} for invoice`;
    if (method === 'POST') return `Generated invoice ${details?.invoiceNumber ? `#${details.invoiceNumber} ` : ''}for ₹${details?.grandTotal || details?.subtotal || 0}`;
  }

  // Pharmacy & Stock
  if (url.includes('/pharmacy/dispense')) return `Dispensed medication: ${details?.medicineName || 'Prescription'}`;
  if (url.includes('/stock/medicines')) {
    if (method === 'POST') return `Added new pharmacy medicine: ${details?.name || 'Item'}`;
    if (method === 'PATCH') return `Updated stock details for ${details?.name || 'Item'}`;
  }

  // Appointments
  if (url.includes('/appointments')) {
    if (method === 'POST') return `Booked new patient appointment`;
    if (method === 'PATCH') return `Updated appointment status: ${details?.status || 'Updated'}`;
  }

  // Generic fallback
  const cleanResource = resource ? resource.charAt(0).toUpperCase() + resource.slice(1) : 'System';
  if (method === 'POST') return `Created new ${cleanResource} record`;
  if (method === 'PATCH' || method === 'PUT') return `Updated ${cleanResource} record`;
  if (method === 'DELETE') return `Removed ${cleanResource} record`;
  return `Updated ${cleanResource}`;
}

function isSensitiveMedicalRead(method: string, url: string): boolean {
  if (method !== 'GET') return false;
  // Clinical visits, patient charts, medical histories, scalp photos, patient records
  return (
    url.includes('/doctor/visits') ||
    url.includes('/doctor/patients') ||
    url.includes('/receptionist/patients') ||
    url.includes('/client/progress') ||
    url.includes('/client/records') ||
    url.includes('/api/uploads/') ||
    url.includes('/uploads/')
  );
}

function generateReadDescription(url: string, resource: string): string {
  if (url.includes('/doctor/patients/') && url.includes('/history')) {
    return 'Viewed patient clinical chart and consultation history';
  }
  if (url.includes('/doctor/visits')) {
    return 'Viewed clinical consultation visit details and medical notes';
  }
  if (url.includes('/receptionist/patients/') && url.includes('/visits')) {
    return 'Viewed patient past clinical visits';
  }
  if (url.includes('/receptionist/patients/')) {
    return 'Viewed confidential patient demographic & medical profile';
  }
  if (url.includes('/client/progress')) {
    return 'Patient accessed hair density and clinical progress photos';
  }
  if (url.includes('/client/records')) {
    return 'Patient accessed clinical consultation records and prescriptions';
  }
  if (url.includes('/uploads/')) {
    return 'Accessed sensitive clinical medical photo / attachment';
  }
  return `Viewed sensitive medical records (${resource})`;
}

/**
 * Logs mutations (POST, PUT, PATCH, DELETE) and sensitive medical record queries (GET on visits/charts)
 * to AuditLog after the response is sent.
 */
export function auditMiddleware(resource: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isSensitiveRead = isSensitiveMedicalRead(req.method, req.originalUrl);

    // Only log mutations and sensitive clinical reads
    if (!isMutation && !isSensitiveRead) {
      return next();
    }

    // Listen for response finish to log after the fact
    res.on('finish', () => {
      if (res.locals.skipAudit) return;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const action = `${req.method} ${req.originalUrl}`;
        const sanitizedDetails = isMutation
          ? (res.locals.auditDetails || (req.method !== 'DELETE' && req.body && typeof req.body === 'object' ? { ...req.body } : undefined))
          : { queryParams: req.query, routeParams: req.params };

        if (sanitizedDetails) {
          delete (sanitizedDetails as any).password;
          delete (sanitizedDetails as any).passwordHash;
          delete (sanitizedDetails as any).token;
        }

        const description =
          res.locals.auditDescription ||
          (isSensitiveRead
            ? generateReadDescription(req.originalUrl, resource)
            : generateDefaultDescription(req.method, req.originalUrl, resource, sanitizedDetails));

        const actorName =
          res.locals.actorName ||
          req.user?.fullName ||
          (req.user?.type === 'patient' ? 'Patient' : 'Authenticated User');

        AuditLog.create({
          hospitalId: req.user?.hospitalId,
          userId: req.user?.id,
          userRole: req.user?.role || req.user?.type || 'User',
          actorName,
          action,
          resource,
          resourceId: res.locals.resourceId || req.params.id || req.params.visitId || req.params.filename || req.params.ruleId,
          description,
          details: sanitizedDetails,
          ipAddress: req.ip || (req.socket ? req.socket.remoteAddress : undefined) || 'unknown',
        }).catch((err) => {
          console.error('Audit log failed:', err);
        });
      }
    });

    next();
  };
}

