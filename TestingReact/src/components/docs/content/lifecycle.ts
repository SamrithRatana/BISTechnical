/**
 * @file components/docs/content/lifecycle.ts
 * @description The repair chain, as the rail draws it.
 *
 * `status` values are copied verbatim from `services/types.ts`'s
 * `SERVICE_STATUSES_DB` — including **"Item Recieved"**, which is misspelled in
 * the database and therefore misspelled on screen. The manual reproduces it
 * exactly on purpose: a reader comparing this page with a real ticket, or
 * typing the value into a report filter, has to see the same characters the
 * system uses. Correcting it here would be the one edit guaranteed to mislead.
 *
 * `topicId` is stated rather than derived from `route`. Stripping the slash off
 * the route happened to work for all eleven of these, but it is a string
 * operation standing in for a contract: a stage whose route carried a query
 * (`/profile?tab=security` is already that shape elsewhere in the catalogue),
 * or one pointing at a page with no topic, would fail SILENTLY — the click
 * would simply do nothing. Written out, it is checkable, and `content/index.ts`
 * checks it on every dev boot.
 */

import type { LifecycleStage } from "../docsTypes";

export const LIFECYCLE_STAGES: readonly LifecycleStage[] = [
  {
    status: "Item Recieved",
    route: "/receive-item",
    topicId: "receive-item",
    accent: "violet",
    label: { en: "Booked in", km: "ទទួលម៉ាស៊ីនចូល" },
    note: {
      en: "The machine is registered against a customer and given a reference number.",
      km: "ម៉ាស៊ីនត្រូវបានចុះបញ្ជីតាមអតិថិជន ហើយទទួលបានលេខយោង។",
    },
  },
  {
    status: "Inspecting",
    route: "/inspect-item",
    topicId: "inspect-item",
    accent: "cyan",
    label: { en: "Being diagnosed", km: "កំពុងវិនិច្ឆ័យ" },
    note: {
      en: "A technician has accepted the job and is finding the fault.",
      km: "ជាងបានទទួលយកការងារ ហើយកំពុងស្វែងរកបញ្ហា។",
    },
  },
  {
    status: "Inspection",
    route: "/inspection",
    topicId: "inspection",
    accent: "cyan",
    label: { en: "Diagnosis recorded", km: "កត់ត្រាការវិនិច្ឆ័យរួច" },
    note: {
      en: "Findings, solution, service type and the parts needed are saved.",
      km: "លទ្ធផលរកឃើញ ដំណោះស្រាយ ប្រភេទសេវា និងគ្រឿងបន្លាស់ត្រូវការ ត្រូវបានរក្សាទុក។",
    },
  },
  {
    status: "Awaiting Sparepart",
    route: "/spare-request",
    topicId: "spare-request",
    accent: "amber",
    label: { en: "Waiting on parts", km: "រង់ចាំគ្រឿងបន្លាស់" },
    note: {
      en: "Held until the stock team can issue what the diagnosis asked for.",
      km: "ផ្អាកទុករហូតដល់ក្រុមស្តុកចេញគ្រឿងបន្លាស់តាមការវិនិច្ឆ័យ។",
    },
  },
  {
    status: "Awaiting Customer Confirm",
    route: "/waiting-confirm",
    topicId: "waiting-confirm",
    accent: "amber",
    label: { en: "Quote with the customer", km: "រង់ចាំអតិថិជនឯកភាព" },
    note: {
      en: "The customer has the price and has not yet said yes or no.",
      km: "អតិថិជនបានទទួលតម្លៃ ហើយមិនទាន់ឆ្លើយតបនៅឡើយ។",
    },
  },
  {
    status: "Sale Confirmed",
    route: "/confirmed-sale",
    topicId: "confirmed-sale",
    accent: "emerald",
    label: { en: "Customer approved", km: "អតិថិជនយល់ព្រម" },
    note: {
      en: "Sales has the go-ahead; parts can now be issued to the technician.",
      km: "ផ្នែកលក់បានយល់ព្រម; អាចចេញគ្រឿងបន្លាស់ជូនជាងបាន។",
    },
  },
  {
    status: "Sent Spareparts",
    route: "/confirmed-sale",
    topicId: "confirmed-sale",
    accent: "emerald",
    label: { en: "Parts issued", km: "បានចេញគ្រឿងបន្លាស់" },
    note: {
      en: "A tab, not a page of its own — the parts have left stock for this job.",
      km: "ជាផ្ទាំង មិនមែនទំព័រដាច់ដោយឡែក — គ្រឿងបន្លាស់បានចេញពីស្តុកសម្រាប់ការងារនេះ។",
    },
  },
  {
    status: "Repairing",
    route: "/approve-repair",
    topicId: "approve-repair",
    accent: "sky",
    label: { en: "Repair approved", km: "អនុម័តឱ្យជួសជុល" },
    note: {
      en: "Approving stamps the repair date and technician, and deducts the parts from stock.",
      km: "ការអនុម័តនឹងកត់កាលបរិច្ឆេទ និងឈ្មោះជាង ព្រមទាំងកាត់គ្រឿងបន្លាស់ចេញពីស្តុក។",
    },
  },
  {
    status: "Finished",
    route: "/approve-verify",
    topicId: "approve-verify",
    accent: "emerald",
    label: { en: "Awaiting final check", km: "រង់ចាំត្រួតពិនិត្យចុងក្រោយ" },
    note: {
      en: "The work is done; QA verifies it and closes the job out.",
      km: "ការងាររួចរាល់; ផ្នែកត្រួតពិនិត្យផ្ទៀងផ្ទាត់ រួចបិទសំណុំរឿង។",
    },
  },
  {
    status: "Customer Rejected",
    route: "/rejected",
    // Both branch statuses share one page in the catalogue: the manual
    // documents them together because the reader's question ("the customer
    // said no / the machine is dead — now what?") is the same question, and
    // the two rows feed the same two reports.
    topicId: "rejected-unrepairable",
    accent: "rose",
    label: { en: "Branch — declined", km: "ផ្លូវបំបែក — អតិថិជនបដិសេធ" },
    note: {
      en: "The customer decided not to repair. A sales lead, not a failure.",
      km: "អតិថិជនសម្រេចមិនជួសជុល។ ជាឱកាសលក់ថ្មី មិនមែនជាការបរាជ័យទេ។",
    },
  },
  {
    status: "Unrepairable",
    route: "/unrepairable",
    topicId: "rejected-unrepairable",
    accent: "rose",
    label: { en: "Branch — beyond repair", km: "ផ្លូវបំបែក — ជួសជុលមិនកើត" },
    note: {
      en: "Judged not economically repairable; feeds the replacement-machine leads report.",
      km: "វិនិច្ឆ័យថាជួសជុលមិនកើត; បញ្ចូលទៅរបាយការណ៍ឱកាសលក់ម៉ាស៊ីនថ្មី។",
    },
  },
];
