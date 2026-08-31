/**
 * @file components/docs/content/inventoryStockReports.ts
 * @description Chapter 03, second half — the eight stock reports, and what
 * each one actually computes.
 *
 * These are the topics most worth getting exactly right: "usage", "hold",
 * "movement" and "transactions" sound interchangeable and are not, and reading
 * one as another is how a stock count ends up disagreeing with the system.
 */

import type { DocTopic } from "../docsTypes";

export const STOCK_REPORT_TOPICS: DocTopic[] = [
  {
    id: "sparepart-usage",
    icon: "chart",
    route: "/sparepart-usage",
    title: { en: "Spare Part Usage", km: "ការប្រើប្រាស់គ្រឿងបន្លាស់" },
    blurb: {
      en: "What was consumed over a period, per part, split between repair jobs and manual stock-outs.",
      km: "អ្វីដែលបានប្រើក្នុងអំឡុងពេលមួយ តាមគ្រឿងបន្លាស់នីមួយៗ បែងចែករវាងការងារជួសជុល និងការដកស្តុកដោយដៃ។",
    },
    steps: [
      {
        en: "Open Reports → Spare Parts & Stock → Spare Part Usage.",
        km: "បើក Reports → Spare Parts & Stock → Spare Part Usage។",
      },
      {
        en: "Set From and To, or click This month / Last month.",
        km: "កំណត់ From និង To ឬចុច This month / Last month។",
      },
      {
        en: "Choose the date basis: By movement date (when stock actually left the shelf) or By machine arrival date (what the machines received in this period consumed).",
        km: "ជ្រើសមូលដ្ឋានកាលបរិច្ឆេទ៖ By movement date (ពេលស្តុកចេញពីធ្នើរពិត) ឬ By machine arrival date (អ្វីដែលម៉ាស៊ីនចូលក្នុងអំឡុងពេលនេះបានប្រើ)។",
      },
      {
        en: "Read the summary line — Total used, From service jobs, Manual stock-out — then Export to Excel.",
        km: "អានបន្ទាត់សង្ខេប — Total used, From service jobs, Manual stock-out — រួចចុច Export to Excel។",
      },
    ],
    facts: [
      {
        en: "The used figure is NET. A part issued and later returned cancels out and neither movement appears; a return with no matching issue reads as negative usage.",
        km: "តួលេខប្រើប្រាស់គឺជាចំនួន សុទ្ធ។ គ្រឿងបន្លាស់ដែលចេញ រួចត្រឡប់មកវិញ នឹងលុបគ្នា ហើយចលនាទាំងពីរមិនបង្ហាញទេ; ការត្រឡប់មកវិញដោយគ្មានការចេញត្រូវគ្នា នឹងបង្ហាញជាការប្រើប្រាស់អវិជ្ជមាន។",
      },
      {
        en: "If you need the individual movements behind these totals, read the Stock Transactions ledger instead — nothing is netted there.",
        km: "បើអ្នកត្រូវការចលនានីមួយៗនៅពីក្រោយចំនួនសរុបទាំងនេះ សូមអានបញ្ជីចរាចរស្តុកជំនួសវិញ — គ្មានអ្វីត្រូវលុបគ្នានៅទីនោះទេ។",
      },
    ],
  },
  {
    id: "sparepart-hold",
    icon: "package",
    route: "/sparepart-hold",
    title: { en: "Spare Part Hold", km: "គ្រឿងបន្លាស់កក់ទុក" },
    blurb: {
      en: "Parts promised to open jobs but not yet consumed — and what that leaves you free to promise to anyone else.",
      km: "គ្រឿងបន្លាស់ដែលបានសន្យាឱ្យការងារកំពុងបើក ប៉ុន្តែមិនទាន់ប្រើ — និងអ្វីដែលនៅសល់ឱ្យអ្នកសន្យាដល់អ្នកដទៃបាន។",
    },
    steps: [
      {
        en: "Open Reports → Spare Parts & Stock → Spare Part Hold.",
        km: "បើក Reports → Spare Parts & Stock → Spare Part Hold។",
      },
      {
        en: "Read the summary: Total held and Parts oversold.",
        km: "អានសង្ខេប៖ Total held និង Parts oversold។",
      },
      {
        en: "Scan the Effective Stock column for negative numbers — those parts are promised to more jobs than exist on the shelf.",
        km: "មើលជួរឈរ Effective Stock រកលេខអវិជ្ជមាន — គ្រឿងបន្លាស់ទាំងនោះត្រូវបានសន្យាឱ្យការងារច្រើនជាងចំនួនដែលមានលើធ្នើរ។",
      },
    ],
    facts: [
      {
        en: "There is no date range on this report on purpose: “on hold” describes the present moment, not a period.",
        km: "របាយការណ៍នេះគ្មានចន្លោះកាលបរិច្ឆេទដោយចេតនា៖ “កក់ទុក” ពណ៌នាពេលបច្ចុប្បន្ន មិនមែនរយៈពេលទេ។",
      },
      {
        en: "Effective stock is current stock minus what is held. A part is put on hold when it is attached during inspection, and comes off hold when the repair is approved and the stock actually moves.",
        km: "ស្តុកជាក់ស្តែង គឺស្តុកបច្ចុប្បន្នដកចំនួនកក់ទុក។ គ្រឿងបន្លាស់ត្រូវកក់ទុកពេលភ្ជាប់ក្នុងការវិនិច្ឆ័យ ហើយចេញពីការកក់ទុកពេលការជួសជុលត្រូវបានអនុម័ត ហើយស្តុកផ្លាស់ទីពិត។",
      },
    ],
  },
  {
    id: "stock-transactions",
    icon: "layers",
    route: "/stock-transactions",
    title: { en: "Stock Transactions ledger", km: "បញ្ជីចរាចរស្តុក" },
    blurb: {
      en: "Every individual movement in the period, newest first, with nothing netted off — the raw record of what happened.",
      km: "ចលនានីមួយៗក្នុងអំឡុងពេល តាមលំដាប់ថ្មីមុន ដោយគ្មានការលុបគ្នា — ជាកំណត់ត្រាឆៅនៃអ្វីដែលបានកើតឡើង។",
    },
    steps: [
      {
        en: "Open Reports → Spare Parts & Stock → Stock Transactions and set the period.",
        km: "បើក Reports → Spare Parts & Stock → Stock Transactions រួចកំណត់អំឡុងពេល។",
      },
      {
        en: "Use the Show buttons to narrow it: All Transactions, Stock In Only, Stock Out Only, Adjustments Only, Manual Out Only.",
        km: "ប្រើប៊ូតុង Show ដើម្បីបង្រួម៖ All Transactions, Stock In Only, Stock Out Only, Adjustments Only, Manual Out Only។",
      },
      {
        en: "Read the Type column for direction and any reversal marker, and Balance for the balance immediately after that movement.",
        km: "អានជួរឈរ Type សម្រាប់ទិសដៅ និងសញ្ញាបញ្ច្រាស់ ហើយ Balance សម្រាប់សមតុល្យភ្លាមបន្ទាប់ពីចលនានោះ។",
      },
    ],
    facts: [
      {
        en: "Source tells you where a movement came from: Service Job, Adjustment (a direct quantity edit) or Manual Out (issued with a reason).",
        km: "Source ប្រាប់អ្នកថាចលនាមកពីណា៖ Service Job, Adjustment (ការកែចំនួនដោយផ្ទាល់) ឬ Manual Out (ចេញដោយមានមូលហេតុ)។",
      },
      {
        en: "A movement later undone is marked “(Reversed later)”, and the movement that undid it is marked “(Reversal of earlier)” — both markers can appear on one row.",
        km: "ចលនាដែលត្រូវបានលុបចោលពេលក្រោយ មានសញ្ញា “(Reversed later)” ហើយចលនាដែលលុបវាមានសញ្ញា “(Reversal of earlier)” — សញ្ញាទាំងពីរអាចលេចលើជួរតែមួយ។",
      },
      {
        en: "Changing the Show filter reloads the report without resetting the dates you picked.",
        km: "ការប្តូរតម្រង Show ផ្ទុករបាយការណ៍ឡើងវិញ ដោយមិនកំណត់កាលបរិច្ឆេទដែលអ្នកបានជ្រើសឡើងវិញទេ។",
      },
    ],
  },
  {
    id: "stock-movement",
    icon: "chart",
    route: "/stock-movement",
    title: { en: "Stock Movement summary", km: "សង្ខេបចលនាស្តុក" },
    blurb: {
      en: "Per part: what the shelf held at the start, what moved in and out, and what it held at the end. This is the view a physical count is checked against.",
      km: "តាមគ្រឿងបន្លាស់នីមួយៗ៖ អ្វីដែលធ្នើរមានពេលចាប់ផ្ដើម អ្វីដែលចូល និងចេញ និងអ្វីដែលនៅសល់ពេលបញ្ចប់។ នេះជាទិដ្ឋភាពដែលការរាប់ស្តុកជាក់ស្តែងត្រូវប្រៀបធៀបជាមួយ។",
    },
    steps: [
      {
        en: "Open Reports → Spare Parts & Stock → Stock Movement and set the period.",
        km: "បើក Reports → Spare Parts & Stock → Stock Movement រួចកំណត់អំឡុងពេល។",
      },
      {
        en: "Compare each part's Closing balance against its Current Stock column.",
        km: "ប្រៀបធៀបសមតុល្យ Closing របស់គ្រឿងបន្លាស់នីមួយៗ ជាមួយជួរឈរ Current Stock។",
      },
      {
        en: "Read “Moved since” in the summary — it counts parts whose closing balance no longer matches the live catalogue, i.e. stock that moved after your window ended.",
        km: "អាន “Moved since” ក្នុងសង្ខេប — វារាប់គ្រឿងបន្លាស់ដែលសមតុល្យបញ្ចប់លែងត្រូវនឹងបញ្ជីបច្ចុប្បន្ន ពោលគឺស្តុកដែលផ្លាស់ទីក្រោយពេលអំឡុងរបស់អ្នកបញ្ចប់។",
      },
    ],
    facts: [
      {
        en: "Opening and closing balances are not recalculated by the report — they are read from the audit trail itself, so they always agree with it.",
        km: "សមតុល្យដើម និងចុងមិនត្រូវបានគណនាឡើងវិញដោយរបាយការណ៍ទេ — វាអានពីកំណត់ត្រាត្រួតពិនិត្យផ្ទាល់ ដូច្នេះវាតែងតែស៊ីគ្នាជាមួយកំណត់ត្រានោះ។",
      },
      {
        en: "This report answers “do the numbers balance”. The Stock Transactions ledger answers “what happened”. Read them together when they disagree.",
        km: "របាយការណ៍នេះឆ្លើយថា “តើលេខស៊ីគ្នាទេ”។ បញ្ជីចរាចរស្តុកឆ្លើយថា “តើមានអ្វីកើតឡើង”។ សូមអានទាំងពីរជាមួយគ្នា ពេលវាមិនស៊ីគ្នា។",
      },
    ],
  },
  {
    id: "stock-adjustments",
    icon: "wrench",
    route: "/stock-adjustments",
    title: { en: "Stock Adjustments", km: "ការកែតម្រូវស្តុក" },
    blurb: {
      en: "Only the changes made by editing a quantity directly, rather than through a repair — the audit-sensitive category.",
      km: "មានតែការផ្លាស់ប្តូរដែលធ្វើឡើងដោយកែចំនួនដោយផ្ទាល់ មិនមែនតាមរយៈការជួសជុល — ជាប្រភេទដែលការត្រួតពិនិត្យផ្តោតលើ។",
    },
    steps: [
      {
        en: "Open Reports → Spare Parts & Stock → Stock Adjustments and set the period.",
        km: "បើក Reports → Spare Parts & Stock → Stock Adjustments រួចកំណត់អំឡុងពេល។",
      },
      {
        en: "Read the Type column — Increase or Decrease — and compare Before and After against the stated Reason on each row.",
        km: "អានជួរឈរ Type — Increase ឬ Decrease — ហើយប្រៀបធៀប Before និង After ជាមួយ Reason ដែលបានសរសេរលើជួរនីមួយៗ។",
      },
    ],
    facts: [
      {
        en: "There is no repair ticket behind these rows. The reason someone typed is the only explanation of why the number changed — which is why Stock Out insists on one.",
        km: "គ្មានសំណុំរឿងជួសជុលនៅពីក្រោយជួរទាំងនេះទេ។ មូលហេតុដែលមាននរណាម្នាក់វាយ គឺជាការពន្យល់តែមួយគត់ថាហេតុអ្វីលេខប្រែប្រួល — ដែលជាមូលហេតុដែល Stock Out ទាមទារវា។",
      },
      {
        en: "Both the balance before and after are shown, because an adjustment only means something as a difference against what the system previously believed.",
        km: "សមតុល្យមុន និងក្រោយ ត្រូវបានបង្ហាញទាំងពីរ ព្រោះការកែតម្រូវមានន័យតែជាភាពខុសគ្នាធៀបនឹងអ្វីដែលប្រព័ន្ធជឿពីមុនប៉ុណ្ណោះ។",
      },
    ],
  },
  {
    id: "stock-reconciliation",
    icon: "shield",
    route: "/stock-reconciliation",
    title: { en: "Stock Reconciliation", km: "ការផ្ទៀងផ្ទាត់ស្តុក" },
    blurb: {
      en: "Why the Telegram notification count and the usage figure disagree for a period — by listing every deduction that was later undone.",
      km: "ហេតុអ្វីចំនួនការជូនដំណឹង Telegram និងតួលេខប្រើប្រាស់មិនស៊ីគ្នាក្នុងអំឡុងពេលមួយ — ដោយរាយរាល់ការកាត់ចេញដែលត្រូវបានលុបចោលពេលក្រោយ។",
    },
    steps: [
      {
        en: "Open Reports → Spare Parts & Stock → Stock Reconciliation and set the disputed period.",
        km: "បើក Reports → Spare Parts & Stock → Stock Reconciliation រួចកំណត់អំឡុងពេលដែលមានវិវាទ។",
      },
      {
        en: "Read the summary left to right: Notifications sent, Recorded in ledger, Reported as used, Reversed pairs, Unrecorded movements.",
        km: "អានសង្ខេបពីឆ្វេងទៅស្តាំ៖ Notifications sent, Recorded in ledger, Reported as used, Reversed pairs, Unrecorded movements។",
      },
      {
        en: "In the table, read each reversed pair — when the part went out, when it came back and how long it was out — and check the “In ledger?” column.",
        km: "ក្នុងតារាង អានគូបញ្ច្រាស់នីមួយៗ — ពេលគ្រឿងបន្លាស់ចេញ ពេលវាត្រឡប់មកវិញ និងរយៈពេលដែលវាចេញ — ហើយពិនិត្យជួរឈរ “In ledger?”។",
      },
    ],
    facts: [
      {
        en: "A row reading “No — not in ledger” is a movement the audit trail never recorded. Those also appear on Stock Data Health as possible unrecorded movements.",
        km: "ជួរដែលបង្ហាញ “No — not in ledger” គឺជាចលនាដែលកំណត់ត្រាត្រួតពិនិត្យមិនដែលកត់ត្រា។ ជួរទាំងនោះក៏លេចនៅ Stock Data Health ជាចលនាដែលអាចមិនបានកត់ត្រាផងដែរ។",
      },
      {
        en: "This page exists because a real disagreement — notifications showing more stock-outs than the usage report — could previously only be explained by querying the database by hand.",
        km: "ទំព័រនេះមានឡើងព្រោះភាពមិនស៊ីគ្នាពិតប្រាកដមួយ — ការជូនដំណឹងបង្ហាញការដកស្តុកច្រើនជាងរបាយការណ៍ប្រើប្រាស់ — ពីមុនអាចពន្យល់បានតែដោយសួរមូលដ្ឋានទិន្នន័យដោយដៃប៉ុណ្ណោះ។",
      },
    ],
  },
  {
    id: "stock-health",
    icon: "gauge",
    route: "/stock-health",
    title: { en: "Stock Data Health", km: "សុខភាពទិន្នន័យស្តុក" },
    blurb: {
      en: "A standing audit of the faults that make stock numbers disagree. It reports problems; it never fixes them.",
      km: "ការត្រួតពិនិត្យជាប់លាប់លើកំហុសដែលធ្វើឱ្យលេខស្តុកមិនស៊ីគ្នា។ វារាយការណ៍បញ្ហា ប៉ុន្តែមិនដែលកែវាទេ។",
    },
    steps: [
      {
        en: "Open Reports → Spare Parts & Stock → Stock Data Health. There is no date range — these are standing issues, not a period.",
        km: "បើក Reports → Spare Parts & Stock → Stock Data Health។ គ្មានចន្លោះកាលបរិច្ឆេទទេ — ទាំងនេះជាបញ្ហាជាប់លាប់ មិនមែនតាមអំឡុងពេលទេ។",
      },
      {
        en: "Work down by Severity — High, Medium, Low — reading the Issue category and the “What is wrong” detail on each row.",
        km: "ធ្វើការតាមលំដាប់ Severity — High, Medium, Low — ដោយអានប្រភេទបញ្ហា និងព័ត៌មានលម្អិត “What is wrong” លើជួរនីមួយៗ។",
      },
      {
        en: "Use the Report No column to trace an issue back to the ticket it came from, then Export to hand the list to whoever will correct the data.",
        km: "ប្រើជួរឈរ Report No ដើម្បីតាមដានបញ្ហាត្រឡប់ទៅសំណុំរឿងដើម រួច Export ដើម្បីប្រគល់បញ្ជីនេះទៅអ្នកដែលនឹងកែទិន្នន័យ។",
      },
    ],
    facts: [
      {
        en: "Five things are detected: a notification with no ledger row, an impossible balance, a duplicate part name, negative stock, and a restored part with no matching issue.",
        km: "មានប្រាំយ៉ាងត្រូវបានរកឃើញ៖ ការជូនដំណឹងគ្មានជួរក្នុងបញ្ជីចរាចរ សមតុល្យមិនអាចទៅរួច ឈ្មោះគ្រឿងបន្លាស់ស្ទួន ស្តុកអវិជ្ជមាន និងគ្រឿងបន្លាស់ដែលបានស្តារឡើងវិញដោយគ្មានការចេញត្រូវគ្នា។",
      },
      {
        en: "It deliberately repairs nothing: merging two duplicate parts, correcting a balance and chasing a missing record each need a different human decision.",
        km: "វាមិនកែអ្វីទាំងអស់ដោយចេតនា៖ ការបញ្ចូលគ្រឿងបន្លាស់ស្ទួនពីរ ការកែសមតុល្យ និងការតាមរកកំណត់ត្រាដែលបាត់ ត្រូវការការសម្រេចចិត្តរបស់មនុស្សខុសៗគ្នា។",
      },
    ],
  },
  {
    id: "stock-dead",
    icon: "boxes",
    route: "/stock-dead",
    title: { en: "Dead Stock", km: "ស្តុកគាំង" },
    blurb: {
      en: "Parts still holding stock that nothing has touched for 90 days — money sitting on a shelf.",
      km: "គ្រឿងបន្លាស់ដែលនៅមានស្តុក ប៉ុន្តែគ្មានអ្វីប៉ះពាល់រយៈពេល ៩០ ថ្ងៃ — ជាលុយដែលដេកនៅលើធ្នើរ។",
    },
    steps: [
      {
        en: "Open Reports → Spare Parts & Stock → Dead Stock. The idle window is fixed at 90 days.",
        km: "បើក Reports → Spare Parts & Stock → Dead Stock។ រយៈពេលគាំងត្រូវបានកំណត់ថេរ ៩០ ថ្ងៃ។",
      },
      {
        en: "Check the Available column — stock quantity minus what is on hold — before deciding anything. Held stock is idle but already committed.",
        km: "ពិនិត្យជួរឈរ Available — ចំនួនស្តុកដកចំនួនកក់ទុក — មុននឹងសម្រេចអ្វីមួយ។ ស្តុកកក់ទុកគឺគាំង ប៉ុន្តែបានប្តេជ្ញាឱ្យការងាររួចហើយ។",
      },
      {
        en: "Read Last Movement, or “Never moved” where there is no movement on record at all.",
        km: "អាន Last Movement ឬ “Never moved” សម្រាប់ជួរដែលគ្មានចលនាកត់ត្រាទាល់តែសោះ។",
      },
    ],
    facts: [
      {
        en: "“Never moved” means there is no row in the ledger — not necessarily that the part never physically moved.",
        km: "“Never moved” មានន័យថាគ្មានជួរក្នុងបញ្ជីចរាចរ — មិនចាំបាច់មានន័យថាគ្រឿងបន្លាស់នោះមិនដែលផ្លាស់ទីជាក់ស្តែងទេ។",
      },
      {
        en: "The audit trail only begins from the date stock tracking was switched on, so a part whose last real movement predates that shows as never moved. Confirm against the physical shelf before writing anything off.",
        km: "កំណត់ត្រាត្រួតពិនិត្យចាប់ផ្ដើមតែពីថ្ងៃដែលការតាមដានស្តុកត្រូវបានបើកប៉ុណ្ណោះ ដូច្នេះគ្រឿងបន្លាស់ដែលមានចលនាចុងក្រោយមុនពេលនោះ នឹងបង្ហាញថាមិនដែលផ្លាស់ទី។ សូមផ្ទៀងផ្ទាត់នឹងធ្នើរជាក់ស្តែងមុននឹងលុបចោលអ្វីមួយ។",
      },
    ],
  },
];
