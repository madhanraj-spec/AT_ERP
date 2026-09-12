// Industry Standard Crimp & Wastage Tables
export const WARP_CRIMP_TABLE = {
  'Plain': { light: 7.0, medium: 8.0, heavy: 10.0 },
  '2/1 Twill': { light: 5.5, medium: 6.5, heavy: 8.0 },
  '2/2 Twill': { light: 5.0, medium: 6.0, heavy: 7.0 },
  '3/1 Twill': { light: 4.0, medium: 5.0, heavy: 6.0 },
  'Oxford': { light: 6.0, medium: 7.0, heavy: 8.5 },
  'Herringbone': { light: 6.0, medium: 7.0, heavy: 8.0 },
  'Dobby': { light: 7.0, medium: 8.5, heavy: 10.0 },
  'Satin': { light: 3.0, medium: 4.0, heavy: 5.0 },
};

export const WEFT_CRIMP_TABLE = {
  'Plain': { light: 4.0, medium: 5.0, heavy: 6.5 },
  '2/1 Twill': { light: 3.0, medium: 4.0, heavy: 5.0 },
  '2/2 Twill': { light: 2.5, medium: 3.5, heavy: 4.5 },
  '3/1 Twill': { light: 2.0, medium: 3.0, heavy: 4.0 },
  'Oxford': { light: 3.5, medium: 4.5, heavy: 5.5 },
  'Herringbone': { light: 3.0, medium: 4.0, heavy: 5.0 },
  'Dobby': { light: 4.0, medium: 5.5, heavy: 7.0 },
  'Satin': { light: 2.0, medium: 2.5, heavy: 3.5 },
};

export const WARP_WASTAGE = {
  'Airjet': 3.0,
  'Rapier': 2.7,
  'Sulzer / Projectile': 2.5,
  'Shuttle': 3.5,
};

export const WEFT_WASTAGE = {
  'Airjet': 3.0,
  'Rapier': 1.5,
  'Sulzer / Projectile': 1.8,
  'Shuttle': 2.5,
};

export const STANDARD_BUNDLE_WEIGHT_KG = 4.6;
export const NE_CONVERSION_CONSTANT = 1693.33; // (840 × 2.20462) / 1.09361

export function getCrimpAndWastage(weaveType, reed, pick, loomType = 'Airjet') {
  const normWeave = Object.keys(WARP_CRIMP_TABLE).find(
    k => k.toLowerCase() === (weaveType || '').toLowerCase()
  ) || 'Plain';

  const reedNum = parseFloat(reed) || 68;
  const pickNum = parseFloat(pick) || 64;

  const warpDensity = reedNum < 60 ? 'light' : reedNum <= 90 ? 'medium' : 'heavy';
  const weftDensity = pickNum < 50 ? 'light' : pickNum <= 80 ? 'medium' : 'heavy';

  const warpCrimpRow = WARP_CRIMP_TABLE[normWeave] || WARP_CRIMP_TABLE['Plain'];
  const weftCrimpRow = WEFT_CRIMP_TABLE[normWeave] || WEFT_CRIMP_TABLE['Plain'];

  return {
    warpCrimp: (warpCrimpRow[warpDensity] || 8) / 100,
    weftCrimp: (weftCrimpRow[weftDensity] || 5) / 100,
    warpWastage: (WARP_WASTAGE[loomType] || 3.0) / 100,
    weftWastage: (WEFT_WASTAGE[loomType] || 3.0) / 100,
  };
}

export function parseEffectiveCount(countValue) {
  if (!countValue) return 40;
  const str = String(countValue).trim();

  // Multi-ply pattern: '2/40' or '2/40s' (ply / single)
  const prefixPly = str.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (prefixPly) {
    const ply = parseFloat(prefixPly[1]);
    const single = parseFloat(prefixPly[2]);
    if (ply > 0 && single > 0) {
      const actualPly = Math.min(ply, single);
      const actualSingle = Math.max(ply, single);
      return actualSingle / actualPly;
    }
  }

  // Multi-ply pattern: '40/2' or '40s/2' (single / ply)
  const suffixPly = str.match(/^(\d+(?:\.\d+)?)\s*(?:s|S)?\s*\/\s*(\d+(?:\.\d+)?)/);
  if (suffixPly) {
    const p1 = parseFloat(suffixPly[1]);
    const p2 = parseFloat(suffixPly[2]);
    if (p1 > 0 && p2 > 0) {
      const actualPly = Math.min(p1, p2);
      const actualSingle = Math.max(p1, p2);
      return actualSingle / actualPly;
    }
  }

  // Single count: '40s', '60', '80.5'
  const single = str.match(/(\d+(?:\.\d+)?)/);
  if (single) {
    const val = parseFloat(single[1]);
    if (val > 0) return val;
  }

  return 40;
}

