/**
 * @file mockData.ts
 * @description Fallback/offline mock datasets used by api.ts when the backend
 * is unreachable. All values are realistic placeholders for local development.
 *
 * ⚠️  Do NOT use these in production logic — they exist only as a last-resort
 * fallback inside each `catch` block of the API layer.
 */

import type { RepairServiceItem, SparePartItem, CustomerItem, ItemModel } from "./types";

export const MOCK_ITEM_MODELS: ItemModel[] = [
  { id: "im-1",  itemName: "1643I (Verify Brand/Model)",          serialNumber: "2TW04761",              itemType: "Printer" },
  { id: "im-2",  itemName: "2520W (Verify Brand/Model)",          serialNumber: "WMK04765",              itemType: "Printer" },
  { id: "im-3",  itemName: "4915XE (Verify Brand/Model)",         serialNumber: "5605473970",            itemType: "Printer" },
  { id: "im-4",  itemName: "528 UV/MG (Verify Brand/Type)",       serialNumber: "2022-02-22",            itemType: "Printer" },
  { id: "im-5",  itemName: "AR230410527 (Verify Brand/Model)",    serialNumber: "CAM985C202210001",      itemType: "Printer" },
  { id: "im-6",  itemName: "BANKNOTE Counter (Generic)",          serialNumber: "S/N CAM6900W2021112150104", itemType: "Printer" },
  { id: "im-7",  itemName: "BANKNOTE Counter (Vacuum Type)",      serialNumber: "*K20YW15040004TW5*",    itemType: "Printer" },
  { id: "im-8",  itemName: "Banknote Counter CAM-7200",           serialNumber: "Q29348",                itemType: "Generate" },
  { id: "im-9",  itemName: "Banknote Counter CAM-7200",           serialNumber: "CAM72002408250004",      itemType: "Bill Counter" },
  { id: "im-10", itemName: "BANKNOTE COUNTER CAM-VC650",         serialNumber: "Q87506",                itemType: "Generate" },
];

// ---------------------------------------------------------------------------
// Service Tickets
// ---------------------------------------------------------------------------
export const MOCK_SERVICE_TICKETS: RepairServiceItem[] = [
  {
    id: "item-01",
    reportNo: "20260807-1642",
    serviceDate: "2026-08-07T13:53:00",
    companyName: "សាលារៀន វត្ត ប៊ រ នា ធ ម",
    address: "Phnom Penh",
    phoneNumber: "012 345 678",
    itemId: "hp-m283",
    itemName: "HP Color LaserJet Pro MFP M283fdw",
    serialNumber: "CNBRSBK54H",
    serviceLocation: "CompanyService",
    status: "Item Recieved",
    statusId: 1,
    servicePriority: "NORMAL",
    repairByName: "Seng KimNeang",
  },
  {
    id: "item-02",
    reportNo: "20260807-1638",
    serviceDate: "2026-08-05T08:53:00",
    companyName: "ហាងឆា ម៉ីហ្វូហ៊្វូដ ភ្នំពេញ",
    address: "Toul Kork",
    phoneNumber: "098 765 432",
    itemId: "cm-1800",
    itemName: "CASHMAX Bill Counter CM-1800",
    serialNumber: "CM1880-3040",
    serviceLocation: "CompanyService",
    status: "Awaiting Customer Confirm",
    statusId: 3,
    servicePriority: "NORMAL",
    repairByName: "Seng KimNeang",
  },
  {
    id: "item-03",
    reportNo: "20260806-1633",
    serviceDate: "2026-08-06T17:06:00",
    companyName: "រដ្ឋាករទឹកស្យយ័តក្រុងភ្នំពេញ",
    address: "Daun Penh",
    phoneNumber: "023 888 999",
    itemId: "hp-m611",
    itemName: "HP LaserJet Enterprise M611",
    serialNumber: "CNBRP454HG",
    serviceLocation: "CompanyService",
    status: "Finished",
    statusId: 6,
    servicePriority: "HIGH",
    repairByName: "Seng KimNeang",
    customerRequest: "E0133-00020",
    inspection: "Error print jam paper(Fuser Fixing Film Assembly Paper Pickup Roller Tray2)",
    solution: "Replace (Fuser Fixing Film Assembly Paper Pickup Roller Tray2(Counter17155))",
    sparePartItems: [
      { id: "sp-1", sparePartId: "RM1-8809-000", itemName: "Fuser Fixing Film Assembly", useFor: "HP Pro400 M401 400 401", quantity: 1, condition: "Replace" },
      { id: "sp-2", sparePartId: "N/A", itemName: "Paper Pickup Roller Tray2", useFor: "HP Pro400,401", quantity: 1, condition: "Replace" },
    ],
  },
  {
    id: "item-04",
    reportNo: "20260803-1542",
    serviceDate: "2026-07-17T15:04:00",
    companyName: "ធនាគារ អេ អឹម ខេ",
    address: "Sen Sok",
    phoneNumber: "015 112 233",
    itemId: "bank-bplus",
    itemName: "Multi Banknote Sorter BPlus",
    serialNumber: "20C06314",
    serviceLocation: "CompanyService",
    status: "Awaiting Sparepart",
    statusId: 4,
    servicePriority: "NORMAL",
    repairByName: "Vun Navin",
  },
  {
    id: "item-05",
    reportNo: "20260810-1132",
    serviceDate: "2026-08-08T14:07:00",
    companyName: "Vattanac Bank ( សាខា កំពង់ចាម )",
    address: "Kampong Cham",
    phoneNumber: "042 999 888",
    itemId: "fuji-m285",
    itemName: "FUJI Xerox DocuPrint M285z",
    serialNumber: "603381",
    serviceLocation: "CompanyService",
    status: "Item Recieved",
    statusId: 1,
    servicePriority: "NORMAL",
    repairByName: "Vun Navin",
  },
];

