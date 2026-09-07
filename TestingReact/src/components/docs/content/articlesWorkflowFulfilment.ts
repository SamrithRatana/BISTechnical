/**
 * @file components/docs/content/articlesWorkflowFulfilment.ts
 * @description The second half of the repair chain - parts are issued, the repair is approved, carried out and verified, plus the branches that leave the chain without a repair.
 *
 * Ordered as a ticket travels. `articlesWorkflow.ts` spreads this back
 * into the chapter — see its header for why no title states its own
 * stage number.
 */

import type { DocsArticle } from "./articleTypes";

export const WORKFLOW_FULFILMENT_ARTICLES: DocsArticle[] = [
  {
    id: "pending-repairs",
    titleKm: "ដំណើរការជួសជុលជាក់ស្តែង",
    titleEn: "Repair Execution Workbench",
    subtitleKm: "ផ្ទាំងបំពេញការងាររបស់ជាងបច្ចេកទេស ក្នុងការដោះដូរគ្រឿងបន្លាស់ ធ្វើតេស្តសាកល្បង និងចុច 'Approved Repair'",
    subtitleEn: "Technician workbench for executing repairs, testing functionality, and clicking Approved Repair for Manager QA",
    categoryKm: "លំហូរការងារជួសជុល & ដំណាក់កាលទាំង ១១",
    categoryEn: "Repair Workflow",
    icon: "Wrench",
    route: "/pending-repairs",

    status: "Repairing",
    roles: ["Technician", "Supervisor", "Admin"],
    summaryKm: "ទំព័រ `/pending-repairs` ជាកន្លែងដែលជាងបច្ចេកទេសមើលសំបុត្រដែលខ្លួនកំពុងកាន់កាប់ (Status ID: 5 Repairing) ធ្វើការដោះដូរគ្រឿងបន្លាស់ សម្អាត និងធ្វើតេស្តសាកល្បងម៉ាស៊ីន។ ពេលជួសជុលរួចរាល់ ជាងចុច 'Approved Repair' ដើម្បីបញ្ជូនឱ្យ Manager Technical ផ្ទៀងផ្ទាត់គុណភាពក្នុង `/approve-verify`។",
    summaryEn: "Active workbench for assigned technicians to carry out repairs, replace parts, test functionality, and click 'Approved Repair' for Manager Technical QA review.",
    diagram: {
      titleKm: "លំហូរការងារជួសជុលរបស់ជាង (Technician Workbench Flow)",
      titleEn: "Technician Execution Pipeline",
      descriptionKm: "ដំណើរការដោះដូរគ្រឿងបន្លាស់ សម្អាត ធ្វើតេស្ត និងចុច Approved Repair បញ្ជូនទៅ Manager Technical",
      descriptionEn: "Bench procedure from part replacement to Approved Repair submission.",
      nodes: [
        { id: "pr1", labelKm: "១. ទទួលគ្រឿងបន្លាស់ & សំបុត្រ", labelEn: "1. Receive Parts & Ticket", badgeKm: "Workbench", badgeEn: "Workbench", color: "violet", route: "/pending-repairs" },
        { id: "pr2", labelKm: "២. ដោះដូរគ្រឿងបន្លាស់ & ជួសជុល", labelEn: "2. Disassemble & Replace", badgeKm: "Repairing", badgeEn: "Repairing", color: "indigo" },
        { id: "pr3", labelKm: "៣. សម្អាត & ធ្វើតេស្តដំណើរការម៉ាស៊ីន", labelEn: "3. Bench Function Test", badgeKm: "Self-Test", badgeEn: "Self-Test", color: "cyan" },
        { id: "pr4", labelKm: "៤. កត់ត្រាដំណោះស្រាយ (Solution)", labelEn: "4. Document Solution", badgeKm: "Knowledge", badgeEn: "Knowledge", color: "amber" },
        { id: "pr5", labelKm: "៥. ជាងចុច 'Approved Repair' ស្នើសុំ QA", labelEn: "5. Click 'Approved Repair'", badgeKm: "Approved Repair", badgeEn: "Approved Repair", color: "emerald", route: "/approve-verify" },
      ],
    },
    steps: [
      {
        number: 1,
        titleKm: "បញ្ចប់ការជួសជុល & ចុច 'Approved Repair'",
        titleEn: "Complete Repair & Click 'Approved Repair'",
        descKm: "ពេលជួសជុលរួចរាល់ ជាងចុច 'Approved Repair' ដើម្បីឱ្យ Manager Technical ធ្វើតេស្តផ្ទៀងផ្ទាត់គុណភាពចុងក្រោយក្នុង `/approve-verify` មុននឹងទាក់ទងអតិថិជនមកទទួលក្នុង `/completed-repairs` (Finished Page)។",
        descEn: "Once repaired and self-tested, click 'Approved Repair' to forward the ticket to Manager Technical for final quality verification in /approve-verify before client pickup in /completed-repairs (Finished Page).",
      },
    ],
  },
  {
    id: "approve-repair",
    titleKm: "ជាងចុច Approved Repair & ស្នើសុំ QA",
    titleEn: "Pre-QA Completed Repairs Queue",
    subtitleKm: "បញ្ជីសំបុត្រដែលជាងបានជួសជុលរួចរាល់ ហើយចុច 'Approved Repair' ដាក់ស្នើសុំឱ្យ Manager Technical ធ្វើតេស្តត្រួតពិនិត្យគុណភាព",
    subtitleEn: "Technician completed repair queue submitted for Manager Technical quality review",
    categoryKm: "លំហូរការងារជួសជុល & ដំណាក់កាលទាំង ១១",
    categoryEn: "Repair Workflow",
    icon: "ShieldAlert",
    route: "/approve-repair",

    status: "Repairing",
    roles: ["Technician", "Supervisor", "Admin"],
    summaryKm: "ទំព័រ `/approve-repair` ប្រមូលផ្តុំសំបុត្រដែលជាងបានជួសជុលរួច និងចុច 'Approved Repair' ដាក់ស្នើសុំការត្រួតពិនិត្យគុណភាព (Pre-QA Verification) មុននឹង Manager Technical ធ្វើតេស្តផ្ទៀងផ្ទាត់ចុងក្រោយក្នុង `/approve-verify`។",
    summaryEn: "Queue of technician self-certified repairs after clicking 'Approved Repair' awaiting Manager Technical audit.",
    diagram: {
      titleKm: "លំហូរការងារស្នើសុំ QA (Pre-QA Submission Flow)",
      titleEn: "Pre-QA Submission Pipeline",
      descriptionKm: "ដំណើរការបញ្ជូនសំបុត្រដែលជួសជុលរួចទៅកាន់ Manager Technical",
      descriptionEn: "Transition pipeline from technician bench completion to Manager Technical queue.",
      nodes: [
        { id: "ar1", labelKm: "១. ជាងបញ្ចប់ការជួសជុល & ចុច 'Approved Repair'", labelEn: "1. Click 'Approved Repair'", badgeKm: "Tech Done", badgeEn: "Tech Done", color: "violet", route: "/pending-repairs" },
        { id: "ar2", labelKm: "២. បញ្ជូនចូលទៅ /approve-repair", labelEn: "2. Enters /approve-repair", badgeKm: "Pre-QA", badgeEn: "Pre-QA", color: "cyan", route: "/approve-repair" },
        { id: "ar3", labelKm: "៣. Manager Technical បើកសំបុត្រផ្ទៀងផ្ទាត់គុណភាពក្នុង /approve-verify", labelEn: "3. Manager Technical Audit", badgeKm: "QA Audit", badgeEn: "QA Audit", color: "indigo", route: "/approve-verify" },
        { id: "ar4", labelKm: "៤. អនុម័ត Finished ➔ ទាក់ទងអតិថិជនមកទទួលក្នុង Finished Page", labelEn: "4. Finished Handover", badgeKm: "Finished", badgeEn: "Finished", color: "emerald", route: "/completed-repairs" },
      ],
    },
    steps: [
      {
        number: 1,
        titleKm: "ត្រួតពិនិត្យកំណត់ត្រាជួសជុល",
        titleEn: "Review Repair Logs",
        descKm: "ពិនិត្យមើលគ្រឿងបន្លាស់ដែលបានប្តូរ និងដំណោះស្រាយដែលជាងបានកត់ត្រា។",
        descEn: "Inspect installed parts, technician solution logs, and testing notes.",
      },
    ],
  },
  {
    id: "approve-verify",
    titleKm: "Manager Technical ផ្ទៀងផ្ទាត់គុណភាព QA & អនុម័ត",
    titleEn: "Manager Technical QA Verification & Final Approval",
    subtitleKm: "Manager Technical ធ្វើតេស្តគុណភាពចុងក្រោយ ចុះហត្ថលេខា និងប្តូរទៅ Finished មុននឹងទាក់ទងអតិថិជនមកទទួលក្នុង Finished Page",
    subtitleEn: "Manager Technical QA testing, certificate sign-off, and client pickup in Finished Page",
    categoryKm: "លំហូរការងារជួសជុល & ដំណាក់កាលទាំង ១១",
    categoryEn: "Repair Workflow",
    icon: "CheckCircle",
    route: "/approve-verify",

    status: "Finished",
    roles: ["Supervisor", "Admin"],
    summaryKm: "ទំព័រ `/approve-verify` ធានាថារាល់ម៉ាស៊ីនដែលជួសជុលរួចត្រូវបានត្រួតពិនិត្យគុណភាព (Quality Assurance) យ៉ាងម៉ត់ចត់ដោយ Manager Technical មុននឹងទាក់ទងឱ្យអតិថិជនមកទទួលយកត្រឡប់ទៅវិញក្នុង `/completed-repairs` (Finished Page)។",
    summaryEn: "The final quality control checkpoint where Manager Technical verifies repair results, endorses the certificate, and marks the job Finished before customer contact for pickup.",
    diagram: {
      titleKm: "លំហូរការងារផ្ទៀងផ្ទាត់គុណភាព & ប្រគល់ជូន (QA Handover Flow)",
      titleEn: "QA Verification & Handover Pipeline",
      descriptionKm: "ការត្រួតពិនិត្យគុណភាពចុងក្រោយដោយ Manager Technical ការចុះហត្ថលេខា និងការទាក់ទងអតិថិជនមកទទួល",
      descriptionEn: "Final quality audit by Manager Technical, certificate endorsement, and customer pickup in Finished Page.",
      nodes: [
        { id: "av1", labelKm: "១. បើកសំបុត្ររង់ចាំ QA ក្នុង /approve-verify", labelEn: "1. Open QA Queue", badgeKm: "Manager Tech", badgeEn: "Manager Tech", color: "violet", route: "/approve-verify" },
        { id: "av2", labelKm: "២. Manager Technical ធ្វើតេស្តគុណភាព & Checklist មុខងារ", labelEn: "2. Rigorous Function Test", badgeKm: "QA Checklist", badgeEn: "QA Checklist", color: "cyan" },
        { id: "av3", labelKm: "៣. អនុម័ត & ចុះហត្ថលេខាលើប័ណ្ណបញ្ជាក់ (Sign-Off)", labelEn: "3. Sign Off Certificate", badgeKm: "Approved", badgeEn: "Approved", color: "indigo" },
        { id: "av4", labelKm: "៤. ប្តូរស្ថានភាពទៅជា Status ID: 6 (Finished)", labelEn: "4. Mark Status Finished", badgeKm: "Status: 6", badgeEn: "Status: 6", color: "emerald", route: "/completed-repairs" },
        { id: "av5", labelKm: "៥. ទាក់ទងអតិថិជនមកទទួលក្នុង Finished Page (/completed-repairs)", labelEn: "5. Client Handover in Finished Page", badgeKm: "Finished Page", badgeEn: "Finished Page", color: "emerald", route: "/completed-repairs" },
      ],
    },
    steps: [
      {
        number: 1,
        titleKm: "Manager Technical ត្រួតពិនិត្យម៉ាស៊ីនជាក់ស្តែង",
        titleEn: "Perform Manager Quality Audit",
        descKm: "Manager Technical បើកមើលព័ត៌មានលម្អិតនៃសំបុត្រ ធ្វើតេស្តមុខងារម៉ាស៊ីនជាក់ស្តែង និងពិនិត្យមើលរាល់គ្រឿងបន្លាស់ដែលបានប្តូរ។",
        descEn: "Manager Technical inspects the repaired equipment against the original diagnostic report and tests all machine functions.",
      },
      {
        number: 2,
        titleKm: "អនុម័ត និងចុះហត្ថលេខា (Approve & Mark Finished)",
        titleEn: "Approve & Mark Finished",
        descKm: "ចុចប៊ូតុង 'Verify & Approve'។ ស្ថានភាពនឹងប្តូរទៅ `Finished` (Status ID: 6) ដោយកត់ត្រាឈ្មោះ Manager Technical និងកាលបរិច្ឆេទបញ្ចប់ រួចទាក់ទងអតិថិជនមកទទួលក្នុង Finished Page (`/completed-repairs`)។",
        descEn: "Click Verify & Approve to seal the certificate and transition status to Finished (Status ID: 6), ready for customer contact and pickup.",
      },
    ],
  },
  {
    id: "completed-repairs",
    titleKm: "ម៉ាស៊ីនជួសជុលរួចរាល់ Finished & ប្រគល់ជូន",
    titleEn: "Finished Repairs & Customer Handover (/completed-repairs)",
    subtitleKm: "បញ្ជីម៉ាស៊ីនដែលជួសជុលរួចរាល់ Finished (Status ID: 6) សម្រាប់ទាក់ទងអតិថិជនមកទទួល និងប្រគល់ជូន",
    subtitleEn: "Finished equipment repository (Status 6) for client notification, pickup, and A4 certificate delivery",
    categoryKm: "លំហូរការងារជួសជុល & ដំណាក់កាលទាំង ១១",
    categoryEn: "Repair Workflow",
    icon: "CheckCheck",
    route: "/completed-repairs",

    status: "Finished",
    roles: ["Front Desk", "Supervisor", "Admin"],
    summaryKm: "ទំព័រ Finished Page (`/completed-repairs`) បង្ហាញសំបុត្រទាំងអស់ដែលមានស្ថានភាព `Finished` (Status ID: 6) ដែលបានឆ្លងកាត់ការផ្ទៀងផ្ទាត់គុណភាពពី Manager Technical រួចរាល់។ បុគ្គលិកផ្នែកទទួលភ្ញៀវទាក់ទងអតិថិជន ស្វែងរកសំបុត្រ បោះពុម្ពប័ណ្ណ A4 Technical Service Report និងប្រគល់ម៉ាស៊ីនជូនអតិថិជន។",
    summaryEn: "Final archive of Finished repair jobs (Status 6) verified by Manager Technical, ready for client notification, pickup, signature sign-off, and warranty validation.",
    diagram: {
      titleKm: "លំហូរការងារប្រគល់ម៉ាស៊ីន Finished ជូនអតិថិជន (Finished Handover Flow)",
      titleEn: "Customer Handover Pipeline",
      descriptionKm: "ដំណើរការទាក់ទងអតិថិជន ប្រគល់ម៉ាស៊ីន បោះពុម្ពប័ណ្ណ A4 និងការចុះហត្ថលេខាទទួលពីអតិថិជន",
      descriptionEn: "Final delivery workflow with customer signature collection.",
      nodes: [
        { id: "cr1", labelKm: "១. ទាក់ទងអតិថិជន & អតិថិជនមកទទួលយកម៉ាស៊ីន", labelEn: "1. Customer Arrives for Pickup", badgeKm: "Customer Contact", badgeEn: "Customer Contact", color: "violet" },
        { id: "cr2", labelKm: "២. ស្វែងរកសំបុត្រក្នុង Finished Page (/completed-repairs)", labelEn: "2. Search Finished Ticket", badgeKm: "Status: 6", badgeEn: "Status: 6", color: "cyan", route: "/completed-repairs" },
        { id: "cr3", labelKm: "៣. បោះពុម្ពប័ណ្ណ A4 Service Report ចុះហត្ថលេខា", labelEn: "3. Print A4 Certificate", badgeKm: "A4 Certificate", badgeEn: "A4 Certificate", color: "indigo", route: "/templates-settings" },
        { id: "cr4", labelKm: "៤. អតិថិជនចុះហត្ថលេខាទទួលម៉ាស៊ីន & ប្រគល់ជូនជោគជ័យ", labelEn: "4. Handover Complete", badgeKm: "Handover Complete", badgeEn: "Handover Complete", color: "emerald" },
      ],
    },
    steps: [
      {
        number: 1,
        titleKm: "ស្វែងរកសំបុត្រតាមលេខ Serial No ឬ Report No",
        titleEn: "Locate Completed Ticket",
        descKm: "វាយលេខបង្កាន់ដៃ ឬលេខ Serial No ដើម្បីទាញយកព័ត៌មានសំបុត្រជួសជុល។",
        descEn: "Search by receipt number or machine serial to retrieve the completed record.",
      },
      {
        number: 2,
        titleKm: "បោះពុម្ពប័ណ្ណ A4 Technical Report",
        titleEn: "Print A4 Service Certificate",
        descKm: "ចុចប៊ូតុង Print A4 ដើម្បីឱ្យអតិថិជន និងអ្នកប្រគល់ចុះហត្ថលេខាបញ្ជាក់ការទទួលម៉ាស៊ីន។",
        descEn: "Generate the official A4 certificate for client endorsement.",
      },
    ],
  },
  {
    id: "rejected-unrepairable",
    titleKm: "ដំណាក់កាលពិសេស៖ ម៉ាស៊ីនបដិសេធ & ខូចជួសជុលមិនកើត",
    titleEn: "Special Stage: Rejected Quotes & Unrepairable Units",
    subtitleKm: "គ្រប់គ្រងសំបុត្រដែលអតិថិជនមិនព្រមជួសជុល ឬខូចធ្ងន់ធ្ងរ និងបម្លែងទៅជាឱកាសលក់ម៉ាស៊ីនថ្មី",
    subtitleEn: "Handling quote rejections and unrepairable units as hot replacement sales leads",
    categoryKm: "លំហូរការងារជួសជុល & ដំណាក់កាលទាំង ១១",
    categoryEn: "Repair Workflow",
    icon: "XCircle",
    route: "/rejected",

    status: "Customer Rejected / Unrepairable",
    roles: ["Sales", "Supervisor", "Admin"],
    summaryKm: "ទំព័រ `/rejected` គ្រប់គ្រងម៉ាស៊ីនដែលមានស្ថានភាព `Customer Rejected` (Status ID: 7) ឬ `Unrepairable` (Status ID: 8)។ ទិន្នន័យទាំងនេះត្រូវបានភ្ជាប់ទៅកាន់របាយការណ៍ Sales Leads ដើម្បីឱ្យផ្នែកលក់ទាក់ទងលក់ម៉ាស៊ីនថ្មីជំនួស។",
    summaryEn: "Manages rejected quotes and unrepairable hardware, converting lost repairs into immediate hardware replacement leads.",
    diagram: {
      titleKm: "លំហូរការងារបម្លែងម៉ាស៊ីនបដិសេធទៅជា Sales Leads (Rejection to Leads Flow)",
      titleEn: "Rejection-to-Sales Lead Pipeline",
      descriptionKm: "ការបម្លែងម៉ាស៊ីនដែលមិនបានជួសជុលទៅជាឱកាសលក់ម៉ាស៊ីនថ្មីរបស់ផ្នែកលក់",
      descriptionEn: "Pipeline transforming rejected repair tickets into new hardware sales opportunities.",
      nodes: [
        { id: "ru1", labelKm: "១. សំបុត្របដិសេធ ឬខូចជួសជុលមិនកើត", labelEn: "1. Rejection / Unrepairable", badgeKm: "Status: 7/8", badgeEn: "Status: 7/8", color: "rose", route: "/rejected" },
        { id: "ru2", labelKm: "២. កត់ត្រាមូលហេតុបដិសេធលម្អិត", labelEn: "2. Log Reason & Specs", badgeKm: "Audit", badgeEn: "Audit", color: "amber" },
        { id: "ru3", labelKm: "៣. បញ្ជូនចូលរបាយការណ៍ Hot Sales Leads", labelEn: "3. Feed Sales Pipeline", badgeKm: "Hot Lead", badgeEn: "Hot Lead", color: "indigo", route: "/sales-leads-report" },
        { id: "ru4", labelKm: "៤. ផ្នែកលក់ទាក់ទងស្នើលក់ម៉ាស៊ីនថ្មី", labelEn: "4. Sales Contacts Client", badgeKm: "New Machine Sale", badgeEn: "New Machine Sale", color: "emerald" },
      ],
    },
    steps: [
      {
        number: 1,
        titleKm: "ពិនិត្យមូលហេតុបដិសេធ",
        titleEn: "Analyze Rejection Reason",
        descKm: "ពិនិត្យមើលថាតើដោយសារថ្លៃគ្រឿងបន្លាស់ខ្ពស់ពេក ឬដោយសារម៉ាស៊ីនចាស់លែងមានគ្រឿងបន្លាស់។",
        descEn: "Inspect whether decline was price-sensitive or due to obsolete hardware.",
      },
      {
        number: 2,
        titleKm: "បញ្ជូនទៅផ្នែកលក់ធ្វើ Lead",
        titleEn: "Forward to Sales Rep",
        descKm: "ប្រព័ន្ធនឹង Sync ទិន្នន័យដោយស្វ័យប្រវត្តិទៅកាន់ `sales-leads-report`។",
        descEn: "System automatically populates replacement opportunities in the Sales Leads portal.",
      },
    ],
  },
  {
    id: "third-party-repairs",
    titleKm: "ដំណាក់កាលពិសេស៖ ផ្ញើទៅជួសជុលខាងក្រៅ",
    titleEn: "Special Stage: Third-Party & Outsourced Repairs",
    subtitleKm: "សម្រាប់ករណីខូច Board ស្មុគស្មាញដែលត្រូវ Outsource ទៅជាងជំនាញខាងក្រៅ",
    subtitleEn: "Outsourced repair tracking for specialized component-level rework",
    categoryKm: "លំហូរការងារជួសជុល & ដំណាក់កាលទាំង ១១",
    categoryEn: "Repair Workflow",
    icon: "Truck",
    route: "/third-party-repairs",

    status: "Repair by Third-Party",
    roles: ["Supervisor", "Technician", "Admin"],
    summaryKm: "ទំព័រ `/third-party-repairs` តាមដានសំបុត្រដែលត្រូវផ្ញើទៅជាងជំនាញខាងក្រៅ (Status ID: 9 Repair by Third-Party) ដូចជាការប្តូរ Chipset ឬជួសជុល Power Supply ធ្ងន់ធ្ងរ។ ពេលជាងក្រៅជួសជុលរួច ត្រូវយកមកធ្វើតេស្ត QA ផ្ទៃក្នុងក្នុង `/approve-verify` ជាមុនសិន។",
    summaryEn: "Tracks jobs sent to external specialists. Upon return, the machine must pass internal QA in /approve-verify before client handover.",
    diagram: {
      titleKm: "លំហូរការងារជួសជុលខាងក្រៅ (Third-Party Outsource Flow)",
      titleEn: "Third-Party Outsource Pipeline",
      descriptionKm: "ដំណើរការផ្ញើម៉ាស៊ីនទៅជាងក្រៅ ការតាមដាន និងការទទួលត្រឡប់មកធ្វើតេស្ត QA ផ្ទៃក្នុង",
      descriptionEn: "Dispatch to external vendor, cost tracking, and re-entry into internal QA.",
      nodes: [
        { id: "tp1", labelKm: "១. សំបុត្រតម្រូវឱ្យ Outsource [Status: 9]", labelEn: "1. Outsource Required", badgeKm: "Status: 9", badgeEn: "Status: 9", color: "violet", route: "/third-party-repairs" },
        { id: "tp2", labelKm: "២. បញ្ជូនម៉ាស៊ីន & កត់ត្រាឈ្មោះដៃគូក្រៅ", labelEn: "2. Dispatch & Vendor Log", badgeKm: "Vendor", badgeEn: "Vendor", color: "indigo" },
        { id: "tp3", labelKm: "៣. តាមដានចំណាយក្រៅ & រយៈពេល", labelEn: "3. Track Cost & ETA", badgeKm: "Expense", badgeEn: "Expense", color: "amber" },
        { id: "tp4", labelKm: "៤. ទទួលត្រឡប់មកវិញ ➔ ធ្វើតេស្ត QA ក្នុង /approve-verify", labelEn: "4. Return & QA in /approve-verify", badgeKm: "Internal QA", badgeEn: "Internal QA", color: "cyan", route: "/approve-verify" },
        { id: "tp5", labelKm: "៥. អនុម័ត Finished ➔ ប្រគល់ជូនអតិថិជន", labelEn: "5. Mark Finished & Handover", badgeKm: "Finished", badgeEn: "Finished", color: "emerald", route: "/completed-repairs" },
      ],
    },
    steps: [
      {
        number: 1,
        titleKm: "កត់ត្រាព័ត៌មានដៃគូខាងក្រៅ & ថ្លៃចំណាយ",
        titleEn: "Log External Vendor & Cost",
        descKm: "បញ្ចូលឈ្មោះក្រុមហ៊ុនដៃគូ កាលបរិច្ឆេទផ្ញើចេញ និងថ្លៃចំណាយជួសជុលប៉ាន់ស្មាន។",
        descEn: "Record vendor details, outbound dispatch date, and estimated external repair cost.",
      },
      {
        number: 2,
        titleKm: "ទទួលម៉ាស៊ីនត្រឡប់មកវិញ & ធ្វើតេស្ត QA ផ្ទៃក្នុង",
        titleEn: "Receive Return & Internal QA",
        descKm: "ពេលទទួលម៉ាស៊ីនមកវិញ ត្រូវបញ្ជូនទៅកាន់ Manager Technical ក្នុង `/approve-verify` ដើម្បីធ្វើតេស្តគុណភាពផ្ទៃក្នុង មុននឹងប្រគល់ជូនអតិថិជន។",
        descEn: "Inspect incoming outsourced unit through internal Manager Technical QA in /approve-verify before customer delivery.",
      },
    ],
  },
];
