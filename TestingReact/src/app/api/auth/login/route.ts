import { NextRequest, NextResponse } from "next/server";

const JWT_API_BASE = process.env.NEXT_PUBLIC_JWT_API_URL || "https://user.camprotec.com.kh";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userName = body.userName || body.UserName || "";
    const password = body.password || body.Password || "";

    if (!userName || !password) {
      return NextResponse.json(
        { isSuccess: false, message: "Username and password are required." },
        { status: 400 }
      );
    }

    // 1. Forward credentials to C# Identity Auth API (PascalCase JSON payload matching LoginViewModel.cs)
    const apiUrl = `${JWT_API_BASE}/api/auth/login?api-version=1.0`;

    const apiRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        UserName: userName,
        Password: password,
        RememberMe: true,
        userName: userName,
        password: password,
      }),
      cache: "no-store",
    });

    const responseText = await apiRes.text();
    let data: any = null;
    try {
      data = JSON.parse(responseText);
    } catch (e) {}

    // Strict validation: Only log in if the backend API returns success HTTP status AND valid token
    if (apiRes.ok && data && (data.token || data.Token || data.isSuccess || data.IsSuccess)) {
      // 2. Fetch User Details from UserManagement API to populate exact identity, name, and roles
      let userObj = data.user || data.User;

      try {
        const usersRes = await fetch(`${JWT_API_BASE}/api/UserManagement?page=1&pageSize=100&api-version=1.0`, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const userList: any[] = usersData.Data || usersData.items || [];
          const lowerName = userName.toLowerCase();
          const matched = userList.find(
            (u) => (u.UserName || u.userName || "").toLowerCase() === lowerName ||
                   (u.Email || u.email || "").toLowerCase() === lowerName
          );
          if (matched) {
            userObj = {
              id: matched.Id || matched.id,
              userName: matched.UserName || matched.userName || userName,
              email: matched.Email || matched.email || `${userName}@camprotec.com.kh`,
              firstName: matched.FirstName || matched.firstName || "",
              lastName: matched.LastName || matched.lastName || "",
              roles: matched.Roles || matched.roles || ["User"],
              profilePictureUrl: matched.ProfilePictureUrl || matched.profilePictureUrl || null,
            };
          }
        }
      } catch (err) {
        console.warn("Could not fetch user details from UserManagement API:", err);
      }

      if (!userObj) {
        userObj = {
          id: userName,
          userName: userName,
          email: `${userName}@camprotec.com.kh`,
          firstName: userName,
          lastName: "",
          roles: ["User"],
        };
      }

      return NextResponse.json({
        isSuccess: true,
        token: data.token || data.Token,
        refreshToken: data.refreshToken || data.RefreshToken,
        user: userObj,
      });
    }

    // If backend returns failure or invalid credentials message
    const errorMsg = data?.message || data?.Message || "Invalid username or password";
    return NextResponse.json(
      { isSuccess: false, message: errorMsg },
      { status: 401 }
    );
  } catch (error: any) {
    console.error("Auth proxy error:", error);
    return NextResponse.json(
      { isSuccess: false, message: "Authentication service error. Please try again." },
      { status: 500 }
    );
  }
}
