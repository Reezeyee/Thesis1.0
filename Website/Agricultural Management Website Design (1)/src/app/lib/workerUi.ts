import type { WorkerRecord } from '../types/appState';
import { BATAAN_PROVINCE } from '../data/bataanAddressCatalog';

export type WorkerUi = {
  index: number;
  name: string;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  nickname?: string;
  age: number | null;
  birthday: string;
  sex: string;
  address: string;
  addressLine1?: string;
  addressLine2?: string;
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

export type WorkerMeta = {
  age?: number;
  birthday?: string;
  sex?: string;
  status?: 'active' | 'inactive';
  imageUrl?: string;
  firstName?: string;
  middleInitial?: string;
  lastName?: string;
  nickname?: string;
  addressLine1?: string;
  addressLine2?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  accountEmail?: string;
  accountPassword?: string;
  authUid?: string;
};

export type EmergencyContactMeta = {
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

/** Emergency contact numbers can be local or international. */
export function sanitizeEmergencyPhoneInput(raw: string): string {
  return raw.replace(/[^\d\s\-\+\(\)]/g, '').slice(0, 25);
}

export function isValidEmergencyPhone(phone: string): boolean {
  const value = sanitizeEmergencyPhoneInput(phone).trim();
  if (!value) return true;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Accepted characters in names:
 * Letters (A-Z, a-z, including ñ/Ñ and accented characters), spaces, hyphens (-), apostrophes ('), and periods (.).
 */
export const ACCEPTED_NAME_CHARS_DESCRIPTION =
  "Letters (A–Z, a–z), spaces, hyphens (-), apostrophes ('), and periods (.)";

export function isValidNamePart(value: string, allowPeriod = false): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const regex = allowPeriod
    ? /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s'\-\.]+$/
    : /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s'\-]+$/;
  return regex.test(trimmed);
}

export function isValidName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return /^[a-zA-ZñÑáéíóúÁÉÍÓÚ\s'\-\.]+$/.test(trimmed);
}

/**
 * Parse full name into structured parts: First Name, Middle Initial, Last Name, Nickname.
 */
export function parseNameComponents(fullName: string): {
  firstName: string;
  middleInitial: string;
  lastName: string;
  nickname: string;
} {
  let clean = (fullName || '').trim();
  let nickname = '';

  // Extract nickname if in parentheses or quotes: e.g. Jose "Pepe" Rizal or Jose (Pepe) Rizal
  const nickMatch = clean.match(/["'\(]([^"'()]+)["'\)]/);
  if (nickMatch) {
    nickname = nickMatch[1].trim();
    clean = clean.replace(nickMatch[0], '').replace(/\s+/g, ' ').trim();
  }

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', middleInitial: '', lastName: '', nickname };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], middleInitial: '', lastName: '', nickname };
  }
  if (parts.length === 2) {
    return { firstName: parts[0], middleInitial: '', lastName: parts[1], nickname };
  }

  // Check if middle token is an initial (1 or 2 chars, e.g. "A" or "A.")
  if (parts.length === 3 && parts[1].replace('.', '').length <= 2) {
    return {
      firstName: parts[0],
      middleInitial: parts[1].endsWith('.') ? parts[1] : `${parts[1]}.`,
      lastName: parts[2],
      nickname,
    };
  }

  // Multi-word first or last name: default last token is last name, token before last could be initial if short
  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  if (secondLast.replace('.', '').length <= 2 && parts.length > 2) {
    const first = parts.slice(0, parts.length - 2).join(' ');
    const mi = secondLast.endsWith('.') ? secondLast : `${secondLast}.`;
    return { firstName: first, middleInitial: mi, lastName: last, nickname };
  }

  return {
    firstName: parts.slice(0, parts.length - 1).join(' '),
    middleInitial: '',
    lastName: last,
    nickname,
  };
}

export function formatFullName(
  firstName: string,
  middleInitial?: string,
  lastName?: string,
  nickname?: string,
): string {
  const f = (firstName || '').trim();
  const m = (middleInitial || '').trim();
  const l = (lastName || '').trim();
  const n = (nickname || '').trim();

  const formattedMi = m ? (m.endsWith('.') ? m : `${m}.`) : '';
  const mainName = [f, formattedMi, l].filter(Boolean).join(' ');
  if (n) {
    return `${mainName} "${n}"`.trim();
  }
  return mainName;
}

/**
 * Dynamically calculate the maximum allowed birthdate based on today's date (strictly >= 18 years old).
 * Returns ISO string YYYY-MM-DD.
 */
export function calculateMaxBirthDate(now = new Date()): string {
  const maxYear = now.getFullYear() - 18;
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${maxYear}-${month}-${day}`;
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

export function isAtLeast18(birthday: string, now = new Date()): boolean {
  if (!birthday) return false;
  const age = ageFromBirthday(birthday, now);
  return age !== null && age >= 18;
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

/**
 * Address parser for backward compatibility and structured display.
 */
export function parseAddressComponents(address: string): {
  addressLine1: string;
  addressLine2: string;
  barangay: string;
  municipality: string;
  province: string;
} {
  const clean = (address || '').trim();
  if (!clean || clean === '—') {
    return { addressLine1: '', addressLine2: '', barangay: '', municipality: '', province: BATAAN_PROVINCE };
  }

  // Match pattern: "Line1[, Line2], Barangay X, Municipality, Province"
  const brgyMatch = clean.match(/^(.*?)(?:,\s*Barangay\s+([^,]+))(?:,\s*([^,]+))(?:,\s*([^,]+))?$/i);
  if (brgyMatch) {
    const lines = brgyMatch[1].trim();
    const lineParts = lines.split(',').map((s) => s.trim()).filter(Boolean);
    return {
      addressLine1: lineParts[0] || '',
      addressLine2: lineParts.slice(1).join(', ') || '',
      barangay: (brgyMatch[2] || '').trim(),
      municipality: (brgyMatch[3] || '').trim(),
      province: (brgyMatch[4] || BATAAN_PROVINCE).trim(),
    };
  }

  return {
    addressLine1: clean,
    addressLine2: '',
    barangay: '',
    municipality: '',
    province: BATAAN_PROVINCE,
  };
}

export function composeFullAddress({
  addressLine1,
  addressLine2,
  barangay,
  municipality,
  province = BATAAN_PROVINCE,
}: {
  addressLine1: string;
  addressLine2?: string;
  barangay: string;
  municipality: string;
  province?: string;
}): string {
  const l1 = (addressLine1 || '').trim();
  const l2 = (addressLine2 || '').trim();
  const b = (barangay || '').trim();
  const m = (municipality || '').trim();
  const p = (province || BATAAN_PROVINCE).trim();

  const lines = [l1, l2].filter(Boolean).join(', ');
  const brgyPart = b ? (b.toLowerCase().startsWith('barangay') ? b : `Barangay ${b}`) : '';
  return [lines, brgyPart, m, p].filter(Boolean).join(', ');
}

export function workerRecordToUi(w: WorkerRecord, index: number): WorkerUi {
  const meta = parseWorkerDetails(w.details);
  const emergency = parseEmergencyContact(w.emergencyContact);
  const birthday = meta.birthday?.trim() || w.birthday?.trim() || '';
  const parsedName = parseNameComponents(w.name);
  const parsedAddress = parseAddressComponents(w.address || '');

  return {
    index,
    name: w.name,
    firstName: meta.firstName || parsedName.firstName,
    middleInitial: meta.middleInitial || parsedName.middleInitial,
    lastName: meta.lastName || parsedName.lastName,
    nickname: meta.nickname || parsedName.nickname,
    age: ageFromBirthday(birthday) ?? meta.age ?? null,
    birthday,
    sex: meta.sex?.trim() || w.sex?.trim() || '—',
    address: w.address || '—',
    addressLine1: meta.addressLine1 || parsedAddress.addressLine1,
    addressLine2: meta.addressLine2 || parsedAddress.addressLine2,
    barangay: meta.barangay || parsedAddress.barangay || '—',
    municipality: meta.municipality || parsedAddress.municipality || '—',
    province: meta.province || parsedAddress.province || BATAAN_PROVINCE,
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

export type WorkerFormDraft = {
  firstName: string;
  middleInitial: string;
  lastName: string;
  nickname: string;
  birthday: string;
  sex: string;
  phone: string;
  role: string;
  addressLine1: string;
  addressLine2: string;
  barangay: string;
  municipality: string;
  province: string;
  imageUrl: string;
  status: 'active' | 'inactive';
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
};

export function emptyWorkerDraft(): WorkerFormDraft {
  return {
    firstName: '',
    middleInitial: '',
    lastName: '',
    nickname: '',
    birthday: '',
    sex: 'Female',
    phone: '',
    role: 'Picker',
    addressLine1: '',
    addressLine2: '',
    barangay: '',
    municipality: '',
    province: BATAAN_PROVINCE,
    imageUrl: '',
    status: 'active',
    emergencyName: '',
    emergencyRelationship: 'Parent',
    emergencyPhone: '',
  };
}

export function workerRecordToDraft(w: WorkerRecord): WorkerFormDraft {
  const meta = parseWorkerDetails(w.details);
  const emergency = parseEmergencyContact(w.emergencyContact);
  const parsedName = parseNameComponents(w.name);
  const parsedAddress = parseAddressComponents(w.address || '');
  const imageUrl = meta.imageUrl?.trim() || '';
  const isDefaultAvatar = !imageUrl || imageUrl.includes('ui-avatars.com/api');

  return {
    firstName: meta.firstName || parsedName.firstName,
    middleInitial: meta.middleInitial || parsedName.middleInitial,
    lastName: meta.lastName || parsedName.lastName,
    nickname: meta.nickname || parsedName.nickname,
    birthday: meta.birthday?.trim() || w.birthday?.trim() || '',
    sex: meta.sex?.trim() || w.sex?.trim() || 'Female',
    phone: w.phoneNumber && w.phoneNumber !== '—' ? sanitizePhoneInput(w.phoneNumber) : '',
    role: w.roleRate || 'Picker',
    addressLine1: meta.addressLine1 || parsedAddress.addressLine1,
    addressLine2: meta.addressLine2 || parsedAddress.addressLine2,
    barangay: meta.barangay || parsedAddress.barangay,
    municipality: meta.municipality || parsedAddress.municipality,
    province: meta.province || parsedAddress.province || BATAAN_PROVINCE,
    imageUrl: isDefaultAvatar ? '' : imageUrl,
    status: meta.status === 'inactive' ? 'inactive' : 'active',
    emergencyName: emergency.fullName?.trim() || '',
    emergencyRelationship: emergency.relationship?.trim() || 'Parent',
    emergencyPhone: emergency.contactNumber?.trim() || '',
  };
}

export function draftToWorkerRecord(
  draft: WorkerFormDraft,
  workerId?: string,
  existingUid?: string,
): WorkerRecord {
  const fullName = formatFullName(
    draft.firstName,
    draft.middleInitial,
    draft.lastName,
    draft.nickname,
  );
  const fullAddress = composeFullAddress({
    addressLine1: draft.addressLine1,
    addressLine2: draft.addressLine2,
    barangay: draft.barangay,
    municipality: draft.municipality,
    province: draft.province,
  });
  const age = ageFromBirthday(draft.birthday);
  const image = draft.imageUrl.trim() || defaultAvatarUrl(fullName);

  return {
    name: fullName,
    roleRate: draft.role.trim() || 'Picker',
    phoneNumber: sanitizePhoneInput(draft.phone),
    address: fullAddress,
    details: JSON.stringify({
      age: age ?? undefined,
      birthday: draft.birthday,
      sex: draft.sex,
      status: draft.status,
      imageUrl: image,
      firstName: draft.firstName.trim(),
      middleInitial: draft.middleInitial.trim(),
      lastName: draft.lastName.trim(),
      nickname: draft.nickname.trim(),
      addressLine1: draft.addressLine1.trim(),
      addressLine2: draft.addressLine2.trim(),
      barangay: draft.barangay.trim(),
      municipality: draft.municipality.trim(),
      province: draft.province.trim(),
      authUid: existingUid,
    }),
    emergencyContact: JSON.stringify({
      fullName: draft.emergencyName.trim(),
      relationship: draft.emergencyRelationship.trim(),
      contactNumber: sanitizeEmergencyPhoneInput(draft.emergencyPhone).trim(),
    }),
    workerId: workerId || `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    birthday: draft.birthday,
    sex: draft.sex,
  };
}
