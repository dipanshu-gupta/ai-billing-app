// @ts-nocheck
// ─── Tax Regime Configuration ───────────────────────────────────────────────
// Determines which tax fields/labels to show based on the application's
// default currency (set in Admin Tools → App Preferences).
//
// Three regimes are fully defined:
//  - INR → India GST (CGST + SGST for intra-state, IGST for inter-state, HSN/SAC code)
//  - USD → US Sales Tax (single rate, varies by state, + state code)
//  - GBP → UK VAT (single rate, standard 20%, + VAT Registration Number)
//
// All other currencies fall back to a generic "Tax Rate %" field.

export type TaxRegime = 'india_gst' | 'us_sales_tax' | 'uk_vat' | 'generic';

export interface TaxFieldDef {
  key: string;
  label: string;
  type: 'number' | 'text' | 'select';
  opts?: string[];
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
}

export interface TaxRegimeConfig {
  regime: TaxRegime;
  regimeLabel: string;
  currency: string;
  // Fields shown on PRODUCT records (tax classification / registration info)
  productFields: TaxFieldDef[];
  // Fields shown on ORDER / INVOICE line items (per-line tax breakdown)
  lineItemFields: TaxFieldDef[];
  // Fields shown on the ORDER / INVOICE header (e.g. place of supply, VAT no.)
  documentFields: TaxFieldDef[];
  // Compute tax amount(s) for a line item given quantity, unit price, discount %
  // and the line's tax field values. Returns a breakdown + total tax.
  computeLineTax: (line: any, ctx?: { sameState?: boolean }) => { breakdown: Record<string, number>; totalTax: number };
  // Short label shown in summary rows (e.g. "GST", "Sales Tax", "VAT")
  shortLabel: string;
}

const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana',
  'Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur',
  'Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

