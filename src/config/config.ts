import { WorkflowConfig } from '../types';

export const APP_CONFIG = {
  organizationName: 'Greater Bengaluru Authority',
  shortName: 'GBA Corporation',
  subHeading: 'Government of Karnataka Undertaking',
  systemName: 'DC Bill Management System (DC-BMS)',
  financialYear: '2025-26',
  
  // Key decisions resolved in config
  budgetReservationStage: 'Pending Verification', // Budget reserved at submission, using Gross Value
  budgetReservationMetric: 'grossValue', // 'grossValue' as required
  releaseOnRejection: true, // Budget is released on Reject or Revert
  recheckOnResubmit: true, // Re-checked when Creator edits & resubmits
  billBelongsToSingleBatch: true,
  twoLevelApprovalDefault: true,
  minRemarksLength: 10,
};

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  verifierEnabled: true,
  mandatoryRemarksMinLength: 10,
  financialYear: '2025-26',
};

// 16 standard deduction heads for government DC bill processing
export const STANDARD_DEDUCTIONS = [
  'Income Tax TDS (IT u/s 194C/194J)',
  'GST TDS (CGST + SGST @ 2%)',
  'Labour Welfare Cess (@ 1%)',
  'Security Deposit / Retention Money (@ 5%)',
  'Performance Security Recovery',
  'Mobilization Advance Recovery',
  'Material Issue Recovery (Cement/Steel)',
  'Penalty / Liquidated Damages for Delay',
  'Royalty on Mineral / Earth / Stone',
  'Quality Control Testing Charges',
  'Karnataka Stamp Duty Recovery',
  'Water & Electricity Consumption Charges',
  'Equipment & Machinery Hire Recovery',
  'Defect Liability Period Retention',
  'Safety Violation Fines',
  'Other Statutory Miscellaneous Recovery',
] as const;

export const VENDOR_REQUIRED_DOCUMENTS = [
  'PAN Card Copy',
  'GSTIN Registration Certificate',
  'Cancelled Bank Cheque / Passbook',
  'GBA Class-I Contractor License / Empanelment',
  'Non-Debarment / Integrity Undertaking',
] as const;
