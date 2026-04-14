import { Calendar, Users, Zap, Link as LinkIcon } from "lucide-react";
import Link from "next/link"; // Next.js built-in routing link

// Home page component: the main entry point to GroupSync
export default function Home() {
  return (
    <main className="max-w-[1200px] mx-auto p-8">
      <header className="text-center py-24 flex flex-col items-center">
        <h1 className="text-transparent bg-clip-text bg-gradient-to-br from-accent-primary via-accent-secondary to-accent-tertiary text-6xl font-extrabold tracking-tight mb-8 pb-2 animate-in">GroupSync</h1>
        <p className="animate-in delay-100 text-xl max-w-[600px] mx-auto mb-12 text-gray-400">
          Effortlessly coordinate your group events. Combine availability, brainstorm ideas, 
          and auto-build the perfect agenda in one stunning workspace.
        </p>
        <div className="animate-in delay-200">
          <Link href="/login" className="bg-gradient-to-br from-accent-primary to-accent-secondary text-white border-none py-4 px-8 rounded-full text-lg font-semibold cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(236,72,153,0.4)] relative overflow-hidden inline-flex items-center gap-2">
            Create New Event <Zap size={18} />
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
        
        <div className="bg-surface-bg backdrop-blur-xl border border-white/5 rounded-3xl p-10 flex flex-col gap-5 animate-in delay-100">
          <div className="bg-accent-primary/15 w-14 h-14 rounded-2xl flex items-center justify-center text-accent-primary border border-accent-primary/30">
            <Calendar size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Communal Calendar</h2>
          <p className="text-gray-400">Sync your Google Calendar to discover the perfect overlapping time blocks. Visually locate the "Green" zones and say goodbye to endless group chats.</p>
        </div>

        <div className="bg-surface-bg backdrop-blur-xl border border-white/5 rounded-3xl p-10 flex flex-col gap-5 animate-in delay-200">
           <div className="bg-accent-secondary/15 w-14 h-14 rounded-2xl flex items-center justify-center text-accent-secondary border border-accent-secondary/30">
            <LinkIcon size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Idea Brainstorming</h2>
          <p className="text-gray-400">Drop TikTok, Instagram, and YouTube links. Watch them instantly unfurl and let everyone rank their favorites with preferential voting.</p>
        </div>

        <div className="bg-surface-bg backdrop-blur-xl border border-white/5 rounded-3xl p-10 flex flex-col gap-5 animate-in delay-300">
           <div className="bg-accent-tertiary/15 w-14 h-14 rounded-2xl flex items-center justify-center text-accent-tertiary border border-accent-tertiary/30">
            <Users size={28} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Smart Agendas</h2>
          <p className="text-gray-400">Auto-generate a proposed timeline using the highest-ranked ideas and your group's free time. Refine it using the drag-and-drop builder.</p>
        </div>

      </section>
    </main>
  );
}
