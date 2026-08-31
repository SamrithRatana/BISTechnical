/**
 * @file components/docs/content/workflowIntake.ts
 * @description Chapter 02, first half — a machine arriving and being
 * diagnosed. Split from `workflow.ts` purely for file size; the chapter is one
 * thing and is assembled there.
 *
 * Every topic id mirrors its route slug, because `LifecycleRail` jumps here by
 * stripping the leading slash off a stage's `route`. Renaming an id without
 * renaming the route (or the reverse) silently breaks that jump.
 */

import type { DocTopic } from "../docsTypes";

export const INTAKE_TOPICS: DocTopic[] = [
  {
    id: "receive-item",
    icon: "clipboard",
    route: "/receive-item",
    title: { en: "Book a machine in", km: "ទទួលម៉ាស៊ីនចូល" },
    blurb: {
      en: "The intake queue — machines just booked in, waiting to be sent for diagnosis.",
      km: "ជួរទទួលចូល — ម៉ាស៊ីនដែលទើបចុះបញ្ជី កំពុងរង់ចាំបញ្ជូនទៅវិនិច្ឆ័យ។",
    },
    steps: [
      {
        en: "Open Received Items from the sidebar's Technical group.",
        km: "បើក Received Items ពីក្រុម Technical ក្នុងរបារចំហៀង។",
      },
      {
        en: "Add the intake record with the customer, the machine and its serial number. The customer and item fields search as you type, and you can create a new one from the same box if it is not there yet.",
        km: "បញ្ចូលកំណត់ត្រាទទួលចូល ដោយដាក់អតិថិជន ម៉ាស៊ីន និងលេខសម្គាល់។ វាលអតិថិជន និងម៉ាស៊ីនស្វែងរកពេលវាយ ហើយអ្នកអាចបង្កើតថ្មីពីប្រអប់នោះតែម្តង បើមិនទាន់មាន។",
      },
      {
        en: "Set the priority and whether the work happens in the workshop or on site.",
        km: "កំណត់អាទិភាព និងថាតើការងារធ្វើនៅសិក្ខាសាលា ឬនៅកន្លែងអតិថិជន។",
      },
      {
        en: "Use the row's status control to send the machine on for diagnosis; it leaves this queue and appears in Inspect Items.",
        km: "ប្រើប៊ូតុងស្ថានភាពលើជួរ ដើម្បីបញ្ជូនម៉ាស៊ីនទៅវិនិច្ឆ័យ; វានឹងចាកចេញពីជួរនេះ ហើយបង្ហាញនៅ Inspect Items។",
      },
    ],
    facts: [
      {
        en: 'The status is stored as "Item Recieved" — the misspelling is in the database, so that is what appears in the Status column and in report filters.',
        km: 'ស្ថានភាពរក្សាទុកជា "Item Recieved" — ការសរសេរខុសនេះមាននៅក្នុងមូលដ្ឋានទិន្នន័យ ដូច្នេះវាបង្ហាញបែបនេះក្នុងជួរឈរ Status និងក្នុងតម្រងរបាយការណ៍។',
      },
      {
        en: "Opening a row instead of advancing it lets you correct the intake record — wrong serial number, wrong customer.",
        km: "បើកជួរជំនួសឱ្យការរុញទៅមុខ អនុញ្ញាតឱ្យអ្នកកែកំណត់ត្រាទទួលចូល — លេខសម្គាល់ខុស ឬអតិថិជនខុស។",
      },
    ],
  },
  {
    id: "inspect-item",
    icon: "search",
    route: "/inspect-item",
    title: { en: "Diagnose and quote", km: "វិនិច្ឆ័យ និងកំណត់តម្លៃ" },
    blurb: {
      en: "Machines being diagnosed now. This is where the fault, the fix and the parts needed are recorded.",
      km: "ម៉ាស៊ីនកំពុងវិនិច្ឆ័យឥឡូវនេះ។ នេះជាកន្លែងកត់ត្រាបញ្ហា ដំណោះស្រាយ និងគ្រឿងបន្លាស់ត្រូវការ។",
    },
    steps: [
      {
        en: "Find the machine in the Inspect Items queue and press Accept to open the inspection dialog.",
        km: "រកម៉ាស៊ីនក្នុងជួរ Inspect Items រួចចុច Accept ដើម្បីបើកប្រអប់វិនិច្ឆ័យ។",
      },
      {
        en: "Write what you found in Inspection and what you intend to do in Solution.",
        km: "សរសេរអ្វីដែលអ្នករកឃើញក្នុងវាល Inspection និងអ្វីដែលអ្នកនឹងធ្វើក្នុងវាល Solution។",
      },
      {
        en: "Choose the service type: Free (under contract or warranty) or Charge (the customer pays).",
        km: "ជ្រើសរើសប្រភេទសេវា៖ Free (ក្រោមកិច្ចសន្យា ឬធានា) ឬ Charge (អតិថិជនបង់ថ្លៃ)។",
      },
      {
        en: "Search the parts catalogue and add each part you need, with its quantity and whether it is a Fix, a Replace or Free. The eye icon shows the part's photo, price and stock before you commit to it.",
        km: "ស្វែងរកបញ្ជីគ្រឿងបន្លាស់ រួចបន្ថែមគ្រឿងនីមួយៗ ជាមួយបរិមាណ និងលក្ខខណ្ឌ Fix, Replace ឬ Free។ រូបភ្នែកបង្ហាញរូបថត តម្លៃ និងស្តុករបស់គ្រឿងបន្លាស់ មុនពេលអ្នកសម្រេច។",
      },
      {
        en: "Save. The ticket moves to Inspection, and from there to whichever queue matches what it is waiting for — parts, or the customer's answer.",
        km: "រក្សាទុក។ សំណុំរឿងផ្លាស់ទៅ Inspection ហើយបន្តទៅជួរដែលត្រូវនឹងអ្វីដែលវារង់ចាំ — គ្រឿងបន្លាស់ ឬចម្លើយពីអតិថិជន។",
      },
    ],
    facts: [
      {
        en: "Adding a part here reserves it against the job but does not yet remove it from stock — that happens when the repair is approved. The gap between the two is what the Spare Part Hold report measures.",
        km: "ការបន្ថែមគ្រឿងបន្លាស់ត្រឹមតែកក់ទុកសម្រាប់ការងារប៉ុណ្ណោះ មិនទាន់កាត់ចេញពីស្តុកទេ — ការកាត់កើតឡើងពេលអនុម័តជួសជុល។ គម្លាតរវាងពីរនេះជាអ្វីដែលរបាយការណ៍ Spare Part Hold វាស់។",
      },
      {
        en: "Re-saving an inspection reconciles the parts list against what was stored, so removing a line here really removes it rather than adding a duplicate.",
        km: "ការរក្សាទុកឡើងវិញនឹងផ្ទៀងផ្ទាត់បញ្ជីគ្រឿងបន្លាស់ជាមួយអ្វីដែលរក្សាទុករួច ដូច្នេះការលុបជួរមួយចេញ គឺលុបពិត មិនមែនបន្ថែមស្ទួនទេ។",
      },
    ],
  },
  {
    id: "inspection",
    icon: "layers",
    route: "/inspection",
    title: { en: "Inspection records", km: "កំណត់ត្រាការវិនិច្ឆ័យ" },
    blurb: {
      en: "Everything already diagnosed, with tabs across the stages that follow — so you can see where each job went next.",
      km: "អ្វីៗដែលបានវិនិច្ឆ័យរួច ជាមួយផ្ទាំងតាមដំណាក់កាលបន្ទាប់ — ដើម្បីមើលថាការងារនីមួយៗទៅណាបន្ត។",
    },
    steps: [
      {
        en: "Open Inspection to see the diagnosed jobs.",
        km: "បើក Inspection ដើម្បីមើលការងារដែលបានវិនិច្ឆ័យ។",
      },
      {
        en: "Use the tabs across the top — Inspection, Awaiting Sparepart, Awaiting Customer Confirm, Sale Confirmed, Sent Spareparts — to follow a job past this point without leaving the page.",
        km: "ប្រើផ្ទាំងខាងលើ — Inspection, Awaiting Sparepart, Awaiting Customer Confirm, Sale Confirmed, Sent Spareparts — ដើម្បីតាមដានការងារបន្ត ដោយមិនចាំបាច់ចេញពីទំព័រនេះ។",
      },
      {
        en: "Open any row to read the full diagnosis, the quoted parts and the audit trail of who did what and when.",
        km: "បើកជួរណាមួយ ដើម្បីអានការវិនិច្ឆ័យពេញលេញ គ្រឿងបន្លាស់ដែលបានស្នើ និងកំណត់ត្រាថានរណាធ្វើអ្វី នៅពេលណា។",
      },
    ],
  },
];
