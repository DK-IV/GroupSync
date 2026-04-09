"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { Link2, Plus, Sparkles, AlertCircle, MessageSquare, Edit2, Check } from "lucide-react";

export default function BrainstormModule({ eventId, participantId }: { eventId: string, participantId: string }) {
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [winnerStr, setWinnerStr] = useState<string | null>(null);
  const [hasTallied, setHasTallied] = useState(false);

  // Fetch existing brainstorm ideas on load & listen to realtime updates
  useEffect(() => {
    fetchIdeas();

    const channel = supabase.channel('brainstorm-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'brainstorm_ideas', filter: `event_id=eq.${eventId}` }, () => {
            fetchIdeas();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'idea_votes', filter: `event_id=eq.${eventId}` }, () => {
            fetchIdeas();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [eventId]);

  const fetchIdeas = async () => {
    const { data } = await supabase
      .from("brainstorm_ideas")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    
    if (data) setIdeas(data);

    // Also fetch votes for the IRV engine
    try {
        const { data: vData } = await supabase.from("idea_votes").select("*").eq("event_id", eventId);
        if (vData) setVotes(vData);
    } catch(err) { console.log('Waiting for idea_votes table creation', err); }
  };

  const handleIdeaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setIsSubmitting(true);
    setError("");

    try {
      const isURL = /^(https?:\/\/)/i.test(inputValue.trim());

      if (isURL) {
          // 1. Fetch metadata via our secure backend route
          const res = await fetch(`/api/unfurl?url=${encodeURIComponent(inputValue.trim())}`);
          const meta = await res.json();

          if (!res.ok) throw new Error(meta.error || "Failed to unfurl URL");

          // 2. Save the metadata as an idea in Supabase
          const { error: dbError } = await supabase.from("brainstorm_ideas").insert([{
            event_id: eventId,
            participant_id: participantId,
            url: meta.url || inputValue.trim(),
            title: meta.title || "Untitled Link",
            description: meta.description,
            image_url: meta.image_url,
            provider_name: meta.provider_name
          }]);

          if (dbError) throw dbError;
      } else {
          // It's just text
          const { error: dbError } = await supabase.from("brainstorm_ideas").insert([{
            event_id: eventId,
            participant_id: participantId,
            url: "", 
            title: inputValue.trim(),
            description: "Text Idea",
            provider_name: "Member Suggestion"
          }]);
          
          if (dbError) throw dbError;
      }

      setInputValue("");
      fetchIdeas(); // Refresh the board
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      
      {/* The URL Submitter Section */}
      <div className="glass-panel animate-in" style={{ padding: "2rem" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "1rem" }}>
          Brainstorm Hub <Sparkles size={20} color="var(--accent-primary)" />
        </h2>
        <p>Paste TikToks, YouTube videos, or Instagram posts below to drop them onto the group board.</p>
        
        <form onSubmit={handleIdeaSubmit} style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <div style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
              <MessageSquare size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Drop a link or type an idea..." 
              required
              className="input-glass"
              style={{ paddingLeft: "44px" }}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Adding..." : "Drop Idea"} <Plus size={18} />
          </button>
        </form>
        {error && <p style={{ color: "#fca5a5", marginTop: "1rem", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem" }}><AlertCircle size={16} /> {error}</p>}
      </div>

      {/* Tally Runoff Voting */}
      {ideas.length > 0 && (
          <div className="glass-panel animate-in" style={{ padding: "1.5rem", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                 <h3 style={{ margin: "0 0 5px 0", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "8px" }}>Find best ideas <Check size={18} color="var(--accent-secondary)" /></h3>
                 <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>Rank ideas 1, 2, 3... then calculate the winner!</p>
              </div>
              <button 
                  className="btn-primary" 
                  onClick={() => {
                      // 1. Group votes by User->Ballot[]
                      const ballots: Record<string, string[]> = {};
                      votes.forEach(v => {
                          if (!ballots[v.participant_id]) ballots[v.participant_id] = [];
                      });
                      
                      const organizedVoters = Object.keys(ballots);
                      if (organizedVoters.length === 0) {
                          setWinnerStr("No votes cast yet!"); return;
                      }

                      // Fill ballots in rank order
                      organizedVoters.forEach(vid => {
                          const userVotes = votes.filter(v => v.participant_id === vid).sort((a,b) => a.rank_value - b.rank_value);
                          ballots[vid] = userVotes.map(v => v.idea_id);
                      });

                      // 2. IRV Simulation Loop
                      let activeIdeas = [...new Set(votes.map(v => v.idea_id))];
                      let winnerId = null;
                      let eliminatedOrder: string[] = [];

                      while (activeIdeas.length > 0 && !winnerId) {
                          let roundTallies: Record<string, number> = {};
                          activeIdeas.forEach(id => roundTallies[id] = 0);
                          let totalValidBallots = 0;

                          // Count top choices
                          Object.values(ballots).forEach(ballot => {
                              const topChoice = ballot.find(id => activeIdeas.includes(id));
                              if (topChoice) {
                                  roundTallies[topChoice]++;
                                  totalValidBallots++;
                              }
                          });

                          if (totalValidBallots === 0) break;

                          // Check majority
                          let maxVotes = -1;
                          let minVotes = Infinity;
                          let currentLeader: string | null = null;
                          let currentLoser: string | null = null;

                          Object.entries(roundTallies).forEach(([id, voteCount]) => {
                              if (voteCount > maxVotes) { maxVotes = voteCount; currentLeader = id; }
                              if (voteCount <= minVotes) { minVotes = voteCount; currentLoser = id; }
                          });

                          if (currentLeader && maxVotes > totalValidBallots / 2) {
                              winnerId = currentLeader;
                              break;
                          } else if (currentLoser) {
                              // Knockout loser
                              eliminatedOrder.push(currentLoser);
                              activeIdeas = activeIdeas.filter(id => id !== currentLoser);
                          } else {
                              break; // Tie breaker fail safe
                          }
                      }

                      // Reconstruct the final Top-To-Bottom order
                      let finalRankingList = [];
                      if (winnerId) finalRankingList.push(winnerId);
                      
                      // Now add eliminated items in reverse order (best losers first)
                      for (let i = eliminatedOrder.length - 1; i >= 0; i--) {
                          if (eliminatedOrder[i] !== winnerId) finalRankingList.push(eliminatedOrder[i]);
                      }

                      // Any idea that never surfaced in votes goes to the bottom
                      ideas.forEach(idea => {
                           if (!finalRankingList.includes(idea.id)) {
                               finalRankingList.push(idea.id);
                           }
                      });

                      // Reorder the `ideas` state globally so the board physically reshuffles!
                      const reorderedIdeas = [...ideas].sort((a,b) => {
                          return finalRankingList.indexOf(a.id) - finalRankingList.indexOf(b.id);
                      });

                      setIdeas(reorderedIdeas);
                      setHasTallied(true);
                      
                      if (winnerId) {
                          const wIdea = ideas.find(i => i.id === winnerId);
                          setWinnerStr(`Results are in! Board reordered. Winner: ${wIdea?.title || "Unknown"} 🎉`);
                      } else {
                          setWinnerStr("Simulation finished. Board reordered based on preference weight (Tie broken).");
                      }
                  }}
              >
                  Tally Votes
              </button>
          </div>
      )}

      {winnerStr && (
          <div style={{ background: "rgba(251, 191, 36, 0.15)", border: "1px solid #fbbf24", padding: "16px", borderRadius: "12px", color: "#fbbf24", fontSize: "1.2rem", fontWeight: "bold", textAlign: "center", animation: "slideUpFade 0.3s" }}>
              {winnerStr}
          </div>
      )}

      {/* The Dynamic Ideas Board */}
      {ideas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
            {ideas.map((idea, idx) => (
              <IdeaCard 
                key={idea.id} 
                idea={idea} 
                idx={idx} 
                participantId={participantId} 
                eventId={eventId} 
                currentRank={votes.find(v => v.idea_id === idea.id && v.participant_id === participantId)?.rank_value}
                maxRank={ideas.length}
                occupiedRanks={votes.filter(v => v.participant_id === participantId).map(v => v.rank_value)}
                isTallied={hasTallied}
              />
            ))}
          </div>
      )}
    </div>
  );
}

// Sub-component: A visually rich card representing a single unfurled link
function IdeaCard({ idea, idx, participantId, eventId, currentRank, maxRank, occupiedRanks, isTallied }: { idea: any, idx: number, participantId: string, eventId: string, currentRank?: number, maxRank: number, occupiedRanks: number[], isTallied?: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDesc, setEditDesc] = useState(idea.description || "");
  const [isSyncingRank, setIsSyncingRank] = useState(false);

  const canEdit = idea.participant_id === participantId;

  const handleRankChange = async (newRank: number) => {
      if (!participantId) return;
      setIsSyncingRank(true);
      if (newRank === 0) {
          await supabase.from('idea_votes').delete().eq('idea_id', idea.id).eq('participant_id', participantId);
      } else {
          await supabase.from('idea_votes').upsert({
              event_id: eventId,
              idea_id: idea.id,
              participant_id: participantId,
              rank_value: newRank
          }, { onConflict: 'idea_id, participant_id' });
      }
      setIsSyncingRank(false);
  };

  const handleSave = async () => {
    if (editDesc === idea.description) {
        setIsEditing(false);
        return;
    }
    const { error } = await supabase.from('brainstorm_ideas').update({ description: editDesc }).eq('id', idea.id);
    if (!error) {
       idea.description = editDesc; // Local optimistic update
       setIsEditing(false);
    } else {
       alert("Failed to save description");
    }
  };

  return (
    <div className={`glass-panel delay-${(idx % 3) + 1} animate-in`} style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: "0", position: "relative" }}>
      
      {/* Tally Badge Overlay */}
      {isTallied && (
          <div style={{ 
              position: "absolute", top: "10px", left: "10px", zIndex: 10, 
              background: idx === 0 ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)" : idx === 1 ? "linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)" : idx === 2 ? "linear-gradient(135deg, #fcd34d 0%, #b45309 100%)" : "rgba(0,0,0,0.6)", 
              color: idx < 3 ? "#000" : "#fff", 
              padding: "6px 12px", borderRadius: "12px", fontWeight: "bold", fontSize: "0.9rem", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", border: idx < 3 ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)"
          }}>
              {idx === 0 ? "🏆 1st Place" : idx === 1 ? "🥈 2nd Place" : idx === 2 ? "🥉 3rd Place" : `#${idx + 1} Place`}
          </div>
      )}

      {/* Unfurled Media Image Header */}
      {idea.image_url ? (
        <img 
          src={idea.image_url} 
          alt={idea.title} 
          style={{ width: "100%", height: "180px", objectFit: "cover", borderBottom: "1px solid var(--border-subtle)" }} 
        />
      ) : (
        <div style={{ height: "180px", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
          No Preview Map
        </div>
      )}
      
      {/* Meta Content Section */}
      <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
           <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {idea.provider_name && (
              <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent-secondary)", fontWeight: 600 }}>
                {idea.provider_name}
              </span>
            )}
           </div>
           <div style={{ display: "flex", gap: "8px" }}>
               <button 
                   onClick={async () => {
                       const { error } = await supabase.from('agenda_items').insert([{
                           event_id: eventId,
                           idea_id: idea.id,
                           duration_mins: 60,
                           order_index: 99 // It will just go to bottom
                       }]);
                       if (error) alert("Failed to add to agenda: " + error.message);
                       else alert("Added to Agenda!");
                   }}
                   style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: "var(--accent-secondary)", cursor: "pointer", padding: "4px 8px", borderRadius: "16px", transition: "0.2s", fontSize: "0.75rem", fontWeight: "bold" }}
                   onMouseOver={(e) => e.currentTarget.style.background = "rgba(45, 212, 191, 0.1)"}
                   onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                   title="Add to Agenda"
               >
                   + Agenda
               </button>
               
               {canEdit && !isEditing && (
                  <button 
                      onClick={() => { setEditDesc(idea.description || ""); setIsEditing(true); }} 
                      style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "4px", transition: "0.2s" }}
                      onMouseOver={(e) => e.currentTarget.style.color = "white"}
                      onMouseOut={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                      title="Edit Description"
                  >
                      <Edit2 size={16} />
                  </button>
               )}
           </div>
        </div>

        <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "var(--text-main)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {idea.url ? (
               <a href={idea.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{idea.title}</a>
            ) : (
               <span>{idea.title}</span>
            )}
        </h3>
        
        {isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem", animation: "slideUpFade 0.2s" }}>
                <textarea 
                   className="input-glass" 
                   value={editDesc} 
                   onChange={(e) => setEditDesc(e.target.value)} 
                   style={{ fontSize: "0.9rem", minHeight: "80px", resize: "vertical", padding: "10px", margin: 0, width: "100%" }}
                   placeholder="Add a description or notes..."
                   autoFocus
                   onKeyDown={(e) => {
                       if (e.key === 'Escape') setIsEditing(false);
                   }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    <button onClick={() => setIsEditing(false)} style={{ background: "transparent", border: "1px solid var(--border-subtle)", color: "white", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem" }}>Cancel</button>
                    <button onClick={handleSave} style={{ background: "var(--accent-secondary)", border: "none", color: "white", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.85rem" }}><Check size={14} /> Save</button>
                </div>
            </div>
        ) : (
            <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", margin: 0 }}>
              {idea.description || <span style={{ opacity: 0.5, fontStyle: "italic" }}>No description yet...</span>}
            </p>
        )}
      </div>

       {/* Voting Interface Component */}
      <VotingControls ideaId={idea.id} participantId={participantId} eventId={eventId} currentRank={currentRank} maxRank={maxRank} occupiedRanks={occupiedRanks} />
    </div>
  )
}

function VotingControls({ ideaId, participantId, eventId, currentRank, maxRank, occupiedRanks }: { ideaId: string, participantId: string, eventId: string, currentRank?: number, maxRank: number, occupiedRanks: number[] }) {
  const [isSyncing, setIsSyncing] = useState(false);

  // This function casts the preferential vote to Supabase
  const handleVote = async (rank: number) => {
      setIsSyncing(true);
      if (currentRank === rank) {
          // Toggle off
          const { error } = await supabase.from("idea_votes").delete().eq('idea_id', ideaId).eq('participant_id', participantId);
          if (error) alert("Error un-ranking: " + error.message);
      } else {
          // Upsert new rank
          const { error } = await supabase.from("idea_votes").upsert({
              idea_id: ideaId,
              participant_id: participantId,
              event_id: eventId,
              rank_value: rank
          }, { onConflict: 'idea_id, participant_id' });
          if (error) alert("Error casting vote: " + error.message);
      }
      setIsSyncing(false);
  };

  return (
     <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--border-subtle)", background: "rgba(0,0,0,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>Rank Choice:</span>
        <select
            disabled={isSyncing}
            value={currentRank || 0}
            onChange={(e) => handleVote(Number(e.target.value))}
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid var(--border-subtle)", color: "white", padding: "6px 10px", borderRadius: "8px", fontSize: "0.85rem", outline: "none", cursor: "pointer", fontWeight: "bold" }}
        >
            <option value={0} style={{ color: "black", fontWeight: "normal" }}>-- Blank --</option>
            {Array.from({ length: maxRank }, (_, i) => i + 1).map(n => {
                const inUse = n !== currentRank && occupiedRanks.includes(n);
                return (
                    <option 
                        key={n} 
                        value={n} 
                        style={{ color: "black" }} 
                        disabled={inUse}
                    >
                        {inUse ? `Rank ${n} (In Use)` : `#${n} Choice`}
                    </option>
                );
            })}
        </select>
     </div>
  );
}
