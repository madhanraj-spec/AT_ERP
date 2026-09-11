import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, ArrowRight, Check, Plus, Trash2, Calculator, List, Printer, Upload, FileImage, X, Package, Scale, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const WEAVE_TYPES = ['Plain', '2/1 Twill', '2/2 Twill', '3/1 Twill', 'Oxford', 'Herringbone', 'Dobby', 'Satin'];
const ORDER_CATEGORIES = ['Conventional', 'BCI', 'Organic', 'GOTS', 'GRS', 'OCS'];

// Yarn Bundle & Knot Conversion Constants & Helpers
export const STANDARD_BUNDLE_WEIGHT_KG = 4.6; // Standard commercial bundle weight = 4.6 kg (Ashok Textiles standard)

/**
 * Extracts resultant/effective yarn count from count_value string.
 * Handles formats like '40s', '60s CW', '2/40', '2/40s', '40/2', '3/30s', '30/3', etc.
 */
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

/**
 * Returns packing specification details for a given count
 */
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

/**
 * Calculates total KG from bundles and knots
 */
export function calculateKgFromBundlesKnots(yarn, bundles, knots, bundleWeight = STANDARD_BUNDLE_WEIGHT_KG) {
  const b = parseFloat(bundles) || 0;
  const k = parseFloat(knots) || 0;
  if (b === 0 && k === 0 && (bundles === '' || bundles === undefined) && (knots === '' || knots === undefined)) {
    return '';
  }
  
  const info = getYarnCountPackingInfo(yarn, bundleWeight);
  const totalKg = (b * info.bundleWeight) + (k * info.kgPerKnot);
  return totalKg > 0 ? Number(totalKg.toFixed(3)) : '';
}

