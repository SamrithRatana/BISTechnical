/**
 * @file components/docs/content/startAccess.ts
 * @description Chapter 01, first half — getting through the front door.
 *
 * The wording of buttons, tabs and error messages here is quoted from the real
 * screens, so a reader can match what the manual says against what is in front
 * of them. Where a message is only ever shown in one language, it is quoted in
 * that language on both sides rather than translated into something the screen
 * will never say.
 */

import type { DocTopic } from "../docsTypes";

export const ACCESS_TOPICS: DocTopic[] = [
  {
    id: "sign-in",
    icon: "key",
    route: "/login",
    title: { en: "Sign in with a password", km: "ចូលប្រព័ន្ធដោយពាក្យសម្ងាត់" },
    blurb: {
      en: "The default way in. Everything else on this page is an alternative to typing this one thing.",
      km: "វិធីចូលធម្មតា។ វិធីផ្សេងទៀតទាំងអស់នៅទំព័រនេះ គ្រាន់តែជាជម្រើសជំនួសការវាយពាក្យសម្ងាត់ប៉ុណ្ណោះ។",
    },
    steps: [
      {
        en: "Open the portal. The card opens on Password & PIN, headed “Welcome back”.",
        km: "បើកប្រព័ន្ធ។ ប្រអប់នឹងបើកនៅរបៀប Password & PIN ក្រោមចំណងជើង “Welcome back”។",
      },
      {
        en: "Type your account name in Username and your password in Password. The eye icon inside the field shows what you typed.",
        km: "វាយឈ្មោះគណនីក្នុងវាល Username និងពាក្យសម្ងាត់ក្នុងវាល Password។ រូបភ្នែកក្នុងវាលបង្ហាញអ្វីដែលអ្នកបានវាយ។",
      },
      {
        en: "Click Sign In to Portal. The five-stage handshake overlay covers the screen while the system checks you and warms up your data.",
        km: "ចុច Sign In to Portal។ ផ្ទាំង handshake ៥ដំណាក់កាលនឹងគ្របលើអេក្រង់ ខណៈប្រព័ន្ធផ្ទៀងផ្ទាត់អ្នក និងរៀបចំទិន្នន័យជាមុន។",
      },
      {
        en: "If the details are wrong, the overlay rolls back and a red banner reads “Invalid username or password”. If the server cannot be reached it reads “Failed to connect to authentication server”.",
        km: "បើព័ត៌មានខុស ផ្ទាំងនឹងថយក្រោយ ហើយបង្ហាញសារពណ៌ក្រហម “Invalid username or password”។ បើទាក់ទងម៉ាស៊ីនមេមិនបាន វានឹងបង្ហាញ “Failed to connect to authentication server”។",
      },
    ],
    facts: [
      {
        en: "If your account has face 2FA switched on, the password is only step one — the camera panel opens next. See “Face verification after your password”.",
        km: "បើគណនីរបស់អ្នកបើក 2FA ស្កេនមុខ ពាក្យសម្ងាត់គ្រាន់តែជាជំហានទីមួយ — ផ្ទាំងកាមេរ៉ានឹងបើកបន្ត។ សូមមើល “ការផ្ទៀងផ្ទាត់មុខបន្ទាប់ពីពាក្យសម្ងាត់”។",
      },
      {
        en: "The 1-Click Demo Personas under the form (Admin, Technician, Supervisor) all fill the SAME demo credentials — the labels are cosmetic and do not choose a role. Clicking one fills the boxes; you still press Sign In yourself.",
        km: "ប៊ូតុង 1-Click Demo Personas ខាងក្រោម (Admin, Technician, Supervisor) បំពេញព័ត៌មានសាកល្បង ដូចគ្នាទាំងអស់ — ស្លាកគ្រាន់តែសម្រាប់មើល មិនជ្រើសតួនាទីទេ។ ការចុចវាបំពេញវាលតែប៉ុណ្ណោះ អ្នកនៅតែត្រូវចុច Sign In ដោយខ្លួនឯង។",
      },
      {
        en: "“Forgot Password?” is plain text, not a link — there is no self-service password reset. Ask an administrator, or change it yourself from Profile once you are in.",
        km: "“Forgot Password?” គ្រាន់តែជាអក្សរ មិនមែនតំណទេ — គ្មានមុខងារកំណត់ពាក្យសម្ងាត់ឡើងវិញដោយខ្លួនឯងទេ។ សូមសុំអ្នកគ្រប់គ្រង ឬប្តូរដោយខ្លួនឯងនៅ Profile ក្រោយពេលចូលរួច។",
      },
      {
        en: "How long you stay signed in comes from the session token's own expiry — the “Remember me?” tick does not change it.",
        km: "រយៈពេលដែលអ្នកនៅក្នុងប្រព័ន្ធ អាស្រ័យលើអាយុកាល token មិនមែនលើប្រអប់ “Remember me?” ទេ។",
      },
    ],
  },
  {
    id: "sign-in-methods",
    icon: "shield",
    route: "/login",
    title: { en: "Choose a different sign-in method", km: "ជ្រើសរើសវិធីចូលផ្សេង" },
    blurb: {
      en: "Three ways to prove who you are: a password, your paired phone, or a hardware passkey such as Windows Hello or Face ID.",
      km: "វិធីបញ្ជាក់អត្តសញ្ញាណបីយ៉ាង៖ ពាក្យសម្ងាត់ ទូរស័ព្ទដែលបានភ្ជាប់ ឬ passkey ដូចជា Windows Hello ឬ Face ID។",
    },
    steps: [
      {
        en: "Click the small pill at the top-right of the sign-in form — it shows the active method (Standard, Mobile 2FA or Biometric) — or the Other Sign-In Methods button below the form.",
        km: "ចុចប៊ូតុងតូចនៅជ្រុងខាងលើស្តាំនៃទម្រង់ចូល — វាបង្ហាញវិធីបច្ចុប្បន្ន (Standard, Mobile 2FA ឬ Biometric) — ឬចុច Other Sign-In Methods ខាងក្រោមទម្រង់។",
      },
      {
        en: "The card slides to Choose Sign-In Method. Click one of the three cards: Password & PIN, CAM ID Mobile Face & Auth, or Hardware Passkey. The one you are on carries an Active chip.",
        km: "ប្រអប់នឹងរុញទៅផ្ទាំង Choose Sign-In Method។ ចុចលើកាតមួយក្នុងចំណោមបី៖ Password & PIN, CAM ID Mobile Face & Auth ឬ Hardware Passkey។ វិធីបច្ចុប្បន្នមានស្លាក Active។",
      },
      {
        en: "For Hardware Passkey, click “Sign in with Face or Passkey” and complete your device's own prompt — face, fingerprint, PIN or security key.",
        km: "សម្រាប់ Hardware Passkey ចុច “Sign in with Face or Passkey” រួចបំពេញការសួររបស់ឧបករណ៍អ្នក — មុខ ស្នាមម្រាមដៃ PIN ឬ security key។",
      },
      {
        en: "On a phone or a narrow window, use the Switch Method / Back button in the card header instead.",
        km: "នៅលើទូរស័ព្ទ ឬអេក្រង់តូច សូមប្រើប៊ូតុង Switch Method / Back នៅក្បាលប្រអប់ជំនួសវិញ។",
      },
    ],
    facts: [
      {
        en: "Your choice is remembered for that browser tab only — a brand-new tab always opens on Password & PIN.",
        km: "ជម្រើសរបស់អ្នកត្រូវបានចងចាំសម្រាប់ផ្ទាំងនោះតែប៉ុណ្ណោះ — ផ្ទាំងថ្មីនឹងបើកនៅ Password & PIN ជានិច្ច។",
      },
      {
        en: "You cannot enrol a passkey from the login screen: adding one binds a new device to your account, so it needs a session you have already proved. It lives in Profile → Device & Sessions.",
        km: "អ្នកមិនអាចចុះឈ្មោះ passkey ពីអេក្រង់ចូលបានទេ៖ ការបន្ថែម passkey គឺជាការភ្ជាប់ឧបករណ៍ថ្មីទៅគណនី ដូច្នេះវាត្រូវការវគ្គដែលបានផ្ទៀងផ្ទាត់រួច។ វាស្ថិតនៅ Profile → Device & Sessions។",
      },
      {
        en: "Passkey sign-in usually goes out with no username at all — the browser offers whichever passkeys the device holds and the account is resolved from the credential itself.",
        km: "ការចូលដោយ passkey ជាធម្មតាមិនផ្ញើឈ្មោះអ្នកប្រើទេ — កម្មវិធីរុករកបង្ហាញ passkey ដែលឧបករណ៍មាន ហើយគណនីត្រូវបានកំណត់ពី credential នោះតែម្តង។",
      },
      {
        en: "Dismissing your device's prompt is treated as a decision, not an error: it reads “Sign-in was cancelled.” and nothing else happens.",
        km: "ការបិទការសួររបស់ឧបករណ៍ ត្រូវបានចាត់ទុកជាការសម្រេចចិត្ត មិនមែនកំហុសទេ៖ វាបង្ហាញ “Sign-in was cancelled.” ហើយគ្មានអ្វីកើតឡើងបន្ថែម។",
      },
    ],
  },
  {
    id: "phone-sign-in",
    icon: "phone",
    route: "/login",
    title: { en: "Sign in with the CAM ID phone app", km: "ចូលប្រព័ន្ធដោយកម្មវិធី CAM ID" },
    blurb: {
      en: "Approve the sign-in on a phone you have already paired — by push, by matching a number, or by scanning a QR code.",
      km: "អនុម័តការចូលនៅលើទូរស័ព្ទដែលបានភ្ជាប់រួច — តាមការជូនដំណឹង តាមការផ្គូផ្គងលេខ ឬតាមការស្កេន QR។",
    },
    steps: [
      {
        en: "Choose CAM ID Mobile Face & Auth from the method selector. Three tabs appear: Face Login or PIN, Match Number and Scan QR.",
        km: "ជ្រើស CAM ID Mobile Face & Auth ពីបញ្ជីវិធី។ ផ្ទាំងបីនឹងលេចឡើង៖ Face Login or PIN, Match Number និង Scan QR។",
      },
      {
        en: "Face Login or PIN — type your username or email, click Send, then approve “Approve Sign In Request?” on the phone and scan your face (or use your 6-digit PIN).",
        km: "Face Login or PIN — វាយឈ្មោះអ្នកប្រើ ឬអ៊ីមែល ចុច Send រួចអនុម័ត “Approve Sign In Request?” នៅលើទូរស័ព្ទ ហើយស្កេនមុខ (ឬប្រើ PIN ៦ខ្ទង់)។",
      },
      {
        en: "Match Number — the same push, but the computer shows a large number and you must tap that same number on the phone. Tapping the wrong one denies the sign-in immediately.",
        km: "Match Number — ដូចគ្នា ប៉ុន្តែកុំព្យូទ័របង្ហាញលេខធំមួយ ហើយអ្នកត្រូវចុចលេខដូចគ្នានៅលើទូរស័ព្ទ។ ការចុចលេខខុសនឹងបដិសេធការចូលភ្លាមៗ។",
      },
      {
        en: "Scan QR — scan the code on screen with the phone, then look at the phone camera. The computer signs itself in when the phone confirms.",
        km: "Scan QR — ស្កេនកូដលើអេក្រង់ដោយទូរស័ព្ទ រួចមើលកាមេរ៉ាទូរស័ព្ទ។ កុំព្យូទ័រនឹងចូលដោយខ្លួនឯង នៅពេលទូរស័ព្ទបញ្ជាក់។",
      },
    ],
    facts: [
      {
        en: "A push challenge lasts 90 seconds; a QR lasts 5 minutes and regenerates itself. Resend Challenge starts a fresh one without retyping your username.",
        km: "ការស្នើតាមការជូនដំណឹងមានរយៈពេល ៩០ វិនាទី; QR មានរយៈពេល ៥ នាទី ហើយបង្កើតឡើងវិញដោយស្វ័យប្រវត្តិ។ Resend Challenge ចាប់ផ្ដើមថ្មី ដោយមិនចាំបាច់វាយឈ្មោះម្តងទៀត។",
      },
      {
        en: "The phone must be on the same Wi-Fi as the computer — the QR points at the computer's address on that network.",
        km: "ទូរស័ព្ទត្រូវនៅលើ Wi-Fi ដូចគ្នានឹងកុំព្យូទ័រ — QR ចង្អុលទៅអាសយដ្ឋានកុំព្យូទ័រនៅលើបណ្តាញនោះ។",
      },
      {
        en: "The QR carries only the pairing session id. The secret that lets your computer read the result never leaves it, so photographing the screen does not let a bystander take your session.",
        km: "QR មានតែលេខសម្គាល់វគ្គភ្ជាប់ប៉ុណ្ណោះ។ លេខសម្ងាត់ដែលឱ្យកុំព្យូទ័រអានលទ្ធផល មិនចេញពីកុំព្យូទ័រទេ ដូច្នេះការថតរូបអេក្រង់មិនអាចឱ្យអ្នកដទៃយកវគ្គរបស់អ្នកបានឡើយ។",
      },
      {
        en: "If the app is not connected you are told immediately — “Your CAM ID phone is not connected right now.” — but the computer keeps waiting, because a phone usually reconnects in seconds.",
        km: "បើកម្មវិធីមិនបានភ្ជាប់ អ្នកនឹងត្រូវបានប្រាប់ភ្លាមៗ — “Your CAM ID phone is not connected right now.” — ប៉ុន្តែកុំព្យូទ័រនៅតែរង់ចាំ ព្រោះទូរស័ព្ទតែងតែភ្ជាប់ឡើងវិញក្នុងរយៈពេលខ្លី។",
      },
      {
        en: "The phone allows five failed face checks, then blocks that request and denies the waiting computer by itself.",
        km: "ទូរស័ព្ទអនុញ្ញាតការស្កេនមុខបរាជ័យ ៥ ដង រួចទប់ស្កាត់សំណើនោះ ហើយបដិសេធកុំព្យូទ័រដែលកំពុងរង់ចាំដោយខ្លួនឯង។",
      },
    ],
  },
  {
    id: "face-2fa-login",
    icon: "scan",
    route: "/login",
    title: { en: "Face verification after your password", km: "ការផ្ទៀងផ្ទាត់មុខបន្ទាប់ពីពាក្យសម្ងាត់" },
    blurb: {
      en: "The extra step some accounts get: the password is accepted, then the computer's own camera confirms it is really you.",
      km: "ជំហានបន្ថែមសម្រាប់គណនីខ្លះ៖ ពាក្យសម្ងាត់ត្រូវបានទទួលយក រួចកាមេរ៉ាកុំព្យូទ័របញ្ជាក់ថាពិតជាអ្នក។",
    },
    steps: [
      {
        en: "Sign in with your username and password as normal.",
        km: "ចូលដោយឈ្មោះអ្នកប្រើ និងពាក្យសម្ងាត់ដូចធម្មតា។",
      },
      {
        en: "The form is replaced by “Confirm it's you” — “Your password was accepted. Look at the camera to finish signing in.”",
        km: "ទម្រង់ត្រូវបានជំនួសដោយ “Confirm it's you” — “Your password was accepted. Look at the camera to finish signing in.”",
      },
      {
        en: "Allow camera access, look straight at the camera and hold still. The panel guides you through starting the camera, finding your face and verifying it.",
        km: "អនុញ្ញាតឱ្យប្រើកាមេរ៉ា មើលត្រង់ទៅកាមេរ៉ា ហើយកុំកម្រើក។ ផ្ទាំងនឹងណែនាំអ្នកតាមដំណាក់កាល៖ បើកកាមេរ៉ា រកមុខ និងផ្ទៀងផ្ទាត់។",
      },
      {
        en: "If it does not match you are told how many attempts are left and the camera restarts. Cancel takes you back to the password form.",
        km: "បើមិនត្រូវគ្នា អ្នកនឹងត្រូវបានប្រាប់ចំនួនដងដែលនៅសល់ ហើយកាមេរ៉ានឹងចាប់ផ្ដើមឡើងវិញ។ Cancel នាំអ្នកត្រឡប់ទៅទម្រង់ពាក្យសម្ងាត់។",
      },
    ],
    facts: [
      {
        en: "No photo is uploaded. Only a numeric description of your face is sent, and the camera runs on your own computer.",
        km: "គ្មានរូបថតត្រូវបានផ្ញើឡើងទេ។ មានតែលេខពិពណ៌នាមុខប៉ុណ្ណោះដែលត្រូវផ្ញើ ហើយកាមេរ៉ាដំណើរការនៅលើកុំព្យូទ័ររបស់អ្នកផ្ទាល់។",
      },
      {
        en: "More than one face in view is refused rather than resolved — on a shared workstation, the second face is a colleague standing behind you.",
        km: "បើមានមុខច្រើនជាងមួយក្នុងស៊ុម ប្រព័ន្ធនឹងបដិសេធជាជាងជ្រើសរើស — នៅកន្លែងធ្វើការរួម មុខទីពីរអាចជាមិត្តរួមការងារឈរពីក្រោយអ្នក។",
      },
      {
        en: "Take too long and the challenge expires: “That took too long. Please sign in again.” Nothing is lost — start again from the password.",
        km: "បើយូរពេក ការស្នើនឹងផុតកំណត់៖ “That took too long. Please sign in again.” គ្មានអ្វីបាត់បង់ទេ — គ្រាន់តែចាប់ផ្ដើមពីពាក្យសម្ងាត់ម្តងទៀត។",
      },
      {
        en: "You turn this on yourself in Profile → Device & Sessions, and you must enrol your face there before the switch will accept.",
        km: "អ្នកបើកមុខងារនេះដោយខ្លួនឯងនៅ Profile → Device & Sessions ហើយអ្នកត្រូវចុះឈ្មោះមុខនៅទីនោះជាមុនសិន ទើបកុងតាកទទួលយក។",
      },
    ],
  },
];
