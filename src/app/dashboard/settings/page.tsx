"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Save, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);
      
      const { data: dbUser } = await supabase.from('users').select('display_name').eq('id', session.user.id).single();
      if (dbUser?.display_name) {
          setDisplayName(dbUser.display_name);
      } else {
          setDisplayName(session.user.user_metadata?.full_name || "");
      }
      setLoading(false);
    };
    
    fetchSession();
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setSaving(true);
      setError("");
      setSuccess(false);

      try {
          // 1. Update global Auth Meta
          const { error: authErr } = await supabase.auth.updateUser({
              data: { full_name: displayName }
          });
          if (authErr) throw authErr;

          // 2. Update Public DB shadow record
          const { error: dbErr } = await supabase.from('users').update({
              display_name: displayName
          }).eq('id', user.id);
          
          if (dbErr) throw dbErr;

          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
      } catch (err: any) {
          setError(err.message || "Failed to update profile");
      } finally {
          setSaving(false);
      }
  };

  if (loading) return null;

  return (
    <main className="app-container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "2rem", borderBottom: "1px solid var(--border-subtle)", marginBottom: "2rem" }}>
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: "2rem", marginBottom: "0.5rem" }}>Account Settings</h1>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Manage your profile identity</p>
        </div>
        <Link href="/dashboard" className="btn-outline" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "var(--text-main)" }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </header>

      <div className="glass-panel animate-in" style={{ padding: "3rem", maxWidth: "500px", margin: "0 auto" }}>
          
          {error && <div style={{ background: "rgba(220, 38, 38, 0.2)", color: "#fca5a5", padding: "12px", borderRadius: "8px", marginBottom: "1.5rem" }}>{error}</div>}
          {success && <div style={{ background: "rgba(34, 197, 94, 0.2)", color: "#86efac", padding: "12px", borderRadius: "8px", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={18} /> Profile updated successfully!</div>}

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Email Address</label>
                  <input type="email" value={user?.email || ""} disabled className="input-glass" style={{ opacity: 0.5, cursor: "not-allowed" }} />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Emails cannot be changed at this time.</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Display Name</label>
                  <input 
                      type="text" 
                      required
                      value={displayName} 
                      onChange={e => setDisplayName(e.target.value)} 
                      className="input-glass" 
                      placeholder="e.g. John Doe"
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>This is how you will appear to others in planning rooms.</span>
              </div>

              <button type="submit" disabled={saving} className="btn-primary" style={{ marginTop: "1rem", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
              </button>
          </form>
      </div>

    </main>
  );
}
