import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  QrCode, 
  Search, 
  CheckCircle, 
  AlertTriangle, 
  Plus, 
  X, 
  Camera, 
  ArrowLeft,
  Layers,
  Calendar,
  Truck,
  User,
  Printer,
  FileText,
  Edit,
  Loader,
  ArrowRight,
  TrendingUp,
  Inbox,
  ChevronRight,
  ChevronDown,
  Trash2,
  Scissors,
  Info
} from 'lucide-react';







const isGreigeRollMatch = (rxGreigeRollId, sentRollId) => {
  if (!rxGreigeRollId || !sentRollId) return false;
  const rxLower = rxGreigeRollId.toLowerCase();
  const sentLower = sentRollId.toLowerCase();
  return (
    rxLower === sentLower ||
    sentLower.startsWith(rxLower + '/') ||
    rxLower.startsWith(sentLower + '/')
  );
};

const PROCESS_OPTIONS = [
  'ZERO-ZERO',
  'DESIZE',
  'CHAMBER',
  'JIGGER',
  'MILL FINISH',
  'SINGEING',
  'FACE SIDE BRUSHING',
  'DOUBLE SIDE BRUSHING',
  'MILD BRUSHING',
  'HEAVY BRUSHING',
  'TINOPAL',
  'SEMI DESIZE',
  'WATER WASH',
  'THOTTI DESIZE',
  'DRUM WASH',
  'OPRN STENDER',
  'ACIDIC WASH',
  'SOFT HAND FELL',
  'PEACHING',
  'PRINTING',
  'OVER DYE',
  'HEAT SETTING',
  'RELAXED WASH',
  'PUTTA CUTTING',
  'OIL PEACHING'
];