// ---------------------------------------------------------------------------
// Spare Parts
// ---------------------------------------------------------------------------
export const MOCK_SPARE_PARTS: SparePartItem[] = [
  {
    id: "1",
    partNumber: "RM2-5405-000CN",
    serialNumber: "RM2-5405-000CN",
    itemName: "Rear door assembly (duplex)",
    useFor: "HP M428, HP 4103, M404, M405",
    pictureUrl: "https://pub-2f74151b72e54fa9a46399c2794ebbd2.r2.dev/spareparts/rear-door-duplex.jpg",
    quantity: 1,
    defaultPrice: 0.0,
    status: "CRITICAL",
  },
  {
    id: "2",
    partNumber: "RM2-2562-000CN",
    serialNumber: "RM2-2562-000CN",
    itemName: "Cartridge door assembly",
    useFor: "HP M428, M402, M404, M429",
    pictureUrl: "https://pub-2f74151b72e54fa9a46399c2794ebbd2.r2.dev/spareparts/cartridge-door.jpg",
    quantity: 0,
    defaultPrice: 0.0,
    status: "OUT OF STOCK",
  },
  {
    id: "3",
    partNumber: "RM2-7510-000CN",
    serialNumber: "RM2-7510-000CN",
    itemName: "Connecting PCA (duplex)",
    useFor: "HP M404, M402, M428, M405",
    pictureUrl: "https://pub-2f74151b72e54fa9a46399c2794ebbd2.r2.dev/spareparts/connecting-pca.jpg",
    quantity: 0,
    defaultPrice: 0.0,
    status: "OUT OF STOCK",
  },
  {
    id: "4",
    partNumber: "EC104665",
    serialNumber: "EC104665",
    itemName: "External IC Card Reader B",
    useFor: "FUJIFILM Apeos C2560 C3060",
    pictureUrl: "https://pub-2f74151b72e54fa9a46399c2794ebbd2.r2.dev/spareparts/card-reader.jpg",
    quantity: 1,
    defaultPrice: 0.0,
    status: "CRITICAL",
  },
];

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const MOCK_CUSTOMERS: CustomerItem[] = [
  { id: "1", companyName: "សាលារៀន វត្ត ប៊ រ នា ធ ម", contactName: "Chhunlay Y.", phoneNumber: "012 345 678", address: "Phnom Penh, Cambodia", customerType: "School", isActive: true },
  { id: "2", companyName: "ហាងឆា ម៉ីហ្វូហ៊្វូដ ភ្នំពេញ", contactName: "Sokha K.", phoneNumber: "098 765 432", address: "Toul Kork, Phnom Penh", customerType: "Restaurant", isActive: true },
  { id: "3", companyName: "រដ្ឋាករទឹកស្យយ័តក្រុងភ្នំពេញ", contactName: "Bora M.", phoneNumber: "023 888 999", address: "Daun Penh, Phnom Penh", customerType: "Ministry", isActive: true },
  { id: "4", companyName: "ធនាគារ អេ អឹម ខេ", contactName: "Nara T.", phoneNumber: "015 112 233", address: "Sen Sok, Phnom Penh", customerType: "Bank", isActive: true },
  { id: "5", companyName: "Vattanac Bank", contactName: "Kosal V.", phoneNumber: "042 999 888", address: "Kampong Cham Province", customerType: "Bank", isActive: true },
];
