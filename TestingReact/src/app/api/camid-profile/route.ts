import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/camid-profile
 * Generates an Apple iOS WebClip Configuration Profile (.mobileconfig)
 * for 1-Tap CAM ID Icon creation directly on iPhone Home Screen.
 */
export async function GET(req: NextRequest) {
  try {
    const cloudTargetUrl = "exp://u.expo.dev/cacb17a6-21d6-4b45-abf1-aab99521f61e?channel-name=master";

    // Read icon file and base64 encode it
    let iconBase64 = "";
    try {
      const iconPath = path.join(process.cwd(), "public", "apple-touch-icon.png");
      if (fs.existsSync(iconPath)) {
        const iconBuffer = fs.readFileSync(iconPath);
        iconBase64 = iconBuffer.toString("base64");
      }
    } catch {}

    const mobileConfigXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>PayloadContent</key>
    <array>
        <dict>
            <key>FullScreen</key>
            <true/>
            ${iconBase64 ? `<key>Icon</key><data>${iconBase64}</data>` : ""}
            <key>IsRemovable</key>
            <true/>
            <key>Label</key>
            <string>CAM ID</string>
            <key>PayloadDescription</key>
            <string>CAM ID Mobile App Shortcut for Enterprise Portal</string>
            <key>PayloadDisplayName</key>
            <string>CAM ID</string>
            <key>PayloadIdentifier</key>
            <string>com.camid.mobile.webclip</string>
            <key>PayloadType</key>
            <string>com.apple.webClip.managed</string>
            <key>PayloadUUID</key>
            <string>98a28e37-9750-482a-a92c-55c68ff8a176</string>
            <key>PayloadVersion</key>
            <integer>1</integer>
            <key>Precomposed</key>
            <true/>
            <key>URL</key>
            <string>${cloudTargetUrl}</string>
        </dict>
    </array>
    <key>PayloadDescription</key>
    <string>CAM ID Mobile App Home Screen Icon</string>
    <key>PayloadDisplayName</key>
    <string>CAM ID Mobile</string>
    <key>PayloadIdentifier</key>
    <string>com.camid.mobile.profile</string>
    <key>PayloadOrganization</key>
    <string>CAM ID</string>
    <key>PayloadRemovalDisallowed</key>
    <false/>
    <key>PayloadType</key>
    <string>Configuration</string>
    <key>PayloadUUID</key>
    <string>5c7e0ea9-7153-4876-928d-2a1d2f7e7162</string>
    <key>PayloadVersion</key>
    <integer>1</integer>
</dict>
</plist>`;

    return new NextResponse(mobileConfigXml, {
      status: 200,
      headers: {
        "Content-Type": "application/x-apple-aspen-config; charset=utf-8",
        "Content-Disposition": 'attachment; filename="CAM_ID.mobileconfig"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to generate profile" }, { status: 500 });
  }
}
