import { supabase } from '../lib/supabase';

/**
 * Generates next unique weaving order numbers in bulk to prevent race conditions during insertion.
 * 
 * - In-House: AT/YYYY/WVOF/(S or B/00001)/00001
 * - Job Work: AT/YYYY/WVOF/(S or B/00001)/PARTNER_NAME/MACHINE_NUMBER/001
 */
export async function generateWeavingNumbersBulk(weavingType, partnerName, machineName, orderNumber, count) {
  const year = new Date().getFullYear();
  const numbers = [];

  if (weavingType === 'in_house') {
    // Standardized: AT/{YYYY}/WVOF/{seq}
    const prefix = `AT/${year}/WVOF/`;
    const { data } = await supabase
      .from('weaving_orders')
      .select('weaving_number')
      .eq('weaving_type', 'in_house')
      .ilike('weaving_number', `${prefix}%`);
    
    const baseCount = data ? data.length : 0;
    for (let i = 0; i < count; i++) {
      const seq = String(baseCount + 1 + i).padStart(5, '0');
      numbers.push(`${prefix}${seq}`);
    }
  } else {
    // Job Work: AT/{YYYY}/WVOF/JB/{partner_SLUG}/{seq}
    const partnerSlug = (partnerName || 'PENDING').replace(/\s+/g, '').toUpperCase();
    const prefix = `AT/${year}/WVOF/JB/${partnerSlug}/`;
    
    const { data } = await supabase
      .from('weaving_orders')
      .select('weaving_number')
      .ilike('weaving_number', `${prefix}%`);
    
    const baseCount = data ? data.length : 0;
    for (let i = 0; i < count; i++) {
      const seq = String(baseCount + 1 + i).padStart(5, '0');
      numbers.push(`${prefix}${seq}`);
    }
  }
  return numbers;
}
