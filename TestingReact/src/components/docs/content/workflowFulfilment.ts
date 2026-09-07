/**
 * @file components/docs/content/workflowFulfilment.ts
 * @description Chapter 02, second half — parts, the customer's answer, the
 * repair itself, and the two ways a job can leave the chain. Split from
 * `workflow.ts` purely for file size.
 *
 * Same id-mirrors-route rule as `workflowIntake.ts`.
 */

import type { DocTopic } from "../docsTypes";

export const FULFILMENT_TOPICS: DocTopic[] = [
  {
    id: "spare-request",
    icon: "package",
    route: "/spare-request",
    title: { en: "Issue the parts", km: "ចេញគ្រឿងបន្លាស់" },
    blurb: {
      en: "The stock team's queue: jobs held because they are waiting on a part.",
      km: "ជួរការងាររបស់ក្រុមស្តុក៖ ការងារដែលផ្អាកទុកព្រោះរង់ចាំគ្រឿងបន្លាស់។",
    },
    steps: [
      {
        en: "Open Technical Request Spare from the Stock group.",
        km: "បើក Technical Request Spare ពីក្រុម Stock។",
      },
      {
        en: "Work down the list, checking each job's requested parts against what is actually on the shelf.",
        km: "ធ្វើការតាមបញ្ជី ដោយផ្ទៀងផ្ទាត់គ្រឿងបន្លាស់ដែលស្នើ ជាមួយអ្វីដែលមានពិតនៅលើធ្នើរ។",
      },
      {
        en: "Advance a job once its parts are available; it moves on toward repair approval.",
        km: "រុញការងារទៅមុខនៅពេលគ្រឿងបន្លាស់មានរួច; វានឹងបន្តទៅការអនុម័តជួសជុល។",
      },
    ],
    facts: [
      {
        en: "The Inspection tab on this page is there so you can see what is about to arrive in your queue, not only what is already stuck in it.",
        km: "ផ្ទាំង Inspection នៅទំព័រនេះមានដើម្បីឱ្យអ្នកឃើញអ្វីដែលនឹងចូលមកក្នុងជួររបស់អ្នក មិនត្រឹមតែអ្វីដែលជាប់នៅទីនោះរួចហើយ។",
      },
    ],
  },
  {
    id: "waiting-confirm",
    icon: "users",
    route: "/waiting-confirm",
    title: { en: "Record the customer's answer", km: "កត់ត្រាចម្លើយអតិថិជន" },
    blurb: {
      en: "Quotes sitting with the customer. Whoever speaks to them records the decision here.",
      km: "តម្លៃដែលកំពុងនៅជាមួយអតិថិជន។ អ្នកដែលនិយាយជាមួយពួកគេ កត់ត្រាការសម្រេចនៅទីនេះ។",
    },
    steps: [
      {
        en: "Open Set Waiting Customer and find the job by reference number, company or serial number.",
        km: "បើក Set Waiting Customer រួចរកការងារតាមលេខយោង ឈ្មោះក្រុមហ៊ុន ឬលេខសម្គាល់។",
      },
      {
        en: "Record what the customer said: approved for repair, rejected, or the machine is beyond repair.",
        km: "កត់ត្រាអ្វីដែលអតិថិជននិយាយ៖ យល់ព្រមឱ្យជួសជុល បដិសេធ ឬម៉ាស៊ីនជួសជុលមិនកើត។",
      },
      {
        en: "Approved jobs go to Sale Confirmed; rejected ones and write-offs leave the main chain for their own queues.",
        km: "ការងារដែលយល់ព្រមទៅ Sale Confirmed; ការងារបដិសេធ និងម៉ាស៊ីនខូចខ្លាំង ចេញពីខ្សែច្រវាក់សំខាន់ទៅជួររៀងៗខ្លួន។",
      },
    ],
    facts: [
      {
        en: "Everything sitting here is a live quote, which is exactly what the Quotation Follow-up report lists — with the contact's phone number and how many days they have been thinking about it.",
        km: "អ្វីៗដែលនៅទីនេះជាតម្លៃដែលកំពុងរង់ចាំ ដែលជាអ្វីដែលរបាយការណ៍ Quotation Follow-up រាយ — ជាមួយលេខទូរស័ព្ទអ្នកទំនាក់ទំនង និងចំនួនថ្ងៃដែលពួកគេកំពុងគិត។",
      },
    ],
  },
  {
    id: "confirmed-sale",
    icon: "boxes",
    route: "/confirmed-sale",
    title: { en: "Confirmed sales", km: "ការលក់ដែលបានបញ្ជាក់" },
    blurb: {
      en: "Jobs the customer has approved, ready for parts to be issued to the technician.",
      km: "ការងារដែលអតិថិជនយល់ព្រម រួចរាល់សម្រាប់ចេញគ្រឿងបន្លាស់ជូនជាង។",
    },
    steps: [
      {
        en: "Open Confirmed Sale from the Stock group.",
        km: "បើក Confirmed Sale ពីក្រុម Stock។",
      },
      {
        en: "Issue the approved parts to the technician, then move the job to Sent Spareparts.",
        km: "ចេញគ្រឿងបន្លាស់ដែលបានអនុម័តជូនជាង រួចផ្លាស់ការងារទៅ Sent Spareparts។",
      },
      {
        en: "Use the tabs to switch between what is still awaiting confirmation, what is confirmed, and what has already been issued.",
        km: "ប្រើផ្ទាំង ដើម្បីប្តូររវាងអ្វីដែលនៅរង់ចាំការបញ្ជាក់ អ្វីដែលបញ្ជាក់រួច និងអ្វីដែលបានចេញរួច។",
      },
    ],
  },
  {
    id: "approve-repair",
    icon: "wrench",
    route: "/approve-repair",
    title: { en: "Approve the repair", km: "អនុម័តការជួសជុល" },
    blurb: {
      en: "The gate between a quoted job and a job in progress. Approving it commits the stock.",
      km: "ច្រកចន្លោះការងារដែលបានស្នើតម្លៃ និងការងារកំពុងដំណើរការ។ ការអនុម័តគឺជាការប្រើស្តុកជាក់ស្តែង។",
    },
    steps: [
      {
        en: "Open Approve Repairing and press Approve on the job.",
        km: "បើក Approve Repairing រួចចុច Approve លើការងារនោះ។",
      },
      {
        en: "Read the confirmation carefully — it tells you what will be deducted before anything is.",
        km: "អានការបញ្ជាក់ដោយប្រុងប្រយ័ត្ន — វាប្រាប់អ្នកពីអ្វីដែលនឹងត្រូវកាត់ មុនពេលកាត់ពិត។",
      },
      {
        en: "Confirm. The repair date and your name are stamped on the ticket, and the attached parts come out of stock.",
        km: "បញ្ជាក់។ កាលបរិច្ឆេទជួសជុល និងឈ្មោះអ្នកត្រូវបានកត់លើសំណុំរឿង ហើយគ្រឿងបន្លាស់ភ្ជាប់ត្រូវកាត់ចេញពីស្តុក។",
      },
    ],
    facts: [
      {
        en: "This is the moment stock actually moves. Every stock report downstream — usage, movement, the ledger — dates the movement from here, not from when the part was first quoted.",
        km: "នេះជាពេលដែលស្តុកផ្លាស់ទីពិតប្រាកដ។ របាយការណ៍ស្តុកទាំងអស់ខាងក្រោយ — ការប្រើប្រាស់ ចលនា និងបញ្ជីចរាចរ — គិតកាលបរិច្ឆេទពីទីនេះ មិនមែនពីពេលស្នើតម្លៃទេ។",
      },
      {
        en: "Approval is refused when the job is not in a state where it makes sense — a charged job still sitting in Inspection has not been quoted to anyone yet.",
        km: "ការអនុម័តត្រូវបានបដិសេធ បើការងារមិននៅក្នុងស្ថានភាពសមហេតុផល — ការងារគិតថ្លៃដែលនៅ Inspection នៅឡើយ មិនទាន់បានស្នើតម្លៃទៅអ្នកណាទេ។",
      },
    ],
  },
  {
    id: "approve-verify",
    icon: "shield",
    route: "/approve-verify",
    title: { en: "Verify and close", km: "ផ្ទៀងផ្ទាត់ និងបិទការងារ" },
    blurb: {
      en: "Final QA. Nothing is finished until someone other than the technician says it is.",
      km: "ការត្រួតពិនិត្យចុងក្រោយ។ គ្មានអ្វីរួចរាល់ទេ រហូតដល់មានអ្នកផ្សេងក្រៅពីជាងបញ្ជាក់។",
    },
    steps: [
      {
        en: "Open Approve Verify to see the finished jobs waiting on a check.",
        km: "បើក Approve Verify ដើម្បីមើលការងាររួចរាល់ដែលរង់ចាំការត្រួតពិនិត្យ។",
      },
      {
        en: "Open the job and check the solution against the parts used.",
        km: "បើកការងារ រួចផ្ទៀងផ្ទាត់ដំណោះស្រាយជាមួយគ្រឿងបន្លាស់ដែលបានប្រើ។",
      },
      {
        en: "Press Verify to close it out. Your name and the finish date are recorded on the ticket.",
        km: "ចុច Verify ដើម្បីបិទ។ ឈ្មោះអ្នក និងកាលបរិច្ឆេទបញ្ចប់ត្រូវបានកត់ត្រាលើសំណុំរឿង។",
      },
      {
        en: "Print the ticket report for the customer, or export the whole queue to CSV.",
        km: "បោះពុម្ពរបាយការណ៍សំណុំរឿងជូនអតិថិជន ឬនាំចេញជួរទាំងមូលជា CSV។",
      },
    ],
    facts: [
      {
        en: "The printed ticket uses the layout set in Report Design Settings, so what the customer receives is whatever the manager published there.",
        km: "សំណុំរឿងបោះពុម្ពប្រើប្លង់ដែលកំណត់ក្នុង Report Design Settings ដូច្នេះអ្វីដែលអតិថិជនទទួល គឺជាអ្វីដែលអ្នកគ្រប់គ្រងបានផ្សព្វផ្សាយនៅទីនោះ។",
      },
    ],
  },
  {
    id: "rejected",
    icon: "users",
    route: "/rejected",
    title: { en: "Customer rejected", km: "អតិថិជនបដិសេធ" },
    blurb: {
      en: "Jobs the customer declined to have repaired. Kept, not deleted — this is where next quarter's machine sales come from.",
      km: "ការងារដែលអតិថិជនមិនព្រមឱ្យជួសជុល។ រក្សាទុក មិនលុប — នេះជាប្រភពនៃការលក់ម៉ាស៊ីនត្រីមាសក្រោយ។",
    },
    steps: [
      {
        en: "Open Customer Rejected to see every declined quote.",
        km: "បើក Customer Rejected ដើម្បីមើលតម្លៃដែលត្រូវបានបដិសេធទាំងអស់។",
      },
      {
        en: "Open a row to read the diagnosis and what the customer asked for instead.",
        km: "បើកជួរ ដើម្បីអានការវិនិច្ឆ័យ និងអ្វីដែលអតិថិជនស្នើជំនួស។",
      },
    ],
    facts: [
      {
        en: "These rows drive two reports: the Rejected & Scrap report, and the New Machine Sales Leads report.",
        km: "ជួរទាំងនេះបញ្ចូលទៅរបាយការណ៍ពីរ៖ Rejected & Scrap និង New Machine Sales Leads។",
      },
    ],
  },
  {
    id: "unrepairable",
    icon: "shield",
    route: "/unrepairable",
    title: { en: "Unrepairable", km: "ជួសជុលមិនកើត" },
    blurb: {
      en: "Machines judged beyond economical repair.",
      km: "ម៉ាស៊ីនដែលវិនិច្ឆ័យថាជួសជុលមិនកើត ឬមិនសមនឹងតម្លៃ។",
    },
    steps: [
      {
        en: "Mark the job unrepairable from either Technical Inspection/Repair or Sales Customer Response — the two-way network immediately alerts both departments.",
        km: "សម្គាល់ការងារថាជួសជុលមិនកើត (Unrepairable) ពីជាងបច្ចេកទេស ឬពីផ្នែកលក់ — ប្រព័ន្ធ Network ជូនដំណឹងទៅវិញទៅមកទាំងសងខាងភ្លាមៗ។",
      },
      {
        en: "Record the reason in the inspection notes — it is what the diagnostics report groups by model and feeds the Hot Sales replacement leads.",
        km: "កត់ត្រាមូលហេតុក្នុងកំណត់សម្គាល់វិនិច្ឆ័យ — វាជាអ្វីដែលរបាយការណ៍វិនិច្ឆ័យចងក្រងតាមម៉ូដែល និងបញ្ជូនទៅ Hot Sales Leads សម្រាប់លក់ម៉ាស៊ីនថ្មីជំនួស។",
      },
    ],
  },
];
