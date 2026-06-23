import { supabase } from '../lib/supabase';

/**
 * Generates next unique weaving order numbers in bulk.
 * 
 * - In-House: AT/YYYY/WVOF/00001
 * - Job Work: AT/YYYY/WVOF/JB/PARTNER_SLUG/00001
 * 
 * Uses max sequence parsing from existing weaving numbers.
 * Falls back to retry logic if a duplicate key conflict occurs.
 */
export async function generateWeavingNumbersBulk(weavingType, partnerName, machineName, orderNumber, count) {
  const year = new Date().getFullYear();
  const numbers = [];

  if (weavingType === 'in_house') {
    const prefix = `AT/${year}/WVOF/`;
    const maxSeq = await getMaxSeq(prefix, 'in_house');
    for (let i = 0; i < count; i++) {
      const seq = String(maxSeq + 1 + i).padStart(5, '0');
      numbers.push(`${prefix}${seq}`);
    }
  } else {
    const partnerSlug = (partnerName || 'PENDING').replace(/\s+/g, '').toUpperCase();
    const prefix = `AT/${year}/WVOF/JB/${partnerSlug}/`;
    const maxSeq = await getMaxSeq(prefix, null);
    for (let i = 0; i < count; i++) {
      const seq = String(maxSeq + 1 + i).padStart(5, '0');
      numbers.push(`${prefix}${seq}`);
    }
  }
  return numbers;
}

/**
 * Gets the max sequence number for a given prefix.
 * Uses two strategies:
 * 1. Query with the authenticated user's session (may work with RLS)
 * 2. If no data returned, try ordering by weaving_number DESC to find max
 */
async function getMaxSeq(prefix, weavingType) {
  try {
    // Strategy 1: Query all matching rows and parse max
    let query = supabase
      .from('weaving_orders')
      .select('weaving_number')
      .ilike('weaving_number', `${prefix}%`);
    
    if (weavingType) {
      query = query.eq('weaving_type', weavingType);
    }
    
    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      let maxSeq = 0;
      data.forEach(row => {
        const remainder = row.weaving_number.replace(prefix, '');
        const numPart = remainder.split('/')[0];
        const parsed = parseInt(numPart, 10);
        if (!isNaN(parsed) && parsed > maxSeq) maxSeq = parsed;
      });
      return maxSeq;
    }

    // Strategy 2: Try ordering DESC and limit 1 to get the highest number
    let query2 = supabase
      .from('weaving_orders')
      .select('weaving_number')
      .ilike('weaving_number', `${prefix}%`)
      .order('weaving_number', { ascending: false })
      .limit(1);
    
    if (weavingType) {
      query2 = query2.eq('weaving_type', weavingType);
    }

    const { data: data2 } = await query2;
    if (data2 && data2.length > 0) {
      const remainder = data2[0].weaving_number.replace(prefix, '');
      const numPart = remainder.split('/')[0];
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) return parsed;
    }

    return 0;
  } catch (err) {
    console.error('Error getting max weaving sequence:', err);
    return 0;
  }
}

/**
 * Insert weaving orders with retry on duplicate key conflict.
 * If a duplicate key error occurs, it re-generates numbers and retries.
 */
export async function insertWeavingOrdersWithRetry(payload, weavingSplits, weavingType, partnerName, machineName, orderNumber, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Re-generate numbers on each attempt (after the first)
    if (attempt > 0) {
      const groups = {};
      weavingSplits.forEach((s, idx) => {
        const key = `${s.weaving_type}|${s.partner_name || ''}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push({ split: s, index: idx });
      });

      const weavingNumbers = new Array(weavingSplits.length);
      for (const key of Object.keys(groups)) {
        const [wType, pName] = key.split('|');
        const groupItems = groups[key];
        const generated = await generateWeavingNumbersBulk(wType, pName || null, null, orderNumber, groupItems.length);
        groupItems.forEach((item, i) => {
          weavingNumbers[item.index] = generated[i];
        });
      }

      // Update payload with new numbers
      payload = payload.map((p, idx) => ({
        ...p,
        weaving_number: weavingNumbers[idx]
      }));
    }

    const { data, error } = await supabase
      .from('weaving_orders')
      .insert(payload)
      .select();

    if (!error) return { data, error: null };

    if (error.message && error.message.includes('duplicate key') && attempt < maxRetries - 1) {
      console.warn(`Duplicate key on attempt ${attempt + 1}, retrying with new numbers...`);
      continue;
    }

    return { data: null, error };
  }
  return { data: null, error: { message: 'Max retries exceeded for weaving number generation' } };
}
