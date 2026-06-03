export const mockOrders = [
  {
    id: 'ord_1001',
    buyer_name: 'Stark Industries Retail',
    merchandiser_id: 'usr_merch1',
    order_date: '2026-04-01',
    delivery_date: '2026-05-15',
    total_quantity: 5000,
    status: 'approved',
    items: [
      { id: 'item_1', fabric_spec: '100% Cotton Poplin 40s', quantity: 3000 },
      { id: 'item_2', fabric_spec: 'Poly-Cotton Blend 60/40', quantity: 2000 }
    ]
  },
  {
    id: 'ord_1002',
    buyer_name: 'Wayne Enterprises Apparel',
    merchandiser_id: 'usr_merch2',
    order_date: '2026-04-05',
    delivery_date: '2026-06-01',
    total_quantity: 10000,
    status: 'pending',
    items: [
      { id: 'item_3', fabric_spec: 'Linen 60s', quantity: 10000 }
    ]
  }
];

export const mockInventory = [
  { id: 'inv_g_1', item_type: 'greige_yarn', name: 'Cotton 40s Greige', quantity: 15000, unit: 'kg', location: 'Warehouse A' },
  { id: 'inv_g_2', item_type: 'greige_yarn', name: 'Polyester 150D', quantity: 8000, unit: 'kg', location: 'Warehouse A' },
  { id: 'inv_d_1', item_type: 'dyed_yarn', name: 'Cotton 40s - Navy Blue', quantity: 2000, unit: 'kg', location: 'Warehouse B' },
  { id: 'inv_d_2', item_type: 'dyed_yarn', name: 'Cotton 40s - Maroon', quantity: 5000, unit: 'kg', location: 'Warehouse B' },
];

export const mockForms = [
  { id: 'form_dye_1', order_id: 'ord_1001', form_type: 'dyeing', status: 'approved', details: { color: 'Navy Blue', quantity: 3000, yarn_spec: 'Cotton 40s' } },
  { id: 'form_dye_2', order_id: 'ord_1001', form_type: 'dyeing', status: 'pending', details: { color: 'Maroon', quantity: 2000, yarn_spec: 'Poly-Cotton' } },
  { id: 'form_warp_1', order_id: 'ord_1001', form_type: 'warping', status: 'pending', details: { ends: 4500, length: 10000, yarn_color: 'Navy Blue' } }
];

export const mockProductionJobs = [
  { id: 'job_dye_1', form_id: 'form_dye_1', job_type: 'dyeing', status: 'in_progress', vendor_name: 'ABC Dyeing Mill', qty_issued: 3000 },
  { id: 'job_weave_1', form_id: 'form_weave_1', job_type: 'weaving', status: 'completed', vendor_name: 'Inhouse Loom #4', qty_received: 2800 },
];
