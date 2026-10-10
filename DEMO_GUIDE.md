# 🎯 GBA Corporation DC-BMS — Client & Interview Demo Guide

This guide gives you an exact talking script and walkthrough to demonstrate the system in **5 to 8 minutes** for client pitches or technical engineering interviews.

---

## ⚡ Quick Demo Pitch (30-second elevator intro)
> *"Welcome! This is the DC Bill Management System built for Greater Bengaluru Authority (GBA Corporation). It automates and enforces financial governance over Detailed Contingent municipal bills across engineering, transport, and municipal accounts. It features strict 7-tier RBAC, mathematical gross budget reservations that prevent overspending, 16 statutory deductions, and automated offline RTGS advice generation with print-ready government letterheads."*

---

## 🔑 Demo Accounts & Credentials Cheat Sheet

All accounts are pre-seeded and accessible via the **1-Click Role Switcher** in the top navigation bar, or via the **Sign In** modal:

| Role | Name | Email | Focus / Key Capability |
|---|---|---|---|
| **Super Admin** | Rajesh Rao | `rajesh.admin@gba.karnataka.gov.in` | Masters, User-DDO Mappings, Audit Diff, CSV Export |
| **Director of Finance** | Suresh Kumar, IAS | `suresh.df@gba.karnataka.gov.in` | Macro Department Grants (₹10 Cr, ₹25 Cr) |
| **Finance Officer** | Meera Nambiar, KAS | `meera.fo@gba.karnataka.gov.in` | DDO Caps, Allocation Floor, Change Requests |
| **Creator 1** | Ramesh Gowda | `ramesh.cr@gba.karnataka.gov.in` | DDO 100234 (Transport Road Infrastructure) |
| **Creator 2** | Anand Kulkarni | `anand.cr@gba.karnataka.gov.in` | DDO 100567 (Engineering Major Roads North) |
| **Creator 3** | Sunil Hegde | `sunil.cr@gba.karnataka.gov.in` | **DDO 100235 (Budget Near Limit: ₹5.5L remaining)** |
| **Verifier** | Priya Sharma | `priya.vr@gba.karnataka.gov.in` | Strict Read-Only Scrutiny & Mandatory Remarks |
| **Approver** | Dr. K. Venkatesh | `k.venkatesh@gba.karnataka.gov.in` | Sanction Accordance & Forward to RTGS |
| **RTGS Manager** | Sunita Patil | `sunita.rtgs@gba.karnataka.gov.in` | Multi-select Batching & Official Bank Advice Print |

---

## 🎬 5-Minute Step-by-Step Walkthrough

### Scenario 1: Demonstrating the Budget Boundary Block
1. In the top bar, click **Creator** $\rightarrow$ select profile **Sunil Hegde (DDO 100235)**.
2. Point out the top header bar: **DDO 100235 has only ₹5,50,000 remaining**.
3. Click **Create New DC Bill**.
4. In **Base Value**, type `600000` (Gross with 18% GST = `₹7,08,000`).
5. **Show the interviewer/client:**
   - The **Sticky Budget Widget** on the right flashes red.
   - Shows exact error: **"Insufficient DDO Budget Balance."**
   - The **Submit for Verification** button is strictly disabled.
6. Now change **Base Value** to `300000` (Gross = `₹3,54,000`).
7. The widget turns green, displaying remaining after bill as `₹1,96,000`.
8. Click **Submit for Verification** $\rightarrow$ Bill is submitted, and budget is reserved in real time!

### Scenario 2: Demonstrating Strict Read-Only Scrutiny & Rejection Budget Refund
1. Switch role to **Verifier (Priya Sharma)**.
2. Navigate to **Verification Queue**.
3. Click **Scrutinize & Review** on the newly submitted bill.
4. **Point out to interviewer:**
   - Every field (vendor, taxes, 16 deductions, MB vouchers) is rendered as **plain text**—no inputs exist on screen.
5. In the remarks box, type: *"Discrepancy in measurement book page 12. Rejected for revision."*
6. Click **Reject with Remarks**.
7. Switch back to Creator or Finance Officer $\rightarrow$ point out that the **₹3,54,000 reserved budget has been immediately refunded** to DDO 100235!

### Scenario 3: Demonstrating Batch RTGS Advice & Dual Signatories
1. Switch role to **RTGS Manager (Sunita Patil)**.
2. In the table of **Pending Release** bills:
   - Check 2 or 3 bills.
   - Point out the **Running Total Net Disbursement** updating in real time in the purple banner.
3. Select debit account: **Canara Bank - Bangalore City Corporation Branch**.
4. Click **Generate RTGS Advice**.
5. The print-ready modal opens showing:
   - Official municipal letterhead.
   - Beneficiary table formatted for banking clearing.
   - Total amount in figures and **words in Indian system** (*Crores / Lakhs*).
   - Dual-signatory blocks: Senior Accounts Officer and Finance Controller.
6. Click **Print / Save as PDF** to show printer styling.

### Scenario 4: Automated Verification Suite
1. In the top navigation bar, click **Run Vitest Suite**.
2. Show the interviewer the live scorecard: **10 / 10 Passing Tests**.
3. Highlight that tests verify:
   - ACID Promise queue serialization under concurrent race conditions.
   - Exact boundary enforcement (`gross == remaining` passes, `+₹0.01` fails).
   - Rejection budget release.
   - Atomic rollback if one bill in an RTGS batch is invalid.
   - Strict DDO isolation and read-only permission denial.
