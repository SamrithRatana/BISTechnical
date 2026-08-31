/**
 * @file components/docs/content/adminPublishing.ts
 * @description Chapter 05 — the printed template, the notifications the
 * system sends out, and the deploy-safety readout. Split from
 * `adminSystem.ts` for file size.
 */

import type { DocTopic } from "../docsTypes";

export const PUBLISHING_TOPICS: DocTopic[] = [
  {
    id: "template-designer",
    icon: "printer",
    route: "/templates-settings",
    roles: ["Admin", "SuperAdmin", "Manager"],
    title: { en: "Design the printed report", km: "រចនារបាយការណ៍បោះពុម្ព" },
    blurb: {
      en: "A canvas for the A4 Technical Service Report: click any element and change what it says, where it sits, what data it shows, and whether it prints at all.",
      km: "ផ្ទាំងរចនាសម្រាប់សន្លឹក A4 Technical Service Report៖ ចុចធាតុណាមួយ រួចប្តូរអ្វីដែលវាសរសេរ កន្លែងដែលវាស្ថិតនៅ ទិន្នន័យដែលវាបង្ហាញ និងថាតើវាបោះពុម្ពឬអត់។",
    },
    steps: [
      {
        en: "Open Templates Settings and click the Technical Service Report card. Use the Design / Preview / Print tabs to move between editing and checking.",
        km: "បើក Templates Settings រួចចុចកាត Technical Service Report។ ប្រើផ្ទាំង Design / Preview / Print ដើម្បីប្តូររវាងការកែ និងការត្រួតពិនិត្យ។",
      },
      {
        en: "Click any part of the sheet — the logo, the title, a header box, a label, a value, a table column, a signature — to select it. The Property Inspector opens on the right.",
        km: "ចុចផ្នែកណាមួយនៃសន្លឹក — និមិត្តសញ្ញា ចំណងជើង ប្រអប់ក្បាល ស្លាក តម្លៃ ជួរឈរតារាង ឬហត្ថលេខា — ដើម្បីជ្រើសរើស។ Property Inspector នឹងបើកនៅខាងស្តាំ។",
      },
      {
        en: "Change the font, size, weight, alignment and colour; rewrite the printed wording; untick Show on report to hide an element; use the move buttons to reorder columns, rows and sections.",
        km: "ប្តូរពុម្ពអក្សរ ទំហំ កម្រាស់ ការតម្រឹម និងពណ៌; សរសេរអត្ថបទបោះពុម្ពឡើងវិញ; ដកធីក Show on report ដើម្បីលាក់ធាតុ; ប្រើប៊ូតុងផ្លាស់ទីដើម្បីរៀបលំដាប់ជួរឈរ ជួរដេក និងផ្នែក។",
      },
      {
        en: "Change what an element prints with Bound Data Field or the Database Fields Explorer, and add or drop printed lines with Add field / Remove field.",
        km: "ប្តូរអ្វីដែលធាតុបោះពុម្ព ដោយ Bound Data Field ឬ Database Fields Explorer ហើយបន្ថែម ឬដកបន្ទាត់បោះពុម្ព ដោយ Add field / Remove field។",
      },
      {
        en: "Use the left Studio Controls for page margin, fonts, spacing, the logo choice and size, table font size, cell padding and column widths.",
        km: "ប្រើ Studio Controls ខាងឆ្វេង សម្រាប់គែមទំព័រ ពុម្ពអក្សរ គម្លាត ជម្រើស និងទំហំនិមិត្តសញ្ញា ទំហំអក្សរតារាង ចន្លោះក្រឡា និងទទឹងជួរឈរ។",
      },
    ],
    facts: [
      {
        en: "Five numbered sections — Customer Information, Instrument Information, Customer Request, Diagnostic Analysis, Solution & Spare Parts — can each be hidden and reordered, as can the three signature blocks.",
        km: "ផ្នែកមានលេខទាំងប្រាំ — Customer Information, Instrument Information, Customer Request, Diagnostic Analysis, Solution & Spare Parts — អាចលាក់ និងរៀបលំដាប់បាន ដូចប្លុកហត្ថលេខាទាំងបីដែរ។",
      },
      {
        en: "The spare-parts table has nine possible columns. Unit Price, Total and Remarks are off by default — turn them on when the customer should see the money.",
        km: "តារាងគ្រឿងបន្លាស់មានជួរឈរអាចមានចំនួនប្រាំបួន។ Unit Price, Total និង Remarks បិទតាមលំនាំដើម — សូមបើកវាពេលអតិថិជនគួរឃើញតម្លៃ។",
      },
      {
        en: "Every printed string is rewordable, including the section headings and the box captions — so the sheet can carry your own house wording.",
        km: "អក្សរបោះពុម្ពគ្រប់ខ្សែអាចសរសេរឡើងវិញបាន រួមទាំងចំណងជើងផ្នែក និងចំណងជើងប្រអប់ — ដូច្នេះសន្លឹកនេះអាចប្រើពាក្យផ្ទាល់របស់ក្រុមហ៊ុនអ្នក។",
      },
      {
        en: "The same component draws this preview and the print itself, so what you design is exactly what prints.",
        km: "សមាសភាគដដែលគូរការមើលជាមុននេះ និងការបោះពុម្ពពិត ដូច្នេះអ្វីដែលអ្នករចនា គឺជាអ្វីដែលបោះពុម្ពពិតប្រាកដ។",
      },
    ],
  },
  {
    id: "publish-template",
    icon: "shield",
    route: "/templates-settings",
    roles: ["Admin", "SuperAdmin", "Manager"],
    title: { en: "Publish a template to everyone", km: "ផ្សព្វផ្សាយគំរូដល់អ្នកគ្រប់គ្នា" },
    blurb: {
      en: "How a design stops being your private draft and becomes the sheet every printout in the company uses.",
      km: "របៀបដែលការរចនាឈប់ជាសេចក្តីព្រាងផ្ទាល់ខ្លួន ហើយក្លាយជាសន្លឹកដែលការបោះពុម្ពទាំងអស់ក្នុងក្រុមហ៊ុនប្រើ។",
    },
    steps: [
      {
        en: "Design the sheet. The panel reads “Unsaved draft — only you see these changes until you press Save for All Users.”",
        km: "រចនាសន្លឹក។ ផ្ទាំងនឹងបង្ហាញ “Unsaved draft — only you see these changes until you press Save for All Users.”",
      },
      {
        en: "Click Save for All Users. On success the status line becomes “This design is live for all users.”",
        km: "ចុច Save for All Users។ ពេលជោគជ័យ បន្ទាត់ស្ថានភាពនឹងប្រែជា “This design is live for all users.”",
      },
      {
        en: "Discard Changes throws your draft away and returns to whatever is currently published.",
        km: "Discard Changes បោះបង់សេចក្តីព្រាងរបស់អ្នក ហើយត្រឡប់ទៅគំរូដែលកំពុងផ្សព្វផ្សាយបច្ចុប្បន្ន។",
      },
      {
        en: "Default Template resets the draft to the original factory design — you still have to publish it before anyone else gets it.",
        km: "Default Template កំណត់សេចក្តីព្រាងឡើងវិញទៅការរចនាដើម — អ្នកនៅតែត្រូវផ្សព្វផ្សាយ មុនអ្នកដទៃទទួលបាន។",
      },
    ],
    facts: [
      {
        en: "There are two layers, and knowing which you are looking at saves an argument: the PUBLISHED template is what everyone prints; the DRAFT is your work in progress, kept in this browser only.",
        km: "មានពីរស្រទាប់ ហើយការដឹងថាអ្នកកំពុងមើលមួយណា ជួយចៀសវាងការជជែក៖ គំរូ ផ្សព្វផ្សាយ គឺជាអ្វីដែលអ្នកគ្រប់គ្នាបោះពុម្ព; ចំណែក សេចក្តីព្រាង ជាការងារកំពុងធ្វើរបស់អ្នក រក្សាទុកតែក្នុងកម្មវិធីរុករកនេះ។",
      },
      {
        en: "Because the draft lives in this browser, clearing site data or moving to another machine loses an unpublished design. Publish, or keep a copy.",
        km: "ដោយសារសេចក្តីព្រាងស្ថិតក្នុងកម្មវិធីរុករកនេះ ការសម្អាតទិន្នន័យគេហទំព័រ ឬការប្តូរម៉ាស៊ីន នឹងធ្វើឱ្យបាត់ការរចនាដែលមិនទាន់ផ្សព្វផ្សាយ។ សូមផ្សព្វផ្សាយ ឬរក្សាច្បាប់ចម្លង។",
      },
      {
        en: "If you are not permitted to publish you are told plainly — “Only an Admin can publish the company template. Your draft is kept in this browser.” — and nothing is lost.",
        km: "បើអ្នកមិនមានសិទ្ធិផ្សព្វផ្សាយ អ្នកនឹងត្រូវបានប្រាប់ច្បាស់ — “Only an Admin can publish the company template. Your draft is kept in this browser.” — ហើយគ្មានអ្វីបាត់បង់ទេ។",
      },
      {
        en: "Only this A4 sheet can be published company-wide. The spreadsheet designer's Save keeps a copy in your own browser and changes nothing for anyone else, whatever its message says.",
        km: "មានតែសន្លឹក A4 នេះប៉ុណ្ណោះដែលអាចផ្សព្វផ្សាយទូទាំងក្រុមហ៊ុន។ ការ Save របស់កម្មវិធីរចនាតារាង រក្សាច្បាប់ចម្លងក្នុងកម្មវិធីរុករករបស់អ្នក ហើយមិនប្តូរអ្វីសម្រាប់អ្នកដទៃទេ ទោះសារបង្ហាញយ៉ាងណាក៏ដោយ។",
      },
    ],
  },
  {
    id: "telegram",
    icon: "bell",
    title: { en: "Telegram notifications", km: "ការជូនដំណឹងតាម Telegram" },
    blurb: {
      en: "Certain actions post a formatted message into the workshop's Telegram group, each into its own topic thread — nobody has to type an update.",
      km: "សកម្មភាពខ្លះផ្ញើសារទៅក្រុម Telegram របស់សិក្ខាសាលា ក្នុងខ្សែប្រធានបទរៀងៗខ្លួន — គ្មាននរណាត្រូវវាយសារធ្វើបច្ចុប្បន្នភាពទេ។",
    },
    steps: [
      {
        en: "Create a ticket and save it — a machine-received message posts to the Item Received thread.",
        km: "បង្កើតសំណុំរឿង រួចរក្សាទុក — សារទទួលម៉ាស៊ីននឹងផ្ញើទៅខ្សែ Item Received។",
      },
      {
        en: "Save an inspection — a message posts listing the parts requested.",
        km: "រក្សាទុកការវិនិច្ឆ័យ — សារនឹងផ្ញើ ដោយរាយគ្រឿងបន្លាស់ដែលបានស្នើ។",
      },
      {
        en: "Change a ticket's status from the queue table — the matching thread is notified.",
        km: "ប្តូរស្ថានភាពសំណុំរឿងពីតារាងជួរការងារ — ខ្សែដែលត្រូវគ្នានឹងទទួលការជូនដំណឹង។",
      },
      {
        en: "Use Stock In or Stock Out on the parts page — a stock message posts with the part, the quantity, your name and, for Stock Out, your reason.",
        km: "ប្រើ Stock In ឬ Stock Out នៅទំព័រគ្រឿងបន្លាស់ — សារស្តុកនឹងផ្ញើ ជាមួយឈ្មោះគ្រឿង ចំនួន ឈ្មោះអ្នក និងមូលហេតុរបស់អ្នកសម្រាប់ Stock Out។",
      },
    ],
    facts: [
      {
        en: "Before sending a status message the system re-reads the whole ticket, so the message carries the company, contact, phone, serial, service type and parts list even when the table row was a summary.",
        km: "មុនផ្ញើសារស្ថានភាព ប្រព័ន្ធអានសំណុំរឿងទាំងមូលឡើងវិញ ដូច្នេះសារមានឈ្មោះក្រុមហ៊ុន អ្នកទំនាក់ទំនង ទូរស័ព្ទ លេខសម្គាល់ ប្រភេទសេវា និងបញ្ជីគ្រឿងបន្លាស់ ទោះជួរតារាងជាសង្ខេបក៏ដោយ។",
      },
      {
        en: "Not every status has a thread: some transitions deliberately post nothing. If a stage seems to notify no one, that is why.",
        km: "មិនមែនគ្រប់ស្ថានភាពមានខ្សែទេ៖ ការផ្លាស់ប្តូរខ្លះមិនផ្ញើអ្វីដោយចេតនា។ បើដំណាក់កាលណាមួយមើលទៅមិនជូនដំណឹងអ្នកណា នេះជាមូលហេតុ។",
      },
      {
        en: "A failed send is not shown on screen. Telegram is a convenience, not a receipt — the system's own record is the ticket and the ledger.",
        km: "ការផ្ញើបរាជ័យមិនបង្ហាញលើអេក្រង់ទេ។ Telegram ជាភាពងាយស្រួល មិនមែនជាបង្កាន់ដៃទេ — កំណត់ត្រាពិតរបស់ប្រព័ន្ធគឺសំណុំរឿង និងបញ្ជីចរាចរ។",
      },
    ],
  },
  {
    id: "maintenance-window",
    icon: "life-buoy",
    roles: ["Admin", "SuperAdmin"],
    title: { en: "Is it safe to restart the system?", km: "តើសុវត្ថិភាពដើម្បីចាប់ផ្ដើមប្រព័ន្ធឡើងវិញទេ?" },
    blurb: {
      en: "An administrator's answer to one question: can I deploy or restart right now without landing in the middle of somebody's save?",
      km: "ចម្លើយរបស់អ្នកគ្រប់គ្រងចំពោះសំណួរតែមួយ៖ តើឥឡូវនេះខ្ញុំអាចដាក់ឱ្យប្រើ ឬចាប់ផ្ដើមឡើងវិញ ដោយមិនធ្លាក់ចំពេលនរណាម្នាក់កំពុងរក្សាទុកឬទេ?",
    },
    steps: [
      {
        en: "Click the wifi icon in the header to open the System status panel.",
        km: "ចុចរូបវ៉ាយហ្វាយក្នុងរបារក្បាល ដើម្បីបើកផ្ទាំង System status។",
      },
      {
        en: "Scroll to the Maintenance window block and read the badge: “Idle — safe to deploy” or “In use — do not deploy”.",
        km: "រំកិលទៅប្លុក Maintenance window រួចអានស្លាក៖ “Idle — safe to deploy” ឬ “In use — do not deploy”។",
      },
      {
        en: "Check the numbers underneath — active sessions, saves in progress, last change and last activity — and the reasons listed if it is not safe.",
        km: "ពិនិត្យលេខខាងក្រោម — វគ្គសកម្ម ការរក្សាទុកកំពុងដំណើរការ ការផ្លាស់ប្តូរចុងក្រោយ និងសកម្មភាពចុងក្រោយ — និងមូលហេតុដែលរាយ បើវាមិនសុវត្ថិភាព។",
      },
    ],
    facts: [
      {
        en: "The quiet period is two minutes, not ten seconds, because staff type into an inspection for a while between saves — a short gap means nothing.",
        km: "រយៈពេលស្ងាត់គឺពីរនាទី មិនមែនដប់វិនាទីទេ ព្រោះបុគ្គលិកវាយអត្ថបទក្នុងការវិនិច្ឆ័យមួយសន្ទុះរវាងការរក្សាទុក — គម្លាតខ្លីមិនមានន័យអ្វីទេ។",
      },
      {
        en: "Health checks are excluded from the activity counters, otherwise the indicator would be measuring itself.",
        km: "ការត្រួតពិនិត្យសុខភាពមិនត្រូវបានរាប់បញ្ចូលក្នុងឧបករណ៍រាប់សកម្មភាពទេ បើមិនដូច្នេះ សូចនាករនឹងវាស់ខ្លួនឯង។",
      },
      {
        en: "This block is only drawn for administrators — it is an operational answer, not something the workshop needs to see.",
        km: "ប្លុកនេះគូរតែសម្រាប់អ្នកគ្រប់គ្រងប៉ុណ្ណោះ — វាជាចម្លើយប្រតិបត្តិការ មិនមែនជាអ្វីដែលសិក្ខាសាលាត្រូវឃើញទេ។",
      },
    ],
  },
];