// HTML5 Canvas Client-side WebP Compression Helper
const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob (WebP at 70% quality)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                type: 'image/webp',
                lastModified: Date.now()
              });
              resolve({
                file: compressedFile,
                preview: URL.createObjectURL(blob),
                sizeKb: Math.round(blob.size / 1024)
              });
            } else {
              reject(new Error("Canvas compression failed"));
            }
          },
          'image/webp',
          0.7
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function CreateOrder() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState(null);
  const [yarnInputMode, setYarnInputMode] = useState('bundles_knots'); // 'bundles_knots' | 'kg'

  // Design Image State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [compressionLoading, setCompressionLoading] = useState(false);
  
  // Master Data
  const [partners, setPartners] = useState([]);
  const [yarnCounts, setYarnCounts] = useState([]);
  const [brands, setBrands] = useState([]);

  // Form Data
  const [formData, setFormData] = useState({
    order_type: '', // bulk, sample
    merchandiser_name: profile?.full_name || '',
    buyer_id: '',
    design_no: '',
    design_name: '',
    vendor_id: '',
    season: '',
    fob_date: '',
    dispatch_date: '',
    total_quantity: '',
    technical_specs: {
      num_warps: 1,
      warp_selections: [[]], // Array of arrays of count IDs for each warp
      weft_selections: [[]], // Array of arrays of count IDs for each weft
      order_reed: '',
      order_pick: '',
      on_loom_reed: '',
      on_loom_pick: '',
      finished_width: '',
      order_width: '',
      weave_type: '',
      gsm: '',
      production_quantity: '',
      order_category: ''
    },
    // color_mapping: { type: 'warp'|'weft', countId: '', colors: [{ name: '', kg: '', bundles: '', knots: '', unit_mode: '' }] }
    yarn_mappings: [],
    design_image_url: '',
    status: 'draft'
  });

  useEffect(() => {
    fetchMasters().then(() => {
      if (isEdit) fetchOrderForEdit();
    });
  }, [id]);

  const fetchOrderForEdit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        const warpSelections = data.technical_specs?.warp_selections || [];
        const weftSelections = data.technical_specs?.weft_selections || [];
        const validMappings = (data.yarn_requirements || []).filter(m => {
          if (m.type === 'warp') {
            const wIdx = m.warpIdx || 0;
            return (warpSelections[wIdx] || []).includes(m.countId);
          }
          if (m.type === 'weft') {
            return (weftSelections[0] || []).includes(m.countId);
          }
          return false;
        });

        setFormData({
          order_number: data.order_number,
          order_type: data.order_type,
          merchandiser_name: data.merchandiser_name,
          buyer_id: data.buyer_id || '',
          design_no: data.design_no || '',
          design_name: data.design_name || '',
          vendor_id: data.vendor_id || '',
          season: data.season || '',
          fob_date: data.fob_date || '',
          dispatch_date: data.dispatch_date || '',
          total_quantity: data.total_quantity || '',
          technical_specs: data.technical_specs || {},
          yarn_mappings: validMappings,
          design_image_url: data.design_image_url || '',
          status: data.status || 'draft'
        });

        // Detect if loaded order has bundles/knots saved
        const hasBundles = validMappings.some(r => r.bundles !== undefined || r.knots !== undefined || r.unit_mode === 'bundles_knots');
        if (hasBundles) {
          setYarnInputMode('bundles_knots');
        } else if (data.yarn_requirements && data.yarn_requirements.length > 0) {
          setYarnInputMode('kg');
        }

        if (data.design_image_url) {
          setImagePreview(data.design_image_url);
        }
        if (data.order_type) {
          setCurrentStep(1);
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
      alert("Error loading order for edit: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMasters = async () => {
    const { data: pData } = await supabase.from('master_partners').select('*').order('partner_name');
    const { data: yData } = await supabase.from('master_yarn_counts').select('*').order('count_value');
    const { data: bData } = await supabase.from('master_brands').select('*').order('brand_name');
    setPartners(pData || []);
    setYarnCounts(yData || []);
    setBrands(bData || []);
  };

  const currentYear = new Date().getFullYear();

  const handleNext = () => {
    if (currentStep === 2) {
      // Clean up orphaned yarn mappings whose counts were removed in Step 2
      setFormData(prev => {
        const warpSelections = prev.technical_specs?.warp_selections || [];
        const weftSelections = prev.technical_specs?.weft_selections || [];
        const cleanedMappings = (prev.yarn_mappings || []).filter(m => {
          if (m.type === 'warp') {
            const wIdx = m.warpIdx || 0;
            return (warpSelections[wIdx] || []).includes(m.countId);
          }
          if (m.type === 'weft') {
            return (weftSelections[0] || []).includes(m.countId);
          }
          return false;
        });
        return { ...prev, yarn_mappings: cleanedMappings };
      });
    }
    setCurrentStep(prev => prev + 1);
  };
  const handleBack = () => setCurrentStep(prev => prev - 1);

  const updateTechnicalSpecs = (field, value) => {
    setFormData(prev => ({
      ...prev,
      technical_specs: { ...prev.technical_specs, [field]: value }
    }));
  };

  const handleOrderTypeSelect = (type) => {
    setFormData(prev => ({ ...prev, order_type: type }));
    handleNext();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCompressionLoading(true);
    try {
      const origSize = Math.round(file.size / 1024);
      setOriginalSize(origSize);

      const compressed = await compressImage(file);
      setImageFile(compressed.file);
      setImagePreview(compressed.preview);
      setCompressedSize(compressed.sizeKb);
    } catch (err) {
      console.error("Compression error:", err);
      alert("Error compressing image: " + err.message);
    } finally {
      setCompressionLoading(false);
    }
  };

  const handleClearImage = () => {
    setImageFile(null);
    setImagePreview('');
    setOriginalSize(0);
    setCompressedSize(0);
    setFormData(prev => ({ ...prev, design_image_url: '' }));
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      let finalOrderNumber = formData.order_number;
      
      if (!finalOrderNumber) {
        const { data: orderNumber, error: numError } = await supabase.rpc('get_next_order_number', {
          p_year: currentYear,
          p_type: formData.order_type || 'bulk'
        });
        if (numError) throw numError;
        finalOrderNumber = orderNumber;
      }

      let uploadedImageUrl = formData.design_image_url;

      if (imageFile) {
        const fileExt = 'webp';
        const fileName = `${finalOrderNumber || Date.now()}_${Date.now()}.${fileExt}`;
        const filePath = `design_images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('order-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          throw new Error("Failed to upload design image: " + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('order-images')
          .getPublicUrl(filePath);

        uploadedImageUrl = publicUrl;
      }

      const orderPayload = {
        order_number: finalOrderNumber,
        order_type: formData.order_type || 'bulk',
        merchandiser_id: profile.id,
        merchandiser_name: formData.merchandiser_name,
        buyer_id: formData.buyer_id || null,
        design_no: formData.design_no || null,
        design_name: formData.design_name || null,
        vendor_id: formData.vendor_id || null,
        season: formData.season || null,
        fob_date: formData.fob_date || null,
        dispatch_date: formData.dispatch_date || null,
        total_quantity: parseFloat(formData.total_quantity || 0),
        technical_specs: formData.technical_specs,
        yarn_requirements: formData.yarn_mappings,
        status: 'draft',
        design_image_url: uploadedImageUrl
      };

      let result;
      if (isEdit) {
        result = await supabase.from('orders').update(orderPayload).eq('id', id);
      } else {
        const { data: existingDraft } = await supabase
          .from('orders')
          .select('id')
          .eq('order_number', finalOrderNumber)
          .maybeSingle();

        if (existingDraft) {
          result = await supabase.from('orders').update(orderPayload).eq('id', existingDraft.id);
        } else {
          result = await supabase.from('orders').insert([orderPayload]);
        }
      }

      if (result.error) throw result.error;

      alert(`Draft Saved Successfully! Order No: ${finalOrderNumber}`);
      navigate(profile.role === 'admin' ? '/admin/orders' : '/merchandiser/orders');
    } catch (err) {
      console.error(err);
      alert('Error saving draft: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let finalOrderNumber = formData.order_number;
      
      if (!isEdit) {
        // 1. Generate Order Number ONLY FOR NEW ORDERS
        const { data: orderNumber, error: numError } = await supabase.rpc('get_next_order_number', {
          p_year: currentYear,
          p_type: formData.order_type
        });
        if (numError) throw numError;
        finalOrderNumber = orderNumber;
      }

      let uploadedImageUrl = formData.design_image_url;

      // Upload image to Storage if a new file is chosen
      if (imageFile) {
        const fileExt = 'webp';
        const fileName = `${finalOrderNumber || Date.now()}_${Date.now()}.${fileExt}`;
        const filePath = `design_images/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('order-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          throw new Error("Failed to upload design image: " + uploadError.message);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('order-images')
          .getPublicUrl(filePath);

        uploadedImageUrl = publicUrl;
      }

      // 2. Save/Update Order
      const orderPayload = {
        order_number: finalOrderNumber,
        order_type: formData.order_type,
        merchandiser_id: profile.id,
        merchandiser_name: formData.merchandiser_name,
        buyer_id: formData.buyer_id || null,
        design_no: formData.design_no || null,
        design_name: formData.design_name || null,
        vendor_id: formData.vendor_id || null,
        season: formData.season || null,
        fob_date: formData.fob_date || null,
        dispatch_date: formData.dispatch_date || null,
        total_quantity: parseFloat(formData.total_quantity || 0),
        technical_specs: formData.technical_specs,
        yarn_requirements: formData.yarn_mappings,
        status: isEdit 
          ? (formData.status === 'draft' ? 'active' : formData.status) 
          : 'active',
        design_image_url: uploadedImageUrl
      };

      let result;
      if (isEdit) {
        result = await supabase.from('orders').update(orderPayload).eq('id', id);
      } else {
        result = await supabase.from('orders').insert([orderPayload]);
      }

      if (result.error) throw result.error;

      setSubmittedOrderNumber(finalOrderNumber);
      alert(isEdit ? 'Order Updated Successfully!' : `Order Created Successfully! Order No: ${finalOrderNumber}`);
    } catch (err) {
      console.error(err);
      alert('Error creating order: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatYarn = (yarn) => {
    if (!yarn) return '';
    return [yarn.count_value, yarn.spec, yarn.spec1, yarn.product_type].filter(Boolean).join(' - ');
  };

  const formatYarnPreview = (yarn) => {
    if (!yarn) return '';
    return [yarn.count_value, yarn.spec, yarn.spec1].filter(Boolean).join(' ');
  };

  const getShortCountsString = () => {
    const allWarpIds = formData.technical_specs.warp_selections.flat();
    const allWeftIds = formData.technical_specs.weft_selections.flat();
    
    const warpStr = allWarpIds.map(id => {
      const y = yarnCounts.find(yc => yc.id === id);
      return y ? formatYarnPreview(y) : '';
    }).filter(Boolean).join(' + ');
    
    const weftStr = allWeftIds.map(id => {
      const y = yarnCounts.find(yc => yc.id === id);
      return y ? formatYarnPreview(y) : '';
    }).filter(Boolean).join(' + ');
    
    return `${warpStr || '-'} X ${weftStr || '-'}`;
  };

  // Helper to format count string
  const getFormattedCounts = (countIds) => {
    return countIds
      .map(id => formatYarnPreview(yarnCounts.find(y => y.id === id)))
      .filter(Boolean)
      .join(' + ');
  };

  const handleExitWithDraftCheck = async () => {
    if (submittedOrderNumber || currentStep === 0) {
      navigate(profile?.role === 'admin' ? '/admin/orders' : '/merchandiser/orders');
      return;
    }

    const saveDraft = window.confirm("Would you like to save your progress as a draft before exiting?");
    if (saveDraft) {
      await handleSaveDraft();
    } else {
      const discard = window.confirm("Are you sure you want to discard your changes and exit?");
      if (discard) {
        navigate(profile?.role === 'admin' ? '/admin/orders' : '/merchandiser/orders');
      }
    }
  };

  const handleCreateAnotherOrder = () => {
    setFormData({
      order_type: '',
      merchandiser_name: profile?.full_name || '',
      buyer_id: '',
      design_no: '',
      design_name: '',
      vendor_id: '',
      season: '',
      fob_date: '',
      dispatch_date: '',
      total_quantity: '',
      technical_specs: {
        num_warps: 1,
        warp_selections: [[]],
        weft_selections: [[]],
        order_reed: '',
        order_pick: '',
        on_loom_reed: '',
        on_loom_pick: '',
        finished_width: '',
        order_width: '',
        weave_type: '',
        gsm: '',
        production_quantity: '',
        order_category: ''
      },
      yarn_mappings: [],
      design_image_url: '',
      status: 'draft'
    });
    setImageFile(null);
    setImagePreview('');
    setOriginalSize(0);
    setCompressedSize(0);
    setSubmittedOrderNumber(null);
    setCurrentStep(0);
  };

  return (
    <div className="create-order-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }} className="no-print">
        <button 
          onClick={handleExitWithDraftCheck}
          className="btn btn-secondary"
          style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
        >
          <ArrowLeft size={16} /> Exit to Orders
        </button>
        {currentStep > 0 && !submittedOrderNumber && (
          <button 
            onClick={handleBack}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem' }}
          >
            Previous Step
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>
          {submittedOrderNumber 
            ? `Order Confirmed: ${submittedOrderNumber}` 
            : (isEdit ? `Edit Order: ${formData.order_number}` : 'Create New Order')}
        </h1>
        {!submittedOrderNumber && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            {[0, 1, 2, 3, 4, 5].map(step => (
              <div 
                key={step} 
                style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  backgroundColor: currentStep >= step ? 'var(--color-primary)' : 'var(--border-current)',
                  transition: 'all 0.3s'
                }} 
              />
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        {/* Step 0: Order Type */}
        {currentStep === 0 && (
          <div className="fade-in" style={{ textAlign: 'center', padding: '2rem 0' }}>
            <h2 style={{ marginBottom: '2rem' }}>Is this a Bulk or Sample order?</h2>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
              <button 
                onClick={() => handleOrderTypeSelect('bulk')}
                style={{ 
                  padding: '3rem 4rem', 
                  borderRadius: '1rem', 
                  border: '2px solid var(--border-current)', 
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                className="hover-scale"
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>BULK</div>
                <div style={{ color: 'var(--text-muted-current)', marginTop: '0.5rem' }}>Large quantities</div>
              </button>
              <button 
                onClick={() => handleOrderTypeSelect('sample')}
                style={{ 
                  padding: '3rem 4rem', 
                  borderRadius: '1rem', 
                  border: '2px solid var(--border-current)', 
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                className="hover-scale"
              >
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>SAMPLE</div>
                <div style={{ color: 'var(--text-muted-current)', marginTop: '0.5rem' }}>Trial/Development</div>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Basic Details */}
        {currentStep === 1 && (
          <div className="fade-in">
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <List size={24} /> Basic & Design Details
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="input-group">
                <label className="input-label">Merchandiser Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.merchandiser_name}
                  onChange={e => setFormData({...formData, merchandiser_name: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Buyer Name</label>
                <select 
                  className="input-field"
                  value={formData.buyer_id}
                  onChange={e => setFormData({...formData, buyer_id: e.target.value})}
                  required
                >
                  <option value="">Select Buyer</option>
                  {brands.map(b => (
                    <option key={b.id} value={b.id}>{b.brand_name}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Design Number</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.design_no}
                  onChange={e => setFormData({...formData, design_no: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Design Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.design_name}
                  onChange={e => setFormData({...formData, design_name: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Vendor Name (from Masters)</label>
                <select 
                  className="input-field"
                  value={formData.vendor_id}
                  onChange={e => setFormData({...formData, vendor_id: e.target.value})}
                >
                  <option value="">Select Vendor</option>
                  {partners.filter(p => p.partner_type === 'Vendor').map(p => (
                    <option key={p.id} value={p.id}>{p.partner_name} ({p.partner_type})</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Season</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={formData.season}
                  onChange={e => setFormData({...formData, season: e.target.value})}
                  placeholder="e.g. AW 2026"
                />
              </div>
              <div className="input-group">
                <label className="input-label">FOB Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={formData.fob_date}
                  onChange={e => setFormData({...formData, fob_date: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Dispatch Date</label>
                <input 
                  type="date" 
                  className="input-field" 
                  value={formData.dispatch_date}
                  onChange={e => setFormData({...formData, dispatch_date: e.target.value})}
                />
              </div>
            </div>
            
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                type="button"
                onClick={handleSaveDraft}
                className="btn btn-secondary"
                disabled={loading}
              >
                Save as Draft
              </button>
              <button onClick={handleNext} className="btn btn-primary">
                Next <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Technical Specs */}
        {currentStep === 2 && (
          <div className="fade-in">
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calculator size={24} /> Technical Specifications
            </h2>
            
            <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'var(--surface-current)', borderRadius: 'var(--radius-md)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Warp & Weft Counts</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <label className="input-label">Number of Warps</label>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    {[1, 2].map(num => (
                      <button 
                        key={num}
                        onClick={() => {
                          setFormData(prev => {
                            const newWarpSelections = num === 1 
                              ? [prev.technical_specs.warp_selections[0] || []] 
                              : [prev.technical_specs.warp_selections[0] || [], prev.technical_specs.warp_selections[1] || []];
                            return {
                              ...prev,
                              technical_specs: {
                                ...prev.technical_specs,
                                num_warps: num,
                                warp_selections: newWarpSelections
                              },
                              yarn_mappings: num === 1
                                ? prev.yarn_mappings.filter(m => !(m.type === 'warp' && m.warpIdx >= 1))
                                : prev.yarn_mappings
                            };
                          });
                        }}
                        style={{ 
                          padding: '0.5rem 1.5rem', 
                          borderRadius: '0.5rem', 
                          border: formData.technical_specs.num_warps === num ? '2px solid var(--color-primary)' : '1px solid var(--border-current)',
                          backgroundColor: formData.technical_specs.num_warps === num ? 'var(--color-primary-light)' : 'white',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    {Array.from({ length: formData.technical_specs.num_warps }).map((_, idx) => (
                      <div key={idx} style={{ marginBottom: '1rem' }}>
                        <label className="input-label">Warp {idx + 1} Counts</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          {formData.technical_specs.warp_selections[idx]?.map(id => (
                            <span key={id} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              {formatYarnPreview(yarnCounts.find(y => y.id === id))}
                              <Trash2 
                                size={12} 
                                style={{ cursor: 'pointer' }} 
                                onClick={() => {
                                  const newWarp = [...formData.technical_specs.warp_selections];
                                  newWarp[idx] = newWarp[idx].filter(cid => cid !== id);
                                  setFormData(prev => ({
                                    ...prev,
                                    technical_specs: { ...prev.technical_specs, warp_selections: newWarp },
                                    yarn_mappings: prev.yarn_mappings.filter(m => !(m.type === 'warp' && m.warpIdx === idx && m.countId === id))
                                  }));
                                }}
                              />
                            </span>
                          ))}
                        </div>
                        <input 
                          type="text"
                          className="input-field"
                          placeholder="Search & select count to add..."
                          list={`warp-counts-list-${idx}`}
                          onChange={(e) => {
                            const val = e.target.value;
                            const selectedYarn = yarnCounts.find(y => formatYarn(y) === val);
                            if (selectedYarn) {
                              const newWarp = [...formData.technical_specs.warp_selections];
                              if (!newWarp[idx]) newWarp[idx] = [];
                              if (!newWarp[idx].includes(selectedYarn.id)) {
                                newWarp[idx] = [...newWarp[idx], selectedYarn.id];
                              }
                              updateTechnicalSpecs('warp_selections', newWarp);
                              e.target.value = '';
                            }
                          }}
                        />
                        <datalist id={`warp-counts-list-${idx}`}>
                          {yarnCounts.map(y => (
                            <option key={y.id} value={formatYarn(y)} />
                          ))}
                        </datalist>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                           Preview: {getFormattedCounts(formData.technical_specs.warp_selections[idx] || [])}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="input-label">Weft Counts</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    {formData.technical_specs.weft_selections[0]?.map(id => (
                      <span key={id} style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {formatYarnPreview(yarnCounts.find(y => y.id === id))}
                        <Trash2 
                          size={12} 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => {
                            const newWeft = [...formData.technical_specs.weft_selections];
                            newWeft[0] = newWeft[0].filter(cid => cid !== id);
                            setFormData(prev => ({
                              ...prev,
                              technical_specs: { ...prev.technical_specs, weft_selections: newWeft },
                              yarn_mappings: prev.yarn_mappings.filter(m => !(m.type === 'weft' && m.countId === id))
                            }));
                          }}
                        />
                      </span>
                    ))}
                  </div>
                  <input 
                    type="text"
                    className="input-field"
                    placeholder="Search & select count to add..."
                    list="weft-counts-list"
                    onChange={(e) => {
                      const val = e.target.value;
                      const selectedYarn = yarnCounts.find(y => formatYarn(y) === val);
                      if (selectedYarn) {
                        const newWeft = [...formData.technical_specs.weft_selections];
                        if (!newWeft[0]) newWeft[0] = [];
                        if (!newWeft[0].includes(selectedYarn.id)) {
                          newWeft[0] = [...newWeft[0], selectedYarn.id];
                        }
                        updateTechnicalSpecs('weft_selections', newWeft);
                        e.target.value = '';
                      }
                    }}
                  />
                  <datalist id="weft-counts-list">
                    {yarnCounts.map(y => (
                      <option key={y.id} value={formatYarn(y)} />
                    ))}
                  </datalist>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                     Preview: {getFormattedCounts(formData.technical_specs.weft_selections[0] || [])}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Order Reed</label>
                <input type="text" className="input-field" value={formData.technical_specs.order_reed} onChange={e => updateTechnicalSpecs('order_reed', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Order Pick</label>
                <input type="text" className="input-field" value={formData.technical_specs.order_pick} onChange={e => updateTechnicalSpecs('order_pick', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">On Loom Reed</label>
                <input type="text" className="input-field" value={formData.technical_specs.on_loom_reed} onChange={e => updateTechnicalSpecs('on_loom_reed', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">On Loom Pick</label>
                <input type="text" className="input-field" value={formData.technical_specs.on_loom_pick} onChange={e => updateTechnicalSpecs('on_loom_pick', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Order Qty (Mtrs)</label>
                <input type="number" className="input-field" value={formData.total_quantity} onChange={e => setFormData({...formData, total_quantity: e.target.value})} />
              </div>
              <div className="input-group">
                <label className="input-label">Prod Qty (Mtrs)</label>
                <input type="number" className="input-field" value={formData.technical_specs.production_quantity} onChange={e => updateTechnicalSpecs('production_quantity', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Finished Width</label>
                <input type="text" className="input-field" value={formData.technical_specs.finished_width} onChange={e => updateTechnicalSpecs('finished_width', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Order Width</label>
                <input type="text" className="input-field" value={formData.technical_specs.order_width} onChange={e => updateTechnicalSpecs('order_width', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Weave Type</label>
                <select className="input-field" value={formData.technical_specs.weave_type} onChange={e => updateTechnicalSpecs('weave_type', e.target.value)}>
                  <option value="">Select Weave</option>
                  {WEAVE_TYPES.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">GSM</label>
                <input type="text" className="input-field" value={formData.technical_specs.gsm || ''} onChange={e => updateTechnicalSpecs('gsm', e.target.value)} placeholder="e.g. 150" />
              </div>
              <div className="input-group">
                <label className="input-label">Order Type</label>
                <select className="input-field" value={formData.technical_specs.order_category || ''} onChange={e => updateTechnicalSpecs('order_category', e.target.value)}>
                  <option value="">Select Order Type</option>
                  {ORDER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                type="button"
                onClick={handleSaveDraft}
                className="btn btn-secondary"
                disabled={loading}
              >
                Save as Draft
              </button>
              <button onClick={handleNext} className="btn btn-primary">
                Next <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Color Mapping */}
        {currentStep === 3 && (
          <div className="fade-in">
             <h2 style={{ marginBottom: '1.5rem' }}>Mapping Colors to Counts</h2>
             <p style={{ color: 'var(--text-muted-current)', marginBottom: '1.5rem' }}>
               Assign colors to all selected warp and weft counts.
             </p>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Warps */}
                {formData.technical_specs.warp_selections.map((warp, wIdx) => (
                  <div key={wIdx}>
                    {warp.map(countId => (
                      <div key={countId} style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <span style={{ fontWeight: 'bold' }}>Warp {wIdx + 1}: {formatYarnPreview(yarnCounts.find(y => y.id === countId))}</span>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              const newMappings = [...formData.yarn_mappings, { type: 'warp', warpIdx: wIdx, countId, color: '', kg: '', bundles: '', knots: '', unit_mode: yarnInputMode }];
                              setFormData({...formData, yarn_mappings: newMappings});
                            }}
                          >
                            <Plus size={14} /> Add Color
                          </button>
                        </div>
                        
                        {formData.yarn_mappings.filter(m => m.type === 'warp' && m.warpIdx === wIdx && m.countId === countId).map((m, mIdx) => {
                          const originalIdx = formData.yarn_mappings.indexOf(m);
                          return (
                            <div key={mIdx} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                              <input 
                                className="input-field" 
                                placeholder="Color Name" 
                                value={m.color}
                                onChange={e => {
                                  const updated = [...formData.yarn_mappings];
                                  updated[originalIdx].color = e.target.value;
                                  setFormData({...formData, yarn_mappings: updated});
                                }}
                              />
                               <button 
                                onClick={() => {
                                  const updated = formData.yarn_mappings.filter((_, i) => i !== originalIdx);
                                  setFormData({...formData, yarn_mappings: updated});
                                }}
                                style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer' }}
                               >
                                 <Trash2 size={16} />
                               </button>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Wefts */}
                {formData.technical_specs.weft_selections[0].map(countId => (
                  <div key={countId} style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ fontWeight: 'bold' }}>Weft: {formatYarnPreview(yarnCounts.find(y => y.id === countId))}</span>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          const newMappings = [...formData.yarn_mappings, { type: 'weft', countId, color: '', kg: '', bundles: '', knots: '', unit_mode: yarnInputMode }];
                          setFormData({...formData, yarn_mappings: newMappings});
                        }}
                      >
                        <Plus size={14} /> Add Color
                      </button>
                    </div>
                    {formData.yarn_mappings.filter(m => m.type === 'weft' && m.countId === countId).map((m, mIdx) => {
                       const originalIdx = formData.yarn_mappings.indexOf(m);
                       return (
                        <div key={mIdx} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                           <input 
                              className="input-field" 
                              placeholder="Color Name" 
                              value={m.color}
                              onChange={e => {
                                const updated = [...formData.yarn_mappings];
                                updated[originalIdx].color = e.target.value;
                                setFormData({...formData, yarn_mappings: updated});
                              }}
                            />
                             <button 
                                onClick={() => {
                                  const updated = formData.yarn_mappings.filter((_, i) => i !== originalIdx);
                                  setFormData({...formData, yarn_mappings: updated});
                                }}
                                style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer' }}
                               >
                                 <Trash2 size={16} />
                               </button>
                        </div>
                       )
                    })}
                  </div>
                ))}
             </div>

             <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                type="button"
                onClick={handleSaveDraft}
                className="btn btn-secondary"
                disabled={loading}
              >
                Save as Draft
              </button>
              <button onClick={handleNext} className="btn btn-primary">
                Next <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Yarn Requirements */}
        {currentStep === 4 && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: '0 0 0.25rem 0' }}>Enter Yarn Requirements</h2>
                <p style={{ margin: 0, color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                  Specify yarn quantity for each mapped count and color.
                </p>
              </div>

              {/* Mode Toggle Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--surface-current)', padding: '0.3rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-current)' }}>
                <button
                  type="button"
                  onClick={() => setYarnInputMode('bundles_knots')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: yarnInputMode === 'bundles_knots' ? 'var(--color-primary)' : 'transparent',
                    color: yarnInputMode === 'bundles_knots' ? 'white' : 'var(--text-color)',
                    fontWeight: yarnInputMode === 'bundles_knots' ? '600' : 'normal',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: yarnInputMode === 'bundles_knots' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <Package size={15} /> Bundles & Knots
                </button>
                <button
                  type="button"
                  onClick={() => setYarnInputMode('kg')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: yarnInputMode === 'kg' ? 'var(--color-primary)' : 'transparent',
                    color: yarnInputMode === 'kg' ? 'white' : 'var(--text-color)',
                    fontWeight: yarnInputMode === 'kg' ? '600' : 'normal',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: yarnInputMode === 'kg' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  <Scale size={15} /> Direct KG
                </button>
              </div>
            </div>

            {yarnInputMode === 'bundles_knots' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#166534' }}>
                <Info size={16} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Standard Packing Rule:</strong> 1 Bundle = <strong>4.600 KG</strong>. Knots per bundle is automatically calculated from the yarn resultant count (e.g., 32s = 32 knots/bdl, 2/32s = 16 knots/bdl).
                </span>
              </div>
            )}
            
            {/* Warp Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Warp Requirements</h3>
              <div style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Position</th>
                      <th style={{ width: yarnInputMode === 'bundles_knots' ? '30%' : '40%' }}>Count & Spec</th>
                      <th style={{ width: yarnInputMode === 'bundles_knots' ? '20%' : '20%' }}>Color</th>
                      {yarnInputMode === 'bundles_knots' ? (
                        <>
                          <th style={{ width: '12%', textAlign: 'right' }}>Bundles</th>
                          <th style={{ width: '11%', textAlign: 'right' }}>Knots</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Calculated (KG)</th>
                        </>
                      ) : (
                        <th style={{ width: '25%', textAlign: 'right' }}>Requirement (KG)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.yarn_mappings.filter(m => m.type === 'warp' && (formData.technical_specs?.warp_selections?.[m.warpIdx || 0] || []).includes(m.countId)).length === 0 ? (
                      <tr>
                        <td colSpan={yarnInputMode === 'bundles_knots' ? 6 : 4} style={{ textAlign: 'center', color: 'var(--text-muted-current)', padding: '1rem' }}>No warp yarns mapped. Go back to add warp specifications.</td>
                      </tr>
                    ) : (
                      formData.yarn_mappings.map((m, idx) => {
                        if (m.type !== 'warp' || !(formData.technical_specs?.warp_selections?.[m.warpIdx || 0] || []).includes(m.countId)) return null;
                        const yc = yarnCounts.find(y => y.id === m.countId);
                        const packingInfo = getYarnCountPackingInfo(yc);
                        return (
                          <tr key={idx}>
                            <td style={{ textTransform: 'capitalize', fontWeight: '500' }}>Warp {m.warpIdx + 1}</td>
                            <td>
                              <div style={{ fontWeight: '500' }}>{formatYarnPreview(yc)}</div>
                              {yarnInputMode === 'bundles_knots' && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                  <span style={{ backgroundColor: 'var(--surface-current)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-current)' }}>
                                    Eff: {packingInfo.effCount}s • {packingInfo.knotsPerBundle} knts/bdl • {packingInfo.kgPerKnot.toFixed(3)} kg/knt
                                  </span>
                                </div>
                              )}
                            </td>
                            <td>{m.color || <span style={{ color: 'red' }}>Enter Color in prev step</span>}</td>
                            {yarnInputMode === 'bundles_knots' ? (
                              <>
                                <td style={{ textAlign: 'right' }}>
                                  <input 
                                    type="number" 
                                    step="any"
                                    min="0"
                                    className="input-field" 
                                    style={{ maxWidth: '90px', marginLeft: 'auto', textAlign: 'right' }}
                                    placeholder="0"
                                    value={m.bundles !== undefined ? m.bundles : ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const updated = [...formData.yarn_mappings];
                                      const computedKg = calculateKgFromBundlesKnots(yc, val, m.knots);
                                      updated[idx] = {
                                        ...updated[idx],
                                        bundles: val,
                                        kg: computedKg !== '' ? computedKg : (val || m.knots ? 0 : ''),
                                        unit_mode: 'bundles_knots'
                                      };
                                      setFormData({...formData, yarn_mappings: updated});
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <input 
                                    type="number" 
                                    step="any"
                                    min="0"
                                    className="input-field" 
                                    style={{ maxWidth: '85px', marginLeft: 'auto', textAlign: 'right' }}
                                    placeholder="0"
                                    value={m.knots !== undefined ? m.knots : ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const updated = [...formData.yarn_mappings];
                                      const computedKg = calculateKgFromBundlesKnots(yc, m.bundles, val);
                                      updated[idx] = {
                                        ...updated[idx],
                                        knots: val,
                                        kg: computedKg !== '' ? computedKg : (m.bundles || val ? 0 : ''),
                                        unit_mode: 'bundles_knots'
                                      };
                                      setFormData({...formData, yarn_mappings: updated});
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                  <span style={{ 
                                    display: 'inline-block', 
                                    padding: '0.35rem 0.6rem', 
                                    backgroundColor: (m.kg && parseFloat(m.kg) > 0) ? '#ecfdf5' : 'var(--surface-current)',
                                    color: (m.kg && parseFloat(m.kg) > 0) ? '#059669' : 'var(--text-muted-current)',
                                    borderRadius: '6px',
                                    border: (m.kg && parseFloat(m.kg) > 0) ? '1px solid #a7f3d0' : '1px solid var(--border-current)',
                                    minWidth: '85px'
                                  }}>
                                    {m.kg ? `${parseFloat(m.kg).toFixed(2)} kg` : '—'}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <td style={{ textAlign: 'right' }}>
                                <input 
                                  type="number" 
                                  step="any"
                                  className="input-field" 
                                  style={{ maxWidth: '120px', marginLeft: 'auto', textAlign: 'right' }}
                                  value={m.kg !== undefined ? m.kg : ''}
                                  placeholder="0.00"
                                  onChange={e => {
                                    const updated = [...formData.yarn_mappings];
                                    updated[idx] = {
                                      ...updated[idx],
                                      kg: e.target.value,
                                      unit_mode: 'kg'
                                    };
                                    setFormData({...formData, yarn_mappings: updated});
                                  }}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Weft Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Weft Requirements</h3>
              <div style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Position</th>
                      <th style={{ width: yarnInputMode === 'bundles_knots' ? '30%' : '40%' }}>Count & Spec</th>
                      <th style={{ width: yarnInputMode === 'bundles_knots' ? '20%' : '20%' }}>Color</th>
                      {yarnInputMode === 'bundles_knots' ? (
                        <>
                          <th style={{ width: '12%', textAlign: 'right' }}>Bundles</th>
                          <th style={{ width: '11%', textAlign: 'right' }}>Knots</th>
                          <th style={{ width: '12%', textAlign: 'right' }}>Calculated (KG)</th>
                        </>
                      ) : (
                        <th style={{ width: '25%', textAlign: 'right' }}>Requirement (KG)</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {formData.yarn_mappings.filter(m => m.type === 'weft' && (formData.technical_specs?.weft_selections?.[0] || []).includes(m.countId)).length === 0 ? (
                      <tr>
                        <td colSpan={yarnInputMode === 'bundles_knots' ? 6 : 4} style={{ textAlign: 'center', color: 'var(--text-muted-current)', padding: '1rem' }}>No weft yarns mapped. Go back to add weft specifications.</td>
                      </tr>
                    ) : (
                      formData.yarn_mappings.map((m, idx) => {
                        if (m.type !== 'weft' || !(formData.technical_specs?.weft_selections?.[0] || []).includes(m.countId)) return null;
                        const yc = yarnCounts.find(y => y.id === m.countId);
                        const packingInfo = getYarnCountPackingInfo(yc);
                        return (
                          <tr key={idx}>
                            <td style={{ textTransform: 'capitalize', fontWeight: '500' }}>Weft</td>
                            <td>
                              <div style={{ fontWeight: '500' }}>{formatYarnPreview(yc)}</div>
                              {yarnInputMode === 'bundles_knots' && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)', marginTop: '2px' }}>
                                  <span style={{ backgroundColor: 'var(--surface-current)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-current)' }}>
                                    Eff: {packingInfo.effCount}s • {packingInfo.knotsPerBundle} knts/bdl • {packingInfo.kgPerKnot.toFixed(3)} kg/knt
                                  </span>
                                </div>
                              )}
                            </td>
                            <td>{m.color || <span style={{ color: 'red' }}>Enter Color in prev step</span>}</td>
                            {yarnInputMode === 'bundles_knots' ? (
                              <>
                                <td style={{ textAlign: 'right' }}>
                                  <input 
                                    type="number" 
                                    step="any"
                                    min="0"
                                    className="input-field" 
                                    style={{ maxWidth: '90px', marginLeft: 'auto', textAlign: 'right' }}
                                    placeholder="0"
                                    value={m.bundles !== undefined ? m.bundles : ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const updated = [...formData.yarn_mappings];
                                      const computedKg = calculateKgFromBundlesKnots(yc, val, m.knots);
                                      updated[idx] = {
                                        ...updated[idx],
                                        bundles: val,
                                        kg: computedKg !== '' ? computedKg : (val || m.knots ? 0 : ''),
                                        unit_mode: 'bundles_knots'
                                      };
                                      setFormData({...formData, yarn_mappings: updated});
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <input 
                                    type="number" 
                                    step="any"
                                    min="0"
                                    className="input-field" 
                                    style={{ maxWidth: '85px', marginLeft: 'auto', textAlign: 'right' }}
                                    placeholder="0"
                                    value={m.knots !== undefined ? m.knots : ''}
                                    onChange={e => {
                                      const val = e.target.value;
                                      const updated = [...formData.yarn_mappings];
                                      const computedKg = calculateKgFromBundlesKnots(yc, m.bundles, val);
                                      updated[idx] = {
                                        ...updated[idx],
                                        knots: val,
                                        kg: computedKg !== '' ? computedKg : (m.bundles || val ? 0 : ''),
                                        unit_mode: 'bundles_knots'
                                      };
                                      setFormData({...formData, yarn_mappings: updated});
                                    }}
                                  />
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                  <span style={{ 
                                    display: 'inline-block', 
                                    padding: '0.35rem 0.6rem', 
                                    backgroundColor: (m.kg && parseFloat(m.kg) > 0) ? '#ecfdf5' : 'var(--surface-current)',
                                    color: (m.kg && parseFloat(m.kg) > 0) ? '#059669' : 'var(--text-muted-current)',
                                    borderRadius: '6px',
                                    border: (m.kg && parseFloat(m.kg) > 0) ? '1px solid #a7f3d0' : '1px solid var(--border-current)',
                                    minWidth: '85px'
                                  }}>
                                    {m.kg ? `${parseFloat(m.kg).toFixed(2)} kg` : '—'}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <td style={{ textAlign: 'right' }}>
                                <input 
                                  type="number" 
                                  step="any"
                                  className="input-field" 
                                  style={{ maxWidth: '120px', marginLeft: 'auto', textAlign: 'right' }}
                                  value={m.kg !== undefined ? m.kg : ''}
                                  placeholder="0.00"
                                  onChange={e => {
                                    const updated = [...formData.yarn_mappings];
                                    updated[idx] = {
                                      ...updated[idx],
                                      kg: e.target.value,
                                      unit_mode: 'kg'
                                    };
                                    setFormData({...formData, yarn_mappings: updated});
                                  }}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button 
                type="button"
                onClick={handleSaveDraft}
                className="btn btn-secondary"
                disabled={loading}
              >
                Save as Draft
              </button>
              <button onClick={handleNext} className="btn btn-primary">
                Next <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Summary & Submit */}
        {currentStep === 5 && (
          <div className="fade-in print-area">
            {submittedOrderNumber && (
              <div 
                className="no-print" 
                style={{ 
                  backgroundColor: '#ecfdf5', 
                  border: '1px solid #a7f3d0', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: '1.25rem', 
                  marginBottom: '1.5rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)'
                }}
              >
                <div style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={24} strokeWidth={3} />
                </div>
                <div>
                  <h3 style={{ color: '#065f46', fontSize: '1rem', fontWeight: 'bold', margin: '0 0 0.2rem 0' }}>
                    Order Finalized & Submitted Successfully!
                  </h3>
                  <p style={{ color: '#047857', margin: 0, fontSize: '0.85rem' }}>
                    Order Number <strong style={{ textDecoration: 'underline' }}>{submittedOrderNumber}</strong> has been saved. You can print the single-sheet confirmation below.
                  </p>
                </div>
              </div>
            )}

            {/* SINGLE A4 PRINT WRAPPER */}
            <div className="a4-confirmation-sheet" style={{ 
              backgroundColor: 'white', 
              color: '#0f172a', 
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              minHeight: '260mm',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              
              {/* TOP CONTENT WRAPPER */}
              <div>
                {/* 1. COMPANY HEADER & ORDER TITLE */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  borderBottom: '3px solid #800000', 
                  paddingBottom: '0.85rem', 
                  marginBottom: '1.1rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <img
                      src="/logo.png"
                      alt="Ashok Textiles"
                      style={{ maxHeight: '58px', maxWidth: '160px', objectFit: 'contain' }}
                      onError={e => {
                        e.target.style.display = 'none';
                        if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{ display: 'none', width: '50px', height: '50px', backgroundColor: '#800000', borderRadius: '8px', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '900', fontSize: '1.25rem' }}>
                      AT
                    </div>
                    <div>
                      <div style={{ fontSize: '1.45rem', fontWeight: '900', color: '#800000', letterSpacing: '-0.3px', lineHeight: '1.1' }}>
                        ASHOK TEXTILES
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: '1.35', marginTop: '2px' }}>
                        6/222, SALEM MAIN ROAD, VEERAPANDI, SALEM, TAMIL NADU - 33
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0f172a', marginTop: '1px' }}>
                        GSTIN: 33AAZFA60686D1Z6
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: '900', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: '1.1' }}>
                      ORDER CONFIRMATION
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '800', fontFamily: 'monospace', color: '#0f172a', marginTop: '3px' }}>
                      {submittedOrderNumber ? submittedOrderNumber : (isEdit ? formData.order_number : 'DRAFT')}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px' }}>
                      Date: <strong style={{ color: '#0f172a' }}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> | Type: <span style={{ fontWeight: '800', textTransform: 'uppercase', color: '#800000', backgroundColor: '#fef2f2', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca' }}>{formData.order_type || 'BULK'}</span>
                    </div>
                  </div>
                </div>

                {/* 2. ORDER & TECHNICAL SPECIFICATIONS TABLE */}
                <div style={{ marginBottom: '1.1rem' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Order & Fabric Technical Specifications</span>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'none', fontWeight: 'normal' }}>
                      Merchandiser: <strong style={{ color: '#0f172a' }}>{formData.merchandiser_name || '—'}</strong>
                    </span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '0.84rem' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', width: '16%', border: '1px solid #94a3b8', color: '#334155' }}>Buyer</td>
                        <td style={{ padding: '6px 9px', width: '34%', border: '1px solid #94a3b8', fontWeight: '700', color: '#0f172a' }}>{brands.find(b => b.id === formData.buyer_id)?.brand_name || '—'}</td>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', width: '16%', border: '1px solid #94a3b8', color: '#334155' }}>Vendor / Unit</td>
                        <td style={{ padding: '6px 9px', width: '34%', border: '1px solid #94a3b8', color: '#0f172a' }}>{partners.find(p => p.id === formData.vendor_id)?.partner_name || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Design No & Name</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8', fontWeight: '600' }}>{formData.design_no || '—'} {formData.design_name ? `(${formData.design_name})` : ''}</td>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Season / Category</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8' }}>{formData.season || '—'} {formData.technical_specs?.order_category ? `• ${formData.technical_specs.order_category}` : ''}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Order Reed / Pick</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8' }}><strong>{formData.technical_specs?.order_reed || '—'}</strong> / <strong>{formData.technical_specs?.order_pick || '—'}</strong></td>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Loom Reed / Pick</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8' }}>{formData.technical_specs?.on_loom_reed || '—'} / {formData.technical_specs?.on_loom_pick || '—'}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Warp Counts</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8', color: '#0369a1', fontWeight: '700' }}>
                          {formData.technical_specs?.warp_selections?.length > 0 ? (
                            formData.technical_specs.warp_selections.map((w, idx) => (
                              <div key={idx}>{formData.technical_specs.num_warps > 1 ? `W${idx + 1}: ` : ''}{getFormattedCounts(w)}</div>
                            ))
                          ) : '—'}
                        </td>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Weft Counts</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8', color: '#92400e', fontWeight: '700' }}>
                          {getFormattedCounts(formData.technical_specs?.weft_selections?.[0] || []) || '—'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Finished / Order Width</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8' }}>{formData.technical_specs?.finished_width || '—'} / {formData.technical_specs?.order_width || '—'}</td>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Weave / GSM</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8' }}>{formData.technical_specs?.weave_type || '—'} {formData.technical_specs?.gsm ? `• ${formData.technical_specs.gsm} GSM` : ''}</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>Order Qty / Prod Qty</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8' }}>
                          <strong style={{ color: '#800000', fontSize: '0.9rem' }}>{formData.total_quantity ? `${Number(formData.total_quantity).toLocaleString()} Mtrs` : '0 Mtrs'}</strong>
                          {formData.technical_specs?.production_quantity ? ` (Prod: ${Number(formData.technical_specs.production_quantity).toLocaleString()} Mtrs)` : ''}
                        </td>
                        <td style={{ padding: '6px 9px', fontWeight: '700', backgroundColor: '#f8fafc', border: '1px solid #94a3b8', color: '#334155' }}>FOB / Dispatch Date</td>
                        <td style={{ padding: '6px 9px', border: '1px solid #94a3b8' }}>{formData.fob_date || '—'} {formData.dispatch_date ? ` / ${formData.dispatch_date}` : ''}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. SIDE-BY-SIDE YARN REQUIREMENT & COUNT SUMMARY */}
                {(() => {
                  const activeMappings = (formData.yarn_mappings || []).filter(m => {
                    if (m.type === 'warp') return (formData.technical_specs?.warp_selections?.[m.warpIdx || 0] || []).includes(m.countId);
                    if (m.type === 'weft') return (formData.technical_specs?.weft_selections?.[0] || []).includes(m.countId);
                    return false;
                  });
                  const totalYarnKg = activeMappings.reduce((sum, m) => sum + (parseFloat(m.kg) || 0), 0);
                  const totalBundles = activeMappings.reduce((sum, m) => sum + (parseFloat(m.bundles) || 0), 0);
                  const totalKnots = activeMappings.reduce((sum, m) => sum + (parseFloat(m.knots) || 0), 0);

                  const countMap = activeMappings.reduce((acc, curr) => {
                    const yc = yarnCounts.find(y => y.id === curr.countId);
                    const countName = formatYarnPreview(yc) || 'Unknown';
                    if (!acc[countName]) {
                      acc[countName] = { kg: 0, bundles: 0, knots: 0 };
                    }
                    acc[countName].kg += parseFloat(curr.kg || 0);
                    acc[countName].bundles += parseFloat(curr.bundles || 0);
                    acc[countName].knots += parseFloat(curr.knots || 0);
                    return acc;
                  }, {});

                  return (
                    <div style={{ marginBottom: '0.85rem' }}>
                      {/* 3. FULL-WIDTH YARN REQUIREMENT (COLOR WISE) */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                          Yarn Requirement (Color Wise)
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '0.82rem', boxSizing: 'border-box' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                              <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #94a3b8', width: '14%' }}>Position</th>
                              <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #94a3b8', width: '38%' }}>Count & Spec</th>
                              <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #94a3b8', width: '22%' }}>Color / Shade</th>
                              <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #94a3b8', width: '13%' }}>Bundles & Knots</th>
                              <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #94a3b8', width: '13%' }}>Req (KG)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeMappings.length === 0 ? (
                              <tr>
                                <td colSpan="5" style={{ padding: '8px', textAlign: 'center', color: '#64748b', border: '1px solid #94a3b8' }}>No yarn requirements specified.</td>
                              </tr>
                            ) : (
                              activeMappings.map((m, i) => {
                                const yc = yarnCounts.find(y => y.id === m.countId);
                                const hasBdlKnt = (m.bundles || m.knots) && (parseFloat(m.bundles || 0) > 0 || parseFloat(m.knots || 0) > 0);
                                return (
                                  <tr key={i}>
                                    <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textTransform: 'capitalize', fontWeight: '600' }}>
                                      {m.type === 'warp' ? `Warp ${formData.technical_specs?.num_warps > 1 ? ((m.warpIdx || 0) + 1) : ''}` : 'Weft'}
                                    </td>
                                    <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8' }}>{formatYarnPreview(yc)}</td>
                                    <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', fontWeight: '700' }}>{m.color || '—'}</td>
                                    <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontSize: '0.78rem', color: '#475569' }}>
                                      {hasBdlKnt ? `${m.bundles || 0}b ${m.knots || 0}k` : '—'}
                                    </td>
                                    <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                      {parseFloat(m.kg || 0).toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                            {activeMappings.length > 0 && (
                              <tr style={{ backgroundColor: '#f8fafc', fontWeight: '800' }}>
                                <td colSpan="3" style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right' }}>Total Warp + Weft:</td>
                                <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontSize: '0.8rem' }}>
                                  {totalBundles > 0 || totalKnots > 0 ? `${totalBundles}b ${totalKnots}k` : ''}
                                </td>
                                <td style={{ padding: '5px 8px', border: '1px solid #94a3b8', textAlign: 'right', color: '#800000', fontSize: '0.88rem' }}>
                                  {totalYarnKg.toFixed(2)} kg
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* 4. COUNT WISE SUMMARY & OPTIONAL DESIGN THUMBNAIL (BELOW) */}
                      <div style={{ display: 'grid', gridTemplateColumns: imagePreview ? '1fr 200px' : '1fr', gap: '0.75rem', alignItems: 'start', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#800000', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                            Count Wise Summary
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #94a3b8', fontSize: '0.82rem', boxSizing: 'border-box' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9' }}>
                                <th style={{ padding: '5px 8px', textAlign: 'left', border: '1px solid #94a3b8', width: '50%' }}>Yarn Description</th>
                                <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #94a3b8', width: '25%' }}>Bundles & Knots</th>
                                <th style={{ padding: '5px 8px', textAlign: 'right', border: '1px solid #94a3b8', width: '25%' }}>Total Weight (KG)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(countMap).map(([count, totals], i) => (
                                <tr key={i}>
                                  <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', fontWeight: '600' }}>{count}</td>
                                  <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontSize: '0.78rem', color: '#475569' }}>
                                    {totals.bundles > 0 || totals.knots > 0 ? `${totals.bundles}b ${totals.knots}k` : '—'}
                                  </td>
                                  <td style={{ padding: '4.5px 8px', border: '1px solid #94a3b8', textAlign: 'right', fontWeight: '700', color: '#800000' }}>
                                    {totals.kg.toFixed(2)} kg
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Design Image Thumbnail in Print */}
                        {imagePreview && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '6px 8px', border: '1px solid #94a3b8', borderRadius: '6px', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}>
                            <img 
                              src={imagePreview} 
                              alt="Design Preview" 
                              style={{ width: '55px', height: '55px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #cbd5e1' }} 
                            />
                            <div>
                              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0f172a' }}>Fabric Pattern Sample</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Design attached to order</div>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })()}

                {/* 4. MANUFACTURING GUIDELINES & QUALITY STANDARDS */}
                <div style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  backgroundColor: '#fcfcfd',
                  marginBottom: '0.85rem'
                }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                    Standard Quality & Production Instructions
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '0.72rem', color: '#475569', lineHeight: '1.3' }}>
                    <div>• Fabric width tolerance: ±0.5" | GSM tolerance: ±5%</div>
                    <div>• Pre-production shade matching required before dyeing</div>
                    <div>• Ashok Textiles 4-Point Greige Quality Standard applicable</div>
                    <div>• Dispatch strictly adhering to agreed FOB/Delivery schedule</div>
                  </div>
                </div>
              </div>

              {/* 5. FOOTER & SIGNATURES (Anchored cleanly at bottom of A4 page) */}
              <div style={{ 
                marginTop: 'auto', 
                paddingTop: '0.85rem', 
                borderTop: '1.5px solid #94a3b8', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-end',
                paddingBottom: '0.25rem'
              }}>
                <div style={{ textAlign: 'center', width: '180px' }}>
                  <div style={{ borderBottom: '1.5px solid #0f172a', height: '45px', marginBottom: '5px' }}></div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a' }}>
                    Prepared By
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
                    {profile?.full_name || formData.merchandiser_name || 'Merchandiser'}
                  </div>
                </div>

                <div style={{ textAlign: 'center', width: '180px' }}>
                  <div style={{ borderBottom: '1.5px solid #0f172a', height: '45px', marginBottom: '5px' }}></div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a' }}>
                    Authorized Signatory
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '2px' }}>
                    Ashok Textiles
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.68rem', color: '#94a3b8', marginTop: '6px' }}>
                Ashok Textiles ERP • System Generated Order Confirmation • {new Date().toLocaleDateString('en-IN')} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>

            </div>

            {/* Design Image Upload Section (Screen only) */}
            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }} className="no-print">
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Fabric Design Image</h3>
              <div 
                style={{ 
                  border: '2px dashed var(--border-current)', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: '1.5rem', 
                  textAlign: 'center', 
                  backgroundColor: 'var(--surface-current)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {compressionLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                    <div className="spin" style={{ width: '36px', height: '36px', border: '4px solid var(--color-primary-light)', borderTopColor: 'var(--color-primary)', borderRadius: '50%' }}></div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Compressing image client-side...</span>
                  </div>
                ) : imagePreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', width: '140px', height: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-current)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                      <img 
                        src={imagePreview} 
                        alt="Design Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <button
                        type="button"
                        onClick={handleClearImage}
                        style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          backgroundColor: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '24px',
                          height: '24px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.9)'}
                        title="Remove Image"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    
                    {originalSize > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>
                        <div>Original Size: <strong>{originalSize} KB</strong></div>
                        <div>Compressed WebP Size: <strong style={{ color: '#16a34a' }}>{compressedSize} KB</strong> ({Math.round((1 - compressedSize / originalSize) * 100)}% saved!)</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', padding: '1rem 0' }}>
                    <div style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.25rem' }}>
                      <Upload size={20} />
                    </div>
                    <div>
                      <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>Click to upload</span> or drag and drop
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted-current)' }}>Supports PNG, JPG, JPEG (Compressed to lightweight WebP automatically)</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange} 
                      style={{ display: 'none' }} 
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Print CSS & Submissions control */}
            <style>{`
              @media print {
                /* Hide navigation, sidebar, and non-printable elements */
                .no-print,
                .no-print *,
                button,
                .btn,
                aside,
                header {
                  display: none !important;
                }
                
                @page {
                  size: A4 portrait;
                  margin: 8mm 10mm; /* Standard professional A4 margin */
                }
                
                /* Reset containers for full-page A4 portrait fit */
                body, html, #root, .app-layout-container, .main-content-wrapper, main, .main-content, .create-order-container {
                  background: white !important;
                  color: #000 !important;
                  height: 100% !important;
                  min-height: 100% !important;
                  overflow: visible !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  display: block !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  font-size: 9.5pt !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                
                .glass-panel {
                  border: none !important;
                  box-shadow: none !important;
                  background: white !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  height: 100% !important;
                  overflow: visible !important;
                }

                .a4-confirmation-sheet {
                  width: 100% !important;
                  min-height: 265mm !important;
                  height: 265mm !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  box-sizing: border-box !important;
                  page-break-inside: avoid !important;
                  page-break-after: avoid !important;
                }

                table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                  page-break-inside: avoid !important;
                }
                
                th, td {
                  border: 1px solid #334155 !important;
                  padding: 5.5px 8px !important;
                  font-size: 9pt !important;
                  line-height: 1.3 !important;
                  color: #000000 !important;
                }
                
                th {
                  background-color: #f1f5f9 !important;
                  font-weight: 700 !important;
                  color: #000000 !important;
                }
              }
            `}</style>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }} className="no-print">
              {submittedOrderNumber ? (
                <>
                  <button 
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-primary"
                    style={{ minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                  >
                    <Printer size={18} /> Print Confirmation
                  </button>
                  {!isEdit && (
                    <button 
                      type="button"
                      onClick={handleCreateAnotherOrder}
                      className="btn btn-secondary"
                      style={{ minWidth: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      <Plus size={18} /> Create Another Order
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => navigate(profile?.role === 'admin' ? '/admin/orders' : '/merchandiser/orders')}
                    className="btn btn-secondary"
                    style={{ minWidth: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    Go to Orders List <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button 
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-secondary"
                    style={{ minWidth: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#e2e8f0', color: '#1e293b', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    <Printer size={18} /> Print Summary
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveDraft}
                    className="btn btn-secondary"
                    disabled={loading}
                    style={{ minWidth: '130px' }}
                  >
                    Save as Draft
                  </button>
                  <button 
                    onClick={handleSubmit} 
                    className="btn btn-primary" 
                    disabled={loading}
                    style={{ minWidth: '180px' }}
                  >
                    {loading ? 'Processing...' : <><Check size={18} /> {isEdit ? 'Update Order Details' : 'Complete Order & Submit'}</>}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