const REGIMES: Record<TaxRegime, Omit<TaxRegimeConfig, 'currency'>> = {
  india_gst: {
    regime: 'india_gst',
    regimeLabel: 'India GST',
    shortLabel: 'GST',
    productFields: [
      { key: 'hsn_code', label: 'HSN / SAC Code', type: 'text', placeholder: 'e.g. 8471 / 998313', helpText: 'Harmonized System of Nomenclature code for goods, or Services Accounting Code for services' },
      { key: 'gst_rate', label: 'GST Rate (%)', type: 'select', opts: ['0', '0.25', '3', '5', '12', '18', '28'], defaultValue: '18' },
    ],
    lineItemFields: [
      { key: 'hsn_code', label: 'HSN/SAC', type: 'text', placeholder: 'HSN/SAC' },
      { key: 'gst_rate', label: 'GST %', type: 'select', opts: ['0', '0.25', '3', '5', '12', '18', '28'], defaultValue: '18' },
    ],
    documentFields: [
      { key: 'place_of_supply', label: 'Place of Supply (State)', type: 'select', opts: INDIA_STATES, helpText: 'Determines whether CGST+SGST or IGST applies' },
      { key: 'gstin', label: 'Customer GSTIN', type: 'text', placeholder: '22AAAAA0000A1Z5' },
    ],
    computeLineTax: (line, ctx) => {
      const net = Number(line.quantity || 1) * Number(line.unit_price ?? line.price ?? 0) * (1 - Number(line.discount_pct ?? line.discount ?? 0) / 100);
      const rate = Number(line.gst_rate ?? 18);
      const sameState = ctx?.sameState !== false; // default: intra-state (CGST+SGST)
      if (sameState) {
        const half = (net * rate) / 200; // rate/2 as percent
        return { breakdown: { cgst: half, sgst: half }, totalTax: half * 2 };
      }
      const igst = (net * rate) / 100;
      return { breakdown: { igst }, totalTax: igst };
    },
  },

  us_sales_tax: {
    regime: 'us_sales_tax',
    regimeLabel: 'US Sales Tax',
    shortLabel: 'Sales Tax',
    productFields: [
      { key: 'taxable', label: 'Taxable Item', type: 'select', opts: ['Yes', 'No'], defaultValue: 'Yes' },
      { key: 'tax_category', label: 'Tax Category', type: 'select', opts: ['General Merchandise', 'Food & Grocery', 'Clothing', 'Digital Goods', 'Services', 'Exempt'], defaultValue: 'General Merchandise' },
    ],
    lineItemFields: [
      { key: 'taxable', label: 'Taxable', type: 'select', opts: ['Yes', 'No'], defaultValue: 'Yes' },
      { key: 'sales_tax_rate', label: 'Sales Tax %', type: 'number', defaultValue: 0, placeholder: 'e.g. 7.25' },
    ],
    documentFields: [
      { key: 'tax_state', label: 'State', type: 'select', opts: US_STATES, helpText: 'State where the sale/shipment is taxed' },
      { key: 'resale_certificate', label: 'Resale Certificate #', type: 'text', placeholder: 'Optional — for tax-exempt resale' },
    ],
    computeLineTax: (line) => {
      const net = Number(line.quantity || 1) * Number(line.unit_price ?? line.price ?? 0) * (1 - Number(line.discount_pct ?? line.discount ?? 0) / 100);
      const taxable = (line.taxable ?? 'Yes') === 'Yes';
      const rate = Number(line.sales_tax_rate ?? 0);
      const tax = taxable ? (net * rate) / 100 : 0;
      return { breakdown: { sales_tax: tax }, totalTax: tax };
    },
  },

  uk_vat: {
    regime: 'uk_vat',
    regimeLabel: 'UK VAT',
    shortLabel: 'VAT',
    productFields: [
      { key: 'vat_rate', label: 'VAT Rate (%)', type: 'select', opts: ['0', '5', '20'], defaultValue: '20', helpText: '0% Zero-rated · 5% Reduced · 20% Standard' },
    ],
    lineItemFields: [
      { key: 'vat_rate', label: 'VAT %', type: 'select', opts: ['0', '5', '20'], defaultValue: '20' },
    ],
    documentFields: [
      { key: 'vat_registration_number', label: 'VAT Registration Number', type: 'text', placeholder: 'GB123456789' },
    ],
    computeLineTax: (line) => {
      const net = Number(line.quantity || 1) * Number(line.unit_price ?? line.price ?? 0) * (1 - Number(line.discount_pct ?? line.discount ?? 0) / 100);
      const rate = Number(line.vat_rate ?? 20);
      const vat = (net * rate) / 100;
      return { breakdown: { vat }, totalTax: vat };
    },
  },

  generic: {
    regime: 'generic',
    regimeLabel: 'Generic Tax',
    shortLabel: 'Tax',
    productFields: [
      { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number', defaultValue: 0, placeholder: 'e.g. 10' },
    ],
    lineItemFields: [
      { key: 'tax_pct', label: 'Tax %', type: 'number', defaultValue: 0 },
    ],
    documentFields: [
      { key: 'tax_registration_number', label: 'Tax Registration Number', type: 'text', placeholder: 'Optional' },
    ],
    computeLineTax: (line) => {
      const net = Number(line.quantity || 1) * Number(line.unit_price ?? line.price ?? 0) * (1 - Number(line.discount_pct ?? line.discount ?? 0) / 100);
      const rate = Number(line.tax_pct ?? 0);
      const tax = (net * rate) / 100;
      return { breakdown: { tax }, totalTax: tax };
    },
  },
};

// Map currency code → tax regime
const CURRENCY_REGIME_MAP: Record<string, TaxRegime> = {
  INR: 'india_gst',
  USD: 'us_sales_tax',
  GBP: 'uk_vat',
};

export function getTaxRegime(currency: string | undefined): TaxRegimeConfig {
  const cur = (currency || 'INR').toUpperCase();
  const regimeKey = CURRENCY_REGIME_MAP[cur] || 'generic';
  return { ...REGIMES[regimeKey], currency: cur };
}

// Convenience: list of all regimes for admin preview/testing
export const ALL_TAX_REGIMES = Object.keys(REGIMES) as TaxRegime[];
export { INDIA_STATES, US_STATES };
