import { Calendar, Users, Zap, Link as LinkIcon } from "lucide-react";
import Link from "next/link"; // Next.js built-in routing link

// Home page component: the main entry point to GroupSync
export default function Home() {
  return (
    <main className="app-container">
      <header style={{ textAlign: "center", padding: "6rem 0 4rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <h1 className="text-gradient animate-in">GroupSync</h1>
        <p className="animate-in delay-1" style={{ fontSize: "1.25rem", maxWidth: "600px", margin: "0 auto 3rem", color: "var(--text-muted)" }}>
          Effortlessly coordinate your group events. Combine availability, brainstorm ideas, 
          and auto-build the perfect agenda in one stunning workspace.
        </p>
        <div className="animate-in delay-2">
          {/* Navigate the user to the login screen instead of doing nothing */}
          <Link href="/login" className="btn-primary" style={{ textDecoration: "none" }}>
            Create New Event <Zap size={18} />
          </Link>
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "2rem", marginTop: "2rem" }}>
        
        <div className="glass-panel animate-in delay-1" style={{ padding: "2.5rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div style={{ background: "rgba(236,72,153, 0.15)", width: "56px", height: "56px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-primary)", border: "1px solid rgba(236,72,153, 0.3)" }}>
            <Calendar size={28} />
          </div>
          <h2>Communal Calendar</h2>
          <p>Sync your Google Calendar to discover the perfect overlapping time blocks. Visually locate the "Green" zones and say goodbye to endless group chats.</p>
        </div>

        <div className="glass-panel animate-in delay-2" style={{ padding: "2.5rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
           <div style={{ background: "rgba(139,92,246, 0.15)", width: "56px", height: "56px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-secondary)", border: "1px solid rgba(139,92,246, 0.3)" }}>
            {/* Using the renamed Lucide icon to avoid colliding with next/link */}
            <LinkIcon size={28} />
          </div>
          <h2>Idea Brainstorming</h2>
          <p>Drop TikTok, Instagram, and YouTube links. Watch them instantly unfurl and let everyone rank their favorites with preferential voting.</p>
        </div>

        <div className="glass-panel animate-in delay-3" style={{ padding: "2.5rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
           <div style={{ background: "rgba(59,130,246, 0.15)", width: "56px", height: "56px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-tertiary)", border: "1px solid rgba(59,130,246, 0.3)" }}>
            <Users size={28} />
          </div>
          <h2>Smart Agendas</h2>
          <p>Auto-generate a proposed timeline using the highest-ranked ideas and your group's free time. Refine it using the drag-and-drop builder.</p>
        </div>

      </section>
    </main>
  );
}
