/**
 * @file components/docs/content/reportsCatalogue.ts
 * @description Chapter 04, part two — which report answers which question.
 *
 * The eight stock reports are documented in chapter 03 instead, beside the
 * stock they describe; repeating them here would double the reader's work and
 * halve the chance both copies stay true.
 */

import type { DocTopic } from "../docsTypes";

export const REPORT_CATALOGUE_TOPICS: DocTopic[] = [
  {
    id: "daily-report",
    icon: "clipboard",
    route: "/daily-report",
    title: { en: "Daily Report", km: "របាយការណ៍ប្រចាំថ្ងៃ" },
    blurb: {
      en: "The day's tickets grouped by status, so a supervisor can see what is stuck where.",
      km: "សំណុំរឿងប្រចាំថ្ងៃ ដាក់ជាក្រុមតាមស្ថានភាព ដើម្បីឱ្យអ្នកគ្រប់គ្រងឃើញថាអ្វីជាប់នៅដំណាក់កាលណា។",
    },
    steps: [
      {
        en: "Open Reports → Repair Operations → Daily Report. It opens on today.",
        km: "បើក Reports → Repair Operations → Daily Report។ វាបើកនៅថ្ងៃនេះ។",
      },
      {
        en: "Change From/To for another day or a short span.",
        km: "ប្តូរ From/To សម្រាប់ថ្ងៃផ្សេង ឬចន្លោះខ្លី។",
      },
      {
        en: "Read each status block; every block ends with a Total, and the report ends with a Grand Total.",
        km: "អានប្លុកស្ថានភាពនីមួយៗ; ប្លុកនីមួយៗបញ្ចប់ដោយ Total ហើយរបាយការណ៍បញ្ចប់ដោយ Grand Total។",
      },
    ],
    facts: [
      {
        en: "This is the only report that prints the time as well as the date received — useful when two machines arrive on the same day.",
        km: "នេះជារបាយការណ៍តែមួយគត់ដែលបោះពុម្ពម៉ោង បន្ថែមលើកាលបរិច្ឆេទទទួល — មានប្រយោជន៍ពេលម៉ាស៊ីនពីរមកដល់ថ្ងៃតែមួយ។",
      },
      {
        en: "Tickets with no status fall into a “No status” block so the grand total still matches the number of rows.",
        km: "សំណុំរឿងគ្មានស្ថានភាព ធ្លាក់ចូលប្លុក “No status” ដើម្បីឱ្យចំនួនសរុបនៅតែត្រូវនឹងចំនួនជួរ។",
      },
    ],
  },
  {
    id: "monthly-report",
    icon: "chart",
    route: "/monthly-report",
    title: { en: "Monthly Report", km: "របាយការណ៍ប្រចាំខែ" },
    blurb: {
      en: "Every ticket in the range grouped by customer, with a Fixed / Rejected / Unrepairable breakdown under the grand total.",
      km: "សំណុំរឿងទាំងអស់ក្នុងចន្លោះ ដាក់ជាក្រុមតាមអតិថិជន ព្រមទាំងការបែងចែក Fixed / Rejected / Unrepairable ក្រោមចំនួនសរុប។",
    },
    steps: [
      {
        en: "Open Reports → Repair Operations → Monthly Report. It opens on the current month.",
        km: "បើក Reports → Repair Operations → Monthly Report។ វាបើកនៅខែបច្ចុប្បន្ន។",
      },
      {
        en: "Click Last month, or set From/To by hand for any other range.",
        km: "ចុច Last month ឬកំណត់ From/To ដោយដៃសម្រាប់ចន្លោះផ្សេង។",
      },
      {
        en: "Read each company block and its Total, then the summary line under the grand total.",
        km: "អានប្លុកក្រុមហ៊ុននីមួយៗ និង Total របស់វា រួចអានបន្ទាត់សង្ខេបក្រោមចំនួនសរុប។",
      },
    ],
    facts: [
      {
        en: "Days Taken is averaged per company and Total Cost is summed, so a company block reads as a small account statement.",
        km: "Days Taken ជាមធ្យមភាគតាមក្រុមហ៊ុន ហើយ Total Cost ជាផលបូក ដូច្នេះប្លុកក្រុមហ៊ុនអានដូចរបាយការណ៍គណនីតូចមួយ។",
      },
      {
        en: "Tickets with no company are grouped under “Unspecified company” rather than dropped.",
        km: "សំណុំរឿងគ្មានក្រុមហ៊ុន ត្រូវដាក់ជាក្រុមក្រោម “Unspecified company” ជាជាងបោះបង់ចោល។",
      },
    ],
  },
  {
    id: "history-report",
    icon: "layers",
    route: "/history-report",
    title: { en: "Machine History", km: "ប្រវត្តិម៉ាស៊ីន" },
    blurb: {
      en: "One machine's whole repair history, top to bottom, grouped by serial number.",
      km: "ប្រវត្តិជួសជុលទាំងមូលរបស់ម៉ាស៊ីនមួយ ពីលើចុះក្រោម ដាក់ជាក្រុមតាមលេខសម្គាល់។",
    },
    steps: [
      {
        en: "Open Reports → Repair Operations → Machine History. It opens on the current year.",
        km: "បើក Reports → Repair Operations → Machine History។ វាបើកនៅឆ្នាំបច្ចុប្បន្ន។",
      },
      {
        en: "Type a serial number or model into the search box to isolate one machine.",
        km: "វាយលេខសម្គាល់ ឬម៉ូដែលក្នុងប្រអប់ស្វែងរក ដើម្បីញែកម៉ាស៊ីនតែមួយ។",
      },
      {
        en: "Widen the range to cover earlier years when you need the machine's full life.",
        km: "ពង្រីកចន្លោះឱ្យគ្របឆ្នាំមុនៗ ពេលអ្នកត្រូវការប្រវត្តិពេញមួយជីវិតម៉ាស៊ីន។",
      },
    ],
    facts: [
      {
        en: "The default window is a whole year on purpose — a printer serviced twice a year shows nothing useful in a 30-day window.",
        km: "ចន្លោះលំនាំដើមគឺមួយឆ្នាំពេញដោយចេតនា — ម៉ាស៊ីនបោះពុម្ពដែលថែទាំពីរដងក្នុងមួយឆ្នាំ មិនបង្ហាញអ្វីមានប្រយោជន៍ក្នុងចន្លោះ ៣០ ថ្ងៃទេ។",
      },
      {
        en: "Machines with no serial number group under “No serial number” — worth checking, because it usually means an incomplete intake record.",
        km: "ម៉ាស៊ីនគ្មានលេខសម្គាល់ ដាក់ជាក្រុមក្រោម “No serial number” — គួរពិនិត្យ ព្រោះជាធម្មតាវាមានន័យថាកំណត់ត្រាទទួលចូលមិនពេញលេញ។",
      },
    ],
  },
  {
    id: "engineer-kpi-report",
    icon: "gauge",
    route: "/engineer-kpi-report",
    title: { en: "Technician KPI Scorecard", km: "តារាងវាយតម្លៃជាង" },
    blurb: {
      en: "One ranked row per technician: completed jobs, average turnaround, fix success rate, live workload and a grade.",
      km: "មួយជួរតាមចំណាត់ថ្នាក់សម្រាប់ជាងម្នាក់៖ ការងារបញ្ចប់ រយៈពេលមធ្យម អត្រាជោគជ័យ បន្ទុកការងារបច្ចុប្បន្ន និងនិទ្ទេស។",
    },
    steps: [
      {
        en: "Open Reports → Technician KPI Scorecard. It opens from the 1st of this month to today.",
        km: "បើក Reports → Technician KPI Scorecard។ វាបើកពីថ្ងៃទី ១ ខែនេះ ដល់ថ្ងៃនេះ។",
      },
      {
        en: "Adjust From/To to score a different period, and filter by type or location if you need a like-for-like comparison.",
        km: "កែ From/To ដើម្បីវាយតម្លៃអំឡុងពេលផ្សេង ហើយត្រងតាមប្រភេទ ឬទីតាំង បើអ្នកត្រូវការការប្រៀបធៀបស្មើភាព។",
      },
      {
        en: "Read the flat ranked list — it has no per-block subtotals, because the row IS the unit.",
        km: "អានបញ្ជីតាមចំណាត់ថ្នាក់ — វាគ្មានចំនួនរងតាមប្លុកទេ ព្រោះជួរខ្លួនឯងគឺជាឯកតា។",
      },
    ],
    facts: [
      {
        en: "Grades follow both speed and success: A+ needs a high success rate AND a short average turnaround, so one without the other does not earn it.",
        km: "និទ្ទេសអាស្រ័យលើទាំងល្បឿន និងជោគជ័យ៖ A+ ត្រូវការអត្រាជោគជ័យខ្ពស់ និង រយៈពេលមធ្យមខ្លី ដូច្នេះមួយដោយគ្មានមួយទៀត មិនទទួលបានទេ។",
      },
      {
        en: "Active WIP counts everything not yet Finished, Customer Rejected or Unrepairable — the load a technician is carrying right now.",
        km: "Active WIP រាប់អ្វីៗដែលមិនទាន់ Finished, Customer Rejected ឬ Unrepairable — ជាបន្ទុកដែលជាងកំពុងកាន់បច្ចុប្បន្ន។",
      },
      {
        en: "A ticket is credited to whoever repaired it, falling back to whoever inspected it, then whoever created it, then “Unassigned”.",
        km: "សំណុំរឿងត្រូវបានគិតជូនអ្នកដែលបានជួសជុល បើគ្មានទេ គិតជូនអ្នកវិនិច្ឆ័យ បន្ទាប់មកអ្នកបង្កើត បន្ទាប់មក “Unassigned”។",
      },
    ],
  },
  {
    id: "monthly-technical-matrix",
    icon: "chart",
    route: "/monthly-technical-matrix",
    title: { en: "Monthly Technical Matrix", km: "តារាងបច្ចេកទេសប្រចាំខែ" },
    blurb: {
      en: "The department's official 12-month sheet: some rows come from the database, some you type, plus a commentary box and two signature blocks.",
      km: "សន្លឹកផ្លូវការ ១២ ខែរបស់ផ្នែក៖ ជួរខ្លះមកពីមូលដ្ឋានទិន្នន័យ ជួរខ្លះអ្នកវាយខ្លួនឯង ព្រមទាំងប្រអប់អត្ថាធិប្បាយ និងប្លុកហត្ថលេខាពីរ។",
    },
    steps: [
      {
        en: "Open Reports → Repair Operations → Technical Matrix and step the year with the ‹ › arrows.",
        km: "បើក Reports → Repair Operations → Technical Matrix រួចប្តូរឆ្នាំដោយព្រួញ ‹ ›។",
      },
      {
        en: "Click Refresh DB to re-pull the automatic rows — those carry a green Auto tag and cannot be typed into.",
        km: "ចុច Refresh DB ដើម្បីទាញជួរស្វ័យប្រវត្តិឡើងវិញ — ជួរទាំងនោះមានស្លាក Auto ពណ៌បៃតង ហើយមិនអាចវាយបានទេ។",
      },
      {
        en: "Type your own figures into the month cells of the manual rows. An “Auto-saved” tick appears after each edit.",
        km: "វាយតួលេខផ្ទាល់ខ្លួនក្នុងក្រឡាខែនៃជួរដែលបំពេញដោយដៃ។ សញ្ញា “Auto-saved” នឹងលេចឡើងបន្ទាប់ពីការកែនីមួយៗ។",
      },
      {
        en: "Write the period commentary in the summary box, fill the date and the two name fields, then export the workbook.",
        km: "សរសេរអត្ថាធិប្បាយអំឡុងពេលក្នុងប្រអប់សង្ខេប បំពេញកាលបរិច្ឆេទ និងវាលឈ្មោះទាំងពីរ រួចនាំចេញសៀវភៅការងារ។",
      },
    ],
    facts: [
      {
        en: "Five rows are automatic — machines in, machines out, unrepairable, awaiting confirmation and on-site service. The other seven are yours to fill.",
        km: "ជួរប្រាំជាស្វ័យប្រវត្តិ — ម៉ាស៊ីនចូល ម៉ាស៊ីនចេញ ជួសជុលមិនកើត រង់ចាំការយល់ព្រម និងសេវានៅកន្លែងអតិថិជន។ ជួរប្រាំពីរទៀតជារបស់អ្នកបំពេញ។",
      },
      {
        en: "Your typed figures, the notes and the signature names are saved in THIS browser, per year. Another computer, another browser, or cleared site data means they are not there — export the workbook when the sheet is final.",
        km: "តួលេខដែលអ្នកវាយ កំណត់សម្គាល់ និងឈ្មោះហត្ថលេខា ត្រូវបានរក្សាទុកក្នុង កម្មវិធីរុករកនេះ តាមឆ្នាំ។ កុំព្យូទ័រផ្សេង កម្មវិធីរុករកផ្សេង ឬការសម្អាតទិន្នន័យ មានន័យថាវាមិននៅទីនោះទេ — សូមនាំចេញសៀវភៅការងារពេលសន្លឹករួចរាល់។",
      },
      {
        en: "The exported file matches the company's paper form — landscape A4, month headers, a bordered notes box and both signature blocks.",
        km: "ឯកសារនាំចេញត្រូវនឹងទម្រង់ក្រដាសរបស់ក្រុមហ៊ុន — A4 ផ្ដេក ក្បាលខែ ប្រអប់កំណត់សម្គាល់មានស៊ុម និងប្លុកហត្ថលេខាទាំងពីរ។",
      },
    ],
  },
  {
    id: "sales-reports",
    icon: "users",
    route: "/sales-followup",
    title: { en: "Sales & CRM reports", km: "របាយការណ៍លក់ និង CRM" },
    blurb: {
      en: "Seven reports that turn the repair queue into a sales pipeline: who is still deciding, what we win and lose, and who is worth calling.",
      km: "របាយការណ៍ប្រាំពីរដែលបម្លែងជួរជួសជុលទៅជាបំពង់លក់៖ អ្នកណានៅកំពុងសម្រេចចិត្ត អ្វីដែលយើងឈ្នះ និងចាញ់ និងអ្នកណាដែលគួរទូរស័ព្ទទៅ។",
    },
    steps: [
      {
        en: "Quotation Follow-up (/sales-followup) — everything still awaiting a customer's answer, with the contact's phone number and how many days they have been thinking about it.",
        km: "Quotation Follow-up (/sales-followup) — អ្វីៗដែលនៅរង់ចាំចម្លើយអតិថិជន ព្រមទាំងលេខទូរស័ព្ទអ្នកទំនាក់ទំនង និងចំនួនថ្ងៃដែលពួកគេកំពុងគិត។",
      },
      {
        en: "Sales Conversion (/sales-conversion-report) — the approval rate: confirmed against rejected, and how long a decision takes on average.",
        km: "Sales Conversion (/sales-conversion-report) — អត្រាយល់ព្រម៖ ការបញ្ជាក់ធៀបនឹងការបដិសេធ និងរយៈពេលមធ្យមនៃការសម្រេចចិត្ត។",
      },
      {
        en: "New Machine Sales Leads (/sales-leads-report) — unrepairable and rejected jobs, which are exactly the customers who now need a new machine.",
        km: "New Machine Sales Leads (/sales-leads-report) — ការងារជួសជុលមិនកើត និងបដិសេធ ដែលជាអតិថិជនដែលឥឡូវត្រូវការម៉ាស៊ីនថ្មី។",
      },
      {
        en: "Contract Renewals (/contract-renewal-report) — expiring maintenance agreements and frequent walk-in customers ready to be offered one.",
        km: "Contract Renewals (/contract-renewal-report) — កិច្ចសន្យាថែទាំដែលជិតផុតកំណត់ និងអតិថិជនដើរចូលញឹកញាប់ ដែលអាចស្នើកិច្ចសន្យាបាន។",
      },
      {
        en: "Top Customers (/top-customers-report), Customer Report (/customer-report) and Contract vs Walk-in (/contract-report) round it out — who is worth the most, what each one did this period, and the split between contract and per-visit work.",
        km: "Top Customers (/top-customers-report), Customer Report (/customer-report) និង Contract vs Walk-in (/contract-report) បំពេញបន្ថែម — អ្នកណាមានតម្លៃបំផុត អ្នកនីមួយៗធ្វើអ្វីខ្លះក្នុងអំឡុងពេលនេះ និងការបែងចែករវាងការងារតាមកិច្ចសន្យា និងតាមដងនីមួយៗ។",
      },
    ],
    facts: [
      {
        en: "Every one of these is built from the same tickets the technical team is already working — nothing extra has to be entered for sales to have a pipeline.",
        km: "របាយការណ៍ទាំងអស់នេះសាងចេញពីសំណុំរឿងដដែលដែលក្រុមបច្ចេកទេសកំពុងធ្វើ — គ្មានអ្វីត្រូវបញ្ចូលបន្ថែម ដើម្បីឱ្យផ្នែកលក់មានបំពង់លក់ទេ។",
      },
      {
        en: "That is why the rejected and unrepairable queues are kept rather than cleared: they are the leads list.",
        km: "នេះជាមូលហេតុដែលជួរបដិសេធ និងជួសជុលមិនកើតត្រូវរក្សាទុក ជាជាងលុបចោល៖ ពួកវាជាបញ្ជីអតិថិជនសក្តានុពល។",
      },
    ],
  },
  {
    id: "diagnostics-reports",
    icon: "wrench",
    route: "/faults-report",
    title: { en: "Quality & diagnostics reports", km: "របាយការណ៍គុណភាព និងវិនិច្ឆ័យ" },
    blurb: {
      en: "What keeps breaking, and what could not be saved.",
      km: "អ្វីដែលខូចម្តងហើយម្តងទៀត និងអ្វីដែលមិនអាចសង្គ្រោះបាន។",
    },
    steps: [
      {
        en: "Common Faults & Diagnostics (/faults-report) — recurring errors, the diagnoses given and the solutions applied, grouped by machine model.",
        km: "Common Faults & Diagnostics (/faults-report) — កំហុសកើតឡើងដដែល ការវិនិច្ឆ័យដែលបានផ្តល់ និងដំណោះស្រាយដែលបានអនុវត្ត ដាក់ជាក្រុមតាមម៉ូដែលម៉ាស៊ីន។",
      },
      {
        en: "Rejected & Scrap (/rejected-report) — tickets marked Customer Rejected or Unrepairable, with the diagnosis and what the customer asked for.",
        km: "Rejected & Scrap (/rejected-report) — សំណុំរឿងដែលសម្គាល់ថា Customer Rejected ឬ Unrepairable ព្រមទាំងការវិនិច្ឆ័យ និងអ្វីដែលអតិថិជនស្នើ។",
      },
      {
        en: "Read the faults report by model before quoting a machine you have seen before — the fix is usually already written down.",
        km: "អានរបាយការណ៍កំហុសតាមម៉ូដែល មុននឹងស្នើតម្លៃលើម៉ាស៊ីនដែលអ្នកធ្លាប់ឃើញ — ដំណោះស្រាយជាធម្មតាបានកត់ត្រាទុករួចហើយ។",
      },
    ],
    facts: [
      {
        en: "These two reports are only as good as the Inspection and Solution text technicians write — they read those fields directly.",
        km: "របាយការណ៍ទាំងពីរនេះល្អតាមអត្ថបទ Inspection និង Solution ដែលជាងសរសេរប៉ុណ្ណោះ — វាអានវាលទាំងនោះដោយផ្ទាល់។",
      },
    ],
  },
];
