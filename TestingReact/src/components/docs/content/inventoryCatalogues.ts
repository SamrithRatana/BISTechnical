/**
 * @file components/docs/content/inventoryCatalogues.ts
 * @description Chapter 03, first half — the two catalogues and the two ways
 * stock moves by hand. Split from `inventory.ts` for file size.
 */

import type { DocTopic } from "../docsTypes";

export const CATALOGUE_TOPICS: DocTopic[] = [
  {
    id: "received-inventory",
    icon: "clipboard",
    route: "/received-inventory",
    title: { en: "The machine registry", km: "បញ្ជីម៉ាស៊ីន" },
    blurb: {
      en: "The catalogue of equipment models the workshop handles — a registry of machines, not of repair jobs.",
      km: "បញ្ជីម៉ូដែលឧបករណ៍ដែលសិក្ខាសាលាទទួលបន្ទុក — ជាបញ្ជីម៉ាស៊ីន មិនមែនបញ្ជីការងារជួសជុលទេ។",
    },
    steps: [
      {
        en: "Open Inventory → Received Items Inventory. The page is headed “Item Models Inventory”.",
        km: "បើក Inventory → Received Items Inventory។ ទំព័រមានចំណងជើង “Item Models Inventory”។",
      },
      {
        en: "Search by item name, serial number or type; scroll to pull in the next batch of rows.",
        km: "ស្វែងរកតាមឈ្មោះម៉ាស៊ីន លេខសម្គាល់ ឬប្រភេទ; រំកិលចុះដើម្បីទាញជួរបន្ទាប់។",
      },
      {
        en: "Click Add Item Model, fill Item Name and Serial Number (both required), pick the Item Type, then Save Model.",
        km: "ចុច Add Item Model បំពេញ Item Name និង Serial Number (ទាំងពីរចាំបាច់) ជ្រើស Item Type រួចចុច Save Model។",
      },
      {
        en: "Use the eye, pencil and bin icons on a row to view, edit or delete a model — deleting asks you to confirm.",
        km: "ប្រើរូបភ្នែក ខ្មៅដៃ និងធុងសំរាមលើជួរ ដើម្បីមើល កែ ឬលុបម៉ូដែល — ការលុបនឹងសួរបញ្ជាក់។",
      },
      {
        en: "Click Export to download the rows you have loaded as a CSV file.",
        km: "ចុច Export ដើម្បីទាញយកជួរដែលបានផ្ទុករួច ជាឯកសារ CSV។",
      },
    ],
    facts: [
      {
        en: "Item Type is a fixed list — Printer, Bill Counter, Generate, Scanner — and defaults to Printer.",
        km: "Item Type ជាបញ្ជីថេរ — Printer, Bill Counter, Generate, Scanner — ហើយកំណត់ដើមជា Printer។",
      },
      {
        en: "Export writes the rows loaded so far by scrolling, not the whole catalogue. Scroll to the bottom first if you want everything.",
        km: "Export សរសេរតែជួរដែលបានផ្ទុករួចដោយការរំកិល មិនមែនបញ្ជីទាំងមូលទេ។ សូមរំកិលដល់បាតជាមុនសិន បើអ្នកចង់បានទាំងអស់។",
      },
      {
        en: "If a save fails, the dialog stays open with the reason on it — nothing is applied behind your back.",
        km: "បើការរក្សាទុកបរាជ័យ ប្រអប់នៅតែបើក ព្រមទាំងបង្ហាញមូលហេតុ — គ្មានអ្វីត្រូវបានអនុវត្តដោយអ្នកមិនដឹងទេ។",
      },
    ],
  },
  {
    id: "spareparts",
    icon: "package",
    route: "/spareparts",
    title: { en: "The spare-parts catalogue", km: "បញ្ជីគ្រឿងបន្លាស់" },
    blurb: {
      en: "Every part you can attach to a job: photo, part number, what it fits, price, barcode and how many are on the shelf.",
      km: "គ្រឿងបន្លាស់គ្រប់មុខដែលអ្នកអាចភ្ជាប់ទៅការងារ៖ រូបថត លេខគ្រឿង ម៉ាស៊ីនដែលប្រើបាន តម្លៃ បាកូដ និងចំនួនលើធ្នើរ។",
    },
    steps: [
      {
        en: "Open Inventory → SparePart Items Inventory.",
        km: "បើក Inventory → SparePart Items Inventory។",
      },
      {
        en: "Click Add Spare Part. Fill Item Name / Brand and Part Number (both required); optionally Use For, Stock Quantity and Default Price.",
        km: "ចុច Add Spare Part។ បំពេញ Item Name / Brand និង Part Number (ទាំងពីរចាំបាច់); បន្ថែម Use For, Stock Quantity និង Default Price តាមតម្រូវការ។",
      },
      {
        en: "Add a photo with Upload from device (JPG, PNG, WebP or GIF, up to 10 MB), or paste an image address into Picture Url / Path.",
        km: "បន្ថែមរូបថតដោយ Upload from device (JPG, PNG, WebP ឬ GIF រហូតដល់ 10 MB) ឬបិទភ្ជាប់អាសយដ្ឋានរូបភាពក្នុងវាល Picture Url / Path។",
      },
      {
        en: "Write specification notes in Description, then click Save Spare Part.",
        km: "សរសេរកំណត់សម្គាល់លក្ខណៈបច្ចេកទេសក្នុងវាល Description រួចចុច Save Spare Part។",
      },
      {
        en: "Find a part later by typing in the search box, by clicking Phone Scan and scanning its barcode, or by clicking the All / GOOD STOCK / CRITICAL / OUT OF STOCK chips.",
        km: "រកគ្រឿងបន្លាស់ពេលក្រោយ ដោយវាយក្នុងប្រអប់ស្វែងរក ដោយចុច Phone Scan រួចស្កេនបាកូដ ឬដោយចុចស្លាក All / GOOD STOCK / CRITICAL / OUT OF STOCK។",
      },
    ],
    facts: [
      {
        en: "The stock bands come from the quantity alone: 0 is OUT OF STOCK, 1–2 is CRITICAL, 3 or more is GOOD STOCK.",
        km: "កម្រិតស្តុកគិតតាមចំនួនតែមួយ៖ 0 គឺ OUT OF STOCK, 1–2 គឺ CRITICAL, 3 ឡើងទៅគឺ GOOD STOCK។",
      },
      {
        en: "Those chips narrow only the rows already loaded, not the whole catalogue — the badge beside them shows visible-of-loaded, so it is not a catalogue-wide count.",
        km: "ស្លាកទាំងនោះបង្រួមតែជួរដែលបានផ្ទុករួចប៉ុណ្ណោះ មិនមែនបញ្ជីទាំងមូលទេ — ស្លាកក្បែរវាបង្ហាញ ចំនួនមើលឃើញ/ចំនួនផ្ទុក ដូច្នេះវាមិនមែនជាចំនួនសរុបនៃបញ្ជីទេ។",
      },
      {
        en: "The bar under a quantity is drawn against a fixed scale of 10 units, because there is no per-part reorder level in the data. The number above it is the real figure.",
        km: "របារខាងក្រោមចំនួន គូរធៀបនឹងខ្នាតថេរ ១០ ឯកតា ព្រោះទិន្នន័យគ្មានកម្រិតបញ្ជាទិញឡើងវិញតាមគ្រឿងនីមួយៗ។ លេខខាងលើវាទើបជាតួលេខពិត។",
      },
      {
        en: "If a create, edit or delete is rejected by the server, this page still closes the dialog and shows the change on screen. Reload the page to see the true state.",
        km: "បើការបង្កើត កែ ឬលុប ត្រូវបានម៉ាស៊ីនមេបដិសេធ ទំព័រនេះនៅតែបិទប្រអប់ ហើយបង្ហាញការផ្លាស់ប្តូរលើអេក្រង់។ សូមផ្ទុកទំព័រឡើងវិញ ដើម្បីមើលស្ថានភាពពិត។",
      },
      {
        en: "The Export button on this page does nothing — it has no action behind it. Use the stock reports to take figures away.",
        km: "ប៊ូតុង Export នៅទំព័រនេះមិនធ្វើអ្វីទេ — វាគ្មានមុខងារនៅពីក្រោយ។ សូមប្រើរបាយការណ៍ស្តុក ដើម្បីនាំតួលេខចេញ។",
      },
    ],
  },
  {
    id: "stock-in-out",
    icon: "boxes",
    route: "/spareparts",
    title: { en: "Stock In and Manual Stock Out", km: "បញ្ចូលស្តុក និងដកស្តុកដោយដៃ" },
    blurb: {
      en: "The two ways stock moves by hand — everything else moves because a repair was approved.",
      km: "វិធីពីរដែលស្តុកផ្លាស់ទីដោយដៃ — ករណីផ្សេងទៀតទាំងអស់ ផ្លាស់ទីព្រោះការជួសជុលត្រូវបានអនុម័ត។",
    },
    steps: [
      {
        en: "Find the part, then click Stock In in its row to add stock that has just arrived.",
        km: "រកគ្រឿងបន្លាស់ រួចចុច Stock In លើជួររបស់វា ដើម្បីបន្ថែមស្តុកដែលទើបមកដល់។",
      },
      {
        en: "Type the number into Quantity to Add and click Confirm Stock In. The amount is ADDED to what is there — it is not a replacement figure.",
        km: "វាយចំនួនក្នុងវាល Quantity to Add រួចចុច Confirm Stock In។ ចំនួននេះត្រូវបាន បូក បន្ថែមលើអ្វីដែលមានស្រាប់ — មិនមែនជាតម្លៃជំនួសទេ។",
      },
      {
        en: "To take stock out for something other than a repair job, click Stock Out on the row.",
        km: "ដើម្បីដកស្តុកចេញសម្រាប់គោលបំណងក្រៅពីការជួសជុល សូមចុច Stock Out លើជួរនោះ។",
      },
      {
        en: "Type the quantity, then write why in Reason / Note. Confirm Stock Out stays disabled until you do.",
        km: "វាយចំនួន រួចសរសេរមូលហេតុក្នុងវាល Reason / Note។ ប៊ូតុង Confirm Stock Out នៅតែបិទរហូតដល់អ្នកសរសេរ។",
      },
    ],
    facts: [
      {
        en: "Stock Out is disabled for any part already at zero.",
        km: "Stock Out ត្រូវបានបិទសម្រាប់គ្រឿងបន្លាស់ដែលមានចំនួនសូន្យរួចហើយ។",
      },
      {
        en: "The reason you type is not decoration: it is the only explanation that reaches the Stock Transactions ledger and the Stock Adjustments report.",
        km: "មូលហេតុដែលអ្នកសរសេរមិនមែនជាការតុបតែងទេ៖ វាជាការពន្យល់តែមួយគត់ដែលទៅដល់បញ្ជីចរាចរស្តុក និងរបាយការណ៍ Stock Adjustments។",
      },
      {
        en: "Because Stock In edits the catalogue quantity directly, it is classified as an Adjustment in the ledger — which is why new arrivals appear on the Stock Adjustments report.",
        km: "ដោយសារ Stock In កែចំនួនក្នុងបញ្ជីដោយផ្ទាល់ វាត្រូវបានចាត់ថ្នាក់ជា Adjustment ក្នុងបញ្ជីចរាចរ — ដែលជាមូលហេតុដែលស្តុកចូលថ្មីលេចនៅរបាយការណ៍ Stock Adjustments។",
      },
      {
        en: "Both actions post a message to the workshop's Telegram group with the part, the quantity and your name; Stock Out includes your reason.",
        km: "សកម្មភាពទាំងពីរផ្ញើសារទៅក្រុម Telegram របស់សិក្ខាសាលា ជាមួយឈ្មោះគ្រឿងបន្លាស់ ចំនួន និងឈ្មោះអ្នក; Stock Out រួមបញ្ចូលមូលហេតុរបស់អ្នកផងដែរ។",
      },
    ],
  },
  {
    id: "phone-scanner",
    icon: "scan",
    route: "/scanner",
    title: { en: "Use a phone as a barcode scanner", km: "ប្រើទូរស័ព្ទជាម៉ាស៊ីនស្កេនបាកូដ" },
    blurb: {
      en: "Pair a phone once, and every barcode it reads is typed into whichever box the cursor is sitting in on the computer.",
      km: "ភ្ជាប់ទូរស័ព្ទម្តង រួចបាកូដគ្រប់មុខដែលវាអាន នឹងត្រូវបានវាយចូលក្នុងប្រអប់ដែលទស្សន៍ទ្រនិចកំពុងស្ថិតនៅ លើកុំព្យូទ័រ។",
    },
    steps: [
      {
        en: "Click Link Phone in the header — or Phone Scan on the spare-parts page, or Scan inside the inspection dialog's part search.",
        km: "ចុច Link Phone ក្នុងរបារក្បាល — ឬ Phone Scan នៅទំព័រគ្រឿងបន្លាស់ ឬ Scan ក្នុងប្រអប់ស្វែងរកគ្រឿងបន្លាស់នៃប្រអប់វិនិច្ឆ័យ។",
      },
      {
        en: "Scan the QR code with the phone. The banner turns green — “Phone Connected!” — when it joins.",
        km: "ស្កេនកូដ QR ដោយទូរស័ព្ទ។ របារនឹងប្រែជាពណ៌បៃតង — “Phone Connected!” — នៅពេលវាភ្ជាប់រួច។",
      },
      {
        en: "On the computer, click into the field you want filled BEFORE scanning.",
        km: "នៅលើកុំព្យូទ័រ ចុចចូលក្នុងវាលដែលអ្នកចង់បំពេញ មុនពេល ស្កេន។",
      },
      {
        en: "Point the phone at the barcode. It reads automatically — no shutter button — and the code lands in the field on the computer.",
        km: "ចង្អុលទូរស័ព្ទទៅបាកូដ។ វាអានដោយស្វ័យប្រវត្តិ — គ្មានប៊ូតុងថត — ហើយកូដនឹងចូលក្នុងវាលនៅលើកុំព្យូទ័រ។",
      },
      {
        en: "For a faded or damaged barcode, switch the phone to Photo Mode and take a close-up photo, or pick one from the gallery.",
        km: "សម្រាប់បាកូដរលុប ឬខូច សូមប្តូរទូរស័ព្ទទៅ Photo Mode រួចថតរូបជិត ឬជ្រើសរូបពីវិចិត្រសាល។",
      },
    ],
    facts: [
      {
        en: "If no field has focus, the code is still recorded and shown to you — it simply is not typed anywhere.",
        km: "បើគ្មានវាលណាកំពុងផ្តោត កូដនៅតែត្រូវបានកត់ត្រា និងបង្ហាញដល់អ្នក — គ្រាន់តែមិនត្រូវបានវាយចូលកន្លែងណាទេ។",
      },
      {
        en: "On the spare-parts page a scan goes straight into the catalogue search box, filtering the table to that part.",
        km: "នៅទំព័រគ្រឿងបន្លាស់ ការស្កេនចូលទៅប្រអប់ស្វែងរកភ្លាម ដោយត្រងតារាងទៅគ្រឿងបន្លាស់នោះ។",
      },
      {
        en: "The phone must be on the same Wi-Fi as the computer. Live camera scanning also needs a secure (https) address — on a plain LAN address the phone quietly starts in Photo Mode instead, which works either way.",
        km: "ទូរស័ព្ទត្រូវនៅលើ Wi-Fi ដូចគ្នានឹងកុំព្យូទ័រ។ ការស្កេនដោយកាមេរ៉ាផ្ទាល់ក៏ត្រូវការអាសយដ្ឋានសុវត្ថិភាព (https) ដែរ — នៅលើអាសយដ្ឋាន LAN ធម្មតា ទូរស័ព្ទនឹងចាប់ផ្ដើមក្នុង Photo Mode ជំនួសវិញ ដែលដំណើរការបានដូចគ្នា។",
      },
      {
        en: "Reading the same code twice within about a second and a half is ignored, so leaving the camera on a label does not flood the computer.",
        km: "ការអានកូដដដែលពីរដងក្នុងរយៈពេលប្រហែលមួយវិនាទីកន្លះ ត្រូវបានមិនរាប់បញ្ចូល ដូច្នេះការទុកកាមេរ៉ាលើស្លាកមិនធ្វើឱ្យកុំព្យូទ័រលិចទេ។",
      },
      {
        en: "There is no text recognition anywhere in the system — only barcodes and QR codes are read. A serial number still has to be typed.",
        km: "គ្មានមុខងារអានអក្សរ (OCR) នៅកន្លែងណាក្នុងប្រព័ន្ធទេ — មានតែបាកូដ និងកូដ QR ប៉ុណ្ណោះដែលអានបាន។ លេខសម្គាល់នៅតែត្រូវវាយដោយដៃ។",
      },
    ],
  },
];
