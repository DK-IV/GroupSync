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

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const opts = { redirectTo: `${window.location.origin}/dashboard` };

      if (isAnonymous) {
          const { error } = await supabase.auth.linkIdentity({
              provider: 'google',
              options: opts
          });
          
          if (error) {
              // If linking fails (e.g., identity already exists), fallback to normal sign in
              console.warn("Link failed, falling back to sign-in", error);
              await supabase.auth.signInWithOAuth({ provider: 'google', options: opts });
          }
      } else {
          const { error } = await supabase.auth.signInWithOAuth({
              provider: 'google',
              options: opts
          });
          if (error) throw error;
      }
      
    } catch (err: any) {
      setError(err.message || "Failed to authenticate with Google.");
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

        <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0", color: "var(--text-muted)" }}>
            <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }}></div>
            <span style={{ padding: "0 10px", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1px" }}>Or Auth With</span>
            <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }}></div>
        </div>

        <button 
           onClick={handleGoogleAuth}
           disabled={loading}
           style={{ width: "100%", padding: "12px", background: "white", color: "#333", border: "1px solid #ccc", borderRadius: "30px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontWeight: "bold", fontSize: "0.95rem", transition: "all 0.2s" }}
           onMouseOver={(e) => e.currentTarget.style.background = "#f4f4f4"}
           onMouseOut={(e) => e.currentTarget.style.background = "white"}
        >
           <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
           </svg>
           {isAnonymous ? "Link Google Account" : "Sign in with Google"}
        </button>



        <p style={{ marginTop: "2rem", fontSize: "0.85rem", opacity: 0.7 }}>
          By signing in, you agree to our Terms of Service.
        </p>
      </div>
    </main>
  );
}
