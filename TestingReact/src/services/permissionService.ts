/**
 * @file services/permissionService.ts
 * @description API service for managing Role-based permissions and User permissions
 * consuming UserManagementAPI via Next.js JWT proxy.
 */

export interface PermissionItem {
  module: string;
  permission: string;
  displayName: string;
  icon?: string;
  isAssigned: boolean;
}

export interface RolePermissionsData {
  roleId: string;
  roleName: string;
  permissions: PermissionItem[];
}

export interface SystemRoleItem {
  id: string;
  name: string;
  userCount?: number;
}

export interface UserPermissionsData {
  userId: string;
  userName: string;
  roles: string[];
  permissions: PermissionItem[];
}

export interface ModulePermissionGroup {
  module: string;
  permissions: PermissionItem[];
}

/** Human-friendly module metadata (English + Khmer names, category, icon) */
export interface ModuleMeta {
  key: string;
  nameEn: string;
  nameKm: string;
  category: "inventory" | "technical" | "sales" | "reports";
  categoryEn: string;
  categoryKm: string;
  descriptionEn: string;
  descriptionKm: string;
}

export const MODULE_METADATA: Record<string, ModuleMeta> = {
  ItemModelList: {
    key: "ItemModelList",
    nameEn: "Item Models Registry",
    nameKm: "បញ្ជីម៉ូឌែលទំនិញ/ឧបករណ៍",
    category: "inventory",
    categoryEn: "Inventory & Spare Parts",
    categoryKm: "ស្តុក និងគ្រឿងបន្លាស់",
    descriptionEn: "Equipment catalogue and received item registry management",
    descriptionKm: "គ្រប់គ្រងកាតាឡុកម៉ូឌែលឧបករណ៍ និងបញ្ជីទំនិញដែលបានទទួល",
  },
  SparePartList: {
    key: "SparePartList",
    nameEn: "Spare Parts Catalog",
    nameKm: "កាតាឡុកគ្រឿងបន្លាស់",
    category: "inventory",
    categoryEn: "Inventory & Spare Parts",
    categoryKm: "ស្តុក និងគ្រឿងបន្លាស់",
    descriptionEn: "Spare parts inventory, categories, types, brands, and stock balance",
    descriptionKm: "គ្រប់គ្រងគ្រឿងបន្លាស់ ប្រភេទ ម៉ាក និងចំនួនស្តុកដែលនៅសល់",
  },
  ReceiveItemList: {
    key: "ReceiveItemList",
    nameEn: "Receive Item Workflow",
    nameKm: "ការទទួលទំនិញជួសជុល",
    category: "technical",
    categoryEn: "Technical Operations",
    categoryKm: "ប្រតិបត្តិការបច្ចេកទេស",
    descriptionEn: "Intake and initial registration of equipment submitted for repair",
    descriptionKm: "ការទទួលឧបករណ៍ចូលដំបូង និងបង្កើតប័ណ្ណជួសជុល",
  },
  InspectItemList: {
    key: "InspectItemList",
    nameEn: "Inspect Item (Triage)",
    nameKm: "ការត្រួតពិនិត្យដំបូង (Triage)",
    category: "technical",
    categoryEn: "Technical Operations",
    categoryKm: "ប្រតិបត្តិការបច្ចេកទេស",
    descriptionEn: "Initial assessment, diagnosis notes, and triage queues",
    descriptionKm: "វាយតម្លៃដំបូង កត់ត្រារោគសញ្ញាខូច និងបែងចែកដំណាក់កាល",
  },
  InspectionList: {
    key: "InspectionList",
    nameEn: "Technical Inspection",
    nameKm: "ការពិនិត្យបច្ចេកទេសលម្អិត",
    category: "technical",
    categoryEn: "Technical Operations",
    categoryKm: "ប្រតិបត្តិការបច្ចេកទេស",
    descriptionEn: "Deep diagnostic inspection, parts recommendation, labor quotation",
    descriptionKm: "ការពិនិត្យលម្អិតបច្ចេកទេស ស្នើសុំគ្រឿងបន្លាស់ និងតម្លៃពលកម្ម",
  },
  AwaitCustomerList: {
    key: "AwaitCustomerList",
    nameEn: "Waiting Customer Confirm",
    nameKm: "រង់ចាំការយល់ព្រមពីអតិថិជន",
    category: "sales",
    categoryEn: "Customer & Sales",
    categoryKm: "អតិថិជន និងការលក់",
    descriptionEn: "Quotation approval follow-up and customer decision tracking",
    descriptionKm: "តាមដានសម្រង់តម្លៃ និងការសម្រេចចិត្តរបស់អតិថិជន",
  },
  AwaitSparePartList: {
    key: "AwaitSparePartList",
    nameEn: "Awaiting Spare Parts",
    nameKm: "រង់ចាំគ្រឿងបន្លាស់មកដល់",
    category: "inventory",
    categoryEn: "Inventory & Spare Parts",
    categoryKm: "ស្តុក និងគ្រឿងបន្លាស់",
    descriptionEn: "Tickets placed on hold pending external or internal parts delivery",
    descriptionKm: "ប័ណ្ណជួសជុលដែលផ្អាករង់ចាំការបញ្ជាទិញ ឬផ្គត់ផ្គង់គ្រឿងបន្លាស់",
  },
  SaleConfirmedList: {
    key: "SaleConfirmedList",
    nameEn: "Confirmed Repair Sales",
    nameKm: "ការលក់ជួសជុលបានបញ្ជាក់",
    category: "sales",
    categoryEn: "Customer & Sales",
    categoryKm: "អតិថិជន និងការលក់",
    descriptionEn: "Approved repairs queued for engineer assignment and execution",
    descriptionKm: "ការជួសជុលដែលអតិថិជនបានយល់ព្រម រង់ចាំវិស្វករដំណើរការ",
  },
  RepairItemList: {
    key: "RepairItemList",
    nameEn: "Repair Operations",
    nameKm: "ដំណើរការជួសជុលជាក់ស្តែង",
    category: "technical",
    categoryEn: "Technical Operations",
    categoryKm: "ប្រតិបត្តិការបច្ចេកទេស",
    descriptionEn: "Hands-on engineer repair work, part replacements, and progress logs",
    descriptionKm: "ការជួសជុលជាក់ស្តែងដោយជាង/វិស្វករ និងការផ្លាស់ប្តូរគ្រឿងបន្លាស់",
  },
  FinishItem: {
    key: "FinishItem",
    nameEn: "Finished Repairs",
    nameKm: "ការជួសជុលរួចរាល់ (QC/Pass)",
    category: "technical",
    categoryEn: "Technical Operations",
    categoryKm: "ប្រតិបត្តិការបច្ចេកទេស",
    descriptionEn: "Quality check completion, ready for customer pickup or delivery",
    descriptionKm: "ឆ្លងកាត់ការធ្វើតេស្តគុណភាពរួចរាល់ រង់ចាំប្រគល់ជូនអតិថិជន",
  },
  ThirdPartyList: {
    key: "ThirdPartyList",
    nameEn: "Third-Party Repairs",
    nameKm: "ជួសជុលដោយភាគីទី៣",
    category: "technical",
    categoryEn: "Technical Operations",
    categoryKm: "ប្រតិបត្តិការបច្ចេកទេស",
    descriptionEn: "External vendor and third-party outsource management",
    descriptionKm: "ការបញ្ជូនទៅជួសជុលនៅខាងក្រៅ ឬដៃគូសហការ",
  },
  CustomerReject: {
    key: "CustomerReject",
    nameEn: "Customer Rejected",
    nameKm: "អតិថិជនបដិសេធមិនជួសជុល",
    category: "sales",
    categoryEn: "Customer & Sales",
    categoryKm: "អតិថិជន និងការលក់",
    descriptionEn: "Jobs declined by customer, reassembly and return processing",
    descriptionKm: "ប័ណ្ណដែលអតិថិជនមិនព្រមជួសជុល រៀបចំប្រគល់ម៉ាស៊ីនត្រឡប់ទៅវិញ",
  },
  UnrepairList: {
    key: "UnrepairList",
    nameEn: "Unrepairable Equipment",
    nameKm: "ឧបករណ៍មិនអាចជួសជុលបាន",
    category: "technical",
    categoryEn: "Technical Operations",
    categoryKm: "ប្រតិបត្តិការបច្ចេកទេស",
    descriptionEn: "Equipment evaluated as beyond economical or technical repair",
    descriptionKm: "ឧបករណ៍ដែលខូចធ្ងន់ធ្ងរ មិនអាចជួសជុលបច្ចេកទេសបាន",
  },
  DailyReportPage: {
    key: "DailyReportPage",
    nameEn: "Daily Operations Report",
    nameKm: "របាយការណ៍ប្រតិបត្តិការប្រចាំថ្ងៃ",
    category: "reports",
    categoryEn: "Reports & Analytics",
    categoryKm: "របាយការណ៍ និងស្ថិតិ",
    descriptionEn: "Daily intake, completed repairs, pending tasks, and revenue",
    descriptionKm: "របាយការណ៍សរុបការទទួល ចំនួនជួសជុលរួច និងចំណូលប្រចាំថ្ងៃ",
  },
  MonthlyReportPage: {
    key: "MonthlyReportPage",
    nameEn: "Monthly Performance Report",
    nameKm: "របាយការណ៍លទ្ធផលប្រចាំខែ",
    category: "reports",
    categoryEn: "Reports & Analytics",
    categoryKm: "របាយការណ៍ និងស្ថិតិ",
    descriptionEn: "Comprehensive monthly performance and efficiency metrics",
    descriptionKm: "របាយការណ៍វាយតម្លៃប្រសិទ្ធភាព និងស្ថិតិទូទៅប្រចាំខែ",
  },
  CustomerReportPage: {
    key: "CustomerReportPage",
    nameEn: "Customer Analytics Report",
    nameKm: "របាយការណ៍វិភាគអតិថិជន",
    category: "reports",
    categoryEn: "Reports & Analytics",
    categoryKm: "របាយការណ៍ និងស្ថិតិ",
    descriptionEn: "Customer frequency, corporate contracts, and ticket volumes",
    descriptionKm: "របាយការណ៍អតិថិជន ចំនួនចូលជួសជុល និងកិច្ចសន្យាសេវាកម្ម",
  },
  HistoryRepairReport: {
    key: "HistoryRepairReport",
    nameEn: "Repair History Audit Report",
    nameKm: "របាយការណ៍ប្រវត្តិជួសជុល",
    category: "reports",
    categoryEn: "Reports & Analytics",
    categoryKm: "របាយការណ៍ និងស្ថិតិ",
    descriptionEn: "Auditable historical log of all tickets, parts, and technicians",
    descriptionKm: "ប្រវត្តិលម្អិតគ្រប់ប័ណ្ណជួសជុលពីអតីតកាល គ្រឿងបន្លាស់ និងអ្នកធ្វើ",
  },
  TechnicalServiceList: {
    key: "TechnicalServiceList",
    nameEn: "Technical Services & Matrix",
    nameKm: "សេវាកម្មបច្ចេកទេស និងតម្លៃពលកម្ម",
    category: "reports",
    categoryEn: "Reports & Analytics",
    categoryKm: "របាយការណ៍ និងស្ថិតិ",
    descriptionEn: "Standard repair service definitions, labor rate matrices",
    descriptionKm: "តារាងសេវាកម្មជួសជុលស្តង់ដារ និងតម្លៃពលកម្មបច្ចេកទេស",
  },
  EngineerReportList: {
    key: "EngineerReportList",
    nameEn: "Engineer KPI Report",
    nameKm: "របាយការណ៍វាយតម្លៃវិស្វករ (KPI)",
    category: "reports",
    categoryEn: "Reports & Analytics",
    categoryKm: "របាយការណ៍ និងស្ថិតិ",
    descriptionEn: "Technician throughput, turnaround time, repeat repair rate",
    descriptionKm: "ការវាស់ស្ទង់ផលិតភាព ល្បឿនជួសជុល និងអត្រាខូចដដែលៗរបស់ជាង",
  },
  SummaryReportPage: {
    key: "SummaryReportPage",
    nameEn: "Executive Summary Report",
    nameKm: "របាយការណ៍សង្ខេបប្រតិបត្តិ",
    category: "reports",
    categoryEn: "Reports & Analytics",
    categoryKm: "របាយការណ៍ និងស្ថិតិ",
    descriptionEn: "High-level summary of operations, stock velocity, and turnaround",
    descriptionKm: "របាយការណ៍សង្ខេបជារួមសម្រាប់ថ្នាក់ដឹកនាំ",
  },
};

function getAuthHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json", ...extra };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("jwt_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch list of all system roles from RoleManagement API
 */
export async function fetchRolesList(): Promise<SystemRoleItem[]> {
  const res = await fetch("/api/proxy/RoleManagement?service=jwt", {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status}`);
  const json = await res.json();
  const raw: Record<string, unknown>[] = (json.Data || (Array.isArray(json) ? json : [])) as Record<string, unknown>[];
  return raw.map((r: Record<string, unknown>) => ({
    id: String(r.id || r.Id || ""),
    name: String(r.name || r.Name || r.roleName || r.RoleName || ""),
    userCount: Number(r.userCount || r.UserCount || 0),
  }));
}

/**
 * Fetch all permissions for a specific role
 */
export async function fetchRolePermissions(roleId: string): Promise<RolePermissionsData> {
  const res = await fetch(`/api/proxy/PermissionManagement/roles/${encodeURIComponent(roleId)}/permissions?service=jwt`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch role permissions: ${res.status}`);
  const json = await res.json();
  const data = json.Data || json;
  const rawPerms: Record<string, unknown>[] = (data.Permissions || data.permissions || []) as Record<string, unknown>[];

  return {
    roleId: String(data.RoleId || data.roleId || roleId),
    roleName: String(data.RoleName || data.roleName || ""),
    permissions: rawPerms.map((p: Record<string, unknown>) => ({
      module: String(p.Module || p.module || ""),
      permission: String(p.Permission || p.permission || ""),
      displayName: String(p.DisplayName || p.displayName || ""),
      icon: String(p.Icon || p.icon || ""),
      isAssigned: Boolean(p.IsAssigned ?? p.isAssigned ?? false),
    })),
  };
}

