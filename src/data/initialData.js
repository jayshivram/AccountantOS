import { uuid } from '../utils/index.js';

// Pre-seeded client list based on prompt specification
// These 18 clients are tagged with PAYE. Additional clients tagged with VAT bring total to 22.

export const INITIAL_CLIENTS = [
  { id: uuid(), name: 'AL AHAD',                  taxTypes: ['VAT', 'PAYE', 'SDL', 'NSSF', 'WCF', 'ROI'],              tallyYears: [2024, 2025], notes: '' },
  { id: uuid(), name: 'AL KARIM',                 taxTypes: ['VAT', 'PAYE', 'SDL', 'NSSF', 'WCF', 'ROI'],              tallyYears: [2024, 2025], notes: '' },
  { id: uuid(), name: 'ALBASHA',                  taxTypes: ['PAYE', 'SDL', 'NSSF', 'WCF', 'ROI'],                     tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'ALFA HARDWARE',            taxTypes: ['VAT', 'PAYE', 'SDL', 'ROI'],                             tallyYears: [2024, 2025], notes: '' },
  { id: uuid(), name: 'AMAAN GLASS',              taxTypes: ['VAT', 'PAYE', 'SDL', 'NSSF', 'WCF', 'ROI'],              tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'BITS & BYTES',             taxTypes: ['VAT', 'PAYE', 'SDL', 'CITY_LEVY', 'ROI'],                tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'CSS LIMITED',              taxTypes: ['VAT', 'PAYE', 'SDL', 'PROVISIONAL', 'CITY_LEVY', 'ROI'], tallyYears: [2024, 2025], notes: '' },
  { id: uuid(), name: 'CSS WORKSHOP',             taxTypes: ['PAYE', 'SDL', 'NSSF', 'WCF', 'ROI'],                     tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'DIGIFINIX',                taxTypes: ['VAT', 'PAYE', 'SDL', 'ROI'],                             tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'GEO MICRO',                taxTypes: ['VAT', 'PAYE', 'SDL', 'NSSF', 'WCF', 'ROI'],              tallyYears: [2024, 2025], notes: '' },
  { id: uuid(), name: 'PISCES STORE',             taxTypes: ['PAYE', 'SDL', 'ROI'],                                    tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'SA GLOBAL',                taxTypes: ['VAT', 'PAYE', 'SDL', 'PROVISIONAL', 'ROI'],              tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'SCIENCESCOPE INTERNATIONAL', taxTypes: ['VAT', 'PAYE', 'SDL', 'NSSF', 'WCF', 'PROVISIONAL', 'ROI'], tallyYears: [2024, 2025], notes: '' },
  { id: uuid(), name: 'SHAFIQ HASSAN OSMAN',      taxTypes: ['PAYE', 'SDL', 'ROI'],                                    tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'VIAB',                     taxTypes: ['VAT', 'PAYE', 'SDL', 'CITY_LEVY', 'PROVISIONAL', 'ROI'], tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'ZEETECH SUPERSTORE',       taxTypes: ['VAT', 'PAYE', 'SDL', 'NSSF', 'WCF', 'ROI'],              tallyYears: [2024, 2025], notes: '' },
  { id: uuid(), name: 'AKMENITE LIMITED',         taxTypes: ['VAT', 'PAYE', 'SDL', 'PROVISIONAL', 'CITY_LEVY', 'ROI'], tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'TWIGA EPSILON LTD',        taxTypes: ['VAT', 'PAYE', 'SDL', 'NSSF', 'WCF', 'CITY_LEVY', 'ROI'], tallyYears: [2024, 2025], notes: '' },
  { id: uuid(), name: 'EAST AFRICA TRADERS',      taxTypes: ['VAT', 'NSSF', 'WCF', 'ROI'],                            tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'HARBOUR TECH LTD',         taxTypes: ['VAT', 'ROI'],                                            tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'SUNRISE SOLUTIONS',        taxTypes: ['VAT', 'PROVISIONAL', 'ROI'],                             tallyYears: [2025],       notes: '' },
  { id: uuid(), name: 'DELTA IMPORTS',            taxTypes: ['VAT', 'CITY_LEVY', 'ROI'],                               tallyYears: [2025],       notes: '' },
];

export const INITIAL_TAX_RETURNS = [];
export const INITIAL_TASKS = [];
