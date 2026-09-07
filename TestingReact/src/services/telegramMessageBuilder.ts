/**
 * @file services/telegramMessageBuilder.ts
 * @description 100% Authentic Telegram HTML Notification Message Builder matching the old system.
 */

export interface SparePartLine {
  itemName: string;
  quantity: number;
  condition?: string;
  remarks?: string;
}

export interface TicketNotificationData {
  reportNo: string;
  companyName: string;
  address?: string;
  contactPerson?: string;
  phoneNumber?: string;
  serviceDate?: string;
  serviceLocation?: string;
  hasContract?: boolean | string;
  itemName: string;
  serialNumber: string;
  serviceType?: string;
  customerRequest?: string;
  inspection?: string;
  solution?: string;
  inspectByName?: string;
  approvedByName?: string;
  performedByName?: string;
  receivedByName?: string;
  spareParts?: SparePartLine[];
}

export function buildSparePartsSection(parts?: SparePartLine[]): string {
  if (!parts || parts.length === 0) return "";
  const lines = parts.map((sp) => {
    const cond = sp.condition ? ` (${sp.condition})` : "";
    const rawRem = typeof sp.remarks === "string" ? sp.remarks.trim() : "";
    const rem = rawRem && rawRem !== "-" ? `\n  Remarks: ${rawRem}` : "";
    return `- ${sp.itemName || "Unknown Item"} x${sp.quantity}${cond}${rem}`;
  });
  return `\n\n<b>គ្រឿងបន្លាស់ត្រូវការ:</b>\n${lines.join("\n")}`;
}

/**
 * Build 100% exact Telegram message text matching the old system
 */