export function getYarnCountPackingInfo(yarn, bundleWeight = STANDARD_BUNDLE_WEIGHT_KG) {
  const countStr = yarn?.count_value || (typeof yarn === 'string' ? yarn : '');
  const effCount = parseEffectiveCount(countStr);
  const knotsPerBundle = effCount;
  const kgPerKnot = knotsPerBundle > 0 ? (bundleWeight / knotsPerBundle) : 0;
  
  return {
    effCount,
    knotsPerBundle,
    bundleWeight,
    kgPerKnot,
    isMultiPly: String(countStr).includes('/')
  };
}

export function calculateWarpYarnKg(totalEnds, lengthMeters, countNe, crimpDecimal, wastageDecimal) {
  if (!totalEnds || !lengthMeters || !countNe) return 0;
  return Math.round((totalEnds * lengthMeters * (1 + crimpDecimal + wastageDecimal)) / (NE_CONVERSION_CONSTANT * countNe));
}

export function calculateWeftYarnKg(picksPerInchForColor, widthInches, lengthMeters, countNe, crimpDecimal, wastageDecimal) {
  if (!picksPerInchForColor || !widthInches || !lengthMeters || !countNe) return 0;
  return Math.round((picksPerInchForColor * widthInches * lengthMeters * (1 + crimpDecimal + wastageDecimal)) / (NE_CONVERSION_CONSTANT * countNe));
}

export function kgToBundlesKnots(kg, yarn, bundleWeight = STANDARD_BUNDLE_WEIGHT_KG) {
  const info = getYarnCountPackingInfo(yarn, bundleWeight);
  if (!kg || kg <= 0 || info.kgPerKnot <= 0) return { bundles: 0, knots: 0 };
  const totalKnots = Math.round(kg / info.kgPerKnot);
  const bundles = Math.floor(totalKnots / info.knotsPerBundle);
  const knots = totalKnots % info.knotsPerBundle;
  return { bundles, knots };
}

export function calculateKgFromBundlesKnots(yarn, bundles, knots, bundleWeight = STANDARD_BUNDLE_WEIGHT_KG) {
  const b = parseFloat(bundles) || 0;
  const k = parseFloat(knots) || 0;
  if (b === 0 && k === 0 && (bundles === '' || bundles === undefined) && (knots === '' || knots === undefined)) {
    return '';
  }
  
  const info = getYarnCountPackingInfo(yarn, bundleWeight);
  const totalKg = (b * info.bundleWeight) + (k * info.kgPerKnot);
  return totalKg > 0 ? Math.round(totalKg) : '';
}

export function flattenSequence(seq) {
  const flat = [];
  (seq || []).forEach(item => {
    if (item.type === 'chain') {
      const sr = parseFloat(item.subRepeats) || 1;
      for (let i = 0; i < sr; i++) {
        (item.entries || []).forEach(e => flat.push({ ...e }));
      }
    } else {
      flat.push({ countId: item.countId, color: item.color, ends: item.ends, picks: item.picks });
    }
  });
  return flat;
}

