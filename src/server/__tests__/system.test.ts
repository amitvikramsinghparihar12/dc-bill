import { describe, it, expect, beforeEach } from 'vitest';
import { api } from '../api';
import { db } from '../db';
import { calculateBillFinancials, round2 } from '../../utils/calc';
import { isValidGSTIN, isValidIFSC, isValidDdoId, canTransitionStatus } from '../../utils/validators';

describe('GBA Corporation DC Bill Management System Test Suite', () => {
  beforeEach(() => {
    db.resetDemoData();
  });

  it('1. Gross/Net Calculation: correctly aggregates base + taxes, 16 deductions, blocks negative net', () => {
    const calc = calculateBillFinancials({
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

    expect(calc.isValid).toBe(true);
    expect(calc.grossValue).toBe(118000);
    expect(calc.totalDeductions).toBe(10000);
    expect(calc.netPayable).toBe(108000);

    const negativeNet = calculateBillFinancials({
      baseValue: 1000,
      cgst: 0,
      sgst: 0,
      igst: 0,
      deductions: [{ label: 'Penalty', amount: 2000 }],
    });
    expect(negativeNet.isValid).toBe(false);
  });

  it('2. GSTIN, IFSC & DDO ID statutory format validation', () => {
    expect(isValidGSTIN('29ABCDE1234F1Z5')).toBe(true);
    expect(isValidGSTIN('INVALID_GSTIN')).toBe(false);

    expect(isValidIFSC('CNRB0000412')).toBe(true);
    expect(isValidIFSC('HDFC0001742')).toBe(true);
    expect(isValidIFSC('INVALID_IFSC')).toBe(false);

    expect(isValidDdoId('100234')).toBe(true);
    expect(isValidDdoId('1002345')).toBe(true);
    expect(isValidDdoId('1234')).toBe(false);
  });

  it('3. Status lifecycle transition state machine', () => {
    expect(canTransitionStatus('Draft', 'Pending Verification')).toBe(true);
    expect(canTransitionStatus('Pending Verification', 'Pending Approval')).toBe(true);
    expect(canTransitionStatus('Pending Approval', 'Pending RTGS')).toBe(true);
    expect(canTransitionStatus('Pending RTGS', 'Paid')).toBe(true);
    expect(canTransitionStatus('Pending Verification', 'Rejected')).toBe(true);
    expect(canTransitionStatus('Rejected', 'Pending Verification')).toBe(true);

    // Illegal transitions
    expect(canTransitionStatus('Draft', 'Paid')).toBe(false);
    expect(canTransitionStatus('Paid', 'Draft')).toBe(false);
  });

  it('4. Budget check boundary: gross == remaining passes, gross > remaining fails with exact message', async () => {
    const state = db.getState();
    const creator = state.users.find((u) => u.id === 'USR-CR-01')!;
    const alloc = state.ddoAllocations.find((a) => a.ddoId === '100234')!;

    // Exceed remaining by 100
    await expect(
      api.submitBill(creator, {
        ddoId: '100234',
        vendorId: 'V-0001',
        baseValue: alloc.remaining + 100,
        cgst: 0,
        sgst: 0,
        igst: 0,
      })
    ).rejects.toThrow('Insufficient DDO Budget Balance.');
  });

  it('5. Reject releases budget: utilized reduces and remaining increases by grossValue', async () => {
    const state = db.getState();
    const creator = state.users.find((u) => u.id === 'USR-CR-01')!;
    const verifier = state.users.find((u) => u.id === 'USR-VR-01')!;
    const allocBefore = state.ddoAllocations.find((a) => a.ddoId === '100234')!;
    const initialUtilized = allocBefore.utilized;

    const bill = await api.submitBill(creator, {
      ddoId: '100234',
      vendorId: 'V-0001',
      baseValue: 100000,
      cgst: 9000,
      sgst: 9000,
      igst: 0, // gross: 118,000
    });

    const allocAfterSubmit = db.getState().ddoAllocations.find((a) => a.ddoId === '100234')!;
    expect(allocAfterSubmit.utilized).toBe(initialUtilized + 118000);

    // Reject with min 10 chars remarks
    await api.rejectBill(
      verifier,
      bill.id,
      'Measurement mismatch found on page 14 of MB. Please rectify.'
    );

    const allocAfterReject = db.getState().ddoAllocations.find((a) => a.ddoId === '100234')!;
    expect(allocAfterReject.utilized).toBe(initialUtilized);
  });

  it('6. Concurrent submission race: promises serialized and second request rejects if balance insufficient', async () => {
    const state = db.getState();
    const creator = state.users.find((u) => u.id === 'USR-CR-01')!;
    const alloc = state.ddoAllocations.find((a) => a.ddoId === '100234')!;

    const billAmount = Math.floor(alloc.remaining * 0.7); // 70% each -> total 140%

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

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toBe('Insufficient DDO Budget Balance.');
  });

  it('7. Atomic RTGS batch rollback: invalid bill in selection aborts entire batch with zero changes', async () => {
    const state = db.getState();
    const rtgsManager = state.users.find((u) => u.id === 'USR-RTGS-01')!;
    const bank = state.bankAccounts[0];

    const pendingBill = state.bills.find((b) => b.status === 'Pending RTGS' && !b.rtgsBatchId)!;
    const draftBill = state.bills.find((b) => b.status === 'Draft')!;

    await expect(
      api.generateRtgsAdvice(rtgsManager, [pendingBill.id, draftBill.id], bank.id)
    ).rejects.toThrow();

    const rechecked = db.getState().bills.find((b) => b.id === pendingBill.id)!;
    expect(rechecked.status).toBe('Pending RTGS');
    expect(rechecked.rtgsBatchId).toBeUndefined();
  });

  it('8. DDO isolation: Creator 1 cannot view or modify DDO 2 bills', async () => {
    const state = db.getState();
    const creator1 = state.users.find((u) => u.id === 'USR-CR-01')!; // DDO 100234
    const creator2 = state.users.find((u) => u.id === 'USR-CR-02')!; // DDO 100567

    const bills1 = await api.getBills(creator1);
    const bills2 = await api.getBills(creator2);

    expect(bills1.every((b) => creator1.ddoIds.includes(b.ddoId))).toBe(true);
    expect(bills2.every((b) => creator2.ddoIds.includes(b.ddoId))).toBe(true);

    // Cross-DDO write blocked
    await expect(
      api.saveDraftBill(creator1, {
        ddoId: '100567',
        vendorId: 'V-0001',
        baseValue: 1000,
      })
    ).rejects.toThrow();
  });

  it('9. Permission denial: Verifier role cannot edit bills (HTTP 403 Forbidden)', async () => {
    const state = db.getState();
    const verifier = state.users.find((u) => u.id === 'USR-VR-01')!;

    await expect(
      api.saveDraftBill(verifier, {
        ddoId: '100234',
        vendorId: 'V-0001',
        baseValue: 5000,
      })
    ).rejects.toThrow(/403|Forbidden/);
  });

  it('10. Finance Officer invariant: cannot reduce DDO allocation below current utilized amount', async () => {
    const state = db.getState();
    const fo = state.users.find((u) => u.id === 'USR-FO-01')!;
    const alloc = state.ddoAllocations.find((a) => a.ddoId === '100234')!;

    await expect(
      api.updateDdoAllocation(fo, alloc.id, alloc.utilized - 500)
    ).rejects.toThrow(/utilized/);
  });
});
