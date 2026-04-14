"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { User } from "@supabase/supabase-js";
import { LogOut, CalendarPlus, ChevronRight, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const router = useRouter();

  // New Event Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  // Fetch the current user session when the dashboard mounts
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        
        // Ensure the user exists in our public.users table to satisfy Foreign Key constraints
        await supabase.from('users').upsert({
          id: session.user.id,
          email: session.user.email,
          display_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User'
        });

        // Load the events they are a participant of
        fetchUserEvents(session.user.id);
      } else {
        // If not logged in, boot them back to the home page
        router.push("/");
      }
    };
    
    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) router.push("/");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // Query Supabase for all events this user is joined in
  const fetchUserEvents = async (userId: string) => {
      const { data, error } = await supabase
        .from('participants')
        .select('event_id, events(*)')
        .eq('user_id', userId);
        
      if (data) {
         // Because we queried a relation, data contains `{ event_id, events: { ...eventData } }`
         const extractedEvents = data.map(p => p.events).filter(Boolean);
         // Sort by created-at manually or just list them (can be improved later)
         setEvents(extractedEvents.reverse());
      }
  };

  // Handle logging out the user
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Handle deleting an event completely
  const handleDeleteEvent = async (e: React.MouseEvent, eventId: string) => {
      e.preventDefault(); // prevent navigation since it's nested in a Link
      e.stopPropagation();

      if (!confirm("Are you sure you want to completely delete this planning session?")) return;

      const { error } = await supabase.from('events').delete().eq('id', eventId);
      
      if (error) {
          alert(`Failed to delete event: ${error.message}`);
      } else {
          setEvents(events.filter(ev => ev.id !== eventId));
      }
  };

  // Function to submit the new event form
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle || !newStart || !newEnd) return;
    
    const { data: evData, error } = await supabase.from('events').insert([{
      host_id: user.id,
      title: newTitle,
      start_date: newStart,
      end_date: newEnd
    }]).select();

    if (error) {
      console.error("Event creation error:", error);
      alert(`Failed to create event. (Ensure you have run the ALTER TABLE SQL for dates!): ${error.message}`);
      return;
    }

    // Automatically join the host as a full_edit participant
    if (evData && evData[0]) {
       const newEventId = evData[0].id;
       await supabase.from('participants').insert([{
           event_id: newEventId,
           user_id: user.id,
           permission_level: "full_edit"
       }]);
       
       setIsModalOpen(false);
       router.push(`/events/${newEventId}`);
    }
  };

  if (!user) return null; // Avoid rendering flash of unauthenticated state

  return (
    <main className="app-container">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "2rem", borderBottom: "1px solid var(--border-subtle)", marginBottom: "2rem" }}>
        
        {/* User Info Header */}
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: "2rem", marginBottom: "0.5rem" }}>Dashboard</h1>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>Welcome back, {user.user_metadata?.full_name || user.email}</p>
        </div>
        
        {/* Utility buttons */}
        <div style={{ display: "flex", gap: "1rem" }}>
          
          <Link 
              href="/dashboard/settings"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--text-main)", padding: "10px 20px", borderRadius: "30px", display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", transition: "all 0.2s" }}
              onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
              Settings
          </Link>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary" 
            style={{ padding: "10px 20px", fontSize: "0.9rem" }}
          >
            New Event <CalendarPlus size={16} />
          </button>
          
          <button 
            onClick={handleSignOut} 
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--text-main)", padding: "10px 20px", borderRadius: "30px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s" }}
            onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
          >
            Sign Out <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Events List */}
      {events.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-12 text-center animate-in shadow-2xl">
            <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <CalendarPlus size={32} className="text-gray-400" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Upcoming Events</h2>
            <p className="max-w-md mx-auto text-gray-400">You have not created or joined any planning sessions yet. Let's get started by creating your first event!</p>
          </div>
      ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory space-x-6 pb-8 pt-4 px-4 -mx-4 hide-scrollbar">
            {events.map((ev, index) => (
                <Link key={ev.id} href={`/events/${ev.id}`} className="block shrink-0 w-[340px] snap-center">
                    <div 
                        className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col gap-6 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:bg-white/10 hover:shadow-2xl hover:border-white/20 delay-${(index % 3) + 1} animate-in relative overflow-hidden group`} 
                    >
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-accent-secondary to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="flex justify-between items-start">
                            <h3 className="m-0 text-white text-xl font-medium tracking-tight line-clamp-1">
                                {ev.title || "Untitled Session"}
                            </h3>
                            <div className="flex items-center gap-2">
                                {ev.host_id === user.id && (
                                    <button 
                                      onClick={(e) => handleDeleteEvent(e, ev.id)}
                                      className="bg-red-500/10 border border-red-500/30 text-red-400 p-2 rounded-lg flex hover:bg-red-500/20 transition-colors"
                                      title="Delete Session"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-auto">
                            <span className="text-sm text-gray-400 uppercase tracking-widest font-semibold flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${ev.status === 'planning' ? 'bg-orange-400' : 'bg-green-400'}`}></span>
                                {ev.status}
                            </span>
                            <div className="bg-white/5 p-2 rounded-full group-hover:bg-accent-secondary/20 transition-colors">
                                <ChevronRight size={18} className="text-accent-secondary" />
                            </div>
                        </div>
                    </div>
                </Link>
            ))}
          </div>
      )}

      {/* New Event Modal Overlay */}
      {isModalOpen && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
              <div className="glass-panel animate-in" style={{ width: "100%", maxWidth: "450px", padding: "2rem", position: "relative" }}>
                  <button 
                      onClick={() => setIsModalOpen(false)} 
                      style={{ position: "absolute", top: "15px", right: "15px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                      <X size={20} />
                  </button>
                  <h2 style={{ marginTop: 0, color: "var(--text-main)", marginBottom: "1.5rem" }}>Create New Event</h2>
                  
                  <form onSubmit={handleCreateEvent} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Event Title</label>
                          <input 
                              type="text" 
                              required 
                              placeholder="e.g. Ski Trip 2026"
                              className="input-glass"
                              value={newTitle}
                              onChange={e => setNewTitle(e.target.value)}
                          />
                      </div>

                      <div style={{ display: "flex", gap: "1rem" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
                              <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Start Date</label>
                              <input 
                                  type="date" 
                                  required 
                                  className="input-glass"
                                  value={newStart}
                                  onChange={e => setNewStart(e.target.value)}
                                  style={{ colorScheme: "dark" }}
                              />
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
                              <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>End Date</label>
                              <input 
                                  type="date" 
                                  required 
                                  className="input-glass"
                                  value={newEnd}
                                  onChange={e => setNewEnd(e.target.value)}
                                  min={newStart}
                                  style={{ colorScheme: "dark" }}
                              />
                          </div>
                      </div>

                      <button type="submit" className="btn-primary" style={{ marginTop: "1rem", justifyContent: "center" }}>
                          Create & Continue
                      </button>
                  </form>
              </div>
          </div>
      )}
    </main>
  );
}
