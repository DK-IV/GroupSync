"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { User } from "@supabase/supabase-js";
import { LogOut, CalendarPlus, ChevronRight, Trash2, X, Edit2, Share } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");

  const openCreateModal = () => {
      setEditingEventId(null);
      setNewTitle("");
      setNewStart("");
      setNewEnd("");
      setNewImageUrl("");
      setIsModalOpen(true);
  };

  const openEditModal = (ev: any) => {
      setEditingEventId(ev.id);
      setNewTitle(ev.title || "");
      setNewStart(ev.start_date || "");
      setNewEnd(ev.end_date || "");
      setNewImageUrl(ev.image_url || "");
      setIsModalOpen(true);
  };

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

  const handleShare = async (e: React.MouseEvent, eventId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const url = `${window.location.origin}/events/${eventId}`;
      try {
          await navigator.clipboard.writeText(url);
          alert("Invite link copied to clipboard!");
      } catch (err) {
          prompt("Copy this link manually: ", url);
      }
  };

  // Function to submit the new event form
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle || !newStart || !newEnd) return;
    
    const payload: any = {
      host_id: user.id,
      title: newTitle,
      start_date: newStart,
      end_date: newEnd
    };
    if (newImageUrl.trim() !== "") {
        payload.image_url = newImageUrl.trim();
    }
    
    const { data: evData, error } = await supabase.from('events').insert([payload]).select();

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

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEventId || !newTitle || !newStart || !newEnd) return;
    
    const payload: any = {
      title: newTitle,
      start_date: newStart,
      end_date: newEnd,
      image_url: newImageUrl.trim() === "" ? null : newImageUrl.trim()
    };
    
    const { error } = await supabase.from('events').update(payload).eq('id', editingEventId);

    if (error) {
      console.error("Event update error:", error);
      alert(`Failed to update event: ${error.message}`);
      return;
    }

    setEvents(events.map(ev => ev.id === editingEventId ? { ...ev, ...payload } : ev));
    setIsModalOpen(false);
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
            onClick={openCreateModal}
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
          <div className="bg-[var(--subtle-gray)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-3xl p-12 text-center animate-in shadow-2xl">
            <div className="bg-[var(--subtle-gray)] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <CalendarPlus size={32} className="text-text-muted" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">No Upcoming Events</h2>
            <p className="max-w-md mx-auto text-text-muted">You have not created or joined any planning sessions yet. Let's get started by creating your first event!</p>
          </div>
      ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory space-x-6 pb-8 pt-4 px-4 -mx-4 hide-scrollbar">
            {events.map((ev, index) => (
                <Link key={ev.id} href={`/events/${ev.id}`} className="block shrink-0 w-[400px] snap-center">
                    <div 
                        className={`bg-[var(--subtle-gray)] border border-[var(--border-subtle)] rounded-[24px] flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:bg-[#1a2333] hover:shadow-2xl hover:border-[rgba(128,128,128,0.2)] delay-${(index % 3) + 1} animate-in relative overflow-hidden group`} 
                    >
                        {/* Upper Image Section */}
                        <div className="w-full h-[180px] relative bg-gradient-to-br from-gray-800 to-gray-900 border-b border-[var(--border-subtle)]">
                            {ev.image_url ? (
                                <img src={ev.image_url} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-white/20">
                                    <CalendarPlus size={48} className="mb-2" />
                                    <span className="text-sm tracking-widest font-bold">EVENT FLYER</span>
                                </div>
                            )}
                        </div>

                        {/* Content Section */}
                        <div className="p-6 flex flex-col">
                            <h3 className="m-0 text-text-main text-xl font-medium tracking-tight line-clamp-1 mb-6">
                                {ev.title || "Untitled Session"}
                            </h3>

                            <div className="flex justify-between items-center mt-auto w-full">
                                {/* Left side Status Badge */}
                                <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${ev.status === 'planned' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}>
                                    {ev.status || 'PLANNING'}
                                </span>
                                
                                {/* Right side Quick Actions */}
                                <div className="flex items-center gap-2">
                                    <button 
                                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditModal(ev); }}
                                      className="bg-transparent border border-[var(--border-subtle)] text-[#a3a3a3] px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
                                    >
                                        <Edit2 size={14} /> Edit
                                    </button>
                                    <button 
                                      onClick={(e) => handleShare(e, ev.id)}
                                      className="bg-transparent border border-[var(--border-subtle)] text-[#a3a3a3] px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-white/5 hover:text-white transition-colors"
                                    >
                                        <Share size={14} /> Share
                                    </button>
                                    {ev.host_id === user.id && (
                                        <button 
                                          onClick={(e) => handleDeleteEvent(e, ev.id)}
                                          className="bg-transparent border border-red-500/30 text-red-400 px-2 py-1.5 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
                                          title="Delete Session"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
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
                  <h2 style={{ marginTop: 0, color: "var(--text-main)", marginBottom: "1.5rem" }}>
                      {editingEventId ? "Edit Event details" : "Create New Event"}
                  </h2>
                  
                  <form onSubmit={editingEventId ? handleUpdateEvent : handleCreateEvent} style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
                      
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

                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "1px" }}>Featured Image URL (Optional)</label>
                          <input 
                              type="text" 
                              placeholder="e.g. https://images.unsplash.com/photo-..."
                              className="input-glass"
                              value={newImageUrl}
                              onChange={e => setNewImageUrl(e.target.value)}
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
                          {editingEventId ? "Save Changes" : "Create & Continue"}
                      </button>
                  </form>
              </div>
          </div>
      )}
    </main>
  );
}
