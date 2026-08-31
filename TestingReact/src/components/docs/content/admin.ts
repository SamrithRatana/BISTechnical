/**
 * @file components/docs/content/admin.ts
 * @description Chapter 05 — your account, and the settings one person changes
 * for everybody.
 *
 * The topics are split across four files purely for size — `adminAppearance`
 * and `adminDevices` cover your own account, `adminUsers` and
 * `adminPublishing` cover the company-wide settings. The order below is the
 * order they read in: everything personal first, then everything shared.
 */

import type { DocChapter } from "../docsTypes";
import { APPEARANCE_TOPICS } from "./adminAppearance";
import { DEVICE_TOPICS } from "./adminDevices";
import { USER_ADMIN_TOPICS } from "./adminUsers";
import { PUBLISHING_TOPICS } from "./adminPublishing";

export const ADMIN_CHAPTER: DocChapter = {
  id: "administration",
  index: "05",
  accent: "sky",
  icon: "settings",
  title: { en: "Account, security & administration", km: "គណនី សុវត្ថិភាព និងការគ្រប់គ្រង" },
  tagline: {
    en: "Everything about your own account — how the app looks, who you are, which devices can act as you — followed by the handful of settings that change the system for everyone.",
    km: "អ្វីៗអំពីគណនីផ្ទាល់ខ្លួនរបស់អ្នក — រូបរាងកម្មវិធី អត្តសញ្ញាណអ្នក ឧបករណ៍ណាអាចធ្វើសកម្មភាពជំនួសអ្នក — បន្ទាប់មកការកំណត់មួយចំនួនតូចដែលប្តូរប្រព័ន្ធសម្រាប់អ្នកគ្រប់គ្នា។",
  },
  topics: [
    ...APPEARANCE_TOPICS,
    ...DEVICE_TOPICS,
    ...USER_ADMIN_TOPICS,
    ...PUBLISHING_TOPICS,
  ],
};
