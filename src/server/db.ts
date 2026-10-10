import {
  Department,
  DDO,
  User,
  Vendor,
  BudgetGrant,
  DdoAllocation,
  BudgetChangeRequest,
  Bill,
  RtgsBatch,
  CorporateBankAccount,
  AuditLog,
  WorkflowConfig,
  BillStatus,
  Role,
} from '../types';
import { getInitialSeedData } from './seedData';
import { calculateBillFinancials, round2 } from '../utils/calc';
import { isValidGSTIN, isValidIFSC, isValidDdoId, canTransitionStatus } from '../utils/validators';
import { assertPermission } from '../config/permissions';

const LOCAL_STORAGE_KEY = 'GBA_DC_BILL_MGT_STORE_V1';

const storageHelper = {
  getItem(key: string): string | null {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return null;
  },
  setItem(key: string, value: string): void {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    }
  },
  removeItem(key: string): void {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
  },
};

export interface DatabaseState {
  departments: Department[];
  ddos: DDO[];
  users: User[];
  vendors: Vendor[];
  bankAccounts: CorporateBankAccount[];
  budgetGrants: BudgetGrant[];
  ddoAllocations: DdoAllocation[];
  budgetChangeRequests: BudgetChangeRequest[];
  bills: Bill[];
  rtgsBatches: RtgsBatch[];
  auditLogs: AuditLog[];
  workflowConfig: WorkflowConfig;
  nextBillNumber: number;
  nextRtgsNumber: number;
}

class MockDatabase {
  private state: DatabaseState;
  private transactionQueue: Promise<any> = Promise.resolve();

  constructor() {
    this.state = this.loadOrSeed();
  }

  private loadOrSeed(): DatabaseState {
    try {
      const saved = storageHelper.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.departments && parsed.bills && parsed.ddoAllocations) {
          return parsed;
        }
      }
    } catch {
      // Ignore parse errors and fall back to seed
    }

    const seed = getInitialSeedData();
    const initialState: DatabaseState = {
      ...seed,
      budgetChangeRequests: [],
      nextBillNumber: 68,
      nextRtgsNumber: 2,
    };
    this.persist(initialState);
    return initialState;
  }

  private persist(state: DatabaseState): void {
    try {
      storageHelper.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to persist to localStorage', e);
    }
  }

  /**
   * Serialized ACID Transaction Runner
   * Serializes all writes through a promise chain.
   * Copies state (isolation), executes callback, verifies invariants (consistency),
   * commits atomically (atomicity), persists to localStorage (durability), or rolls back on any error.
   */
  public async runTransaction<T>(
    operationName: string,
    callback: (draft: DatabaseState) => T | Promise<T>
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      // 1. Deep clone state to ensure isolation and enable rollback
      const draft: DatabaseState = JSON.parse(JSON.stringify(this.state));

      try {
        // 2. Execute transactional updates on draft
        const result = await callback(draft);

        // 3. Validate consistency invariants
        this.validateInvariants(draft);

        // 4. Commit atomically
        this.state = draft;
        this.persist(this.state);

        return result;
      } catch (error) {
        // Rollback is automatic since this.state was not mutated
        console.warn(`Transaction '${operationName}' rolled back:`, error);
        throw error;
      }
    };

    // Chain to serialize concurrent operations
    const nextPromise = this.transactionQueue.then(execute, execute);
    this.transactionQueue = nextPromise;
    return nextPromise;
  }

  private validateInvariants(draft: DatabaseState): void {
    // Invariant 1: utilized <= allocated for all DDOs
    for (const alloc of draft.ddoAllocations) {
      if (round2(alloc.utilized) > round2(alloc.allocated)) {
        throw new Error(
          `Consistency Violation: DDO ${alloc.ddoId} utilized (₹${alloc.utilized}) exceeds allocated (₹${alloc.allocated})`
        );
      }
      alloc.remaining = round2(alloc.allocated - alloc.utilized);
    }

    // Invariant 2: sum of DDO allocations for a department cannot exceed department totalGranted
    for (const grant of draft.budgetGrants) {
      const sumAllocated = draft.ddoAllocations
        .filter((a) => a.grantId === grant.id)
        .reduce((acc, curr) => acc + curr.allocated, 0);

      if (round2(sumAllocated) > round2(grant.totalGranted)) {
        throw new Error(
          `Consistency Violation: Department ${grant.departmentId} DDO allocations sum (₹${sumAllocated}) exceeds grant total (₹${grant.totalGranted})`
        );
      }
    }
  }

  // Pure snapshot reader (Read-only, no lock needed)
  public getState(): DatabaseState {
    return JSON.parse(JSON.stringify(this.state));
  }

  public resetDemoData(): void {
    storageHelper.removeItem(LOCAL_STORAGE_KEY);
    const seed = getInitialSeedData();
    this.state = {
      ...seed,
      budgetChangeRequests: [],
      nextBillNumber: 68,
      nextRtgsNumber: 2,
    };
    this.persist(this.state);
  }

  // Append-only audit logger
  public appendAuditLog(
    draft: DatabaseState,
    log: Omit<AuditLog, 'id' | 'timestamp'>
  ): AuditLog {
    const entry: AuditLog = {
      ...log,
      id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };
    draft.auditLogs.unshift(entry);
    return entry;
  }
}

export const db = new MockDatabase();
