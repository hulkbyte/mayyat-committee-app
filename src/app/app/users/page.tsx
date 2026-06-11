"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Save } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { createClient } from "@/lib/supabase/client";
import type { StaffUser } from "@/lib/types";

export default function UsersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data, error: loadError } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else setUsers((data || []) as StaffUser[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const id = String(fd.get("id"));
    const { error: updateError } = await supabase
      .from("users")
      .update({
        name: String(fd.get("name") || "").trim(),
        phone: String(fd.get("phone") || "").trim() || null,
        role: String(fd.get("role")),
        status: String(fd.get("status")),
      })
      .eq("id", id);
    if (updateError) setError(updateError.message);
    else {
      setMessage("User profile updated.");
      load();
    }
  }

  async function createStaffUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const fd = new FormData(event.currentTarget);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setError("Admin session expired. Please login again.");
      return;
    }

    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: String(fd.get("name") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        password: String(fd.get("password") || ""),
        phone: String(fd.get("phone") || "").trim(),
        role: String(fd.get("role") || "editor"),
        status: String(fd.get("status") || "active"),
      }),
    });

    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error || "Unable to create staff user.");
      return;
    }

    event.currentTarget.reset();
    setMessage("Staff user created. They can now login with the email/password you entered.");
    load();
  }

  return (
    <section className="grid">
      <div className="page-title">
        <h1>Admin / Editor Users</h1>
        <p>Admin can create editor/admin logins and manage staff profiles.</p>
      </div>
      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <form className="card" onSubmit={createStaffUser}>
        <h2>Add staff user</h2>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input className="input" name="name" required />
          </label>
          <label className="field">
            <span>Email</span>
            <input className="input" name="email" required type="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input className="input" minLength={6} name="password" required type="password" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input className="input" name="phone" />
          </label>
          <label className="field">
            <span>Role</span>
            <select className="select" name="role" defaultValue="editor">
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select className="select" name="status" defaultValue="active">
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
        </div>
        <p className="notice">This creates the Supabase login and app profile together. Password must be at least 6 characters.</p>
        <button className="button" type="submit">
          <Plus size={18} /> Add staff user
        </button>
      </form>
      <div className="grid">
        {users.map((user) => (
          <form className="card" key={user.id} onSubmit={saveProfile}>
            <input name="id" type="hidden" value={user.id} />
            <div className="form-grid">
              <label className="field">
                <span>Name</span>
                <input className="input" name="name" defaultValue={user.name} required />
              </label>
              <label className="field">
                <span>Email</span>
                <input className="input" value={user.email} disabled />
              </label>
              <label className="field">
                <span>Phone</span>
                <input className="input" name="phone" defaultValue={user.phone || ""} />
              </label>
              <label className="field">
                <span>Role</span>
                <select className="select" name="role" defaultValue={user.role}>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select className="select" name="status" defaultValue={user.status}>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>
              <div className="detail-item">
                <div className="detail-label">Current</div>
                <div className="detail-value">
                  <StatusBadge value={user.status} /> {user.role}
                </div>
              </div>
            </div>
            <button className="button" type="submit">
              <Save size={18} /> Save user
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
