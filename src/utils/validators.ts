import { BillStatus } from '../types';

export const GSTIN_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const DDO_ID_REGEX = /^\d{6,7}$/;
export const BANK_ACCOUNT_REGEX = /^\d{9,18}$/;

export function isValidGSTIN(gstin: string): boolean {
  if (!gstin) return false;
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

export function isValidIFSC(ifsc: string): boolean {
  if (!ifsc) return false;
  return IFSC_REGEX.test(ifsc.trim().toUpperCase());
}

export function isValidDdoId(ddoId: string): boolean {
  if (!ddoId) return false;
  return DDO_ID_REGEX.test(ddoId.trim());
}

/**
 * Strict status lifecycle transitions:
 * Draft -> Pending Verification
 * Pending Verification -> Pending Approval | Rejected
 * Pending Approval -> Pending RTGS | Rejected
 * Pending RTGS -> Paid
 * Rejected -> Pending Verification (when Creator edits & resubmits)
 * Draft -> Draft (updates)
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<BillStatus, BillStatus[]> = {
  Draft: ['Pending Verification', 'Draft'],
  'Pending Verification': ['Pending Approval', 'Rejected'],
  'Pending Approval': ['Pending RTGS', 'Rejected'],
  'Pending RTGS': ['Paid'],
  Rejected: ['Pending Verification', 'Draft'],
  Paid: [], // Terminal state
};

export function canTransitionStatus(from: BillStatus, to: BillStatus): boolean {
  const allowed = ALLOWED_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