export function buildTelegramMessage(
  topicKey: string,
  data: TicketNotificationData,
  isEdit = false
): string {
  const spareSection = buildSparePartsSection(data.spareParts);

  switch (topicKey) {
    case "ItemReceived": { // 📦 ម៉ាស៊ីនចូល (Topic 2)
      return `🔧 <b>បានទទួលម៉ាស៊ីនចូល</b>\n\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n\n` +
        `ស្ថាប័ន: ${data.companyName}\n\n` +
        `អាសយដ្ឋាន: ${data.address || "-"}\n\n` +
        `ឈ្មោះទំនាក់ទំនង: ${data.contactPerson || "-"}\n\n` +
        `លេខទូរស័ព្ទ: ${data.phoneNumber || "-"}\n\n` +
        `កាលបរិច្ឆេទទទួល: ${data.serviceDate || "-"}\n\n` +
        `ទីតាំងជួសជុល: ${data.serviceLocation || "OnSite"}\n\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n\n` +
        `SerialNumber: ${data.serialNumber}\n\n` +
        `សំណើពីអតិថិជន: ${data.customerRequest || "No"}\n\n` +
        `ឈ្មោះអ្នកទទួល: ${data.receivedByName || data.performedByName || "Staff"}`;
    }

    case "Inspecting": // 🔍 ម៉ាស៊ីនកំពុងវិនិច្ឆ័យ (Topic 24)
      return `🔍 <b>ម៉ាស៊ីនកំពុងវិនិច្ឆ័យ</b>\n\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n\n` +
        `ស្ថាប័ន: ${data.companyName}\n\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n\n` +
        `លេខស៊េរី: ${data.serialNumber}`;

    case "Inspection": { // ✅ វិនិច្ឆ័យរួចរាល់ (Topic 4)
      const serviceType = data.serviceType?.toLowerCase().includes("charge") || data.serviceType?.includes("គិតលុយ")
        ? "ជួសជុលគិតលុយ"
        : (data.serviceType || "ឥតគិតថ្លៃ");

      return `✅ <b>វិនិច្ឆ័យរួចរាល់</b>\n\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n\n` +
        `ស្ថាប័ន: ${data.companyName}\n\n` +
        `ទីតាំងជួសជុល: ${data.serviceLocation || "OnSite"}\n\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n\n` +
        `SerialNumber: ${data.serialNumber}\n\n` +
        `ប្រភេទសេវាកម្ម: ${serviceType}\n\n` +
        `ឈ្មោះអ្នកវិនិច្ឆ័យ: ${data.inspectByName || data.performedByName || "Staff"}` +
        spareSection;
    }

    case "AwaitingSparepart": // 📦 បានបញ្ជូនមកផ្នែកស្តុក (Topic 20)
      return `📦 <b>បានបញ្ជូនមកផ្នែកស្តុក</b>\n\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n\n` +
        `ស្ថាប័ន: ${data.companyName}\n\n` +
        `ទីតាំងជួសជុល: ${data.serviceLocation || "CompanyService"}\n\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n\n` +
        `ប្រភេទសេវាកម្ម: ${data.serviceType || "Charge"}\n\n` +
        `SerialNumber: ${data.serialNumber}\n\n` +
        `សំណើពីអតិថិជន: ${data.customerRequest || "-"}\n\n` +
        `វិនិច្ឆ័យ: ${data.inspection || "-"}\n\n` +
        `ដំណោះស្រាយ: ${data.solution || "-"}\n\n` +
        `ឈ្មោះអ្នកវិនិច្ឆ័យ: ${data.inspectByName || "Staff"}\n\n` +
        `ឈ្មោះអ្នកបញ្ជូន: ${data.performedByName || "Staff"}` +
        spareSection;

    case "AwaitingCustomerConfirm": // 📞 បានបញ្ជូនមកផ្នែកទីផ្សារ (Topic 16)
      return `📞 <b>បានបញ្ជូនមកផ្នែកទីផ្សារ</b>\n\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n\n` +
        `ស្ថាប័ន: ${data.companyName}\n\n` +
        `ទីតាំងជួសជុល: ${data.serviceLocation || "CompanyService"}\n\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n\n` +
        `SerialNumber: ${data.serialNumber}\n\n` +
        `ប្រភេទសេវាកម្ម: ${data.serviceType || "Charge"}\n\n` +
        `សំណើពីអតិថិជន: ${data.customerRequest || "No code"}\n\n` +
        `វិនិច្ឆ័យ: ${data.inspection || "-"}\n\n` +
        `ដំណោះស្រាយ: ${data.solution || "-"}\n\n` +
        `ឈ្មោះអ្នកវិនិច្ឆ័យ: ${data.inspectByName || "Staff"}\n\n` +
        `ឈ្មោះអ្នកបញ្ជូន: ${data.performedByName || "Staff"}` +
        spareSection;

    case "SaleConfirmed": // ✅ ផ្នែកទីផ្សារបានអនុម័ត Confirm (Topic 6)
      return `✅ <b>ផ្នែកទីផ្សារបានអនុម័ត Confirm</b>\n\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n\n` +
        `ស្ថាប័ន: ${data.companyName}\n\n` +
        `ទីតាំងជួសជុល: ${data.serviceLocation || "CompanyService"}\n\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n\n` +
        `SerialNumber: ${data.serialNumber}\n\n` +
        `ប្រភេទសេវាកម្ម: ${data.serviceType || "Charge"}\n\n` +
        `សំណើពីអតិថិជន: ${data.customerRequest || "-"}\n\n` +
        `វិនិច្ឆ័យ: ${data.inspection || "-"}\n\n` +
        `ដំណោះស្រាយ: ${data.solution || "-"}\n\n` +
        `ឈ្មោះអ្នកវិនិច្ឆ័យ: ${data.inspectByName || "Staff"}\n\n` +
        `ឈ្មោះអ្នកអនុម័ត: ${data.approvedByName || "Staff"}` +
        spareSection;

    case "SentSpareparts": // ✅ បានបញ្ជូនគ្រឿងបន្លាស់ទៅជាង (Topic 8)
      return `✅ <b>បានបញ្ជូនគ្រឿងបន្លាស់ទៅជាង</b>\n\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n\n` +
        `ស្ថាប័ន: ${data.companyName}\n\n` +
        `ទីតាំងជួសជុល: ${data.serviceLocation || "OnSite"}\n\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n\n` +
        `SerialNumber: ${data.serialNumber}\n\n` +
        `ប្រភេទសេវាកម្មជួសជុល: ${data.serviceType || "Charge"}\n\n` +
        `សំណើពីអតិថិជន: ${data.customerRequest || "-"}\n\n` +
        `វិនិច្ឆ័យ: ${data.inspection || "-"}\n\n` +
        `ដំណោះស្រាយ: ${data.solution || "-"}\n\n` +
        `ឈ្មោះអ្នកវិនិច្ឆ័យ: ${data.inspectByName || "Staff"}\n\n` +
        `ឈ្មោះអ្នកបញ្ជូន: ${data.performedByName || "Staff"}` +
        spareSection;

    case "CustomerRejected": // អតិថិជនមិនជួសជុល (Topic 22)
      return `<b>អតិថិជនមិនជួសជុល</b>`;

    case "Unrepairable": // ជួសជុលមិនបាន (Topic 18)
      return `<b>ជួសជុលមិនបាន</b>`;

    case "Finished": // ✅ ជួសជុលរួចរាល់ (Topic 10)
      return `✅ <b>ជួសជុលរួចរាល់</b>\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n` +
        `ស្ថាប័ន: ${data.companyName}\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n` +
        `SerialNumber: ${data.serialNumber}`;

    default:
      return `🔔 <b>${topicKey}</b>\n\n` +
        `លេខ Report: <b>${data.reportNo}</b>\n\n` +
        `ស្ថាប័ន: ${data.companyName}\n\n` +
        `ម៉ាស៊ីន: ${data.itemName}\n\n` +
        `SerialNumber: ${data.serialNumber}`;
  }
}

