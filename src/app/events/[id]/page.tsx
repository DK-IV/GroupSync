"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import BrainstormModule from "@/components/BrainstormModule";
import CommunalCalendar from "@/components/CommunalCalendar";
import AgendaModule from "@/components/AgendaModule";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Edit2, Check, Copy, UserPlus } from "lucide-react";

export default function EventPlanningRoom() {
  const params = useParams();
  const eventId = params.id as string;
  const router = useRouter();
  
  const [user, setUser] = useState<User | null>(null);
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [participant, setParticipant] = useState<any>(null);
  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [copied, setCopied] = useState(false);

  // Guest flow state
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    const initRoom = async () => {
      // 1. Fetch Event Details first directly to see if room exists
      const { data: ev, error: evError } = await supabase.from("events").select("*").eq("id", eventId).single();
      if (ev) {
          setEventDetails(ev);
          setEditedTitle(ev.title);
      } else {
          console.error("Failed to load event:", evError);
          return;
      }

      // 2. Auth Check
      const { data: { session } } = await supabase.auth.getSession();
      
      let currentPart = null;

      if (session) {
          setUser(session.user);
          // Fetch existing authed participant
          const { data: part } = await supabase.from("participants").select("*").eq("event_id", eventId).eq("user_id", session.user.id).single();
          currentPart = part;

          // Auto-join if no participant record exists yet
          if (!currentPart) {
              const { data: newPart } = await supabase.from("participants").insert([{
                  event_id: eventId,
                  user_id: session.user.id
              }]).select().single();
              currentPart = newPart;
          }
      } else {
          // Unauthenticated Guest Flow
          setShowGuestPrompt(true);
          return;
      }
      
      setParticipant(currentPart);
    };

    initRoom();
  }, [eventId]);

  const handleGuestJoin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!guestNameInput.trim()) return;
      setGuestLoading(true);

      // Sign in anonymously
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      
      if (authError) {
          alert(`Failed to authenticate as guest: ${authError.message}`);
          setGuestLoading(false);
          return;
      }

      const newUserId = authData.user.id;

      // Update auth user metadata
      await supabase.auth.updateUser({
          data: { full_name: guestNameInput.trim() }
      });

      // Upsert into public.users to satisfy foreign keys
      await supabase.from("users").upsert({
          id: newUserId,
          email: `anon_${newUserId}@groupsync.local`, // Dummy email for unique constraint
          display_name: guestNameInput.trim()
      });

      // Create participant row
      const { data: newGuestPart, error: partError } = await supabase.from("participants").insert([{
          event_id: eventId,
          user_id: newUserId,
          permission_level: "full_edit"
      }]).select().single();

      if (newGuestPart) {
          setUser(authData.user);
          setParticipant(newGuestPart);
          setShowGuestPrompt(false);
      } else {
          alert(`Failed to join: ${partError?.message}`);
      }
      setGuestLoading(false);
  };

  // Saves the edited title back to Supabase
  const handleTitleUpdate = async () => {
      if (!editedTitle.trim()) return;
      setIsEditingTitle(false);
      
      const { error } = await supabase.from("events")
        .update({ title: editedTitle })
        .eq("id", eventId);
        
      if (!error) {
          setEventDetails({ ...eventDetails, title: editedTitle });
      }
  };

  if (!eventDetails) return <div style={{ padding: "2rem", color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>Loading planning room...</div>;

  if (!participant) {
    if (showGuestPrompt) {
      return (
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <div className="glass-panel animate-in" style={{ padding: "3rem", maxWidth: "400px", width: "100%", textAlign: "center" }}>
                <h2 className="text-gradient" style={{ margin: "0 0 1rem 0", fontSize: "2rem" }}>Join as Guest</h2>
                <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>You've been invited to collaborate! Please enter your name so others recognize you.</p>
                <form onSubmit={handleGuestJoin} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <input 
                        type="text" 
                        required 
                        placeholder="e.g. Sarah J."
                        className="input-glass"
                        value={guestNameInput}
                        onChange={e => setGuestNameInput(e.target.value)}
                        style={{ textAlign: "center", fontSize: "1.2rem" }}
                    />
                    <button type="submit" disabled={guestLoading} className="btn-primary" style={{ justifyContent: "center", marginTop: "1rem", padding: "12px" }}>
                        {guestLoading ? "Joining..." : "Join Event"}
                    </button>
                    <button type="button" onClick={() => router.push("/login")} style={{ background: "transparent", border: "none", color: "var(--accent-secondary)", cursor: "pointer", textDecoration: "underline", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                        Or Log In to your account
                    </button>
                </form>
            </div>
        </div>
      );
    } else {
      return <div style={{ padding: "2rem", color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>Loading planning room...</div>;
    }
  }

  const isHost = eventDetails.host_id === user?.id;

  return (
    <>
    <main className="app-container">
      <header style={{ marginBottom: "3rem", display: "flex", gap: "1.5rem", alignItems: "center" }}>
          
          <button 
            onClick={() => router.push('/dashboard')}
            style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: "white", padding: "10px", borderRadius: "12px", cursor: "pointer", transition: "all 0.2s" }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
          >
              <ArrowLeft size={20} />
          </button>
          
          <div style={{ flex: 1 }}>
            {/* Inline Title Editor logic */}
            {isEditingTitle ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", animation: "slideUpFade 0.2s" }}>
                  <input 
                    type="text" 
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="input-glass"
                    style={{ fontSize: "1.5rem", fontWeight: "bold", padding: "8px 16px", margin: 0, width: "100%", maxWidth: "400px" }}
                    autoFocus
                    onKeyDown={(e) => {
                       if(e.key === 'Enter') handleTitleUpdate();
                       if(e.key === 'Escape') setIsEditingTitle(false);
                    }}
                  />
                  <button onClick={handleTitleUpdate} style={{ background: "var(--accent-secondary)", border: "none", color: "white", padding: "12px", borderRadius: "12px", cursor: "pointer" }}>
                      <Check size={20} />
                  </button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                 <h1 className="text-gradient" style={{ margin: 0, fontSize: "2.2rem", display: "flex", alignItems: "center" }}>
                     {eventDetails.title}
                 </h1>
                 {isHost && (
                     <button 
                        onClick={() => setIsEditingTitle(true)} 
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "8px", borderRadius: "8px", transition: "all 0.2s" }} 
                        title="Edit Session Name"
                        onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                        onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                     >
                        <Edit2 size={18} />
                     </button>
                 )}
                 {user && user.is_anonymous && (
                     <button 
                        onClick={() => router.push('/login')} 
                        style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--text-main)", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", marginLeft: "auto", transition: "all 0.2s" }}
                        onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                        onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                     >
                        <UserPlus size={16} /> Claim Account
                     </button>
                 )}
                 <button 
                    onClick={async () => {
                       try {
                           await navigator.clipboard.writeText(window.location.href);
                           setCopied(true);
                           setTimeout(() => setCopied(false), 2000);
                       } catch (err) {
                           console.error("Failed to copy: ", err);
                           prompt("Copy the link manually:", window.location.href);
                       }
                    }} 
                    style={{ background: copied ? "var(--success)" : "var(--accent-secondary)", border: "none", color: "white", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem", fontWeight: "bold", marginLeft: user?.is_anonymous ? "0" : "auto", transition: "all 0.2s" }}
                    title="Copy Invite Link"
                 >
                    {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied!" : "Share"}
                 </button>
              </div>
            )}
            <p style={{ margin: "5px 0 0 0", color: "var(--text-muted)", fontSize: "0.95rem" }}>Event Planning Room</p>
          </div>

      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: "4rem" }}>
         {/* Module A: Communal Calendar */}
         <CommunalCalendar 
            eventId={eventId} 
            participantId={participant.id} 
            startDate={eventDetails.start_date}
            endDate={eventDetails.end_date}
         />

         <hr style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "none", margin: 0 }} />

         {/* Module B: Brainstorming Hub */}
         <BrainstormModule eventId={eventId} participantId={participant.id} />

         <hr style={{ borderTop: "1px solid var(--border-subtle)", borderBottom: "none", margin: 0 }} />

         {/* Module C: Agenda Timeline Builder */}
         <AgendaModule eventId={eventId} />
      </div>
      
    </main>
    </>
  );
}
