"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase";
import BrainstormModule from "@/components/BrainstormModule";
import CommunalCalendar from "@/components/CommunalCalendar";
import AgendaModule from "@/components/AgendaModule";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Edit2, Check } from "lucide-react";

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
          const localGuestId = localStorage.getItem(`guest_auth_${eventId}`);
          if (localGuestId) {
             const { data: guestPart } = await supabase.from("participants").select("*").eq("id", localGuestId).single();
             if (guestPart) {
                 currentPart = guestPart;
             } else {
                 setShowGuestPrompt(true);
                 return;
             }
          } else {
             setShowGuestPrompt(true);
             return;
          }
      }
      
      setParticipant(currentPart);
    };

    initRoom();
  }, [eventId]);

  const handleGuestJoin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!guestNameInput.trim()) return;
      setGuestLoading(true);

      const { data: newGuestPart, error } = await supabase.from("participants").insert([{
          event_id: eventId,
          guest_name: guestNameInput.trim()
      }]).select().single();

      if (newGuestPart) {
          localStorage.setItem(`guest_auth_${eventId}`, newGuestPart.id);
          setParticipant(newGuestPart);
          setShowGuestPrompt(false);
      } else {
          alert(`Failed to join: ${error?.message}`);
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

  if (!eventDetails || !participant) return <div style={{ padding: "2rem", color: "var(--text-muted)", display: "flex", justifyContent: "center" }}>Loading planning room...</div>;

  const isHost = eventDetails.host_id === user?.id;

  return (
    <>
    {showGuestPrompt && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
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
                        {guestLoading ? "Entering Room..." : "Enter Room"}
                    </button>
                    <button type="button" onClick={() => router.push("/login")} style={{ background: "transparent", border: "none", color: "var(--accent-secondary)", cursor: "pointer", textDecoration: "underline", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                        Or Log In to your account
                    </button>
                </form>
            </div>
        </div>
    )}
    
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
