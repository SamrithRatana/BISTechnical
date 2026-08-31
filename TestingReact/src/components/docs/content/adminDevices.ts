/**
 * @file components/docs/content/adminDevices.ts
 * @description Chapter 05 — the devices that can act as you: your face, your
 * paired phones, your passkeys and your open sessions. Split from
 * `adminAccount.ts` for file size.
 */

import type { DocTopic } from "../docsTypes";

export const DEVICE_TOPICS: DocTopic[] = [
  {
    id: "face-2fa-setup",
    icon: "scan",
    route: "/profile?tab=security",
    title: { en: "Set up face verification", km: "រៀបចំការផ្ទៀងផ្ទាត់មុខ" },
    blurb: {
      en: "Record your face with the computer's own camera, then switch on the extra step after your password.",
      km: "ថតមុខរបស់អ្នកដោយកាមេរ៉ាកុំព្យូទ័រ រួចបើកជំហានបន្ថែមបន្ទាប់ពីពាក្យសម្ងាត់។",
    },
    steps: [
      {
        en: "Open Profile → Device & Sessions and find “Paired Face Authentication Devices”.",
        km: "បើក Profile → Device & Sessions រួចរក “Paired Face Authentication Devices”។",
      },
      {
        en: "Click Set up Face with PC. Confirm the reminder card — remove your mask, glasses and hat — the camera stays behind it until you do.",
        km: "ចុច Set up Face with PC។ បញ្ជាក់កាតរំលឹក — ដោះម៉ាស់ វ៉ែនតា និងមួក — កាមេរ៉ានៅពីក្រោយវារហូតដល់អ្នកបញ្ជាក់។",
      },
      {
        en: "Capture the three poses as prompted: look straight, turn slightly left, turn slightly right.",
        km: "ថតទាំងបីទីតាំងតាមការណែនាំ៖ មើលត្រង់ បែរបន្តិចទៅឆ្វេង បែរបន្តិចទៅស្តាំ។",
      },
      {
        en: "Use the “2FA Face” switch in the same section to turn the extra step ON.",
        km: "ប្រើកុងតាក “2FA Face” ក្នុងផ្នែកដដែល ដើម្បីបើកជំហានបន្ថែម។",
      },
    ],
    facts: [
      {
        en: "Enrolling replaces every sample previously stored for your account — it is a replace, not an addition.",
        km: "ការចុះឈ្មោះជំនួសគំរូទាំងអស់ដែលបានរក្សាទុកពីមុនសម្រាប់គណនីរបស់អ្នក — វាជាការជំនួស មិនមែនការបន្ថែមទេ។",
      },
      {
        en: "The switch refuses to turn on until a face is enrolled: “Please set up your face scan first before enabling 2FA”.",
        km: "កុងតាកនឹងមិនបើកទេ រហូតដល់មុខត្រូវបានចុះឈ្មោះ៖ “Please set up your face scan first before enabling 2FA”។",
      },
      {
        en: "The camera runs on your own computer and no photo is uploaded — only a numeric description of the face leaves the machine.",
        km: "កាមេរ៉ាដំណើរការនៅលើកុំព្យូទ័ររបស់អ្នក ហើយគ្មានរូបថតត្រូវបានផ្ញើឡើងទេ — មានតែលេខពិពណ៌នាមុខប៉ុណ្ណោះដែលចេញពីម៉ាស៊ីន។",
      },
    ],
  },
  {
    id: "pair-phone",
    icon: "phone",
    route: "/profile?tab=security",
    title: { en: "Pair a phone for face sign-in", km: "ភ្ជាប់ទូរស័ព្ទសម្រាប់ការចូលដោយស្កេនមុខ" },
    blurb: {
      en: "Link a phone to your account once, and it can approve or perform sign-ins for you afterwards.",
      km: "ភ្ជាប់ទូរស័ព្ទទៅគណនីរបស់អ្នកម្តង រួចវាអាចអនុម័ត ឬធ្វើការចូលជំនួសអ្នកបានក្រោយមក។",
    },
    steps: [
      {
        en: "Open Profile → Device & Sessions and click Pair New Face Phone.",
        km: "បើក Profile → Device & Sessions រួចចុច Pair New Face Phone។",
      },
      {
        en: "Read the reminder card, then scan the QR code with the phone. The desktop reports “Phone connected — continue on your phone”.",
        km: "អានកាតរំលឹក រួចស្កេនកូដ QR ដោយទូរស័ព្ទ។ កុំព្យូទ័រនឹងរាយការណ៍ “Phone connected — continue on your phone”។",
      },
      {
        en: "On the phone, capture your face at the three angles it asks for.",
        km: "នៅលើទូរស័ព្ទ ថតមុខរបស់អ្នកតាមមុំទាំងបីដែលវាស្នើ។",
      },
      {
        en: "The phone confirms “Phone paired” and the device appears in the table. Use Unpair on a row to revoke a phone later.",
        km: "ទូរស័ព្ទនឹងបញ្ជាក់ “Phone paired” ហើយឧបករណ៍នឹងលេចក្នុងតារាង។ ប្រើ Unpair លើជួរ ដើម្បីដកសិទ្ធិទូរស័ព្ទពេលក្រោយ។",
      },
    ],
    facts: [
      {
        en: "Pairing needs a session you have already proved — you cannot pair a phone from the sign-in screen, because that would let a phone add itself.",
        km: "ការភ្ជាប់ត្រូវការវគ្គដែលអ្នកបានផ្ទៀងផ្ទាត់រួច — អ្នកមិនអាចភ្ជាប់ទូរស័ព្ទពីអេក្រង់ចូលបានទេ ព្រោះនោះនឹងអនុញ្ញាតឱ្យទូរស័ព្ទបន្ថែមខ្លួនឯង។",
      },
      {
        en: "The pairing QR lasts five minutes and can be used once. A second phone racing on the same code is refused.",
        km: "កូដ QR ភ្ជាប់មានរយៈពេលប្រាំនាទី ហើយប្រើបានតែម្តង។ ទូរស័ព្ទទីពីរដែលព្យាយាមលើកូដដដែល នឹងត្រូវបានបដិសេធ។",
      },
      {
        en: "Unpairing revokes that device only — your enrolled face stays, so your other phones and the PC camera keep working.",
        km: "ការដកភ្ជាប់ ដកសិទ្ធិតែឧបករណ៍នោះ — មុខដែលបានចុះឈ្មោះនៅដដែល ដូច្នេះទូរស័ព្ទផ្សេង និងកាមេរ៉ាកុំព្យូទ័រនៅតែដំណើរការ។",
      },
      {
        en: "If the phone is already paired to someone else's account it is refused outright, naming both accounts rather than failing quietly.",
        km: "បើទូរស័ព្ទត្រូវបានភ្ជាប់ទៅគណនីអ្នកដទៃរួច វានឹងត្រូវបានបដិសេធភ្លាម ដោយបញ្ជាក់គណនីទាំងពីរ ជាជាងបរាជ័យស្ងាត់ៗ។",
      },
    ],
  },
  {
    id: "passkeys",
    icon: "key",
    route: "/profile?tab=security",
    title: { en: "Add a passkey", km: "បន្ថែម Passkey" },
    blurb: {
      en: "Register this computer or phone so you can sign in with Windows Hello, Face ID, a fingerprint or a security key instead of a password.",
      km: "ចុះឈ្មោះកុំព្យូទ័រ ឬទូរស័ព្ទនេះ ដើម្បីអ្នកអាចចូលដោយ Windows Hello, Face ID ស្នាមម្រាមដៃ ឬ security key ជំនួសពាក្យសម្ងាត់។",
    },
    steps: [
      {
        en: "Open Profile → Device & Sessions and scroll to the Face & Passkey panel.",
        km: "បើក Profile → Device & Sessions រួចរំកិលទៅផ្ទាំង Face & Passkey។",
      },
      {
        en: "Click Add this device and complete your operating system's own prompt.",
        km: "ចុច Add this device រួចបំពេញការសួររបស់ប្រព័ន្ធប្រតិបត្តិការអ្នក។",
      },
      {
        en: "The new device appears at the top of the list, showing whether it is synced to your other devices or lives on this one only.",
        km: "ឧបករណ៍ថ្មីនឹងលេចនៅខាងលើបញ្ជី ដោយបង្ហាញថាវាធ្វើសមកាលកម្មទៅឧបករណ៍ផ្សេងរបស់អ្នក ឬនៅតែលើឧបករណ៍នេះប៉ុណ្ណោះ។",
      },
      {
        en: "To remove one, click the bin icon on its row and confirm.",
        km: "ដើម្បីលុបមួយ ចុចរូបធុងសំរាមលើជួររបស់វា រួចបញ្ជាក់។",
      },
    ],
    facts: [
      {
        en: "“Synced to your other devices” vs “This device only” answers the question people actually have: if I lose this phone, am I locked out?",
        km: "“Synced to your other devices” ធៀបនឹង “This device only” ឆ្លើយសំណួរដែលមនុស្សសួរពិត៖ បើខ្ញុំបាត់ទូរស័ព្ទនេះ តើខ្ញុំចូលមិនបានទេឬ?",
      },
      {
        en: "Removing a passkey never locks you out — your password still works. The confirmation says so.",
        km: "ការលុប passkey មិនបិទផ្លូវចូលរបស់អ្នកទេ — ពាក្យសម្ងាត់នៅតែដំណើរការ។ ការបញ្ជាក់បញ្ជាក់រឿងនេះ។",
      },
      {
        en: "Your fingerprint or face never leaves your device: the system stores only a public key.",
        km: "ស្នាមម្រាមដៃ ឬមុខរបស់អ្នកមិនចេញពីឧបករណ៍អ្នកទេ៖ ប្រព័ន្ធរក្សាទុកតែសោសាធារណៈប៉ុណ្ណោះ។",
      },
    ],
  },
  {
    id: "sessions",
    icon: "shield",
    route: "/profile?tab=security",
    title: { en: "See and end your sessions", km: "មើល និងបញ្ចប់វគ្គរបស់អ្នក" },
    blurb: {
      en: "Every browser currently signed in as you, and a button to end any of them — including one you left open somewhere else.",
      km: "កម្មវិធីរុករកទាំងអស់ដែលកំពុងចូលក្នុងនាមអ្នក និងប៊ូតុងដើម្បីបញ្ចប់វា — រួមទាំងវគ្គដែលអ្នកបានបើកទុកនៅកន្លែងផ្សេង។",
    },
    steps: [
      {
        en: "Open Profile → Device & Sessions and read “Active User Login Sessions”.",
        km: "បើក Profile → Device & Sessions រួចអាន “Active User Login Sessions”។",
      },
      {
        en: "Each row shows the device and browser, the address it is on and how long ago it was active. Your own row is tagged This Device.",
        km: "ជួរនីមួយៗបង្ហាញឧបករណ៍ និងកម្មវិធីរុករក អាសយដ្ឋានដែលវាស្ថិតនៅ និងរយៈពេលចុងក្រោយដែលវាសកម្ម។ ជួររបស់អ្នកមានស្លាក This Device។",
      },
      {
        en: "Click Sign Out on another row to end that browser remotely — it is thrown back to the sign-in screen within seconds.",
        km: "ចុច Sign Out លើជួរផ្សេង ដើម្បីបញ្ចប់កម្មវិធីរុករកនោះពីចម្ងាយ — វានឹងត្រូវបញ្ជូនត្រឡប់ទៅអេក្រង់ចូលក្នុងរយៈពេលប៉ុន្មានវិនាទី។",
      },
      {
        en: "Use Sign Out Other Devices to end everything except the browser you are using now.",
        km: "ប្រើ Sign Out Other Devices ដើម្បីបញ្ចប់វគ្គទាំងអស់ លើកលែងកម្មវិធីរុករកដែលអ្នកកំពុងប្រើ។",
      },
    ],
    facts: [
      {
        en: "The list refreshes itself every few seconds, so a session you end disappears without a reload.",
        km: "បញ្ជីធ្វើបច្ចុប្បន្នភាពដោយខ្លួនឯងរៀងរាល់ប៉ុន្មានវិនាទី ដូច្នេះវគ្គដែលអ្នកបញ្ចប់នឹងបាត់ដោយមិនចាំបាច់ផ្ទុកឡើងវិញ។",
      },
      {
        en: "The paired CAM ID phone can do this too, from its Sessions tab — useful when the computer you want to sign out is not the one in front of you.",
        km: "ទូរស័ព្ទ CAM ID ដែលបានភ្ជាប់ក៏អាចធ្វើដូចនេះបានដែរ ពីផ្ទាំង Sessions របស់វា — មានប្រយោជន៍ពេលកុំព្យូទ័រដែលអ្នកចង់បញ្ចប់ មិននៅចំពោះមុខអ្នក។",
      },
      {
        en: "Signing out clears the cached lists as well as the session, so the next person on a shared workstation cannot see the previous person's queue.",
        km: "ការចាកចេញ សម្អាតបញ្ជីដែលរក្សាទុកជាបណ្ដោះអាសន្ន បន្ថែមលើវគ្គ ដូច្នេះអ្នកបន្ទាប់នៅកុំព្យូទ័ររួម មិនអាចឃើញជួរការងាររបស់អ្នកមុនទេ។",
      },
    ],
  },
];
