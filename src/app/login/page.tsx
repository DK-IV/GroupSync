"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.is_anonymous) {
        setIsAnonymous(true);
      }
    });
  }, []);



  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      
      let resError;
      let sessionData = null;

      if (isAnonymous) {
          // Upgrade the anonymous user to a permanent account
          const { error } = await supabase.auth.updateUser({
            email,
            password,
          });
          resError = error;
          sessionData = true; // They are already logged in
      } else {
          // Normal sign-up flow
          const { error, data } = await supabase.auth.signUp({
            email,
            password,
          });
          resError = error;
          sessionData = data?.session;
      }

      if (resError) throw resError;
      
      // If auto-confirm is off in Supabase, data.session will be null for fresh sign-ups
      if (sessionData) {
          router.push("/dashboard");
      } else {
          setSuccessMsg("Check your email for the confirmation link!");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccessMsg(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.push("/dashboard");
      
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <div className="glass-panel animate-in" style={{ padding: "3rem", maxWidth: "400px", width: "100%", textAlign: "center" }}>
        
        <h1 className="text-gradient" style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>Welcome</h1>
        <p style={{ marginBottom: "2rem" }}>Sign in or create an account to manage GroupSync events.</p>
        
        {error && (
          <div style={{ background: "rgba(220, 38, 38, 0.2)", color: "#fca5a5", padding: "10px", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ background: "rgba(34, 197, 94, 0.2)", color: "#86efac", padding: "10px", borderRadius: "8px", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
            {successMsg}
          </div>
        )}

        <form style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-glass"
            required
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-glass"
            required
          />
          
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
             <button 
                onClick={handleEmailSignIn}
                className="btn-primary" 
                disabled={loading || !email || !password}
                style={{ flex: 1, justifyContent: "center", padding: "10px" }}
                type="button"
              >
                {loading ? "..." : ( <><LogIn size={16} /> Sign In</> )}
              </button>

              <button 
                onClick={handleEmailSignUp}
                disabled={loading || !email || !password}
                style={{ flex: 1, justifyContent: "center", padding: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", borderRadius: "30px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s" }}
                type="button"
                onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
              >
                {loading ? "..." : ( <><UserPlus size={16} /> Sign Up</> )}
              </button>
          </div>
        </form>



        <p style={{ marginTop: "2rem", fontSize: "0.85rem", opacity: 0.7 }}>
          By signing in, you agree to our Terms of Service.
        </p>
      </div>
    </main>
  );
}
