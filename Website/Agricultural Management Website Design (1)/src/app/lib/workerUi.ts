import type { WorkerRecord } from '../types/appState';
import { BATAAN_PROVINCE } from '../data/bataanAddressCatalog';

export type WorkerUi = {
  index: number;
  name: string;
  age: number | null;
  birthday: string;
  sex: string;
  address: string;
  barangay: string;
  municipality: string;
  province: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive';
  image: string;
  workerId: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  accountEmail: string;
  accountPassword: string;
};

type WorkerMeta = {
  age?: number;
  birthday?: string;
  sex?: string;
  status?: 'active' | 'inactive';
  imageUrl?: string;
  barangay?: string;
  municipality?: string;
  accountEmail?: string;
  accountPassword?: string;
  authUid?: string;
};

type EmergencyContactMeta = {
  fullName?: string;
  relationship?: string;
  contactNumber?: string;
};

export const defaultAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Worker')}&background=2d5016&color=fff&rounded=true`;

/** Philippine mobile numbers: strictly 11 digits starting with 09. */
export function sanitizePhoneInput(raw: string): string {
  let cleaned = raw.replace(/\D/g, '');
  if (cleaned.startsWith('639')) {
    cleaned = '0' + cleaned.slice(2);
  }
  return cleaned.slice(0, 11);
}

export function isValidPhone11(phone: string): boolean {
  const value = sanitizePhoneInput(phone);
  return /^09\d{9}$/.test(value) && value.length === 11;
}

/** Emergency contact numbers can be local or international (e.g. +63 917 123 4567, +1 202 555 0123). */
export function sanitizeEmergencyPhoneInput(raw: string): string {
  return raw.replace(/[^\d\s\-\+\(\)]/g, '').slice(0, 25);
}

/** Check if full name contains only letters, spaces, and dashes. */
export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return /^[a-zA-Z\s-]+$/.test(trimmed);
}


export function ageFromBirthday(birthday: string, now = new Date()): number | null {
  if (!birthday) return null;
  const birth = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || birth > now) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const hadBirthday =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

export function isAtLeast18(birthday: string): boolean {
  const age = ageFromBirthday(birthday);
  return age != null && age >= 18;
}

export function parseWorkerDetails(details: string | undefined): WorkerMeta {
  if (!details?.trim()) return {};
  try {
    return JSON.parse(details) as WorkerMeta;
  } catch {
    return {};
  }
}

export function parseEmergencyContact(raw: string | undefined): EmergencyContactMeta {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as EmergencyContactMeta;
  } catch {
    return { fullName: raw };
  }
}

export function workerRecordToUi(w: WorkerRecord, index: number): WorkerUi {
  const meta = parseWorkerDetails(w.details);
  const emergency = parseEmergencyContact(w.emergencyContact);
  const birthday = meta.birthday?.trim() || w.birthday?.trim() || '';
  return {
    index,
    name: w.name,
    age: ageFromBirthday(birthday) ?? meta.age ?? null,
    birthday,
    sex: meta.sex?.trim() || w.sex?.trim() || '—',
    address: w.address || '—',
    barangay: meta.barangay || '—',
    municipality: meta.municipality || '—',
    province: BATAAN_PROVINCE,
    phone: w.phoneNumber || '—',
    role: w.roleRate || 'Sorter',
    status: meta.status === 'inactive' ? 'inactive' : 'active',
    image: meta.imageUrl?.trim() || defaultAvatarUrl(w.name),
    workerId: w.workerId || `EMP-${String(index + 1).padStart(4, '0')}`,
    emergencyContactName: emergency.fullName?.trim() || '—',
    emergencyContactRelationship: emergency.relationship?.trim() || '—',
    emergencyContactPhone: emergency.contactNumber?.trim() || '—',
    accountEmail: w.accountEmail?.trim() || meta.accountEmail?.trim() || '',
    accountPassword: w.accountPassword?.trim() || meta.accountPassword?.trim() || '',
  };
}

export type WorkerFormInput = {
  name: string;
  birthday: string;
  sex: string;
  phone: string;
  role: string;
  municipality: string;
  barangay: string;
  street: string;
  houseNumber: string;
  imageUrl: string;
  status: 'active' | 'inactive';
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
};