export function computeWarpDesignResults(technicalSpecs, yarnCounts = [], crimpOverrides = null) {
  const ts = technicalSpecs || {};
  const dd = ts.design_details || { warp_designs: [], weft_design: { sequence: [] } };
  const loomReed = parseFloat(ts.on_loom_reed) || parseFloat(ts.order_reed) || 0;
  const loomPick = parseFloat(ts.on_loom_pick) || parseFloat(ts.order_pick) || 0;
  const currentCrimp = crimpOverrides || dd.crimp_overrides || getCrimpAndWastage(ts.weave_type, loomReed, loomPick, ts.loom_type || 'Airjet');
  const prodQty = parseFloat(ts.production_quantity) || 0;

  return (dd.warp_designs || []).map((wd, wi) => {
    const repeats = parseFloat(wd.num_repeats) || 0;
    const extraThreads = parseFloat(wd.extra_threads) || 0;
    const flatEntries = flattenSequence(wd.sequence);
    const endsInOneRepeat = Math.round(flatEntries.reduce((s, e) => s + (parseFloat(e.ends) || 0), 0));
    const totalEnds = Math.round((endsInOneRepeat * repeats) + extraThreads);
    const calculatedWidth = loomReed > 0 ? (totalEnds / loomReed).toFixed(2) : '—';

    const colorMap = {};
    flatEntries.forEach(e => {
      const key = `${e.countId}||${e.color}`;
      if (!colorMap[key]) colorMap[key] = { countId: e.countId, color: e.color, endsPerRepeat: 0 };
      colorMap[key].endsPerRepeat += (parseFloat(e.ends) || 0);
    });

    const colorResults = Object.values(colorMap).map(c => {
      const totalEndsForColor = Math.round((c.endsPerRepeat * repeats) + (extraThreads > 0 && endsInOneRepeat > 0 ? (extraThreads * (c.endsPerRepeat / endsInOneRepeat)) : 0));
      const yc = yarnCounts.find(y => y.id === c.countId);
      const effCount = yc ? parseEffectiveCount(yc?.count_value) : 0;
      const kg = calculateWarpYarnKg(totalEndsForColor, prodQty, effCount, currentCrimp.warpCrimp, currentCrimp.warpWastage);
      const bk = yc ? kgToBundlesKnots(kg, yc) : { bundles: 0, knots: 0 };
      return { ...c, totalEnds: totalEndsForColor, kg, bundles: bk.bundles, knots: bk.knots, yc };
    });

    return {
      warpIdx: wi,
      repeats,
      extraThreads,
      endsInOneRepeat,
      totalEnds,
      calculatedWidth,
      colorResults,
      sequence: wd.sequence || []
    };
  });
}

export function computeWeftDesignResults(technicalSpecs, yarnCounts = [], crimpOverrides = null) {
  const ts = technicalSpecs || {};
  const dd = ts.design_details || { warp_designs: [], weft_design: { sequence: [] } };
  const loomReed = parseFloat(ts.on_loom_reed) || parseFloat(ts.order_reed) || 0;
  const loomPick = parseFloat(ts.on_loom_pick) || parseFloat(ts.order_pick) || 0;
  const currentCrimp = crimpOverrides || dd.crimp_overrides || getCrimpAndWastage(ts.weave_type, loomReed, loomPick, ts.loom_type || 'Airjet');
  const prodQty = parseFloat(ts.production_quantity) || 0;
  const orderWidth = parseFloat(ts.order_width) || 0;

  const weftSeq = dd.weft_design?.sequence || [];
  const flatEntries = flattenSequence(weftSeq);
  const totalPicksPerRepeat = flatEntries.reduce((s, e) => s + (parseFloat(e.picks) || 0), 0);

  const colorMap = {};
  flatEntries.forEach(e => {
    const key = `${e.countId}||${e.color}`;
    if (!colorMap[key]) colorMap[key] = { countId: e.countId, color: e.color, picksPerRepeat: 0 };
    colorMap[key].picksPerRepeat += (parseFloat(e.picks) || 0);
  });

  const colorResults = Object.values(colorMap).map(c => {
    const rawEffectivePPI = totalPicksPerRepeat > 0 ? (c.picksPerRepeat / totalPicksPerRepeat) * loomPick : 0;
    const effectivePPI = Math.round(rawEffectivePPI);
    const yc = yarnCounts.find(y => y.id === c.countId);
    const effCount = yc ? parseEffectiveCount(yc?.count_value) : 0;
    const kg = calculateWeftYarnKg(rawEffectivePPI, orderWidth, prodQty, effCount, currentCrimp.weftCrimp, currentCrimp.weftWastage);
    const bk = yc ? kgToBundlesKnots(kg, yc) : { bundles: 0, knots: 0 };
    return { ...c, effectivePPI, kg, bundles: bk.bundles, knots: bk.knots, yc };
  });

  return {
    totalPicksPerRepeat,
    colorResults,
    sequence: weftSeq
  };
}
