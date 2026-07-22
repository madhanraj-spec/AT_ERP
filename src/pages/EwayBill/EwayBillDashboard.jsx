import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Truck, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Printer, 
  Clock, 
  Loader, 
  Search, 
  ChevronRight, 
  ChevronDown,
  Sparkles, 
  RefreshCw 
} from 'lucide-react';
import EwayBillModal from '../../components/EwayBillModal';
import EwayBillPrintModal from '../../components/EwayBillPrintModal';

export default function EwayBillDashboard() {
  const [activeTab, setActiveTab] = useState('greige'); // 'greige' | 'dyed' | 'fabric' | 'branch'
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data lists
  const [greigeDeliveries, setGreigeDeliveries] = useState([]);
  const [dyedDeliveries, setDyedDeliveries] = useState([]);
  const [fabricDeliveries, setFabricDeliveries] = useState([]);
  const [branchDeliveries, setBranchDeliveries] = useState([]);
  
  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState({});
  
  // Active modals
  const [activeEwayRecord, setActiveEwayRecord] = useState(null);
  const [activeEwayType, setActiveEwayType] = useState('greige'); // 'greige' | 'dyed' | 'pof' | 'branch'
  const [activeEwayDefaults, setActiveEwayDefaults] = useState(null);
  
  const [printRecord, setPrintRecord] = useState(null);
  const [printType, setPrintType] = useState('greige');

  // Load Greige Yarn Deliveries
  const fetchGreigeDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('greige_yarn_delivery_receipts')
        .select(`
          *,
          dof:dyeing_order_forms(
            *,
            dyeing_unit:master_partners(*)
          ),
          items:greige_yarn_delivery_items(
            *,
            master_yarn_counts(*)
          )
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setGreigeDeliveries(data || []);
    } catch (err) {
      console.error('Error fetching greige deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Dyed Yarn Deliveries
  const fetchDyedDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dyed_yarn_deliveries')
        .select(`
          *,
          items:dyed_yarn_delivery_items(
            *,
            master_yarn_counts(*)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // For each dyed yarn delivery, resolve partner details if partner_id is missing
      const resolvedDeliveries = await Promise.all((data || []).map(async (delivery) => {
        let partnerId = delivery.partner_id;
        let partnerInfo = null;

        if (!partnerId && delivery.items && delivery.items.length > 0) {
          const firstItem = delivery.items[0];
          const formId = firstItem?.production_form_id;
          const processType = firstItem?.process_type;

          if (formId && processType) {
            const dbTable = processType === 'warping' 
              ? 'warping_order_forms' 
              : processType === 'redyeing' 
              ? 'dyeing_order_forms' 
              : 'weaving_orders';
            const partnerCol = processType === 'redyeing' ? 'dyeing_unit_id' : 'partner_id';
            const { data: formRecord } = await supabase
              .from(dbTable)
              .select(partnerCol)
              .eq('id', formId)
              .maybeSingle();
            if (formRecord?.[partnerCol]) {
              partnerId = formRecord[partnerCol];
            }
          }
        }

        if (!partnerId && delivery.dyeing_unit_id) {
          partnerId = delivery.dyeing_unit_id;
        }

        if (partnerId) {
          const { data: partnerData } = await supabase
            .from('master_partners')
            .select('*')
            .eq('id', partnerId)
            .maybeSingle();
          partnerInfo = partnerData;
        }

        return {
          ...delivery,
          partner: partnerInfo
        };
      }));

      setDyedDeliveries(resolvedDeliveries);
    } catch (err) {
      console.error('Error fetching dyed deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Fabric POFs
  const fetchFabricDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('processing_orders')
        .select(`
          *,
          partner:master_partners(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFabricDeliveries(data || []);
    } catch (err) {
      console.error('Error fetching fabric deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Fabric Movements (Branch Transfer)
  const fetchBranchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fabric_movements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBranchDeliveries(data || []);
    } catch (err) {
      console.error('Error fetching branch deliveries:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Dispatch initial fetch
  useEffect(() => {
    setExpandedRows({});
    if (activeTab === 'greige') {
      fetchGreigeDeliveries();
    } else if (activeTab === 'dyed') {
      fetchDyedDeliveries();
    } else if (activeTab === 'fabric') {
      fetchFabricDeliveries();
    } else if (activeTab === 'branch') {
      fetchBranchDeliveries();
    }
  }, [activeTab, fetchGreigeDeliveries, fetchDyedDeliveries, fetchFabricDeliveries, fetchBranchDeliveries]);

  // Handle Generate E-way Bill action click
  const triggerGenerateModal = async (record, type) => {
    setActiveEwayType(type);
    setActiveEwayRecord(record);
    
    if (type === 'greige') {
      const partner = record.dof?.dyeing_unit;
      
      // Fetch rate_per_kg and hsn_code for each delivery item
      const deliveryItems = record.items || [];
      const countMap = {};
      deliveryItems.forEach(di => {
        const cid = di.yarn_count_id;
        if (!countMap[cid]) {
          countMap[cid] = {
            qty: 0,
            countObj: di.master_yarn_counts
          };
        }
        countMap[cid].qty += parseFloat(di.quantity_kg || 0);
      });

      const countIds = Object.keys(countMap);
      let rateMap = {};
      if (countIds.length > 0) {
        try {
          const { data: receipts } = await supabase
            .from('greige_yarn_receipts')
            .select('yarn_count_id, rate_per_kg, hsn_code')
            .in('yarn_count_id', countIds)
            .gt('rate_per_kg', 0)
            .order('created_at', { ascending: false });

          (receipts || []).forEach(rec => {
            const key = rec.yarn_count_id;
            if (!rateMap[key]) {
              rateMap[key] = {
                rate_per_kg: parseFloat(rec.rate_per_kg || 0),
                hsn_code: rec.hsn_code || '5205'
              };
            }
          });
        } catch (err) {
          console.error(err);
        }
      }

      const items = Object.entries(countMap).map(([cid, info]) => {
        const c = info.countObj;
        const yarnName = c ? [c.count_value, c.spec, c.spec1, c.product_type].filter(Boolean).join(' ') : 'Yarn';
        const rateInfo = rateMap[cid] || {};
        const rate = rateInfo.rate_per_kg || 0;
        const hsn = rateInfo.hsn_code || '5205';
        const qty = parseFloat(info.qty.toFixed(2));
        return {
          productName: yarnName + ' Yarn',
          hsnCode: hsn,
          quantity: qty,
          qtyUnit: 'KGS',
          ratePerKg: rate,
          taxableAmount: parseFloat((qty * rate).toFixed(2))
        };
      });

      setActiveEwayDefaults({
        docNo: record.gydr_number,
        docDate: record.created_at,
        partnerName: partner?.partner_name || record.dyeing_unit_name || 'Processing Partner',
        partnerGstin: partner?.gstin,
        partnerAddress: partner?.address,
        partnerPincode: partner?.pincode,
        partnerStateCode: partner?.state_code,
        vehicleNo: record.vehicle_no || record.vehicle_details || record.vehicle_number || record.eway_bill_details?.request?.transport?.vehicleNo || '',
        transDistance: record.eway_bill_details?.request?.transDistance || record.eway_bill_details?.transDistance || '50',
        items: items,
        totalQty: deliveryItems.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0),
        qtyUnit: 'KGS',
        productName: 'Greige Cotton Yarn'
      });
    } else if (type === 'dyed') {
      const partner = record.partner;
      const deliveryItems = record.items || [];
      
      const countMap = {};
      deliveryItems.forEach(di => {
        const cid = di.yarn_count_id;
        if (!countMap[cid]) {
          countMap[cid] = {
            qty: 0,
            countObj: di.master_yarn_counts
          };
        }
        countMap[cid].qty += parseFloat(di.quantity_kg || 0);
      });

      // Simple fallback rate for dyed yarn estimation since it is already dyed
      const items = Object.entries(countMap).map(([cid, info]) => {
        const c = info.countObj;
        const yarnName = c ? [c.count_value, c.spec, c.spec1, c.product_type].filter(Boolean).join(' ') : 'Yarn';
        const rate = 320; // Estimated Rs 320/kg for Dyed Yarn
        const qty = parseFloat(info.qty.toFixed(2));
        return {
          productName: yarnName + ' Dyed Yarn',
          hsnCode: '5206', // standard dyed yarn HSN
          quantity: qty,
          qtyUnit: 'KGS',
          ratePerKg: rate,
          taxableAmount: parseFloat((qty * rate).toFixed(2))
        };
      });

      setActiveEwayDefaults({
        docNo: record.dydr_number,
        docDate: record.delivered_date || record.created_at,
        partnerName: partner?.partner_name || record.partner_name || 'Partner',
        partnerGstin: partner?.gstin,
        partnerAddress: partner?.address,
        partnerPincode: partner?.pincode,
        partnerStateCode: partner?.state_code,
        vehicleNo: record.vehicle_no || record.vehicle_details || record.vehicle_number || record.eway_bill_details?.request?.transport?.vehicleNo || '',
        transDistance: record.eway_bill_details?.request?.transDistance || record.eway_bill_details?.transDistance || '50',
        items: items,
        totalQty: deliveryItems.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0),
        qtyUnit: 'KGS',
        productName: 'Dyed Cotton Yarn'
      });
    } else if (type === 'pof') {
      const partner = record.partner;
      const totalQty = record.fabric_rolls?.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0) || 0;

      // Group by sorting/description
      const items = [{
        productName: 'Processed Fabric',
        hsnCode: '5208',
        quantity: totalQty,
        qtyUnit: 'MTR',
        ratePerKg: 120, // Rs 120/mtr for fabric value
        taxableAmount: Math.round(totalQty * 120)
      }];

      setActiveEwayDefaults({
        docNo: record.pof_number,
        docDate: record.created_at,
        partnerName: partner?.partner_name || record.partner_name || 'Processing Partner',
        partnerGstin: partner?.gstin,
        partnerAddress: partner?.address,
        partnerPincode: partner?.pincode,
        partnerStateCode: partner?.state_code,
        vehicleNo: record.vehicle_details || record.vehicle_no || record.vehicle_number || record.eway_bill_details?.request?.transport?.vehicleNo || '',
        transDistance: record.eway_bill_details?.request?.transDistance || record.eway_bill_details?.transDistance || '50',
        items: items,
        totalQty: totalQty,
        qtyUnit: 'MTR',
        productName: 'Processed Fabric'
      });
    } else if (type === 'branch') {
      const totalQty = (record.rolls || []).reduce((sum, r) => sum + Number(r.qty || 0), 0);
      const items = [{
        productName: 'Processed Fabric',
        hsnCode: '5208',
        quantity: totalQty,
        qtyUnit: 'MTR',
        ratePerKg: 120,
        taxableAmount: Math.round(totalQty * 120)
      }];

      const toLoc = (record.to_location || '').toLowerCase();
      const isToOffice = toLoc.includes('office');
      const isToFactory = toLoc.includes('factory');

      const consigneeAddress = isToOffice
        ? '12/1 JAGADESN KADU, GUGAI, SALEM, 636006'
        : (isToFactory ? '6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, 636308' : '12/1 JAGADESN KADU, GUGAI, SALEM, 636006');

      const consigneePincode = isToOffice ? '636006' : (isToFactory ? '636308' : '636006');
      const consigneePlace = isToOffice ? 'GUGAI, SALEM' : 'VEERAPANDI, SALEM';

      setActiveEwayDefaults({
        docNo: record.fmdc_number,
        docDate: record.created_at,
        partnerName: 'ASHOK TEXTILES',
        partnerGstin: '33AAZFA6086D1Z6',
        partnerAddress: consigneeAddress,
        partnerPlace: consigneePlace,
        partnerPincode: consigneePincode,
        partnerStateCode: '33',
        vehicleNo: record.vehicle_number || record.vehicle_no || record.vehicle_details || record.eway_bill_details?.request?.transport?.vehicleNo || '',
        transDistance: record.eway_bill_details?.request?.transDistance || record.eway_bill_details?.transDistance || '50',
        items: items,
        totalQty: totalQty,
        qtyUnit: 'MTR',
        productName: 'Processed Fabric'
      });
    }
  };

  // Success Callback from Modal
  const handleSuccess = (res) => {
    // Refresh lists
    if (activeEwayType === 'greige') {
      fetchGreigeDeliveries();
    } else if (activeEwayType === 'dyed') {
      fetchDyedDeliveries();
    } else if (activeEwayType === 'pof') {
      fetchFabricDeliveries();
    } else if (activeEwayType === 'branch') {
      fetchBranchDeliveries();
    }
    setActiveEwayRecord(null);
  };

  // Quick print handler
  const handlePrintClick = (record, type) => {
    setPrintType(type);
    setPrintRecord(record);
  };

  // Filtering lists based on search query
  const getFilteredData = () => {
    const q = searchQuery.toLowerCase().trim();
    if (activeTab === 'greige') {
      return greigeDeliveries.filter(d => 
        (d.gydr_number || '').toLowerCase().includes(q) ||
        (d.dof?.dyeing_unit?.partner_name || d.dyeing_unit_name || '').toLowerCase().includes(q) ||
        (d.eway_bill_no || '').toLowerCase().includes(q)
      );
    } else if (activeTab === 'dyed') {
      return dyedDeliveries.filter(d => 
        (d.dydr_number || '').toLowerCase().includes(q) ||
        (d.partner?.partner_name || d.partner_name || '').toLowerCase().includes(q) ||
        (d.eway_bill_no || '').toLowerCase().includes(q)
      );
    } else if (activeTab === 'fabric') {
      return fabricDeliveries.filter(d => 
        (d.pof_number || '').toLowerCase().includes(q) ||
        (d.partner?.partner_name || d.partner_name || '').toLowerCase().includes(q) ||
        (d.eway_bill_no || '').toLowerCase().includes(q)
      );
    } else {
      return branchDeliveries.filter(d => 
        (d.fmdc_number || '').toLowerCase().includes(q) ||
        (d.to_location || '').toLowerCase().includes(q) ||
        (d.eway_bill_no || '').toLowerCase().includes(q)
      );
    }
  };

  const toggleRowExpanded = (rowId) => {
    setExpandedRows(prev => ({
      ...prev,
      [rowId]: !prev[rowId]
    }));
  };

  const ExpandedDetailsPanel = ({ row, activeTab }) => {
    const [loading, setLoading] = useState(false);
    const [enrichedItems, setEnrichedItems] = useState([]);
    const [partnerInfo, setPartnerInfo] = useState(null);

    useEffect(() => {
      const loadEnrichedData = async () => {
        setLoading(true);
        try {
          // 1. Resolve Partner details first
          let pInfo = null;
          if (activeTab === 'greige') {
            // For greige, consignee is the dyeing unit of the DOF
            pInfo = row.dof?.dyeing_unit;
          } else if (activeTab === 'dyed' || activeTab === 'fabric') {
            pInfo = row.partner;
          } else if (activeTab === 'branch') {
            const toLoc = (row.to_location || '').toLowerCase();
            const isToOffice = toLoc.includes('office');
            const isToFactory = toLoc.includes('factory');
            pInfo = {
              partner_name: 'ASHOK TEXTILES',
              gstin: '33AAZFA6086D1Z6',
              address: isToOffice 
                ? '12/1 JAGADESN KADU, GUGAI, SALEM, 636006' 
                : (isToFactory ? '6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, 636308' : '12/1 JAGADESN KADU, GUGAI, SALEM, 636006'),
              pincode: isToOffice ? '636006' : (isToFactory ? '636308' : '636006'),
              place: isToOffice ? 'GUGAI, SALEM' : 'VEERAPANDI, SALEM',
              state: 'TAMIL NADU',
              state_code: '33'
            };
          }
          setPartnerInfo(pInfo);

          // 2. Resolve enriched items
          let itemsList = [];
          if (activeTab === 'greige' || activeTab === 'dyed') {
            const items = row.items || [];
            const countIds = [...new Set(items.map(i => i.yarn_count_id).filter(Boolean))];

            let rateMap = {};
            if (countIds.length > 0) {
              const { data: receipts, error: receiptsErr } = await supabase
                .from('greige_yarn_receipts')
                .select('yarn_count_id, rate_per_kg, hsn_code')
                .in('yarn_count_id', countIds)
                .order('created_at', { ascending: false });

              if (!receiptsErr && receipts) {
                countIds.forEach(cid => {
                  const matching = receipts.filter(r => r.yarn_count_id === cid);
                  if (matching.length > 0) {
                     const withRate = matching.find(r => parseFloat(r.rate_per_kg || 0) > 0);
                     const bestMatch = withRate || matching[0];
                     rateMap[cid] = {
                       rate_per_kg: parseFloat(bestMatch.rate_per_kg || 0) || (activeTab === 'dyed' ? 320.0 : 160.0),
                       hsn_code: bestMatch.hsn_code || (activeTab === 'dyed' ? '5206' : '5205')
                     };
                  }
                });
              }
            }

            itemsList = items.map(item => {
              const cid = item.yarn_count_id;
              const rateInfo = rateMap[cid] || {};
              const rate = rateInfo.rate_per_kg || (activeTab === 'dyed' ? 320.0 : 160.0);
              const hsn = rateInfo.hsn_code || (activeTab === 'dyed' ? '5206' : '5205');
              const qty = parseFloat(item.quantity_kg || 0);

              const c = item.master_yarn_counts;
              const countLabel = c ? `${c.count_value} ${c.spec || ''} ${c.spec1 || ''} ${c.product_type || ''}`.trim() : 'Yarn';

              return {
                label: countLabel,
                subtext: item.colour || 'Greige',
                hsnCode: hsn,
                quantity: qty,
                qtyUnit: 'KG',
                rate: rate,
                total: parseFloat((qty * rate).toFixed(2))
              };
            });
          } else if (activeTab === 'fabric') {
            // POF details
            const rolls = row.fabric_rolls || [];
            itemsList = rolls.map((roll, idx) => {
              const qty = parseFloat(roll.actual_qty || roll.qty || 0);
              const rate = 120.0; // standard POF rate
              return {
                label: roll.roll_no || roll.piece_no || `Roll #${idx + 1}`,
                subtext: roll.grade || roll.quality || 'A Grade',
                hsnCode: '5208',
                quantity: qty,
                qtyUnit: 'MTR',
                rate: rate,
                total: parseFloat((qty * rate).toFixed(2))
              };
            });
          } else if (activeTab === 'branch') {
            // Branch Transfer details
            const rolls = row.rolls || [];
            itemsList = rolls.map((roll, idx) => {
              const qty = parseFloat(roll.qty || 0);
              const rate = 120.0; // standard branch rate
              return {
                label: roll.roll_no || `Roll #${idx + 1}`,
                subtext: roll.sort_no || roll.quality || 'Standard',
                hsnCode: '5208',
                quantity: qty,
                qtyUnit: 'MTR',
                rate: rate,
                total: parseFloat((qty * rate).toFixed(2))
              };
            });
          }

          setEnrichedItems(itemsList);
        } catch (err) {
          console.error('Error enriching expanded details:', err);
        } finally {
          setLoading(false);
        }
      };

      loadEnrichedData();
    }, [row, activeTab]);

    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: '0.5rem' }}>
          <Loader size={16} style={{ animation: 'spin 1.5s linear infinite', color: '#800000' }} />
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>Enriching details...</span>
        </div>
      );
    }

    const hasEway = !!row.eway_bill_no;

    // Formatted totals
    const totalQuantity = enrichedItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalValue = enrichedItems.reduce((sum, item) => sum + item.total, 0);

    return (
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1.2fr 1fr', 
        gap: '2.5rem', 
        padding: '1.5rem', 
        backgroundColor: '#ffffff', 
        borderRadius: '8px', 
        border: '1px solid #e2e8f0', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
      }}>
        {/* Left Side: Enriched Items Breakdown */}
        <div>
          <h4 style={{ margin: '0 0 1rem 0', color: '#800000', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            📦 Items Breakdown
          </h4>
          {enrichedItems.length === 0 ? (
            <p style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>No items details recorded.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '800', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.5rem 0.25rem' }}>Item Description</th>
                    <th style={{ padding: '0.5rem 0.25rem', width: '90px' }}>HSN Code</th>
                    <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right', width: '80px' }}>Qty</th>
                    <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right', width: '90px' }}>Rate</th>
                    <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right', width: '100px' }}>Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.25rem' }}>
                        <span style={{ fontWeight: '700', color: '#1e293b', display: 'block' }}>{item.label}</span>
                        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '600' }}>{item.subtext}</span>
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', fontFamily: 'monospace', fontWeight: '700', color: '#475569' }}>
                        {item.hsnCode}
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontWeight: '700', fontFamily: 'monospace', color: '#1e293b' }}>
                        {item.quantity.toFixed(2)} {item.qtyUnit}
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontWeight: '600', fontFamily: 'monospace', color: '#475569' }}>
                        ₹{item.rate.toFixed(2)}
                      </td>
                      <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontWeight: '800', fontFamily: 'monospace', color: '#047857' }}>
                        ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: '800' }}>
                    <td style={{ padding: '0.6rem 0.25rem', color: '#475569' }}>Total</td>
                    <td></td>
                    <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontFamily: 'monospace' }}>
                      {totalQuantity.toFixed(2)}
                    </td>
                    <td></td>
                    <td style={{ padding: '0.6rem 0.25rem', textAlign: 'right', fontFamily: 'monospace', color: '#047857', fontSize: '0.85rem' }}>
                      ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: E-Way Bill Details */}
        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '2.5rem' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#800000', fontSize: '0.85rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🚚 E-Way Bill Details
          </h4>
          
          {/* Document Number, Date, Vehicle */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.8rem', marginBottom: '0.8rem' }}>
            <div>
              <span style={{ color: '#64748b', fontWeight: '600', display: 'block' }}>E-Way Bill No</span>
              <span style={{ fontWeight: '800', color: '#1e293b', fontFamily: 'monospace', fontSize: '0.9rem' }}>{row.eway_bill_no || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontWeight: '600', display: 'block' }}>E-Way Bill Date</span>
              <span style={{ fontWeight: '700', color: '#1e293b' }}>{row.eway_bill_date ? new Date(row.eway_bill_date).toLocaleString('en-IN') : '—'}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', fontSize: '0.8rem', borderTop: '1px dashed #e2e8f0', paddingTop: '0.6rem', marginBottom: '0.8rem' }}>
            <div>
              <span style={{ color: '#64748b', fontWeight: '600', display: 'block' }}>Vehicle No</span>
              <span style={{ fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' }}>
                {
                  row.vehicle_details || 
                  row.vehicle_no || 
                  row.vehicle_number || 
                  row.eway_bill_details?.request?.transport?.vehicleNo || 
                  row.eway_bill_details?.request?.vehicleNo || 
                  row.eway_bill_details?.vehicleNo || 
                  row.eway_bill_details?.data?.vehNo || 
                  '—'
                }
              </span>
            </div>
            <div>
              <span style={{ color: '#64748b', fontWeight: '600', display: 'block' }}>Distance (KM)</span>
              <span style={{ fontWeight: '700', color: '#1e293b' }}>
                {
                  row.eway_bill_details?.request?.transDistance || 
                  row.eway_bill_details?.request?.transport?.transDistance || 
                  row.eway_bill_details?.transDistance || 
                  row.eway_bill_details?.response?.actualDist || 
                  row.eway_bill_details?.data?.actualDist || 
                  row.eway_bill_details?.data?.distance || 
                  row.distance || 
                  row.trans_distance || 
                  (hasEway ? '50' : '—')
                } km
              </span>
            </div>
          </div>

          {/* Consignee / Partner details */}
          {partnerInfo ? (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem', marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600', display: 'block' }}>Partner Name</span>
                <span style={{ fontWeight: '700', color: '#1e293b' }}>{partnerInfo.partner_name}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '0.8rem' }}>
                <div>
                  <span style={{ color: '#64748b', fontWeight: '600', display: 'block' }}>GSTIN</span>
                  <span style={{ fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' }}>{partnerInfo.gstin || '—'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontWeight: '600', display: 'block' }}>Pincode</span>
                  <span style={{ fontWeight: '700', color: '#1e293b', fontFamily: 'monospace' }}>{partnerInfo.pincode || '—'}</span>
                </div>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: '600', display: 'block' }}>Address</span>
                <span style={{ fontWeight: '600', color: '#475569', lineHeight: '1.4' }}>
                  {partnerInfo.address || '—'}
                  {partnerInfo.state ? `, ${partnerInfo.state}` : ''}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem', marginTop: '0.8rem', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
              No partner address details loaded.
            </div>
          )}

          {hasEway && row.eway_bill_details && (
            <details style={{ marginTop: '0.8rem', fontSize: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '4px' }}>
              <summary style={{ padding: '0.35rem 0.5rem', backgroundColor: '#f8fafc', color: '#475569', fontWeight: '600', cursor: 'pointer', outline: 'none' }}>
                Raw GSP Sandbox Response (JSON)
              </summary>
              <pre style={{ margin: 0, padding: '0.5rem', overflow: 'auto', maxHeight: '120px', backgroundColor: '#0f172a', color: '#38bdf8', borderRadius: '0 0 4px 4px', fontSize: '0.7rem', lineHeight: '1.2' }}>
                {JSON.stringify(row.eway_bill_details, null, 2)}
              </pre>
            </details>
          )}

          {!hasEway && (
            <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
              <p style={{ margin: 0, color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={14} style={{ color: '#64748b' }} /> E-Way Bill not generated yet.
              </p>
              {row.eway_bill_status === 'failed' && row.eway_bill_error && (
                <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#b91c1c', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  <strong>Last Error:</strong> {row.eway_bill_error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const filteredData = getFilteredData();

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }} className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-current)', margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Truck size={28} style={{ color: '#800000' }} /> E-Way Bill Management
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
            Generate, view, and cancel GST E-Way Bills for all yarn and fabric movements.
          </p>
        </div>

        <button 
          onClick={() => {
            if (activeTab === 'greige') fetchGreigeDeliveries();
            else if (activeTab === 'dyed') fetchDyedDeliveries();
            else if (activeTab === 'fabric') fetchFabricDeliveries();
            else fetchBranchDeliveries();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            border: '1px solid var(--border-current)',
            backgroundColor: '#fff',
            fontWeight: '600',
            fontSize: '0.85rem',
            cursor: 'pointer',
            color: '#800000'
          }}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Tabs and Search Panel */}
      <div className="glass-panel" style={{ padding: 0, marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-current)', padding: '0 1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '2rem' }}>
            {[
              { id: 'greige', label: 'Greige Yarn' },
              { id: 'dyed', label: 'Dyed Yarn' },
              { id: 'fabric', label: 'Fabric (POF)' },
              { id: 'branch', label: 'Branch Transfer' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '1.25rem 0.25rem',
                  border: 'none',
                  background: 'none',
                  fontSize: '0.9rem',
                  fontWeight: activeTab === tab.id ? '800' : '600',
                  color: activeTab === tab.id ? '#800000' : 'var(--text-muted-current)',
                  borderBottom: activeTab === tab.id ? '3px solid #800000' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', margin: '0.5rem 0' }}>
            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by Document or E-way No..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.5rem 1rem 0.5rem 2.25rem',
                borderRadius: '6px',
                border: '1px solid var(--border-current)',
                fontSize: '0.85rem',
                width: '260px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Deliveries Table */}
        <div className="table-container" style={{ border: 'none', borderRadius: '0' }}>
          {loading ? (
            <div style={{ padding: '6rem 0', textAlign: 'center' }}>
              <Loader size={32} style={{ animation: 'spin 1.5s linear infinite', color: '#800000', margin: '0 auto 1rem auto' }} />
              <p style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Loading deliveries data...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div style={{ padding: '6rem 0', textAlign: 'center', color: 'var(--text-muted-current)' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
              <p style={{ fontWeight: '600' }}>No deliveries found for the selected filter.</p>
            </div>
          ) : (
            <table className="table" style={{ fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <th style={{ width: '40px', padding: '1rem 0.5rem' }}></th>
                  <th style={{ padding: '1rem 1.25rem' }}>Doc No</th>
                  <th>Date</th>
                  <th>Consignee (Partner) / Locations</th>
                  <th>Items Details</th>
                  <th style={{ textAlign: 'right' }}>Total Qty</th>
                  <th>Vehicle Details</th>
                  <th style={{ textAlign: 'center' }}>E-Way Bill Status</th>
                  <th style={{ textAlign: 'center', width: '220px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(row => {
                  // Common resolvers
                  const docNo = row.gydr_number || row.dydr_number || row.pof_number || row.fmdc_number;
                  const date = row.created_at || row.delivered_date;
                  const partnerName = activeTab === 'branch' 
                    ? `${row.from_location} ➔ ${row.to_location}` 
                    : row.partner?.partner_name || row.dof?.dyeing_unit?.partner_name || row.partner_name || row.dyeing_unit_name || 'Unknown';
                  const vehicle = row.vehicle_number || row.vehicle_no || row.vehicle_details || row.eway_bill_details?.request?.transport?.vehicleNo || '—';
                  
                  // Quantities and descriptions resolver
                  let qtyText = '';
                  let itemsText = '';
                  if (activeTab === 'greige' || activeTab === 'dyed') {
                    const totalQty = (row.items || []).reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);
                    qtyText = `${totalQty.toFixed(2)} KG`;
                    
                    const uniqueCounts = [...new Set((row.items || []).map(i => {
                      const c = i.master_yarn_counts;
                      return c ? `${c.count_value} ${c.product_type || ''}`.trim() : 'Yarn';
                    }))];
                    itemsText = uniqueCounts.join(', ') || 'Yarn';
                  } else if (activeTab === 'fabric') {
                    const totalMeters = row.fabric_rolls?.reduce((s, r) => s + parseFloat(r.actual_qty || r.qty || 0), 0) || 0;
                    qtyText = `${totalMeters.toFixed(2)} MTR`;
                    itemsText = 'Cotton Fabric Rolls';
                  } else {
                    const totalMeters = row.rolls?.reduce((s, r) => s + parseFloat(r.qty || 0), 0) || 0;
                    qtyText = `${totalMeters.toFixed(2)} MTR`;
                    itemsText = 'Fabric Roll Movement (Branch Transfer)';
                  }

                  const hasEway = !!row.eway_bill_no;
                  const isCancelled = row.eway_bill_status === 'cancelled';
                  const isExpanded = !!expandedRows[row.id];

                  return (
                    <React.Fragment key={row.id}>
                      <tr 
                        style={{ borderBottom: '1px solid var(--border-current)', cursor: 'pointer', backgroundColor: isExpanded ? '#f8fafc' : 'transparent' }}
                        onClick={() => toggleRowExpanded(row.id)}
                      >
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRowExpanded(row.id);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#64748b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '4px',
                              borderRadius: '4px'
                            }}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontWeight: '800', color: '#800000', fontFamily: 'monospace' }}>
                          {docNo}
                        </td>
                        <td style={{ color: '#475569', fontWeight: '600' }}>
                          {date ? new Date(date).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td style={{ fontWeight: '700', color: '#1e293b' }}>
                          {partnerName}
                        </td>
                        <td style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: '600', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {itemsText}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '800', fontFamily: 'monospace', color: '#047857' }}>
                          {qtyText}
                        </td>
                        <td style={{ fontWeight: '700', color: '#475569', fontSize: '0.8rem' }}>
                          {vehicle}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {hasEway ? (
                            isCancelled ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', color: '#991b1b', fontWeight: '800' }}>
                                <XCircle size={12} /> Cancelled
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', color: '#166534', fontWeight: '800' }}>
                                <CheckCircle size={12} /> Generated
                              </span>
                            )
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', color: '#64748b', fontWeight: '800' }}>
                              <Clock size={12} /> Pending
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.75rem' }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            {hasEway && !isCancelled ? (
                              <>
                                <button
                                  onClick={() => handlePrintClick(row, activeTab)}
                                  style={{
                                    backgroundColor: '#f0f9ff',
                                    color: '#0369a1',
                                    border: '1px solid #bae6fd',
                                    padding: '5px 12px',
                                    borderRadius: '5px',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}
                                >
                                  <Printer size={13} /> Print Slip
                                </button>
                                <button
                                  onClick={() => triggerGenerateModal(row, activeTab === 'fabric' ? 'pof' : activeTab)}
                                  style={{
                                    backgroundColor: '#fff',
                                    color: '#b91c1c',
                                    border: '1px solid #fca5a5',
                                    padding: '5px 12px',
                                    borderRadius: '5px',
                                    fontSize: '0.78rem',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => triggerGenerateModal(row, activeTab === 'fabric' ? 'pof' : activeTab)}
                                style={{
                                  backgroundColor: '#800000',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '6px 14px',
                                  borderRadius: '5px',
                                  fontSize: '0.78rem',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  boxShadow: '0 2px 4px rgba(128,0,0,0.15)'
                                }}
                              >
                                <Sparkles size={13} /> Generate E-Way
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ padding: '1.25rem 2rem', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-current)' }}>
                            <ExpandedDetailsPanel row={row} activeTab={activeTab} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Generation / Cancellation Modal */}
      {activeEwayRecord && (
        <EwayBillModal
          isOpen={!!activeEwayRecord}
          onClose={() => setActiveEwayRecord(null)}
          type={activeEwayType}
          record={activeEwayRecord}
          defaultDetails={activeEwayDefaults}
          onSuccess={handleSuccess}
        />
      )}

      {/* Printing Modal */}
      {printRecord && (
        <EwayBillPrintModal
          isOpen={!!printRecord}
          onClose={() => setPrintRecord(null)}
          type={printType}
          record={printRecord}
        />
      )}
    </div>
  );
}
