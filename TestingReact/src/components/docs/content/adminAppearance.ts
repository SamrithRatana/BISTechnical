/**
 * @file components/docs/content/adminAppearance.ts
 * @description Chapter 05 — how the app looks to you, and who you are in it.
 * Split from `adminAccount.ts` for file size; the chapter is assembled in
 * `admin.ts`.
 */

import type { DocTopic } from "../docsTypes";

export const APPEARANCE_TOPICS: DocTopic[] = [
  {
    id: "appearance",
    icon: "settings",
    route: "/profile?tab=settings",
    title: { en: "Make the app fit you", km: "កែប្រព័ន្ធឱ្យសមនឹងអ្នក" },
    blurb: {
      en: "Theme, accent colour, card style, sidebar layout, corners, row height and text size — all personal, all applied the moment you click.",
      km: "ពណ៌ផ្ទៃ ពណ៌សំខាន់ រចនាបថកាត ប្លង់របារចំហៀង ជ្រុង កម្ពស់ជួរ និងទំហំអក្សរ — ទាំងអស់ជារបស់ផ្ទាល់ខ្លួន និងអនុវត្តភ្លាមពេលចុច។",
    },
    steps: [
      {
        en: "Click your avatar in the header and choose System Settings — or open Profile and pick the System Settings tab.",
        km: "ចុចរូបតំណាងអ្នកក្នុងរបារក្បាល រួចជ្រើស System Settings — ឬបើក Profile រួចជ្រើសផ្ទាំង System Settings។",
      },
      {
        en: "Theme mode: Light, Dark or Match System. The sun/moon/monitor button in the header does the same thing in one click.",
        km: "Theme mode៖ Light, Dark ឬ Match System។ ប៊ូតុងព្រះអាទិត្យ/ព្រះចន្ទ/អេក្រង់ក្នុងរបារក្បាល ធ្វើដូចគ្នាដោយចុចតែម្តង។",
      },
      {
        en: "Accent colour: pick one of the six swatches, type a hex code, or adopt the colour detected from the company logo.",
        km: "ពណ៌សំខាន់៖ ជ្រើសពណ៌ក្នុងចំណោមប្រាំមួយ វាយកូដ hex ឬយកពណ៌ដែលរកឃើញពីនិមិត្តសញ្ញាក្រុមហ៊ុន។",
      },
      {
        en: "Surface style (Cushioned, Frosted Glass, Clean Flat), Sidebar layout (eight styles), Corner style, Table density and Text size are each one click.",
        km: "រចនាបថផ្ទៃ (Cushioned, Frosted Glass, Clean Flat) ប្លង់របារចំហៀង (ប្រាំបីបែប) រចនាបថជ្រុង ដង់ស៊ីតេតារាង និងទំហំអក្សរ សុទ្ធតែចុចម្តងបាន។",
      },
      {
        en: "Watch the Preview panel on the right as you go, and use Reset to defaults in the banner at the top if you want everything back as it shipped.",
        km: "មើលផ្ទាំង Preview នៅខាងស្តាំពេលអ្នកកែ ហើយប្រើ Reset to defaults ក្នុងរបារខាងលើ បើអ្នកចង់បានអ្វីៗត្រឡប់ដូចដើម។",
      },
    ],
    facts: [
      {
        en: "Compact density exists for a reason: on a 1366×768 laptop it fits noticeably more rows on screen.",
        km: "ដង់ស៊ីតេ Compact មានឡើងដោយមានហេតុផល៖ នៅលើកុំព្យូទ័រយួរដៃ 1366×768 វាដាក់ជួរបានច្រើនជាងគួរឱ្យកត់សម្គាល់។",
      },
      {
        en: "Text size scales the whole interface, not only the letters.",
        km: "ទំហំអក្សរ ពង្រីកចំណុចប្រទាក់ទាំងមូល មិនត្រឹមតែអក្សរទេ។",
      },
      {
        en: "A custom accent is nudged into a readable range before it is applied, so a colour that would be unreadable against white text is corrected rather than accepted.",
        km: "ពណ៌សំខាន់ផ្ទាល់ខ្លួន ត្រូវបានកែឱ្យស្ថិតក្នុងចន្លោះអានបាន មុនពេលអនុវត្ត ដូច្នេះពណ៌ដែលនឹងអានមិនច្បាស់ធៀបនឹងអក្សរស ត្រូវបានកែ ជាជាងទទួលយកទាំងស្រុង។",
      },
      {
        en: "Reset to defaults restores every appearance setting at once. It does NOT delete your profile photo, your cover image or the company logo — those are not preferences.",
        km: "Reset to defaults ស្តារការកំណត់រូបរាងទាំងអស់ក្នុងពេលតែមួយ។ វា មិន លុបរូបថតប្រវត្តិរូប រូបគម្រប ឬនិមិត្តសញ្ញាក្រុមហ៊ុនទេ — ទាំងនោះមិនមែនជាការកំណត់ចំណូលចិត្តទេ។",
      },
    ],
  },
  {
    id: "performance-motion",
    icon: "gauge",
    route: "/profile?tab=settings",
    title: { en: "Animation and Lite Mode", km: "ចលនា និងរបៀបស្រាល" },
    blurb: {
      en: "Two separate switches for two different problems — one quiets movement, the other strips the expensive visual effects on a slower computer.",
      km: "កុងតាកពីរសម្រាប់បញ្ហាពីរផ្សេងគ្នា — មួយបន្ថយចលនា មួយទៀតដកចេញនូវឥទ្ធិពលដែលសោហ៊ុយខ្ពស់នៅលើកុំព្យូទ័រយឺត។",
    },
    steps: [
      {
        en: "Open System Settings and find the Animation card. Choose Full Motion or Reduced.",
        km: "បើក System Settings រួចរកកាត Animation។ ជ្រើស Full Motion ឬ Reduced។",
      },
      {
        en: "In the Performance card beside it, choose Lite Mode (On) or Full GPU (Off).",
        km: "ក្នុងកាត Performance ក្បែរនោះ ជ្រើស Lite Mode (On) ឬ Full GPU (Off)។",
      },
      {
        en: "Read the line underneath — it tells you what the app measured about this particular computer.",
        km: "អានបន្ទាត់ខាងក្រោម — វាប្រាប់អ្នកពីអ្វីដែលកម្មវិធីបានវាស់អំពីកុំព្យូទ័រនេះ។",
      },
      {
        en: "If the app offers “Want it to feel smoother on this PC?”, answering Yes turns both on; you can separate them again here afterwards.",
        km: "បើកម្មវិធីសួរ “Want it to feel smoother on this PC?” ការឆ្លើយយល់ព្រមនឹងបើកទាំងពីរ; អ្នកអាចបំបែកវាឡើងវិញនៅទីនេះក្រោយមក។",
      },
    ],
    facts: [
      {
        en: "Neither switch removes anything from the screen. No button, row, number or feature disappears — only the decoration.",
        km: "កុងតាកទាំងពីរមិនដកអ្វីចេញពីអេក្រង់ទេ។ គ្មានប៊ូតុង ជួរ លេខ ឬមុខងារណាបាត់ទេ — មានតែការតុបតែងប៉ុណ្ណោះ។",
      },
      {
        en: "They are separate on purpose: Reduced stops movement, Lite Mode targets effects that cost the computer work on every repaint even when nothing is moving.",
        km: "ពួកវាដាច់ដោយឡែកដោយចេតនា៖ Reduced បញ្ឈប់ចលនា ចំណែក Lite Mode ផ្តោតលើឥទ្ធិពលដែលធ្វើឱ្យកុំព្យូទ័រធ្វើការរាល់ការគូរឡើងវិញ ទោះគ្មានអ្វីកម្រើកក៏ដោយ។",
      },
      {
        en: "The public Docs, sign-in and download pages honour both — with either switched on, they render as a deliberately static composition rather than a broken one.",
        km: "ទំព័រ Docs ការចូល និងការទាញយកជាសាធារណៈ គោរពទាំងពីរ — ពេលបើកមួយណាក៏ដោយ ពួកវាបង្ហាញជាការរចនាឋិតិវន្តដោយចេតនា មិនមែនជាទំព័រខូចទេ។",
      },
    ],
  },
  {
    id: "profile-details",
    icon: "users",
    route: "/profile",
    title: { en: "Your details and your password", km: "ព័ត៌មាន និងពាក្យសម្ងាត់របស់អ្នក" },
    blurb: {
      en: "Name, contact details, photo, cover image and password — all in one modal on the profile page.",
      km: "ឈ្មោះ ព័ត៌មានទំនាក់ទំនង រូបថត រូបគម្រប និងពាក្យសម្ងាត់ — ទាំងអស់ក្នុងប្រអប់តែមួយនៅទំព័រប្រវត្តិរូប។",
    },
    steps: [
      {
        en: "Open Profile and click Edit Profile. Fill in the name, username, email, phone and department fields, then Save Changes.",
        km: "បើក Profile រួចចុច Edit Profile។ បំពេញឈ្មោះ ឈ្មោះអ្នកប្រើ អ៊ីមែល ទូរស័ព្ទ និងផ្នែក រួចចុច Save Changes។",
      },
      {
        en: "For the password, use the Password button (or the Security & Password tab in the same modal): enter your current password, then the new one twice, and click Update Password.",
        km: "សម្រាប់ពាក្យសម្ងាត់ ប្រើប៊ូតុង Password (ឬផ្ទាំង Security & Password ក្នុងប្រអប់ដដែល)៖ បញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្ន រួចពាក្យសម្ងាត់ថ្មីពីរដង រួចចុច Update Password។",
      },
      {
        en: "Hover your round avatar and click Change to replace your photo.",
        km: "ដាក់ទស្សន៍ទ្រនិចលើរូបតំណាងមូល រួចចុច Change ដើម្បីប្តូររូបថត។",
      },
      {
        en: "For the banner, click Edit Cover — or open the Unsplash Wallpapers tab, filter by category or search, and click Apply Cover on any image.",
        km: "សម្រាប់រូបគម្រប ចុច Edit Cover — ឬបើកផ្ទាំង Unsplash Wallpapers ត្រងតាមប្រភេទ ឬស្វែងរក រួចចុច Apply Cover លើរូបណាមួយ។",
      },
    ],
    facts: [
      {
        en: "A new password must be at least six characters and both boxes must match, or the save is refused with the reason on screen.",
        km: "ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិចប្រាំមួយតួ ហើយប្រអប់ទាំងពីរត្រូវដូចគ្នា បើមិនដូច្នេះទេ ការរក្សាទុកត្រូវបានបដិសេធ ព្រមទាំងបង្ហាញមូលហេតុ។",
      },
      {
        en: "Changing your password ends your sessions on other devices — that is the point, and the modal warns you before you do it.",
        km: "ការប្តូរពាក្យសម្ងាត់បញ្ចប់វគ្គរបស់អ្នកនៅលើឧបករណ៍ផ្សេង — នេះជាគោលបំណង ហើយប្រអប់ព្រមានអ្នកមុនពេលធ្វើ។",
      },
      {
        en: "Your cover image is saved to your account, so it follows you to another browser and to the CAM ID phone app.",
        km: "រូបគម្របត្រូវបានរក្សាទុកក្នុងគណនីរបស់អ្នក ដូច្នេះវាតាមអ្នកទៅកម្មវិធីរុករកផ្សេង និងទៅកម្មវិធីទូរស័ព្ទ CAM ID។",
      },
    ],
  },
];
