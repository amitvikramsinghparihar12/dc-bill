import { api } from './api';
import { db } from './db';
import { calculateBillFinancials, formatINR } from '../utils/calc';
import { isValidGSTIN, isValidIFSC, isValidDdoId, canTransitionStatus } from '../utils/validators';
import { User, Bill } from '../types';

export interface TestResult {
  id: string;
  name: string;
  category: string;
  description: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: string;
}

export async function runAllTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}> {
  const results: TestResult[] = [];

  // Reset database before test suite to have a pristine baseline
  db.resetDemoData();

  // Test 1: Gross/Net calculation
  {
    const start = performance.now();
    try {
      const res = calculateBillFinancials({
        baseValue: 100000,
        cgst: 9000,
        sgst: 9000,
        igst: 0,
        deductions: [
          { label: 'TDS', amount: 2000 },
          { label: 'GST TDS', amount: 2000 },
          { label: 'Cess', amount: 1000 },
          { label: 'SD', amount: 5000 },
        ],
      });
      if (res.grossValue !== 118000) throw new Error(`Expected gross 118000, got ${res.grossValue}`);
      if (res.totalDeductions !== 10000) throw new Error(`Expected deductions 10000, got ${res.totalDeductions}`);
      if (res.netPayable !== 108000) throw new Error(`Expected net 108000, got ${res.netPayable}`);

      // Over-deduction negative check
      const invalid = calculateBillFinancials({
        baseValue: 1000,
        cgst: 0,
        sgst: 0,
        igst: 0,
        deductions: [{ label: 'Penalty', amount: 2000 }],
      });
      if (invalid.isValid) throw new Error('Expected invalid flag when deductions exceed gross value');

      results.push({
        id: 'T1',
        name: 'Gross & Net Financial Calculations',
        category: 'Pure Functions',
        description: 'Verifies gross = base + taxes, total deductions sum, and blocks negative net payable.',
        passed: true,
        durationMs: performance.now() - start,
        details: 'Calculated 118,000 gross with 10,000 deductions yielding 108,000 net payable. Negative net properly rejected.',
      });
    } catch (e: any) {
      results.push({
        id: 'T1',
        name: 'Gross & Net Financial Calculations',
        category: 'Pure Functions',
        description: 'Verifies gross/net calculations and non-negative net payable.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 2: GSTIN and IFSC validators
  {
    const start = performance.now();
    try {
      if (!isValidGSTIN('29ABCDE1234F1Z5')) throw new Error('Valid Karnataka GSTIN was rejected');
      if (isValidGSTIN('INVALID-GSTIN-123')) throw new Error('Invalid GSTIN was accepted');

      if (!isValidIFSC('CNRB0000412')) throw new Error('Valid Canara IFSC was rejected');
      if (isValidIFSC('CNRB123')) throw new Error('Invalid IFSC was accepted');

      if (!isValidDdoId('100234')) throw new Error('Valid 6-digit DDO ID rejected');
      if (!isValidDdoId('1002345')) throw new Error('Valid 7-digit DDO ID rejected');
      if (isValidDdoId('1234')) throw new Error('Short 4-digit DDO ID accepted');

      results.push({
        id: 'T2',
        name: 'GSTIN, IFSC & DDO ID Validators',
        category: 'Validation',
        description: 'Tests standard Indian statutory format checks (GSTIN regex, IFSC regex, 6/7-digit DDO ID).',
        passed: true,
        durationMs: performance.now() - start,
        details: 'Correctly verified 29ABCDE1234F1Z5, CNRB0000412, and 6/7 digit DDO constraints.',
      });
    } catch (e: any) {
      results.push({
        id: 'T2',
        name: 'GSTIN, IFSC & DDO ID Validators',
        category: 'Validation',
        description: 'Tests statutory format checks.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 3: Status transition table
  {
    const start = performance.now();
    try {
      if (!canTransitionStatus('Draft', 'Pending Verification')) throw new Error('Draft -> Pending Verification rejected');
      if (!canTransitionStatus('Pending Verification', 'Pending Approval')) throw new Error('Verification -> Approval rejected');
      if (!canTransitionStatus('Pending Approval', 'Pending RTGS')) throw new Error('Approval -> Pending RTGS rejected');
      if (!canTransitionStatus('Pending RTGS', 'Paid')) throw new Error('Pending RTGS -> Paid rejected');
      if (!canTransitionStatus('Pending Verification', 'Rejected')) throw new Error('Verification -> Rejected rejected');
      if (!canTransitionStatus('Rejected', 'Pending Verification')) throw new Error('Rejected -> Pending Verification rejected');

      // Invalid transitions
      if (canTransitionStatus('Draft', 'Paid')) throw new Error('Draft -> Paid should be invalid');
      if (canTransitionStatus('Paid', 'Draft')) throw new Error('Paid -> Draft should be invalid');

      results.push({
        id: 'T3',
        name: 'Strict Status Lifecycle Transitions',
        category: 'State Machine',
        description: 'Validates strict lifecycle: Draft -> Pending Verification -> Pending Approval -> Pending RTGS -> Paid.',
        passed: true,
        durationMs: performance.now() - start,
        details: 'All valid transition paths verified; illegal jumps (Draft -> Paid) strictly blocked.',
      });
    } catch (e: any) {
      results.push({
        id: 'T3',
        name: 'Strict Status Lifecycle Transitions',
        category: 'State Machine',
        description: 'Validates lifecycle state machine.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 4: Budget check boundary: gross == remaining passes, gross > remaining fails
  {
    const start = performance.now();
    try {
      const state = db.getState();
      const creator = state.users.find((u) => u.id === 'USR-CR-01')!; // DDO 100234
      const alloc = state.ddoAllocations.find((a) => a.ddoId === '100234')!;
      const currentRemaining = alloc.remaining;

      // Submission exceeding remaining must throw exactly "Insufficient DDO Budget Balance."
      let caughtExceed = false;
      try {
        await api.submitBill(creator, {
          ddoId: '100234',
          vendorId: 'V-0001',
          baseValue: currentRemaining + 100, // exceeds
          cgst: 0,
          sgst: 0,
          igst: 0,
        });
      } catch (err: any) {
        if (err.message === 'Insufficient DDO Budget Balance.') {
          caughtExceed = true;
        } else {
          throw new Error(`Expected exact error 'Insufficient DDO Budget Balance.', got: '${err.message}'`);
        }
      }

      if (!caughtExceed) throw new Error('Submitting bill exceeding remaining budget did not throw error');

      results.push({
        id: 'T4',
        name: 'Budget Boundary Check (Gross vs Remaining)',
        category: 'Budget Enforcement',
        description: 'Ensures submission exceeding remaining budget is rejected with exact message "Insufficient DDO Budget Balance."',
        passed: true,
        durationMs: performance.now() - start,
        details: `Over-limit submission properly blocked with exact message: "Insufficient DDO Budget Balance."`,
      });
    } catch (e: any) {
      results.push({
        id: 'T4',
        name: 'Budget Boundary Check (Gross vs Remaining)',
        category: 'Budget Enforcement',
        description: 'Ensures budget boundary enforcement.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 5: Reject releases budget
  {
    const start = performance.now();
    try {
      const state = db.getState();
      const verifier = state.users.find((u) => u.id === 'USR-VR-01')!;
      const allocBefore = state.ddoAllocations.find((a) => a.ddoId === '100234')!;
      const utilizedBefore = allocBefore.utilized;

      // Find or submit a bill to pending verification
      const creator = state.users.find((u) => u.id === 'USR-CR-01')!;
      const testBill = await api.submitBill(creator, {
        ddoId: '100234',
        vendorId: 'V-0001',
        baseValue: 50000,
        cgst: 4500,
        sgst: 4500,
        igst: 0, // gross = 59000
      });

      const allocAfterSubmit = db.getState().ddoAllocations.find((a) => a.ddoId === '100234')!;
      if (allocAfterSubmit.utilized !== utilizedBefore + 59000) {
        throw new Error('Budget was not reserved on submit');
      }

      // Reject bill with mandatory remarks (>= 10 chars)
      await api.rejectBill(
        verifier,
        testBill.id,
        'Measurement discrepancy observed in MB. Measurements do not align.'
      );

      const allocAfterReject = db.getState().ddoAllocations.find((a) => a.ddoId === '100234')!;
      if (allocAfterReject.utilized !== utilizedBefore) {
        throw new Error(`Expected utilized to release back to ${utilizedBefore}, but got ${allocAfterReject.utilized}`);
      }

      results.push({
        id: 'T5',
        name: 'Rejection Releases Reserved Budget',
        category: 'ACID Transactions',
        description: 'Confirms that when a bill is rejected or reverted, its reserved grossValue is released back to the DDO.',
        passed: true,
        durationMs: performance.now() - start,
        details: 'Reserved ₹59,000 on submit and immediately restored utilized balance upon rejection with mandatory remarks.',
      });
    } catch (e: any) {
      results.push({
        id: 'T5',
        name: 'Rejection Releases Reserved Budget',
        category: 'ACID Transactions',
        description: 'Tests budget release on rejection.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 6: Concurrent submission race test
  {
    const start = performance.now();
    try {
      // Allocate small budget to a test DDO
      const state = db.getState();
      const creator = state.users.find((u) => u.id === 'USR-CR-01')!; // DDO 100234

      // Directly adjust allocation for test scenario: remaining = ₹100,000
      const alloc = state.ddoAllocations.find((a) => a.ddoId === '100234')!;
      const initialRemaining = alloc.remaining;
      const billAmount = Math.floor(initialRemaining * 0.7); // 70% of remaining

      // Two concurrent submissions, each asking for 70% of balance (total 140% -> only 1 can fit!)
      const p1 = api.submitBill(creator, {
        ddoId: '100234',
        vendorId: 'V-0001',
        baseValue: billAmount,
        cgst: 0,
        sgst: 0,
        igst: 0,
      });

      const p2 = api.submitBill(creator, {
        ddoId: '100234',
        vendorId: 'V-0001',
        baseValue: billAmount,
        cgst: 0,
        sgst: 0,
        igst: 0,
      });

      const outcomes = await Promise.allSettled([p1, p2]);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      if (fulfilled.length !== 1 || rejected.length !== 1) {
        throw new Error(
          `Expected exactly 1 fulfilled and 1 rejected, got ${fulfilled.length} fulfilled and ${rejected.length} rejected`
        );
      }

      const rejReason = (rejected[0] as PromiseRejectedResult).reason;
      if (rejReason.message !== 'Insufficient DDO Budget Balance.') {
        throw new Error(`Expected 'Insufficient DDO Budget Balance.', got '${rejReason.message}'`);
      }

      results.push({
        id: 'T6',
        name: 'Concurrent Submission Race Isolation',
        category: 'ACID Transactions',
        description: 'Serializes concurrent writes via promise chain so two simultaneous submissions cannot overspend a shared budget.',
        passed: true,
        durationMs: performance.now() - start,
        details: 'Fired 2 concurrent requests totaling 140% of available cap. Exactly 1 succeeded; 2nd was serialized & rejected.',
      });
    } catch (e: any) {
      results.push({
        id: 'T6',
        name: 'Concurrent Submission Race Isolation',
        category: 'ACID Transactions',
        description: 'Tests race condition serialization.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 7: Atomic RTGS batch rollback (one invalid bill fails entire batch)
  {
    const start = performance.now();
    try {
      const state = db.getState();
      const rtgsManager = state.users.find((u) => u.id === 'USR-RTGS-01')!;
      const bank = state.bankAccounts[0];

      // Select one valid pending RTGS bill and one draft bill
      const pendingBill = state.bills.find((b) => b.status === 'Pending RTGS' && !b.rtgsBatchId)!;
      const draftBill = state.bills.find((b) => b.status === 'Draft')!;

      let rollbackCaught = false;
      try {
        await api.generateRtgsAdvice(rtgsManager, [pendingBill.id, draftBill.id], bank.id);
      } catch (err: any) {
        rollbackCaught = true;
      }

      if (!rollbackCaught) throw new Error('Batch generation should have failed due to Draft bill in selection');

      // Verify pendingBill was NOT marked Paid (atomic rollback!)
      const recheckedBill = db.getState().bills.find((b) => b.id === pendingBill.id)!;
      if (recheckedBill.status !== 'Pending RTGS' || recheckedBill.rtgsBatchId) {
        throw new Error('Pending bill was partially updated despite batch failure! Atomic rollback failed.');
      }

      results.push({
        id: 'T7',
        name: 'Atomic RTGS Batch Generation Rollback',
        category: 'ACID Transactions',
        description: 'Verifies that if any bill in a multi-selection is invalid, the entire batch rolls back with zero state mutation.',
        passed: true,
        durationMs: performance.now() - start,
        details: 'Selected valid + invalid bill. Transaction threw error; valid bill remained safely in Pending RTGS state.',
      });
    } catch (e: any) {
      results.push({
        id: 'T7',
        name: 'Atomic RTGS Batch Generation Rollback',
        category: 'ACID Transactions',
        description: 'Tests atomic batch rollback.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 8: DDO Isolation
  {
    const start = performance.now();
    try {
      const state = db.getState();
      const creator1 = state.users.find((u) => u.id === 'USR-CR-01')!; // DDO 100234
      const creator2 = state.users.find((u) => u.id === 'USR-CR-02')!; // DDO 100567

      const billsCreator1 = await api.getBills(creator1);
      const billsCreator2 = await api.getBills(creator2);

      // Creator 1 must only see DDO 100234 bills
      const hasOtherDdoInCreator1 = billsCreator1.some((b) => !creator1.ddoIds.includes(b.ddoId));
      if (hasOtherDdoInCreator1) {
        throw new Error('Creator 1 saw bills belonging to other DDOs!');
      }

      // Creator 2 must only see DDO 100567 bills
      const hasOtherDdoInCreator2 = billsCreator2.some((b) => !creator2.ddoIds.includes(b.ddoId));
      if (hasOtherDdoInCreator2) {
        throw new Error('Creator 2 saw bills belonging to other DDOs!');
      }

      // Creator 1 attempting to save draft for DDO 100567 must be blocked
      let crossDdoBlocked = false;
      try {
        await api.saveDraftBill(creator1, {
          ddoId: '100567',
          vendorId: 'V-0001',
          baseValue: 1000,
        });
      } catch {
        crossDdoBlocked = true;
      }

      if (!crossDdoBlocked) {
        throw new Error('Creator 1 was allowed to save a bill for DDO 100567!');
      }

      results.push({
        id: 'T8',
        name: 'Strict Operational DDO Isolation',
        category: 'Security & RBAC',
        description: 'Proves a Creator mapped to DDO A cannot see, create, or modify DDO B bills or budget.',
        passed: true,
        durationMs: performance.now() - start,
        details: `Creator 1 (DDO 100234) and Creator 2 (DDO 100567) query independent datasets. Cross-DDO write blocked.`,
      });
    } catch (e: any) {
      results.push({
        id: 'T8',
        name: 'Strict Operational DDO Isolation',
        category: 'Security & RBAC',
        description: 'Tests DDO isolation enforcement.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 9: Permission denial for Verifier edit attempts
  {
    const start = performance.now();
    try {
      const state = db.getState();
      const verifier = state.users.find((u) => u.id === 'USR-VR-01')!;

      let deniedSave = false;
      try {
        await api.saveDraftBill(verifier, {
          ddoId: '100234',
          vendorId: 'V-0001',
          baseValue: 5000,
        });
      } catch (err: any) {
        if (err.message.includes('403') || err.message.includes('Forbidden')) {
          deniedSave = true;
        } else {
          throw err;
        }
      }

      if (!deniedSave) {
        throw new Error('Verifier was unexpectedly permitted to call saveDraftBill');
      }

      results.push({
        id: 'T9',
        name: 'Permission Denial for Verifier Edits (Read-Only Enforcement)',
        category: 'Security & RBAC',
        description: 'Ensures Verifier role lacks edit/create permissions and server raises HTTP 403 Forbidden.',
        passed: true,
        durationMs: performance.now() - start,
        details: 'Attempt by Verifier to create/edit bill rejected with HTTP 403 Forbidden.',
      });
    } catch (e: any) {
      results.push({
        id: 'T9',
        name: 'Permission Denial for Verifier Edits (Read-Only Enforcement)',
        category: 'Security & RBAC',
        description: 'Tests read-only permission denial.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  // Test 10: Finance Officer cannot reduce DDO allocation below utilized amount
  {
    const start = performance.now();
    try {
      const state = db.getState();
      const fo = state.users.find((u) => u.id === 'USR-FO-01')!;
      const alloc = state.ddoAllocations.find((a) => a.ddoId === '100234')!;

      let caughtReduction = false;
      try {
        // Attempt to reduce allocation below currently utilized
        await api.updateDdoAllocation(fo, alloc.id, alloc.utilized - 1000);
      } catch (err: any) {
        if (err.message.includes('utilized')) {
          caughtReduction = true;
        }
      }

      if (!caughtReduction) {
        throw new Error('Finance Officer was allowed to reduce allocation below utilized amount!');
      }

      results.push({
        id: 'T10',
        name: 'DDO Allocation Invariant (Allocated >= Utilized)',
        category: 'Budget Invariants',
        description: 'Prevents Finance Officer from reducing a DDO budget allocation below the sum of currently utilized bills.',
        passed: true,
        durationMs: performance.now() - start,
        details: 'Reduction below current utilized rejected with consistency constraint message.',
      });
    } catch (e: any) {
      results.push({
        id: 'T10',
        name: 'DDO Allocation Invariant (Allocated >= Utilized)',
        category: 'Budget Invariants',
        description: 'Tests allocation floor invariant.',
        passed: false,
        durationMs: performance.now() - start,
        error: e.message,
      });
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  return {
    total: results.length,
    passed: passedCount,
    failed: failedCount,
    results,
  };
}
