const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../src/pages/Orders/Management.jsx');
const destPath = path.join(__dirname, '../src/pages/DyedYarn/OrderStock.jsx');

console.log('Reading from:', srcPath);
let content = fs.readFileSync(srcPath, 'utf8');

// 1. Update imports
content = content.replace(
  "import OrderWarpingTab from './OrderWarpingTab';",
  "import OrderWarpingTab from '../Orders/OrderWarpingTab';"
);
content = content.replace(
  "import OrderSizingTab from './OrderSizingTab';",
  "import OrderSizingTab from '../Orders/OrderSizingTab';"
);
content = content.replace(
  "import OrderYarnUsageTab from './OrderYarnUsageTab';",
  "import OrderYarnUsageTab from '../Orders/OrderYarnUsageTab';"
);
content = content.replace(
  "import OrderWeavingTab from './OrderWeavingTab';",
  "import OrderWeavingTab from '../Orders/OrderWeavingTab';"
);
content = content.replace(
  "import DyedReceiptPrintModal from '../DyedYarn/DyedReceiptPrintModal';",
  "import DyedReceiptPrintModal from './DyedReceiptPrintModal';"
);

// 2. Change export default name to OrderStock
content = content.replace(
  "export default function OrdersManagement() {",
  "export default function OrderStock() {"
);

// 3. Remove edit/delete buttons in OrderCard
const cardActionsRegex = /<div className="order-card-actions">[\s\S]*?<\/div>\s*<\/div>/;
// Let's find exactly the order-card-actions block in OrderCard and replace it
const oldCardActions = `          <div className="order-card-actions">
            <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
               <button 
                onClick={() => navigate(\`\${basePath}/edit-order/\${order.id}\`)}
                className="btn-icon"
                title={order.status === 'draft' ? "Resume Order (Draft)" : "Edit Order / View Details"}
                style={{ color: order.status === 'draft' ? 'var(--color-primary)' : 'var(--text-muted-current)' }}
              >
                {order.status === 'draft' ? <Edit size={18} /> : <Eye size={18} />}
              </button>
              <button 
                onClick={onDelete}
                className="btn-icon"
                title="Delete Order"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={18} />
              </button>
            </div>
            <div style={{ color: 'var(--text-muted-current)', display: 'flex', alignItems: 'center' }}>
              {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </div>
          </div>`;

const newCardActions = `          <div className="order-card-actions">
            <div style={{ color: 'var(--text-muted-current)', display: 'flex', alignItems: 'center' }}>
              {isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
            </div>
          </div>`;

if (content.includes(oldCardActions)) {
  content = content.replace(oldCardActions, newCardActions);
  console.log('Successfully replaced OrderCard actions');
} else {
  console.error('Warning: could not find exact oldCardActions block. Trying a regex/fallback approach...');
}

// 4. Change back button, title, and remove create order button in header
const oldHeader = `      {/* Top Header Section */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button 
            onClick={() => navigate(basePath)} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--color-primary)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              cursor: 'pointer',
              padding: '0',
              marginBottom: '0.5rem'
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-current)', fontWeight: 'bold' }}>
            Orders Management
          </h1>
        </div>
        
        <Link 
          to={\`\${basePath}/create-order\`} 
          className="btn btn-primary" 
          style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', fontWeight: 'bold', padding: '0.625rem 1.25rem' }}
        >
          <Plus size={18} />
          New Order
        </Link>
      </div>`;

const newHeader = `      {/* Top Header Section */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <button 
            onClick={() => navigate('/dyed-yarn')} 
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--color-primary)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              fontSize: '0.875rem', 
              fontWeight: '600', 
              cursor: 'pointer',
              padding: '0',
              marginBottom: '0.5rem'
            }}
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
          <h1 style={{ fontSize: '1.5rem', margin: 0, color: 'var(--text-current)', fontWeight: 'bold' }}>
            Order Details
          </h1>
        </div>
      </div>`;

if (content.includes(oldHeader)) {
  content = content.replace(oldHeader, newHeader);
  console.log('Successfully replaced header section');
} else {
  console.error('Warning: could not find exact oldHeader block');
}

console.log('Writing to:', destPath);
fs.writeFileSync(destPath, content, 'utf8');
console.log('Done!');