/**
 * Resolves status icon and text based on inventory quantity
 */
export function resolveStockStatus(quantity: number): { icon: string; text: string } {
  if (quantity <= 0) return { icon: "🔴", text: "OUT OF STOCK (អស់ស្តុក)" };
  if (quantity <= 2) return { icon: "🟠", text: "CRITICAL (ស្តុកជិតអស់)" };
  if (quantity <= 10) return { icon: "🟡", text: "LOW STOCK" };
  return { icon: "🟢", text: "IN STOCK" };
}

export interface SingleStockTelegramData {
  id?: string;
  itemName: string;
  partNumber?: string;
  useFor?: string;
  oldQuantity: number;
  quantityChange: number;
  newQuantity: number;
  performedBy?: string;
  remarks?: string;
  reportNo?: string;
  companyName?: string;
}

/**
 * 🟢 Stock In Telegram Template (100% Exact match to old system)
 */
export function buildStockInTelegramMessage(data: SingleStockTelegramData): string {
  const status = resolveStockStatus(data.newQuantity);
  const partNo = data.partNumber || "N/A";
  const user = data.performedBy || "System";
  const remarks = data.remarks || `Direct quantity edit: ${data.itemName}`;

  let referenceLines = "";
  if (data.reportNo) referenceLines += `🧾 Report No: ${data.reportNo}\n`;
  if (data.companyName) referenceLines += `🏢 Company: ${data.companyName}\n`;

  return (
    `🟢 <b>STOCK IN</b>\n` +
    `📦 <b>${data.itemName}</b>\n` +
    `Part No: ${partNo}\n` +
    `━━━━━━━━━━━━━━\n` +
    `TRANSACTION\n` +
    `Before: ${data.oldQuantity}\n` +
    `Change: +${data.quantityChange} (Stock In)\n` +
    `━━━━━━━━━━━━━━\n` +
    `Balance: ${data.newQuantity}\n` +
    `Status: ${status.icon} ${status.text}\n` +
    (referenceLines ? `${referenceLines}` : "") +
    `━━━━━━━━━━━━━━\n` +
    `👤 ${user}\n` +
    `📝 ${remarks}`
  );
}

/**
 * 🔴 Stock Out Telegram Template (100% Exact match to old system)
 */
