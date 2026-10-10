export interface FinancialInput {
  baseValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  deductions: { label: string; amount: number }[];
}

export interface FinancialResult {
  baseValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  grossValue: number;
  totalDeductions: number;
  netPayable: number;
  isValid: boolean;
  error?: string;
}

/**
 * Pure calculation function for DC Bill financials
 * grossValue = baseValue + cgst + sgst + igst
 * totalDeductions = sum(deductions[1..16])
 * netPayable = grossValue - totalDeductions (cannot be negative)
 */
export function calculateBillFinancials(input: FinancialInput): FinancialResult {
  const baseValue = Number(input.baseValue) || 0;
  const cgst = Number(input.cgst) || 0;
  const sgst = Number(input.sgst) || 0;
  const igst = Number(input.igst) || 0;

  if (baseValue < 0 || cgst < 0 || sgst < 0 || igst < 0) {
    return {
      baseValue,
      cgst,
      sgst,
      igst,
      grossValue: 0,
      totalDeductions: 0,
      netPayable: 0,
      isValid: false,
      error: 'Financial amounts cannot be negative.',
    };
  }

  const grossValue = round2(baseValue + cgst + sgst + igst);

  let totalDeductions = 0;
  for (const item of input.deductions) {
    const amt = Number(item.amount) || 0;
    if (amt < 0) {
      return {
        baseValue,
        cgst,
        sgst,
        igst,
        grossValue,
        totalDeductions: 0,
        netPayable: 0,
        isValid: false,
        error: `Deduction '${item.label}' cannot be negative.`,
      };
    }
    totalDeductions += amt;
  }
  totalDeductions = round2(totalDeductions);

  const netPayable = round2(grossValue - totalDeductions);

  if (netPayable < 0) {
    return {
      baseValue,
      cgst,
      sgst,
      igst,
      grossValue,
      totalDeductions,
      netPayable,
      isValid: false,
      error: 'Total deductions exceed Gross Value. Net Payable cannot be negative.',
    };
  }

  return {
    baseValue,
    cgst,
    sgst,
    igst,
    grossValue,
    totalDeductions,
    netPayable,
    isValid: true,
  };
}

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Format currency in Indian numbering system (e.g., ₹ 1,25,00,000.00)
 */
export function formatINR(val: number | undefined | null): string {
  if (val === undefined || val === null || isNaN(val)) {
    return '₹ 0.00';
  }
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const parts = absVal.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian numbering pattern: last 3 digits, then groups of 2 digits
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const res = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹ ${res}.${decimalPart}`;
}

/**
 * Convert number to words in Indian numbering system (Crores, Lakhs, Thousands, Hundreds, Rupees, Paise)
 */
export function numberToIndianWords(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) {
    return 'Zero Rupees Only';
  }

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    const unit = n % 10;
    return tens[Math.floor(n / 10)] + (unit > 0 ? ' ' + ones[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    if (n === 0) return '';
    const hundred = Math.floor(n / 100);
    const rem = n % 100;
    let res = '';
    if (hundred > 0) {
      res += ones[hundred] + ' Hundred';
    }
    if (rem > 0) {
      if (res.length > 0) res += ' and ';
      res += convertTwoDigits(rem);
    }
    return res;
  }

  const absAmount = Math.abs(amount);
  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let temp = rupees;
  const crore = Math.floor(temp / 10000000);
  temp %= 10000000;
  const lakh = Math.floor(temp / 100000);
  temp %= 100000;
  const thousand = Math.floor(temp / 1000);
  temp %= 1000;
  const remainder = temp;

  const parts: string[] = [];
  if (crore > 0) {
    parts.push(convertTwoDigits(crore) + ' Crore');
  }
  if (lakh > 0) {
    parts.push(convertTwoDigits(lakh) + ' Lakh');
  }
  if (thousand > 0) {
    parts.push(convertTwoDigits(thousand) + ' Thousand');
  }
  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }

  let words = parts.join(' ').trim();
  if (!words) words = 'Zero';

  words += ' Rupees';

  if (paise > 0) {
    words += ' and ' + convertTwoDigits(paise) + ' Paise';
  }

  return words + ' Only';
}
