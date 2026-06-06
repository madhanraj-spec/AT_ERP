const { createClient } = require('@supabase/supabase-client');

// Initialize supabase from env
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kbobayuhqigjpxxsnexn.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing VITE_SUPABASE_ANON_KEY env variable.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Fetching data...');
  try {
    const [
      dofRes,
      ordersRes,
      gydiRes,
      dyriRes,
      dydiRes,
      countsRes
    ] = await Promise.all([
      supabase
        .from('dyeing_order_forms')
        .select(`
          *,
          dyeing_unit:master_partners(partner_name)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, order_number, design_no, design_name'),
      supabase
        .from('greige_yarn_delivery_items')
        .select(`
          *,
          receipt:greige_yarn_delivery_receipts(dof_id)
        `),
      supabase
        .from('dyed_yarn_receipt_items')
        .select(`
          *,
          receipt:dyed_yarn_receipts(dof_id, dyrr_number, received_date, dc_number, vehicle_no, received_by, remarks),
          location:master_locations(location_name)
        `),
      supabase
        .from('dyed_yarn_delivery_items')
        .select(`
          *,
          delivery:dyed_yarn_deliveries(dydr_number, delivered_date, delivered_by, vehicle_no, remarks),
          location:master_locations(location_name)
        `),
      supabase
        .from('master_yarn_counts')
        .select('*')
    ]);

    if (dofRes.error) throw dofRes.error;
    if (ordersRes.error) throw ordersRes.error;
    if (gydiRes.error) throw gydiRes.error;
    if (dyriRes.error) throw dyriRes.error;
    if (dydiRes.error) throw dydiRes.error;
    if (countsRes.error) throw countsRes.error;

    console.log('All data fetched successfully.');
    console.log('DOFs count:', dofRes.data?.length);

    const allDofs = dofRes.data || [];
    const orders = ordersRes.data || [];
    const gydi = gydiRes.data || [];
    const dyri = dyriRes.data || [];
    const dydi = dydiRes.data || [];
    const counts = countsRes.data || [];

    const approvedDofs = allDofs.filter(
      d => d.status !== 'pending' && d.status !== 'rejected'
    );

    console.log('Approved DOFs count:', approvedDofs.length);

    const ordersMap = new Map(orders.map(o => [o.id, o]));
    const countsMap = new Map(counts.map(c => [c.id, c]));

    const records = approvedDofs.map(dof => {
      console.log('Processing DOF:', dof.dof_number);
      const linkedOrders = (dof.order_ids || [])
        .map(id => ordersMap.get(id))
        .filter(Boolean);

      const orderNumbers = Array.from(new Set(linkedOrders.map(o => o.order_number)));
      const designNos = Array.from(new Set(linkedOrders.map(o => o.design_no).filter(Boolean)));
      const designNames = Array.from(new Set(linkedOrders.map(o => o.design_name).filter(Boolean)));

      const formGydi = gydi.filter(item => item.receipt?.dof_id === dof.id);
      const formDyri = dyri.filter(item => item.receipt?.dof_id === dof.id);

      const formReceivedLots = new Set(formDyri.map(r => r.lot_number).filter(Boolean));
      const formDydi = dydi.filter(item => {
        const matchesOrder = dof.order_ids?.includes(item.order_id);
        if (!matchesOrder) return false;
        if (item.lot_number && formReceivedLots.has(item.lot_number)) {
          return true;
        }
        return (dof.yarn_allocations || []).some(
          alloc => alloc.countId === item.yarn_count_id && alloc.colour === item.colour
        );
      });

      const yarnKeys = new Set();
      (dof.yarn_allocations || []).forEach(a => yarnKeys.add(`${a.countId}||${a.colour}`));
      formGydi.forEach(i => yarnKeys.add(`${i.yarn_count_id}||${i.colour}`));
      formDyri.forEach(i => yarnKeys.add(`${i.yarn_count_id}||${i.colour}`));
      formDydi.forEach(i => yarnKeys.add(`${i.yarn_count_id}||${i.colour}`));

      let totalDofInventoryBalance = 0;
      const inventoryRows = Array.from(yarnKeys).map(key => {
        const [countId, colour] = key.split('||');
        
        const matchingGydi = formGydi.filter(i => i.yarn_count_id === countId && i.colour === colour);
        const matchingDyri = formDyri.filter(i => i.yarn_count_id === countId && i.colour === colour);
        const matchingDydi = formDydi.filter(i => i.yarn_count_id === countId && i.colour === colour);

        const greigeSent = matchingGydi.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);
        const dyedReceived = matchingDyri.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);
        const dyedDelivered = matchingDydi.reduce((s, i) => s + parseFloat(i.quantity_kg || 0), 0);
        const balance = dyedReceived - dyedDelivered;

        totalDofInventoryBalance += balance;

        const locationBalances = {};
        matchingDyri.forEach(i => {
          const locName = i.location?.location_name || '—';
          if (!locationBalances[locName]) locationBalances[locName] = { received: 0, delivered: 0 };
          locationBalances[locName].received += parseFloat(i.quantity_kg || 0);
        });
        matchingDydi.forEach(i => {
          const locName = i.location?.location_name || '—';
          if (!locationBalances[locName]) locationBalances[locName] = { received: 0, delivered: 0 };
          locationBalances[locName].delivered += parseFloat(i.quantity_kg || 0);
        });

        const activeLocations = Object.entries(locationBalances)
          .filter(([_, qty]) => (qty.received - qty.delivered) > 0.01)
          .map(([locName, _]) => locName);

        const locationDisplay = activeLocations.length > 0 
          ? activeLocations.join(', ') 
          : (Object.keys(locationBalances).join(', ') || '—');

        return {
          countId,
          colour,
          greigeSent,
          dyedReceived,
          dyedDelivered,
          balance,
          locationDisplay
        };
      });

      const dyrrGroups = {};
      formDyri.forEach(item => {
        const receipt = item.receipt;
        if (!receipt) return;
        if (!dyrrGroups[receipt.dyrr_number]) {
          dyrrGroups[receipt.dyrr_number] = {
            dyrr_number: receipt.dyrr_number,
            received_date: receipt.received_date,
            received_by: receipt.received_by || '—',
            vehicle_no: receipt.vehicle_no || '—',
            remarks: receipt.remarks || '—',
            items: []
          };
        }
        dyrrGroups[receipt.dyrr_number].items.push({
          colour: item.colour,
          yarn_count_id: item.yarn_count_id,
          lot_number: item.lot_number || '—',
          location: item.location?.location_name || '—',
          quantity_kg: parseFloat(item.quantity_kg || 0)
        });
      });

      const dydrGroups = {};
      formDydi.forEach(item => {
        const delivery = item.delivery;
        if (!delivery) return;
        if (!dydrGroups[delivery.dydr_number]) {
          dydrGroups[delivery.dydr_number] = {
            dydr_number: delivery.dydr_number,
            delivered_date: delivery.delivered_date,
            delivered_by: delivery.delivered_by || '—',
            vehicle_no: delivery.vehicle_no || '—',
            remarks: delivery.remarks || '—',
            items: []
          };
        }
        dydrGroups[delivery.dydr_number].items.push({
          colour: item.colour,
          yarn_count_id: item.yarn_count_id,
          lot_number: item.lot_number || '—',
          location: item.location?.location_name || '—',
          quantity_kg: parseFloat(item.quantity_kg || 0)
        });
      });

      // Sort dates safely
      const dyrrList = Object.values(dyrrGroups).sort((a,b) => {
        const dateA = a.received_date || '';
        const dateB = b.received_date || '';
        return dateB.localeCompare(dateA);
      });

      const dydrList = Object.values(dydrGroups).sort((a,b) => {
        const dateA = a.delivered_date || '';
        const dateB = b.delivered_date || '';
        return dateB.localeCompare(dateA);
      });

      return {
        id: dof.id,
        dof_number: dof.dof_number,
        dyeing_unit_name: dof.dyeing_unit?.partner_name || '—',
        orderNumbers,
        designNos,
        designNames,
        inventoryRows,
        totalInventoryBalance: Math.max(0, totalDofInventoryBalance),
        dyrrList,
        dydrList
      };
    });

    console.log('Successfully processed records:', records.length);
    console.log('First record balance:', records[0]?.totalInventoryBalance);

  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();