function parseStreetAndHouseFromAddress(address: string): { street: string; houseNumber: string } {
  let street = '';
  let houseNumber = '';
  const barangayPrefix = ', Barangay ';
  const idx = address.indexOf(barangayPrefix);
  if (idx > 0) {
    const line1 = address.slice(0, idx).trim();
    const parts = line1.match(/^(\S+)\s+(.+)$/);
    if (parts) {
      houseNumber = parts[1];
      street = parts[2];
    } else {
      street = line1;
    }
  } else if (address.trim() && address !== '—') {
    street = address.trim();
    houseNumber = '1';
  }
  return { street, houseNumber };
}

/** Reverse-map a Firebase worker into add/edit form fields. */
export function workerRecordToFormInput(w: WorkerRecord): WorkerFormInput {
  const meta = parseWorkerDetails(w.details);
  const emergency = parseEmergencyContact(w.emergencyContact);
  const municipality = meta.municipality?.trim() || '';
  const barangay = meta.barangay?.trim() || '';
  const { street, houseNumber } = parseStreetAndHouseFromAddress(w.address || '');
  const imageUrl = meta.imageUrl?.trim() || '';
  const isDefaultAvatar = !imageUrl || imageUrl.includes('ui-avatars.com/api');

  return {
    name: w.name,
    birthday: meta.birthday?.trim() || w.birthday?.trim() || '',
    sex: meta.sex?.trim() || w.sex?.trim() || '',
    phone:
      w.phoneNumber && w.phoneNumber !== '—'
        ? sanitizePhoneInput(w.phoneNumber)
        : '',
    role: w.roleRate || 'Sorter',
    municipality,
    barangay,
    street,
    houseNumber,
    imageUrl: isDefaultAvatar ? '' : imageUrl,
    status: meta.status === 'inactive' ? 'inactive' : 'active',
    emergencyName: emergency.fullName?.trim() || '',
    emergencyRelationship: emergency.relationship?.trim() || '',
    emergencyPhone: emergency.contactNumber?.trim() || '',
  };
}

/** @deprecated Use workerRecordToFormInput with the source WorkerRecord. */
export function workerUiToFormInput(worker: WorkerUi): WorkerFormInput {
  return {
    ...workerRecordToFormInput({
      name: worker.name,
      roleRate: worker.role,
      phoneNumber: worker.phone,
      address: worker.address,
      details: JSON.stringify({
        age: worker.age ?? undefined,
        birthday: worker.birthday,
        sex: worker.sex === '—' ? '' : worker.sex,
        status: worker.status,
        imageUrl: worker.image,
        barangay: worker.barangay === '—' ? '' : worker.barangay,
        municipality: worker.municipality === '—' ? '' : worker.municipality,
      }),
      workerId: worker.workerId,
    }),
  };
}

export function uiToWorkerRecord(
  form: {
    name: string;
    birthday: string;
    sex: string;
    phone: string;
    role: string;
    municipality: string;
    barangay: string;
    address: string;
    status: 'active' | 'inactive';
    imageUrl: string;
    emergencyName: string;
    emergencyRelationship: string;
    emergencyPhone: string;
  },
  workerId?: string,
): WorkerRecord {
  const age = ageFromBirthday(form.birthday);
  const image = form.imageUrl.trim() || defaultAvatarUrl(form.name);
  return {
    name: form.name.trim(),
    roleRate: form.role.trim() || 'Sorter',
    phoneNumber: sanitizePhoneInput(form.phone),
    address: form.address,
    details: JSON.stringify({
      age: age ?? undefined,
      birthday: form.birthday,
      sex: form.sex,
      status: form.status,
      imageUrl: image,
      barangay: form.barangay.trim(),
      municipality: form.municipality.trim(),
    }),
    emergencyContact: JSON.stringify({
      fullName: form.emergencyName.trim(),
      relationship: form.emergencyRelationship.trim(),
      contactNumber: sanitizePhoneInput(form.emergencyPhone),
    }),
    workerId: workerId || `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    birthday: form.birthday,
    sex: form.sex,
  };
}
