# ERP Project Map

This document tracks all modules, features, and key files in the ERP application. Use this reference to specify target features during development.

```
src/
├── App.jsx                  # Main routing, role authentication checks
├── main.jsx                 # Entry point
├── index.css                # Global styling tokens
├── contexts/
│   └── AuthContext.jsx      # User roles (Admin, Merchandiser, Production, Quality, Yarn)
├── components/
│   ├── layout/
│   │   ├── AppLayout.jsx    # General dashboard wrapper layout
│   │   └── Sidebar.jsx      # Role-based sidebar menu
│   └── DYDRDetail.jsx       # Shared detail view for Dyed Yarn Delivery/Receipt
├── pages/
│   ├── Dashboard.jsx        # General welcome dashboard
│   ├── Login.jsx            # User login screen
│   ├── Admin/
│   │   └── Approvals.jsx    # Approvals & WhatsApp approval status
│   ├── GreigeYarn/          # Greige Yarn Module
│   │   ├── Dashboard.jsx
│   │   ├── StockManagement.jsx
│   │   ├── ReceiptForm.jsx
│   │   ├── ReceiptsList.jsx
│   │   ├── NewDelivery.jsx
│   │   ├── DeliveriesList.jsx
│   │   ├── DeliverYarn.jsx
│   │   └── MovementTracking.jsx
│   ├── DyedYarn/            # Dyed Yarn Module
│   │   ├── Dashboard.jsx
│   │   ├── StockInventory.jsx
│   │   ├── ReceiveYarn.jsx
│   │   ├── DeliverYarn.jsx
│   │   ├── OrderStock.jsx
│   │   └── MovementLog.jsx
│   ├── Merchandiser/        # Merchandising Module
│   │   ├── Dashboard.jsx
│   │   ├── CreateOrder.jsx
│   │   ├── CreateDyeingForm.jsx
│   │   ├── DyeingFormsList.jsx
│   │   └── DyeingFormView.jsx
│   ├── Production/          # Production Module (Warping, Sizing, Weaving)
│   │   ├── Board.jsx
│   │   ├── CreateWarpingOrderForm.jsx
│   │   ├── WarpingOrderForms.jsx
│   │   ├── WeavingOrderForms.jsx
│   │   ├── SizingOrderForms.jsx
│   │   ├── FabricInput.jsx  # Loom-wise actual output entry
│   │   └── WarpingSizing.jsx
│   ├── Inspection/          # Quality Control & Inspections
│   │   ├── FourPointInspection.jsx
│   │   ├── UnwashedInspection.jsx
│   │   └── WashedInspection.jsx
│   ├── Orders/              # Central Order Status Tracking
│   │   ├── Management.jsx   # Master order tracker screen
│   │   ├── OrderYarnUsageTab.jsx
│   │   ├── OrderWarpingTab.jsx
│   │   ├── OrderSizingTab.jsx
│   │   └── OrderWeavingTab.jsx
│   └── Masters/             # System Param Masters
│       ├── Dashboard.jsx
│       └── MasterDetail.jsx
```

---

## 🛠️ Feature Matrix Reference

### 1. Greige Yarn
* **Stock**: Summary by count/type.
* **Receipts**: Inbound raw yarn entry + printable voucher.
* **Deliveries**: Sending raw yarn to dyeing mills.
* **Tracking**: Ledger showing in/out yarn movements.

### 2. Dyed Yarn
* **Receipts**: Inbound dyed yarn entry + color check.
* **Deliveries**: Supplying dyed yarn to production departments.
* **Inventory**: Stock count status tracking.

### 3. Merchandiser
* **Main Orders**: Client target info.
* **Dyeing Programs**: Specific recipe plans requiring admin approval.

### 4. Production Planning
* **Warping**: Planning warp setup & yarn count requirements.
* **Sizing**: Sizing parameters, set length, pick plan.
* **Weaving**: Assigning looms, defining weave specifications.
* **Fabric Input**: Registering actual output yards and piece rates.

### 5. Quality Control
* **Four-Point Inspection**: Interactive point penalty tracker per piece.
* **Washed/Unwashed Checks**: Shrinkage tolerances, GSM verification.
