import { uuid } from '../utils/index.js';

// Pre-seeded client list based on prompt specification
// These 18 clients are tagged with PAYE. Additional clients tagged with VAT bring total to 22.

export const INITIAL_CLIENTS = [];

export const INITIAL_TAX_RETURNS = [];
export const INITIAL_TASKS = [];

export const DEFAULT_MONTHLY_TASKS = [
  'Bank Statements',
  'Tally Update',
  'Stock Sheet',
  'Purchase Reconciliation',
  'VAT Computation',
];

export const DEFAULT_TAX_RATES = {
  VAT: 0.18,
  CORPORATE: 0.30,
  NSSF_EMPLOYEE: 0.10,
  NSSF_EMPLOYER: 0.10,
  SDL: 0.035,
  SDL_MIN_EMPLOYEES: 10,
  WCF: 0.005,
  CITY_LEVY_OLD: 0.0030,
  CITY_LEVY_NEW: 0.0025,
  CITY_LEVY_CHANGE_YEAR: 2025,
  CITY_LEVY_CHANGE_QUARTER: 3,
  WHT: {
    rent: 0.10,
    dividend_resident: 0.05,
    dividend_non_resident: 0.10,
    interest_resident: 0.10,
    interest_non_resident: 0.10,
    royalty_resident: 0.15,
    royalty_non_resident: 0.15,
    service_fee_resident: 0.05,
    service_fee_non_resident: 0.15,
    technical_fee_resident: 0.05,
    technical_fee_non_resident: 0.15,
    commission_resident: 0.05,
    commission_non_resident: 0.15,
    insurance_premium: 0.05,
    pension_lump_sum: 0.05,
    natural_resource: 0.15,
    aircraft_lease: 0.05,
    ship_lease: 0.05,
    other_non_resident: 0.15,
  },
  PAYE_BANDS: [
    { min: 0,       max: 270000,  rate: 0,    fixed: 0 },
    { min: 270000,  max: 520000,  rate: 0.08, fixed: 0 },
    { min: 520000,  max: 760000,  rate: 0.20, fixed: 20000 },
    { min: 760000,  max: 1000000, rate: 0.25, fixed: 68000 },
    { min: 1000000, max: Infinity, rate: 0.30, fixed: 128000 },
  ],
  PROV_BANDS: [
    { min: 0,        max: 3240000,  rate: 0,    fixed: 0 },
    { min: 3240000,  max: 6240000,  rate: 0.08, fixed: 0 },
    { min: 6240000,  max: 9120000,  rate: 0.20, fixed: 240000 },
    { min: 9120000,  max: 12000000, rate: 0.25, fixed: 816000 },
    { min: 12000000, max: Infinity, rate: 0.30, fixed: 1536000 },
  ],
};