// Helper Component for Processed Rolls Multi-Select Type & Find Dropdown
function ProcessedRollsMultiSelectDropdown({ label, options, selected, onChange, placeholder, openDropdownKey, openDropdown, setOpenDropdown, filterSearchQuery, setFilterSearchQuery }) {
  const containerRef = useRef(null);

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
  };

  const filteredOptions = options.filter(opt =>
    String(opt).toLowerCase().includes(filterSearchQuery.toLowerCase())
  );

  const isOpen = openDropdown === openDropdownKey;

  return (
    <div ref={containerRef} className="filter-dropdown-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      
      {/* Dropdown Toggle Button */}
      <button
        type="button"
        onClick={() => {
          setFilterSearchQuery('');
          setOpenDropdown(isOpen ? null : openDropdownKey);
        }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '8px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-current)',
          backgroundColor: '#fff',
          color: selected.length > 0 ? 'var(--text-current)' : 'var(--text-muted-current)',
          fontSize: '0.8rem',
          fontWeight: selected.length > 0 ? '700' : '500',
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
          {selected.length === 0 ? (placeholder || `Select ${label}`) :
           selected.length === 1 ? selected[0] :
           `${selected.length} Selected`}
        </span>
        <ChevronDown size={14} style={{ 
          transform: isOpen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s'
        }} />
      </button>

      {/* Floating Options Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '0',
          marginTop: '4px',
          minWidth: '220px',
          width: '100%',
          maxHeight: '220px',
          overflowY: 'auto',
          border: '1px solid var(--border-current)',
          borderRadius: '8px',
          padding: '8px',
          backgroundColor: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 1000
        }}>
          {/* Search input field */}
          <input
            type="text"
            placeholder={`Search ${label}...`}
            value={filterSearchQuery}
            onChange={e => setFilterSearchQuery(e.target.value)}
            onClick={e => e.stopPropagation()} // Stop dropdown from closing
            style={{
              padding: '6px 8px',
              fontSize: '0.8rem',
              border: '1px solid var(--border-current)',
              borderRadius: '6px',
              marginBottom: '4px',
              width: '100%',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />

          {/* Clear option helper inside the dropdown */}
          {selected.length > 0 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: '1px solid #f3f4f6', 
              paddingBottom: '4px',
              marginBottom: '2px'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                {selected.length} selected
              </span>
              <span 
                style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-primary)', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
              >
                Clear
              </span>
            </div>
          )}

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredOptions.map(val => {
              const checked = selected.includes(val);
              return (
                <label key={val} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', padding: '2px 4px', borderRadius: '4px' }} title={val}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(val)}
                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  {val}
                </label>
              );
            })}
          </div>

          {filteredOptions.length === 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontStyle: 'italic', padding: '8px', textAlign: 'center' }}>No matches found</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProcessingModule() {
  const { profile } = useAuth();
  const location = useLocation();
  const [viewMode, setViewMode] = useState('menu'); // 'menu' | 'create' | 'receive' | 'all_pofs'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ---------------------------------------------------------------------------
  // CREATE POF STATE VARIABLES
  // ---------------------------------------------------------------------------
  const [partners, setPartners] = useState([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scannedRolls, setScannedRolls] = useState([]); // Array of roll objects
  const [selectedProcesses, setSelectedProcesses] = useState([]);
  const [vehicleDetails, setVehicleDetails] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [width, setWidth] = useState('');
  const [allSystemRolls, setAllSystemRolls] = useState([]); // Cache for auto-add
  
  // Scanned order metadata for top display
  const [pofOrderNo, setPofOrderNo] = useState('');
  const [pofDesignNo, setPofDesignNo] = useState('');
  const [pofDesignName, setPofDesignName] = useState('');

  // QR Code camera scanner state
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [cameraScanError, setCameraScanError] = useState('');
  const scannerInstanceRef = useRef(null);
  const qrScanInputRef = useRef(null);

  // ---------------------------------------------------------------------------
  // PROCESSED FABRIC CUT STATE VARIABLES
  // ---------------------------------------------------------------------------
  const [cutScanInput, setCutScanInput] = useState('');
  const [isCutLoading, setIsCutLoading] = useState(false);
  const [cutError, setCutError] = useState('');
  const [cutSuccessMsg, setCutSuccessMsg] = useState('');
  const [parentProcessedRoll, setParentProcessedRoll] = useState(null);
  const [parentPof, setParentPof] = useState(null);
  const [numCutCuts, setNumCutCuts] = useState('');
  const [childProcessedRollsInput, setChildProcessedRollsInput] = useState([]);
  const [cutViewState, setCutViewState] = useState('search'); // 'search' | 'details' | 'success'
  const [savedChildProcessedRolls, setSavedChildProcessedRolls] = useState([]);
  const cutScanInputRef = useRef(null);

  // Printing state
  const [createdPof, setCreatedPof] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [pofQrUrl, setPofQrUrl] = useState('');

  // ---------------------------------------------------------------------------
  // RECEIVE FABRIC STATE VARIABLES
  // ---------------------------------------------------------------------------
  const [pendingPofs, setPendingPofs] = useState([]);
  const [selectedPof, setSelectedPof] = useState(null);
  const [receiveReceivedBy, setReceiveReceivedBy] = useState('');
  const [receiveVehicleNo, setReceiveVehicleNo] = useState('');
  const [receiveReceivedPlace, setReceiveReceivedPlace] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'sent_to_processing' | 'partially_received' | 'received'
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [selectedPofs, setSelectedPofs] = useState([]);
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [selectedOrderNos, setSelectedOrderNos] = useState([]);
  const [selectedDesignNames, setSelectedDesignNames] = useState([]);
  const [selectedDesignNos, setSelectedDesignNos] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null); // 'date' | 'pof' | 'partner' | 'order' | 'designName' | 'designNo' | null
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const [receiveRollsCount, setReceiveRollsCount] = useState('');
  const [receiveProcessedRolls, setReceiveProcessedRolls] = useState([]); // Array: [{ id, qty, greige_roll_id }]
  const [receiveStartIndex, setReceiveStartIndex] = useState(1);
  const [showPofrrPrintModal, setShowPofrrPrintModal] = useState(false);
  const [createdPofrr, setCreatedPofrr] = useState(null);
  const [receivedRollIds, setReceivedRollIds] = useState([]); // List of roll IDs checked/scanned to receive
  const [receivedRollsData, setReceivedRollsData] = useState({}); // Roll ID -> received quantity input

  // ---------------------------------------------------------------------------
  // ALL POFS HISTORICAL STATE VARIABLES
  // ---------------------------------------------------------------------------
  const [allPofs, setAllPofs] = useState([]);
  const [expandedPofId, setExpandedPofId] = useState(null);
  const [expandedPofrrNo, setExpandedPofrrNo] = useState(null);
  const [allPofsShowFilters, setAllPofsShowFilters] = useState(false);
  const [allPofsSelectedDates, setAllPofsSelectedDates] = useState([]);
  const [allPofsSelectedPofs, setAllPofsSelectedPofs] = useState([]);
  const [allPofsSelectedPartners, setAllPofsSelectedPartners] = useState([]);
  const [allPofsSelectedOrderNos, setAllPofsSelectedOrderNos] = useState([]);
  const [allPofsSelectedDesignNames, setAllPofsSelectedDesignNames] = useState([]);
  const [allPofsSelectedDesignNos, setAllPofsSelectedDesignNos] = useState([]);
  const [allPofsSelectedPaymentStatuses, setAllPofsSelectedPaymentStatuses] = useState([]);
  const [allPofsSelectedStatuses, setAllPofsSelectedStatuses] = useState([]);

  // Edit POF state variables
  const [editingPof, setEditingPof] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPofPartnerId, setEditPofPartnerId] = useState('');
  const [editPofExpectedDate, setEditPofExpectedDate] = useState('');
  const [editPofFabricRolls, setEditPofFabricRolls] = useState([]);
  const [editPofReceivedRolls, setEditPofReceivedRolls] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // PROCESSING BILLS STATE VARIABLES
  // ---------------------------------------------------------------------------
  const [bills, setBills] = useState([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const [billStatusFilter, setBillStatusFilter] = useState('all'); // 'all' | 'submitted_for_approval' | 'approved' | 'settled'
  const [expandedBillId, setExpandedBillId] = useState(null);

  // Bill creation states
  const [isCreatingBill, setIsCreatingBill] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [selectedBillPartnerId, setSelectedBillPartnerId] = useState('');
  const [receivedUnbilledPofs, setReceivedUnbilledPofs] = useState([]); // list of fully received POFs for partner
  const [selectedBillPofIds, setSelectedBillPofIds] = useState([]); // array of selected POF IDs
  const [billNumberInput, setBillNumberInput] = useState('');
  const [processRates, setProcessRates] = useState({}); // process_name -> rate (string)
  const [taxAmountInput, setTaxAmountInput] = useState('');
  const [taxPercentageInput, setTaxPercentageInput] = useState('');
  const [isBillPofDropdownOpen, setIsBillPofDropdownOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // PROCESSED ROLLS DETAILS STATE VARIABLES
  // ---------------------------------------------------------------------------
  const [processedRolls, setProcessedRolls] = useState([]);
  const [processedRollsLoading, setProcessedRollsLoading] = useState(false);
  const [processedRollsSearch, setProcessedRollsSearch] = useState('');
  const [fabricMovements, setFabricMovements] = useState([]);

  // Filter states for Processed Rolls
  const [processedRollsShowFilters, setProcessedRollsShowFilters] = useState(false);
  const [processedRollsSelectedDates, setProcessedRollsSelectedDates] = useState([]);
  const [processedRollsSelectedPofs, setProcessedRollsSelectedPofs] = useState([]);
  const [processedRollsSelectedPartners, setProcessedRollsSelectedPartners] = useState([]);
  const [processedRollsSelectedOrders, setProcessedRollsSelectedOrders] = useState([]);
  const [processedRollsSelectedDesigns, setProcessedRollsSelectedDesigns] = useState([]);
  const [processedRollsSelectedLocations, setProcessedRollsSelectedLocations] = useState([]);
  const [processedRollsSelectedProcesses, setProcessedRollsSelectedProcesses] = useState([]);

  // Interdependent filter options computation
  const dependentFilterOptions = useMemo(() => {
    const applyFiltersExcept = (excludeKey) => {
      return processedRolls.filter(r => {
        // Search term filter
        const q = processedRollsSearch.toLowerCase();
        const matchesSearch = !q || (
          r.id.toLowerCase().includes(q) ||
          (r.greige_roll_id && r.greige_roll_id.toLowerCase().includes(q)) ||
          r.pof_number.toLowerCase().includes(q) ||
          r.partner_name.toLowerCase().includes(q) ||
          r.order_number.toLowerCase().includes(q) ||
          r.design_name.toLowerCase().includes(q) ||
          r.design_no.toLowerCase().includes(q)
        );
        if (!matchesSearch) return false;

        // Date filter
        if (excludeKey !== 'receivedDates' && processedRollsSelectedDates.length > 0) {
          const dateStr = r.received_at ? new Date(r.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
          if (!processedRollsSelectedDates.includes(dateStr)) return false;
        }

        // POF filter
        if (excludeKey !== 'pofNumbers' && processedRollsSelectedPofs.length > 0) {
          if (!processedRollsSelectedPofs.includes(r.pof_number)) return false;
        }

        // Partner filter
        if (excludeKey !== 'partners' && processedRollsSelectedPartners.length > 0) {
          if (!processedRollsSelectedPartners.includes(r.partner_name)) return false;
        }

        // Order filter
        if (excludeKey !== 'orders' && processedRollsSelectedOrders.length > 0) {
          if (!processedRollsSelectedOrders.includes(r.order_number)) return false;
        }

        // Design filter
        if (excludeKey !== 'designs' && processedRollsSelectedDesigns.length > 0) {
          const designStr = r.design_name && r.design_no ? `${r.design_name} (${r.design_no})` : (r.design_name || r.design_no || '—');
          if (!processedRollsSelectedDesigns.includes(designStr)) return false;
        }

        // Location filter
        if (excludeKey !== 'locations' && processedRollsSelectedLocations.length > 0) {
          if (!processedRollsSelectedLocations.includes(r.location)) return false;
        }

        // Process filter
        if (excludeKey !== 'processes' && processedRollsSelectedProcesses.length > 0) {
          const matchesProcess = r.processes?.some(p => processedRollsSelectedProcesses.includes(p));
          if (!matchesProcess) return false;
        }

        return true;
      });
    };

    const getUniqueSorted = (list, mapper) => {
      return [...new Set(list.map(mapper).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    };

    const getUniqueProcesses = (list) => {
      const all = [];
      list.forEach(r => {
        if (Array.isArray(r.processes)) {
          all.push(...r.processes);
        }
      });
      return [...new Set(all)].sort();
    };

    return {
      receivedDates: getUniqueSorted(applyFiltersExcept('receivedDates'), r => r.received_at ? new Date(r.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'),
      pofNumbers: getUniqueSorted(applyFiltersExcept('pofNumbers'), r => r.pof_number),
      partners: getUniqueSorted(applyFiltersExcept('partners'), r => r.partner_name),
      orders: getUniqueSorted(applyFiltersExcept('orders'), r => r.order_number),
      designs: getUniqueSorted(applyFiltersExcept('designs'), r => r.design_name && r.design_no ? `${r.design_name} (${r.design_no})` : (r.design_name || r.design_no || '—')),
      locations: getUniqueSorted(applyFiltersExcept('locations'), r => r.location),
      processes: getUniqueProcesses(applyFiltersExcept('processes')),
    };
  }, [processedRolls, processedRollsSearch, processedRollsSelectedDates, processedRollsSelectedPofs, processedRollsSelectedPartners, processedRollsSelectedOrders, processedRollsSelectedDesigns, processedRollsSelectedLocations, processedRollsSelectedProcesses]);

  // Unified filtered rolls list
  const filteredProcessedRolls = useMemo(() => {
    return processedRolls.filter(r => {
      // Search term filter
      const q = processedRollsSearch.toLowerCase();
      const matchesSearch = !q || (
        r.id.toLowerCase().includes(q) ||
        (r.greige_roll_id && r.greige_roll_id.toLowerCase().includes(q)) ||
        r.pof_number.toLowerCase().includes(q) ||
        r.partner_name.toLowerCase().includes(q) ||
        r.order_number.toLowerCase().includes(q) ||
        r.design_name.toLowerCase().includes(q) ||
        r.design_no.toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;

      // Date filter
      if (processedRollsSelectedDates.length > 0) {
        const dateStr = r.received_at ? new Date(r.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        if (!processedRollsSelectedDates.includes(dateStr)) return false;
      }

      // POF filter
      if (processedRollsSelectedPofs.length > 0 && !processedRollsSelectedPofs.includes(r.pof_number)) return false;

      // Partner filter
      if (processedRollsSelectedPartners.length > 0 && !processedRollsSelectedPartners.includes(r.partner_name)) return false;

      // Order filter
      if (processedRollsSelectedOrders.length > 0 && !processedRollsSelectedOrders.includes(r.order_number)) return false;

      // Design filter
      if (processedRollsSelectedDesigns.length > 0) {
        const designStr = r.design_name && r.design_no ? `${r.design_name} (${r.design_no})` : (r.design_name || r.design_no || '—');
        if (!processedRollsSelectedDesigns.includes(designStr)) return false;
      }

      // Location filter
      if (processedRollsSelectedLocations.length > 0 && !processedRollsSelectedLocations.includes(r.location)) return false;

      // Process filter
      if (processedRollsSelectedProcesses.length > 0) {
        const matchesProcess = r.processes?.some(p => processedRollsSelectedProcesses.includes(p));
        if (!matchesProcess) return false;
      }

      return true;
    });
  }, [processedRolls, processedRollsSearch, processedRollsSelectedDates, processedRollsSelectedPofs, processedRollsSelectedPartners, processedRollsSelectedOrders, processedRollsSelectedDesigns, processedRollsSelectedLocations, processedRollsSelectedProcesses]);

  const activeProcessedRollsFiltersCount = 
    processedRollsSelectedDates.length +
    processedRollsSelectedPofs.length +
    processedRollsSelectedPartners.length +
    processedRollsSelectedOrders.length +
    processedRollsSelectedDesigns.length +
    processedRollsSelectedLocations.length +
    processedRollsSelectedProcesses.length;

  const handleClearProcessedRollsFilters = () => {
    setProcessedRollsSelectedDates([]);
    setProcessedRollsSelectedPofs([]);
    setProcessedRollsSelectedPartners([]);
    setProcessedRollsSelectedOrders([]);
    setProcessedRollsSelectedDesigns([]);
    setProcessedRollsSelectedLocations([]);
    setProcessedRollsSelectedProcesses([]);
  };

  const processedRollsFilterSpecs = useMemo(() => {
    return [
      {
        key: 'procRoll_date',
        label: 'Received Date',
        options: dependentFilterOptions.receivedDates,
        selected: processedRollsSelectedDates,
        setSelected: setProcessedRollsSelectedDates,
        placeholder: 'All Dates'
      },
      {
        key: 'procRoll_pof',
        label: 'POF Number',
        options: dependentFilterOptions.pofNumbers,
        selected: processedRollsSelectedPofs,
        setSelected: setProcessedRollsSelectedPofs,
        placeholder: 'All POFs'
      },
      {
        key: 'procRoll_partner',
        label: 'Partner',
        options: dependentFilterOptions.partners,
        selected: processedRollsSelectedPartners,
        setSelected: setProcessedRollsSelectedPartners,
        placeholder: 'All Partners'
      },
      {
        key: 'procRoll_order',
        label: 'Order',
        options: dependentFilterOptions.orders,
        selected: processedRollsSelectedOrders,
        setSelected: setProcessedRollsSelectedOrders,
        placeholder: 'All Orders'
      },
      {
        key: 'procRoll_design',
        label: 'Design Name & No',
        options: dependentFilterOptions.designs,
        selected: processedRollsSelectedDesigns,
        setSelected: setProcessedRollsSelectedDesigns,
        placeholder: 'All Designs'
      },
      {
        key: 'procRoll_location',
        label: 'Location',
        options: dependentFilterOptions.locations,
        selected: processedRollsSelectedLocations,
        setSelected: setProcessedRollsSelectedLocations,
        placeholder: 'All Locations'
      },
      {
        key: 'procRoll_process',
        label: 'Process',
        options: dependentFilterOptions.processes,
        selected: processedRollsSelectedProcesses,
        setSelected: setProcessedRollsSelectedProcesses,
        placeholder: 'All Processes'
      }
    ];
  }, [dependentFilterOptions, processedRollsSelectedDates, processedRollsSelectedPofs, processedRollsSelectedPartners, processedRollsSelectedOrders, processedRollsSelectedDesigns, processedRollsSelectedLocations, processedRollsSelectedProcesses]);
  
  const receiveTotals = useMemo(() => {
    if (!selectedPof) return { sent: 0, received: 0, difference: 0, shrinkage: 0 };
    const sent = (selectedPof.fabric_rolls || []).reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
    const received = receiveProcessedRolls.reduce((sum, r) => {
      const val = parseFloat(r.qty);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
    const diff = sent - received;
    const shrinkage = sent > 0 ? (diff / sent) * 100 : 0;
    return { sent, received, difference: diff, shrinkage };
  }, [selectedPof, receiveProcessedRolls]);

  // ---------------------------------------------------------------------------
  // LIFECYCLE & SCRIPTS LOADING
  // ---------------------------------------------------------------------------
  
  // Reset view mode on sidebar link click (which updates location.key)
  useEffect(() => {
    setViewMode('menu');
  }, [location.key]);

  // Click outside filter dropdowns to close them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest('.filter-dropdown-container')) {
        setOpenDropdown(null);
        setFilterSearchQuery('');
      }
      if (isBillPofDropdownOpen && !event.target.closest('.filter-dropdown-container')) {
        setIsBillPofDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openDropdown, isBillPofDropdownOpen]);

  useEffect(() => {
    if (createdPof?.pof_number) {
      QRCode.toDataURL(createdPof.pof_number, { margin: 1, width: 120 }, (err, url) => {
        if (!err) {
          setPofQrUrl(url);
        } else {
          console.error('Error generating POF QR code:', err);
          setPofQrUrl('');
        }
      });
    } else {
      setPofQrUrl('');
    }
  }, [createdPof]);

  useEffect(() => {
    loadScripts();
    if (viewMode === 'create') {
      fetchPartners();
      fetchAllRolls();
      resetCreateForm();
    } else if (viewMode === 'receive') {
      fetchPendingPofs();
      resetReceiveForm();
    } else if (viewMode === 'all_pofs') {
      fetchAllPofs();
      fetchPartners();
    } else if (viewMode === 'bills') {
      fetchBills();
      fetchPartners();
      setIsCreatingBill(false);
      setEditingBill(null);
    } else if (viewMode === 'processed_rolls') {
      fetchProcessedRollsData();
    } else if (viewMode === 'processed_cut') {
      handleResetCut();
    }
    setError('');
    setSuccessMsg('');
    return () => {
      stopCameraScanner();
    };
  }, [viewMode]);

  const loadScripts = () => {
    if (!window.Html5Qrcode) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode';
      script.async = true;
      script.onload = () => console.log('html5-qrcode loaded in Processing Module.');
      document.body.appendChild(script);
    }
  };

  // ---------------------------------------------------------------------------
  // CREATE POF FUNCTIONS
  // ---------------------------------------------------------------------------
  const fetchPartners = async () => {
    try {
      const { data, error: err } = await supabase
        .from('master_partners')
        .select('*')
        .ilike('partner_type', '%processing%');
      
      if (err) throw err;
      if (data && data.length > 0) {
        setPartners(data);
      } else {
        // Fallback: load all partners if no processing unit is defined
        const { data: allData } = await supabase
          .from('master_partners')
          .select('*')
          .order('partner_name', { ascending: true });
        setPartners(allData || []);
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
    }
  };

  const fetchAllRolls = async () => {
    try {
      const { data, error: err } = await supabase
        .from('weaving_orders')
        .select(`
          *,
          order:orders(id, order_number, design_no, design_name)
        `);
      if (err) throw err;

      const rolls = [];
      (data || []).forEach(order => {
        const fabricRolls = Array.isArray(order.fabric_rolls) ? order.fabric_rolls : [];
        fabricRolls.forEach(r => {
          rolls.push({
            id: r.id,
            processed_roll_id: r.processed_roll_id || null,
            qty: r.qty,
            actual_qty: r.actual_qty || r.qty,
            received_qty: r.received_qty || null,
            status: r.status,
            order_number: order.order?.order_number || order.weaving_number || '—',
            design_no: order.order?.design_no || order.design_no || '—',
            design_name: order.order?.design_name || '—',
            weaving_order_id: order.id
          });
        });
      });
      setAllSystemRolls(rolls);
    } catch (err) {
      console.error('Error fetching all rolls:', err);
    }
  };

  const handleScanInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScanRoll(scanInput);
    }
  };

  const handleScanInputChange = (e) => {
    const val = e.target.value;
    setScanInput(val);
    
    const trimmed = val.trim();
    if (!trimmed) return;

    // Search for exact match in preloaded system rolls
    const match = allSystemRolls.find(r => 
      r.id.toLowerCase() === trimmed.toLowerCase() ||
      (r.processed_roll_id && r.processed_roll_id.toLowerCase() === trimmed.toLowerCase())
    );
    if (match) {
      const isProcessed = (trimmed && /\/P\d+/i.test(trimmed)) || (match.processed_roll_id && match.processed_roll_id.toLowerCase() === trimmed.toLowerCase());
      
      const isInspected = match.status === '4_point_inspected' || match.status === 'sent_to_processing' || match.status === 'received_from_processing';
      if (!isProcessed && !isInspected) {
        setError(`gregr roll not 4 poitn inspected`);
        return;
      }

      // Validate order/design consistency
      if (scannedRolls.length > 0) {
        const firstRoll = scannedRolls[0];
        if (firstRoll.order_number !== match.order_number || firstRoll.design_no !== match.design_no) {
          setError(`Cannot mix rolls from different orders/designs. Selected POF is locked to Order: ${firstRoll.order_number}, Design: ${firstRoll.design_no}`);
          return;
        }
      }

      const scannedId = isProcessed && match.processed_roll_id ? match.processed_roll_id : match.id;

      // Check duplicates
      if (scannedRolls.some(r => r.id.toLowerCase() === scannedId.toLowerCase())) {
        setError(`Roll ID "${scannedId}" has already been added.`);
        setScanInput(''); // Clear input
        return;
      }

      // Add it!
      const newRollItem = {
        id: scannedId,
        qty: isProcessed && match.received_qty !== null ? match.received_qty : match.qty,
        actual_qty: isProcessed && match.received_qty !== null ? match.received_qty : match.actual_qty,
        order_number: match.order_number,
        design_no: match.design_no,
        design_name: match.design_name,
        weaving_order_id: match.weaving_order_id
      };

      setScannedRolls(prev => [newRollItem, ...prev]);

      // Set top details
      setPofOrderNo(match.order_number);
      setPofDesignNo(match.design_no);
      setPofDesignName(match.design_name);

      setScanInput('');
      setError('');
      setSuccessMsg(`Roll ID ${scannedId} added successfully!`);
    }
  };

  const handleScanRoll = async (rollIdToSearch) => {
    const targetId = (rollIdToSearch || '').trim();
    if (!targetId) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const match = allSystemRolls.find(r => 
        r.id.toLowerCase() === targetId.toLowerCase() ||
        (r.processed_roll_id && r.processed_roll_id.toLowerCase() === targetId.toLowerCase())
      );

      if (!match) {
        // Double check by querying Supabase just in case a new roll was added since page load
        const { data: weavingOrdersList, error: queryErr } = await supabase
          .from('weaving_orders')
          .select(`
            *,
            order:orders(id, order_number, design_no, design_name)
          `);

        if (queryErr) throw queryErr;

        let foundRoll = null;
        let foundOrder = null;

        for (const order of weavingOrdersList || []) {
          const rolls = Array.isArray(order.fabric_rolls) ? order.fabric_rolls : [];
          const m = rolls.find(r => 
            r.id.toLowerCase() === targetId.toLowerCase() ||
            (r.processed_roll_id && r.processed_roll_id.toLowerCase() === targetId.toLowerCase())
          );
          if (m) {
            foundRoll = m;
            foundOrder = order;
            break;
          }
        }

        if (!foundRoll) {
          setError(`Fabric roll ID "${targetId}" not found in any weaving order.`);
          setLoading(false);
          return;
        }

        // Add to our cache
        const rollItem = {
          id: foundRoll.id,
          processed_roll_id: foundRoll.processed_roll_id || null,
          qty: foundRoll.qty,
          actual_qty: foundRoll.actual_qty || foundRoll.qty,
          received_qty: foundRoll.received_qty || null,
          status: foundRoll.status,
          order_number: foundOrder.order?.order_number || foundOrder.weaving_number || '—',
          design_no: foundOrder.order?.design_no || foundOrder.design_no || '—',
          design_name: foundOrder.order?.design_name || '—',
          weaving_order_id: foundOrder.id
        };
        setAllSystemRolls(prev => [...prev, rollItem]);
        
        // Inline processing (avoids recursive stale allSystemRolls bug)
        const isProcessed = (targetId && /\/P\d+/i.test(targetId)) || (rollItem.processed_roll_id && rollItem.processed_roll_id.toLowerCase() === targetId.toLowerCase());

        const isInspected = rollItem.status === '4_point_inspected' || rollItem.status === 'sent_to_processing' || rollItem.status === 'received_from_processing';
        if (!isProcessed && !isInspected) {
          setError(`gregr roll not 4 poitn inspected`);
          setLoading(false);
          return;
        }

        if (scannedRolls.length > 0) {
          const firstRoll = scannedRolls[0];
          if (firstRoll.order_number !== rollItem.order_number || firstRoll.design_no !== rollItem.design_no) {
            setError(`Cannot mix rolls from different orders/designs. Selected POF is locked to Order: ${firstRoll.order_number}, Design: ${firstRoll.design_no}`);
            setLoading(false);
            return;
          }
        }

        const scannedId = isProcessed && rollItem.processed_roll_id ? rollItem.processed_roll_id : rollItem.id;

        if (scannedRolls.some(r => r.id.toLowerCase() === scannedId.toLowerCase())) {
          setError(`Roll ID "${scannedId}" has already been added.`);
          setLoading(false);
          return;
        }

        const newRollItem = {
          id: scannedId,
          qty: isProcessed && rollItem.received_qty !== null ? rollItem.received_qty : rollItem.qty,
          actual_qty: isProcessed && rollItem.received_qty !== null ? rollItem.received_qty : rollItem.actual_qty,
          order_number: rollItem.order_number,
          design_no: rollItem.design_no,
          design_name: rollItem.design_name,
          weaving_order_id: rollItem.weaving_order_id
        };

        setScannedRolls(prev => [newRollItem, ...prev]);
        setPofOrderNo(rollItem.order_number);
        setPofDesignNo(rollItem.design_no);
        setPofDesignName(rollItem.design_name);
        setScanInput('');
        setSuccessMsg(`Roll ID ${scannedId} added successfully!`);
        setLoading(false);

        if (qrScanInputRef.current) {
          qrScanInputRef.current.focus();
        }
        return;
      }

      const isProcessed = (targetId && /\/P\d+/i.test(targetId)) || (match.processed_roll_id && match.processed_roll_id.toLowerCase() === targetId.toLowerCase());

      const isInspected = match.status === '4_point_inspected' || match.status === 'sent_to_processing' || match.status === 'received_from_processing';
      if (!isProcessed && !isInspected) {
        setError(`gregr roll not 4 poitn inspected`);
        setLoading(false);
        return;
      }

      if (scannedRolls.length > 0) {
        const firstRoll = scannedRolls[0];
        if (firstRoll.order_number !== match.order_number || firstRoll.design_no !== match.design_no) {
          setError(`Cannot mix rolls from different orders/designs. Selected POF is locked to Order: ${firstRoll.order_number}, Design: ${firstRoll.design_no}`);
          setLoading(false);
          return;
        }
      }

      const scannedId = isProcessed && match.processed_roll_id ? match.processed_roll_id : match.id;

      if (scannedRolls.some(r => r.id.toLowerCase() === scannedId.toLowerCase())) {
        setError(`Roll ID "${scannedId}" has already been added.`);
        setLoading(false);
        return;
      }

      const newRollItem = {
        id: scannedId,
        qty: isProcessed && match.received_qty !== null ? match.received_qty : match.qty,
        actual_qty: isProcessed && match.received_qty !== null ? match.received_qty : match.actual_qty,
        order_number: match.order_number,
        design_no: match.design_no,
        design_name: match.design_name,
        weaving_order_id: match.weaving_order_id
      };

      setScannedRolls(prev => [newRollItem, ...prev]);
      setPofOrderNo(match.order_number);
      setPofDesignNo(match.design_no);
      setPofDesignName(match.design_name);
      setScanInput('');
      setSuccessMsg(`Roll ID ${scannedId} added successfully!`);

      if (qrScanInputRef.current) {
        qrScanInputRef.current.focus();
      }
    } catch (err) {
      console.error('Error scanning roll:', err);
      setError('System error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    handleScanRoll(scanInput);
  };

  // QR Camera scanner utilities
  const startCameraScanner = () => {
    setCameraScanError('');
    if (!window.Html5Qrcode) {
      setCameraScanError('Scanner library loading. Please wait a second and retry.');
      return;
    }
    setShowCameraScanner(true);
    setTimeout(() => {
      try {
        const html5QrCode = new window.Html5Qrcode("reader");
        scannerInstanceRef.current = html5QrCode;
        html5QrCode.start(
          { facingMode: "environment" }, 
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            setScanInput(decodedText);
            stopCameraScanner();
            handleScanRoll(decodedText);
          },
          () => {}
        ).catch(err => {
          console.error("Camera access error: ", err);
          setCameraScanError("Could not access camera. Please verify permissions.");
        });
      } catch (err) {
        console.error("Scanner setup error:", err);
        setCameraScanError("Failed to initialize camera scanner.");
      }
    }, 300);
  };

  const stopCameraScanner = () => {
    if (scannerInstanceRef.current && scannerInstanceRef.current.isScanning) {
      scannerInstanceRef.current.stop().then(() => {
        scannerInstanceRef.current = null;
        setShowCameraScanner(false);
      }).catch(err => {
        console.error("Failed to stop scanner:", err);
        setShowCameraScanner(false);
      });
    } else {
      setShowCameraScanner(false);
    }
  };

  const toggleProcessSelection = (proc) => {
    setSelectedProcesses(prev => 
      prev.includes(proc) ? prev.filter(p => p !== proc) : [...prev, proc]
    );
  };

  const handleRemoveRollFromList = (id) => {
    const filtered = scannedRolls.filter(r => r.id !== id);
    setScannedRolls(filtered);
    if (filtered.length === 0) {
      setPofOrderNo('');
      setPofDesignNo('');
      setPofDesignName('');
    }
  };

  const handleCreatePOF = async (e) => {
    e.preventDefault();
    if (!selectedPartnerId) {
      alert('Please select a Processing Partner.');
      return;
    }
    if (!expectedDeliveryDate) {
      alert('Please select an Expected Delivery Date.');
      return;
    }
    if (scannedRolls.length === 0) {
      alert('Please scan/add at least one Greige fabric roll.');
      return;
    }
    if (selectedProcesses.length === 0) {
      alert('Please select at least one Process option.');
      return;
    }

    setLoading(true);
    try {
      const selectedPartner = partners.find(p => p.id === selectedPartnerId);
      const partnerName = selectedPartner ? selectedPartner.partner_name : 'Processing Unit';

      const currentYear = new Date().getFullYear();
      let pofNumber = '';
      
      // 1. Fetch next POF Number
      try {
        const { data, error: rpcErr } = await supabase.rpc('get_next_pof_number', { p_year: currentYear });
        if (rpcErr) throw rpcErr;
        pofNumber = data;
      } catch (rpcErr) {
        console.warn('RPC failed, using client-side POF number generation fallback:', rpcErr);
        const { data: latestPOFs } = await supabase
          .from('processing_orders')
          .select('pof_number')
          .like('pof_number', `AT/${currentYear}/POF/%`)
          .order('pof_number', { ascending: false })
          .limit(1);

        if (latestPOFs && latestPOFs.length > 0) {
          const lastNumStr = latestPOFs[0].pof_number.split('/').pop();
          const lastNum = parseInt(lastNumStr, 10);
          pofNumber = `AT/${currentYear}/POF/${String(lastNum + 1).padStart(5, '0')}`;
        } else {
          pofNumber = `AT/${currentYear}/POF/00001`;
        }
      }

      // Unique list of weaving order IDs scanned
      const weavingOrderIds = Array.from(new Set(scannedRolls.map(r => r.weaving_order_id)));

      // 2. Insert POF Record
      const pofRecord = {
        pof_number: pofNumber,
        created_by: profile?.id,
        partner_id: selectedPartnerId,
        partner_name: partnerName,
        expected_delivery_date: expectedDeliveryDate,
        weaving_order_ids: weavingOrderIds,
        fabric_rolls: scannedRolls,
        processes: selectedProcesses,
        vehicle_details: vehicleDetails,
        delivered_by: deliveredBy,
        width: width,
        status: 'sent_to_processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: insertData, error: insertErr } = await supabase
        .from('processing_orders')
        .insert([pofRecord])
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 3. Update status of the rolls in weaving_orders
      const rollsByWeavingOrder = {};
      scannedRolls.forEach(roll => {
        if (!rollsByWeavingOrder[roll.weaving_order_id]) {
          rollsByWeavingOrder[roll.weaving_order_id] = [];
        }
        rollsByWeavingOrder[roll.weaving_order_id].push(roll.id);
      });

      for (const woId of Object.keys(rollsByWeavingOrder)) {
        const rollIds = rollsByWeavingOrder[woId];
        
        const { data: woData, error: fetchErr } = await supabase
          .from('weaving_orders')
          .select('fabric_rolls')
          .eq('id', woId)
          .single();
          
        if (fetchErr) throw fetchErr;
        
        const currentRolls = woData.fabric_rolls || [];
        const updatedRolls = currentRolls.map(r => {
          const isMatched = rollIds.includes(r.id) || (r.processed_roll_id && rollIds.includes(r.processed_roll_id));
          if (isMatched) {
            return {
              ...r,
              status: 'sent_to_processing'
            };
          }
          return r;
        });

        const { error: updateErr } = await supabase
          .from('weaving_orders')
          .update({ fabric_rolls: updatedRolls })
          .eq('id', woId);

        if (updateErr) throw updateErr;
      }

      // Success
      setSuccessMsg(`Processing Order Form ${pofNumber} created successfully!`);
      setCreatedPof(insertData);
      setShowPrintModal(true);
      resetCreateForm();
    } catch (err) {
      console.error('Error creating POF:', err);
      alert('Failed to create Processing Order Form: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedPartnerId('');
    setExpectedDeliveryDate('');
    setScanInput('');
    setScannedRolls([]);
    setSelectedProcesses([]);
    setVehicleDetails('');
    setDeliveredBy('');
    setWidth('');
    setPofOrderNo('');
    setPofDesignNo('');
    setPofDesignName('');
  };

  // ---------------------------------------------------------------------------
  // RECEIVE FABRIC FUNCTIONS
  // ---------------------------------------------------------------------------
  const fetchPendingPofs = async () => {
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('processing_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setPendingPofs(data || []);
    } catch (err) {
      console.error('Error fetching pending POFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextProcessedStartIndex = async (orderNumber, pLevel = 1) => {
    if (!orderNumber) return 1;
    try {
      const { data: woData } = await supabase
        .from('weaving_orders')
        .select('fabric_rolls');
      
      let maxIdx = 0;
      const pattern = new RegExp(`^${orderNumber}/P${pLevel}/(\\d+)$`, 'i');
      
      if (woData) {
        woData.forEach(wo => {
          const rolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
          rolls.forEach(r => {
            if (r.id) {
               const match = r.id.match(pattern);
               if (match) {
                 const val = parseInt(match[1], 10);
                 if (val > maxIdx) maxIdx = val;
               }
            }
            if (r.processed_roll_id) {
               const match = r.processed_roll_id.match(pattern);
               if (match) {
                 const val = parseInt(match[1], 10);
                 if (val > maxIdx) maxIdx = val;
               }
            }
          });
        });
      }

      const { data: poData } = await supabase
        .from('processing_orders')
        .select('received_rolls, fabric_rolls');

      if (poData) {
        poData.forEach(po => {
          const rolls = Array.isArray(po.fabric_rolls) ? po.fabric_rolls : [];
          rolls.forEach(r => {
            if (r.id) {
               const match = r.id.match(pattern);
               if (match) {
                 const val = parseInt(match[1], 10);
                 if (val > maxIdx) maxIdx = val;
               }
            }
            if (r.processed_roll_id) {
               const match = r.processed_roll_id.match(pattern);
               if (match) {
                 const val = parseInt(match[1], 10);
                 if (val > maxIdx) maxIdx = val;
               }
            }
          });

          const rxRolls = Array.isArray(po.received_rolls) ? po.received_rolls : [];
          rxRolls.forEach(r => {
            if (r.id) {
               const match = r.id.match(pattern);
               if (match) {
                 const val = parseInt(match[1], 10);
                 if (val > maxIdx) maxIdx = val;
               }
            }
          });
        });
      }

      return maxIdx + 1;
    } catch (err) {
      console.error('Error fetching start index:', err);
      return 1;
    }
  };

  const handleSelectPof = (pof) => {
    setSelectedPof(pof);
    setReceiveReceivedBy('');
    setReceiveVehicleNo('');
    setReceiveReceivedPlace('');
    
    const sentRolls = pof.fabric_rolls || [];
    const receivedRollsList = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
    const remainingRolls = sentRolls.filter(r => !receivedRollsList.some(rx => isGreigeRollMatch(rx.greige_roll_id, r.id)));
    
    const count = remainingRolls.length > 0 ? remainingRolls.length : sentRolls.length;
    setReceiveRollsCount(count.toString());
    
    // Auto-select all rolls as default
    setReceivedRollIds((pof.fabric_rolls || []).map(r => r.id));
    
    const initialRollsData = {};
    (pof.fabric_rolls || []).forEach(r => {
      initialRollsData[r.id] = (r.actual_qty || r.qty || 0).toString();
    });
    setReceivedRollsData(initialRollsData);

    const orderNo = pof.fabric_rolls[0]?.order_number || 'ORD';

    // Find maximum P level from sent rolls to determine next target level (e.g. P1 -> P2 -> P3)
    let maxLevel = 0;
    (pof.fabric_rolls || []).forEach(r => {
      const match = r.id.match(/\/P(\d+)\//i);
      if (match) {
        const lvl = parseInt(match[1], 10);
        if (lvl > maxLevel) maxLevel = lvl;
      }
    });
    const currentPLevel = maxLevel + 1;

    fetchNextProcessedStartIndex(orderNo, currentPLevel).then(startIndex => {
      setReceiveStartIndex(startIndex);
      
      const initialProcessedRolls = [];
      for (let i = 0; i < count; i++) {
        const matchingGreige = remainingRolls[i] || remainingRolls[0] || sentRolls[i] || {};
        initialProcessedRolls.push({
          id: `${orderNo}/P${currentPLevel}/${String(startIndex + i).padStart(5, '0')}`,
          qty: '',
          greige_roll_id: matchingGreige.id || ''
        });
      }
      setReceiveProcessedRolls(initialProcessedRolls);
    });
  };

  const handleRollsCountChange = (countStr) => {
    setReceiveRollsCount(countStr);
    const count = parseInt(countStr, 10);
    if (isNaN(count) || count <= 0) {
      setReceiveProcessedRolls([]);
      return;
    }

    const orderNo = selectedPof.fabric_rolls[0]?.order_number || 'ORD';
    const sentRolls = selectedPof.fabric_rolls || [];
    const receivedRollsList = Array.isArray(selectedPof.received_rolls) ? selectedPof.received_rolls : [];
    const remainingRolls = sentRolls.filter(r => !receivedRollsList.some(rx => isGreigeRollMatch(rx.greige_roll_id, r.id)));

    // Find maximum P level from sent rolls
    let maxLevel = 0;
    (selectedPof.fabric_rolls || []).forEach(r => {
      const match = r.id.match(/\/P(\d+)\//i);
      if (match) {
        const lvl = parseInt(match[1], 10);
        if (lvl > maxLevel) maxLevel = lvl;
      }
    });
    const currentPLevel = maxLevel + 1;

    setReceiveProcessedRolls(prev => {
      const updated = [...prev];
      if (updated.length < count) {
        // Add more rows
        for (let i = updated.length; i < count; i++) {
          const matchingGreige = remainingRolls[i] || remainingRolls[0] || sentRolls[i] || {};
          updated.push({
            id: `${orderNo}/P${currentPLevel}/${String(receiveStartIndex + i).padStart(5, '0')}`,
            qty: '',
            greige_roll_id: matchingGreige.id || ''
          });
        }
      } else if (updated.length > count) {
        // Remove extra rows
        updated.splice(count);
      }
      return updated;
    });
  };

  const toggleReceiveRoll = (rollId) => {
    setReceivedRollIds(prev => 
      prev.includes(rollId) ? prev.filter(id => id !== rollId) : [...prev, rollId]
    );
  };

  const fetchProcessedRollsData = async () => {
    setProcessedRollsLoading(true);
    setError('');
    try {
      const { data: pofsData, error: pofsErr } = await supabase
        .from('processing_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (pofsErr) throw pofsErr;

      // Self-healing check: clean up any received_rolls that mistakenly contain cut child rolls (with "/01" suffix, etc.)
      let needsDbCleanup = false;
      const cleanedPofs = [];
      for (const pof of pofsData || []) {
        const receivedRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
        let hasCutRolls = false;
        const parentRollsMap = {};

        receivedRolls.forEach(rx => {
          if (rx.id && rx.id.match(/\/\d{2,3}$/)) {
            hasCutRolls = true;
            const parentId = rx.id.replace(/\/\d{2,3}$/, '');
            const parentGreigeId = rx.greige_roll_id ? rx.greige_roll_id.replace(/\/\d{2,3}$/, '') : null;

            if (!parentRollsMap[parentId]) {
              parentRollsMap[parentId] = {
                ...rx,
                id: parentId,
                qty: 0,
                greige_roll_id: parentGreigeId
              };
            }
            parentRollsMap[parentId].qty += parseFloat(rx.qty || 0);
          } else {
            if (!parentRollsMap[rx.id]) {
              parentRollsMap[rx.id] = { ...rx };
            } else {
              parentRollsMap[rx.id].qty += parseFloat(rx.qty || 0);
            }
          }
        });

        if (hasCutRolls) {
          needsDbCleanup = true;
          const cleanedReceivedRolls = Object.values(parentRollsMap).map(r => ({
            ...r,
            qty: parseFloat(r.qty.toFixed(2))
          }));
          cleanedPofs.push({
            id: pof.id,
            received_rolls: cleanedReceivedRolls
          });
        }
      }

      if (needsDbCleanup) {
        for (const cleanPof of cleanedPofs) {
          await supabase
            .from('processing_orders')
            .update({
              received_rolls: cleanPof.received_rolls,
              updated_at: new Date().toISOString()
            })
            .eq('id', cleanPof.id);
        }
        // Fetch fresh data
        setTimeout(() => {
          fetchProcessedRollsData();
        }, 100);
        return;
      }

      const { data: weavingData, error: weavingErr } = await supabase
        .from('weaving_orders')
        .select('*, order:orders(id, order_number, design_no, design_name)')
        .order('created_at', { ascending: false });
      if (weavingErr) throw weavingErr;

      const { data: movementsData, error: movementsErr } = await supabase
        .from('fabric_movements')
        .select('*');
      if (movementsErr) throw movementsErr;

      setFabricMovements(movementsData || []);

      const rolls = [];
      const pofsList = pofsData || [];
      const weavingList = weavingData || [];

      pofsList.forEach(po => {
        const receivedRollsList = Array.isArray(po.received_rolls) ? po.received_rolls : [];
        
        receivedRollsList.forEach(rx => {
          // Find all child rolls in weaving_orders that were cut from this rx.id
          let childRolls = [];
          for (const wo of weavingList) {
            const woRolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
            woRolls.forEach(r => {
              if (r.processed_roll_id && rx.id && r.processed_roll_id.toLowerCase().startsWith(rx.id.toLowerCase() + '/')) {
                childRolls.push({
                  roll: r,
                  wo: wo
                });
              }
            });
          }

          if (childRolls.length > 0) {
            // Cut has occurred! Map and push child rolls.
            childRolls.forEach(child => {
              const childRxId = child.roll.processed_roll_id;
              
              const matchingMovements = (movementsData || []).filter(m => {
                const movementRolls = Array.isArray(m.rolls) ? m.rolls : [];
                return movementRolls.some(mr => mr.id === childRxId);
              });
              if (matchingMovements.length > 0) {
                matchingMovements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              }
              const latestMovement = matchingMovements[0] || null;
              const currentLocation = latestMovement ? latestMovement.to_location : (po.received_place || 'Warehouse');

              const reWashPof = pofsList.find(poOther => {
                if (poOther.id === po.id) return false;
                const otherFabricRolls = Array.isArray(poOther.fabric_rolls) ? poOther.fabric_rolls : [];
                return otherFabricRolls.some(r => r.id && childRxId && r.id.toLowerCase() === childRxId.toLowerCase());
              });

              rolls.push({
                id: childRxId,
                greige_roll_id: child.roll.id,
                qty: child.roll.received_qty || child.roll.actual_qty || child.roll.qty,
                received_at: rx.received_at || po.received_at || po.updated_at,
                pofrr_number: rx.pofrr_number || po.pofrr_number || '—',
                pof_number: po.pof_number,
                partner_name: po.partner_name,
                processes: po.processes || [],
                received_by: po.received_by || '—',
                received_place: po.received_place || '—',
                receive_vehicle_details: po.receive_vehicle_details || '—',
                order_number: child.roll.order_number || child.wo.order?.order_number || '—',
                design_name: child.roll.design_name || child.wo.order?.design_name || '—',
                design_no: child.roll.design_no || child.wo.order?.design_no || child.wo.design_no || '—',
                weaving_number: child.wo.weaving_number || '—',
                parentRoll: child.roll,
                latestMovement: latestMovement,
                allMovements: matchingMovements,
                location: currentLocation,
                reWashPof: reWashPof || null
              });
            });
          } else {
            // No cuts, push parent roll rx as before
            let parentRoll = null;
            let parentWeavingOrder = null;

            for (const wo of weavingList) {
              const woRolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
              const match = woRolls.find(r => 
                (r.id === rx.greige_roll_id) || 
                (r.processed_roll_id && rx.id && r.processed_roll_id.toLowerCase() === rx.id.toLowerCase())
              );
              if (match) {
                parentRoll = match;
                parentWeavingOrder = wo;
                break;
              }
            }

            const matchingMovements = (movementsData || []).filter(m => {
              const movementRolls = Array.isArray(m.rolls) ? m.rolls : [];
              return movementRolls.some(mr => mr.id === rx.id);
            });

            if (matchingMovements.length > 0) {
              matchingMovements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }
            const latestMovement = matchingMovements[0] || null;
            const currentLocation = latestMovement ? latestMovement.to_location : (po.received_place || 'Warehouse');

            const reWashPof = pofsList.find(poOther => {
              if (poOther.id === po.id) return false;
              const otherFabricRolls = Array.isArray(poOther.fabric_rolls) ? poOther.fabric_rolls : [];
              return otherFabricRolls.some(r => r.id && rx.id && r.id.toLowerCase() === rx.id.toLowerCase());
            });

            const pofRollMatch = (po.fabric_rolls || []).find(r => 
              r.id && rx.greige_roll_id && r.id.toLowerCase() === rx.greige_roll_id.toLowerCase()
            );

            rolls.push({
              id: rx.id,
              greige_roll_id: rx.greige_roll_id,
              qty: rx.qty,
              received_at: rx.received_at || po.received_at || po.updated_at,
              pofrr_number: rx.pofrr_number || po.pofrr_number || '—',
              pof_number: po.pof_number,
              partner_name: po.partner_name,
              processes: po.processes || [],
              received_by: po.received_by || '—',
              received_place: po.received_place || '—',
              receive_vehicle_details: po.receive_vehicle_details || '—',
              order_number: pofRollMatch?.order_number || parentRoll?.order_number || parentWeavingOrder?.order?.order_number || '—',
              design_name: pofRollMatch?.design_name || parentRoll?.design_name || parentWeavingOrder?.order?.design_name || '—',
              design_no: pofRollMatch?.design_no || parentRoll?.design_no || parentWeavingOrder?.order?.design_no || parentWeavingOrder?.design_no || '—',
              weaving_number: parentWeavingOrder?.weaving_number || '—',
              parentRoll: parentRoll,
              latestMovement: latestMovement,
              allMovements: matchingMovements,
              location: currentLocation,
              reWashPof: reWashPof || null
            });
          }
        });
      });

      setProcessedRolls(rolls);
    } catch (err) {
      console.error('Error fetching processed rolls data:', err);
      setError('Failed to load processed rolls data: ' + err.message);
    } finally {
      setProcessedRollsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PROCESSED FABRIC ROLL CUT FUNCTIONS
  // ---------------------------------------------------------------------------
  const handleResetCut = () => {
    setCutViewState('search');
    setParentProcessedRoll(null);
    setParentPof(null);
    setCutScanInput('');
    setNumCutCuts('');
    setChildProcessedRollsInput([]);
    setSavedChildProcessedRolls([]);
    setCutSuccessMsg('');
    setCutError('');
    setTimeout(() => {
      if (cutScanInputRef.current) cutScanInputRef.current.focus();
    }, 100);
  };

  const handleSearchProcessedRoll = async (rollIdToSearch) => {
    const targetId = (rollIdToSearch || '').trim();
    if (!targetId) return;

    setIsCutLoading(true);
    setCutError('');
    setCutSuccessMsg('');
    setParentProcessedRoll(null);
    setParentPof(null);
    setNumCutCuts('');
    setChildProcessedRollsInput([]);

    try {
      // Check if this roll has already been cut (either it is a parent that was split, or is a child of something)
      let hasBeenCut = false;
      let childIds = [];
      const { data: weavingDataForCutCheck, error: weavingErrForCutCheck } = await supabase
        .from('weaving_orders')
        .select('fabric_rolls');
      if (!weavingErrForCutCheck && weavingDataForCutCheck) {
        weavingDataForCutCheck.forEach(wo => {
          const woRolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
          woRolls.forEach(r => {
            if (r.processed_roll_id && targetId && r.processed_roll_id.toLowerCase().startsWith(targetId.toLowerCase() + '/')) {
              hasBeenCut = true;
              childIds.push(r.processed_roll_id);
            }
          });
        });
      }

      if (hasBeenCut) {
        setCutError(`Processed fabric roll ID "${targetId}" has already been cut into child rolls: ${childIds.join(', ')}.`);
        setIsCutLoading(false);
        return;
      }

      // 1. Fetch processing orders to locate roll ID in received_rolls
      const { data: pofsData, error: pofsErr } = await supabase
        .from('processing_orders')
        .select('*');
      if (pofsErr) throw pofsErr;

      let foundRoll = null;
      let foundPof = null;

      // First check if targetId matches directly in received_rolls
      for (const po of pofsData || []) {
        const receivedRollsList = Array.isArray(po.received_rolls) ? po.received_rolls : [];
        const match = receivedRollsList.find(r => r.id.toLowerCase() === targetId.toLowerCase());
        if (match) {
          foundRoll = match;
          foundPof = po;
          break;
        }
      }

      // If not found directly, it might be a cut child roll (which is stored in weaving_orders)
      if (!foundRoll) {
        const { data: weavingData, error: weavingErr } = await supabase
          .from('weaving_orders')
          .select('*, order:orders(id, order_number, design_no, design_name)');
        if (weavingErr) throw weavingErr;

        let matchedWeavingRoll = null;
        let matchedWeavingOrder = null;

        for (const wo of weavingData || []) {
          const woRolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
          const match = woRolls.find(r => r.processed_roll_id && r.processed_roll_id.toLowerCase() === targetId.toLowerCase());
          if (match) {
            matchedWeavingRoll = match;
            matchedWeavingOrder = wo;
            break;
          }
        }

        if (matchedWeavingRoll) {
          // Find the parent POF by checking which POF has a received roll that is a prefix of targetId,
          // or matches the parent greige roll ID.
          const parentGreigeId = matchedWeavingRoll.id.includes('/') ? matchedWeavingRoll.id.split('/').slice(0, -1).join('/') : matchedWeavingRoll.id;
          
          for (const po of pofsData || []) {
            const receivedRollsList = Array.isArray(po.received_rolls) ? po.received_rolls : [];
            const match = receivedRollsList.find(rx => 
              (rx.greige_roll_id && rx.greige_roll_id.toLowerCase() === parentGreigeId.toLowerCase()) ||
              (targetId.toLowerCase().startsWith(rx.id.toLowerCase() + '/'))
            );
            if (match) {
              foundPof = po;
              foundRoll = {
                id: targetId,
                qty: matchedWeavingRoll.received_qty || matchedWeavingRoll.actual_qty || matchedWeavingRoll.qty,
                greige_roll_id: matchedWeavingRoll.id,
                received_at: match.received_at || po.received_at || po.updated_at,
                pofrr_number: match.pofrr_number || po.pofrr_number || '—',
                received_by: match.received_by || po.received_by || '—',
                receive_vehicle_details: match.receive_vehicle_details || po.receive_vehicle_details || '—',
                received_place: match.received_place || po.received_place || '—'
              };
              break;
            }
          }
        }
      }

      if (!foundRoll) {
        setCutError(`Processed fabric roll ID "${targetId}" not found in any Processing Order.`);
        setIsCutLoading(false);
        return;
      }

      // 2. Fetch weaving orders to get order & design details
      const { data: weavingData, error: weavingErr } = await supabase
        .from('weaving_orders')
        .select('*, order:orders(id, order_number, design_no, design_name)');
      if (weavingErr) throw weavingErr;

      let parentRollDetails = null;
      let parentWeavingOrder = null;

      for (const wo of weavingData || []) {
        const woRolls = Array.isArray(wo.fabric_rolls) ? wo.fabric_rolls : [];
        const match = woRolls.find(r => 
          (r.id === foundRoll.greige_roll_id) || 
          (r.processed_roll_id && foundRoll.id && r.processed_roll_id.toLowerCase() === foundRoll.id.toLowerCase())
        );
        if (match) {
          parentRollDetails = match;
          parentWeavingOrder = wo;
          break;
        }
      }

      const pofRollMatch = (foundPof?.fabric_rolls || []).find(r => 
        r.id && foundRoll?.greige_roll_id && r.id.toLowerCase() === foundRoll.greige_roll_id.toLowerCase()
      );

      // Assemble full processed roll payload
      const rollPayload = {
        ...foundRoll,
        order_number: pofRollMatch?.order_number || parentRollDetails?.order_number || parentWeavingOrder?.order?.order_number || '—',
        design_name: pofRollMatch?.design_name || parentRollDetails?.design_name || parentWeavingOrder?.order?.design_name || '—',
        design_no: pofRollMatch?.design_no || parentRollDetails?.design_no || parentWeavingOrder?.order?.design_no || parentWeavingOrder?.design_no || '—',
        weaving_number: parentWeavingOrder?.weaving_number || '—',
        weaving_order_id: parentWeavingOrder?.id || null
      };

      setParentProcessedRoll(rollPayload);
      setParentPof(foundPof);
      setCutViewState('details');
    } catch (err) {
      console.error('Error finding processed roll:', err);
      setCutError('System error: ' + err.message);
    } finally {
      setIsCutLoading(false);
    }
  };

  const handleCutsNumberChangeCut = (e) => {
    const val = e.target.value;
    setNumCutCuts(val);

    const count = parseInt(val) || 0;
    if (count <= 0) {
      setChildProcessedRollsInput([]);
      return;
    }

    const configs = [];
    for (let i = 0; i < count; i++) {
      const idxStr = String(i + 1).padStart(2, '0');
      const childId = `${parentProcessedRoll.id}/${idxStr}`;
      configs.push({
        id: childId,
        qty: ''
      });
    }
    setChildProcessedRollsInput(configs);
  };

  const updateChildProcessedRollField = (index, field, value) => {
    setChildProcessedRollsInput(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const handleSubmitProcessedCut = async (e) => {
    e.preventDefault();
    if (!parentProcessedRoll || !parentPof || childProcessedRollsInput.length === 0) return;

    // Validations
    for (let i = 0; i < childProcessedRollsInput.length; i++) {
      const child = childProcessedRollsInput[i];
      const qty = parseFloat(child.qty);
      if (isNaN(qty) || qty <= 0) {
        alert(`Roll ${child.id}: Please enter a valid quantity.`);
        return;
      }
    }

    const parentQty = parseFloat(parentProcessedRoll.qty || 0);
    const childQtySum = childProcessedRollsInput.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
    const qtyMismatch = parseFloat((parentQty - childQtySum).toFixed(2));

    if (Math.abs(qtyMismatch) > 0.1) {
      const confirmSumMismatch = window.confirm(
        `Total child processed qty sum (${childQtySum} m) does not match parent processed qty (${parentQty} m). Mismatch is ${qtyMismatch} m. Do you wish to submit?`
      );
      if (!confirmSumMismatch) return;
    }

    setIsCutLoading(true);
    try {
      // 1. Load fresh POF data to avoid concurrency issues
      const { data: freshPof, error: freshPofErr } = await supabase
        .from('processing_orders')
        .select('*')
        .eq('id', parentPof.id)
        .single();
      if (freshPofErr) throw freshPofErr;

      const currentReceivedRolls = Array.isArray(freshPof.received_rolls) ? freshPof.received_rolls : [];

      // Create child processed rolls
      const childProcessedRolls = childProcessedRollsInput.map((child, idx) => {
        const idxStr = String(idx + 1).padStart(2, '0');
        return {
          ...parentProcessedRoll, // Inherit metadata
          id: child.id,
          qty: parseFloat(child.qty),
          greige_roll_id: parentProcessedRoll.greige_roll_id ? `${parentProcessedRoll.greige_roll_id}/${idxStr}` : null
        };
      });

      // Update POF updated_at in DB - we do not update received_rolls so that the original receipt record (8 rolls received) is preserved in historical POF and order sections.
      const { error: updatePofErr } = await supabase
        .from('processing_orders')
        .update({
          updated_at: new Date().toISOString()
        })
        .eq('id', parentPof.id);

      if (updatePofErr) throw updatePofErr;

      // 2. Also update the weaving order containing the greige rolls, if applicable
      if (parentProcessedRoll.weaving_order_id) {
        const { data: woData, error: woErr } = await supabase
          .from('weaving_orders')
          .select('fabric_rolls')
          .eq('id', parentProcessedRoll.weaving_order_id)
          .single();

        if (!woErr && woData) {
          const currentWoRolls = woData.fabric_rolls || [];
          
          // We need to replace the parent greige roll that points to this processed roll with child greige rolls
          const parentGreigeRoll = currentWoRolls.find(r => r.processed_roll_id && r.processed_roll_id.toLowerCase() === parentProcessedRoll.id.toLowerCase());
          
          if (parentGreigeRoll) {
            const ratio = parentProcessedRoll.qty > 0 ? parseFloat(parentGreigeRoll.qty || 0) / parentProcessedRoll.qty : 1;
            const actualRatio = parentProcessedRoll.qty > 0 ? parseFloat(parentGreigeRoll.actual_qty || 0) / parentProcessedRoll.qty : 1;

            const childGreigeRolls = childProcessedRollsInput.map((child, idx) => {
              const childProcessedQty = parseFloat(child.qty);
              const childGreigeQty = parseFloat((childProcessedQty * ratio).toFixed(2));
              const childActualQty = parseFloat((childProcessedQty * actualRatio).toFixed(2));
              
              return {
                ...parentGreigeRoll,
                id: `${parentGreigeRoll.id}/${String(idx + 1).padStart(2, '0')}`,
                qty: childGreigeQty,
                actual_qty: childActualQty,
                actual_length: childActualQty,
                processed_roll_id: child.id,
                received_qty: childProcessedQty,
                received_from_processing_at: new Date().toISOString()
              };
            });

            const updatedWoRolls = [];
            for (const r of currentWoRolls) {
              if (r.processed_roll_id && r.processed_roll_id.toLowerCase() === parentProcessedRoll.id.toLowerCase()) {
                updatedWoRolls.push(...childGreigeRolls);
              } else {
                updatedWoRolls.push(r);
              }
            }

            const { error: updateWoErr } = await supabase
              .from('weaving_orders')
              .update({ fabric_rolls: updatedWoRolls })
              .eq('id', parentProcessedRoll.weaving_order_id);

            if (updateWoErr) {
              console.error('Error updating weaving order fabric rolls sync:', updateWoErr);
            }
          }
        }
      }

      setCutSuccessMsg(`✅ Processed Roll ID ${parentProcessedRoll.id} split successfully into ${childProcessedRolls.length} rolls.`);
      setSavedChildProcessedRolls(childProcessedRolls);
      setCutViewState('success');

      // Auto print labels
      setTimeout(() => {
        handlePrintProcessedLabels(childProcessedRolls);
      }, 300);
    } catch (err) {
      console.error('Error cutting processed roll:', err);
      alert('Failed to split roll: ' + err.message);
    } finally {
      setIsCutLoading(false);
    }
  };

  const handlePrintProcessedLabels = async (rollsToPrint) => {
    const win = window.open('', '_blank');
    if (!win) {
      alert('Failed to print: Popup blocker is active. Please allow popups for this site.');
      return;
    }

    win.document.write('<html><body><div style="font-family:sans-serif;padding:20px;text-align:center;color:#666;">Generating QR Code labels, please wait...</div></body></html>');
    win.document.close();

    try {
      const rollsWithQr = await Promise.all(rollsToPrint.map(async (roll) => {
        return new Promise((resolve) => {
          QRCode.toDataURL(roll.id, { margin: 1, width: 120 }, (err, url) => {
            if (err) {
              console.error('QR generation error:', err);
              resolve({ ...roll, qrCodeUrl: '' });
            } else {
              resolve({ ...roll, qrCodeUrl: url });
            }
          });
        });
      }));

      win.document.open();
      const labelsHtml = rollsWithQr.map((roll, idx) => `
        <div class="label-container">
          <div class="label-left">
            <div class="field-row">
              <span class="field-label">ROLL ID:</span>
              <span class="field-value roll-id">${roll.id}</span>
            </div>
            <div class="field-row">
              <span class="field-label">POF NUMBER:</span>
              <span class="field-value">${roll.pof_number || parentPof?.pof_number || '—'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">ORDER NO:</span>
              <span class="field-value">${roll.order_number || '—'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN NO:</span>
              <span class="field-value">${roll.design_no || '—'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN NAME:</span>
              <span class="field-value">${roll.design_name || '—'}</span>
            </div>
            <div class="field-row" style="margin-top: 2px;">
              <span class="field-label" style="font-size: 8px;">QUANTITY:</span>
              <span class="field-value qty-val">${roll.qty} Mtrs</span>
            </div>
          </div>
          <div class="label-right">
            ${roll.qrCodeUrl ? `<img class="qr-code" src="${roll.qrCodeUrl}" alt="QR" />` : '<div class="qr-placeholder">No QR</div>'}
            <div class="roll-number">Cut #${String(idx + 1).padStart(2, '0')}</div>
          </div>
        </div>
      `).join('');

      win.document.write(`
        <html>
          <head>
            <title>Split Processed Roll Labels - ${parentPof?.pof_number || 'Cut'}</title>
            <style>
              @page {
                size: 9cm 5cm;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                background: white;
                color: #000;
                width: 9cm;
                height: 5cm;
              }
              .label-container {
                width: 9cm;
                height: 5cm;
                padding: 0.3cm;
                display: flex;
                border: 1px dashed #ccc;
                page-break-after: always;
                position: relative;
                overflow: hidden;
              }
              @media print {
                .label-container {
                  border: none;
                }
              }
              .label-left {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding-right: 0.2cm;
              }
              .label-right {
                width: 2.8cm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-left: 1px dashed #ddd;
                padding-left: 0.15cm;
              }
              .field-row {
                display: flex;
                align-items: baseline;
                margin-bottom: 1px;
                line-height: 1.1;
              }
              .field-label {
                font-size: 6.5px;
                font-weight: 800;
                color: #555;
                width: 1.8cm;
                flex-shrink: 0;
                letter-spacing: 0.02em;
              }
              .field-value {
                font-size: 8px;
                font-weight: 700;
                color: #000;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .field-value.roll-id {
                font-family: monospace;
                font-size: 8.5px;
                font-weight: 900;
              }
              .field-value.qty-val {
                font-size: 12px;
                font-weight: 900;
                color: #000;
              }
              .qr-code {
                width: 2.2cm;
                height: 2.2cm;
                object-fit: contain;
              }
              .qr-placeholder {
                width: 2.2cm;
                height: 2.2cm;
                border: 1px solid #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 8px;
              }
              .roll-number {
                font-size: 8px;
                font-weight: 800;
                margin-top: 4px;
                background: #000;
                color: #fff;
                padding: 1px 6px;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script>
              window.onload = function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      win.document.close();
    } catch (printErr) {
      console.error('Error opening print window:', printErr);
      alert('Failed to print labels: ' + printErr.message);
    }
  };

  const fetchAllPofs = async () => {
    setLoading(true);
    try {
      const { data: pofsData, error: err } = await supabase
        .from('processing_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;

      // Self-healing check: clean up any received_rolls that mistakenly contain cut child rolls (with "/01" suffix, etc.)
      let needsDbCleanup = false;
      const cleanedPofs = [];
      for (const pof of pofsData || []) {
        const receivedRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
        let hasCutRolls = false;
        const parentRollsMap = {};

        receivedRolls.forEach(rx => {
          if (rx.id && rx.id.match(/\/\d{2,3}$/)) {
            hasCutRolls = true;
            const parentId = rx.id.replace(/\/\d{2,3}$/, '');
            const parentGreigeId = rx.greige_roll_id ? rx.greige_roll_id.replace(/\/\d{2,3}$/, '') : null;

            if (!parentRollsMap[parentId]) {
              parentRollsMap[parentId] = {
                ...rx,
                id: parentId,
                qty: 0,
                greige_roll_id: parentGreigeId
              };
            }
            parentRollsMap[parentId].qty += parseFloat(rx.qty || 0);
          } else {
            if (!parentRollsMap[rx.id]) {
              parentRollsMap[rx.id] = { ...rx };
            } else {
              parentRollsMap[rx.id].qty += parseFloat(rx.qty || 0);
            }
          }
        });

        if (hasCutRolls) {
          needsDbCleanup = true;
          const cleanedReceivedRolls = Object.values(parentRollsMap).map(r => ({
            ...r,
            qty: parseFloat(r.qty.toFixed(2))
          }));
          cleanedPofs.push({
            id: pof.id,
            received_rolls: cleanedReceivedRolls
          });
        }
      }

      if (needsDbCleanup) {
        for (const cleanPof of cleanedPofs) {
          await supabase
            .from('processing_orders')
            .update({
              received_rolls: cleanPof.received_rolls,
              updated_at: new Date().toISOString()
            })
            .eq('id', cleanPof.id);
        }
        // Fetch fresh data
        setTimeout(() => {
          fetchAllPofs();
        }, 100);
        return;
      }

      setAllPofs(pofsData || []);
    } catch (err) {
      console.error('Error fetching all POFs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBills = async () => {
    setBillsLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('processing_finance_bills')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching bills:', err);
      setError('Failed to load processing bills.');
    } finally {
      setBillsLoading(false);
    }
  };

  const fetchReceivedUnbilledPofs = async (partnerId, includePofIds = []) => {
    if (!partnerId) {
      setReceivedUnbilledPofs([]);
      return;
    }
    setLoading(true);
    try {
      let query = supabase
        .from('processing_orders')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('status', 'received');

      if (includePofIds && includePofIds.length > 0) {
        query = query.or(`payment_status.eq.no_bill,payment_status.is.null,id.in.(${includePofIds.map(id => `"${id}"`).join(',')})`);
      } else {
        query = query.or('payment_status.eq.no_bill,payment_status.is.null');
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setReceivedUnbilledPofs(data || []);
    } catch (err) {
      console.error('Error fetching received POFs:', err);
      setError('Failed to load received POFs for this partner.');
    } finally {
      setLoading(false);
    }
  };

  const handleBillPartnerChange = async (partnerId) => {
    setSelectedBillPartnerId(partnerId);
    setSelectedBillPofIds([]);
    setProcessRates({});
    setTaxAmountInput('');
    setTaxPercentageInput('');
    setBillNumberInput('');
    
    if (!partnerId) {
      setReceivedUnbilledPofs([]);
      return;
    }

    await fetchReceivedUnbilledPofs(partnerId);

    const partner = partners.find(p => p.id === partnerId);
    if (partner) {
      const partnerName = partner.partner_name;
      const year = new Date().getFullYear();
      const sanitizedPartnerName = partnerName.replace(/[^a-zA-Z0-9]/g, '');

      try {
        const { data, error: err } = await supabase
          .from('processing_finance_bills')
          .select('bill_number')
          .eq('partner_id', partnerId)
          .ilike('bill_number', `${sanitizedPartnerName}/${year}/%`)
          .order('bill_number', { ascending: false })
          .limit(1);

        let seq = 1;
        if (data && data.length > 0) {
          const lastBillNo = data[0].bill_number;
          const parts = lastBillNo.split('/');
          const lastSeqStr = parts[parts.length - 1];
          const lastSeq = parseInt(lastSeqStr, 10);
          if (!isNaN(lastSeq)) {
            seq = lastSeq + 1;
          }
        }
        setBillNumberInput(`${sanitizedPartnerName}/${year}/${String(seq).padStart(4, '0')}`);
      } catch (err) {
        console.error('Error generating bill number:', err);
        setBillNumberInput(`${sanitizedPartnerName}/${year}/0001`);
      }
    }
  };

  const toggleBillPofSelection = (pofId) => {
    setSelectedBillPofIds(prev => {
      const next = prev.includes(pofId) ? prev.filter(id => id !== pofId) : [...prev, pofId];
      const selectedPofs = receivedUnbilledPofs.filter(p => next.includes(p.id));
      const uniqueProcs = Array.from(new Set(selectedPofs.flatMap(p => p.processes || [])));
      setProcessRates(current => {
        const updated = {};
        uniqueProcs.forEach(p => {
          updated[p] = current[p] !== undefined ? current[p] : '';
        });
        return updated;
      });
      return next;
    });
  };

  const handleEditBillClick = async (bill) => {
    setEditingBill(bill);
    setIsCreatingBill(true);
    setSelectedBillPartnerId(bill.partner_id);
    setSelectedBillPofIds(bill.selected_pof_ids || []);
    setBillNumberInput(bill.bill_number);
    setTaxAmountInput(bill.tax_amount ? String(bill.tax_amount) : '');

    if (bill.calculated_total > 0 && bill.tax_amount > 0) {
      setTaxPercentageInput(String(Math.round((bill.tax_amount / bill.calculated_total) * 100)));
    } else {
      setTaxPercentageInput('');
    }

    const ratesMap = {};
    if (Array.isArray(bill.process_rates)) {
      bill.process_rates.forEach(r => {
        ratesMap[r.process] = String(r.rate_per_meter);
      });
    }
    setProcessRates(ratesMap);

    await fetchReceivedUnbilledPofs(bill.partner_id, bill.selected_pof_ids || []);
  };

  const handleApproveBill = async (bill) => {
    if (!window.confirm('Are you sure you want to approve this bill?')) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { error: billErr } = await supabase
        .from('processing_finance_bills')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (billErr) throw billErr;

      const { error: orderErr } = await supabase
        .from('processing_orders')
        .update({
          payment_status: 'approved'
        })
        .in('id', bill.selected_pof_ids || []);

      if (orderErr) throw orderErr;

      setSuccessMsg('Bill approved successfully!');
      fetchBills();
      fetchAllPofs();
    } catch (err) {
      console.error('Error approving bill:', err);
      setError('Failed to approve bill: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSettleBill = async (bill) => {
    if (!window.confirm('Are you sure you want to settle this bill?')) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { error: billErr } = await supabase
        .from('processing_finance_bills')
        .update({
          status: 'settled',
          settled_by: profile?.id,
          settled_at: new Date().toISOString()
        })
        .eq('id', bill.id);

      if (billErr) throw billErr;

      const { error: orderErr } = await supabase
        .from('processing_orders')
        .update({
          payment_status: 'settled'
        })
        .in('id', bill.selected_pof_ids || []);

      if (orderErr) throw orderErr;

      setSuccessMsg('Bill settled successfully!');
      fetchBills();
      fetchAllPofs();
    } catch (err) {
      console.error('Error settling bill:', err);
      setError('Failed to settle bill: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBill = async (e) => {
    e.preventDefault();
    if (!selectedBillPartnerId) {
      alert('Please select a partner.');
      return;
    }
    if (selectedBillPofIds.length === 0) {
      alert('Please select at least one received POF.');
      return;
    }
    if (!billNumberInput.trim()) {
      alert('Please enter a bill number.');
      return;
    }

    const selectedPofs = receivedUnbilledPofs.filter(p => selectedBillPofIds.includes(p.id));
    const uniqueProcs = Array.from(new Set(selectedPofs.flatMap(p => p.processes || [])));

    for (const proc of uniqueProcs) {
      const rate = parseFloat(processRates[proc]);
      if (isNaN(rate) || rate <= 0) {
        alert(`Please enter a valid rate greater than zero for the process: ${proc}`);
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const partner = partners.find(p => p.id === selectedBillPartnerId);
      const partnerName = partner ? partner.partner_name : 'Partner';

      const billItems = selectedPofs.map(pof => {
        const rolls = pof.fabric_rolls || [];
        const qtySent = rolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
        const receivedRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
        const qtyReceived = receivedRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
        const shrinkagePct = qtySent > 0 ? ((qtySent - qtyReceived) / qtySent) * 100 : 0;

        return {
          pof_id: pof.id,
          pof_number: pof.pof_number,
          greige_sent_rolls: rolls.length,
          greige_sent_qty: qtySent,
          processed_rolls_recd: receivedRolls.length,
          processed_qty_recd: qtyReceived,
          shrinkage: shrinkagePct,
          sent_date: pof.created_at,
          received_date: pof.received_at || pof.updated_at,
          status: pof.status,
          processes: pof.processes
        };
      });

      const totalActualQty = billItems.reduce((sum, item) => sum + item.greige_sent_qty, 0);

      const processRatesArray = uniqueProcs.map(proc => {
        const rate = parseFloat(processRates[proc]) || 0;
        return {
          process: proc,
          rate_per_meter: rate,
          calculated_total: totalActualQty * rate
        };
      });

      const calculatedTotal = processRatesArray.reduce((sum, r) => sum + r.calculated_total, 0);
      const taxAmount = parseFloat(taxAmountInput) || 0;

      const billData = {
        bill_number: billNumberInput.trim(),
        partner_id: selectedBillPartnerId,
        partner_name: partnerName,
        selected_pof_ids: selectedBillPofIds,
        bill_items: billItems,
        process_rates: processRatesArray,
        calculated_total: calculatedTotal,
        tax_amount: taxAmount,
        invoice_total: calculatedTotal + taxAmount,
        status: 'submitted_for_approval',
        submitted_by: profile?.id,
        submitted_at: new Date().toISOString()
      };

      let finalBill;
      if (editingBill) {
        // Update existing bill
        const { data: updatedBill, error: billErr } = await supabase
          .from('processing_finance_bills')
          .update(billData)
          .eq('id', editingBill.id)
          .select()
          .single();

        if (billErr) {
          if (billErr.code === '23505') {
            throw new Error(`A bill with number "${billNumberInput}" already exists.`);
          }
          throw billErr;
        }
        finalBill = updatedBill;

        // Determine added and removed POF IDs
        const oldPofIds = editingBill.selected_pof_ids || [];
        const removedPofIds = oldPofIds.filter(id => !selectedBillPofIds.includes(id));
        const addedPofIds = selectedBillPofIds.filter(id => !oldPofIds.includes(id));

        // Reset removed POFs in processing_orders
        if (removedPofIds.length > 0) {
          const { error: resetErr } = await supabase
            .from('processing_orders')
            .update({
              payment_status: 'no_bill',
              bill_id: null
            })
            .in('id', removedPofIds);
          if (resetErr) throw resetErr;
        }

        // Link added POFs in processing_orders
        if (addedPofIds.length > 0) {
          const { error: addErr } = await supabase
            .from('processing_orders')
            .update({
              payment_status: 'submitted_for_approval',
              bill_id: finalBill.id
            })
            .in('id', addedPofIds);
          if (addErr) throw addErr;
        }
      } else {
        // Insert new bill
        const { data: insertedBill, error: billErr } = await supabase
          .from('processing_finance_bills')
          .insert([billData])
          .select()
          .single();

        if (billErr) {
          if (billErr.code === '23505') {
            throw new Error(`A bill with number "${billNumberInput}" already exists.`);
          }
          throw billErr;
        }
        finalBill = insertedBill;

        const { error: orderErr } = await supabase
          .from('processing_orders')
          .update({
            payment_status: 'submitted_for_approval',
            bill_id: finalBill.id
          })
          .in('id', selectedBillPofIds);

        if (orderErr) throw orderErr;
      }

      setSuccessMsg(editingBill ? `Processing bill ${billNumberInput} updated successfully!` : `Processing bill ${billNumberInput} submitted successfully!`);
      setIsCreatingBill(false);
      setEditingBill(null);
      setViewMode('bills');
      fetchBills();
    } catch (err) {
      console.error('Error submitting bill:', err);
      setError('Failed to submit bill: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const printFinanceBill = (bill) => {
    try {
      const win = window.open('', '_blank');
      if (!win) {
        alert('Popup blocked! Please allow popups for this site.');
        return;
      }
      
      const itemsHtml = (bill.bill_items || []).map(item => `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px; font-family: monospace; font-weight: bold;">${item.pof_number}</td>
          <td style="padding: 8px; text-align: right;">${item.greige_sent_rolls}</td>
          <td style="padding: 8px; text-align: right;">${Number(item.greige_sent_qty).toFixed(2)} m</td>
          <td style="padding: 8px; text-align: right;">${item.processed_rolls_recd}</td>
          <td style="padding: 8px; text-align: right;">${Number(item.processed_qty_recd).toFixed(2)} m</td>
          <td style="padding: 8px; text-align: right;">${Number(item.shrinkage).toFixed(2)}%</td>
          <td style="padding: 8px; text-align: center;">${new Date(item.sent_date).toLocaleDateString('en-GB')}</td>
          <td style="padding: 8px; text-align: center;">${item.received_date ? new Date(item.received_date).toLocaleDateString('en-GB') : '—'}</td>
        </tr>
      `).join('');

      const ratesHtml = (bill.process_rates || []).map(r => `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;">${r.process}</td>
          <td style="padding: 8px; text-align: right;">₹${Number(r.rate_per_meter).toFixed(2)}</td>
          <td style="padding: 8px; text-align: right;">₹${Number(r.calculated_total).toFixed(2)}</td>
        </tr>
      `).join('');

      win.document.write(`
        <html>
          <head>
            <title>Fabric Processing Finance Bill - ${bill.bill_number}</title>
            <style>
              body { font-family: sans-serif; color: #333; margin: 30px; }
              .header { border-bottom: 2px solid #800000; padding-bottom: 15px; margin-bottom: 20px; }
              .title { font-size: 20px; color: #800000; font-weight: bold; }
              .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
              .box { padding: 10px; border: 1px solid #ccc; border-radius: 6px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
              th { background-color: #f5f5f5; border-bottom: 2px solid #ddd; padding: 8px; text-align: left; }
              .total-section { text-align: right; font-size: 14px; line-height: 1.6; margin-top: 15px; }
              @media print {
                body { margin: 10px; }
                button { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Fabric Processing Finance Bill</div>
              <div style="font-size: 13px; color: #666; margin-top: 4px;">Bill Number: &nbsp;${bill.bill_number}</div>
            </div>
            
            <div class="grid">
              <div class="box">
                <strong>Partner Details:</strong><br/>
                Name: ${bill.partner_name}<br/>
                Date: ${new Date(bill.submitted_at).toLocaleDateString('en-GB')}<br/>
                Status: ${bill.status.toUpperCase()}
              </div>
              <div class="box">
                <strong>Summary Info:</strong><br/>
                Calculated Subtotal: ₹${Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br/>
                Tax Amount: ₹${Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}<br/>
                <strong>Grand Total: ₹${Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <strong>Billed Processing Order Forms (POFs)</strong>
            <table>
              <thead>
                <tr>
                  <th>POF Number</th>
                  <th style="text-align: right;">Greige Rolls</th>
                  <th style="text-align: right;">Greige Qty</th>
                  <th style="text-align: right;">Recd Rolls</th>
                  <th style="text-align: right;">Recd Qty</th>
                  <th style="text-align: right;">Shrinkage</th>
                  <th style="text-align: center;">Sent Date</th>
                  <th style="text-align: center;">Recd Date</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <strong>Process Rates Applied</strong>
            <table style="width: 50%;">
              <thead>
                <tr>
                  <th>Process Name</th>
                  <th style="text-align: right;">Rate / Meter</th>
                  <th style="text-align: right;">Calculated Cost</th>
                </tr>
              </thead>
              <tbody>
                ${ratesHtml}
              </tbody>
            </table>

            <div class="total-section">
              <div>Calculated Subtotal: ₹${Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div>Tax Amount: ₹${Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
              <div style="font-size: 16px; font-weight: bold; color: #800000; border-top: 1px solid #ddd; padding-top: 5px; display: inline-block;">
                Grand Total: ₹${Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <script>
              window.onload = function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      win.document.close();
    } catch (printErr) {
      console.error('Error printing bill:', printErr);
      alert('Failed to print bill: ' + printErr.message);
    }
  };

  const handleReceiveFabric = async (e) => {
    e.preventDefault();
    if (!selectedPof) return;
    
    // Validate inputs
    const n = parseInt(receiveRollsCount, 10);
    if (isNaN(n) || n <= 0) {
      alert('Please enter a valid number of processed rolls received.');
      return;
    }
    if (receiveProcessedRolls.length !== n) {
      alert('Mismatch in the number of processed rolls.');
      return;
    }
    if (!receiveReceivedBy) {
      alert('Please enter the Received By person name.');
      return;
    }
    if (!receiveReceivedPlace) {
      alert('Please enter the Received Place.');
      return;
    }

    // Verify all processed quantities are filled and valid
    for (let i = 0; i < receiveProcessedRolls.length; i++) {
      const roll = receiveProcessedRolls[i];
      if (!roll.qty || parseFloat(roll.qty) <= 0) {
        alert(`Please enter a valid quantity for processed roll ID: ${roll.id}`);
        return;
      }
      if (!roll.greige_roll_id) {
        alert(`Please select the source Greige Roll ID for processed roll: ${roll.id}`);
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Generate POFRR sequence number
      const currentYear = new Date().getFullYear();
      let nextPofrrNo = '';
      try {
        const { data: latestReceipts, error: seqErr } = await supabase
          .from('processing_orders')
          .select('pofrr_number')
          .not('pofrr_number', 'is', null)
          .like('pofrr_number', `AT/${currentYear}/POFRR/%`)
          .order('pofrr_number', { ascending: false })
          .limit(1);

        if (seqErr) throw seqErr;

        if (latestReceipts && latestReceipts.length > 0) {
          const lastNumStr = latestReceipts[0].pofrr_number.split('/').pop();
          const lastNum = parseInt(lastNumStr, 10);
          nextPofrrNo = `AT/${currentYear}/POFRR/${String(lastNum + 1).padStart(4, '0')}`;
        } else {
          nextPofrrNo = `AT/${currentYear}/POFRR/0001`;
        }
      } catch (err) {
        console.warn('Failed to fetch POFRR number from DB, using fallback:', err);
        nextPofrrNo = `AT/${currentYear}/POFRR/${String(Math.floor(Math.random() * 9000) + 1000)}`;
      }

      // 2. Format received rolls array
      const formattedReceivedRolls = receiveProcessedRolls.map(r => ({
        id: r.id,
        qty: parseFloat(r.qty || 0),
        greige_roll_id: r.greige_roll_id,
        received_at: new Date().toISOString(),
        pofrr_number: nextPofrrNo,
        received_by: receiveReceivedBy,
        receive_vehicle_details: receiveVehicleNo,
        received_place: receiveReceivedPlace
      }));

      // Combined list of received rolls (existing + new)
      const existingReceived = Array.isArray(selectedPof.received_rolls) ? selectedPof.received_rolls : [];
      const combinedReceivedRolls = [...existingReceived, ...formattedReceivedRolls];

      // Determine status based on cumulative rolls received vs rolls sent
      const sentRolls = selectedPof.fabric_rolls || [];
      const totalSentCount = sentRolls.length;
      const updatedStatus = combinedReceivedRolls.length < totalSentCount ? 'partially_received' : 'received';

      // Calculate overall shrinkage of the POF
      const totalSentQty = sentRolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
      const totalReceivedQty = combinedReceivedRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
      const overallShrinkage = totalSentQty > 0 ? ((totalSentQty - totalReceivedQty) / totalSentQty) * 100 : 0;
      const overallShrinkageFixed = parseFloat(overallShrinkage.toFixed(2));

      // 3. Update processing_orders record
      const updatePayload = {
        status: updatedStatus,
        received_by: receiveReceivedBy,
        receive_vehicle_details: receiveVehicleNo,
        received_place: receiveReceivedPlace,
        pofrr_number: nextPofrrNo,
        received_rolls: combinedReceivedRolls,
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: pofErr } = await supabase
        .from('processing_orders')
        .update(updatePayload)
        .eq('id', selectedPof.id);

      if (pofErr) throw pofErr;

      // 4. Update status and IDs of the rolls in weaving_orders
      const rollsByWeavingOrder = {};
      receiveProcessedRolls.forEach(procRoll => {
        const parentGreige = sentRolls.find(gr => gr.id === procRoll.greige_roll_id);
        if (parentGreige) {
          const woId = parentGreige.weaving_order_id;
          if (!rollsByWeavingOrder[woId]) {
            rollsByWeavingOrder[woId] = [];
          }
          rollsByWeavingOrder[woId].push({
            greige_roll_id: procRoll.greige_roll_id,
            processed_roll_id: procRoll.id,
            received_qty: parseFloat(procRoll.qty || 0)
          });
        }
      });

      for (const woId of Object.keys(rollsByWeavingOrder)) {
        const items = rollsByWeavingOrder[woId];

        const { data: woData, error: fetchErr } = await supabase
          .from('weaving_orders')
          .select('fabric_rolls')
          .eq('id', woId)
          .single();

        if (fetchErr) throw fetchErr;

        const currentRolls = woData.fabric_rolls || [];
        const updatedRolls = currentRolls.map(r => {
          const match = items.find(item => item.greige_roll_id === r.id);
          if (match) {
            return {
              ...r,
              status: 'received_from_processing',
              processed_roll_id: match.processed_roll_id,
              received_qty: match.received_qty,
              shrinkage_pct: overallShrinkageFixed, // Set total shrinkage of the POF
              received_from_processing_at: new Date().toISOString()
            };
          }
          return r;
        });

        const { error: updateErr } = await supabase
          .from('weaving_orders')
          .update({ fabric_rolls: updatedRolls })
          .eq('id', woId);

        if (updateErr) throw updateErr;
      }

      // Construct and set printable POFRR
      const pofrrDoc = {
        pofrr_number: nextPofrrNo,
        pof_number: selectedPof.pof_number,
        partner_name: selectedPof.partner_name,
        created_at: selectedPof.created_at, // sent date
        received_at: updatePayload.received_at, // received date
        expected_delivery_date: selectedPof.expected_delivery_date,
        vehicle_details: selectedPof.vehicle_details,
        delivered_by: selectedPof.delivered_by,
        received_by: receiveReceivedBy,
        received_place: receiveReceivedPlace,
        receive_vehicle_details: receiveVehicleNo,
        fabric_rolls: selectedPof.fabric_rolls, // sent rolls
        received_rolls: formattedReceivedRolls, // rolls received in this transaction
        all_received_rolls: combinedReceivedRolls, // all rolls received so far
        processes: selectedPof.processes,
        status: updatedStatus,
        width: selectedPof.width
      };

      setSuccessMsg(`POFRR ${nextPofrrNo} generated successfully! Fabric rolls checked in.`);
      setCreatedPofrr(pofrrDoc);
      setShowPofrrPrintModal(true);
      setSelectedPof(null);
      fetchPendingPofs();
    } catch (err) {
      console.error('Error receiving fabric:', err);
      alert('Failed to receive fabric: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetReceiveForm = () => {
    setSelectedPof(null);
    setReceiveReceivedBy('');
    setReceiveVehicleNo('');
    setReceivedRollIds([]);
    setReceivedRollsData({});
  };

  // Helper to filter POFs based on a subset of active filters
  const getFilteredPofsExcept = (excludeFilterName) => {
    return pendingPofs.filter(pof => {
      // 1. Status Filter (always applies)
      if (statusFilter !== 'all') {
        if (pof.status !== statusFilter) return false;
      }
      // 2. Date Filter
      if (excludeFilterName !== 'date' && selectedDates.length > 0) {
        const pofDate = new Date(pof.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        if (!selectedDates.includes(pofDate)) return false;
      }
      // 3. POF Filter
      if (excludeFilterName !== 'pof' && selectedPofs.length > 0) {
        if (!selectedPofs.includes(pof.pof_number)) return false;
      }
      // 4. Partner Filter
      if (excludeFilterName !== 'partner' && selectedPartners.length > 0) {
        if (!selectedPartners.includes(pof.partner_name)) return false;
      }
      // 5. Order Number Filter
      if (excludeFilterName !== 'order' && selectedOrderNos.length > 0) {
        const orderNos = (pof.fabric_rolls || []).map(r => r.order_number);
        if (!orderNos.some(o => selectedOrderNos.includes(o))) return false;
      }
      // 6. Design Name Filter
      if (excludeFilterName !== 'designName' && selectedDesignNames.length > 0) {
        const designNames = (pof.fabric_rolls || []).map(r => r.design_name);
        if (!designNames.some(d => selectedDesignNames.includes(d))) return false;
      }
      // 7. Design Number Filter
      if (excludeFilterName !== 'designNo' && selectedDesignNos.length > 0) {
        const designNos = (pof.fabric_rolls || []).map(r => r.design_no);
        if (!designNos.some(d => selectedDesignNos.includes(d))) return false;
      }
      return true;
    });
  };

  // Extract unique options dynamically for advanced filters (dependent on other filters)
  const uniqueDates = Array.from(new Set([
    ...selectedDates,
    ...getFilteredPofsExcept('date').map(pof => {
      if (!pof.created_at) return '';
      return new Date(pof.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    })
  ])).filter(Boolean).sort((a, b) => new Date(b) - new Date(a));

  const uniquePofs = Array.from(new Set([
    ...selectedPofs,
    ...getFilteredPofsExcept('pof').map(pof => pof.pof_number)
  ])).filter(Boolean).sort();

  const uniquePartners = Array.from(new Set([
    ...selectedPartners,
    ...getFilteredPofsExcept('partner').map(pof => pof.partner_name)
  ])).filter(Boolean).sort();
  
  const uniqueOrderNos = Array.from(new Set([
    ...selectedOrderNos,
    ...getFilteredPofsExcept('order').flatMap(pof => (pof.fabric_rolls || []).map(r => r.order_number))
  ])).filter(Boolean).sort();
  
  const uniqueDesignNames = Array.from(new Set([
    ...selectedDesignNames,
    ...getFilteredPofsExcept('designName').flatMap(pof => (pof.fabric_rolls || []).map(r => r.design_name))
  ])).filter(Boolean).sort();
  
  const uniqueDesignNos = Array.from(new Set([
    ...selectedDesignNos,
    ...getFilteredPofsExcept('designNo').flatMap(pof => (pof.fabric_rolls || []).map(r => r.design_no))
  ])).filter(Boolean).sort();

  const handleClearFilters = () => {
    setSelectedDates([]);
    setSelectedPofs([]);
    setSelectedPartners([]);
    setSelectedOrderNos([]);
    setSelectedDesignNames([]);
    setSelectedDesignNos([]);
  };

  const activeFiltersCount = 
    selectedDates.length +
    selectedPofs.length +
    selectedPartners.length +
    selectedOrderNos.length +
    selectedDesignNames.length +
    selectedDesignNos.length;

  const filterSpecs = [
    { label: 'Date', key: 'date', options: uniqueDates, selected: selectedDates, setSelected: setSelectedDates },
    { label: 'POF Number', key: 'pof', options: uniquePofs, selected: selectedPofs, setSelected: setSelectedPofs },
    { label: 'Partner', key: 'partner', options: uniquePartners, selected: selectedPartners, setSelected: setSelectedPartners },
    { label: 'Order Number', key: 'order', options: uniqueOrderNos, selected: selectedOrderNos, setSelected: setSelectedOrderNos },
    { label: 'Design Name', key: 'designName', options: uniqueDesignNames, selected: selectedDesignNames, setSelected: setSelectedDesignNames },
    { label: 'Design Number', key: 'designNo', options: uniqueDesignNos, selected: selectedDesignNos, setSelected: setSelectedDesignNos },
  ];

  const filteredPofs = pendingPofs.filter(pof => {
    // 1. Status Filter
    if (statusFilter !== 'all') {
      if (pof.status !== statusFilter) return false;
    }
    // 2. Date Filter
    if (selectedDates.length > 0) {
      const pofDate = new Date(pof.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      if (!selectedDates.includes(pofDate)) return false;
    }
    // 3. POF Filter
    if (selectedPofs.length > 0) {
      if (!selectedPofs.includes(pof.pof_number)) return false;
    }
    // 4. Partner Filter
    if (selectedPartners.length > 0) {
      if (!selectedPartners.includes(pof.partner_name)) return false;
    }
    // 5. Order Number Filter
    if (selectedOrderNos.length > 0) {
      const orderNos = (pof.fabric_rolls || []).map(r => r.order_number);
      if (!orderNos.some(o => selectedOrderNos.includes(o))) return false;
    }
    // 6. Design Name Filter
    if (selectedDesignNames.length > 0) {
      const designNames = (pof.fabric_rolls || []).map(r => r.design_name);
      if (!designNames.some(d => selectedDesignNames.includes(d))) return false;
    }
    return true;
  });

  // ---------------------------------------------------------------------------
  // ALL POFS HISTORICAL FILTERING & EDITING HANDLERS
  // ---------------------------------------------------------------------------
  const getOptionLabel = (key, val) => {
    if (key === 'paymentStatus') {
      if (val === 'settled') return 'Settled';
      if (val === 'approved') return 'Approved';
      if (val === 'submitted_for_approval') return 'Submitted for Approval';
      if (val === 'no_bill') return 'No Bill';
      return val;
    }
    if (key === 'status') {
      if (val === 'sent_to_processing') return 'Sent';
      if (val === 'partially_received') return 'Partially Received';
      if (val === 'received') return 'Received';
      return val;
    }
    return val;
  };

  // Helper to filter all POFs based on a subset of active filters (for interdependence)
  const getAllPofsFilteredExcept = (excludeFilterName) => {
    return allPofs.filter(pof => {
      // 1. Date Filter
      if (excludeFilterName !== 'date' && allPofsSelectedDates.length > 0) {
        const pofDate = new Date(pof.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        if (!allPofsSelectedDates.includes(pofDate)) return false;
      }
      // 2. POF Filter
      if (excludeFilterName !== 'pof' && allPofsSelectedPofs.length > 0) {
        if (!allPofsSelectedPofs.includes(pof.pof_number)) return false;
      }
      // 3. Partner Filter
      if (excludeFilterName !== 'partner' && allPofsSelectedPartners.length > 0) {
        if (!allPofsSelectedPartners.includes(pof.partner_name)) return false;
      }
      // 4. Order Number Filter
      if (excludeFilterName !== 'order' && allPofsSelectedOrderNos.length > 0) {
        const orderNos = (pof.fabric_rolls || []).map(r => r.order_number);
        if (!orderNos.some(o => allPofsSelectedOrderNos.includes(o))) return false;
      }
      // 5. Design Name Filter
      if (excludeFilterName !== 'designName' && allPofsSelectedDesignNames.length > 0) {
        const designNames = (pof.fabric_rolls || []).map(r => r.design_name);
        if (!designNames.some(d => allPofsSelectedDesignNames.includes(d))) return false;
      }
      // 6. Design Number Filter
      if (excludeFilterName !== 'designNo' && allPofsSelectedDesignNos.length > 0) {
        const designNos = (pof.fabric_rolls || []).map(r => r.design_no);
        if (!designNos.some(d => allPofsSelectedDesignNos.includes(d))) return false;
      }
      // 7. Payment Status Filter
      if (excludeFilterName !== 'paymentStatus' && allPofsSelectedPaymentStatuses.length > 0) {
        const payStatus = pof.payment_status || 'no_bill';
        if (!allPofsSelectedPaymentStatuses.includes(payStatus)) return false;
      }
      // 8. Status Filter
      if (excludeFilterName !== 'status' && allPofsSelectedStatuses.length > 0) {
        if (!allPofsSelectedStatuses.includes(pof.status)) return false;
      }
      return true;
    });
  };

  const allPofsUniqueDates = Array.from(new Set([
    ...allPofsSelectedDates,
    ...getAllPofsFilteredExcept('date').map(pof => {
      if (!pof.created_at) return '';
      return new Date(pof.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    })
  ])).filter(Boolean).sort((a, b) => new Date(b) - new Date(a));

  const allPofsUniquePofs = Array.from(new Set([
    ...allPofsSelectedPofs,
    ...getAllPofsFilteredExcept('pof').map(pof => pof.pof_number)
  ])).filter(Boolean).sort();

  const allPofsUniquePartners = Array.from(new Set([
    ...allPofsSelectedPartners,
    ...getAllPofsFilteredExcept('partner').map(pof => pof.partner_name)
  ])).filter(Boolean).sort();

  const allPofsUniqueOrderNos = Array.from(new Set([
    ...allPofsSelectedOrderNos,
    ...getAllPofsFilteredExcept('order').flatMap(pof => (pof.fabric_rolls || []).map(r => r.order_number))
  ])).filter(Boolean).sort();

  const allPofsUniqueDesignNames = Array.from(new Set([
    ...allPofsSelectedDesignNames,
    ...getAllPofsFilteredExcept('designName').flatMap(pof => (pof.fabric_rolls || []).map(r => r.design_name))
  ])).filter(Boolean).sort();

  const allPofsUniqueDesignNos = Array.from(new Set([
    ...allPofsSelectedDesignNos,
    ...getAllPofsFilteredExcept('designNo').flatMap(pof => (pof.fabric_rolls || []).map(r => r.design_no))
  ])).filter(Boolean).sort();

  const allPofsUniquePaymentStatuses = Array.from(new Set([
    ...allPofsSelectedPaymentStatuses,
    ...getAllPofsFilteredExcept('paymentStatus').map(pof => pof.payment_status || 'no_bill')
  ])).filter(Boolean).sort();

  const allPofsUniqueStatuses = Array.from(new Set([
    ...allPofsSelectedStatuses,
    ...getAllPofsFilteredExcept('status').map(pof => pof.status)
  ])).filter(Boolean).sort();

  const handleClearAllPofsFilters = () => {
    setAllPofsSelectedDates([]);
    setAllPofsSelectedPofs([]);
    setAllPofsSelectedPartners([]);
    setAllPofsSelectedOrderNos([]);
    setAllPofsSelectedDesignNames([]);
    setAllPofsSelectedDesignNos([]);
    setAllPofsSelectedPaymentStatuses([]);
    setAllPofsSelectedStatuses([]);
  };

  const allPofsActiveFiltersCount = 
    allPofsSelectedDates.length +
    allPofsSelectedPofs.length +
    allPofsSelectedPartners.length +
    allPofsSelectedOrderNos.length +
    allPofsSelectedDesignNames.length +
    allPofsSelectedDesignNos.length +
    allPofsSelectedPaymentStatuses.length +
    allPofsSelectedStatuses.length;

  const allPofsFilterSpecs = [
    { label: 'Date', key: 'date', options: allPofsUniqueDates, selected: allPofsSelectedDates, setSelected: setAllPofsSelectedDates },
    { label: 'POF Number', key: 'pof', options: allPofsUniquePofs, selected: allPofsSelectedPofs, setSelected: setAllPofsSelectedPofs },
    { label: 'Partner', key: 'partner', options: allPofsUniquePartners, selected: allPofsSelectedPartners, setSelected: setAllPofsSelectedPartners },
    { label: 'Order Number', key: 'order', options: allPofsUniqueOrderNos, selected: allPofsSelectedOrderNos, setSelected: setAllPofsSelectedOrderNos },
    { label: 'Design Name', key: 'designName', options: allPofsUniqueDesignNames, selected: allPofsSelectedDesignNames, setSelected: setAllPofsSelectedDesignNames },
    { label: 'Design Number', key: 'designNo', options: allPofsUniqueDesignNos, selected: allPofsSelectedDesignNos, setSelected: setAllPofsSelectedDesignNos },
    { label: 'Payment Status', key: 'paymentStatus', options: allPofsUniquePaymentStatuses, selected: allPofsSelectedPaymentStatuses, setSelected: setAllPofsSelectedPaymentStatuses },
    { label: 'Status', key: 'status', options: allPofsUniqueStatuses, selected: allPofsSelectedStatuses, setSelected: setAllPofsSelectedStatuses }
  ];

  const filteredAllPofs = allPofs.filter(pof => {
    // 1. Date Filter
    if (allPofsSelectedDates.length > 0) {
      const pofDate = new Date(pof.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      if (!allPofsSelectedDates.includes(pofDate)) return false;
    }
    // 2. POF Filter
    if (allPofsSelectedPofs.length > 0) {
      if (!allPofsSelectedPofs.includes(pof.pof_number)) return false;
    }
    // 3. Partner Filter
    if (allPofsSelectedPartners.length > 0) {
      if (!allPofsSelectedPartners.includes(pof.partner_name)) return false;
    }
    // 4. Order Number Filter
    if (allPofsSelectedOrderNos.length > 0) {
      const orderNos = (pof.fabric_rolls || []).map(r => r.order_number);
      if (!orderNos.some(o => allPofsSelectedOrderNos.includes(o))) return false;
    }
    // 5. Design Name Filter
    if (allPofsSelectedDesignNames.length > 0) {
      const designNames = (pof.fabric_rolls || []).map(r => r.design_name);
      if (!designNames.some(d => allPofsSelectedDesignNames.includes(d))) return false;
    }
    // 6. Design Number Filter
    if (allPofsSelectedDesignNos.length > 0) {
      const designNos = (pof.fabric_rolls || []).map(r => r.design_no);
      if (!designNos.some(d => allPofsSelectedDesignNos.includes(d))) return false;
    }
    // 7. Payment Status Filter
    if (allPofsSelectedPaymentStatuses.length > 0) {
      const payStatus = pof.payment_status || 'no_bill';
      if (!allPofsSelectedPaymentStatuses.includes(payStatus)) return false;
    }
    // 8. Status Filter
    if (allPofsSelectedStatuses.length > 0) {
      if (!allPofsSelectedStatuses.includes(pof.status)) return false;
    }
    return true;
  });

  const handleOpenEditModal = (pof) => {
    setEditingPof(pof);
    setEditPofPartnerId(pof.partner_id || '');
    const dateStr = pof.expected_delivery_date ? new Date(pof.expected_delivery_date).toISOString().split('T')[0] : '';
    setEditPofExpectedDate(dateStr);
    setEditPofFabricRolls(pof.fabric_rolls ? JSON.parse(JSON.stringify(pof.fabric_rolls)) : []);
    setEditPofReceivedRolls(pof.received_rolls ? JSON.parse(JSON.stringify(pof.received_rolls)) : []);
    setShowEditModal(false); // will set true below
    setError('');
    setSuccessMsg('');
    setShowEditModal(true);
  };

  const handleSaveEditedPof = async (e) => {
    if (e) e.preventDefault();
    if (editPofFabricRolls.length === 0) {
      alert('Cannot save processing order with 0 greige rolls. Please add rolls or cancel editing.');
      return;
    }

    setEditLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const selectedPartner = partners.find(p => p.id === editPofPartnerId);
      const partnerName = selectedPartner ? selectedPartner.partner_name : 'Processing Unit';

      // Calculate status and overall shrinkage
      const sentRolls = editPofFabricRolls;
      const totalSentCount = sentRolls.length;
      const rxRolls = editPofReceivedRolls;
      
      let updatedStatus = 'sent_to_processing';
      if (rxRolls.length > 0) {
        updatedStatus = rxRolls.length < totalSentCount ? 'partially_received' : 'received';
      }

      const totalSentQty = sentRolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
      const totalReceivedQty = rxRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
      const overallShrinkageFixed = totalSentQty > 0 ? parseFloat((((totalSentQty - totalReceivedQty) / totalSentQty) * 100).toFixed(2)) : 0;

      // Update processing_orders record
      const updatePayload = {
        partner_id: editPofPartnerId,
        partner_name: partnerName,
        expected_delivery_date: editPofExpectedDate ? new Date(editPofExpectedDate).toISOString() : null,
        fabric_rolls: editPofFabricRolls,
        received_rolls: editPofReceivedRolls,
        status: updatedStatus,
        updated_at: new Date().toISOString()
      };

      const { error: pofUpdateErr } = await supabase
        .from('processing_orders')
        .update(updatePayload)
        .eq('id', editingPof.id);

      if (pofUpdateErr) throw pofUpdateErr;

      // Sync weaving_orders fabric_rolls status
      const originalRolls = editingPof.fabric_rolls || [];
      const newRollIds = editPofFabricRolls.map(r => r.id);
      const deletedRolls = originalRolls.filter(r => !newRollIds.includes(r.id));

      const allWoIds = Array.from(new Set([
        ...originalRolls.map(r => r.weaving_order_id),
        ...editPofFabricRolls.map(r => r.weaving_order_id)
      ])).filter(Boolean);

      for (const woId of allWoIds) {
        const { data: woData, error: woFetchErr } = await supabase
          .from('weaving_orders')
          .select('fabric_rolls')
          .eq('id', woId)
          .single();

        if (woFetchErr) {
          console.error(`Error fetching weaving order ${woId}:`, woFetchErr);
          continue;
        }

        const currentRolls = woData.fabric_rolls || [];
        const updatedRolls = currentRolls.map(r => {
          const isDeleted = deletedRolls.some(del => 
            del.id.toLowerCase() === r.id.toLowerCase() || 
            (r.processed_roll_id && del.id.toLowerCase() === r.processed_roll_id.toLowerCase())
          );
          const activeRoll = editPofFabricRolls.find(act => 
            act.id.toLowerCase() === r.id.toLowerCase() || 
            (r.processed_roll_id && act.id.toLowerCase() === r.processed_roll_id.toLowerCase())
          );

          if (isDeleted) {
            // Revert to previous state
            const hasBeenProcessed = !!r.processed_roll_id;
            return {
              ...r,
              status: hasBeenProcessed ? 'received_from_processing' : '4_point_inspected',
              processed_roll_id: hasBeenProcessed ? r.processed_roll_id : undefined,
              received_qty: hasBeenProcessed ? r.received_qty : undefined,
              shrinkage_pct: hasBeenProcessed ? r.shrinkage_pct : undefined,
              received_from_processing_at: hasBeenProcessed ? r.received_from_processing_at : undefined
            };
          } else if (activeRoll) {
            // Check if this roll is received
            const rxRoll = editPofReceivedRolls.find(rx => isGreigeRollMatch(rx.greige_roll_id, r.id));
            if (rxRoll) {
              return {
                ...r,
                status: 'received_from_processing',
                processed_roll_id: rxRoll.id,
                received_qty: rxRoll.qty,
                shrinkage_pct: overallShrinkageFixed,
                received_from_processing_at: rxRoll.received_at || new Date().toISOString()
              };
            } else {
              // Still pending
              const hasBeenProcessed = !!r.processed_roll_id;
              return {
                ...r,
                status: 'sent_to_processing',
                processed_roll_id: hasBeenProcessed ? r.processed_roll_id : undefined,
                received_qty: hasBeenProcessed ? r.received_qty : undefined,
                shrinkage_pct: hasBeenProcessed ? r.shrinkage_pct : undefined,
                received_from_processing_at: hasBeenProcessed ? r.received_from_processing_at : undefined
              };
            }
          }
          return r;
        });

        const { error: woUpdateErr } = await supabase
          .from('weaving_orders')
          .update({ fabric_rolls: updatedRolls })
          .eq('id', woId);

        if (woUpdateErr) throw woUpdateErr;
      }

      setSuccessMsg(`Processing Order Form ${editingPof.pof_number} updated successfully!`);
      setShowEditModal(false);
      setEditingPof(null);
      await fetchAllPofs();
    } catch (err) {
      console.error('Error saving edited POF:', err);
      setError('Failed to save changes: ' + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Auto-trigger POFRR print dialog on confirm receipt
  useEffect(() => {
    if (showPofrrPrintModal && createdPofrr) {
      const timer = setTimeout(() => {
        window.print();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showPofrrPrintModal, createdPofrr]);

  // Helper to print individual roll labels (9cm width x 5cm height)
  const handlePrintRollLabels = async (rollsToPrint, pofContext = null) => {
    try {
      const activePof = pofContext || selectedPof;
      const rollsWithQr = await Promise.all(rollsToPrint.map(async (roll) => {
        return new Promise((resolve) => {
          QRCode.toDataURL(roll.id, { margin: 1, width: 120 }, (err, url) => {
            if (err) {
              console.error('QR generation error:', err);
              resolve({ ...roll, qrCodeUrl: '' });
            } else {
              resolve({ ...roll, qrCodeUrl: url });
            }
          });
        });
      }));

      const win = window.open('', '_blank');
      if (!win) {
        alert('Pop-up window blocked. Please allow popups for label printing.');
        return;
      }
      
      const orderNo = activePof?.fabric_rolls?.[0]?.order_number || '—';
      const designNo = activePof?.fabric_rolls?.[0]?.design_no || '—';
      const designName = activePof?.fabric_rolls?.[0]?.design_name || '—';

      const labelsHtml = rollsWithQr.map((roll, idx) => `
        <div class="label-container">
          <div class="label-left">
            <div class="field-row">
              <span class="field-label">ROLL ID:</span>
              <span class="field-value roll-id">${roll.id}</span>
            </div>
            <div class="field-row">
              <span class="field-label">POF NO:</span>
              <span class="field-value">${activePof?.pof_number || '—'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">ORDER NO:</span>
              <span class="field-value">${orderNo}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN NO:</span>
              <span class="field-value">${designNo}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN NAME:</span>
              <span class="field-value">${designName}</span>
            </div>
            <div class="field-row" style="margin-top: 2px;">
              <span class="field-label" style="font-size: 8px;">QUANTITY:</span>
              <span class="field-value qty-val">${roll.qty} Mtrs</span>
            </div>
          </div>
          <div class="label-right">
            ${roll.qrCodeUrl ? `<img class="qr-code" src="${roll.qrCodeUrl}" alt="QR" />` : '<div class="qr-placeholder">No QR</div>'}
            <div class="roll-number">Roll #${String(idx + 1).padStart(2, '0')}</div>
          </div>
        </div>
      `).join('');

      win.document.write(`
        <html>
          <head>
            <title>Fabric Roll Labels - ${activePof?.pof_number || 'Labels'}</title>
            <style>
              @page {
                size: 9cm 5cm;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                background: white;
                color: #000;
                width: 9cm;
                height: 5cm;
              }
              .label-container {
                width: 9cm;
                height: 5cm;
                padding: 0.3cm;
                display: flex;
                border: 1px dashed #ccc;
                page-break-after: always;
                position: relative;
                overflow: hidden;
              }
              @media print {
                .label-container {
                  border: none;
                }
              }
              .label-left {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding-right: 0.2cm;
              }
              .label-right {
                width: 2.8cm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-left: 1px dashed #ddd;
                padding-left: 0.15cm;
              }
              .field-row {
                display: flex;
                align-items: baseline;
                margin-bottom: 1px;
                line-height: 1.1;
              }
              .field-label {
                font-size: 6.5px;
                font-weight: 800;
                color: #555;
                width: 1.8cm;
                flex-shrink: 0;
                letter-spacing: 0.02em;
              }
              .field-value {
                font-size: 8px;
                font-weight: 700;
                color: #000;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .field-value.roll-id {
                font-family: monospace;
                font-size: 8.5px;
                font-weight: 900;
              }
              .field-value.qty-val {
                font-size: 12px;
                font-weight: 900;
                color: #000;
              }
              .qr-code {
                width: 2.2cm;
                height: 2.2cm;
                object-fit: contain;
              }
              .qr-placeholder {
                width: 2.2cm;
                height: 2.2cm;
                border: 1px solid #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 8px;
              }
              .roll-number {
                font-size: 8px;
                font-weight: 800;
                margin-top: 4px;
                background: #000;
                color: #fff;
                padding: 1px 6px;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script>
              window.onload = function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      win.document.close();
    } catch (printErr) {
      console.error('Error printing labels:', printErr);
      alert('Failed to print labels: ' + printErr.message);
    }
  };

  const handlePrintProcessedRollLabel = async (rollsToPrint) => {
    try {
      const rollsWithQr = await Promise.all(rollsToPrint.map(async (roll) => {
        return new Promise((resolve) => {
          QRCode.toDataURL(roll.id, { margin: 1, width: 120 }, (err, url) => {
            if (err) {
              console.error('QR generation error:', err);
              resolve({ ...roll, qrCodeUrl: '' });
            } else {
              resolve({ ...roll, qrCodeUrl: url });
            }
          });
        });
      }));

      const win = window.open('', '_blank');
      if (!win) {
        alert('Pop-up window blocked. Please allow popups for label printing.');
        return;
      }

      const labelsHtml = rollsWithQr.map((roll, idx) => {
        const processStr = Array.isArray(roll.processes) ? roll.processes.join(', ') : (roll.processes || '—');
        const rollNum = roll.id ? String(roll.id).split('/').pop() : String(idx + 1).padStart(2, '0');
        
        return `
        <div class="label-container">
          <div class="label-left">
            <div class="field-row">
              <span class="field-label">PROCESSED ID:</span>
              <span class="field-value roll-id">${roll.id}</span>
            </div>
            <div class="field-row">
              <span class="field-label">POF NO:</span>
              <span class="field-value">${roll.pof_number || '—'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">ORDER NO:</span>
              <span class="field-value">${roll.order_number || '—'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">DESIGN:</span>
              <span class="field-value">${roll.design_name || '—'} (${roll.design_no || '—'})</span>
            </div>
            <div class="field-row" style="margin-top: 2px;">
              <span class="field-label" style="font-size: 8px;">QUANTITY:</span>
              <span class="field-value qty-val">${parseFloat(roll.qty || 0).toFixed(2)} Mtrs</span>
            </div>
          </div>
          <div class="label-right">
            ${roll.qrCodeUrl ? `<img class="qr-code" src="${roll.qrCodeUrl}" alt="QR" />` : '<div class="qr-placeholder">No QR</div>'}
            <div class="roll-number" style="background-color: #800000;">Roll #${rollNum}</div>
          </div>
        </div>
        `;
      }).join('');

      win.document.write(`
        <html>
          <head>
            <title>Processed Roll Labels - ${rollsToPrint[0]?.id || 'Labels'}</title>
            <style>
              @page {
                size: 9cm 5cm;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                background: white;
                color: #000;
                width: 9cm;
                height: 5cm;
              }
              .label-container {
                width: 9cm;
                height: 5cm;
                padding: 0.3cm;
                display: flex;
                border: 1px dashed #ccc;
                page-break-after: always;
                position: relative;
                overflow: hidden;
              }
              @media print {
                .label-container {
                  border: none;
                }
              }
              .label-left {
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding-right: 0.2cm;
              }
              .label-right {
                width: 2.8cm;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-left: 1px dashed #ddd;
                padding-left: 0.15cm;
              }
              .field-row {
                display: flex;
                align-items: baseline;
                margin-bottom: 1px;
                line-height: 1.1;
              }
              .field-label {
                font-size: 6.5px;
                font-weight: 800;
                color: #555;
                width: 1.8cm;
                flex-shrink: 0;
                letter-spacing: 0.02em;
              }
              .field-value {
                font-size: 8px;
                font-weight: 700;
                color: #000;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              .field-value.roll-id {
                font-family: monospace;
                font-size: 8.5px;
                font-weight: 900;
              }
              .field-value.qty-val {
                font-size: 11px;
                font-weight: 900;
                color: #000;
              }
              .qr-code {
                width: 2.2cm;
                height: 2.2cm;
                object-fit: contain;
              }
              .qr-placeholder {
                width: 2.2cm;
                height: 2.2cm;
                border: 1px solid #ccc;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 8px;
              }
              .roll-number {
                font-size: 8px;
                font-weight: 800;
                margin-top: 4px;
                background: #800000;
                color: #fff;
                padding: 1px 6px;
                border-radius: 3px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script>
              window.onload = function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      win.document.close();
    } catch (printErr) {
      console.error('Error printing labels:', printErr);
      alert('Failed to print labels: ' + printErr.message);
    }
  };

  const selectedPofsObjects = receivedUnbilledPofs.filter(pof => selectedBillPofIds.includes(pof.id));

  const childQtySum = childProcessedRollsInput.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
  const qtyMismatch = parentProcessedRoll ? parseFloat((parseFloat(parentProcessedRoll.qty || 0) - childQtySum).toFixed(2)) : 0;

  const isFullWidthView = viewMode === 'receive' || viewMode === 'all_pofs' || viewMode === 'bills' || viewMode === 'processed_rolls';

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: isFullWidthView ? 'none' : '1000px', 
      margin: isFullWidthView ? '0' : '0 auto', 
      paddingTop: isFullWidthView ? '1.5rem' : '1rem',
      paddingRight: isFullWidthView ? '2.5rem' : '1rem',
      paddingBottom: '3rem',
      paddingLeft: isFullWidthView ? '2.5rem' : '1rem',
      fontFamily: 'var(--font-sans)', 
      boxSizing: 'border-box'
    }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--color-primary)', color: 'white', padding: '0.5rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0 }}>Greige Fabric Processing</h1>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Roll Send / Receive Dashboard
            </span>
          </div>
        </div>
        
        {viewMode !== 'menu' && (
          <button
            onClick={() => setViewMode('menu')}
            className="hover-lift"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border-current)',
              backgroundColor: 'white', color: 'var(--text-current)', padding: '6px 12px', borderRadius: '8px',
              fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        )}
      </div>

      {/* SUCCESS / ERROR ALERTS */}
      {successMsg && (
        <div className="fade-in" style={{
          backgroundColor: '#ecfdf5', border: '1px solid #10b981', color: '#047857',
          padding: '0.85rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '700',
          marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 4px rgba(16,185,129,0.06)'
        }}>
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {error && (
        <div className="fade-in" style={{
          backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c',
          padding: '0.85rem 1.25rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '700',
          marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 4px rgba(239,68,68,0.06)'
        }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* CAMERA SCAN MODAL */}
      {showCameraScanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000,
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          padding: '1.5rem'
        }}>
          <div style={{ width: '100%', maxWidth: '380px', backgroundColor: 'white', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--color-primary)' }}>📷 QR Code Scanner</strong>
              <button onClick={stopCameraScanner} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#be123c' }}>
                <X size={20} />
              </button>
            </div>
            
            {cameraScanError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem' }}>
                {cameraScanError}
              </div>
            )}

            <div id="reader" style={{ width: '100%', overflow: 'hidden', borderRadius: '12px' }}></div>
            
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', textAlign: 'center' }}>
              Aim your camera at the QR code printed on the fabric roll label.
            </span>
          </div>
        </div>
      )}

      {/* VIEW MODES */}
      
      {/* 1. DASHBOARD HUB MENU */}
      {viewMode === 'menu' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginTop: '1rem' }} className="fade-in">
          {/* Card 1: Create Processing Order Form */}
          <div 
            onClick={() => setViewMode('create')}
            className="hover-lift"
            style={{
              backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '16px',
              padding: '2rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: 'var(--shadow-md)', transition: 'all 0.3s ease-in-out', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.04, color: 'var(--color-primary)'
            }}>
              <FileText size={160} />
            </div>
            <div style={{ 
              backgroundColor: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', width: '48px', height: '48px',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileText size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', margin: '0 0 0.5rem 0' }}>
                Create Processing Order Form
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted-current)', margin: 0, lineHeight: 1.5 }}>
                Issue a new Processing Order Form (POF) to send Greige rolls out. Choose a partner, select processes like fabric Dyeing or Peaching, scan roll QRs, and print the order.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '750', color: 'var(--color-primary)', marginTop: 'auto' }}>
              Start form <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 2: Receive Fabric from Processing */}
          <div 
            onClick={() => setViewMode('receive')}
            className="hover-lift"
            style={{
              backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '16px',
              padding: '2rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: 'var(--shadow-md)', transition: 'all 0.3s ease-in-out', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.04, color: 'var(--color-primary)'
            }}>
              <Inbox size={160} />
            </div>
            <div style={{ 
              backgroundColor: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', width: '48px', height: '48px',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Inbox size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', margin: '0 0 0.5rem 0' }}>
                Receive Fabric from Processing
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted-current)', margin: 0, lineHeight: 1.5 }}>
                Record the arrival of processed fabric back at the warehouse. Look up active POFs, verify rolls, update roll status in the weaving history, and complete the order.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '750', color: 'var(--color-primary)', marginTop: 'auto' }}>
              Receive items <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 3: All POF (Historical Logs) */}
          <div 
            onClick={() => setViewMode('all_pofs')}
            className="hover-lift"
            style={{
              backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '16px',
              padding: '2rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: 'var(--shadow-md)', transition: 'all 0.3s ease-in-out', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.04, color: 'var(--color-primary)'
            }}>
              <Layers size={160} />
            </div>
            <div style={{ 
              backgroundColor: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', width: '48px', height: '48px',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Layers size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', margin: '0 0 0.5rem 0' }}>
                All POF (Historical Logs)
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted-current)', margin: 0, lineHeight: 1.5 }}>
                View history of all POFs. Check roll details, dispatch details, transport info, received quantities, and shrinkage reports. Print or reprint any form.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '750', color: 'var(--color-primary)', marginTop: 'auto' }}>
              View History <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 4: Processing Bills */}
          <div 
            onClick={() => setViewMode('bills')}
            className="hover-lift"
            style={{
              backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '16px',
              padding: '2rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: 'var(--shadow-md)', transition: 'all 0.3s ease-in-out', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.04, color: 'var(--color-primary)'
            }}>
              <FileText size={160} />
            </div>
            <div style={{ 
              backgroundColor: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', width: '48px', height: '48px',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <FileText size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', margin: '0 0 0.5rem 0' }}>
                Processing Bills
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted-current)', margin: 0, lineHeight: 1.5 }}>
                Manage fabric processing finance and settle amounts for received processing orders. Create new bills, enter process pricing, tax, and track approval states.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '750', color: 'var(--color-primary)', marginTop: 'auto' }}>
              Manage Bills <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 5: Processed Fabric Rolls Details */}
          <div 
            onClick={() => setViewMode('processed_rolls')}
            className="hover-lift"
            style={{
              backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '16px',
              padding: '2rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: 'var(--shadow-md)', transition: 'all 0.3s ease-in-out', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.04, color: 'var(--color-primary)'
            }}>
              <CheckCircle size={160} />
            </div>
            <div style={{ 
              backgroundColor: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', width: '48px', height: '48px',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', margin: '0 0 0.5rem 0' }}>
                Processed Fabric Rolls Details
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted-current)', margin: 0, lineHeight: 1.5 }}>
                View status, POF references, partners, received details, washed inspection logs, and dispatch statuses for all processed rolls.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '750', color: 'var(--color-primary)', marginTop: 'auto' }}>
              View Rolls <ArrowRight size={14} />
            </div>
          </div>

          {/* Card 6: Processed Fabric Roll Cut */}
          <div 
            onClick={() => setViewMode('processed_cut')}
            className="hover-lift"
            style={{
              backgroundColor: 'white', border: '1px solid var(--border-current)', borderRadius: '16px',
              padding: '2rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: 'var(--shadow-md)', transition: 'all 0.3s ease-in-out', position: 'relative', overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.04, color: 'var(--color-primary)'
            }}>
              <Scissors size={160} />
            </div>
            <div style={{ 
              backgroundColor: 'rgba(128,0,0,0.06)', color: 'var(--color-primary)', width: '48px', height: '48px',
              borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Scissors size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-current)', margin: '0 0 0.5rem 0' }}>
                Processed Fabric Roll Cut
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted-current)', margin: 0, lineHeight: 1.5 }}>
                Split processed fabric rolls into smaller child rolls, update the database inventory, and print custom QR labels for each cut.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: '750', color: 'var(--color-primary)', marginTop: 'auto' }}>
              Cut rolls <ArrowRight size={14} />
            </div>
          </div>
        </div>
      )}

      {/* 2. CREATE POF FORM VIEW */}
      {viewMode === 'create' && (
        <form onSubmit={handleCreatePOF} className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0, borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.5rem', width: 'max-content' }}>
              Create Processing Order Form (POF)
            </h2>

            {/* Partner & Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700' }}>Processing Partner</label>
                <select
                  className="input-field"
                  value={selectedPartnerId}
                  onChange={e => setSelectedPartnerId(e.target.value)}
                  required
                  style={{ fontWeight: '600' }}
                >
                  <option value="">Select Processing Partner...</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.partner_name} ({p.partner_type})</option>
                  ))}
                </select>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700' }}>Expected Delivery Date</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    className="input-field"
                    value={expectedDeliveryDate}
                    onChange={e => setExpectedDeliveryDate(e.target.value)}
                    required
                    style={{ fontWeight: '600', paddingLeft: '2.25rem' }}
                  />
                  <Calendar size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '12px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Scan / Entry Panel */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '850', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📷 Scan or Enter Greige Fabric Roll ID
              </h3>
              <button
                type="button"
                onClick={startCameraScanner}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  backgroundColor: 'rgba(128,0,0,0.06)', border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)', padding: '4px 12px', borderRadius: '6px',
                  fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer'
                }}
              >
                <Camera size={14} /> Scan Camera
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  ref={qrScanInputRef}
                  type="text"
                  placeholder="Type or Scan Greige Fabric Roll ID (Must be 4-Point Inspected)..."
                  className="input-field"
                  value={scanInput}
                  onChange={handleScanInputChange}
                  onKeyDown={handleScanInputKeyDown}
                  style={{
                    width: '100%', paddingLeft: '2.5rem', paddingRight: '0.75rem',
                    fontSize: '0.9rem', height: '44px', fontWeight: '600'
                  }}
                />
                <QrCode size={18} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '13px' }} />
              </div>
              <button
                type="button"
                onClick={() => handleScanRoll(scanInput)}
                disabled={loading || !scanInput.trim()}
                style={{
                  backgroundColor: 'var(--color-primary)', color: 'white', border: 'none',
                  borderRadius: '8px', padding: '0 1.25rem', height: '44px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontWeight: '700', gap: '0.35rem'
                }}
              >
                <Search size={16} /> Add Roll
              </button>
            </div>

            {/* Scanned Order Summary Lock */}
            {scannedRolls.length > 0 && (
              <div style={{
                backgroundColor: 'rgba(128,0,0,0.03)', border: '1px solid rgba(128,0,0,0.1)',
                padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', gap: '2rem', fontSize: '0.8rem'
              }}>
                <div>
                  <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', fontSize: '0.68rem' }}>ORDER NUMBER</span>
                  <strong style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}>{pofOrderNo}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', fontSize: '0.68rem' }}>DESIGN NO</span>
                  <strong style={{ color: 'var(--text-current)', fontSize: '0.85rem' }}>{pofDesignNo}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', fontSize: '0.68rem' }}>DESIGN NAME</span>
                  <strong style={{ color: 'var(--text-current)', fontSize: '0.85rem' }}>{pofDesignName}</strong>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', fontSize: '0.68rem' }}>TOTAL ROLLS</span>
                  <strong style={{ color: 'var(--color-primary)', fontSize: '0.85rem' }}>{scannedRolls.length} Rolls</strong>
                </div>
              </div>
            )}

            {/* Scanned rolls table */}
            {scannedRolls.length > 0 ? (
              <div style={{ border: '1px solid var(--border-current)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Greige Roll ID</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Greige Qty (m)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Inspected Actual Qty (m)</th>
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'center', width: '80px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scannedRolls.map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid var(--border-current)', fontWeight: '500' }}>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--color-primary)' }}>{r.id}</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{Number(r.qty).toFixed(2)} m</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '700', color: '#047857' }}>{Number(r.actual_qty).toFixed(2)} m</td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveRollFromList(r.id)}
                            style={{
                              background: 'none', border: 'none', color: '#be123c', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                            }}
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#fafafa', fontWeight: '800', borderTop: '2px solid var(--border-current)' }}>
                      <td style={{ padding: '0.75rem 1rem' }}>Total Qty</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        {scannedRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0).toFixed(2)} m
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#047857' }}>
                        {scannedRolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || 0), 0).toFixed(2)} m
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--border-current)', borderRadius: '12px', color: 'var(--text-muted-current)' }}>
                No rolls scanned yet. Please scan or enter a roll ID above.
              </div>
            )}
          </div>

          {/* Process Options Selector */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '850', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚙️ Select Processes (Multi-Select)
            </h3>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {PROCESS_OPTIONS.map(proc => {
                const isSelected = selectedProcesses.includes(proc);
                return (
                  <button
                    key={proc}
                    type="button"
                    onClick={() => toggleProcessSelection(proc)}
                    style={{
                      padding: '8px 16px', borderRadius: '20px', border: '1px solid',
                      borderColor: isSelected ? 'var(--color-primary)' : 'var(--border-current)',
                      background: isSelected ? 'rgba(128,0,0,0.06)' : 'white',
                      color: isSelected ? 'var(--color-primary)' : 'var(--text-muted-current)',
                      fontSize: '0.825rem', fontWeight: isSelected ? '700' : '600',
                      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {isSelected && <CheckCircle size={14} />}
                    {proc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Finished Width Specification */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '850', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📐 Finished Width Specification
            </h3>
            <div className="input-group" style={{ margin: 0 }}>
              <label className="input-label" style={{ fontWeight: '700' }}>Finished Width</label>
              <input
                type="text"
                placeholder='e.g. 58 inches, 60"'
                className="input-field"
                value={width}
                onChange={e => setWidth(e.target.value)}
              />
            </div>
          </div>

          {/* Transport & Delivery Info */}
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '850', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🚛 Transport & Delivery Details
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700' }}>Vehicle Details (No. / Model)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="e.g. TN-37-AB-1234"
                    className="input-field"
                    value={vehicleDetails}
                    onChange={e => setVehicleDetails(e.target.value)}
                    style={{ paddingLeft: '2.25rem' }}
                  />
                  <Truck size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '12px' }} />
                </div>
              </div>

              <div className="input-group" style={{ margin: 0 }}>
                <label className="input-label" style={{ fontWeight: '700' }}>Delivered By (Person Name)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Enter delivery person name"
                    className="input-field"
                    value={deliveredBy}
                    onChange={e => setDeliveredBy(e.target.value)}
                    style={{ paddingLeft: '2.25rem' }}
                  />
                  <User size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '12px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <button
            type="submit"
            disabled={loading || scannedRolls.length === 0}
            style={{
              width: '100%', padding: '0.9rem', border: 'none', borderRadius: '12px',
              backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: '800',
              fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-primary)',
              transition: 'all 0.2s'
            }}
            className="hover-lift"
          >
            {loading ? <Loader size={18} className="spin" /> : <CheckCircle size={18} />}
            Generate Processing Order Form (POF)
          </button>
        </form>
      )}

      {/* 3. RECEIVE FABRIC VIEW */}
      {viewMode === 'receive' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Active POFs List (Only if no POF is selected) */}
          {!selectedPof ? (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0 }}>
                  Active Processing Orders
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {/* Status Pills */}
                  <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '24px' }}>
                    {['all', 'sent_to_processing', 'partially_received', 'received'].map(statusOption => {
                      const label = statusOption === 'all' ? 'All' :
                                    statusOption === 'sent_to_processing' ? 'Sent' :
                                    statusOption === 'partially_received' ? 'Part Received' : 'Received';
                      const isActive = statusFilter === statusOption;
                      return (
                        <button
                          key={statusOption}
                          type="button"
                          onClick={() => setStatusFilter(statusOption)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            cursor: 'pointer',
                            border: 'none',
                            backgroundColor: isActive ? 'var(--color-primary)' : 'transparent',
                            color: isActive ? 'white' : 'var(--text-muted-current)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Filter Expand Button */}
                  <button
                    type="button"
                    onClick={() => setShowFilters(!showFilters)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      border: '1px solid var(--border-current)',
                      backgroundColor: showFilters || activeFiltersCount > 0 ? 'rgba(128, 0, 0, 0.05)' : 'white',
                      color: showFilters || activeFiltersCount > 0 ? 'var(--color-primary)' : 'var(--text-muted-current)',
                      borderColor: showFilters || activeFiltersCount > 0 ? 'var(--color-primary)' : 'var(--border-current)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Search size={14} />
                    Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
                    {showFilters ? <ChevronDown size={14} style={{ transform: 'rotate(180deg)', transition: 'transform 0.15s' }} /> : <ChevronDown size={14} style={{ transition: 'transform 0.15s' }} />}
                  </button>
                </div>
              </div>

              {/* Expandable Multi-select Filter panel */}
              {showFilters && (
                <div className="fade-in" style={{
                  backgroundColor: 'var(--bg-card-current, #fdfdfd)',
                  border: '1px solid var(--border-current)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  boxShadow: 'var(--shadow-sm)',
                  marginTop: '0.25rem'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.25rem' }}>
                    {filterSpecs.map(spec => (
                      <div key={spec.label} className="filter-dropdown-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {spec.label}
                        </span>
                        
                        {/* Dropdown Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setFilterSearchQuery('');
                            setOpenDropdown(openDropdown === spec.key ? null : spec.key);
                          }}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-current)',
                            backgroundColor: '#fff',
                            color: spec.selected.length > 0 ? 'var(--text-current)' : 'var(--text-muted-current)',
                            fontSize: '0.8rem',
                            fontWeight: spec.selected.length > 0 ? '700' : '500',
                            cursor: 'pointer',
                            textAlign: 'left'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                            {spec.selected.length === 0 ? `Select ${spec.label}` :
                             spec.selected.length === 1 ? spec.selected[0] :
                             `${spec.selected.length} Selected`}
                          </span>
                          <ChevronDown size={14} style={{ 
                            transform: openDropdown === spec.key ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.15s'
                          }} />
                        </button>

                        {/* Floating Options Menu */}
                        {openDropdown === spec.key && (
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: '0',
                            marginTop: '4px',
                            minWidth: '220px',
                            width: '100%',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            border: '1px solid var(--border-current)',
                            borderRadius: '8px',
                            padding: '8px',
                            backgroundColor: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                            zIndex: 1000
                          }}>
                            {/* Search input field */}
                            <input
                              type="text"
                              placeholder={`Search ${spec.label}...`}
                              value={filterSearchQuery}
                              onChange={e => setFilterSearchQuery(e.target.value)}
                              onClick={e => e.stopPropagation()} // Stop dropdown from closing
                              style={{
                                padding: '6px 8px',
                                fontSize: '0.8rem',
                                border: '1px solid var(--border-current)',
                                borderRadius: '6px',
                                marginBottom: '4px',
                                width: '100%',
                                outline: 'none',
                                boxSizing: 'border-box'
                              }}
                            />

                            {/* Clear option helper inside the dropdown */}
                            {spec.selected.length > 0 && (
                              <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                borderBottom: '1px solid #f3f4f6', 
                                paddingBottom: '4px',
                                marginBottom: '2px'
                              }}>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                                  {spec.selected.length} selected
                                </span>
                                <span 
                                  style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-primary)', cursor: 'pointer' }}
                                  onClick={() => spec.setSelected([])}
                                >
                                  Clear
                                </span>
                              </div>
                            )}

                            {spec.options
                              .filter(val => String(val || '').toLowerCase().includes(filterSearchQuery.toLowerCase()))
                              .map(val => {
                                const checked = spec.selected.includes(val);
                                return (
                                  <label key={val} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', padding: '2px 4px', borderRadius: '4px' }} title={val}>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => {
                                        spec.setSelected(prev =>
                                          checked ? prev.filter(v => v !== val) : [...prev, val]
                                        );
                                      }}
                                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                    />
                                    {val}
                                  </label>
                                );
                              })
                            }
                            {spec.options.filter(val => String(val || '').toLowerCase().includes(filterSearchQuery.toLowerCase())).length === 0 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontStyle: 'italic', padding: '8px', textAlign: 'center' }}>No matches found</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem' }}>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          cursor: 'pointer',
                          border: '1px solid var(--color-primary)',
                          backgroundColor: 'transparent',
                          color: 'var(--color-primary)'
                        }}
                      >
                        Clear All Filters ({activeFiltersCount})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowFilters(false)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        border: '1px solid var(--border-current)',
                        backgroundColor: '#f3f4f6',
                        color: '#374151'
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                  <Loader size={24} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} color="var(--color-primary)" />
                  Loading processing orders...
                </div>
              ) : filteredPofs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border-current)', borderRadius: '12px', color: 'var(--text-muted-current)' }}>
                  {pendingPofs.length === 0 ? 'No active processing order forms found.' : 'No processing order forms match the selected filters.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)', fontWeight: '700', color: 'var(--text-current)' }}>
                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px' }}></th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>POF Number</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Partner Name</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Details</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Expected Return</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Status</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPofs.map(pof => {
                        const count = pof.fabric_rolls?.length || 0;
                        const totalQty = (pof.fabric_rolls || []).reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
                        const isCompleted = pof.status === 'received';
                        const isExpanded = expandedPofId === pof.id;
                        
                        const receivedRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
                        const rollsReceivedCount = receivedRolls.length;
                        const qtyReceived = receivedRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
                        
                        return (
                          <React.Fragment key={pof.id}>
                            <tr 
                              style={{ 
                                borderBottom: '1px solid var(--border-current)', 
                                fontWeight: '500',
                                cursor: 'pointer',
                                backgroundColor: isExpanded ? 'rgba(128,0,0,0.02)' : 'transparent',
                                transition: 'background-color 0.15s ease'
                              }}
                              onClick={() => setExpandedPofId(isExpanded ? null : pof.id)}
                            >
                              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <span 
                                  onClick={() => setExpandedPofId(isExpanded ? null : pof.id)}
                                  style={{ 
                                    fontSize: '0.75rem', 
                                    color: 'var(--text-muted-current)', 
                                    display: 'inline-block', 
                                    transform: isExpanded ? 'rotate(90deg)' : 'none', 
                                    transition: 'transform 0.15s',
                                    cursor: 'pointer',
                                    padding: '4px'
                                  }}
                                >
                                  <ChevronRight size={14} />
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--color-primary)', fontSize: '0.9rem' }}>{pof.pof_number}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px', fontWeight: '500' }}>
                                  Ord: <span style={{ fontWeight: '700', color: 'var(--text-current)' }}>{pof.fabric_rolls?.[0]?.order_number || '—'}</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '500' }}>
                                  Des: <span style={{ fontWeight: '750', color: 'var(--text-current)' }}>{pof.fabric_rolls?.[0]?.design_name || '—'} ({pof.fabric_rolls?.[0]?.design_no || '—'})</span>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: '600' }}>{pof.partner_name}</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                                  Sent: <span style={{ color: 'var(--text-current)', fontWeight: '700' }}>{count} Rolls / {totalQty.toFixed(1)} m</span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: '600', marginTop: '4px' }}>
                                  Recd: <span style={{ fontWeight: '700' }}>{rollsReceivedCount} Rolls / {qtyReceived.toFixed(1)} m</span>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', color: isCompleted ? 'inherit' : '#b45309', fontWeight: '600' }}>
                                {new Date(pof.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: '700',
                                  backgroundColor: pof.status === 'received' ? '#ecfdf5' : pof.status === 'partially_received' ? '#eff6ff' : '#fffbeb',
                                  borderColor: pof.status === 'received' ? '#a7f3d0' : pof.status === 'partially_received' ? '#bfdbfe' : '#fde68a',
                                  color: pof.status === 'received' ? '#065f46' : pof.status === 'partially_received' ? '#1e40af' : '#92400e',
                                  border: '1px solid'
                                }}>
                                  {pof.status === 'received' ? 'Received' : pof.status === 'partially_received' ? 'Partially Received' : 'Sent'}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                                {pof.status !== 'received' && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectPof(pof)}
                                    className="btn btn-primary"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                      backgroundColor: 'var(--color-primary)',
                                      color: 'white',
                                      border: 'none',
                                      padding: '4px 10px',
                                      borderRadius: '6px',
                                      fontSize: '0.7rem',
                                      fontWeight: '800',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Receive
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const firstRoll = pof.fabric_rolls?.[0] || {};
                                    setPofOrderNo(firstRoll.order_number || 'ORD');
                                    setPofDesignNo(firstRoll.design_no || '—');
                                    setPofDesignName(firstRoll.design_name || '');
                                    setCreatedPof(pof);
                                    setShowPrintModal(true);
                                  }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                    backgroundColor: 'rgba(128,0,0,0.06)', border: '1px solid var(--color-primary)',
                                    color: 'var(--color-primary)', padding: '4px 10px', borderRadius: '6px',
                                    fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                  }}
                                  className="hover-lift"
                                >
                                  <Printer size={12} /> View POF
                                </button>
                                {(pof.status === 'received' || pof.status === 'partially_received') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const pofrrDoc = {
                                        pofrr_number: pof.pofrr_number || 'N/A',
                                        pof_number: pof.pof_number,
                                        partner_name: pof.partner_name,
                                        created_at: pof.created_at,
                                        received_at: pof.received_at || pof.updated_at,
                                        expected_delivery_date: pof.expected_delivery_date,
                                        vehicle_details: pof.vehicle_details,
                                        delivered_by: pof.delivered_by,
                                        received_by: pof.received_by || 'N/A',
                                        received_place: pof.received_place || 'N/A',
                                        receive_vehicle_details: pof.receive_vehicle_details || 'N/A',
                                        fabric_rolls: pof.fabric_rolls,
                                        received_rolls: pof.received_rolls || [],
                                        all_received_rolls: pof.received_rolls || [],
                                        processes: pof.processes,
                                        status: pof.status,
                                        width: pof.width
                                      };
                                      setCreatedPofrr(pofrrDoc);
                                      setShowPofrrPrintModal(true);
                                    }}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                      backgroundColor: '#ecfdf5', border: '1px solid #10b981',
                                      color: '#047857', padding: '4px 10px', borderRadius: '6px',
                                      fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                    }}
                                    className="hover-lift"
                                  >
                                    <FileText size={12} /> View POFRR
                                  </button>
                                )}
                              </td>
                            </tr>

                            {/* Expanded Reconciliation Detail Row */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="7" style={{ backgroundColor: '#fafafa', padding: '1.5rem', borderBottom: '1px solid var(--border-current)' }} onClick={e => e.stopPropagation()}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }} className="fade-in">
                                    
                                    {/* Title / Summary Banner */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        <h4 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: '800' }}>
                                          Reconciliation Details for POF: {pof.pof_number}
                                        </h4>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                                          Order: <strong style={{ color: 'var(--text-current)' }}>{pof.fabric_rolls?.[0]?.order_number || '—'}</strong> &nbsp;|&nbsp; 
                                          Design: <strong style={{ color: 'var(--text-current)' }}>{pof.fabric_rolls?.[0]?.design_name || '—'} ({pof.fabric_rolls?.[0]?.design_no || '—'})</strong>
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                                        Status: <strong style={{ color: pof.status === 'received' ? '#047857' : '#b45309' }}>{pof.status === 'received' ? 'Received' : pof.status === 'partially_received' ? 'Partially Received' : 'Sent'}</strong>
                                      </span>
                                    </div>

                                    {/* Side-by-side reconciliation list */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', alignItems: 'start' }}>
                                      
                                      {/* Left Side: Outbound Greige Sent details */}
                                      <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
                                        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontSize: '0.8rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>
                                          📤 Outbound Greige Roll Details
                                        </h5>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
                                          <thead>
                                            <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                              <th style={{ padding: '0.5rem 0.25rem' }}>Greige Roll ID</th>
                                              <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Greige Qty</th>
                                              <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Actual Sent Qty</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(pof.fabric_rolls || []).map(roll => (
                                              <tr key={roll.id} style={{ borderBottom: '1px solid #eee' }}>
                                                <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--color-primary)' }}>{roll.id}</td>
                                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>{Number(roll.qty).toFixed(2)} m</td>
                                                <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: '600' }}>{Number(roll.actual_qty || roll.qty).toFixed(2)} m</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                          <tfoot>
                                            <tr style={{ fontWeight: '800', borderTop: '2px solid #ddd', backgroundColor: '#fafafa' }}>
                                              <td style={{ padding: '0.5rem 0.25rem' }}>Total Sent</td>
                                              <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>
                                                {(pof.fabric_rolls || []).reduce((sum, r) => sum + parseFloat(r.qty || 0), 0).toFixed(2)} m
                                              </td>
                                              <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#047857' }}>
                                                {(pof.fabric_rolls || []).reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0).toFixed(2)} m
                                              </td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>

                                      {/* Right Side: Inbound Processed details */}
                                      <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
                                        <h5 style={{ margin: '0 0 0.75rem 0', color: 'var(--text-current)', fontSize: '0.8rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>
                                          📥 Inbound Processed & Shrinkage Details
                                        </h5>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
                                          <thead>
                                            <tr style={{ borderBottom: '1px solid #ddd', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                              <th style={{ padding: '0.5rem 0.25rem' }}>Processed Roll ID</th>
                                              <th style={{ padding: '0.5rem 0.25rem' }}>Process</th>
                                              <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Qty Received</th>
                                              <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Shrinkage %</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(pof.fabric_rolls || []).map(roll => {
                                              const rxRolls = Array.isArray(pof.received_rolls) 
                                                ? pof.received_rolls.filter(rx => isGreigeRollMatch(rx.greige_roll_id, roll.id)) 
                                                : [];
                                              
                                              if (rxRolls.length === 0) {
                                                return (
                                                  <tr key={roll.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '0.5rem 0.25rem', color: '#9ca3af', fontFamily: 'monospace' }}>Pending</td>
                                                    <td style={{ padding: '0.5rem 0.25rem', color: '#9ca3af' }}>{pof.processes?.join(', ') || '—'}</td>
                                                    <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#9ca3af' }}>—</td>
                                                    <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#9ca3af' }}></td>
                                                  </tr>
                                                );
                                              }

                                              return rxRolls.map((rxRoll, idx) => {
                                                return (
                                                  <tr key={`${roll.id}-${idx}`} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>{rxRoll.id}</td>
                                                    <td style={{ padding: '0.5rem 0.25rem', color: 'var(--text-current)' }}>{pof.processes?.join(', ') || '—'}</td>
                                                    <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{parseFloat(rxRoll.qty || 0).toFixed(2)} m</td>
                                                    <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: '700' }}></td>
                                                  </tr>
                                                );
                                              });
                                            })}
                                          </tbody>
                                          <tfoot>
                                            <tr style={{ fontWeight: '800', borderTop: '2px solid #ddd', backgroundColor: '#fafafa' }}>
                                              <td colSpan="2" style={{ padding: '0.5rem 0.25rem' }}>Total Received</td>
                                              <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#047857' }}>
                                                {Array.isArray(pof.received_rolls) 
                                                  ? pof.received_rolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0).toFixed(2) 
                                                  : '0.00'} m
                                              </td>
                                              <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: 'var(--color-primary)' }}>
                                                {(() => {
                                                  const totalSent = (pof.fabric_rolls || []).reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
                                                  const totalRecd = Array.isArray(pof.received_rolls) 
                                                    ? pof.received_rolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0) 
                                                    : 0;
                                                  const overallSh = totalSent > 0 ? ((totalSent - totalRecd) / totalSent) * 100 : 0;
                                                  return `${overallSh.toFixed(2)}%`;
                                                })()}
                                              </td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>

                                    </div>

                                    {/* Third Row: Logistics, Dispatch & Return details */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', backgroundColor: '#f9f9f9', padding: '1rem', borderRadius: '8px', border: '1px solid #eee' }}>
                                      <div>
                                        <h6 style={{ margin: '0 0 0.5rem 0', color: '#374151', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>📤 Dispatch Details</h6>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                                          <span style={{ color: 'var(--text-muted-current)' }}>Processes:</span>
                                          <strong>{pof.processes?.join(', ') || '—'}</strong>
                                          <span style={{ color: 'var(--text-muted-current)' }}>Finished Width:</span>
                                          <strong>{pof.width || '—'}</strong>
                                          <span style={{ color: 'var(--text-muted-current)' }}>Vehicle Details:</span>
                                          <strong>{pof.vehicle_details || 'N/A'}</strong>
                                          <span style={{ color: 'var(--text-muted-current)' }}>Delivered By:</span>
                                          <strong>{pof.delivered_by || 'N/A'}</strong>
                                          <span style={{ color: 'var(--text-muted-current)' }}>Dispatched At:</span>
                                          <strong>{new Date(pof.created_at).toLocaleString('en-IN')}</strong>
                                        </div>
                                      </div>
                                      <div>
                                        <h6 style={{ margin: '0 0 0.5rem 0', color: '#047857', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>📥 Return / Receipt Details</h6>
                                        {pof.status === 'received' || pof.status === 'partially_received' ? (
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                                            <span style={{ color: 'var(--text-muted-current)' }}>Received By:</span>
                                            <strong>{pof.received_by || 'N/A'}</strong>
                                            <span style={{ color: 'var(--text-muted-current)' }}>Return Place:</span>
                                            <strong>{pof.received_place || 'N/A'}</strong>
                                            <span style={{ color: 'var(--text-muted-current)' }}>Return Vehicle:</span>
                                            <strong>{pof.receive_vehicle_details || 'N/A'}</strong>
                                            <span style={{ color: 'var(--text-muted-current)' }}>Received At:</span>
                                            <strong>{pof.received_at ? new Date(pof.received_at).toLocaleString('en-IN') : '—'}</strong>
                                          </div>
                                        ) : (
                                          <div style={{ display: 'flex', alignItems: 'center', height: '100%', color: '#b45309', fontSize: '0.75rem', fontWeight: '600' }}>
                                            ⚠️ Awaiting return of processed fabric rolls.
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
             </div>
           ) : (
            /* Selected POF Receive Form */
            <form onSubmit={handleReceiveFabric} className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Back to list button */}
              <button
                type="button"
                onClick={() => setSelectedPof(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem', border: 'none',
                  background: 'none', color: 'var(--text-muted-current)', fontSize: '0.8rem',
                  fontWeight: '700', padding: 0, width: 'max-content', cursor: 'pointer'
                }}
              >
                <ArrowLeft size={14} /> Back to Active Forms
              </button>

              {/* POF Metadata Detail */}
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#fffcfc', borderColor: '#fee2e2' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #fecdd3', paddingBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                      📄 POF Ref: {selectedPof.pof_number}
                    </strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                      Order: <strong style={{ color: 'var(--text-current)' }}>{selectedPof.fabric_rolls?.[0]?.order_number || '—'}</strong> &nbsp;|&nbsp; 
                      Design: <strong style={{ color: 'var(--text-current)' }}>{selectedPof.fabric_rolls?.[0]?.design_name || '—'} ({selectedPof.fabric_rolls?.[0]?.design_no || '—'})</strong>
                    </span>
                  </div>
                  <span className="badge" style={{ 
                    backgroundColor: selectedPof.status === 'partially_received' ? '#eff6ff' : '#fffbeb', 
                    color: selectedPof.status === 'partially_received' ? '#1e40af' : '#b45309', 
                    fontSize: '0.7rem', 
                    border: '1px solid',
                    borderColor: selectedPof.status === 'partially_received' ? '#bfdbfe' : '#fde68a'
                  }}>
                    {selectedPof.status === 'partially_received' ? 'Partially Received' : 'Sent to Processing'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>PROCESSING PARTNER</span>
                    <strong style={{ fontSize: '0.85rem' }}>{selectedPof.partner_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>EXPECTED DATE</span>
                    <strong style={{ fontSize: '0.85rem', color: '#b45309' }}>
                      {new Date(selectedPof.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>PROCESSES OUTSOURCE</span>
                    <strong style={{ fontSize: '0.85rem' }}>{selectedPof.processes.join(', ')}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>FINISHED WIDTH</span>
                    <strong style={{ fontSize: '0.85rem' }}>{selectedPof.width || '—'}</strong>
                  </div>
                  {selectedPof.vehicle_details && (
                    <div>
                      <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>DELIVERED VEHICLE</span>
                      <strong style={{ fontSize: '0.85rem' }}>{selectedPof.vehicle_details}</strong>
                    </div>
                  )}
                  {selectedPof.delivered_by && (
                    <div>
                      <span style={{ color: 'var(--text-muted-current)', display: 'block', fontSize: '0.68rem', fontWeight: '600' }}>DELIVERED BY</span>
                      <strong style={{ fontSize: '0.85rem' }}>{selectedPof.delivered_by}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* SPLIT SCREEN LAYOUT */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
                
                {/* LEFT SIDE: Sent Greige Details */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: '#fcfcfc', border: '1px solid var(--border-current)' }}>
                  <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '850', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>
                    📦 Sent Greige Details ({(selectedPof.fabric_rolls || []).length} Rolls Sent)
                  </h3>

                  <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Greige Roll ID</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actual Qty Sent (m)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(selectedPof.fabric_rolls || []).map(r => {
                          // Check if this roll was already received in a previous transaction
                          const isAlreadyReceived = Array.isArray(selectedPof.received_rolls) && 
                            selectedPof.received_rolls.some(rx => isGreigeRollMatch(rx.greige_roll_id, r.id));

                          return (
                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-current)', backgroundColor: isAlreadyReceived ? '#f3f4f6' : 'transparent' }}>
                              <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.9rem', color: isAlreadyReceived ? '#9ca3af' : 'var(--color-primary)' }}>
                                {r.id} {isAlreadyReceived && <span style={{ fontSize: '0.7rem', color: '#10b981', marginLeft: '0.5rem', fontWeight: 'bold' }}>(Received)</span>}
                              </td>
                              <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '600', color: isAlreadyReceived ? '#9ca3af' : 'inherit' }}>
                                {parseFloat(r.actual_qty || r.qty || 0).toFixed(2)} m
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#fafafa', fontWeight: '800', borderTop: '2px solid var(--border-current)' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>Total Sent Qty</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                            {(selectedPof.fabric_rolls || []).reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0).toFixed(2)} m
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* RIGHT SIDE: Inbound Processed Receipt */}
                <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '850', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.5rem' }}>
                    📥 Inbound Processed Receipt
                  </h3>

                  {/* Rolls Count Input */}
                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label" style={{ fontWeight: '700' }}>Number of Processed Fabric Rolls Received</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      className="input-field"
                      value={receiveRollsCount}
                      onChange={e => handleRollsCountChange(e.target.value)}
                      required
                    />
                  </div>

                  {/* Processed Rolls Table */}
                  {receiveProcessedRolls.length > 0 ? (
                    <>
                      {/* Live Calculator Card Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: 'rgba(128,0,0,0.03)',
                        border: '1px solid rgba(128,0,0,0.1)',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        lineHeight: '1.2'
                      }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', fontSize: '0.625rem', textTransform: 'uppercase' }}>Sent Qty</span>
                          <strong style={{ fontSize: '0.95rem', color: 'var(--text-current)' }}>{receiveTotals.sent.toFixed(2)} m</strong>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-current)' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', fontSize: '0.625rem', textTransform: 'uppercase' }}>Received Qty</span>
                          <strong style={{ fontSize: '0.95rem', color: '#047857' }}>{receiveTotals.received.toFixed(2)} m</strong>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-current)' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', fontSize: '0.625rem', textTransform: 'uppercase' }}>Difference</span>
                          <strong style={{ fontSize: '0.95rem', color: receiveTotals.difference >= 0 ? '#b91c1c' : '#047857' }}>
                            {receiveTotals.difference.toFixed(2)} m
                          </strong>
                        </div>
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-current)' }}>
                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', display: 'block', fontSize: '0.625rem', textTransform: 'uppercase' }}>Shrinkage %</span>
                          <strong style={{ fontSize: '0.95rem', color: '#b45309' }}>{receiveTotals.shrinkage.toFixed(2)}%</strong>
                        </div>
                      </div>

                      <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-current)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left' }}>New Processed Roll ID</th>
                              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', width: '110px' }}>Qty Received (m)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {receiveProcessedRolls.map((roll, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                  {roll.id}
                                </td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="input-field"
                                    style={{ padding: '4px 8px', fontSize: '0.8rem', textAlign: 'right', fontWeight: '700', width: '90px', height: 'auto' }}
                                    value={roll.qty}
                                    onChange={e => {
                                      const qtyVal = e.target.value;
                                      setReceiveProcessedRolls(prev => {
                                        const updated = [...prev];
                                        updated[idx] = {
                                          ...updated[idx],
                                          qty: qtyVal
                                        };
                                        return updated;
                                      });
                                    }}
                                    required
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ backgroundColor: '#fafafa', fontWeight: '800', borderTop: '2px solid var(--border-current)' }}>
                              <td style={{ padding: '0.75rem 0.5rem' }}>Total Received Qty</td>
                              <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#047857' }}>
                                {receiveTotals.received.toFixed(2)} m
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Print Labels Button */}
                      <button
                        type="button"
                        onClick={() => handlePrintRollLabels(receiveProcessedRolls)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                          backgroundColor: 'var(--color-primary)', color: 'white', border: 'none',
                          padding: '10px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700',
                          cursor: 'pointer', boxShadow: 'var(--shadow-sm)', alignSelf: 'flex-start',
                          marginTop: '0.75rem'
                        }}
                        className="hover-lift"
                      >
                        <Printer size={16} /> Print Labels for Received Rolls ({receiveProcessedRolls.length} Labels)
                      </button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1rem', border: '1px dashed var(--border-current)', borderRadius: '8px', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>
                      Please enter a rolls count to generate input rows.
                    </div>
                  )}

                  {/* Logistics Info */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="input-group" style={{ margin: 0 }}>
                      <label className="input-label" style={{ fontWeight: '700' }}>Received By (Person Name)</label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="Receiver name"
                          className="input-field"
                          value={receiveReceivedBy}
                          onChange={e => setReceiveReceivedBy(e.target.value)}
                          required
                          style={{ paddingLeft: '2.25rem' }}
                        />
                        <User size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '12px' }} />
                      </div>
                    </div>

                    <div className="input-group" style={{ margin: 0 }}>
                       <label className="input-label" style={{ fontWeight: '700' }}>Return Place</label>
                       <select
                         className="input-field"
                         value={receiveReceivedPlace}
                         onChange={e => setReceiveReceivedPlace(e.target.value)}
                         required
                         style={{ fontWeight: '600' }}
                       >
                         <option value="">Select Return Place...</option>
                         <option value="Factory">Factory</option>
                         <option value="Office">Office</option>
                       </select>
                     </div>
                  </div>

                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label" style={{ fontWeight: '700' }}>Return Vehicle No (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="e.g. TN-37-AB-1234"
                        className="input-field"
                        value={receiveVehicleNo}
                        onChange={e => setReceiveVehicleNo(e.target.value)}
                        style={{ paddingLeft: '2.25rem' }}
                      />
                      <Truck size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '12px' }} />
                    </div>
                  </div>

                </div>
              </div>

              {/* Submit Receive button */}
              <button
                type="submit"
                disabled={loading || receiveProcessedRolls.length === 0}
                style={{
                  width: '100%', padding: '0.9rem', border: 'none', borderRadius: '12px',
                  backgroundColor: '#047857', color: 'white', fontWeight: '800',
                  fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 14px rgba(4,120,87,0.2)',
                  transition: 'all 0.2s'
                }}
                className="hover-lift"
              >
                {loading ? <Loader size={18} className="spin" /> : <CheckCircle size={18} />}
                Confirm Receipt & Store in Warehouse
              </button>

            </form>
          )}

        </div>
      )}

      {/* 4. ALL POFS HISTORICAL VIEW */}
      {viewMode === 'all_pofs' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0 }}>
                Historical Processing Order Forms (POF)
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {/* Filter Expand Button */}
                <button
                  type="button"
                  onClick={() => setAllPofsShowFilters(!allPofsShowFilters)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '6px 14px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    border: '1px solid var(--border-current)',
                    backgroundColor: allPofsShowFilters || allPofsActiveFiltersCount > 0 ? 'rgba(128, 0, 0, 0.05)' : 'white',
                    color: allPofsShowFilters || allPofsActiveFiltersCount > 0 ? 'var(--color-primary)' : 'var(--text-muted-current)',
                    borderColor: allPofsShowFilters || allPofsActiveFiltersCount > 0 ? 'var(--color-primary)' : 'var(--border-current)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Search size={14} />
                  Filters {allPofsActiveFiltersCount > 0 && `(${allPofsActiveFiltersCount})`}
                  {allPofsShowFilters ? <ChevronDown size={14} style={{ transform: 'rotate(180deg)', transition: 'transform 0.15s' }} /> : <ChevronDown size={14} style={{ transition: 'transform 0.15s' }} />}
                </button>

                <button
                  type="button"
                  onClick={fetchAllPofs}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    backgroundColor: 'rgba(128,0,0,0.06)', border: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)', padding: '4px 12px', borderRadius: '6px',
                    fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Expandable Multi-select Filter panel for All POFs */}
            {allPofsShowFilters && (
              <div className="fade-in" style={{
                backgroundColor: 'var(--bg-card-current, #fdfdfd)',
                border: '1px solid var(--border-current)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
                marginTop: '0.25rem'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
                  {allPofsFilterSpecs.map(spec => (
                    <div key={spec.label} className="filter-dropdown-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', position: 'relative' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {spec.label}
                      </span>
                      
                      {/* Dropdown Toggle Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setFilterSearchQuery('');
                          setOpenDropdown(openDropdown === `allPofs_${spec.key}` ? null : `allPofs_${spec.key}`);
                        }}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-current)',
                          backgroundColor: '#fff',
                          color: spec.selected.length > 0 ? 'var(--text-current)' : 'var(--text-muted-current)',
                          fontSize: '0.8rem',
                          fontWeight: spec.selected.length > 0 ? '700' : '500',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                          {spec.selected.length === 0 ? `Select ${spec.label}` :
                           spec.selected.length === 1 ? getOptionLabel(spec.key, spec.selected[0]) :
                           `${spec.selected.length} Selected`}
                        </span>
                        <ChevronDown size={14} style={{ 
                          transform: openDropdown === `allPofs_${spec.key}` ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s'
                        }} />
                      </button>

                      {/* Floating Options Menu */}
                      {openDropdown === `allPofs_${spec.key}` && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: '0',
                          marginTop: '4px',
                          minWidth: '220px',
                          width: '100%',
                          maxHeight: '220px',
                          overflowY: 'auto',
                          border: '1px solid var(--border-current)',
                          borderRadius: '8px',
                          padding: '8px',
                          backgroundColor: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                          zIndex: 1000
                        }}>
                          {/* Search input field */}
                          <input
                            type="text"
                            placeholder={`Search ${spec.label}...`}
                            value={filterSearchQuery}
                            onChange={e => setFilterSearchQuery(e.target.value)}
                            onClick={e => e.stopPropagation()} // Stop dropdown from closing
                            style={{
                              padding: '6px 8px',
                              fontSize: '0.8rem',
                              border: '1px solid var(--border-current)',
                              borderRadius: '6px',
                              width: '100%',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />

                          {/* Clear option helper inside the dropdown */}
                          {spec.selected.length > 0 && (
                            <div style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              borderBottom: '1px solid #f3f4f6', 
                              paddingBottom: '4px',
                              marginBottom: '2px'
                            }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                                {spec.selected.length} selected
                              </span>
                              <span 
                                style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-primary)', cursor: 'pointer' }}
                                onClick={() => spec.setSelected([])}
                              >
                                Clear
                              </span>
                            </div>
                          )}

                          {spec.options
                            .filter(val => {
                              const displayVal = getOptionLabel(spec.key, val);
                              return String(displayVal || '').toLowerCase().includes(filterSearchQuery.toLowerCase());
                            })
                            .map(val => {
                              const checked = spec.selected.includes(val);
                              const labelText = getOptionLabel(spec.key, val);
                              return (
                                <label key={val} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: '500', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', padding: '2px 4px', borderRadius: '4px' }} title={labelText}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      spec.setSelected(prev =>
                                        checked ? prev.filter(v => v !== val) : [...prev, val]
                                      );
                                    }}
                                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                                  />
                                  <span>{labelText}</span>
                                </label>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Filter Actions */}
                {allPofsActiveFiltersCount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleClearAllPofsFilters}
                      style={{
                        padding: '6px 16px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '750',
                        backgroundColor: 'rgba(128, 0, 0, 0.08)',
                        color: 'var(--color-primary)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      className="hover-lift"
                    >
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {loading && allPofs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                <Loader size={24} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} color="var(--color-primary)" />
                Loading processing order history...
              </div>
            ) : allPofs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border-current)', borderRadius: '12px', color: 'var(--text-muted-current)' }}>
                No processing order forms found in history.
              </div>
            ) : filteredAllPofs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', border: '1px dashed var(--border-current)', borderRadius: '12px', color: 'var(--text-muted-current)' }}>
                No historical POFs matched the selected filters. Click "Clear All Filters" to reset.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)', fontWeight: '700', color: 'var(--text-current)' }}>
                      <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px' }}></th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>POF Number</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>Partner Name</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>Order & Design</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>Process</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Rolls Sent</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Qty Sent (m)</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Rolls Recd</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Qty Recd (m)</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Shrinkage %</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Payment Status</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllPofs.map(pof => {
                      const isExpanded = expandedPofId === pof.id;
                      const rolls = pof.fabric_rolls || [];
                      const rollsCount = rolls.length;
                      
                      // Calculate sent quantities
                      const qtySent = rolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
                      
                      // Calculate received rolls and quantities from pof.received_rolls
                      const receivedRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
                      const rollsReceivedCount = receivedRolls.length;
                      const qtyReceived = receivedRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
                      
                      // Calculate overall shrinkage % based on what was received
                      const shrinkagePct = (pof.status === 'received' || pof.status === 'partially_received') && qtySent > 0 
                        ? ((qtySent - qtyReceived) / qtySent) * 100 
                        : 0;

                      // Grab order details from first roll
                      const firstRoll = rolls[0] || {};
                      const orderNo = firstRoll.order_number || '—';
                      const designNo = firstRoll.design_no || '—';
                      const designName = firstRoll.design_name && firstRoll.design_name !== '—' ? ` (${firstRoll.design_name})` : '';
                      const designString = `${designNo}${designName}`;

                      const createdDate = new Date(pof.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      });

                      return (
                        <React.Fragment key={pof.id}>
                          <tr 
                            style={{ 
                              borderBottom: '1px solid var(--border-current)', 
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? 'rgba(128,0,0,0.02)' : 'transparent',
                              transition: 'background-color 0.15s ease'
                            }}
                            onClick={() => setExpandedPofId(isExpanded ? null : pof.id)}
                          >
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                                <ChevronRight size={14} />
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.75rem', whiteSpace: 'nowrap', fontWeight: '500' }}>{createdDate}</td>
                            <td style={{ padding: '0.75rem 0.75rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--color-primary)' }}>{pof.pof_number}</td>
                            <td style={{ padding: '0.75rem 0.75rem', fontWeight: '600' }}>{pof.partner_name}</td>
                            <td style={{ padding: '0.75rem 0.75rem' }}>
                              <span style={{ fontWeight: '600', display: 'block' }}>{orderNo}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>{designString}</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.75rem', verticalAlign: 'middle' }}>
                              {pof.processes && pof.processes.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                  {pof.processes.map(proc => (
                                    <span key={proc} style={{ 
                                      display: 'inline-block', 
                                      padding: '1px 5px', 
                                      borderRadius: '4px', 
                                      fontSize: '0.68rem', 
                                      fontWeight: '700',
                                      backgroundColor: 'rgba(128, 0, 0, 0.05)',
                                      color: 'var(--color-primary)',
                                      border: '1px solid rgba(128, 0, 0, 0.1)'
                                    }}>
                                      {proc}
                                    </span>
                                  ))}
                                </div>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: '500' }}>{rollsCount}</td>
                            <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>{qtySent.toFixed(2)} m</td>
                            <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: '500' }}>{rollsReceivedCount}</td>
                            <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>
                              {(pof.status === 'received' || pof.status === 'partially_received') ? `${qtyReceived.toFixed(2)} m` : '—'}
                            </td>
                            <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: '750', color: shrinkagePct > 0 ? '#b45309' : '#047857' }}>
                              {(pof.status === 'received' || pof.status === 'partially_received') ? `${shrinkagePct.toFixed(2)}%` : '—'}
                            </td>
                            <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                              <span 
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: '700',
                                  border: '1px solid',
                                  backgroundColor: 
                                    pof.payment_status === 'settled' ? '#ecfdf5' :
                                    pof.payment_status === 'approved' ? '#eff6ff' :
                                    pof.payment_status === 'submitted_for_approval' ? '#fffbeb' : '#f3f4f6',
                                  borderColor: 
                                    pof.payment_status === 'settled' ? '#a7f3d0' :
                                    pof.payment_status === 'approved' ? '#bfdbfe' :
                                    pof.payment_status === 'submitted_for_approval' ? '#fde68a' : '#e5e7eb',
                                  color: 
                                    pof.payment_status === 'settled' ? '#065f46' :
                                    pof.payment_status === 'approved' ? '#1e40af' :
                                    pof.payment_status === 'submitted_for_approval' ? '#92400e' : '#374151'
                                }}
                              >
                                {pof.payment_status === 'settled' ? 'Settled' :
                                 pof.payment_status === 'approved' ? 'Approve' :
                                 pof.payment_status === 'submitted_for_approval' ? 'Submitted for Approval' : 'No Bill'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                              <span 
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '0.7rem',
                                  fontWeight: '700',
                                  border: '1px solid',
                                  backgroundColor: pof.status === 'received' ? '#ecfdf5' : pof.status === 'partially_received' ? '#eff6ff' : '#fffbeb',
                                  borderColor: pof.status === 'received' ? '#a7f3d0' : pof.status === 'partially_received' ? '#bfdbfe' : '#fde68a',
                                  color: pof.status === 'received' ? '#065f46' : pof.status === 'partially_received' ? '#1e40af' : '#92400e'
                                }}
                              >
                                {pof.status === 'received' ? 'Received' : pof.status === 'partially_received' ? 'Partially Received' : 'Sent'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenEditModal(pof)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                  backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
                                  color: '#1e40af', padding: '4px 10px', borderRadius: '6px',
                                  fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                }}
                                className="hover-lift"
                              >
                                <Edit size={12} /> Edit
                              </button>

                              <button
                                onClick={() => {
                                  setPofOrderNo(orderNo);
                                  setPofDesignNo(designNo);
                                  setPofDesignName(firstRoll.design_name || '');
                                  setCreatedPof(pof);
                                  setShowPrintModal(true);
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                  backgroundColor: 'rgba(128,0,0,0.06)', border: '1px solid var(--color-primary)',
                                  color: 'var(--color-primary)', padding: '4px 10px', borderRadius: '6px',
                                  fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                }}
                                className="hover-lift"
                              >
                                <Printer size={12} /> Print POF
                              </button>
                            </td>
                          </tr>
                          
                          {/* Expanded detail row */}
                          {isExpanded && (
                            <tr>
                              <td colSpan="14" style={{ backgroundColor: '#fafafa', padding: '1.5rem', borderBottom: '1px solid var(--border-current)' }} onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '2rem', alignItems: 'start' }} className="fade-in">
                                  
                                  {/* Left Side: Greige Fabric Rolls Details & Dispatch Details */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    
                                    {/* Greige Fabric Rolls Details */}
                                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
                                      <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.4rem' }}>
                                        📦 Greige Fabric Rolls Details
                                      </h4>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                          <tr style={{ borderBottom: '1.5px solid #ddd', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                            <th style={{ padding: '0.5rem 0.25rem' }}>Greige Roll ID</th>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Greige Qty</th>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Actual Sent Qty</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rolls.map(roll => (
                                            <tr key={roll.id} style={{ borderBottom: '1px solid #eee' }}>
                                              <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--color-primary)' }}>{roll.id}</td>
                                              <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>{Number(roll.qty).toFixed(2)} m</td>
                                              <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: '600' }}>{Number(roll.actual_qty || roll.qty).toFixed(2)} m</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                        <tfoot>
                                          <tr style={{ fontWeight: '800', borderTop: '2px solid #ddd', backgroundColor: '#fafafa' }}>
                                            <td style={{ padding: '0.5rem 0.25rem' }}>Total Sent</td>
                                            <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>
                                              {rolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0).toFixed(2)} m
                                            </td>
                                            <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#047857' }}>
                                              {qtySent.toFixed(2)} m
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>

                                    {/* Dispatch Details */}
                                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
                                      <h4 style={{ margin: '0 0 1rem 0', color: '#374151', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        📤 Dispatch Details
                                      </h4>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '0.5rem 0.75rem', fontSize: '0.8rem', lineHeight: '1.5' }}>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Vehicle Details:</span>
                                        <strong style={{ color: '#111827' }}>{pof.vehicle_details || 'Hand Delivery'}</strong>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Delivered/Driver:</span>
                                        <strong style={{ color: '#111827' }}>{pof.delivered_by || 'N/A'}</strong>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Dispatched At:</span>
                                        <strong style={{ color: '#111827' }}>{new Date(pof.created_at).toLocaleString('en-IN')}</strong>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Processes Selected:</span>
                                        <strong style={{ color: 'var(--color-primary)' }}>{pof.processes?.join(', ') || '—'}</strong>
                                        <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Finished Width:</span>
                                        <strong style={{ color: '#111827' }}>{pof.width || '—'}</strong>
                                      </div>
                                    </div>

                                  </div>

                                  {/* Right Side: Processed Fabric Details, Receipt Details, Associated POFRR list */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    
                                    {/* Processed Fabric Details */}
                                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
                                      <h4 style={{ margin: '0 0 1rem 0', color: '#047857', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.4rem' }}>
                                        📥 Processed Fabric Details
                                      </h4>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                        <thead>
                                          <tr style={{ borderBottom: '1.5px solid #ddd', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                            <th style={{ padding: '0.5rem 0.25rem' }}>Processed Roll ID</th>
                                            <th style={{ padding: '0.5rem 0.25rem' }}>Process</th>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Qty Received</th>
                                            <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Shrinkage %</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {rolls.map(roll => {
                                            const rxRolls = receivedRolls.filter(rx => isGreigeRollMatch(rx.greige_roll_id, roll.id));
                                            
                                            if (rxRolls.length === 0) {
                                              return (
                                                <tr key={roll.id} style={{ borderBottom: '1px solid #eee' }}>
                                                  <td style={{ padding: '0.5rem 0.25rem', color: '#9ca3af', fontFamily: 'monospace' }}>Pending</td>
                                                  <td style={{ padding: '0.5rem 0.25rem', color: '#9ca3af' }}>{pof.processes?.join(', ') || '—'}</td>
                                                  <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#9ca3af' }}>—</td>
                                                  <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#9ca3af' }}></td>
                                                </tr>
                                              );
                                            }

                                            return rxRolls.map((rxRoll, idx) => {
                                              return (
                                                <tr key={`${roll.id}-${idx}`} style={{ borderBottom: '1px solid #eee' }}>
                                                  <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>{rxRoll.id}</td>
                                                  <td style={{ padding: '0.5rem 0.25rem', color: 'var(--text-current)' }}>{pof.processes?.join(', ') || '—'}</td>
                                                  <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{parseFloat(rxRoll.qty || 0).toFixed(2)} m</td>
                                                  <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: '700' }}></td>
                                                </tr>
                                              );
                                            });
                                          })}
                                        </tbody>
                                        <tfoot>
                                          <tr style={{ fontWeight: '800', borderTop: '2px solid #ddd', backgroundColor: '#fafafa' }}>
                                            <td colSpan="2" style={{ padding: '0.5rem 0.25rem' }}>Total Received</td>
                                            <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: '#047857' }}>
                                              {qtyReceived.toFixed(2)} m
                                            </td>
                                            <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', color: 'var(--color-primary)' }}>
                                              {shrinkagePct.toFixed(2)}%
                                            </td>
                                          </tr>
                                        </tfoot>
                                      </table>
                                    </div>

                                    {/* Receipt Details */}
                                    <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
                                      <h4 style={{ margin: '0 0 1rem 0', color: '#047857', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        📥 Receipt Details
                                      </h4>
                                      {pof.status === 'received' || pof.status === 'partially_received' ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '0.5rem 0.75rem', fontSize: '0.8rem', lineHeight: '1.5' }}>
                                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Received By:</span>
                                          <strong style={{ color: '#111827' }}>{pof.received_by || 'N/A'}</strong>
                                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Return Place:</span>
                                          <strong style={{ color: '#111827' }}>{pof.received_place || 'N/A'}</strong>
                                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Return Vehicle No:</span>
                                          <strong style={{ color: '#111827' }}>{pof.receive_vehicle_details || 'Hand Delivery'}</strong>
                                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>Received At:</span>
                                          <strong style={{ color: '#111827' }}>{pof.received_at ? new Date(pof.received_at).toLocaleString('en-IN') : '—'}</strong>
                                        </div>
                                      ) : (
                                        <div style={{ color: '#b45309', fontSize: '0.8rem', fontWeight: '600' }}>
                                          ⚠️ Awaiting return of processed fabric rolls.
                                        </div>
                                      )}
                                    </div>

                                    {/* Associated POFRR list */}
                                    {(pof.status === 'received' || pof.status === 'partially_received') && (
                                      <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-current)', boxShadow: 'var(--shadow-sm)' }}>
                                        <h4 style={{ margin: '0 0 1rem 0', color: '#047857', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                          📄 Associated POFRR Documents
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                          {(() => {
                                            // Group rolls by pofrr_number
                                            const receiptsMap = {};
                                            receivedRolls.forEach(roll => {
                                              const pofrrNo = roll.pofrr_number || pof.pofrr_number || 'N/A';
                                              if (!receiptsMap[pofrrNo]) {
                                                receiptsMap[pofrrNo] = {
                                                  pofrr_number: pofrrNo,
                                                  received_at: roll.received_at || pof.received_at || pof.updated_at,
                                                  received_by: roll.received_by || pof.received_by || 'N/A',
                                                  received_place: roll.received_place || pof.received_place || 'N/A',
                                                  receive_vehicle_details: roll.receive_vehicle_details || pof.receive_vehicle_details || 'N/A',
                                                  rolls: []
                                                };
                                              }
                                              receiptsMap[pofrrNo].rolls.push(roll);
                                            });

                                            const receipts = Object.values(receiptsMap);
                                            if (receipts.length === 0) {
                                              return (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                                                  No POFRR documents found.
                                                </div>
                                              );
                                            }

                                            return receipts.map((receipt, idx) => {
                                              const isPofrrExpanded = expandedPofrrNo === receipt.pofrr_number;
                                              const totalReceiptQty = receipt.rolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
                                              return (
                                                <div 
                                                  key={receipt.pofrr_number} 
                                                  style={{ 
                                                    display: 'flex', 
                                                    flexDirection: 'column',
                                                    backgroundColor: '#f9f9f9', 
                                                    borderRadius: '8px', 
                                                    border: '1px solid #eee',
                                                    fontSize: '0.8rem',
                                                    overflow: 'hidden'
                                                  }}
                                                >
                                                  <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.65rem 0.75rem',
                                                    cursor: 'pointer',
                                                    backgroundColor: isPofrrExpanded ? '#f1f5f9' : 'transparent',
                                                    borderBottom: isPofrrExpanded ? '1px solid #e2e8f0' : 'none',
                                                    transition: 'background-color 0.15s ease'
                                                  }} onClick={() => setExpandedPofrrNo(isPofrrExpanded ? null : receipt.pofrr_number)}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', display: 'inline-block', transform: isPofrrExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                                                        <ChevronRight size={14} />
                                                      </span>
                                                      <div>
                                                        <strong style={{ display: 'block', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                                                          {receipt.pofrr_number}
                                                        </strong>
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted-current)' }}>
                                                          Received {receipt.rolls.length} rolls ({totalReceiptQty.toFixed(2)} m) on {new Date(receipt.received_at).toLocaleDateString('en-IN')}
                                                        </span>
                                                      </div>
                                                    </div>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        const pofrrDoc = {
                                                          pofrr_number: receipt.pofrr_number,
                                                          pof_number: pof.pof_number,
                                                          partner_name: pof.partner_name,
                                                          created_at: pof.created_at,
                                                          received_at: receipt.received_at,
                                                          expected_delivery_date: pof.expected_delivery_date,
                                                          vehicle_details: pof.vehicle_details,
                                                          delivered_by: pof.delivered_by,
                                                          received_by: receipt.received_by,
                                                          received_place: receipt.received_place,
                                                          receive_vehicle_details: receipt.receive_vehicle_details,
                                                          fabric_rolls: pof.fabric_rolls,
                                                          received_rolls: receipt.rolls,
                                                          all_received_rolls: pof.received_rolls || [],
                                                          processes: pof.processes,
                                                          status: pof.status,
                                                          width: pof.width
                                                        };
                                                        setCreatedPofrr(pofrrDoc);
                                                        setShowPofrrPrintModal(true);
                                                      }}
                                                      style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                        backgroundColor: '#ecfdf5', border: '1px solid #10b981',
                                                        color: '#047857', padding: '4px 10px', borderRadius: '6px',
                                                        fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer'
                                                      }}
                                                      className="hover-lift"
                                                    >
                                                      <Printer size={12} /> View & Print
                                                    </button>
                                                  </div>

                                                  {isPofrrExpanded && (
                                                    <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fff', borderTop: '1px solid #eee' }} onClick={e => e.stopPropagation()}>
                                                      {/* Metadata summary */}
                                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', marginBottom: '0.75rem', fontSize: '0.75rem', borderBottom: '1px dashed #eee', paddingBottom: '0.5rem' }}>
                                                        <div>
                                                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', marginRight: '4px' }}>Received By:</span>
                                                          <strong style={{ color: '#111827' }}>{receipt.received_by}</strong>
                                                        </div>
                                                        <div>
                                                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', marginRight: '4px' }}>Place:</span>
                                                          <strong style={{ color: '#111827' }}>{receipt.received_place}</strong>
                                                        </div>
                                                        <div>
                                                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', marginRight: '4px' }}>Vehicle No:</span>
                                                          <strong style={{ color: '#111827' }}>{receipt.receive_vehicle_details}</strong>
                                                        </div>
                                                        <div>
                                                          <span style={{ color: 'var(--text-muted-current)', fontWeight: '600', marginRight: '4px' }}>Date Received:</span>
                                                          <strong style={{ color: '#111827' }}>{new Date(receipt.received_at).toLocaleString('en-IN')}</strong>
                                                        </div>
                                                      </div>

                                                      {/* Rolls list */}
                                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem' }}>
                                                        <thead>
                                                          <tr style={{ borderBottom: '1.5px solid #eee', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                                                            <th style={{ padding: '0.25rem' }}>S.No</th>
                                                            <th style={{ padding: '0.25rem' }}>Processed Roll ID</th>
                                                            <th style={{ padding: '0.25rem', textAlign: 'right' }}>Qty Received (m)</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {receipt.rolls.map((roll, rollIdx) => (
                                                            <tr key={roll.id} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                                              <td style={{ padding: '0.25rem' }}>{rollIdx + 1}</td>
                                                              <td style={{ padding: '0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>{roll.id}</td>
                                                              <td style={{ padding: '0.25rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{parseFloat(roll.qty || 0).toFixed(2)} m</td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            });
                                          })()}
                                        </div>
                                      </div>
                                    )}

                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. FABRIC PROCESSING BILLS VIEW */}
      {viewMode === 'bills' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main Bills List View */}
          {!isCreatingBill ? (
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.5rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0 }}>
                    Fabric Processing Bills
                  </h2>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', fontWeight: '600', textTransform: 'uppercase' }}>
                    Manage finance & settle amounts for outsource processing
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingBill(true);
                    setEditingBill(null);
                    setSelectedBillPartnerId('');
                    setSelectedBillPofIds([]);
                    setProcessRates({});
                    setTaxAmountInput('');
                    setTaxPercentageInput('');
                    setBillNumberInput('');
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    backgroundColor: 'var(--color-primary)', border: 'none',
                    color: 'white', padding: '6px 14px', borderRadius: '8px',
                    fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer'
                  }}
                  className="hover-lift"
                >
                  <Plus size={14} /> Create New Bill
                </button>
              </div>

              {/* Status Filter Pills */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { key: 'all', label: 'All Bills' },
                    { key: 'submitted_for_approval', label: 'Submitted' },
                    { key: 'approved', label: 'Approved' },
                    { key: 'settled', label: 'Settled' }
                  ].map(pill => (
                    <button
                      key={pill.key}
                      onClick={() => setBillStatusFilter(pill.key)}
                      style={{
                        padding: '0.4rem 1rem',
                        borderRadius: '20px',
                        border: '1px solid ' + (billStatusFilter === pill.key ? 'var(--color-primary)' : 'var(--border-current)'),
                        backgroundColor: billStatusFilter === pill.key ? 'var(--color-primary)' : 'white',
                        color: billStatusFilter === pill.key ? 'white' : 'var(--text-current)',
                        fontSize: '0.78rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      className="hover-lift"
                    >
                      {pill.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={fetchBills}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    backgroundColor: 'rgba(128,0,0,0.06)', border: '1px solid var(--color-primary)',
                    color: 'var(--color-primary)', padding: '4px 12px', borderRadius: '6px',
                    fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer'
                  }}
                >
                  Refresh
                </button>
              </div>

              {/* Bills List Rendering */}
              {billsLoading && bills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                  <Loader size={24} className="spin" style={{ margin: '0 auto 1rem', display: 'block' }} color="var(--color-primary)" />
                  Loading processing bills...
                </div>
              ) : bills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--border-current)', borderRadius: '12px', color: 'var(--text-muted-current)' }}>
                  No bills found in history.
                </div>
              ) : (() => {
                const filteredBills = bills.filter(b => {
                  if (billStatusFilter === 'all') return true;
                  return b.status === billStatusFilter;
                });

                if (filteredBills.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)' }}>
                      No bills match the selected status filter.
                    </div>
                  );
                }

                return (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid var(--border-current)', fontWeight: '700', color: 'var(--text-current)' }}>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: '40px' }}></th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>Date</th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>Bill Number</th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>Partner Name</th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left' }}>POF Numbers</th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Calculated Subtotal</th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Tax Amount</th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'right' }}>Grand Total</th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredBills.map(bill => {
                          const isExpanded = expandedBillId === bill.id;
                          const pofNumbers = (bill.bill_items || []).map(item => item.pof_number).join(', ');
                          
                          return (
                            <React.Fragment key={bill.id}>
                              <tr
                                style={{
                                  borderBottom: '1px solid var(--border-current)',
                                  cursor: 'pointer',
                                  backgroundColor: isExpanded ? 'rgba(128,0,0,0.02)' : 'transparent',
                                  transition: 'background-color 0.15s ease'
                                }}
                                onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                              >
                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                                    <ChevronRight size={14} />
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 0.75rem', whiteSpace: 'nowrap', fontWeight: '500' }}>
                                  {new Date(bill.submitted_at || bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: '0.75rem 0.75rem', fontFamily: 'monospace', fontWeight: '700', color: 'var(--color-primary)' }}>
                                  {bill.bill_number}
                                </td>
                                <td style={{ padding: '0.75rem 0.75rem', fontWeight: '600' }}>{bill.partner_name}</td>
                                <td style={{ padding: '0.75rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{pofNumbers || '—'}</td>
                                <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: '500' }}>
                                  ₹{Number(bill.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', color: 'var(--text-muted-current)' }}>
                                  ₹{Number(bill.tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '0.75rem 0.75rem', textAlign: 'right', fontWeight: '800', color: 'var(--color-primary)' }}>
                                  ₹{Number(bill.invoice_total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '0.7rem',
                                      fontWeight: '700',
                                      border: '1px solid',
                                      backgroundColor: 
                                        bill.status === 'settled' ? '#ecfdf5' :
                                        bill.status === 'approved' ? '#eff6ff' : '#fffbeb',
                                      borderColor: 
                                        bill.status === 'settled' ? '#a7f3d0' :
                                        bill.status === 'approved' ? '#bfdbfe' : '#fde68a',
                                      color: 
                                        bill.status === 'settled' ? '#065f46' :
                                        bill.status === 'approved' ? '#1e40af' : '#92400e'
                                    }}
                                  >
                                    {bill.status === 'settled' ? 'Settled' : bill.status === 'approved' ? 'Approved' : 'Submitted'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.75rem 0.75rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                                  <button
                                    onClick={() => printFinanceBill(bill)}
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                      backgroundColor: 'rgba(128,0,0,0.06)', border: '1px solid var(--color-primary)',
                                      color: 'var(--color-primary)', padding: '4px 10px', borderRadius: '6px',
                                      fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                    }}
                                    className="hover-lift"
                                  >
                                    <Printer size={12} /> Print
                                  </button>
                                  {bill.status === 'submitted_for_approval' && (
                                    <button
                                      onClick={() => handleEditBillClick(bill)}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                        backgroundColor: '#fef3c7', border: '1px solid #f59e0b',
                                        color: '#b45309', padding: '4px 10px', borderRadius: '6px',
                                        fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                      }}
                                      className="hover-lift"
                                    >
                                      <Edit size={12} /> Edit
                                    </button>
                                  )}
                                  {/* Approve action removed here. Approvals are now handled exclusively in the Admin Approvals section. */}
                                  {profile?.role === 'admin' && bill.status === 'approved' && (
                                    <button
                                      onClick={() => handleSettleBill(bill)}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                        backgroundColor: '#eff6ff', border: '1px solid #3b82f6',
                                        color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px',
                                        fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer'
                                      }}
                                      className="hover-lift"
                                    >
                                      Settle
                                    </button>
                                  )}
                                </td>
                              </tr>
                              
                              {/* Expanded Bill Details */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan="10" style={{ backgroundColor: '#fafafa', padding: '1.5rem', borderBottom: '1px solid var(--border-current)' }} onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '2rem', alignItems: 'start' }} className="fade-in">
                                      
                                      {/* Left: Billed POFs detail */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                          Billed Processing Orders
                                        </h4>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', border: '1px solid var(--border-current)', backgroundColor: 'white' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                                              <th style={{ padding: '0.5rem' }}>POF Number</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Greige Sent Rolls</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Greige Sent Qty</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Processed Recd Rolls</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Processed Recd Qty</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Shrinkage</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Sent Date</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'center' }}>Recd Date</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(bill.bill_items || []).map((item, idx) => (
                                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--color-primary)' }}>{item.pof_number}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.greige_sent_rolls}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{Number(item.greige_sent_qty).toFixed(2)} m</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{item.processed_rolls_recd}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{Number(item.processed_qty_recd).toFixed(2)} m</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: item.shrinkage > 0 ? '#b45309' : '#047857' }}>{Number(item.shrinkage).toFixed(2)}%</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{new Date(item.sent_date).toLocaleDateString('en-IN')}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>{item.received_date ? new Date(item.received_date).toLocaleDateString('en-IN') : '—'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Right: Rates Breakdown & Audit info */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: 'var(--color-primary)' }}>
                                          Rates per Process
                                        </h4>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', border: '1px solid var(--border-current)', backgroundColor: 'white' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                                              <th style={{ padding: '0.5rem' }}>Process</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Rate / m</th>
                                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {(bill.process_rates || []).map((r, idx) => (
                                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                                                <td style={{ padding: '0.5rem', fontWeight: '600' }}>{r.process}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{Number(r.rate_per_meter).toFixed(2)}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>₹{Number(r.calculated_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>

                                        {/* Audit Logs */}
                                        <div style={{ padding: '0.75rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-current)', fontSize: '0.72rem', color: 'var(--text-muted-current)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <div><strong>Submitted At:</strong> {new Date(bill.submitted_at).toLocaleString('en-IN')}</div>
                                          {bill.approved_at && (
                                            <div><strong>Approved At:</strong> {new Date(bill.approved_at).toLocaleString('en-IN')}</div>
                                          )}
                                          {bill.settled_at && (
                                            <div><strong>Settled At:</strong> {new Date(bill.settled_at).toLocaleString('en-IN')}</div>
                                          )}
                                        </div>
                                      </div>

                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

            </div>
          ) : (
            
             /* Create/Edit Bill Form */
            <form onSubmit={handleSubmitBill} className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--color-primary)', margin: 0 }}>
                    {editingBill ? 'Edit Processing Bill' : 'Create Processing Bill'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingBill(false);
                      setEditingBill(null);
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      backgroundColor: 'white', border: '1px solid var(--border-current)',
                      color: 'var(--text-current)', padding: '5px 12px', borderRadius: '8px',
                      fontSize: '0.8rem', fontWeight: '750', cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {/* Partner and POF Select Dropdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                  <div className="input-group" style={{ margin: 0 }}>
                    <label className="input-label" style={{ fontWeight: '700' }}>Select Partner</label>
                    <select
                      className="input-field"
                      value={selectedBillPartnerId}
                      onChange={e => handleBillPartnerChange(e.target.value)}
                      required
                      style={{ fontWeight: '600' }}
                      disabled={!!editingBill}
                    >
                      <option value="">Select Processing Partner...</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>{p.partner_name} ({p.partner_type})</option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group filter-dropdown-container" style={{ margin: 0, position: 'relative' }}>
                    <label className="input-label" style={{ fontWeight: '700' }}>Select POFs ({selectedBillPofIds.length} selected)</label>
                    <div 
                      onClick={() => {
                        if (!selectedBillPartnerId) {
                          alert('Please select a partner first.');
                          return;
                        }
                        setIsBillPofDropdownOpen(!isBillPofDropdownOpen);
                      }}
                      style={{
                        padding: '0.6rem 0.75rem', border: '1px solid var(--border-current)',
                        borderRadius: '8px', fontSize: '0.85rem', background: 'var(--surface-current)',
                        color: selectedBillPofIds.length === 0 ? 'var(--text-muted-current)' : 'var(--text-current)', 
                        cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        minHeight: '38px', boxSizing: 'border-box'
                      }}
                    >
                      <span>
                        {selectedBillPofIds.length === 0 
                          ? 'Select Received POFs...' 
                          : `${selectedBillPofIds.length} POF(s) Selected`
                        }
                      </span>
                      {isBillPofDropdownOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    
                    {isBillPofDropdownOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        backgroundColor: 'white', border: '1px solid var(--border-current)',
                        borderRadius: '8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto',
                        marginTop: '4px', boxShadow: 'var(--shadow-lg)', padding: '0.5rem'
                      }}>
                        {receivedUnbilledPofs.length === 0 ? (
                          <div style={{ padding: '0.5rem', color: 'var(--text-muted-current)', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center' }}>
                            No received, unbilled POFs found for this partner.
                          </div>
                        ) : (
                          receivedUnbilledPofs.map(pof => {
                            const isChecked = selectedBillPofIds.includes(pof.id);
                            return (
                              <label 
                                key={pof.id}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  padding: '0.4rem 0.5rem', cursor: 'pointer', borderRadius: '4px',
                                  backgroundColor: isChecked ? 'rgba(128,0,0,0.04)' : 'transparent'
                                }}
                                className="hover-bg"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleBillPofSelection(pof.id)}
                                  style={{ accentColor: 'var(--color-primary)' }}
                                />
                                <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>
                                  {pof.pof_number} ({new Date(pof.created_at).toLocaleDateString('en-IN')})
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detailed Selected POFs List */}
                {selectedPofsObjects.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 0.75rem 0' }}>
                      Selected POFs Details
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', border: '1px solid var(--border-current)' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid var(--border-current)', fontWeight: '700' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left' }}>POF Number</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Greige Sent Rolls</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Greige Sent Qty</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Processed Recd Rolls</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Processed Recd Qty</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>Shrinkage</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Sent Date</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Received Date</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPofsObjects.map(pof => {
                          const rolls = pof.fabric_rolls || [];
                          const qtySent = rolls.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0);
                          const receivedRolls = Array.isArray(pof.received_rolls) ? pof.received_rolls : [];
                          const qtyReceived = receivedRolls.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0);
                          const shrinkage = qtySent > 0 ? ((qtySent - qtyReceived) / qtySent) * 100 : 0;
                          
                          return (
                            <tr key={pof.id} style={{ borderBottom: '1px solid var(--border-current)' }}>
                              <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{pof.pof_number}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{rolls.length}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{qtySent.toFixed(2)} m</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>{receivedRolls.length}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600', color: '#047857' }}>{qtyReceived.toFixed(2)} m</td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: shrinkage > 0 ? '#b45309' : '#047857' }}>{shrinkage.toFixed(2)}%</td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>{new Date(pof.created_at).toLocaleDateString('en-IN')}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>{pof.received_at ? new Date(pof.received_at).toLocaleDateString('en-IN') : '—'}</td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                <span style={{ padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>
                                  {pof.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Rates per Process & Calculations */}
                {selectedPofsObjects.length > 0 && (() => {
                  const totalActualQty = selectedPofsObjects.reduce((sum, pof) => {
                    const rolls = pof.fabric_rolls || [];
                    return sum + rolls.reduce((rSum, r) => rSum + parseFloat(r.actual_qty || r.qty || 0), 0);
                  }, 0);
                  const uniqueProcs = Array.from(new Set(selectedPofsObjects.flatMap(p => p.processes || [])));
                  const sumRates = uniqueProcs.reduce((sum, proc) => sum + (parseFloat(processRates[proc]) || 0), 0);
                  const calculatedTotal = totalActualQty * sumRates;

                  return (
                    <div style={{ marginTop: '1.5rem', padding: '1.25rem', border: '1px solid var(--border-current)', borderRadius: '12px', backgroundColor: '#fafafa' }}>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--color-primary)', margin: '0 0 1rem 0', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.4rem' }}>
                        Process Rates & Total Pricing
                      </h3>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2.5rem' }}>
                        {/* Process rates inputs */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>
                            Configure the per-meter rate for each process:
                          </span>
                          {uniqueProcs.map(proc => {
                            const rate = processRates[proc] || '';
                            const calculatedCost = totalActualQty * (parseFloat(rate) || 0);
                            
                            return (
                              <div key={proc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                <span style={{ fontWeight: '700', fontSize: '0.825rem', flex: 1 }}>{proc}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="0.00"
                                    value={rate}
                                    onChange={e => setProcessRates(prev => ({ ...prev, [proc]: e.target.value }))}
                                    style={{
                                      width: '90px', padding: '0.4rem 0.5rem', border: '1px solid var(--border-current)',
                                      borderRadius: '6px', fontSize: '0.8rem', boxSizing: 'border-box'
                                    }}
                                    required
                                  />
                                </div>
                                <div style={{ width: '120px', textAlign: 'right', fontWeight: '700', fontSize: '0.825rem', fontFamily: 'monospace' }}>
                                  ₹{calculatedCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            );
                          })}
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border-current)', paddingTop: '0.5rem', fontWeight: '800', fontSize: '0.85rem' }}>
                            <span>Calculated Subtotal:</span>
                            <span style={{ fontFamily: 'monospace' }}>₹{calculatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        {/* Tax amount & grand total */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderLeft: '1px solid var(--border-current)', paddingLeft: '2.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted-current)', fontWeight: '700' }}>Total Greige Qty:</span>
                            <span style={{ fontSize: '0.9rem', fontWeight: '800' }}>{totalActualQty.toFixed(2)} m</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Tax Rate (%)</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                placeholder="e.g. 12"
                                value={taxPercentageInput}
                                onChange={e => {
                                  const val = e.target.value;
                                  setTaxPercentageInput(val);
                                  const percent = parseFloat(val) || 0;
                                  setTaxAmountInput(((calculatedTotal * percent) / 100).toFixed(2));
                                }}
                                style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Tax Amount (₹)</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={taxAmountInput}
                                onChange={e => {
                                  setTaxAmountInput(e.target.value);
                                  setTaxPercentageInput('');
                                }}
                                style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.8rem', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted-current)' }}>Bill Number</label>
                            <input
                              type="text"
                              placeholder="Prefilled / Enter custom..."
                              value={billNumberInput}
                              onChange={e => setBillNumberInput(e.target.value)}
                              style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-current)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '700', fontFamily: 'monospace', boxSizing: 'border-box' }}
                              required
                            />
                          </div>

                          <div style={{ borderTop: '2px solid var(--border-current)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: '800' }}>Grand Total:</span>
                            <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
                              ₹{(calculatedTotal + (parseFloat(taxAmountInput) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  );
                })()}

                {/* Form Submission Button */}
                {selectedBillPofIds.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '0.85rem 2rem', border: 'none', borderRadius: '10px',
                        backgroundColor: '#047857', color: 'white', fontWeight: '800',
                        fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(4,120,87,0.15)'
                      }}
                      className="hover-lift"
                    >
                      {loading ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />} Submit Bill for Approval
                    </button>
                  </div>
                )}

              </div>
            </form>
          )}

        </div>
      )}

      {/* 6. PROCESSED FABRIC ROLLS DETAILS VIEW */}
      {viewMode === 'processed_rolls' && (
        <div style={{ width: '100%', boxSizing: 'border-box' }} className="fade-in">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <button
              onClick={() => {
                setViewMode('menu');
                setProcessedRollsSearch('');
              }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '36px', height: '36px', borderRadius: '10px',
                border: '1px solid var(--border-current)', background: 'var(--surface-current)',
                cursor: 'pointer', color: 'var(--text-current)', transition: 'all 0.15s'
              }}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-current)' }}>
                Processed Fabric Rolls Details
              </h1>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted-current)' }}>
                Monitor status, locations, washed inspection logs, and dispatch records for all processed fabric rolls
              </p>
            </div>
          </div>

          {/* Search Box & Expandable Filters */}
          <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '480px' }}>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted-current)' }} />
                <input
                  type="text"
                  placeholder="Search processed ID, POF, Partner, Order, Design..."
                  className="input-field"
                  value={processedRollsSearch}
                  onChange={e => setProcessedRollsSearch(e.target.value)}
                  style={{ paddingLeft: '2.25rem', fontSize: '0.85rem', height: '40px', width: '100%', boxSizing: 'border-box' }}
                />
                {processedRollsSearch && (
                  <button
                    onClick={() => setProcessedRollsSearch('')}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted-current)' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Filter Expand Button */}
              <button
                type="button"
                onClick={() => setProcessedRollsShowFilters(!processedRollsShowFilters)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  border: '1px solid var(--border-current)',
                  backgroundColor: processedRollsShowFilters || activeProcessedRollsFiltersCount > 0 ? 'rgba(128, 0, 0, 0.05)' : 'white',
                  color: processedRollsShowFilters || activeProcessedRollsFiltersCount > 0 ? 'var(--color-primary)' : 'var(--text-muted-current)',
                  borderColor: processedRollsShowFilters || activeProcessedRollsFiltersCount > 0 ? 'var(--color-primary)' : 'var(--border-current)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Search size={14} />
                Filters {activeProcessedRollsFiltersCount > 0 && `(${activeProcessedRollsFiltersCount})`}
                {processedRollsShowFilters ? <ChevronDown size={14} style={{ transform: 'rotate(180deg)', transition: 'transform 0.15s' }} /> : <ChevronDown size={14} style={{ transition: 'transform 0.15s' }} />}
              </button>
            </div>

            {/* Expandable Multi-select Filter panel */}
            {processedRollsShowFilters && (
              <div className="fade-in" style={{
                backgroundColor: 'var(--bg-card-current, #fdfdfd)',
                border: '1px solid var(--border-current)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
                marginTop: '0.25rem'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1.25rem' }}>
                  {processedRollsFilterSpecs.map(spec => (
                    <ProcessedRollsMultiSelectDropdown
                      key={spec.key}
                      label={spec.label}
                      options={spec.options}
                      selected={spec.selected}
                      onChange={spec.setSelected}
                      placeholder={spec.placeholder}
                      openDropdownKey={spec.key}
                      openDropdown={openDropdown}
                      setOpenDropdown={setOpenDropdown}
                      filterSearchQuery={filterSearchQuery}
                      setFilterSearchQuery={setFilterSearchQuery}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--border-current)', paddingTop: '0.75rem' }}>
                  {activeProcessedRollsFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearProcessedRollsFilters}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                        border: '1px solid var(--color-primary)',
                        backgroundColor: 'transparent',
                        color: 'var(--color-primary)'
                      }}
                    >
                      Clear All Filters ({activeProcessedRollsFiltersCount})
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Table Results */}
          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
            {processedRollsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '0.5rem', minHeight: '300px' }}>
                <Loader size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Loading processed rolls...</span>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--text-muted-current)' }}>
                    Showing {filteredProcessedRolls.length} of {processedRolls.length} rolls
                  </span>
                </div>

                <div style={{ flex: 1, overflowX: 'auto' }}>
                  <table className="table" style={{ fontSize: '0.78rem', width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-current)', textAlign: 'left' }}>
                        <th style={{ padding: '0.6rem 0.75rem', width: '11%' }}>Received Date</th>
                        <th style={{ padding: '0.6rem 0.75rem', width: '13%' }}>Processed Roll ID</th>
                        <th style={{ padding: '0.6rem 0.75rem', width: '13%' }}>POF & Partner</th>
                        <th style={{ padding: '0.6rem 0.75rem', width: '13%' }}>Order & Design</th>
                        <th style={{ padding: '0.6rem 0.75rem', width: '13%' }}>Process</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', width: '8%' }}>Qty (m)</th>
                        <th style={{ padding: '0.6rem 0.75rem', width: '9%' }}>Location</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '12%' }}>Milestones</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', width: '8%' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        if (filteredProcessedRolls.length === 0) {
                          return (
                            <tr>
                              <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted-current)', fontStyle: 'italic' }}>
                                No processed fabric rolls found matching search query or filters.
                              </td>
                            </tr>
                          );
                        }

                        return filteredProcessedRolls.map((roll, idx) => {
                          const dateStr = roll.received_at ? new Date(roll.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                          
                          let tooltipAlign = 'center';
                          if (idx <= 1) {
                            tooltipAlign = 'top';
                          } else if (idx >= filteredProcessedRolls.length - 2) {
                            tooltipAlign = 'bottom';
                          }

                          const hasWashedInspection = roll.parentRoll && 
                             roll.parentRoll.inspector_1 && 
                             roll.parentRoll.inspected_at && 
                             roll.parentRoll.received_from_processing_at && 
                             new Date(roll.parentRoll.inspected_at).getTime() > new Date(roll.parentRoll.received_from_processing_at).getTime();
                          const hasDispatch = roll.latestMovement && 
                             roll.latestMovement.to_location !== 'Factory' && 
                             roll.latestMovement.to_location !== 'Office';

                          return (
                            <tr key={roll.id || idx} style={{ borderBottom: '1px solid var(--border-current)' }}>
                              {/* Date */}
                              <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                                {dateStr}
                              </td>

                              {/* Processed Roll ID */}
                              <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle', overflow: 'visible' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.78rem', color: 'var(--text-current)', wordBreak: 'break-all' }}>
                                    {roll.id}
                                  </span>
                                </div>
                              </td>

                              {/* POF & Partner */}
                              <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.75rem', color: 'var(--text-current)' }}>
                                    {roll.pof_number}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={roll.partner_name}>
                                    {roll.partner_name}
                                  </span>
                                </div>
                              </td>

                              {/* Order & Design */}
                              <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontWeight: '700', fontSize: '0.78rem', color: '#1e3a8a' }}>
                                    {roll.order_number}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)', marginTop: '2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={`${roll.design_name} (${roll.design_no})`}>
                                    {roll.design_name} <span style={{ fontSize: '0.68rem', backgroundColor: '#f1f5f9', padding: '1px 4px', borderRadius: '3px', color: '#334155' }}>{roll.design_no}</span>
                                  </span>
                                </div>
                              </td>

                              {/* Process */}
                              <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                                {roll.processes && roll.processes.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                    {roll.processes.map(proc => (
                                      <span key={proc} style={{ 
                                        display: 'inline-block', 
                                        padding: '1px 5px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.68rem', 
                                        fontWeight: '700',
                                        backgroundColor: 'rgba(128, 0, 0, 0.05)',
                                        color: 'var(--color-primary)',
                                        border: '1px solid rgba(128, 0, 0, 0.1)'
                                      }}>
                                        {proc}
                                      </span>
                                    ))}
                                  </div>
                                ) : '—'}
                              </td>

                              {/* Qty */}
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', verticalAlign: 'middle', fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.82rem' }}>
                                {parseFloat(roll.qty || 0).toFixed(2)}
                              </td>

                              {/* Location */}
                              <td style={{ padding: '0.6rem 0.75rem', verticalAlign: 'middle' }}>
                                <span style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.72rem',
                                  fontWeight: '700',
                                  backgroundColor: roll.latestMovement ? '#eff6ff' : '#f0fdf4',
                                  color: roll.latestMovement ? '#1d4ed8' : '#15803d',
                                  border: roll.latestMovement ? '1px solid #bfdbfe' : '1px solid #bbf7d0'
                                }}>
                                  {roll.location}
                                </span>
                              </td>

                              {/* Milestones */}
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', overflow: 'visible', verticalAlign: 'middle' }}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                  {/* Received Milestone */}
                                  <ProcessedRollReceivedTooltip roll={roll} align={tooltipAlign}>
                                    <span 
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: '32px', height: '18px', borderRadius: '4px',
                                        fontSize: '0.62rem', fontWeight: '800', border: '1px solid #a7f3d0',
                                        backgroundColor: '#ecfdf5', color: '#047857', cursor: 'pointer'
                                      }}
                                    >
                                      RCV
                                    </span>
                                  </ProcessedRollReceivedTooltip>

                                  {/* Washed Inspection Milestone */}
                                  {hasWashedInspection && (
                                    <ProcessedRollWashedTooltip roll={roll} align={tooltipAlign}>
                                      <span 
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          width: '32px', height: '18px', borderRadius: '4px',
                                          fontSize: '0.62rem', fontWeight: '800',
                                          border: '1px solid #a7f3d0',
                                          backgroundColor: '#ecfdf5',
                                          color: '#047857',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        WSH
                                      </span>
                                    </ProcessedRollWashedTooltip>
                                  )}

                                  {/* Re-wash Milestone */}
                                  {roll.reWashPof && (
                                    <ProcessedRollReWashTooltip roll={roll} align={tooltipAlign}>
                                      <span 
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          width: '42px', height: '18px', borderRadius: '4px',
                                          fontSize: '0.62rem', fontWeight: '800',
                                          border: '1px solid #fcd34d',
                                          backgroundColor: '#fffbeb',
                                          color: '#d97706',
                                          cursor: 'pointer',
                                          boxShadow: '0 0 4px rgba(217, 119, 6, 0.2)'
                                        }}
                                      >
                                        RE-W
                                      </span>
                                    </ProcessedRollReWashTooltip>
                                  )}

                                  {/* Dispatched Milestone */}
                                  {hasDispatch && (
                                    <ProcessedRollDispatchedTooltip roll={roll} align={tooltipAlign}>
                                      <span 
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                          width: '32px', height: '18px', borderRadius: '4px',
                                          fontSize: '0.62rem', fontWeight: '800',
                                          border: '1px solid #a7f3d0',
                                          backgroundColor: '#ecfdf5',
                                          color: '#047857',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        DSP
                                      </span>
                                    </ProcessedRollDispatchedTooltip>
                                  )}
                                </div>
                              </td>

                              {/* Action */}
                              <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                <button
                                  onClick={() => handlePrintProcessedRollLabel([roll])}
                                  className="btn btn-secondary"
                                  title="Print Roll Label"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    gap: '3px',
                                    border: '1px solid #800000',
                                    backgroundColor: 'transparent',
                                    color: '#800000',
                                    height: '24px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(128, 0, 0, 0.08)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                  <Printer size={11} /> Print
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 7. PROCESSED FABRIC ROLL CUT VIEW */}
      {viewMode === 'processed_cut' && (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem', paddingBottom: '3rem', fontFamily: 'var(--font-sans)' }} className="fade-in">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.75rem' }}>
            <div style={{ background: 'var(--color-primary)', color: 'white', padding: '0.45rem', borderRadius: '8px' }}>
              <Scissors size={20} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--color-primary)', lineHeight: 1.1 }}>Processed Fabric Roll Cut</h1>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted-current)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Split processed rolls & print labels
              </span>
            </div>
          </div>

          {cutSuccessMsg && (
            <div style={{
              backgroundColor: '#ecfdf5', border: '1px solid #10b981', color: '#047857',
              padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: '700',
              marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <CheckCircle size={16} /> {cutSuccessMsg}
            </div>
          )}

          {cutError && (
            <div style={{
              backgroundColor: '#fef2f2', border: '1px solid #ef4444', color: '#b91c1c',
              padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.825rem', fontWeight: '700',
              marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              <AlertTriangle size={16} /> {cutError}
            </div>
          )}

          {/* VIEW STATE 1: SEARCH BAR */}
          {cutViewState === 'search' && (
            <div className="glass-panel" style={{ 
              padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '850', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🔍 Enter Processed Roll ID to Cut
                </span>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSearchProcessedRoll(cutScanInput); }} style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    ref={cutScanInputRef}
                    type="text"
                    placeholder="Type or Scan Processed Roll ID (e.g. AT/2026/B/00001/P1/00008)..."
                    className="input-field"
                    value={cutScanInput}
                    onChange={e => setCutScanInput(e.target.value)}
                    style={{
                      width: '100%', paddingLeft: '2.5rem', paddingRight: '0.75rem',
                      fontSize: '0.9rem', height: '44px', fontWeight: '600'
                    }}
                  />
                  <QrCode size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.85rem', top: '14px' }} />
                </div>
                <button
                  type="submit"
                  disabled={isCutLoading || !cutScanInput.trim()}
                  className="btn btn-primary"
                  style={{ height: '44px', padding: '0 1.25rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  {isCutLoading ? <Loader size={18} className="spin" /> : <Search size={18} />}
                </button>
              </form>

              <div style={{
                marginTop: '0.5rem', display: 'flex', gap: '0.5rem', 
                backgroundColor: 'rgba(128, 0, 0, 0.03)', border: '1px solid rgba(128,0,0,0.08)',
                padding: '0.75rem', borderRadius: '8px', fontSize: '0.72rem', color: 'var(--text-muted-current)'
              }}>
                <Info size={14} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Note: The system will search for this roll inside your Processing Orders. Upon cut submission, the parent roll will be replaced with smaller cuts in the database, and print dialog will be opened automatically.</span>
              </div>
            </div>
          )}

          {/* VIEW STATE 2: CUT FORM */}
          {cutViewState === 'details' && parentProcessedRoll && parentPof && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', animation: 'fadeIn 0.25s ease-out' }}>
              
              {/* Back button */}
              <button
                type="button"
                onClick={handleResetCut}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.35rem', border: 'none',
                  background: 'none', color: 'var(--text-muted-current)', fontSize: '0.75rem',
                  fontWeight: '700', padding: 0, width: 'max-content', cursor: 'pointer'
                }}
              >
                <ArrowLeft size={14} /> Back to Search
              </button>

              {/* Parent Info Card */}
              <div style={{
                background: 'linear-gradient(135deg, var(--color-primary), #4d0000)',
                color: 'white', borderRadius: '12px', padding: '1.25rem',
                boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', gap: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '0.6rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={18} />
                    <strong style={{ fontSize: '0.95rem', fontFamily: 'monospace', letterSpacing: '0.02em' }}>Parent Roll ID: {parentProcessedRoll.id}</strong>
                  </div>
                  <span className="badge" style={{ fontSize: '0.68rem', fontWeight: '800', backgroundColor: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '2px 8px', borderRadius: '4px' }}>
                    Processed Roll
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem 2rem', fontSize: '0.8rem', opacity: 0.95 }}>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                    <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>POF NUMBER</span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{parentPof.pof_number}</strong>
                  </div>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                    <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>PARTNER</span>
                    <strong style={{ fontSize: '0.85rem' }}>{parentPof.partner_name}</strong>
                  </div>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                    <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>ORDER / DESIGN</span>
                    <strong style={{ fontSize: '0.85rem' }}>{parentProcessedRoll.order_number} / {parentProcessedRoll.design_name}</strong>
                  </div>
                  <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
                    <span style={{ display: 'block', opacity: 0.7, fontSize: '0.68rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>CURRENT QUANTITY</span>
                    <strong style={{ fontSize: '1.05rem', color: '#10b981', fontWeight: '900' }}>{parentProcessedRoll.qty} m</strong>
                  </div>
                </div>
              </div>

              {/* Cuts Configuration */}
              <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label" style={{ fontWeight: '800', color: 'var(--text-current)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    ✂️ Number of Cuts for this roll:
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Enter number of pieces (e.g. 3)"
                    className="input-field"
                    value={numCutCuts}
                    onChange={handleCutsNumberChangeCut}
                    style={{ maxWidth: '200px', fontWeight: '700', fontSize: '0.95rem' }}
                  />
                </div>
              </div>

              {/* Child inputs */}
              {childProcessedRollsInput.length > 0 && (
                <form onSubmit={handleSubmitProcessedCut} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '850', color: 'var(--text-muted-current)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      📐 Enter Child Rolls Quantities
                    </span>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {childProcessedRollsInput.map((child, idx) => (
                        <div key={child.id} style={{
                          display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem',
                          backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb'
                        }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: '800', fontFamily: 'monospace', color: '#475569', minWidth: '180px' }}>
                            {child.id}
                          </span>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              placeholder="Qty (meters)"
                              className="input-field"
                              value={child.qty}
                              onChange={e => updateChildProcessedRollField(idx, 'qty', e.target.value)}
                              style={{ height: '36px', fontWeight: '700' }}
                            />
                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted-current)' }}>m</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Mismatch warnings */}
                    <div style={{
                      marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', fontSize: '0.8rem'
                    }}>
                      <span style={{ color: 'var(--text-muted-current)', fontWeight: '600' }}>
                        Total Child Qty: <strong style={{ color: 'var(--text-current)' }}>{childQtySum.toFixed(2)} m</strong> / {parentProcessedRoll.qty} m
                      </span>
                      {Math.abs(qtyMismatch) > 0.01 ? (
                        <span style={{
                          color: '#b91c1c', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '0.25rem',
                          backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '4px'
                        }}>
                          <AlertTriangle size={14} /> Mismatch: {qtyMismatch > 0 ? `+${qtyMismatch}` : qtyMismatch} m
                        </span>
                      ) : (
                        <span style={{
                          color: '#047857', fontWeight: '750', display: 'flex', alignItems: 'center', gap: '0.25rem',
                          backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '4px'
                        }}>
                          <CheckCircle size={14} /> Quantities Match
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isCutLoading}
                    className="btn btn-primary"
                    style={{
                      height: '46px', fontSize: '0.9rem', fontWeight: '800', width: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                    }}
                  >
                    {isCutLoading ? <Loader size={18} className="spin" /> : <Scissors size={18} />}
                    Submit Cut & Replace Parent Roll
                  </button>
                </form>
              )}
            </div>
          )}

          {/* VIEW STATE 3: SUCCESS & LABELS PRINT */}
          {cutViewState === 'success' && savedChildProcessedRolls.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center', animation: 'fadeIn 0.25s ease-out' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#ecfdf5',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981',
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.15)'
              }}>
                <CheckCircle size={28} />
              </div>

              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 0.35rem 0', fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-current)' }}>
                  Processed Fabric Roll Cut Successfully Saved
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                  Roll ID {parentProcessedRoll.id} has been deleted and replaced with {savedChildProcessedRolls.length} child rolls in the database.
                </p>
              </div>

              <div style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', margin: '0.5rem 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb', textAlign: 'left', color: 'var(--text-muted-current)' }}>
                      <th style={{ padding: '0.5rem 0.75rem' }}>Child Roll ID</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Quantity (m)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedChildProcessedRolls.map(roll => (
                      <tr key={roll.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontWeight: '700' }}>{roll.id}</td>
                        <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '800', color: 'var(--color-primary)' }}>{roll.qty.toFixed(2)} m</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
                <button
                  onClick={() => handlePrintProcessedLabels(savedChildProcessedRolls)}
                  className="btn"
                  style={{
                    flex: 1, height: '42px', fontSize: '0.825rem', fontWeight: '800',
                    border: '1px solid var(--color-primary)', backgroundColor: 'transparent',
                    color: 'var(--color-primary)', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  <Printer size={16} /> Reprint Labels
                </button>

                <button
                  onClick={handleResetCut}
                  className="btn btn-primary"
                  style={{
                    flex: 1, height: '42px', fontSize: '0.825rem', fontWeight: '800',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem'
                  }}
                >
                  <Plus size={16} /> Cut Another Roll
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDIT POF MODAL */}
      {showEditModal && editingPof && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '2rem'
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', width: '100%', maxWidth: '800px',
            maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid var(--border-current)'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb',
              borderTopLeftRadius: '16px', borderTopRightRadius: '16px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: '800' }}>
                ✏️ Edit Processing Order Form ({editingPof.pof_number})
              </h3>
              <button 
                onClick={() => { setShowEditModal(false); setEditingPof(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveEditedPof} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Partner Selector */}
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label" style={{ fontWeight: '700' }}>Processing Partner</label>
                  <select
                    className="input-field"
                    value={editPofPartnerId}
                    onChange={e => setEditPofPartnerId(e.target.value)}
                    required
                    style={{ fontWeight: '600' }}
                  >
                    <option value="">Select Partner...</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.partner_name}</option>
                    ))}
                  </select>
                </div>

                {/* Expected Delivery (Return) Date */}
                <div className="input-group" style={{ margin: 0 }}>
                  <label className="input-label" style={{ fontWeight: '700' }}>Expected Return Date</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      className="input-field"
                      value={editPofExpectedDate}
                      onChange={e => setEditPofExpectedDate(e.target.value)}
                      required
                      style={{ paddingLeft: '2.25rem' }}
                    />
                    <Calendar size={16} color="var(--text-muted-current)" style={{ position: 'absolute', left: '0.75rem', top: '12px' }} />
                  </div>
                </div>
              </div>

              {/* Sent Greige Details (to delete a roll) */}
              <div style={{ border: '1px solid var(--border-current)', borderRadius: '12px', padding: '1rem', backgroundColor: '#fcfcfc' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.4rem' }}>
                  📦 Sent Greige Details (Delete Greige Rolls)
                </h4>
                <div style={{ overflowX: 'auto', maxHeight: '200px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #ddd', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                        <th style={{ padding: '0.5rem 0.25rem' }}>Greige Roll ID</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Greige Qty</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>Actual Sent Qty</th>
                        <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center', width: '80px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editPofFabricRolls.map((roll, idx) => (
                        <tr key={roll.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--color-primary)' }}>{roll.id}</td>
                          <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>{Number(roll.qty).toFixed(2)} m</td>
                          <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right', fontWeight: '600' }}>{Number(roll.actual_qty || roll.qty).toFixed(2)} m</td>
                          <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (editPofFabricRolls.length <= 1) {
                                  alert('Cannot delete the last roll. A POF must contain at least one greige roll.');
                                  return;
                                }
                                if (window.confirm(`Are you sure you want to delete roll "${roll.id}" from this POF? This will also remove any received rolls associated with it.`)) {
                                  setEditPofFabricRolls(prev => prev.filter(r => r.id !== roll.id));
                                  setEditPofReceivedRolls(prev => prev.filter(rx => !isGreigeRollMatch(rx.greige_roll_id, roll.id)));
                                }
                              }}
                              style={{
                                background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px'
                              }}
                              className="hover-lift"
                              title="Delete roll from POF"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Received Details (edit qty) */}
              <div style={{ border: '1px solid var(--border-current)', borderRadius: '12px', padding: '1rem', backgroundColor: '#fcfcfc' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', color: '#047857', fontSize: '0.85rem', fontWeight: '800', borderBottom: '1px solid #eee', paddingBottom: '0.4rem' }}>
                  📥 Edit Received Details (Quantity of Received Rolls)
                </h4>
                {editPofReceivedRolls.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted-current)', fontSize: '0.8rem' }}>
                    ⚠️ Awaiting return of processed fabric rolls. No rolls received yet.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', maxHeight: '200px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid #ddd', textAlign: 'left', fontWeight: '700', color: 'var(--text-muted-current)' }}>
                          <th style={{ padding: '0.5rem 0.25rem' }}>Processed Roll ID</th>
                          <th style={{ padding: '0.5rem 0.25rem', textAlign: 'right', width: '150px' }}>Qty Received (m)</th>
                          <th style={{ padding: '0.5rem 0.25rem', textAlign: 'center', width: '120px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editPofReceivedRolls.map((roll, idx) => (
                          <tr key={roll.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#047857' }}>{roll.id}</td>
                            <td style={{ padding: '0.5rem 0.25rem', textAlign: 'right' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="input-field"
                                style={{ padding: '4px 8px', fontSize: '0.8rem', textAlign: 'right', fontWeight: '700', width: '120px', display: 'inline-block' }}
                                value={roll.qty}
                                onChange={e => {
                                  const qtyVal = e.target.value;
                                  setEditPofReceivedRolls(prev => {
                                    const updated = [...prev];
                                    updated[idx] = {
                                      ...updated[idx],
                                      qty: qtyVal
                                    };
                                    return updated;
                                  });
                                }}
                                required
                              />
                            </td>
                            <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handlePrintRollLabels([roll], editingPof)}
                                className="btn btn-secondary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '4px 8px', fontSize: '0.7rem', border: '1px solid var(--border-current)', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff' }}
                                title="Print QR Label"
                              >
                                <Printer size={12} /> Print Label
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingPof(null); }}
                  className="btn btn-secondary"
                  style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem' }}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{
                    padding: '0.6rem 2rem', border: 'none', borderRadius: '8px',
                    backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: '800',
                    fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                    gap: '0.5rem', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s'
                  }}
                  className="hover-lift"
                >
                  {editLoading ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 4. PRINT MODAL (POPUP & PRINT CSS CONTROLLER) */}
      {showPrintModal && createdPof && (
        <div className="print-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '2rem'
        }}>
          <div 
            className="print-container"
            style={{
              backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px',
              maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
          >
            {/* Modal Actions (No Print) */}
            <div className="no-print" style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb',
              borderTopLeftRadius: '12px', borderTopRightRadius: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: '800' }}>
                Print Processing Order Form
              </h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => window.print()} 
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <Printer size={16} /> Print Order Form
                </button>
                <button 
                  onClick={() => { setShowPrintModal(false); setCreatedPof(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Print Body */}
            <div style={{ padding: '3.5rem', color: '#000', backgroundColor: '#fff', flex: 1 }}>
              
              {/* Print Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '2.5px solid #000', paddingBottom: '1.25rem' }}>
                {/* Logo - Top Left */}
                <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                  <img src="/logo.png" alt="Ashok Textiles" style={{ maxHeight: '72px', objectFit: 'contain' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
                  <div style={{ display: 'none' }}>
                    <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 'bold' }}>ASHOK TEXTILES</h1>
                  </div>
                </div>

                {/* Name / Title - Top Center */}
                <div style={{ flex: '2', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: '950', letterSpacing: '1px', margin: 0, color: '#000', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
                  <div style={{ fontSize: '0.85rem', color: '#800000', fontWeight: '800', marginTop: '0.3rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Greige Fabric Outsource Processing Order
                  </div>
                  <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '1.3rem', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>PROCESSING ORDER</h2>
                </div>

                {/* QR Code - Top Right */}
                <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  {pofQrUrl && (
                    <img 
                      src={pofQrUrl} 
                      alt="POF QR Code" 
                      style={{ width: '80px', height: '80px', objectFit: 'contain', border: '1.5px solid #000', padding: '2px', borderRadius: '4px' }} 
                    />
                  )}
                </div>
              </div>

              {/* POF Metadata info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginBottom: '2rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <div>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>POF Number:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>{createdPof.pof_number}</span></p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Processing Partner:</strong> {createdPof.partner_name}</p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Expected Delivery Date:</strong> {new Date(createdPof.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Finished Width:</strong> {createdPof.width || '—'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Order Number:</strong> {pofOrderNo || createdPof.fabric_rolls[0]?.order_number}</p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Design Number:</strong> {pofDesignNo || createdPof.fabric_rolls[0]?.design_no}</p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Design Name:</strong> {pofDesignName || createdPof.fabric_rolls[0]?.design_name || '—'}</p>
                </div>
              </div>

              {/* Processes Panel */}
              <div style={{ border: '1.5px solid #000', padding: '1rem', borderRadius: '6px', marginBottom: '2rem', fontSize: '0.9rem' }}>
                <strong>Required Outsource Processes:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {createdPof.processes.map((proc, index) => (
                    <span key={proc} style={{ border: '1px solid #333', padding: '3px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: '#f9f9f9' }}>
                      {index + 1}. {proc}
                    </span>
                  ))}
                </div>
              </div>

              {/* Rolls Table */}
              <h3 style={{ fontSize: '1rem', borderBottom: '1.5px solid #000', paddingBottom: '0.35rem', margin: '0 0 1rem 0' }}>
                Fabric Rolls Consignment Details ({(createdPof.fabric_rolls || []).length} rolls)
              </h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2.5rem', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f2f2f2' }}>
                    <th style={{ padding: '0.6rem 0.75rem' }}>S.No</th>
                    <th style={{ padding: '0.6rem 0.75rem' }}>Fabric Roll QR ID</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Inspected Actual Qty (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {(createdPof.fabric_rolls || []).map((roll, idx) => (
                    <tr key={roll.id} style={{ borderBottom: '1px solid #ccc' }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>{idx + 1}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{roll.id}</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 'bold' }}>{Number(roll.actual_qty || roll.qty).toFixed(2)} m</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #000', fontWeight: 'bold' }}>
                    <td colSpan="2" style={{ padding: '0.75rem', textAlign: 'right' }}>Grand Total Qty:</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontSize: '0.95rem', color: '#000' }}>
                      {(createdPof.fabric_rolls || []).reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0).toFixed(2)} m
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Delivery and Vehicle info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', borderTop: '2px solid #000', paddingTop: '1.5rem', fontSize: '0.9rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Delivered By:</strong> {createdPof.delivered_by || 'Hand Delivery'}</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Vehicle No:</strong> {createdPof.vehicle_details || 'N/A'}</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Created By:</strong> {profile?.name || 'Administrator'}</p>
                  
                  {createdPof.status === 'received' && (
                    <div style={{ marginTop: '1rem', borderTop: '1px solid #ccc', paddingTop: '1rem' }}>
                      <p style={{ margin: '0 0 0.5rem 0' }}><strong>Received By:</strong> {createdPof.received_by}</p>
                      <p style={{ margin: '0 0 0.5rem 0' }}><strong>Return Vehicle No:</strong> {createdPof.receive_vehicle_details || 'Same/Hand Delivery'}</p>
                      <p style={{ margin: '0 0 0.5rem 0' }}><strong>Date Received:</strong> {createdPof.received_at ? new Date(createdPof.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}</p>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: createdPof.status === 'received' ? '180px' : '100px' }}>
                  <div>
                    <div style={{ borderBottom: '1px dashed #000', width: '180px', height: '40px' }} />
                    <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Authorized Dispatch Signature
                    </div>
                  </div>
                  {createdPof.status === 'received' && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ borderBottom: '1px dashed #000', width: '180px', height: '40px' }} />
                      <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        Authorized Receipt Signature
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Global print style controller */}
          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .print-modal-overlay, .print-modal-overlay * {
                visibility: visible;
              }
              .print-modal-overlay {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 100% !important;
                display: block !important;
                background: none !important;
                padding: 0 !important;
                overflow: visible !important;
              }
              .print-container, .print-container * {
                visibility: visible;
              }
              .print-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                box-shadow: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
        </div>
      )}

      {/* POFRR PRINT MODAL */}
      {showPofrrPrintModal && createdPofrr && (
        <div className="print-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '2rem'
        }}>
          <div 
            className="print-container"
            style={{
              backgroundColor: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px',
              maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
            }}
          >
            {/* Modal Actions (No Print) */}
            <div className="no-print" style={{
              padding: '1rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex',
              justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb',
              borderTopLeftRadius: '12px', borderTopRightRadius: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#111827', fontWeight: '800' }}>
                Print Processing Order Fabric Receipt Register (POFRR)
              </h3>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => window.print()} 
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
                >
                  <Printer size={16} /> Print POFRR
                </button>
                <button 
                  onClick={() => { setShowPofrrPrintModal(false); setCreatedPofrr(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Print Body */}
            <div style={{ padding: '3.5rem', color: '#000', backgroundColor: '#fff', flex: 1 }}>
              
              {/* Print Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', borderBottom: '2.5px solid #000', paddingBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <div style={{ fontSize: '2.2rem', fontWeight: '950', letterSpacing: '1px', margin: 0, color: '#000', lineHeight: '1.1' }}>ASHOK TEXTILES</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', color: '#800000', letterSpacing: '0.5px' }}>FABRIC RECEIPT REGISTER</h2>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#555' }}>POFRR</div>
                </div>
              </div>

              {/* POFRR Metadata info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginBottom: '2rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <div>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>POFRR Number:</strong> <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 'bold' }}>{createdPofrr.pofrr_number}</span></p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>POF Reference:</strong> <span style={{ fontFamily: 'monospace', fontSize: '0.95rem' }}>{createdPofrr.pof_number}</span></p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Processing Partner:</strong> {createdPofrr.partner_name}</p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Finished Width:</strong> {createdPofrr.width || '—'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Date Sent:</strong> {new Date(createdPofrr.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Date Received:</strong> {new Date(createdPofrr.received_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p style={{ margin: '0 0 0.35rem 0' }}><strong>Expected Return Date:</strong> {new Date(createdPofrr.expected_delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Summary Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', border: '1.5px solid #000', padding: '1rem', borderRadius: '6px', marginBottom: '2rem', backgroundColor: '#f9f9f9' }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Sent Qty</span>
                  <strong style={{ fontSize: '1.1rem' }}>
                    {createdPofrr.fabric_rolls?.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0).toFixed(2)} m
                  </strong>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
                  <span style={{ fontSize: '0.7rem', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Received Qty</span>
                  <strong style={{ fontSize: '1.1rem', color: '#047857' }}>
                    {createdPofrr.received_rolls?.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0).toFixed(2)} m
                  </strong>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
                  <span style={{ fontSize: '0.7rem', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Difference (Loss)</span>
                  <strong style={{ fontSize: '1.1rem', color: '#b91c1c' }}>
                    {(() => {
                      const sent = createdPofrr.fabric_rolls?.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0) || 0;
                      const recd = createdPofrr.received_rolls?.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0) || 0;
                      return (sent - recd).toFixed(2);
                    })()} m
                  </strong>
                </div>
                <div style={{ textAlign: 'center', borderLeft: '1px solid #ccc' }}>
                  <span style={{ fontSize: '0.7rem', color: '#555', display: 'block', fontWeight: 'bold', textTransform: 'uppercase' }}>Overall Shrinkage</span>
                  <strong style={{ fontSize: '1.1rem', color: '#b45309' }}>
                    {(() => {
                      const sent = createdPofrr.fabric_rolls?.reduce((sum, r) => sum + parseFloat(r.actual_qty || r.qty || 0), 0) || 0;
                      const recd = createdPofrr.received_rolls?.reduce((sum, r) => sum + parseFloat(r.qty || 0), 0) || 0;
                      const pct = sent > 0 ? ((sent - recd) / sent) * 100 : 0;
                      return `${pct.toFixed(2)}%`;
                    })()}
                  </strong>
                </div>
              </div>

              {/* Comparison Table */}
              <h3 style={{ fontSize: '1rem', borderBottom: '1.5px solid #000', paddingBottom: '0.35rem', margin: '0 0 1rem 0' }}>
                Rolls Reconciliation Details
              </h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2.5rem', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000', textAlign: 'left', fontWeight: 'bold', backgroundColor: '#f2f2f2' }}>
                    <th style={{ padding: '0.6rem 0.5rem', width: '80px' }}>S.No</th>
                    <th style={{ padding: '0.6rem 0.5rem' }}>Fabric Received ID</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'right', width: '150px' }}>Received Qty (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {(createdPofrr.received_rolls || []).map((roll, idx) => {
                    const recdQty = parseFloat(roll.qty || 0);

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                        <td style={{ padding: '0.6rem 0.5rem' }}>{idx + 1}</td>
                        <td style={{ padding: '0.6rem 0.5rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{roll.id}</td>
                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 'bold', color: '#047857' }}>{recdQty.toFixed(2)} m</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Delivery and Vehicle info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', borderTop: '2px solid #000', paddingTop: '1.5rem', fontSize: '0.9rem' }}>
                <div>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Received By:</strong> {createdPofrr.received_by || 'N/A'}</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Received Place:</strong> {createdPofrr.received_place || 'N/A'}</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Return Vehicle No:</strong> {createdPofrr.receive_vehicle_details || 'Hand Delivery'}</p>
                  <p style={{ margin: '0 0 0.5rem 0' }}><strong>Status:</strong> {createdPofrr.status === 'received' ? 'Fully Received' : 'Partially Received'}</p>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px' }}>
                  <div>
                    <div style={{ borderBottom: '1px dashed #000', width: '180px', height: '40px' }} />
                    <div style={{ width: '180px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                      Receiver Signature
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <style>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .print-modal-overlay, .print-modal-overlay * {
                visibility: visible;
              }
              .print-modal-overlay {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: auto !important;
                min-height: 100% !important;
                display: block !important;
                background: none !important;
                padding: 0 !important;
                overflow: visible !important;
              }
              .print-container, .print-container * {
                visibility: visible;
              }
              .print-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                box-shadow: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>
        </div>
      )}

    </div>
  );
}

// Internal icons helper
function ChevronRightIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// PROCESSED FABRIC ROLLS MILESTONES HOVER TOOLTIPS
// ---------------------------------------------------------------------------
function ProcessedRollReceivedTooltip({ roll, align = 'center', children }) {
  const [hovered, setHovered] = useState(false);

  const formattedDateTime = () => {
    if (!roll.received_at) return '—';
    const d = new Date(roll.received_at);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const tooltipStyle = {
    position: 'absolute',
    right: '105%',
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    pointerEvents: 'none',
    border: '1px solid #334155',
    minWidth: '220px',
    fontSize: '0.7rem',
    textAlign: 'left',
    lineHeight: '1.4',
    ...(align === 'top' ? { top: '0px', transform: 'none' } :
       align === 'bottom' ? { bottom: '0px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  const arrowStyle = {
    position: 'absolute',
    right: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: '6px solid #1e293b',
    ...(align === 'top' ? { top: '8px', transform: 'none' } :
       align === 'bottom' ? { bottom: '8px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}
    >
      {children}
      {hovered && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          <div style={{ fontWeight: '800', borderBottom: '1px solid #334155', paddingBottom: '4px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span>📥 Received from Processing</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>POFRR No: </span><span style={{ color: '#fff', fontWeight: '700', fontFamily: 'monospace' }}>{roll.pofrr_number}</span></div>
            <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>POF No: </span><span style={{ color: '#fff', fontWeight: '700', fontFamily: 'monospace' }}>{roll.pof_number}</span></div>
            <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Received At: </span><span style={{ color: '#fff', fontWeight: '700' }}>{formattedDateTime()}</span></div>
            <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Received By: </span><span style={{ color: '#fff', fontWeight: '700' }}>{roll.received_by}</span></div>
            <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Vehicle: </span><span style={{ color: '#fff', fontWeight: '700' }}>{roll.receive_vehicle_details}</span></div>
            <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Received Place: </span><span style={{ color: '#fff', fontWeight: '700' }}>{roll.received_place}</span></div>
            <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Partner: </span><span style={{ color: '#fff', fontWeight: '700' }}>{roll.partner_name}</span></div>
            <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Processes: </span><span style={{ color: '#fbbf24', fontWeight: '700' }}>{roll.processes?.join(', ') || '—'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcessedRollWashedTooltip({ roll, align = 'center', children }) {
  const [hovered, setHovered] = useState(false);
  const parent = roll.parentRoll;
  const isInspected = parent && 
    parent.inspector_1 && 
    parent.inspected_at && 
    parent.received_from_processing_at && 
    new Date(parent.inspected_at).getTime() > new Date(parent.received_from_processing_at).getTime();

  const formattedDateTime = () => {
    if (!parent?.inspected_at) return '—';
    const d = new Date(parent.inspected_at);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const tooltipStyle = {
    position: 'absolute',
    right: '105%',
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    pointerEvents: 'none',
    border: '1px solid #334155',
    minWidth: '240px',
    fontSize: '0.7rem',
    textAlign: 'left',
    lineHeight: '1.4',
    ...(align === 'top' ? { top: '0px', transform: 'none' } :
       align === 'bottom' ? { bottom: '0px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  const arrowStyle = {
    position: 'absolute',
    right: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: '6px solid #1e293b',
    ...(align === 'top' ? { top: '8px', transform: 'none' } :
       align === 'bottom' ? { bottom: '8px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}
    >
      {children}
      {hovered && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          <div style={{ fontWeight: '800', borderBottom: '1px solid #334155', paddingBottom: '4px', color: isInspected ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span>🧼 Washed Inspection Details</span>
          </div>
          {isInspected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Status: </span><span style={{ color: parent.roll_ok ? '#34d399' : '#f87171', fontWeight: '800' }}>{parent.roll_ok ? '🟢 OK' : '🔴 Defects Observed'}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Inspected At: </span><span style={{ color: '#fff', fontWeight: '700' }}>{formattedDateTime()}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Inspectors: </span><span style={{ color: '#fff', fontWeight: '700' }}>{parent.inspector_1} {parent.inspector_2 ? `& ${parent.inspector_2}` : ''}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Attended Fitter: </span><span style={{ color: '#fff', fontWeight: '700' }}>{parent.attended_fitter || '—'}</span></div>
              <div style={{ height: '1px', backgroundColor: '#334155', margin: '2px 0' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4px' }}>
                <div><span style={{ color: '#94a3b8' }}>Received Qty:</span> <strong style={{ color: '#fff' }}>{roll.qty} m</strong></div>
                <div><span style={{ color: '#94a3b8' }}>Actual Qty:</span> <strong style={{ color: '#fff' }}>{parent.actual_qty || '—'} m</strong></div>
                <div><span style={{ color: '#94a3b8' }}>Shortage:</span> <strong style={{ color: parent.shortage > 0 ? '#fbbf24' : '#34d399' }}>{parent.shortage || 0} m</strong></div>
                <div><span style={{ color: '#94a3b8' }}>Mistakes:</span> <strong style={{ color: '#f87171' }}>{parent.mistake || 0} m</strong></div>
              </div>
              <div><span style={{ color: '#34d399', fontWeight: '600' }}>Approved Qty: </span><strong style={{ color: '#34d399' }}>{parent.approved_qty || 0} m</strong></div>
              {parent.warp_comments?.length > 0 && (
                <div style={{ marginTop: '2px' }}><span style={{ color: '#f87171', fontWeight: '700' }}>Warp: </span><span style={{ color: '#e2e8f0' }}>{parent.warp_comments.join(', ')}</span></div>
              )}
              {parent.weft_comments?.length > 0 && (
                <div style={{ marginTop: '2px' }}><span style={{ color: '#f87171', fontWeight: '700' }}>Weft: </span><span style={{ color: '#e2e8f0' }}>{parent.weft_comments.join(', ')}</span></div>
              )}
            </div>
          ) : (
            <div style={{ color: '#9ca3af', fontWeight: '700' }}>Washed QC Inspection Pending</div>
          )}
        </div>
      )}
    </div>
  );
}

function ProcessedRollDispatchedTooltip({ roll, align = 'center', children }) {
  const [hovered, setHovered] = useState(false);
  const mov = roll.latestMovement;
  const isDispatched = mov && mov.to_location !== 'Factory' && mov.to_location !== 'Office';

  const formattedDateTime = () => {
    if (!mov?.created_at) return '—';
    const d = new Date(mov.created_at);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const tooltipStyle = {
    position: 'absolute',
    right: '105%',
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    pointerEvents: 'none',
    border: '1px solid #334155',
    minWidth: '220px',
    fontSize: '0.7rem',
    textAlign: 'left',
    lineHeight: '1.4',
    ...(align === 'top' ? { top: '0px', transform: 'none' } :
       align === 'bottom' ? { bottom: '0px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  const arrowStyle = {
    position: 'absolute',
    right: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: '6px solid #1e293b',
    ...(align === 'top' ? { top: '8px', transform: 'none' } :
       align === 'bottom' ? { bottom: '8px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}
    >
      {children}
      {hovered && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          <div style={{ fontWeight: '800', borderBottom: '1px solid #334155', paddingBottom: '4px', color: isDispatched ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span>🚚 Dispatch Details</span>
          </div>
          {isDispatched ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Challan No: </span><span style={{ color: '#fff', fontWeight: '700', fontFamily: 'monospace' }}>{mov.fmdc_number}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Dispatched At: </span><span style={{ color: '#fff', fontWeight: '700' }}>{formattedDateTime()}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>From: </span><span style={{ color: '#fff', fontWeight: '700' }}>{mov.from_location}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>To Location: </span><span style={{ color: '#38bdf8', fontWeight: '700' }}>{mov.to_location}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Sent By: </span><span style={{ color: '#fff', fontWeight: '700' }}>{mov.sent_by}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Status: </span><span style={{ color: '#fbbf24', fontWeight: '700' }}>{mov.status}</span></div>
            </div>
          ) : (
            <div style={{ color: '#9ca3af', fontWeight: '700' }}>Not Dispatched / In Warehouse Inventory</div>
          )}
        </div>
      )}
    </div>
  );
}

function ProcessedRollReWashTooltip({ roll, align = 'center', children }) {
  const [hovered, setHovered] = useState(false);
  const pof = roll.reWashPof;

  const formattedDateTime = () => {
    if (!pof?.created_at) return '—';
    const d = new Date(pof.created_at);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const tooltipStyle = {
    position: 'absolute',
    right: '105%',
    backgroundColor: '#1e293b',
    color: '#fff',
    borderRadius: '8px',
    padding: '0.65rem 0.85rem',
    boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
    pointerEvents: 'none',
    border: '1px solid #475569',
    minWidth: '240px',
    fontSize: '0.7rem',
    textAlign: 'left',
    lineHeight: '1.4',
    ...(align === 'top' ? { top: '0px', transform: 'none' } :
       align === 'bottom' ? { bottom: '0px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  const arrowStyle = {
    position: 'absolute',
    right: '-6px',
    width: 0, height: 0,
    borderTop: '6px solid transparent',
    borderBottom: '6px solid transparent',
    borderLeft: '6px solid #1e293b',
    ...(align === 'top' ? { top: '8px', transform: 'none' } :
       align === 'bottom' ? { bottom: '8px', transform: 'none' } :
       { top: '50%', transform: 'translateY(-50%)' })
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}
    >
      {children}
      {hovered && (
        <div style={tooltipStyle}>
          <div style={arrowStyle} />
          <div style={{ fontWeight: '800', borderBottom: '1px solid #334155', paddingBottom: '4px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span>🔄 Re-sent to Processing (Re-wash)</span>
          </div>
          {pof ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>POF No: </span><span style={{ color: '#fff', fontWeight: '700', fontFamily: 'monospace' }}>{pof.pof_number}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Issued Date: </span><span style={{ color: '#fff', fontWeight: '700' }}>{formattedDateTime()}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Partner: </span><span style={{ color: '#fff', fontWeight: '700' }}>{pof.partner_name}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>Processes: </span><span style={{ color: '#fbbf24', fontWeight: '700' }}>{pof.processes?.join(', ') || '—'}</span></div>
              <div><span style={{ color: '#94a3b8', fontWeight: '600' }}>POF Status: </span><span style={{ color: '#f59e0b', fontWeight: '700' }}>{pof.status}</span></div>
            </div>
          ) : (
            <div style={{ color: '#9ca3af', fontWeight: '700' }}>No Re-wash POF Details found</div>
          )}
        </div>
      )}
    </div>
  );
}
