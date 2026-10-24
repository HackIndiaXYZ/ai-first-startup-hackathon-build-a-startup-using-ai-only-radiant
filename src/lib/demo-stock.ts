export interface DemoStockProduct {
  name: string;
  unit: string;
  price: number;
  stock_qty: number;
  reorder_level: number;
}

/**
 * Curated list of popular Indian Kirana store products.
 * Roman-script English and Hinglish names only (zero Devanagari).
 * Includes realistic prices, units, and 4 low-stock items (stock <= reorder_level)
 * to demonstrate low-stock alerts, restock workflows, and supplier reorder messages.
 */
export const DEMO_STOCK_PRODUCTS: DemoStockProduct[] = [
  {
    name: "Aashirvaad Shudh Chakki Atta 5kg",
    unit: "packet",
    price: 225.0,
    stock_qty: 24,
    reorder_level: 5,
  },
  {
    name: "Fortune Sunlite Refined Oil 1L",
    unit: "l",
    price: 145.0,
    stock_qty: 3, // Low stock (3 <= 6)
    reorder_level: 6,
  },
  {
    name: "Tata Salt Desh Ka Namak 1kg",
    unit: "packet",
    price: 28.0,
    stock_qty: 50,
    reorder_level: 10,
  },
  {
    name: "Amul Taaza Toned Milk 500ml",
    unit: "packet",
    price: 32.0,
    stock_qty: 3, // Low stock (3 <= 8)
    reorder_level: 8,
  },
  {
    name: "Madhur Pure Sugar 1kg",
    unit: "kg",
    price: 48.0,
    stock_qty: 45,
    reorder_level: 10,
  },
  {
    name: "Maggi 2-Minute Masala Noodles 70g",
    unit: "packet",
    price: 14.0,
    stock_qty: 60,
    reorder_level: 15,
  },
  {
    name: "Amul Butter Pasteurized 100g",
    unit: "piece",
    price: 58.0,
    stock_qty: 2, // Low stock (2 <= 5)
    reorder_level: 5,
  },
  {
    name: "Toor Dal Desi 1kg",
    unit: "kg",
    price: 155.0,
    stock_qty: 4, // Low stock (4 <= 8)
    reorder_level: 8,
  },
  {
    name: "Taj Mahal Tea Leaves 250g",
    unit: "packet",
    price: 160.0,
    stock_qty: 2, // Low stock (2 <= 4)
    reorder_level: 4,
  },
  {
    name: "Parle-G Original Glucose 250g",
    unit: "packet",
    price: 25.0,
    stock_qty: 35,
    reorder_level: 8,
  },
];

/**
 * Filters DEMO_STOCK_PRODUCTS to find items not yet in the shop's inventory.
 * Compares normalized lowercased names.
 */
export function getMissingDemoProducts(existingProductNames: string[]): DemoStockProduct[] {
  const existingSet = new Set(
    existingProductNames.map((n) => n.trim().toLowerCase())
  );
  return DEMO_STOCK_PRODUCTS.filter(
    (item) => !existingSet.has(item.name.trim().toLowerCase())
  );
}

/**
 * Validates a Shop Name.
 * Must be at least 2 characters long after trimming.
 */
export function validateShopName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: "Shop name cannot be empty." };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: "Shop name must be at least 2 characters." };
  }
  return { valid: true };
}

/**
 * Validates Indian GSTIN (Goods and Services Tax Identification Number).
 * GSTIN is 15 alphanumeric characters:
 * - 2 digits (State code)
 * - 10 characters (PAN)
 * - 1 character (Entity code)
 * - 'Z' (Default character)
 * - 1 character (Checksum digit)
 *
 * Blank/empty is valid (for unregistered small kirana shops).
 */
export function validateGstin(gstin: string): { valid: boolean; formatted: string | null; error?: string } {
  const trimmed = gstin.trim().toUpperCase();
  if (!trimmed) {
    return { valid: true, formatted: null };
  }

  // Check 15-char alphanumeric format
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (trimmed.length !== 15 || !gstinRegex.test(trimmed)) {
    return {
      valid: false,
      formatted: trimmed,
      error: "Please enter a valid 15-character GSTIN (e.g. 07AAAAA0000A1Z5) or leave blank if unregistered.",
    };
  }

  return { valid: true, formatted: trimmed };
}
