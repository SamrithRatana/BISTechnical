/**
 * @file components/docs/content/articlesAdmin.ts
 * @description Chapter 5 - user administration, roles, and workspace appearance.
 *
 * Split out of `docsData.ts` so no single file carries the whole catalogue
 * (§1: nothing over ~300 lines). `docsData.ts` assembles these back in
 * chapter order and is still the import path every consumer uses.
 */

import type { DocsSectionGroup } from "./articleTypes";

export const ADMIN_SECTION: DocsSectionGroup = {
  id: "admin-security",
  titleKm: "ការគ្រប់គ្រងប្រព័ន្ធ & សុវត្ថិភាព",
  titleEn: "Admin & Security Settings",
  icon: "Settings",
  badge: "Admin",
  articles: [
    {
      id: "admin-users",
      titleKm: "ការគ្រប់គ្រងអ្នកប្រើប្រាស់ & សិទ្ធិ (RBAC)",
      titleEn: "User Management & Role-Based Access",
      subtitleKm: "ការបង្កើតគណនីបុគ្គលិក កំណត់តួនាទី (Admin, Supervisor, Technician, Front Desk) និងការកំណត់សិទ្ធិលម្អិត",
      subtitleEn: "User lifecycle, role assignment, permission matrix, and multi-factor security",
      categoryKm: "ការគ្រប់គ្រងប្រព័ន្ធ & សុវត្ថិភាព",
      categoryEn: "Admin & Security",
      icon: "Users",
      route: "/users",
      roles: ["Admin"],
      summaryKm: "ទំព័រ `/users` អនុញ្ញាតឱ្យថ្នាក់គ្រប់គ្រងប្រព័ន្ធបង្កើតគណនីថ្មី កំណត់តួនាទី និងកម្រិតសិទ្ធិក្នុងការចូលមើល ឬកែប្រែទិន្នន័យតាមផ្នែកនីមួយៗ។",
      summaryEn: "Admin control plane for user provisioning, role assignments, claim policies, and credential resets.",
      diagram: {
        titleKm: "លំហូរគ្រប់គ្រងអ្នកប្រើប្រាស់ & សិទ្ធិ (User Provisioning & RBAC Flow)",
        titleEn: "User Provisioning & RBAC Architecture Flow",
        descriptionKm: "ការបង្កើតគណនីបុគ្គលិក ការកំណត់តួនាទី និងការបែងចែកកម្រិតសិទ្ធិការពារទិន្នន័យ",
        descriptionEn: "Lifecycle provisioning workflow from account creation to RBAC claim enforcement.",
        nodes: [
          { id: "adm_u1", labelKm: "១. បង្កើត Profile បុគ្គលិកថ្មី", labelEn: "1. Create User Profile", badgeKm: "Identity", badgeEn: "Identity", color: "violet", route: "/users" },
          { id: "adm_u2", labelKm: "២. ចាត់តាំង Role (Admin/Tech/Sup)", labelEn: "2. Assign Enterprise Role", badgeKm: "RBAC", badgeEn: "RBAC", color: "cyan" },
          { id: "adm_u3", labelKm: "៣. កំណត់សិទ្ធិលើ Menu & របាយការណ៍", labelEn: "3. Scope Permissions", badgeKm: "Claims", badgeEn: "Claims", color: "indigo" },
          { id: "adm_u4", labelKm: "៤. ចុះឈ្មោះ Face ID & Biometrics", labelEn: "4. Register Face ID", badgeKm: "Biometric", badgeEn: "Biometric", color: "amber" },
          { id: "adm_u5", labelKm: "៥. ត្រួតពិនិត្យកំណត់ត្រាចូលប្រើ (Audit Log)", labelEn: "5. Active Session Audit", badgeKm: "Security", badgeEn: "Security", color: "emerald" },
        ],
      },
      steps: [
        {
          number: 1,
          titleKm: "បង្កើតគណនីអ្នកប្រើប្រាស់ថ្មី",
          titleEn: "Create New User",
          descKm: "ចូលទៅ `/users` ចុច 'Add User' បំពេញឈ្មោះ Username, Email និងកំណត់ពាក្យសម្ងាត់ដំបូង។",
          descEn: "Open User Management, click Add User, and enter credentials and basic profile details.",
        },
        {
          number: 2,
          titleKm: "ចាត់តាំងតួនាទី (Role Assignment)",
          titleEn: "Assign Roles & Permissions",
          descKm: "ជ្រើសរើសតួនាទីសមស្របដូចជា Admin, Supervisor, Technician, ឬ Sales ដើម្បីកំណត់កម្រិតសិទ្ធិ។",
          descEn: "Select target roles to grant appropriate access levels across workflow and reports.",
        },
      ],
    },
    {
      id: "admin-profile",
      titleKm: "ការគ្រប់គ្រង Profile & ចុះឈ្មោះ Face ID (/profile)",
      titleEn: "Profile Management & Biometric Face ID Enrollment",
      subtitleKm: "ការកែប្រែព័ត៌មានផ្ទាល់ខ្លួន ផ្លាស់ប្តូរពាក្យសម្ងាត់ និងការថតស្កេនផ្ទៃមុខសម្រាប់ Face ID",
      subtitleEn: "Personal profile settings, password changes, and webcam biometric enrollment",
      categoryKm: "ការគ្រប់គ្រងប្រព័ន្ធ & សុវត្ថិភាព",
      categoryEn: "Admin & Security",
      icon: "UserCheck",
      route: "/profile",
      summaryKm: "ទំព័រ `/profile` សម្រាប់អ្នកប្រើប្រាស់គ្រប់រូបក្នុងការគ្រប់គ្រងគណនីផ្ទាល់ខ្លួន ប្តូរពាក្យសម្ងាត់ និងថតស្កេនផ្ទៃមុខ Face ID ដើម្បីអាចចូលប្រើប្រព័ន្ធបានលឿនក្នុងរយៈពេល ១ វិនាទី។",
      summaryEn: "Self-service profile center for password resets and high-precision biometric face enrollment.",
      diagram: {
        titleKm: "លំហូរចុះឈ្មោះ Face ID ផ្ទាល់ខ្លួន (Face ID Enrollment Flow)",
        titleEn: "Biometric Enrollment Pipeline",
        descriptionKm: "ដំណើរការថតស្កេនផ្ទៃមុខ ទាញយក 128D Vector និងរក្សាទុកក្នុង Identity Database",
        descriptionEn: "Facial landmark detection and cryptographic descriptor template storage pipeline.",
        nodes: [
          { id: "prf1", labelKm: "១. ចូលទៅកាន់ទំព័រ /profile", labelEn: "1. Open Profile Page", badgeKm: "Profile", badgeEn: "Profile", color: "violet", route: "/profile" },
          { id: "prf2", labelKm: "២. បើកកាមេរ៉ា Webcam ថតស្កេនមុខ", labelEn: "2. Capture Face Scan", badgeKm: "Camera", badgeEn: "Camera", color: "cyan" },
          { id: "prf3", labelKm: "៣. គណនា 128-Dimensional Vector", labelEn: "3. Extract 128D Vector", badgeKm: "AI Model", badgeEn: "AI Model", color: "indigo" },
          { id: "prf4", labelKm: "៤. រក្សាទុកក្នុង UserManagement DB", labelEn: "4. Store Biometric Template", badgeKm: "Encrypted", badgeEn: "Encrypted", color: "emerald" },
        ],
      },
      steps: [
        {
          number: 1,
          titleKm: "ចុះឈ្មោះផ្ទៃមុខ Face ID",
          titleEn: "Enroll Face ID",
          descKm: "ចូលទៅ `/profile` ចុច 'Register Face ID' អង្គុយចំពីមុខកាមេរ៉ា ហើយចុច Capture ដើម្បីរក្សាទុក។",
          descEn: "Position face in camera frame and capture biometric template.",
        },
      ],
    },
    {
      id: "admin-theme",
      titleKm: "ការកំណត់ទម្រង់ & សោភ័ណភាព (Theme Settings)",
      titleEn: "Theme & Customization Settings",
      subtitleKm: "ការប្តូរពណ៌ Accent Color, មុខងារ Dark/Light Mode, និងការជ្រើសរើសភាសា (ខ្មែរ / អង់គ្លេស)",
      subtitleEn: "Accent color palette personalization, dark/light theme switching, and bilingual localization",
      categoryKm: "ការគ្រប់គ្រងប្រព័ន្ធ & សុវត្ថិភាព",
      categoryEn: "Admin & Security",
      icon: "Palette",
      route: "/settings",
      summaryKm: "អ្នកប្រើប្រាស់អាចកែសម្រួលពណ៌នៃផ្ទាំងកម្មវិធី (Accent Colors) ផ្លាស់ប្តូរ Dark/Light Mode និងជ្រើសរើសភាសាខ្មែរ ឬអង់គ្លេសតាមចំណង់ចំណូលចិត្ត។",
      summaryEn: "Customize system appearance, dark mode preferences, and language settings with immediate local persistence.",
      diagram: {
        titleKm: "លំហូរការកំណត់រូបរាង & ភាសា (Personalization Flow)",
        titleEn: "UI Theme & Localization Flow",
        descriptionKm: "ដំណើរការផ្លាស់ប្តូរពណ៌ Accent, Dark/Light Mode និងភាសាដោយរក្សាទុកក្នុង Browser",
        descriptionEn: "Customization flow applying CSS variables and bilingual dictionary switching.",
        nodes: [
          { id: "adm_t1", labelKm: "១. បើកទំព័រ Settings (/settings)", labelEn: "1. Open Theme Settings", badgeKm: "Settings", badgeEn: "Settings", color: "violet", route: "/settings" },
          { id: "adm_t2", labelKm: "២. ជ្រើសរើសពណ៌ Accent Palette", labelEn: "2. Choose Accent Color", badgeKm: "Palette", badgeEn: "Palette", color: "cyan" },
          { id: "adm_t3", labelKm: "៣. ប្តូរ Dark Mode ឬ Light Mode", labelEn: "3. Toggle Dark / Light", badgeKm: "Theme", badgeEn: "Theme", color: "indigo" },
          { id: "adm_t4", labelKm: "៤. ជ្រើសរើសភាសា (ខ្មែរ / English)", labelEn: "4. Select Language", badgeKm: "Language", badgeEn: "Language", color: "amber" },
          { id: "adm_t5", labelKm: "៥. រក្សាទុកក្នុង LocalStorage", labelEn: "5. Persist Preferences", badgeKm: "Saved", badgeEn: "Saved", color: "emerald" },
        ],
      },
    },
  ],
};
