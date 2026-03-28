/**
 * Vendor types — describes IT vendor and product data structures.
 */

/** A vendor record in the knowledge base. */
export interface Vendor {
  id: string;
  name: string;
  description: string;
  products: Product[];
  supportContacts: SupportContact[];
}

/** A product offered by a vendor. */
export interface Product {
  id: string;
  vendorId: string;
  name: string;
  version: string;
  category: string;
  tags: string[];
}

/** A support contact entry. */
export interface SupportContact {
  name: string;
  email: string;
  phone?: string;
  tier: 'L1' | 'L2' | 'L3';
}
