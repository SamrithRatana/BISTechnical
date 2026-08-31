/**
 * @file components/docs/content/startWorkspace.ts
 * @description Chapter 01, second half — the workspace itself: the dashboard,
 * the menu, the search box, the assistant and the mobile app.
 *
 * Split from `gettingStarted.ts` for file size; the chapter is assembled there.
 */

import type { DocTopic } from "../docsTypes";

export const WORKSPACE_TOPICS: DocTopic[] = [
  {
    id: "dashboard",
    icon: "gauge",
    route: "/",
    title: { en: "The dashboard", km: "ផ្ទាំងគ្រប់គ្រង" },
    blurb: {
      en: "Four counts over one table. Pick a count, and the table underneath becomes that list.",
      km: "ចំនួនបួន នៅលើតារាងមួយ។ ជ្រើសចំនួនណាមួយ តារាងខាងក្រោមនឹងក្លាយជាបញ្ជីនោះ។",
    },
    steps: [
      {
        en: "Open Home Dashboard from the top of the sidebar, or click the logo.",
        km: "បើក Home Dashboard ពីខាងលើរបារចំហៀង ឬចុចលើនិមិត្តសញ្ញា។",
      },
      {
        en: "Read the four tiles left to right: Today's Report, Received Item, Waiting Customer, Finished.",
        km: "អានផ្ទាំងទាំងបួនពីឆ្វេងទៅស្តាំ៖ Today's Report, Received Item, Waiting Customer, Finished។",
      },
      {
        en: "Click a tile to select it — the ticket table below reloads to that group. The page opens on Today's Report.",
        km: "ចុចផ្ទាំងណាមួយដើម្បីជ្រើសរើស — តារាងសំណុំរឿងខាងក្រោមនឹងផ្ទុកឡើងវិញតាមក្រុមនោះ។ ទំព័របើកនៅ Today's Report។",
      },
      {
        en: "In the Ticket Volume panel, use 1H / 24H / 7D / 30D to change the window, and the Live pill to pause or resume automatic refresh.",
        km: "ក្នុងផ្ទាំង Ticket Volume ប្រើ 1H / 24H / 7D / 30D ដើម្បីប្តូររយៈពេល និងប៊ូតុង Live ដើម្បីផ្អាក ឬបន្តការធ្វើបច្ចុប្បន្នភាពស្វ័យប្រវត្តិ។",
      },
    ],
    facts: [
      {
        en: "The big number on a tile is an all-time running count; the little sparkline under it is daily intake over the last 7 days. They are deliberately different quantities, which is why the caption names the window.",
        km: "លេខធំលើផ្ទាំងគឺជាចំនួនសរុបគ្រប់ពេលវេលា; ខ្សែក្រាហ្វតូចខាងក្រោមគឺជាចំនួនចូលប្រចាំថ្ងៃក្នុងរយៈពេល ៧ ថ្ងៃចុងក្រោយ។ ពួកវាជាបរិមាណខុសគ្នាដោយចេតនា ដែលជាមូលហេតុដែលចំណងជើងបញ្ជាក់រយៈពេល។",
      },
      {
        en: "“Finished” counts by the completion date, not the arrival date — a machine that came in last month and was closed today belongs to today.",
        km: "“Finished” រាប់តាមកាលបរិច្ឆេទបញ្ចប់ មិនមែនកាលបរិច្ឆេទចូលទេ — ម៉ាស៊ីនដែលចូលកាលពីខែមុន ហើយបិទថ្ងៃនេះ រាប់ជារបស់ថ្ងៃនេះ។",
      },
      {
        en: "The chart is drawn from the most recent tickets only, so a very busy window can be clipped — use the reports for exact figures.",
        km: "ក្រាហ្វគូរតាមសំណុំរឿងថ្មីៗប៉ុណ្ណោះ ដូច្នេះរយៈពេលមមាញឹកខ្លាំងអាចត្រូវបានកាត់ខ្លី — សូមប្រើរបាយការណ៍សម្រាប់តួលេខពិតប្រាកដ។",
      },
    ],
  },
  {
    id: "navigation",
    icon: "layers",
    title: { en: "Finding your way around", km: "របៀបរុករកក្នុងប្រព័ន្ធ" },
    blurb: {
      en: "One grouped menu on the left, one header across the top. Everything in the portal is reachable from those two.",
      km: "ម៉ឺនុយជាក្រុមមួយនៅខាងឆ្វេង និងរបារក្បាលមួយនៅខាងលើ។ អ្វីៗទាំងអស់ក្នុងប្រព័ន្ធ អាចទៅដល់បានពីពីរនេះ។",
    },
    steps: [
      {
        en: "Click a group heading in the sidebar — Inventory, Customer, Technical, Stock, Sale, Rejected, Reports — to expand or collapse it.",
        km: "ចុចចំណងជើងក្រុមក្នុងរបារចំហៀង — Inventory, Customer, Technical, Stock, Sale, Rejected, Reports — ដើម្បីបើក ឬបិទវា។",
      },
      {
        en: "Click the ☰ button at the far left of the header to collapse the rail to icons and back. Hover an icon while collapsed to see its name, or click a group icon for a floating list.",
        km: "ចុចប៊ូតុង ☰ នៅឆ្វេងបំផុតនៃរបារក្បាល ដើម្បីបង្រួមរបារចំហៀងទៅជារូបតំណាង និងត្រឡប់វិញ។ ដាក់ទស្សន៍ទ្រនិចលើរូបតំណាងដើម្បីមើលឈ្មោះ ឬចុចរូបតំណាងក្រុមដើម្បីបើកបញ្ជីអណ្តែត។",
      },
      {
        en: "On a phone or small tablet the same button slides the menu in over the page; tap the dark background or any link to close it.",
        km: "នៅលើទូរស័ព្ទ ឬថេប្លេតតូច ប៊ូតុងដដែលនឹងរុញម៉ឺនុយចូលមកលើទំព័រ; ប៉ះផ្ទៃខាងក្រោយងងឹត ឬតំណណាមួយដើម្បីបិទ។",
      },
      {
        en: "In the header: ☰ toggles the menu, the circular arrow reloads the page, the globe switches language, the wifi icon opens System status, and your avatar opens the profile menu.",
        km: "ក្នុងរបារក្បាល៖ ☰ បិទ/បើកម៉ឺនុយ រូបព្រួញរង្វង់ផ្ទុកទំព័រឡើងវិញ រូបផែនដីប្តូរភាសា រូបវ៉ាយហ្វាយបើក System status ហើយរូបតំណាងអ្នកបើកម៉ឺនុយប្រវត្តិរូប។",
      },
    ],
    facts: [
      {
        en: "The collapsed/expanded choice is remembered on desktop and survives reloads. Opening the mobile drawer never changes your desktop preference.",
        km: "ជម្រើសបង្រួម/ពង្រីកត្រូវបានចងចាំនៅលើកុំព្យូទ័រ ហើយនៅតែដដែលបន្ទាប់ពីផ្ទុកឡើងវិញ។ ការបើកម៉ឺនុយលើទូរស័ព្ទមិនប៉ះពាល់ដល់ជម្រើសកុំព្យូទ័រទេ។",
      },
      {
        en: "The wifi icon's coloured dot answers one question: can I rely on this system right now? Green means saving works, amber means it will be slow, red means don't bother trying yet.",
        km: "ចំណុចពណ៌នៅរូបវ៉ាយហ្វាយឆ្លើយសំណួរតែមួយ៖ តើឥឡូវនេះប្រព័ន្ធអាចទុកចិត្តបានទេ? បៃតងមានន័យថារក្សាទុកបាន លឿងមានន័យថាយឺត ក្រហមមានន័យថាកុំទាន់ព្យាយាម។",
      },
      {
        en: "Click that icon to see the whole chain in request order — your internet, the web app, the service API and the database — each with its own verdict.",
        km: "ចុចរូបតំណាងនោះ ដើម្បីមើលខ្សែសង្វាក់ទាំងមូលតាមលំដាប់សំណើ — អ៊ីនធឺណិតរបស់អ្នក កម្មវិធីវេប សេវា API និងមូលដ្ឋានទិន្នន័យ — ដោយមានលទ្ធផលរៀងៗខ្លួន។",
      },
      {
        en: "Tables never use page numbers: they load more as you scroll, and the footer tells you how many of how many are loaded. Past 2,000 rows loading stops and asks you to narrow the search instead.",
        km: "តារាងមិនប្រើលេខទំព័រទេ៖ វាផ្ទុកបន្ថែមពេលអ្នករំកិលចុះ ហើយបាតតារាងប្រាប់ថាបានផ្ទុកប៉ុន្មានក្នុងចំណោមប៉ុន្មាន។ លើសពី ២,០០០ ជួរ ការផ្ទុកនឹងឈប់ ហើយស្នើឱ្យអ្នកបង្រួមការស្វែងរកជំនួសវិញ។",
      },
    ],
  },
  {
    id: "global-search",
    icon: "search",
    title: { en: "Search anything, from anywhere", km: "ស្វែងរកអ្វីក៏បាន ពីគ្រប់ទីកន្លែង" },
    blurb: {
      en: "One box that searches tickets, spare parts, customers and machines at once, and takes you to the page that owns what you picked.",
      km: "ប្រអប់តែមួយដែលស្វែងរកសំណុំរឿង គ្រឿងបន្លាស់ អតិថិជន និងម៉ាស៊ីនក្នុងពេលតែមួយ ហើយនាំអ្នកទៅទំព័រដែលកាន់កាប់អ្វីដែលអ្នកជ្រើស។",
    },
    steps: [
      {
        en: "Press Ctrl + K (⌘K on Mac) anywhere in the app, or click the search bar in the header.",
        km: "ចុច Ctrl + K (⌘K លើ Mac) នៅកន្លែងណាក៏បានក្នុងកម្មវិធី ឬចុចរបារស្វែងរកក្នុងរបារក្បាល។",
      },
      {
        en: "Type at least two characters — a report number, a company, a machine name, a serial number or a part number.",
        km: "វាយយ៉ាងតិចពីរតួអក្សរ — លេខរបាយការណ៍ ឈ្មោះក្រុមហ៊ុន ឈ្មោះម៉ាស៊ីន លេខសម្គាល់ ឬលេខគ្រឿងបន្លាស់។",
      },
      {
        en: "Switch between the Tickets, Spare Parts, Customers and Items tabs; each tab's badge shows how many matched.",
        km: "ប្តូររវាងផ្ទាំង Tickets, Spare Parts, Customers និង Items; ស្លាកលើផ្ទាំងនីមួយៗបង្ហាញចំនួនដែលត្រូវគ្នា។",
      },
      {
        en: "Click a result. The destination page opens with your search already applied and the matching text highlighted in the table.",
        km: "ចុចលទ្ធផលមួយ។ ទំព័រគោលដៅនឹងបើក ដោយការស្វែងរករបស់អ្នកបានអនុវត្តរួច ហើយអក្សរដែលត្រូវគ្នាត្រូវបានបន្លិចក្នុងតារាង។",
      },
      {
        en: "With the box empty, use ↑ ↓ and Enter on the six quick shortcuts — Dashboard, Spare Parts, Customers, Reports, the phone scanner and the AI assistant.",
        km: "ពេលប្រអប់ទទេ ប្រើ ↑ ↓ និង Enter លើផ្លូវកាត់ទាំងប្រាំមួយ — Dashboard, Spare Parts, Customers, Reports, ម៉ាស៊ីនស្កេនទូរស័ព្ទ និងជំនួយការ AI។",
      },
    ],
    facts: [
      {
        en: "A ticket is found whatever stage it is at, and clicking it opens the queue page that currently owns that status.",
        km: "សំណុំរឿងអាចរកឃើញនៅគ្រប់ដំណាក់កាល ហើយការចុចវានឹងបើកទំព័រជួរការងារដែលកាន់ស្ថានភាពនោះបច្ចុប្បន្ន។",
      },
      {
        en: "Once you have typed two characters, Enter sends your text to the AI assistant instead of opening a row — click the row itself to open it.",
        km: "នៅពេលអ្នកបានវាយពីរតួអក្សរ Enter នឹងផ្ញើអត្ថបទទៅជំនួយការ AI ជំនួសឱ្យការបើកជួរ — សូមចុចលើជួរដោយផ្ទាល់ដើម្បីបើកវា។",
      },
      {
        en: "Spare Parts, Customers and Items preview five rows each; use the “View all N in …” link at the bottom to open the full list.",
        km: "Spare Parts, Customers និង Items បង្ហាញតែប្រាំជួរជាការមើលជាមុន; ប្រើតំណ “View all N in …” ខាងក្រោមដើម្បីបើកបញ្ជីពេញ។",
      },
    ],
  },
  {
    id: "ai-assistant",
    icon: "sparkles",
    title: { en: "Ask the AI assistant", km: "សួរជំនួយការ AI" },
    blurb: {
      en: "A chat panel that reads your live system with your own sign-in and answers in the language you asked. It can open screens and fill forms — it never saves.",
      km: "ផ្ទាំងសន្ទនាដែលអានប្រព័ន្ធផ្ទាល់តាមការចូលរបស់អ្នក ហើយឆ្លើយតាមភាសាដែលអ្នកសួរ។ វាអាចបើកអេក្រង់ និងបំពេញទម្រង់ — ប៉ុន្តែវាមិនរក្សាទុកទេ។",
    },
    steps: [
      {
        en: "Click the floating AI Assistant button in the bottom-right corner, or type a question into the search palette and press Enter.",
        km: "ចុចប៊ូតុង AI Assistant អណ្តែតនៅជ្រុងខាងក្រោមស្តាំ ឬវាយសំណួរក្នុងប្រអប់ស្វែងរក រួចចុច Enter។",
      },
      {
        en: "Ask in English or Khmer — “how many machines came in today”, “what did Sokha finish this week”, “where do I stock out a part”.",
        km: "សួរជាភាសាអង់គ្លេស ឬខ្មែរ — “ថ្ងៃនេះមានម៉ាស៊ីនចូលប៉ុន្មាន”, “សប្តាហ៍នេះ សុខា បញ្ចប់អ្វីខ្លះ”, “ខ្ញុំដកគ្រឿងបន្លាស់ចេញនៅឯណា”។",
      },
      {
        en: "Follow up naturally — the last few messages travel with each question, so “what about last month?” works.",
        km: "សួរបន្តដោយធម្មជាតិ — សារពីរបីចុងក្រោយត្រូវបានផ្ញើជាមួយសំណួរនីមួយៗ ដូច្នេះ “ចុះខែមុនវិញ?” ដំណើរការបាន។",
      },
      {
        en: "Use the Copy button under a reply to take the answer away, or the bin icon in the header to clear the conversation.",
        km: "ប្រើប៊ូតុង Copy ខាងក្រោមចម្លើយ ដើម្បីយកចម្លើយចេញ ឬរូបធុងសំរាមក្នុងក្បាលផ្ទាំង ដើម្បីសម្អាតការសន្ទនា។",
      },
    ],
    facts: [
      {
        en: "It reads with YOUR sign-in, so it can only show you rows you could already open yourself.",
        km: "វាអានដោយប្រើការចូលរបស់អ្នក ដូច្នេះវាអាចបង្ហាញតែជួរដែលអ្នកអាចបើកដោយខ្លួនឯងបានស្រាប់ប៉ុណ្ណោះ។",
      },
      {
        en: "Nothing it does saves. It can open a page, switch a tab, and type your dictated values into a dialog — but Save, Confirm and Delete stay your click.",
        km: "គ្មានអ្វីដែលវាធ្វើ រក្សាទុកទេ។ វាអាចបើកទំព័រ ប្តូរផ្ទាំង និងវាយតម្លៃដែលអ្នកបញ្ជាចូលក្នុងប្រអប់ — ប៉ុន្តែ Save, Confirm និង Delete នៅតែជាការចុចរបស់អ្នក។",
      },
      {
        en: "It answers about the application too — “what menus do I have”, “what does Awaiting Sparepart mean” — from this installation's real menu, not from guesswork.",
        km: "វាក៏ឆ្លើយអំពីកម្មវិធីផងដែរ — “ខ្ញុំមានម៉ឺនុយអ្វីខ្លះ”, “Awaiting Sparepart មានន័យដូចម្តេច” — ដោយអានម៉ឺនុយពិតរបស់ការដំឡើងនេះ មិនមែនស្មានទេ។",
      },
      {
        en: "If it cannot reach a backend it says the lookup failed rather than reporting zero — an empty answer and an unreachable system are not the same thing.",
        km: "បើវាមិនអាចទាក់ទងសេវាខាងក្រោយបាន វានឹងប្រាប់ថាការស្វែងរកបរាជ័យ ជាជាងរាយការណ៍លេខសូន្យ — ចម្លើយទទេ និងប្រព័ន្ធដែលទាក់ទងមិនបាន គឺជារឿងពីរផ្សេងគ្នា។",
      },
    ],
  },
  {
    id: "mobile-app",
    icon: "phone",
    route: "/download",
    title: { en: "Install the CAM ID phone app", km: "ដំឡើងកម្មវិធី CAM ID លើទូរស័ព្ទ" },
    blurb: {
      en: "The companion app: approve sign-ins with your face, kill a stray PC session, and use the phone as a wireless barcode scanner.",
      km: "កម្មវិធីជំនួយ៖ អនុម័តការចូលដោយស្កេនមុខ បិទវគ្គកុំព្យូទ័រដែលមិនប្រើ និងប្រើទូរស័ព្ទជាម៉ាស៊ីនស្កេនបាកូដឥតខ្សែ។",
    },
    steps: [
      {
        en: "From the sign-in screen, click Get CAM ID (Android / iOS) at the top left — it opens the download hub.",
        km: "ពីអេក្រង់ចូល ចុច Get CAM ID (Android / iOS) នៅខាងលើឆ្វេង — វានឹងបើកទំព័រទាញយក។",
      },
      {
        en: "On a computer, click the Android or iOS button to reveal that platform's QR code, then scan it with the phone to open the setup page there.",
        km: "នៅលើកុំព្យូទ័រ ចុចប៊ូតុង Android ឬ iOS ដើម្បីបង្ហាញកូដ QR របស់ប្រព័ន្ធនោះ រួចស្កេនដោយទូរស័ព្ទ ដើម្បីបើកទំព័រដំឡើងនៅទីនោះ។",
      },
      {
        en: "Follow the three steps on the setup page, then open CAM ID and set the server address if the app asks for one.",
        km: "អនុវត្តតាមជំហានទាំងបីនៅទំព័រដំឡើង រួចបើក CAM ID ហើយកំណត់អាសយដ្ឋានម៉ាស៊ីនមេ បើកម្មវិធីសួរ។",
      },
      {
        en: "Pair the phone to your account from Profile → Device & Sessions on the computer — see “Pair a phone for face sign-in”.",
        km: "ភ្ជាប់ទូរស័ព្ទទៅគណនីរបស់អ្នកពី Profile → Device & Sessions នៅលើកុំព្យូទ័រ — សូមមើល “ភ្ជាប់ទូរស័ព្ទសម្រាប់ការចូលដោយស្កេនមុខ”។",
      },
    ],
    facts: [
      {
        en: "Once paired, the app's Sessions tab lists every computer signed in as you and can revoke any of them from wherever you are.",
        km: "ក្រោយពេលភ្ជាប់រួច ផ្ទាំង Sessions ក្នុងកម្មវិធីរាយកុំព្យូទ័រទាំងអស់ដែលចូលក្នុងនាមអ្នក ហើយអាចដកសិទ្ធិណាមួយបាន ពីកន្លែងណាក៏បាន។",
      },
      {
        en: "It also keeps its own audit trail of approvals and denials, including which device and address asked.",
        km: "វាក៏រក្សាកំណត់ត្រាផ្ទាល់ខ្លួននៃការអនុម័ត និងការបដិសេធ រួមទាំងឧបករណ៍ និងអាសយដ្ឋានដែលបានស្នើផងដែរ។",
      },
      {
        en: "The phone must be able to reach the portal machine on the same network for pairing and scanning to work.",
        km: "ទូរស័ព្ទត្រូវអាចទាក់ទងម៉ាស៊ីនប្រព័ន្ធនៅលើបណ្តាញដូចគ្នា ដើម្បីឱ្យការភ្ជាប់ និងការស្កេនដំណើរការបាន។",
      },
    ],
  },
];
