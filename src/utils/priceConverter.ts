// Price conversion utilities

// Constants
const GRAMS_PER_TROY_OUNCE = 31.1035;
const USD_TO_INR_RATE = 83; // Current approximate exchange rate

export type CurrencyUnit = 'USD/oz' | 'INR/g';

/**
 * Convert price between currency units
 * Note: The API returns prices in INR/g, so when targetUnit is 'INR/g', return as-is
 * When targetUnit is 'USD/oz', convert from INR/g to USD/oz
 */
export function convertPrice(price: number, targetUnit: CurrencyUnit): number {
  // API returns prices in INR/g format
  // If target is INR/g, return as-is (no conversion needed)
  if (targetUnit === 'INR/g') {
    return price;
  }
  
  // Convert from INR/g to USD/oz
  // First convert INR/g to INR/oz, then to USD/oz
  const priceInInrPerOz = price * GRAMS_PER_TROY_OUNCE;
  const priceInUsdPerOz = priceInInrPerOz / USD_TO_INR_RATE;
  
  return priceInUsdPerOz;
}

/**
 * Format price with appropriate currency symbol, thousand separators, and decimals
 */
export function formatPrice(price: number | string, unit: CurrencyUnit): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numPrice)) {
    return unit === 'USD/oz' ? '$0.00' : '₹0.00';
  }
  
  if (unit === 'USD/oz') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numPrice);
  }
  
  // Format INR with thousand separators
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numPrice);
}

/**
 * Get the unit label for display
 */
export function getUnitLabel(unit: CurrencyUnit): string {
  return unit;
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(unit: CurrencyUnit): string {
  return unit === 'USD/oz' ? '$' : '₹';
}