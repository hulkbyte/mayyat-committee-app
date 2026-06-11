import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateStaffPayload = {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: "admin" | "editor";
  status?: "active" | "blocked";
};

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase env keys. Add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the app." },
      { status: 500 },
    );
  }

  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Missing admin session." }, { status: 401 });

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const serviceClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "Invalid admin session." }, { status: 401 });

  const { data: adminProfile, error: adminError } = await serviceClient
    .from("users")
    .select("role,status")
    .eq("id", authData.user.id)
    .single();

  if (adminError || adminProfile?.role !== "admin" || adminProfile?.status !== "active") {
    return NextResponse.json({ error: "Only active admin users can create staff users." }, { status: 403 });
  }

  const body = (await request.json()) as CreateStaffPayload;
  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const name = body.name?.trim();
  const role = body.role === "admin" ? "admin" : "editor";
  const status = body.status === "blocked" ? "blocked" : "active";

  if (!name || !email || password.length < 6) {
    return NextResponse.json({ error: "Name, email, and password with at least 6 characters are required." }, { status: 400 });
  }

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  });

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message || "Unable to create auth user." }, { status: 400 });
  }

  const { error: profileError } = await serviceClient.from("users").insert({
    id: created.user.id,
    name,
    email,
    phone: body.phone?.trim() || null,
    role,
    status,
  });

  if (profileError) {
    await serviceClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id });
}
