/**
 * @file components/docs/content/adminUsers.ts
 * @description Chapter 05 — accounts, roles and the company logo: the
 * settings one person changes on everyone else's behalf. Split from
 * `adminSystem.ts` for file size.
 *
 * The role topics are written from what the code actually enforces, including
 * where a role opens a screen whose saves the API then refuses. Documenting
 * that honestly is more useful than a tidy permissions table that does not
 * match what happens when someone presses Save.
 */

import type { DocTopic } from "../docsTypes";

export const USER_ADMIN_TOPICS: DocTopic[] = [
  {
    id: "users",
    icon: "users",
    route: "/users",
    roles: ["Admin"],
    title: { en: "User accounts", km: "គណនីអ្នកប្រើប្រាស់" },
    blurb: {
      en: "The staff directory: who can sign in, how to reach them, which roles they hold and whether the account is locked.",
      km: "បញ្ជីបុគ្គលិក៖ អ្នកណាអាចចូល របៀបទាក់ទង តួនាទីអ្វីខ្លះដែលពួកគេមាន និងថាតើគណនីត្រូវបានចាក់សោឬអត់។",
    },
    steps: [
      {
        en: "Click your avatar in the header and choose Users & Roles Management. The page is not in the sidebar — that link is the only way in.",
        km: "ចុចរូបតំណាងអ្នកក្នុងរបារក្បាល រួចជ្រើស Users & Roles Management។ ទំព័រនេះមិននៅក្នុងរបារចំហៀងទេ — តំណនោះជាផ្លូវចូលតែមួយគត់។",
      },
      {
        en: "Search by name, username, email or role to find someone; click the refresh icon to re-read the list.",
        km: "ស្វែងរកតាមឈ្មោះ ឈ្មោះអ្នកប្រើ អ៊ីមែល ឬតួនាទី ដើម្បីរកបុគ្គលណាម្នាក់; ចុចរូបផ្ទុកឡើងវិញដើម្បីអានបញ្ជីម្តងទៀត។",
      },
      {
        en: "Click Add New User, fill Username, Email Address and Password (all required), plus the name and phone if you have them, then save.",
        km: "ចុច Add New User បំពេញ Username, Email Address និង Password (ចាំបាច់ទាំងអស់) បន្ថែមឈ្មោះ និងទូរស័ព្ទបើមាន រួចរក្សាទុក។",
      },
      {
        en: "To change what someone can reach, click Edit Roles on their row, tick or untick roles, and click Save Changes.",
        km: "ដើម្បីប្តូរអ្វីដែលបុគ្គលណាម្នាក់អាចចូលដល់ ចុច Edit Roles លើជួររបស់ពួកគេ ធីក ឬដកធីកតួនាទី រួចចុច Save Changes។",
      },
    ],
    facts: [
      {
        en: "There is no role picker on the create form. A new account gets the ordinary User role, and you promote it afterwards with Edit Roles.",
        km: "គ្មានកន្លែងជ្រើសតួនាទីនៅលើទម្រង់បង្កើតទេ។ គណនីថ្មីទទួលបានតួនាទី User ធម្មតា ហើយអ្នកតម្លើងវាក្រោយមកដោយ Edit Roles។",
      },
      {
        en: "Saving roles sends the whole ticked list, and anything you unticked is removed — so review the dialog before saving, not just the box you clicked.",
        km: "ការរក្សាទុកតួនាទីផ្ញើបញ្ជីដែលធីកទាំងមូល ហើយអ្វីដែលអ្នកដកធីក នឹងត្រូវលុប — ដូច្នេះសូមពិនិត្យប្រអប់ទាំងមូលមុនរក្សាទុក មិនត្រឹមប្រអប់ដែលអ្នកចុចទេ។",
      },
      {
        en: "The system refuses to remove Admin from the last remaining administrator, so the account cannot lock itself out of its own system.",
        km: "ប្រព័ន្ធបដិសេធការដកតួនាទី Admin ចេញពីអ្នកគ្រប់គ្រងចុងក្រោយ ដូច្នេះគណនីមិនអាចបិទផ្លូវចូលរបស់ខ្លួនឯងបានទេ។",
      },
      {
        en: "A failed save on this screen is silent — if a change appears not to take, reload the page and check the row before trying again.",
        km: "ការរក្សាទុកបរាជ័យនៅអេក្រង់នេះគឺស្ងាត់ — បើការផ្លាស់ប្តូរមើលទៅមិនកើត សូមផ្ទុកទំព័រឡើងវិញ ហើយពិនិត្យជួរនោះ មុននឹងព្យាយាមម្តងទៀត។",
      },
      {
        en: "The list loads the first 100 accounts and the search box filters those. Past 100 people, someone genuinely may not appear.",
        km: "បញ្ជីផ្ទុកគណនី ១០០ ដំបូង ហើយប្រអប់ស្វែងរកត្រងតែក្នុងចំណោមនោះ។ លើសពី ១០០ នាក់ បុគ្គលណាម្នាក់អាចមិនលេចឡើងពិតៗ។",
      },
    ],
  },
  {
    id: "roles",
    icon: "shield",
    route: "/users",
    roles: ["Admin"],
    title: { en: "What the roles actually do", km: "តួនាទីនីមួយៗធ្វើអ្វីខ្លះ" },
    blurb: {
      en: "Four roles matter in practice. The rest are labels — they identify a person, they do not open a door.",
      km: "តួនាទីបួនមានឥទ្ធិពលជាក់ស្តែង។ តួនាទីដែលនៅសល់ជាស្លាក — វាសម្គាល់បុគ្គល ប៉ុន្តែមិនបើកទ្វារទេ។",
    },
    steps: [
      {
        en: "Admin — the full administrator. It is the role the system checks for user and role administration, and the only one that can actually make those changes stick.",
        km: "Admin — អ្នកគ្រប់គ្រងពេញលេញ។ វាជាតួនាទីដែលប្រព័ន្ធពិនិត្យសម្រាប់ការគ្រប់គ្រងអ្នកប្រើ និងតួនាទី ហើយជាតួនាទីតែមួយគត់ដែលធ្វើឱ្យការផ្លាស់ប្តូរទាំងនោះជាប់បាន។",
      },
      {
        en: "SuperAdmin — opens the same screens as Admin, and can publish the company logo and the printed template. It is NOT accepted for creating users or changing roles.",
        km: "SuperAdmin — បើកអេក្រង់ដូច Admin ហើយអាចផ្សព្វផ្សាយនិមិត្តសញ្ញាក្រុមហ៊ុន និងគំរូបោះពុម្ព។ វា មិន ត្រូវបានទទួលយកសម្រាប់ការបង្កើតអ្នកប្រើ ឬប្តូរតួនាទីទេ។",
      },
      {
        en: "Manager — one real privilege: publishing the printed report template for everyone.",
        km: "Manager — មានសិទ្ធិពិតតែមួយ៖ ការផ្សព្វផ្សាយគំរូរបាយការណ៍បោះពុម្ពសម្រាប់អ្នកគ្រប់គ្នា។",
      },
      {
        en: "User — the ordinary staff role, and what every new account gets. It reaches every workflow, inventory and report screen; only the administrative pages are closed to it.",
        km: "User — តួនាទីបុគ្គលិកធម្មតា និងជាតួនាទីដែលគណនីថ្មីៗទទួលបាន។ វាចូលដល់អេក្រង់ដំណើរការ សារពើភណ្ឌ និងរបាយការណ៍ទាំងអស់; មានតែទំព័រគ្រប់គ្រងប៉ុណ្ណោះដែលបិទចំពោះវា។",
      },
    ],
    facts: [
      {
        en: "If a SuperAdmin's saves on the Users screen keep doing nothing, that is why: check the account also holds Admin.",
        km: "បើការរក្សាទុករបស់ SuperAdmin នៅអេក្រង់ Users មិនកើតជាប់ជាប្រចាំ នេះជាមូលហេតុ៖ សូមពិនិត្យថាគណនីនោះមានតួនាទី Admin ផងដែរឬអត់។",
      },
      {
        en: "The workflow, stock and sales screens carry NO role gate — anyone signed in can open them. Roles here are about administration, not about who may work a queue.",
        km: "អេក្រង់ដំណើរការ ស្តុក និងលក់ គ្មានច្រកតួនាទីទេ — អ្នកដែលចូលរួចអាចបើកបាន។ តួនាទីនៅទីនេះទាក់ទងនឹងការគ្រប់គ្រង មិនមែនអំពីអ្នកណាអាចធ្វើការលើជួរណាទេ។",
      },
      {
        en: "The role shown next to your name in the header is only the first one you hold — someone with two roles sees one of them.",
        km: "តួនាទីដែលបង្ហាញក្បែរឈ្មោះអ្នកក្នុងរបារក្បាល គឺជាតួនាទីទីមួយប៉ុណ្ណោះ — អ្នកមានតួនាទីពីរនឹងឃើញតែមួយ។",
      },
      {
        en: "The role check in the browser decides what to DRAW. The server decides what is ALLOWED. Never rely on a hidden menu to keep anyone out of anything that matters.",
        km: "ការត្រួតពិនិត្យតួនាទីក្នុងកម្មវិធីរុករក សម្រេចថា គូរអ្វី។ ម៉ាស៊ីនមេសម្រេចថា អនុញ្ញាតអ្វី។ កុំពឹងលើម៉ឺនុយដែលលាក់ ដើម្បីរារាំងអ្នកណាម្នាក់ពីរឿងសំខាន់ឡើយ។",
      },
    ],
  },
  {
    id: "branding",
    icon: "sparkles",
    route: "/profile?tab=settings",
    roles: ["Admin", "SuperAdmin"],
    title: { en: "The company logo", km: "និមិត្តសញ្ញាក្រុមហ៊ុន" },
    blurb: {
      en: "The one appearance setting that is not personal: the logo in the sidebar and on the sign-in screen, for everybody.",
      km: "ការកំណត់រូបរាងតែមួយដែលមិនមែនផ្ទាល់ខ្លួន៖ និមិត្តសញ្ញាក្នុងរបារចំហៀង និងលើអេក្រង់ចូល សម្រាប់អ្នកគ្រប់គ្នា។",
    },
    steps: [
      {
        en: "Open System Settings → Appearance & Branding. The first card is System Brand Logo.",
        km: "បើក System Settings → Appearance & Branding។ កាតដំបូងគឺ System Brand Logo។",
      },
      {
        en: "Click Upload from device and choose a JPG, PNG, WebP or GIF up to 10 MB.",
        km: "ចុច Upload from device រួចជ្រើស JPG, PNG, WebP ឬ GIF រហូតដល់ 10 MB។",
      },
      {
        en: "Drag the Logo Zoom & Scale slider so the mark fills its frame properly.",
        km: "អូសរបារ Logo Zoom & Scale ដើម្បីឱ្យនិមិត្តសញ្ញាបំពេញស៊ុមរបស់វាបានត្រឹមត្រូវ។",
      },
      {
        en: "Use Auto-Apply Logo Color if you want the app's accent to follow the logo.",
        km: "ប្រើ Auto-Apply Logo Color បើអ្នកចង់ឱ្យពណ៌សំខាន់របស់កម្មវិធីតាមនិមិត្តសញ្ញា។",
      },
    ],
    facts: [
      {
        en: "Saving this needs the Admin or SuperAdmin role. Anyone can click Upload, but for anyone else the picture is only shown in their own browser and no other user ever sees it.",
        km: "ការរក្សាទុកនេះត្រូវការតួនាទី Admin ឬ SuperAdmin។ អ្នកណាក៏អាចចុច Upload បាន ប៉ុន្តែសម្រាប់អ្នកផ្សេង រូបភាពបង្ហាញតែក្នុងកម្មវិធីរុករករបស់គេប៉ុណ្ណោះ ហើយគ្មានអ្នកប្រើផ្សេងឃើញទេ។",
      },
      {
        en: "The zoom slider is global too — moving it changes the logo's size for every user, not just yours.",
        km: "របារពង្រីកក៏ជាការកំណត់សកលដែរ — ការផ្លាស់ទីវាប្តូរទំហំនិមិត្តសញ្ញាសម្រាប់អ្នកប្រើគ្រប់រូប មិនត្រឹមតែរបស់អ្នកទេ។",
      },
      {
        en: "With no company logo set, that card can show your own profile photo instead — so an accent “detected from the logo” may in fact have come from your portrait.",
        km: "ពេលមិនទាន់កំណត់និមិត្តសញ្ញាក្រុមហ៊ុន កាតនោះអាចបង្ហាញរូបថតប្រវត្តិរូបរបស់អ្នកជំនួសវិញ — ដូច្នេះពណ៌ដែល “រកឃើញពីនិមិត្តសញ្ញា” អាចមកពីរូបថតរបស់អ្នកជាក់ស្តែង។",
      },
    ],
  },
];