export function buildStockOutTelegramMessage(data: SingleStockTelegramData): string {
  const status = resolveStockStatus(data.newQuantity);
  const partNo = data.partNumber || "N/A";
  const useFor = data.useFor || "N/A";
  const user = data.performedBy || "System";
  const idStr = data.id ? `unique id ${data.id}\n` : "";

  let referenceLines = "";
  if (data.reportNo) referenceLines += `🧾 Report No: ${data.reportNo}\n`;
  if (data.companyName) referenceLines += `🏢 Company: ${data.companyName}\n`;

  const noteLine = data.remarks ? `📝 Note: ${data.remarks}\n` : "";

  return (
    `🔴 <b>STOCK OUT</b>\n` +
    idStr +
    `📦 Item: <b>${data.itemName}</b>\n` +
    `Part No: ${partNo}\n` +
    `Use For: ${useFor}\n` +
    `TRANSACTION\n` +
    `➖ Quantity Out (បានកាត់ចេញប្រព័ន្ធ): ${Math.abs(data.quantityChange)}\n` +
    `Stock Balanced (នៅសល់): ${data.oldQuantity} → ${data.newQuantity}\n` +
    `⚠️ Status: ${status.icon} ${status.text}\n` +
    (referenceLines ? `${referenceLines}` : "") +
    `👤 By: ${user}\n` +
    noteLine +
    `━━━━━━━━━━━━━━`
  );
}

export interface GroupedStockInItem {
  itemName: string;
  partNumber?: string;
  quantity: number;
  oldQuantity: number;
  newQuantity: number;
}

/**
 * 🟢 Grouped Stock In Telegram Template (When restoring/removing parts from repair orders)
 */
export function buildGroupedStockInTelegramMessage(
  reportNo: string,
  companyName: string,
  items: GroupedStockInItem[],
  performedBy?: string
): string {
  const user = performedBy || "System";
  let referenceLines = "";
  if (reportNo) referenceLines += ` Report No: ${reportNo}\n`;
  if (companyName) referenceLines += ` Company: ${companyName}\n`;

  const itemLines = items
    .map((it, idx) => {
      const partNo = it.partNumber || "N/A";
      return `${idx + 1}. ${it.itemName}\n     Part No: ${partNo}\n    Qty: ${it.quantity} | Stock: ${it.oldQuantity} → ${it.newQuantity}`;
    })
    .join("\n");

  return (
    `🟢 <b>STOCK IN</b>\n` +
    referenceLines +
    `━━━━━━━━━━━━━━\n` +
    itemLines + "\n" +
    `━━━━━━━━━━━━━━\n` +
    `👤 ${user}\n`
  );
}

/**
 * Stock In & Out Notifications (Wrapper)
 */
export function buildStockTelegramMessage(
  type: "StockIn" | "StockOut",
  part: {
    id?: string;
    itemName: string;
    partNumber?: string;
    useFor?: string;
    quantity: number;
    oldQuantity?: number;
    newQuantity?: number;
    performedBy?: string;
    remarks?: string;
    reportNo?: string;
    companyName?: string;
  }
): string {
  const oldQty = part.oldQuantity ?? 0;
  const newQty = part.newQuantity ?? (type === "StockIn" ? oldQty + part.quantity : Math.max(0, oldQty - part.quantity));

  if (type === "StockIn") {
    return buildStockInTelegramMessage({
      id: part.id,
      itemName: part.itemName,
      partNumber: part.partNumber,
      useFor: part.useFor,
      oldQuantity: oldQty,
      quantityChange: part.quantity,
      newQuantity: newQty,
      performedBy: part.performedBy,
      remarks: part.remarks,
      reportNo: part.reportNo,
      companyName: part.companyName,
    });
  } else {
    return buildStockOutTelegramMessage({
      id: part.id,
      itemName: part.itemName,
      partNumber: part.partNumber,
      useFor: part.useFor,
      oldQuantity: oldQty,
      quantityChange: -part.quantity,
      newQuantity: newQty,
      performedBy: part.performedBy,
      remarks: part.remarks,
      reportNo: part.reportNo,
      companyName: part.companyName,
    });
  }
}
