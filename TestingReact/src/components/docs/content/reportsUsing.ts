/**
 * @file components/docs/content/reportsUsing.ts
 * @description Chapter 04, part one — the mechanics every report shares:
 * finding one, setting the period, reading it, taking it away, and printing
 * the single-ticket A4 sheet.
 */

import type { DocTopic } from "../docsTypes";

export const REPORT_USING_TOPICS: DocTopic[] = [
  {
    id: "finding-reports",
    icon: "search",
    route: "/templates-settings",
    title: { en: "Finding the right report", km: "ការរកឱ្យឃើញរបាយការណ៍ត្រឹមត្រូវ" },
    blurb: {
      en: "Twenty-nine reports in five families. The sidebar lists them; the Templates catalogue lets you browse them with descriptions.",
      km: "របាយការណ៍ ២៩ ក្នុងក្រុមប្រាំ។ របារចំហៀងរាយវា; ចំណែកបញ្ជីគំរូអនុញ្ញាតឱ្យអ្នករុករកវាជាមួយការពិពណ៌នា។",
    },
    steps: [
      {
        en: "Expand Reports in the sidebar. The five families are Report Design, Repair Operations, Quality & Diagnostics, Technician KPI Scorecard, Sales & CRM and Spare Parts & Stock.",
        km: "ពង្រីក Reports ក្នុងរបារចំហៀង។ ក្រុមទាំងប្រាំគឺ Report Design, Repair Operations, Quality & Diagnostics, Technician KPI Scorecard, Sales & CRM និង Spare Parts & Stock។",
      },
      {
        en: "Click any entry to open that report directly.",
        km: "ចុចធាតុណាមួយ ដើម្បីបើករបាយការណ៍នោះដោយផ្ទាល់។",
      },
      {
        en: "To browse instead, open Templates Settings under Report Design — the catalogue shows every report as a card with its purpose.",
        km: "ដើម្បីរុករកជំនួសវិញ សូមបើក Templates Settings ក្រោម Report Design — បញ្ជីនឹងបង្ហាញរបាយការណ៍នីមួយៗជាកាត ព្រមទាំងគោលបំណងរបស់វា។",
      },
      {
        en: "Search the catalogue by name or field, and use the format pills (A4 Forms / Excel Grids) and the category tabs to narrow it.",
        km: "ស្វែងរកក្នុងបញ្ជីតាមឈ្មោះ ឬវាល ហើយប្រើប៊ូតុងទម្រង់ (A4 Forms / Excel Grids) និងផ្ទាំងប្រភេទ ដើម្បីបង្រួម។",
      },
    ],
    facts: [
      {
        en: "Twenty-eight of the twenty-nine are spreadsheet reports. Exactly one — the Technical Service Report — is an A4 sheet printed for a customer, one ticket at a time.",
        km: "ក្នុងចំណោម ២៩ មាន ២៨ ជារបាយការណ៍តារាង។ មានតែមួយគត់ — Technical Service Report — ជាសន្លឹក A4 ដែលបោះពុម្ពជូនអតិថិជន ម្តងមួយសំណុំរឿង។",
      },
      {
        en: "Report names and descriptions are bilingual, so searching the catalogue in Khmer finds the same cards.",
        km: "ឈ្មោះ និងការពិពណ៌នារបាយការណ៍មានពីរភាសា ដូច្នេះការស្វែងរកក្នុងបញ្ជីជាភាសាខ្មែរ រកឃើញកាតដដែល។",
      },
    ],
  },
  {
    id: "report-filters",
    icon: "clipboard",
    title: { en: "Setting the period and filters", km: "កំណត់អំឡុងពេល និងតម្រង" },
    blurb: {
      en: "The same toolbar sits on top of every spreadsheet report — two date boxes, two quick-month buttons, and whichever filters that report offers.",
      km: "របារឧបករណ៍ដដែលនៅខាងលើរបាយការណ៍តារាងគ្រប់មុខ — ប្រអប់កាលបរិច្ឆេទពីរ ប៊ូតុងខែរហ័សពីរ និងតម្រងណាដែលរបាយការណ៍នោះមាន។",
    },
    steps: [
      {
        en: "Set the period with the From and To boxes, or click This month / Last month, which set both together.",
        km: "កំណត់អំឡុងពេលដោយប្រអប់ From និង To ឬចុច This month / Last month ដែលកំណត់ទាំងពីរក្នុងពេលតែមួយ។",
      },
      {
        en: "Type in “Search company, report #, serial…” to narrow by customer, ticket number or serial number.",
        km: "វាយក្នុងប្រអប់ “Search company, report #, serial…” ដើម្បីបង្រួមតាមអតិថិជន លេខសំណុំរឿង ឬលេខសម្គាល់។",
      },
      {
        en: "Click the status button and tick one or more statuses; use All types to restrict to Free or Charge work, and All locations for On-Site or Company Service.",
        km: "ចុចប៊ូតុងស្ថានភាព រួចធីកស្ថានភាពមួយ ឬច្រើន; ប្រើ All types ដើម្បីកំណត់ត្រឹមការងារ Free ឬ Charge និង All locations សម្រាប់ On-Site ឬ Company Service។",
      },
      {
        en: "Click Clear filters to reset the search, statuses, type and location in one go.",
        km: "ចុច Clear filters ដើម្បីកំណត់ការស្វែងរក ស្ថានភាព ប្រភេទ និងទីតាំងឡើងវិញក្នុងពេលតែមួយ។",
      },
    ],
    facts: [
      {
        en: "Filtering happens against the whole period on the server, not just the rows on screen — a filter narrows the report, not the view.",
        km: "ការត្រងធ្វើឡើងលើអំឡុងពេលទាំងមូលនៅម៉ាស៊ីនមេ មិនមែនត្រឹមជួរលើអេក្រង់ទេ — តម្រងបង្រួមរបាយការណ៍ មិនមែនត្រឹមទិដ្ឋភាពទេ។",
      },
      {
        en: "Each report shows only the controls it actually uses, and reports that describe “right now” — Spare Part Hold, Stock Health, Dead Stock — hide the date boxes entirely.",
        km: "របាយការណ៍នីមួយៗបង្ហាញតែឧបករណ៍ដែលវាប្រើពិតប្រាកដ ហើយរបាយការណ៍ដែលពណ៌នា “ពេលនេះ” — Spare Part Hold, Stock Health, Dead Stock — លាក់ប្រអប់កាលបរិច្ឆេទទាំងស្រុង។",
      },
      {
        en: "One report run pulls at most 2,000 rows. A period holding more is cut short with nothing on screen to say so — if a count looks low, split the range and run it twice.",
        km: "ការដំណើរការរបាយការណ៍ម្តងទាញបានច្រើនបំផុត ២,០០០ ជួរ។ អំឡុងពេលដែលមានច្រើនជាងនេះ នឹងត្រូវកាត់ខ្លី ដោយគ្មានអ្វីលើអេក្រង់ប្រាប់ទេ — បើតួលេខមើលទៅតិចពេក សូមបំបែកចន្លោះ ហើយដំណើរការពីរដង។",
      },
    ],
  },
  {
    id: "report-export",
    icon: "chart",
    title: { en: "Reading, exporting and printing a report", km: "អាន នាំចេញ និងបោះពុម្ពរបាយការណ៍" },
    blurb: {
      en: "What you see on screen and what you download are built from the same workbook, so they cannot drift apart.",
      km: "អ្វីដែលអ្នកឃើញលើអេក្រង់ និងអ្វីដែលអ្នកទាញយក សាងចេញពីសៀវភៅការងារតែមួយ ដូច្នេះវាមិនអាចខុសគ្នាបានទេ។",
    },
    steps: [
      {
        en: "Read the table on screen — the headers stay pinned as you scroll a long report.",
        km: "អានតារាងលើអេក្រង់ — ក្បាលតារាងនៅជាប់ពេលអ្នករំកិលរបាយការណ៍វែង។",
      },
      {
        en: "Tick “Include border lines and colours” to switch from the clean reading view to exactly what the exported file looks like.",
        km: "ធីក “Include border lines and colours” ដើម្បីប្តូរពីទិដ្ឋភាពអានស្អាត ទៅជាអ្វីដែលឯកសារនាំចេញមើលទៅដូច។",
      },
      {
        en: "Use − / + to zoom between 30% and 200%, the circular arrow to fit to width, or Full screen for a full-window view.",
        km: "ប្រើ − / + ដើម្បីពង្រីកចន្លោះ ៣០% ដល់ ២០០% រូបព្រួញរង្វង់ដើម្បីសមទទឹង ឬ Full screen សម្រាប់ទិដ្ឋភាពពេញអេក្រង់។",
      },
      {
        en: "Click Export to Excel. The file is named after the report and the date, e.g. daily-repair-report-2026-08-31.xlsx.",
        km: "ចុច Export to Excel។ ឯកសារនឹងមានឈ្មោះតាមរបាយការណ៍ និងកាលបរិច្ឆេទ ឧទាហរណ៍ daily-repair-report-2026-08-31.xlsx។",
      },
    ],
    facts: [
      {
        en: "To print a spreadsheet report, export it and print from Excel. The Print button on those pages does not produce a usable page — only the A4 ticket sheet is set up for the browser's printer.",
        km: "ដើម្បីបោះពុម្ពរបាយការណ៍តារាង សូមនាំចេញ រួចបោះពុម្ពពី Excel។ ប៊ូតុង Print នៅទំព័រទាំងនោះមិនផ្តល់ទំព័រដែលប្រើបានទេ — មានតែសន្លឹក A4 ប៉ុណ្ណោះដែលរៀបចំសម្រាប់ម៉ាស៊ីនបោះពុម្ពរបស់កម្មវិធីរុករក។",
      },
      {
        en: "Export and Print are switched off while a report is loading or empty, and an empty period renders “No records in this period” instead of a blank table.",
        km: "Export និង Print ត្រូវបានបិទខណៈរបាយការណ៍កំពុងផ្ទុក ឬទទេ ហើយអំឡុងពេលទទេនឹងបង្ហាញ “No records in this period” ជំនួសតារាងទទេ។",
      },
      {
        en: "There is no CSV export in the reports area. CSV lives on the operational queue pages — Verify Repairs, Inspect Items and the machine registry.",
        km: "គ្មានការនាំចេញ CSV ក្នុងផ្នែករបាយការណ៍ទេ។ CSV មាននៅទំព័រជួរការងារ — Verify Repairs, Inspect Items និងបញ្ជីម៉ាស៊ីន។",
      },
    ],
  },
  {
    id: "print-ticket",
    icon: "printer",
    route: "/approve-verify",
    title: { en: "Printing one ticket for the customer", km: "បោះពុម្ពសំណុំរឿងមួយជូនអតិថិជន" },
    blurb: {
      en: "The A4 Technical Service Report — the sheet the customer receives with their machine.",
      km: "សន្លឹក A4 Technical Service Report — ជាសន្លឹកដែលអតិថិជនទទួលជាមួយម៉ាស៊ីនរបស់ពួកគេ។",
    },
    steps: [
      {
        en: "Open a ticket list — Verify Repairs or Inspect Items — and find the row.",
        km: "បើកបញ្ជីសំណុំរឿង — Verify Repairs ឬ Inspect Items — រួចរកជួរនោះ។",
      },
      {
        en: "Click the printer icon on the row (“Print Technical Report”). A preview panel slides in from the right showing the whole A4 sheet.",
        km: "ចុចរូបម៉ាស៊ីនបោះពុម្ពលើជួរ (“Print Technical Report”)។ ផ្ទាំងមើលជាមុននឹងរុញចូលពីខាងស្តាំ ដោយបង្ហាញសន្លឹក A4 ទាំងមូល។",
      },
      {
        en: "Check the customer, instrument, request, diagnosis, solution, the spare-parts table and the signature blocks.",
        km: "ពិនិត្យអតិថិជន ឧបករណ៍ សំណើ ការវិនិច្ឆ័យ ដំណោះស្រាយ តារាងគ្រឿងបន្លាស់ និងប្លុកហត្ថលេខា។",
      },
      {
        en: "Click Print Report to open your browser's print dialog — from there you can print on paper or save as PDF.",
        km: "ចុច Print Report ដើម្បីបើកប្រអប់បោះពុម្ពរបស់កម្មវិធីរុករក — ពីទីនោះអ្នកអាចបោះពុម្ពលើក្រដាស ឬរក្សាទុកជា PDF។",
      },
    ],
    facts: [
      {
        en: "The preview always uses the template currently published for the company, and re-reads it each time you open the panel — a freshly published design is picked up without reloading the tab.",
        km: "ការមើលជាមុនតែងតែប្រើគំរូដែលបានផ្សព្វផ្សាយសម្រាប់ក្រុមហ៊ុនបច្ចុប្បន្ន ហើយអានវាឡើងវិញរាល់ពេលអ្នកបើកផ្ទាំង — ការរចនាដែលទើបផ្សព្វផ្សាយត្រូវបានទទួលយកដោយមិនចាំបាច់ផ្ទុកផ្ទាំងឡើងវិញ។",
      },
      {
        en: "Each spare-part line is filled out from the catalogue — item name, what it fits, part number and unit price. A part number with no catalogue match prints as N/A.",
        km: "ជួរគ្រឿងបន្លាស់នីមួយៗត្រូវបានបំពេញពីបញ្ជី — ឈ្មោះគ្រឿង ម៉ាស៊ីនដែលប្រើបាន លេខគ្រឿង និងតម្លៃឯកតា។ លេខគ្រឿងដែលរកមិនឃើញក្នុងបញ្ជី នឹងបោះពុម្ពជា N/A។",
      },
      {
        en: "Only the sheet reaches the paper — the rest of the page is hidden while printing. Page setup is A4 portrait with a 10 mm margin.",
        km: "មានតែសន្លឹកប៉ុណ្ណោះដែលចេញលើក្រដាស — ផ្នែកផ្សេងទៀតនៃទំព័រត្រូវបានលាក់ខណៈបោះពុម្ព។ ការរៀបចំទំព័រគឺ A4 បញ្ឈរ ជាមួយគែម ១០ មម។",
      },
    ],
  },
];
