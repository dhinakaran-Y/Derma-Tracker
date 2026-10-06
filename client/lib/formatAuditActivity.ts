/**
 * Utility to format raw audit logs into human-readable, executive sentences
 * suitable for clinic founders and hospital administrators.
 */

export interface AuditLogItem {
  _id?: string;
  createdAt: string | Date;
  userRole?: string;
  userId?: {
    _id?: string;
    fullName?: string;
    username?: string;
    role?: string;
  } | string;
  actorName?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  description?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export function getActorName(log: AuditLogItem): string {
  if (log.actorName && log.actorName.trim()) {
    return log.actorName;
  }

  if (log.userId && typeof log.userId === 'object') {
    if (log.userId.fullName && log.userId.fullName.trim()) {
      return log.userId.fullName;
    }
    if (log.userId.username && log.userId.username.trim()) {
      return log.userId.username;
    }
  }

  if (log.userRole) {
    switch (log.userRole.toLowerCase()) {
      case 'admin':
        return 'Admin';
      case 'doctor':
        return 'Doctor';
      case 'receptionist':
        return 'Reception Desk';
      case 'medicationgiver':
        return 'Pharmacy Staff';
      case 'stockmanager':
        return 'Inventory Manager';
      default:
        return log.userRole;
    }
  }

  return 'System';
}

export function formatLogTime(dateStr: string | Date): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export function formatLogDateTime(dateStr: string | Date): string {
  try {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return '';
  }
}

export function formatActivitySentence(log: AuditLogItem): string {
  // If a pre-generated executive description exists, use it directly
  if (log.description && log.description.trim()) {
    return log.description;
  }

  const action = (log.action || '').trim();
  const details = log.details || {};
  const [method, rawUrl] = action.split(' ');
  const url = rawUrl || action;

  // --- Staff & Administration ---
  if (url.includes('/admin/staff') || action.includes('/admin/staff')) {
    if (method === 'POST') {
      const name = details.fullName || details.username || 'Staff member';
      const role = details.role ? ` (${details.role})` : '';
      return `Created new staff account: ${name}${role}`;
    }
    if (method === 'DELETE') {
      return details.fullName
        ? `Removed staff member account: ${details.fullName}`
        : 'Removed staff member account';
    }
    if (url.includes('/status')) {
      const statusAction = details.status === 'Active' ? 'Activated' : 'Suspended';
      const name = details.fullName ? ` for ${details.fullName}` : '';
      return `${statusAction} staff account${name}`;
    }
    if (url.includes('/password')) {
      return details.fullName
        ? `Updated login password for ${details.fullName}`
        : 'Updated staff login password';
    }
    if (method === 'PATCH') {
      return details.fullName
        ? `Updated staff profile: ${details.fullName}`
        : 'Updated staff profile details';
    }
  }

  if (url.includes('/admin/settings') || action.includes('/admin/settings')) {
    return 'Updated clinic configuration & hospital settings';
  }

  if (url.includes('/admin/gst-rules') || action.includes('/admin/gst-rules')) {
    if (method === 'POST') {
      return `Configured GST tax rule: ${details.itemType || 'Service'} (${details.gstRate ?? 0}%)`;
    }
    if (method === 'PATCH') {
      return `Updated GST tax rate for ${details.itemType || 'item'} to ${details.gstRate ?? 0}%`;
    }
    if (method === 'DELETE') {
      return 'Removed GST tax rule';
    }
  }

  // --- Patients & Reception ---
  if (url.includes('/receptionist/patients') || action.includes('/receptionist/patients')) {
    if (method === 'POST') {
      const phone = details.phone ? ` (${details.phone})` : '';
      return `New patient registered: ${details.name || 'Patient'}${phone}`;
    }
    if (method === 'PATCH') {
      return `Updated patient profile: ${details.name || 'Patient'}`;
    }
  }

  if (url.includes('/receptionist/check-in') || action.includes('/receptionist/check-in')) {
    const patient = details.patientName ? `: ${details.patientName}` : '';
    const doctor = details.doctorName ? ` for Dr. ${details.doctorName}` : '';
    return `Checked in patient${patient}${doctor}`;
  }

  // --- Doctors & Consultations ---
  if (url.includes('/doctor/visits') || action.includes('/doctor/visits')) {
    const patientName = details.patientName ? ` with patient ${details.patientName}` : '';
    if (url.includes('/start')) {
      return `Consultation ongoing${patientName}`;
    }
    if (url.includes('/images')) {
      return 'Uploaded scalp clinical examination image';
    }
    if (details.status === 'Completed') {
      return `Consultation completed${patientName}`;
    }
    if (details.prescriptions && details.prescriptions.length > 0) {
      return `Prescribed ${details.prescriptions.length} medication(s)${patientName}`;
    }
    if (details.clinicalNotes || details.diagnosis) {
      return `Updated clinical notes & diagnosis${patientName}`;
    }
    return `Updated consultation details${patientName}`;
  }

  if (url.includes('/doctor/duty-status') || action.includes('/doctor/duty-status')) {
    return details.isOnDuty ? 'Doctor clocked in on-duty for consultations' : 'Doctor clocked off-duty';
  }

  // --- Billing & Invoices ---
  if (url.includes('/billing/invoices') || action.includes('/billing/invoices')) {
    if (url.includes('/payments')) {
      const amount = details.amount ? ` ₹${details.amount}` : '';
      const mode = details.mode ? ` via ${details.mode}` : '';
      return `Recorded payment${amount}${mode} for invoice`;
    }
    if (method === 'POST') {
      const invNum = details.invoiceNumber ? ` #${details.invoiceNumber}` : '';
      const total = details.grandTotal ? ` for ₹${details.grandTotal}` : '';
      return `Generated invoice${invNum}${total}`;
    }
  }

  // --- Pharmacy & Dispensing ---
  if (url.includes('/pharmacy/dispense') || action.includes('dispense')) {
    const med = details.medicineName ? `: ${details.medicineName}` : '';
    const qty = details.quantity ? ` (${details.quantity} units)` : '';
    return `Dispensed medication${med}${qty}`;
  }

  // --- Stock & Inventory ---
  if (url.includes('/stock/medicines') || action.includes('/stock/medicines')) {
    if (url.includes('/batches')) {
      const bNum = details.batchNumber ? ` #${details.batchNumber}` : '';
      const med = details.name ? ` for ${details.name}` : '';
      return `Received batch stock${bNum}${med}`;
    }
    if (method === 'POST') {
      return `Added new pharmacy medicine: ${details.name || 'Item'}`;
    }
    if (method === 'PATCH') {
      return `Updated medicine inventory: ${details.name || 'Item'}`;
    }
  }

  // --- Appointments ---
  if (url.includes('/appointments') || action.includes('/appointments')) {
    if (method === 'POST') {
      return details.patientName
        ? `Booked appointment for ${details.patientName}`
        : 'Booked patient appointment';
    }
    if (method === 'PATCH') {
      return `Updated appointment status: ${details.status || 'Updated'}`;
    }
  }

  // Fallback cleaner: extract HTTP method and resource
  if (method && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase())) {
    const resource = log.resource
      ? log.resource.charAt(0).toUpperCase() + log.resource.slice(1)
      : 'System';
    if (method === 'POST') return `Created new ${resource} entry`;
    if (method === 'PATCH' || method === 'PUT') return `Updated ${resource} information`;
    if (method === 'DELETE') return `Removed ${resource} record`;
  }

  return action || 'System activity recorded';
}
