import { Calendar, Users, Zap, Link as LinkIcon } from "lucide-react";
import Link from "next/link"; // Next.js built-in routing link

// Home page component: the main entry point to GroupSync
export default function Home() {
  return (
    <main className="max-w-[1200px] mx-auto p-8">
      <header className="text-center py-24 flex flex-col items-center">
        <h1 className="text-transparent bg-clip-text bg-gradient-to-br from-accent-primary via-accent-secondary to-accent-tertiary text-6xl font-extrabold tracking-tight mb-8 pb-2 animate-in">GroupSync</h1>
        <p className="animate-in delay-100 text-xl max-w-[600px] mx-auto mb-12 text-text-muted">
          Effortlessly coordinate your group events. Combine availability, brainstorm ideas, 
          and auto-build the perfect agenda in one stunning workspace.
        </p>
        <div className="animate-in delay-200">
          <Link href="/login" className="bg-gradient-to-br from-accent-primary to-accent-secondary text-white border-none py-4 px-8 rounded-full text-lg font-semibold cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(236,72,153,0.4)] relative overflow-hidden inline-flex items-center gap-2">
            Create New Event <Zap size={18} />
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-32 mt-16 pt-8 pb-32">
        
        {/* Feature 1: Dashboard */}
        <div className="flex flex-col lg:flex-row items-center gap-16 animate-in delay-100">
            <div className="flex-1 space-y-6 lg:pr-12">
                <div className="bg-[var(--subtle-gray)] w-16 h-16 rounded-2xl flex items-center justify-center border border-[var(--border-subtle)]">
                    <Users size={32} className="text-accent-secondary" />
                </div>
                <h2 className="text-4xl font-extrabold text-text-main">Your Command Center</h2>
                <p className="text-xl text-text-muted leading-relaxed">
                   Launch your planning operations from a stunning, centralized dashboard. Add beautiful featured images to your events and keep track of everything going from "Planning" to "Planned".
                </p>
            </div>
            <div className="flex-[1.5] w-full">
                <div className="rounded-[2rem] overflow-hidden border-[4px] border-[var(--subtle-gray)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] rotate-1 hover:rotate-0 transition-transform duration-500 bg-black">
                    <img src="/showcase/dashboard.png" alt="Unified Dashboard" className="w-full h-auto object-cover" />
                </div>
            </div>
        </div>

        {/* Feature 2: Calendar */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16 animate-in delay-200">
            <div className="flex-1 space-y-6 lg:pl-12">
                <div className="bg-[var(--subtle-gray)] w-16 h-16 rounded-2xl flex items-center justify-center border border-[var(--border-subtle)]">
                    <Calendar size={32} className="text-accent-primary" />
                </div>
                <h2 className="text-4xl font-extrabold text-text-main">Communal Availability</h2>
                <p className="text-xl text-text-muted leading-relaxed">
                    Stop the endless texting trying to find a weekend that works. Visually stack everyone's schedules and instantly lock in on the "Green Zones" where everyone is free.
                </p>
            </div>
            <div className="flex-[1.5] w-full">
                <div className="rounded-[2rem] overflow-hidden border-[4px] border-[var(--subtle-gray)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] -rotate-1 hover:rotate-0 transition-transform duration-500 bg-black">
                    <img src="/showcase/calendar.png" alt="Availability Calendar" className="w-full h-auto object-cover" />
                </div>
            </div>
        </div>

        {/* Feature 3: Brainstorming */}
        <div className="flex flex-col lg:flex-row items-center gap-16 animate-in delay-300">
            <div className="flex-1 space-y-6 lg:pr-12">
                <div className="bg-[var(--subtle-gray)] w-16 h-16 rounded-2xl flex items-center justify-center border border-[var(--border-subtle)]">
                    <LinkIcon size={32} className="text-accent-tertiary" />
                </div>
                <h2 className="text-4xl font-extrabold text-text-main">Visual Brainstorming</h2>
                <p className="text-xl text-text-muted leading-relaxed">
                    Toss YouTube videos, Instagram Reels, and TikToks straight into the hub. They unfurl beautifully, turning your idea list into an interactive visual moodboard equipped with ranked voting!
                </p>
            </div>
            <div className="flex-[1.5] w-full">
                <div className="rounded-[2rem] overflow-hidden border-[4px] border-[var(--subtle-gray)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] rotate-1 hover:rotate-0 transition-transform duration-500 bg-black">
                    <img src="/showcase/brainstorm.png" alt="Brainstorming Board" className="w-full h-auto object-cover" />
                </div>
            </div>
        </div>

        {/* Feature 4: Smart Agenda */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16 animate-in delay-300">
            <div className="flex-1 space-y-6 lg:pl-12">
                <div className="bg-[var(--subtle-gray)] w-16 h-16 rounded-2xl flex items-center justify-center border border-[var(--border-subtle)]">
                    <Zap size={32} className="text-yellow-400" />
                </div>
                <h2 className="text-4xl font-extrabold text-text-main">Smart Agendas</h2>
                <p className="text-xl text-text-muted leading-relaxed">
                    Convert your highest voted ideas into a master schedule instantly. Drag and drop events to automatically calculate timelines so everyone knows exactly where to be and when.
                </p>
            </div>
            <div className="flex-[1.5] w-full">
                <div className="rounded-[2rem] overflow-hidden border-[4px] border-[var(--subtle-gray)] shadow-[0_20px_50px_rgba(0,0,0,0.5)] -rotate-1 hover:rotate-0 transition-transform duration-500 bg-black">
                    <img src="/showcase/agenda.png" alt="Smart Agenda Timeline" className="w-full h-auto object-cover" />
                </div>
            </div>
        </div>

      </section>
    </main>
  );
}
