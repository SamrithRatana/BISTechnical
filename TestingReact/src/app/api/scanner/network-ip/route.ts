import { NextResponse } from "next/server";
import os from "os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const ips: Array<{ name: string; address: string; isWifi: boolean }> = [];

    for (const [name, netList] of Object.entries(interfaces)) {
      if (!netList) continue;
      for (const net of netList) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === "IPv4" && !net.internal) {
          const isWifi = /wi-fi|wlan|wireless|ethernet|eth/i.test(name);
          ips.push({
            name,
            address: net.address,
            isWifi,
          });
        }
      }
    }

    // Sort to prioritize Wi-Fi / Ethernet 192.168.x.x / 10.x.x.x addresses
    ips.sort((a, b) => {
      if (a.address.startsWith("192.168.") && !b.address.startsWith("192.168.")) return -1;
      if (!a.address.startsWith("192.168.") && b.address.startsWith("192.168.")) return 1;
      if (a.isWifi && !b.isWifi) return -1;
      if (!a.isWifi && b.isWifi) return 1;
      return 0;
    });

    const primaryIp = ips.length > 0 ? ips[0].address : "127.0.0.1";

    return NextResponse.json({
      primaryIp,
      interfaces: ips,
    });
  } catch (err: unknown) {
    console.error("Failed to get network IP:", err);
    return NextResponse.json({ primaryIp: "127.0.0.1", interfaces: [] });
  }
}
