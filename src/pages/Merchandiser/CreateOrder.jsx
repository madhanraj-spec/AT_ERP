import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, ArrowRight, Check, Plus, Trash2, Calculator, List, Printer, Upload, FileImage, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const WEAVE_TYPES = ['Plain', '2/1 Twill', '2/2 Twill', '3/1 Twill', 'Oxford', 'Herringbone', 'Dobby', 'Satin'];
const ORDER_CATEGORIES = ['Conventional', 'BCI', 'Organic', 'GOTS', 'GRS', 'OCS'];

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
    // color_mapping: { type: 'warp'|'weft', countId: '', colors: [{ name: '', kg: '' }] }
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
          yarn_mappings: data.yarn_requirements || [],
          design_image_url: data.design_image_url || '',
          status: data.status || 'draft'
        });
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

  const handleNext = () => setCurrentStep(prev => prev + 1);
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
    return `${yarn.count_value} - ${yarn.material} - ${yarn.product_type}`;
  };

  const getShortCountsString = () => {
    const allWarpIds = formData.technical_specs.warp_selections.flat();
    const allWeftIds = formData.technical_specs.weft_selections.flat();
    
    const warpStr = allWarpIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
    const weftStr = allWeftIds.map(id => yarnCounts.find(y => y.id === id)?.count_value).filter(Boolean).join(' + ');
    
    return `${warpStr || '-'} X ${weftStr || '-'}`;
  };

  // Helper to format count string
  const getFormattedCounts = (countIds) => {
    return countIds
      .map(id => formatYarn(yarnCounts.find(y => y.id === id)))
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
                        onClick={() => updateTechnicalSpecs('num_warps', num)}
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
                              {formatYarn(yarnCounts.find(y => y.id === id))}
                              <Trash2 
                                size={12} 
                                style={{ cursor: 'pointer' }} 
                                onClick={() => {
                                  const newWarp = [...formData.technical_specs.warp_selections];
                                  newWarp[idx] = newWarp[idx].filter(cid => cid !== id);
                                  updateTechnicalSpecs('warp_selections', newWarp);
                                }}
                              />
                            </span>
                          ))}
                        </div>
                        <select 
                          className="input-field"
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const newWarp = [...formData.technical_specs.warp_selections];
                            if (!newWarp[idx]) newWarp[idx] = [];
                            if (!newWarp[idx].includes(e.target.value)) {
                              newWarp[idx] = [...newWarp[idx], e.target.value];
                            }
                            updateTechnicalSpecs('warp_selections', newWarp);
                            e.target.value = '';
                          }}
                        >
                          <option value="">+ Add Count</option>
                          {yarnCounts.map(y => (
                            <option key={y.id} value={y.id}>{formatYarn(y)}</option>
                          ))}
                        </select>
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
                        {formatYarn(yarnCounts.find(y => y.id === id))}
                        <Trash2 
                          size={12} 
                          style={{ cursor: 'pointer' }} 
                          onClick={() => {
                            const newWeft = [...formData.technical_specs.weft_selections];
                            newWeft[0] = newWeft[0].filter(cid => cid !== id);
                            updateTechnicalSpecs('weft_selections', newWeft);
                          }}
                        />
                      </span>
                    ))}
                  </div>
                  <select 
                    className="input-field"
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const newWeft = [...formData.technical_specs.weft_selections];
                      if (!newWeft[0]) newWeft[0] = [];
                      if (!newWeft[0].includes(e.target.value)) {
                        newWeft[0] = [...newWeft[0], e.target.value];
                      }
                      updateTechnicalSpecs('weft_selections', newWeft);
                      e.target.value = '';
                    }}
                  >
                    <option value="">+ Add Count</option>
                    {yarnCounts.map(y => (
                      <option key={y.id} value={y.id}>{formatYarn(y)}</option>
                    ))}
                  </select>
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
                          <span style={{ fontWeight: 'bold' }}>Warp {wIdx + 1}: {formatYarn(yarnCounts.find(y => y.id === countId))}</span>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => {
                              const newMappings = [...formData.yarn_mappings, { type: 'warp', warpIdx: wIdx, countId, color: '', kg: '' }];
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
                      <span style={{ fontWeight: 'bold' }}>Weft: {formatYarn(yarnCounts.find(y => y.id === countId))}</span>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          const newMappings = [...formData.yarn_mappings, { type: 'weft', countId, color: '', kg: '' }];
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
            <h2 style={{ marginBottom: '1.5rem' }}>Enter Yarn Requirements (KG)</h2>
            
            {/* Warp Section */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Warp</h3>
              <div style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Position</th>
                      <th style={{ width: '40%' }}>Count</th>
                      <th style={{ width: '20%' }}>Color</th>
                      <th style={{ width: '20%', textAlign: 'right' }}>Requirement (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.yarn_mappings.filter(m => m.type === 'warp').length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted-current)', padding: '1rem' }}>No warp yarns mapped. Go back to add warp specifications.</td>
                      </tr>
                    ) : (
                      formData.yarn_mappings.map((m, idx) => {
                        if (m.type !== 'warp') return null;
                        return (
                          <tr key={idx}>
                            <td style={{ textTransform: 'capitalize' }}>Warp {m.warpIdx + 1}</td>
                            <td>{formatYarn(yarnCounts.find(y => y.id === m.countId))}</td>
                            <td>{m.color || <span style={{ color: 'red' }}>Enter Color in prev step</span>}</td>
                            <td style={{ textAlign: 'right' }}>
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ maxWidth: '120px', marginLeft: 'auto' }}
                                value={m.kg}
                                onChange={e => {
                                  const updated = [...formData.yarn_mappings];
                                  updated[idx].kg = e.target.value;
                                  setFormData({...formData, yarn_mappings: updated});
                                }}
                              />
                            </td>
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
              <h3 style={{ fontSize: '1.1rem', color: 'var(--color-primary)', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Weft</h3>
              <div style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Position</th>
                      <th style={{ width: '40%' }}>Count</th>
                      <th style={{ width: '20%' }}>Color</th>
                      <th style={{ width: '20%', textAlign: 'right' }}>Requirement (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.yarn_mappings.filter(m => m.type === 'weft').length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted-current)', padding: '1rem' }}>No weft yarns mapped. Go back to add weft specifications.</td>
                      </tr>
                    ) : (
                      formData.yarn_mappings.map((m, idx) => {
                        if (m.type !== 'weft') return null;
                        return (
                          <tr key={idx}>
                            <td style={{ textTransform: 'capitalize' }}>Weft</td>
                            <td>{formatYarn(yarnCounts.find(y => y.id === m.countId))}</td>
                            <td>{m.color || <span style={{ color: 'red' }}>Enter Color in prev step</span>}</td>
                            <td style={{ textAlign: 'right' }}>
                              <input 
                                type="number" 
                                className="input-field" 
                                style={{ maxWidth: '120px', marginLeft: 'auto' }}
                                value={m.kg}
                                onChange={e => {
                                  const updated = [...formData.yarn_mappings];
                                  updated[idx].kg = e.target.value;
                                  setFormData({...formData, yarn_mappings: updated});
                                }}
                              />
                            </td>
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
                  padding: '1.5rem', 
                  marginBottom: '2rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)'
                }}
              >
                <div style={{ backgroundColor: '#10b981', color: 'white', borderRadius: '50%', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={28} strokeWidth={3} />
                </div>
                <div>
                  <h3 style={{ color: '#065f46', fontSize: '1.1rem', fontWeight: 'bold', margin: '0 0 0.25rem 0' }}>
                    Order Finalized & Submitted Successfully!
                  </h3>
                  <p style={{ color: '#047857', margin: 0, fontSize: '0.9rem' }}>
                    Order Number <strong style={{ textDecoration: 'underline' }}>{submittedOrderNumber}</strong> has been saved. You can print the order confirmation sheet below or navigate back.
                  </p>
                </div>
              </div>
            )}
            {/* Header / Invoice style info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--color-primary)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.75rem' }}>Ashok Textiles</h1>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>Order Confirmation Summary</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                  {submittedOrderNumber ? `Order No: ${submittedOrderNumber}` : (isEdit ? `Order No: ${formData.order_number}` : 'Order No: DRAFT')}
                </h2>
                <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted-current)', fontSize: '0.875rem' }}>
                  Date: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Order Details Table */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Order Details</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-current)', fontSize: '0.9rem' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', width: '25%', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Buyer</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', width: '25%', borderRight: '1px solid var(--border-current)' }}>{brands.find(b => b.id === formData.buyer_id)?.brand_name || '-'}</td>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', width: '25%', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Order Type</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', width: '25%' , textTransform: 'uppercase'}}>{formData.order_type || '-'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Design No / Name</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', borderRight: '1px solid var(--border-current)' }}>{formData.design_no || '-'} {formData.design_name ? `(${formData.design_name})` : ''}</td>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Season</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem' }}>{formData.season || '-'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Vendor</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', borderRight: '1px solid var(--border-current)' }}>{partners.find(p => p.id === formData.vendor_id)?.partner_name || '-'}</td>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Yarn Count (W X We)</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{getShortCountsString()}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Order Qty (Mtrs)</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', borderRight: '1px solid var(--border-current)' }}>{formData.total_quantity || '0'} Mtrs</td>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Production Qty (Mtrs)</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold' }}>{formData.technical_specs.production_quantity || '0'} Mtrs</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Order Reed / Pick</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', borderRight: '1px solid var(--border-current)' }}>{formData.technical_specs.order_reed || '-'} / {formData.technical_specs.order_pick || '-'}</td>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>On Loom Reed / Pick</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem' }}>{formData.technical_specs.on_loom_reed || '-'} / {formData.technical_specs.on_loom_pick || '-'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Finished Width / Order Width</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', borderRight: '1px solid var(--border-current)' }}>{formData.technical_specs.finished_width || '-'} / {formData.technical_specs.order_width || '-'}</td>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Weave Type / GSM</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem' }}>{formData.technical_specs.weave_type || '-'} / {formData.technical_specs.gsm || '-'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-current)' }}>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Order Category</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', color: '#7c3aed', borderRight: '1px solid var(--border-current)' }}>{formData.technical_specs.order_category || '-'}</td>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Merchandiser</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem' }}>{formData.merchandiser_name || '-'}</td>
                  </tr>
                  <tr>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>FOB Date</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem', borderRight: '1px solid var(--border-current)' }}>{formData.fob_date || '-'}</td>
                    <td className="spec-label" style={{ padding: '0.6rem 0.75rem', fontWeight: 'bold', backgroundColor: 'var(--surface-current)', borderRight: '1px solid var(--border-current)' }}>Dispatch Date</td>
                    <td className="spec-value" style={{ padding: '0.6rem 0.75rem' }}>{formData.dispatch_date || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Yarn Requirement Table */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Yarn Requirement Summary (Count & Color Wise)</h3>
              <div style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Position</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Yarn Description</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Color</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Requirement (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.yarn_mappings.map((m, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-current)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', textTransform: 'capitalize' }}>{m.type} {m.type === 'warp' ? (m.warpIdx + 1) : ''}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{formatYarn(yarnCounts.find(y => y.id === m.countId))}</td>
                        <td style={{ padding: '0.6rem 0.75rem' }}>{m.color}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(m.kg || 0).toFixed(2)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total Count Wise Summary Table */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Total Count Wise Summary</h3>
              <div style={{ border: '1px solid var(--border-current)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxWidth: '600px' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--surface-current)', borderBottom: '2px solid var(--border-current)' }}>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left' }}>Yarn Description</th>
                      <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right' }}>Total Quantity (KG)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      formData.yarn_mappings.reduce((acc, curr) => {
                        const count = formatYarn(yarnCounts.find(y => y.id === curr.countId));
                        acc[count] = (acc[count] || 0) + parseFloat(curr.kg || 0);
                        return acc;
                      }, {})
                    ).map(([count, total], i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-current)' }}>
                        <td style={{ padding: '0.6rem 0.75rem' }}><span style={{ fontWeight: '500' }}>{count}</span></td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-primary)' }}>{total.toFixed(2)} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Design Image Upload Section */}
            <div style={{ marginBottom: '2rem' }} className="no-print">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-primary)', borderBottom: '1px solid var(--border-current)', paddingBottom: '0.25rem' }}>Fabric Design Image</h3>
              <div 
                style={{ 
                  border: '2px dashed var(--border-current)', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: '2rem', 
                  textAlign: 'center', 
                  backgroundColor: 'var(--surface-current)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {compressionLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                    <div className="spin" style={{ width: '40px', height: '40px', border: '4px solid var(--color-primary-light)', borderTopColor: 'var(--color-primary)', borderRadius: '50%' }}></div>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted-current)', fontWeight: '600' }}>Compressing image client-side...</span>
                  </div>
                ) : imagePreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ position: 'relative', width: '200px', height: '200px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-current)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
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
                          top: '8px',
                          right: '8px',
                          backgroundColor: 'rgba(239, 68, 68, 0.9)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.9)'}
                        title="Remove Image"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    {originalSize > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', color: 'var(--text-muted-current)' }}>
                        <div>Original Size: <strong>{originalSize} KB</strong></div>
                        <div>Compressed WebP Size: <strong style={{ color: '#16a34a' }}>{compressedSize} KB</strong> ({Math.round((1 - compressedSize / originalSize) * 100)}% saved!)</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '1.5rem 0' }}>
                    <div style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.25rem' }}>
                      <Upload size={24} />
                    </div>
                    <div>
                      <span style={{ fontWeight: '700', color: 'var(--color-primary)' }}>Click to upload</span> or drag and drop
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-current)' }}>Supports PNG, JPG, JPEG (Compressed to lightweight WebP automatically)</span>
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

            {/* Signature section for print layout */}
            <div style={{ display: 'none', justifyContent: 'space-between', marginTop: '4rem', paddingTop: '2rem' }} className="print-only-block">
              <style>{`
                @media print {
                  .print-only-block {
                    display: flex !important;
                  }
                }
              `}</style>
              <div style={{ borderTop: '1px solid black', width: '250px', textAlign: 'center', paddingTop: '0.5rem' }}>
                Prepared By
                <div style={{ fontWeight: 'bold', marginTop: '0.5rem', fontSize: '10pt', textTransform: 'uppercase' }}>
                  {profile?.full_name || formData.merchandiser_name || 'Logged-in Merchandiser'}
                </div>
              </div>
              <div style={{ borderTop: '1px solid black', width: '250px', textAlign: 'center', paddingTop: '0.5rem' }}>
                Authorized Signatory
              </div>
            </div>

            {/* Print & Submissions control */}
            <style>{`
              @media print {
                /* Hide sidebar, navigation elements, buttons, and status dots */
                .no-print,
                .no-print *,
                button,
                .btn,
                aside,
                header {
                  display: none !important;
                }
                
                @page {
                  size: portrait;
                  margin: 1.5cm;
                }
                
                /* Reset containers for multi-page height flow and zero spacing margins */
                body, html, #root, .app-layout-container, .main-content-wrapper, main, .main-content, .create-order-container {
                  background: white !important;
                  color: black !important;
                  height: auto !important;
                  min-height: auto !important;
                  overflow: visible !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  display: block !important;
                  width: 100% !important;
                  max-width: 100% !important;
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
                  height: auto !important;
                  overflow: visible !important;
                }

                /* Structured Bordered Tables for Print */
                table {
                  width: 100% !important;
                  border-collapse: collapse !important;
                  margin-top: 1rem !important;
                  margin-bottom: 2rem !important;
                  page-break-inside: avoid !important;
                }
                
                th, td {
                  border: 1px solid #000000 !important; /* solid black borders for clear layout */
                  padding: 8px 12px !important;
                  font-size: 11pt !important;
                  color: #000000 !important;
                  background-color: transparent !important;
                }
                
                /* Styled headers and label cells in print */
                th,
                .spec-label {
                  background-color: #f3f4f6 !important; /* light grey backgrounds */
                  font-weight: bold !important;
                  color: #000000 !important;
                }

                h1, h2, h3, h4 {
                  color: #800000 !important; /* Keep brand maroon color */
                  page-break-after: avoid !important;
                }
                
                h3 {
                  border-bottom: 2px solid #800000 !important;
                  padding-bottom: 4px !important;
                }
              }
            `}</style>
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }} className="no-print">
              {submittedOrderNumber ? (
                <>
                  <button 
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-primary"
                    style={{ minWidth: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}
                  >
                    <Printer size={18} /> Print Confirmation
                  </button>
                  {!isEdit && (
                    <button 
                      type="button"
                      onClick={handleCreateAnotherOrder}
                      className="btn btn-secondary"
                      style={{ minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      <Plus size={18} /> Create Another Order
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => navigate(profile?.role === 'admin' ? '/admin/orders' : '/merchandiser/orders')}
                    className="btn btn-secondary"
                    style={{ minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
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
                    style={{ minWidth: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#e2e8f0', color: '#1e293b', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    <Printer size={18} /> Print Summary
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveDraft}
                    className="btn btn-secondary"
                    disabled={loading}
                    style={{ minWidth: '150px' }}
                  >
                    Save as Draft
                  </button>
                  <button 
                    onClick={handleSubmit} 
                    className="btn btn-primary" 
                    disabled={loading}
                    style={{ minWidth: '200px' }}
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
