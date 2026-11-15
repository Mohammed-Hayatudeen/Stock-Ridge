IMPORTANT! : (THIS ARE INSTRUCTIONS THAT MOST BE FOLLOWED BEFORE ANY WORK IS DONE ON ANY! SO BE STRICTLY ADVISED!.) =>
{
  NOTES EVERY MODULE BELOW HAS A NAMED FILE AT THE ROOT LEVEL OF THE PROJECT :
 ( Here are the ideal 6 Core Modules based on relations and scope)=>
{
1. Operations & Point of Sale (The "Front Office" Module)
Scope: Everything related to directly serving a customer, moving goods out the door, and capturing money at the counter.

POS & Cart (pos.js): The main cashier interface.
Sales Ledger (sales.js): Real-time sales logging, filtering, and printing receipts.
Change Owed / Credit (change-owed.js, instalments.js): Handling split payments, IOUs, and customer credit lines.
Returns & After-Sales (returns.js, afterSales.js): Refund workflows and warranty management.
Till Management (till.js): Shift opening/closing, initial floats, and cashier handovers.
2. Inventory & Supply Chain (The "Warehouse" Module)
Scope: Physical goods moving into the business, cataloging, moving between branches, and auditing.

Catalogue / Products (products.js, catalog.js): Master data management (unit ladders, variants, base margins, selling groups).
Stock & Batches (stock.js): Real-time on-hand quantities, expiry tracking, serial numbers, and reorder levels.
Purchase Orders & Suppliers (purchase-orders.js, suppliers.js): Interfacing with vendors and forecasting.
Internal Transfers (transfers.js): Moving goods between branches (e.g., from HQ warehouse to Karu branch).
Stocktake (stocktake.js): Physical inventory counts and shrinkage adjustments.
3. Accounting & Finance (The "Back Office" Module)
Scope: Deep financial tracking, ledgers, and profit calculations removed from daily operations.

General Ledger (accounting.js): Tracking revenue, cost of goods sold (COGS), chart of accounts, and gross margins.
Expenses (expenses.js, finance.js): Operational costs, salaries, fuel, and branch-specific overhead logging.
Reporting (reports.js, dashboard.js): Analytical engines compiling tax, profit/loss, and end-of-day snapshots across branches.
4. Admin, HR & Compliance (The "Governance" Module)
Scope: Internal rules, staff management, identity, and statutory requirements.

Identity & Roles (users.js, admin.js, auth.js): Managing credentials (the PBKDF2 PINs), roles (Owner, Manager, Staff), and branch assignments.
Attendance (attendance.js): Clock-in/clock-out tracking for payroll.
Compliance (compliance.js): Managing regulatory rules (e.g., restricted pharmaceutical registrations, NAFDAC IDs, SONCAP, greenbook requirements).
5. Fleet & Delivery (The "Logistics" Module)
Scope: Dedicated to off-premise sales, routing, and vehicle tracking.

Fleet Management (fleet.js): Vehicle registration and maintenance logging.
Deliveries / Dispatch (deliveries.js, dispatch.js): Assigning sales to drivers, tracking waybills, and recording proof-of-delivery drops.
6. Platform & Sync (The "Infrastructure" Module)
Scope: The localized data persistence layer entirely abstracted away from business logic.

Data Syncing (sync.js, sync routes): The heavily optimized SQLite delta synchronization and Turso batch polling.
Device Store / State (store.js, store-native.js, state.js): Electron/Android IPC bridges, offline storage mirroring, and PWA IndexedDB wrappers.
}

WORK FLOW :(FOLLOW THIS SCRITLY)=>
{
1 FIRST IDENTIFY ALL THE MODULES THEN UNDERSTAND THE THE PROMPT INPUT,
2 THEN MAP THE PROMPT INPUT TO THE RELATED MODULE IT IS RELATED TO 
3 THEN READ AND UNDERSTAND THE MODULES THE INPUT IS MAPPED TOO
4 THEN CHECK IF SOMETHING HAS BEEN DONE ON THE SAME ISSUE SO AS TO KNOW WHAT WAS DONE 
5 IF SOME THING RELATED HAS BEEN DONE THEN GO THROUGH IT TO MAKE SURE TO KNOW WHAT WAS DONE WHAT IT CHANGE HOW IT CHANGE IT WHY IT CHANGE IT WHAT WOULD CHANGE IF IT WAS CHANGE FROM HOW T IS WHAT AND WERE WAS AFFECTED AND WERE AND WHAT WOULD BREAK IF IT WAS CHANGE AND WHAT CHANGE IS THE MOST DEPENDANT BY WHAT WOULD BREAK IF ALTERED AND WHY THEN THE SECOND MOST DEPENDANT AND SO ON
6 THEN FROM THE NEW INPUT DETERMINE IF THE PREVIOUS OUT PUT THAT CAME AS A RESULT OF THE FIX FROM THE PREVIOUSE INPUT ACTUALLY WORKED AND HOW DID IT WORK AND WHERE DID IT WORK AND WHAT DID NOT WORK AND ALL RELATED DEPENDENT CODES AND FUNCTIONS WITHIN THE MODULES AND OUTSIDE THE MODULE ALL CLEARLY MAPPED OUT
7 THEN GO ONLINE TO GATHER ALL MOST RELEVANT INFORMATIONS ON THE CURRENT ISSUE OF INTEREST STARTING FROM THE MOST RECENT IN 2026 THEN F NOT BACK LIKE 2025 OR 2024 AND PROPERLY DOCUMENT IT INTO THE SELECTED MODULE
8 WITH ALL THE IMFORMATION PROPERLY UNDERSTOOD AND PROPERLY DOCUMENTED THEN BE ADVISED WITH THE INFORMATION ALONG THE GENRAL AGENT KNOWLEDGE FIX THE CURRENT HIGHLIGHTED ISSUE WITHOUT BREAKING WHAT WAS FIXED TO AVOID ERROR FROM POOR CONTEXT WINDOW FOR A PROGRESSIVE STABLE PRODUCTION PROCESS OF DEVELOPING THE STOCKRIDGE APP
9 AFTER THE WHOLE FIX IN DETAILS DOCUMENT ALL THE REQUIRED INFORMATION DURING THE WHOLE PROCESS SO AS TO KEEP THE CYCLE GOING STRONGER AND BETTER
10 AND ALWAY START EVERY REPONSE TO A PROPMT INPUT WITH <I> SO FOR ME TO NOW THE PROCESS HAS BEGAN AND END WITH <I/> SO I KNOW THAT THE PROCESS HAS PROPERLY ENDED WITH ALL THE DETAILED WELL PLACED AND FOLLOWED
}

}