/**
 * Save updated permissions list for a role
 */
export async function saveRolePermissions(
  roleId: string,
  permissions: string[]
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/proxy/PermissionManagement/roles/${encodeURIComponent(roleId)}/permissions?service=jwt`, {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      RoleId: roleId,
      Permissions: permissions,
    }),
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.Message || errorJson.message || `Failed to update permissions (${res.status})`);
  }

  const json = await res.json();
  return {
    success: true,
    message: json.Message || json.message || "Permissions updated successfully",
  };
}

/**
 * Fetch effective permissions for a user (aggregated from all assigned roles)
 */
export async function fetchUserPermissions(userId: string): Promise<UserPermissionsData> {
  const res = await fetch(`/api/proxy/PermissionManagement/users/${encodeURIComponent(userId)}/permissions?service=jwt`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch user permissions: ${res.status}`);
  const json = await res.json();
  const data = json.Data || json;
  const rawPerms: Record<string, unknown>[] = (data.Permissions || data.permissions || []) as Record<string, unknown>[];

  return {
    userId: String(data.UserId || data.userId || userId),
    userName: String(data.UserName || data.userName || ""),
    roles: (data.Roles || data.roles || []) as string[],
    permissions: rawPerms.map((p: Record<string, unknown>) => ({
      module: String(p.Module || p.module || ""),
      permission: String(p.Permission || p.permission || ""),
      displayName: String(p.DisplayName || p.displayName || ""),
      icon: String(p.Icon || p.icon || ""),
      isAssigned: Boolean(p.IsAssigned ?? p.isAssigned ?? true),
    })),
  };
}
