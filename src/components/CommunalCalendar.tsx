"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/utils/supabase";
import { Calendar, Save, AlertCircle, RefreshCw, X, Clock } from "lucide-react";

// --- Time Constants & Helpers ---
const START_HOUR = 8;
const END_HOUR = 22;
const PIXELS_PER_HOUR = 60;
const PIXELS_PER_MIN = PIXELS_PER_HOUR / 60;
const SNAP_MINS = 15;
const SNAP_PIXELS = SNAP_MINS * PIXELS_PER_MIN;

const COLOR_MAP = {
    green: "var(--color-green, #34A853)",
    orange: "var(--color-orange, #FBBC05)",
    red: "var(--color-red, #EA4335)"
};

const getNext7Days = () => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push(d);
    }
    return days;
};

const formatObjToIsoDate = (d: Date) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
};

const formatTimeRange = (startMins: number, endMins: number) => {
    const parse = (m: number) => {
        const h = Math.floor(m / 60).toString().padStart(2, '0');
        const min = (m % 60).toString().padStart(2, '0');
        return `${h}:${min}`;
    };
    return `${parse(startMins)} – ${parse(endMins)}`;
};

type BlockStatus = 'green' | 'orange' | 'red';
type RawBlock = {
    id: string;
    start_time: string;
    end_time: string;
    status_color: BlockStatus;
    custom_note: string;
    participant_id: string;
    is_local?: boolean;
    user_name: string;
};

// Merged segment rendering struct
type BlockMap = Record<BlockStatus, { names: Set<string>, isLocal: boolean, localId?: string, localNote?: string }>;

export default function CommunalCalendar({ eventId, participantId, startDate, endDate }: { eventId: string, participantId: string, startDate?: string, endDate?: string }) {
    // Pagination 
    const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

    // Generate Days limit 7
    const days = useMemo(() => {
        let baseDate = new Date();
        baseDate.setHours(0,0,0,0);
        
        if (startDate && endDate) {
            const partsStart = startDate.split("-");
            baseDate = new Date(parseInt(partsStart[0]), parseInt(partsStart[1]) - 1, parseInt(partsStart[2]), 0, 0, 0, 0);
        }
        
        baseDate.setDate(baseDate.getDate() + (currentWeekOffset * 7));
        
        const range = [];
        for (let i = 0; i < 7; i++) {
             const d = new Date(baseDate);
             d.setDate(baseDate.getDate() + i);
             
             if (endDate) {
                 const partsEnd = endDate.split("-");
                 const maxDate = new Date(parseInt(partsEnd[0]), parseInt(partsEnd[1]) - 1, parseInt(partsEnd[2]), 0, 0, 0, 0);
                 if (d > maxDate) break; 
             }
             range.push(d);
        }
        
        if (range.length === 0) return getNext7Days();
        return range;
    }, [startDate, endDate, currentWeekOffset]);

    const hasNextWeek = useMemo(() => {
         if (!endDate || !startDate) return true; // infinite for none
         const partsStart = startDate.split("-");
         const partsEnd = endDate.split("-");
         const s = new Date(parseInt(partsStart[0]), parseInt(partsStart[1]) - 1, parseInt(partsStart[2]), 0, 0, 0, 0);
         const e = new Date(parseInt(partsEnd[0]), parseInt(partsEnd[1]) - 1, parseInt(partsEnd[2]), 0, 0, 0, 0);
         
         const nextWeekStart = new Date(s);
         nextWeekStart.setDate(s.getDate() + ((currentWeekOffset + 1) * 7));
         return nextWeekStart <= e;
    }, [startDate, endDate, currentWeekOffset]);

    const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

    // State
    const [allBlocks, setAllBlocks] = useState<RawBlock[]>([]);
    const [localUserName, setLocalUserName] = useState("You");
    const [localEditHash, setLocalEditHash] = useState(0); // force rerender on local state morphs
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [modalDate, setModalDate] = useState("");
    const [modalStart, setModalStart] = useState("");
    const [modalEnd, setModalEnd] = useState("");
    const [modalColor, setModalColor] = useState<BlockStatus>('green');
    const [modalNote, setModalNote] = useState("");
    
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
    const [syncPrivacyPromptOpen, setSyncPrivacyPromptOpen] = useState(false);
    
    const gridRef = useRef<HTMLDivElement>(null);
    const ghostRef = useRef<HTMLDivElement | null>(null);
    const dragState = useRef({ isDragging: false, startY: 0, currentY: 0, date: "" });

    // Agenda Sync State
    const [agendaDate, setAgendaDate] = useState<string | null>(null);
    const [agendaStart, setAgendaStart] = useState<string | null>(null);
    const [agendaEnd, setAgendaEnd] = useState<string | null>(null);

    // Scroll to 7 AM on mount
    useEffect(() => {
        if (gridRef.current) {
            gridRef.current.scrollTop = 7 * PIXELS_PER_HOUR;
        }
    }, []);

    // Fetch DB & Realtime Sync
    useEffect(() => { 
        fetchCalendarData(); 
        
        const channel = supabase.channel('calendar-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_blocks', filter: `event_id=eq.${eventId}` }, () => {
                fetchCalendarData();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, () => {
                fetchCalendarData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [eventId, participantId]);

    const fetchCalendarData = async () => {
        // Fetch event data for Agenda Overlay
        const { data: evData } = await supabase.from('events').select('agenda_date, agenda_start_time, agenda_end_time').eq('id', eventId).single();
        if (evData) {
            setAgendaDate(evData.agenda_date);
            setAgendaStart(evData.agenda_start_time || "09:00");
            setAgendaEnd(evData.agenda_end_time || "17:00");
        }

        // Fetch local participant info for labeling
        const { data: me } = await supabase.from('participants').select('guest_name, users(display_name)').eq('id', participantId).single();
        if (me) {
            const myName = (me.users as any)?.display_name || me.guest_name;
            if (myName) setLocalUserName(`${myName} (You)`);
        }

        // Fetch blocks + joined participant names
        const { data: blocks } = await supabase.from('calendar_blocks').select('*, participants(guest_name, users(display_name))').eq('event_id', eventId);
        
        if (blocks) {
            const formatted = blocks.map(b => {
                const p = b.participants as any;
                const displayName = p?.users?.display_name || p?.guest_name || 'Unknown';
                const myName = (me?.users as any)?.display_name || me?.guest_name || 'You';
                
                return {
                    id: b.id,
                    start_time: b.start_time,
                    end_time: b.end_time,
                    status_color: b.status_color as BlockStatus,
                    custom_note: b.custom_note || "",
                    participant_id: b.participant_id,
                    is_local: b.participant_id === participantId,
                    user_name: b.participant_id === participantId ? `${myName} (You)` : displayName
                };
            });
            setAllBlocks(formatted);
            setLocalEditHash(h => h + 1);
        }
    };

    // --- Drag Interaction Engine (Vanilla DOM for high perf) ---
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, dateStr: string) => {
        // Block drag if clicking an existing visual event
        if ((e.target as HTMLElement).closest('.event-piece')) {
            e.stopPropagation();
            return;
        }

        const col = e.currentTarget;
        col.setPointerCapture(e.pointerId);
        
        const rect = col.getBoundingClientRect();
        const dropY = e.clientY - rect.top;
        const startY = Math.floor(dropY / SNAP_PIXELS) * SNAP_PIXELS;
        
        dragState.current = { isDragging: true, startY, currentY: startY, date: dateStr };
        
        // Spawn ghost
        if (!ghostRef.current) {
            ghostRef.current = document.createElement('div');
            ghostRef.current.className = 'selection-block';
            ghostRef.current.style.position = 'absolute';
            ghostRef.current.style.left = '0';
            ghostRef.current.style.right = '0';
            ghostRef.current.style.background = 'rgba(26, 115, 232, 0.3)';
            ghostRef.current.style.border = '1px solid #1a73e8';
            ghostRef.current.style.borderRadius = '4px';
            ghostRef.current.style.padding = '4px 8px';
            ghostRef.current.style.fontSize = '12px';
            ghostRef.current.style.color = '#1a73e8';
            ghostRef.current.style.fontWeight = '500';
            ghostRef.current.style.pointerEvents = 'none';
            ghostRef.current.style.zIndex = '10';
        }
        
        ghostRef.current.style.display = 'block';
        ghostRef.current.style.top = `${startY}px`;
        ghostRef.current.style.height = `0px`;
        col.appendChild(ghostRef.current);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragState.current.isDragging || !ghostRef.current) return;
        
        const col = e.currentTarget;
        const rect = col.getBoundingClientRect();
        const dropY = e.clientY - rect.top;
        
        dragState.current.currentY = Math.max(0, Math.round(dropY / SNAP_PIXELS) * SNAP_PIXELS);
        
        const top = Math.min(dragState.current.startY, dragState.current.currentY);
        const height = Math.abs(dragState.current.currentY - dragState.current.startY);
        
        ghostRef.current.style.top = `${top}px`;
        ghostRef.current.style.height = `${height}px`;
        ghostRef.current.innerHTML = `<span>${formatTimeRange(top, top+height)}</span>`;
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragState.current.isDragging) return;
        dragState.current.isDragging = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
        
        let top = Math.min(dragState.current.startY, dragState.current.currentY);
        let height = Math.abs(dragState.current.currentY - dragState.current.startY);
        
        if (height === 0) {
            height = PIXELS_PER_HOUR; // Default 1 hour for single click
            if (ghostRef.current) ghostRef.current.style.height = `${height}px`;
        }
        
        if (ghostRef.current) ghostRef.current.innerHTML = `<span>${formatTimeRange(top, top+height)}</span>`;
        
        initModalNew(dragState.current.date, top, top + height);
    };

    // --- Modal Configuration Flow ---
    const initModalNew = (dateStr: string, startMins: number, endMins: number) => {
        setEditingBlockId(null);
        setModalDate(dateStr);
        setModalStart(mToHM(startMins));
        setModalEnd(mToHM(endMins));
        setModalColor('green');
        setModalNote("");
        setIsModalOpen(true);
    };

    const initModalEdit = (bData: { id: string, date: string, startMins: number, endMins: number, color: BlockStatus, note: string }) => {
        // Clear ghost if clicked edit directly
        if (ghostRef.current) ghostRef.current.style.display = 'none';
        
        setEditingBlockId(bData.id);
        setModalDate(bData.date);
        setModalStart(mToHM(bData.startMins));
        setModalEnd(mToHM(bData.endMins));
        setModalColor(bData.color);
        setModalNote(bData.note || "");
        setIsModalOpen(true);
    };

    const mToHM = (mins: number) => {
        const h = Math.floor(mins / 60).toString().padStart(2, '0');
        const m = (mins % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        if (ghostRef.current) ghostRef.current.style.display = 'none';
    };

    const handleApplyModal = () => {
        const startMins = parseInt(modalStart.split(':')[0]) * 60 + parseInt(modalStart.split(':')[1]);
        const endMins = parseInt(modalEnd.split(':')[0]) * 60 + parseInt(modalEnd.split(':')[1]);
        
        if (endMins <= startMins) { alert("End time must be after Start time."); return; }

        let newBlocks: RawBlock[];
        // Local state mutation for immediate prototype feedback
        if (editingBlockId) {
            newBlocks = allBlocks.map(b => b.id === editingBlockId ? {
                ...b, 
                status_color: modalColor, 
                custom_note: modalNote,
                start_time: HMToIsoStr(modalDate, startMins),
                end_time: HMToIsoStr(modalDate, endMins)
            } : b);
        } else {
            newBlocks = [...allBlocks, {
                id: `local-${Date.now()}`,
                participant_id: participantId,
                is_local: true,
                user_name: localUserName,
                status_color: modalColor,
                custom_note: modalNote,
                start_time: HMToIsoStr(modalDate, startMins),
                end_time: HMToIsoStr(modalDate, endMins)
            }];
        }
        
        setAllBlocks(newBlocks);
        handleCloseModal();
        setLocalEditHash(h => h + 1);
        handleSaveDatabaseSync(newBlocks);
    };

    const handleDeleteLocal = () => {
        const newBlocks = allBlocks.filter(b => b.id !== editingBlockId);
        setAllBlocks(newBlocks);
        handleCloseModal();
        setLocalEditHash(h => h + 1);
        handleSaveDatabaseSync(newBlocks);
    };

    const HMToIsoStr = (dateStr: string, mins: number) => {
        const d = new Date(dateStr + "T00:00:00"); // Base local day
        d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
        return d.toISOString();
    };

    // --- Core Supabase Sync ---
    const handleSaveDatabaseSync = async (blocksToSave: RawBlock[] = allBlocks) => {
        setIsSaving(true);
        try {
            // Delete participant's old blocks safely
            await supabase.from('calendar_blocks').delete().eq('event_id', eventId).eq('participant_id', participantId);

            const payload = blocksToSave.filter(b => b.is_local).map(b => ({
                event_id: eventId,
                participant_id: participantId,
                start_time: b.start_time,
                end_time: b.end_time,
                status_color: b.status_color,
                custom_note: b.custom_note
            }));

            if (payload.length > 0) {
                const { error } = await supabase.from('calendar_blocks').insert(payload);
                if (error) throw error;
            }
            await fetchCalendarData(); // reload genuine ids and sync
        } catch(err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Google Calendar Sync ---
    const handleSyncGoogleCalendarClick = async () => {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            
            const providerToken = session?.provider_token;
            if (!providerToken) {
                const wantsToLink = window.confirm("You need to securely connect your Google account to sync your calendar. Click OK to be redirected to Google for authorization.");
                if (wantsToLink) {
                     const { data: { user } } = await supabase.auth.getUser();
                     const isLinked = user?.identities?.some(id => id.provider === 'google');
                     
                     if (isLinked) {
                         const { error } = await supabase.auth.signInWithOAuth({
                             provider: 'google',
                             options: {
                                 scopes: 'https://www.googleapis.com/auth/calendar.readonly',
                                 redirectTo: window.location.href,
                                 queryParams: { prompt: 'consent' }
                             }
                         });
                         if (error) alert("Failed to re-authenticate Google connection: " + error.message);
                     } else {
                         const { error } = await supabase.auth.linkIdentity({
                             provider: 'google',
                             options: {
                                 scopes: 'https://www.googleapis.com/auth/calendar.readonly',
                                 redirectTo: window.location.href
                             }
                         });
                         if (error) alert("Failed to link Google connection: " + error.message);
                     }
                }
                return;
            }

            // Auth checked out. Open the privacy preference modal.
            setSyncPrivacyPromptOpen(true);
        } catch (err: any) {
            console.error("Failed to start sync:", err);
        }
    };

    const performGcalSync = async (includeTitles: boolean) => {
        setSyncPrivacyPromptOpen(false);
        setIsSyncingGoogle(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const providerToken = session?.provider_token;
            if (!providerToken) throw new Error("Missing provider token during final sync.");

            const fetchStart = new Date(days[0]);
            fetchStart.setHours(0, 0, 0, 0);
            
            const fetchEnd = new Date(days[days.length - 1]);
            fetchEnd.setHours(23, 59, 59, 999);

            const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(fetchStart.toISOString())}&timeMax=${encodeURIComponent(fetchEnd.toISOString())}&singleEvents=true`;

            const res = await fetch(url, { headers: { Authorization: `Bearer ${providerToken}` } });
            
            if (!res.ok) {
                if (res.status === 401) {
                    alert("Your Google Calendar connection has expired (1 hour limit). Please log out and log back in to sync.");
                    return;
                }
                let errorDetails = "";
                try {
                    const errBody = await res.json();
                    errorDetails = errBody?.error?.message || JSON.stringify(errBody);
                } catch(e) {
                    errorDetails = await res.text();
                }
                throw new Error(`Google API responded with status ${res.status}: ${errorDetails}`);
            }

            const data = await res.json();
            
            const gcalBlocks: RawBlock[] = (data.items || []).filter((e: any) => e.start && (e.start.dateTime || e.start.date)).map((e: any) => {
                 const startIso = e.start.dateTime || new Date(e.start.date).toISOString();
                 const endIso = e.end.dateTime || new Date(e.end.date).toISOString();
                 
                 return {
                     id: `gcal-${e.id}`,
                     participant_id: participantId,
                     is_local: true,
                     user_name: localUserName,
                     status_color: 'red',
                     custom_note: includeTitles ? (e.summary || "Busy (Google Calendar)") : "Busy (Google Calendar)",
                     start_time: startIso,
                     end_time: endIso
                 };
            });

            if (gcalBlocks.length === 0) {
                alert("No events found in this timeframe on your Google Calendar.");
                return;
            }

            const preservedLocalBlocks = allBlocks.filter(b => !b.id.startsWith("gcal-"));
            const newBlocks = [...preservedLocalBlocks, ...gcalBlocks];
            
            setAllBlocks(newBlocks);
            setLocalEditHash(h => h + 1);
            handleSaveDatabaseSync(newBlocks);
            
        } catch (err: any) {
            console.error("Failed to sync GCAL:", err);
            alert("Failed to sync with Google Calendar: " + err.message);
        } finally {
            setIsSyncingGoogle(false);
        }
    };

    // --- Complex Visualization Logic ---
    const renderDayColumn = (dateIso: string) => {
        // Collect blocks perfectly matching this day
        const dayBlocks = allBlocks.filter(b => {
             const bStart = new Date(b.start_time);
             const tz = bStart.getTimezoneOffset() * 60000;
             const localizedIso = new Date(bStart.getTime() - tz).toISOString().slice(0,10);
             return localizedIso === dateIso;
        });

        // Split day into 15 min chunks (24*4 = 96)
        const segments: BlockMap[] = Array.from({ length: 96 }, () => ({
             green: { names: new Set(), isLocal: false },
             orange: { names: new Set(), isLocal: false },
             red: { names: new Set(), isLocal: false }
        }));

        dayBlocks.forEach(b => {
             const startD = new Date(b.start_time);
             const endD = new Date(b.end_time);
             const startMins = startD.getHours() * 60 + startD.getMinutes();
             const endMins = endD.getHours() * 60 + endD.getMinutes();
             
             const sIdx = Math.floor(startMins / SNAP_MINS);
             const eIdx = Math.ceil(endMins / SNAP_MINS);
             
             for(let i = sIdx; i < eIdx; i++) {
                 if (i >= 96) break; // defensive
                 const map = segments[i][b.status_color];
                 map.names.add(b.user_name);
                 if (b.is_local) {
                     map.isLocal = true;
                     map.localId = b.id;
                     map.localNote = b.custom_note;
                 }
             }
        });

        const visualBlocks = [];
        let currentGroup = null;

        const getSegKey = (seg: BlockMap) => {
            const arr: string[] = [];
            (['green', 'orange', 'red'] as BlockStatus[]).forEach(col => {
                const names = Array.from(seg[col].names).sort();
                arr.push(`${col}:${names.join(',')}:${seg[col].isLocal}`);
            });
            return arr.join('|');
        };

        for(let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const isEmpty = seg.green.names.size === 0 && seg.orange.names.size === 0 && seg.red.names.size === 0;
            
            if (isEmpty) {
                if(currentGroup) { visualBlocks.push(currentGroup); currentGroup = null; }
                continue;
            }
            
            const key = getSegKey(seg);
            if (!currentGroup || currentGroup.key !== key) {
                if(currentGroup) visualBlocks.push(currentGroup);
                currentGroup = { key, startIdx: i, endIdx: i + 1, data: seg };
            } else {
                currentGroup.endIdx = i + 1;
            }
        }
        if(currentGroup) visualBlocks.push(currentGroup);

        return (
            <div 
                className="day-column" 
                key={dateIso}
                data-date={dateIso}
                onPointerDown={(e) => handlePointerDown(e, dateIso)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                   flex: 1, height: "1440px", borderRight: "1px solid var(--border-subtle)", position: "relative",
                   backgroundSize: "100% 60px", touchAction: "none",
                   backgroundImage: "linear-gradient(to bottom, var(--border-subtle) 1px, transparent 1px)"
                }}
            >
                {visualBlocks.map((vb, i) => {
                    const top = vb.startIdx * SNAP_PIXELS;
                    const height = (vb.endIdx - vb.startIdx) * SNAP_PIXELS;
                    const activeColors = (['green', 'orange', 'red'] as BlockStatus[]).filter(c => vb.data[c].names.size > 0);
                    
                    return (
                        <div key={i} style={{ position: "absolute", top: `${top}px`, height: `${height}px`, left: "1px", right: "2px", display: "flex", gap: "2px", zIndex: 2 }}>
                            {activeColors.map(col => {
                                const isLocal = vb.data[col].isLocal;
                                const bData = vb.data[col];
                                const borderCol = isLocal ? "1px solid rgba(255,255,255,0.6)" : "1px solid rgba(0,0,0,0.1)";
                                const bgCol = COLOR_MAP[col];
                                
                                return (
                                    <div 
                                        key={col} 
                                        className="event-piece animate-in"
                                        onClick={(e) => {
                                            if (isLocal && bData.localId) {
                                                e.stopPropagation();
                                                initModalEdit({ id: bData.localId, date: dateIso, startMins: vb.startIdx*SNAP_MINS, endMins: vb.endIdx*SNAP_MINS, color: col, note: bData.localNote || "" });
                                            }
                                        }}
                                        style={{ 
                                            flex: 1, background: bgCol, borderRadius: "4px", padding: "4px 6px", overflow: "hidden", 
                                            boxShadow: "0 1px 2px rgba(0,0,0,0.2)", pointerEvents: isLocal ? "auto" : "none",
                                            cursor: isLocal ? "pointer" : "default", border: borderCol,
                                            animation: "fadeOpac 0.2s"
                                        }}
                                        title={bData.localNote || ""}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: "11px", color: "white", marginBottom: "2px" }}>
                                            {col === 'green' ? 'Free' : col === 'orange' ? 'Maybe' : 'Busy'}
                                        </div>
                                        <div style={{ fontSize: "10px", opacity: 0.9, color: "white", lineHeight: 1.2 }}>
                                            {Array.from(bData.names).join(', ')}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                })}

                {/* Finalized Agenda Overlay (Gold Gradient) */}
                {agendaDate === dateIso && agendaStart && agendaEnd && (
                    <div style={{ position: "absolute", left: "-4px", right: "-4px", top: `${(() => {
                        const [h, m] = agendaStart.split(':').map(Number);
                        return (h * 60 + (m || 0)) * (PIXELS_PER_HOUR / 60);
                    })()}px`, height: `${(() => {
                        const [sh, sm] = agendaStart.split(':').map(Number);
                        const [eh, em] = agendaEnd.split(':').map(Number);
                        return ((eh * 60 + (em || 0)) - (sh * 60 + (sm || 0))) * (PIXELS_PER_HOUR / 60);
                    })()}px`, zIndex: 10, border: "2px dashed #fbbf24", borderRadius: "8px", background: "linear-gradient(135deg, rgba(251, 191, 36, 0.3) 0%, rgba(245, 158, 11, 0.4) 100%)", boxShadow: "0 0 20px rgba(245, 158, 11, 0.3)", pointerEvents: "none", display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <div style={{ background: "rgba(30,30,30,0.8)", border: "1px solid #fbbf24", color: "#fbbf24", padding: "4px 12px", borderRadius: "12px", fontWeight: "bold", fontSize: "0.85rem", backdropFilter: "blur(4px)", boxShadow: "0 4px 6px rgba(0,0,0,0.3)" }}>
                            ⭐ Finalized Agenda Time
                        </div>
                    </div>
                )}
            </div>
        )
    };

    return (
        <div className="glass-panel animate-in" style={{ padding: "0 0 0 0", display: "flex", flexDirection: "column", background: "var(--bg-base)", overflow: "hidden", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
            
            {/* Action Header */}
            <div style={{ padding: "16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.02)" }}>
                 <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                     <button className="btn-outline" onClick={() => initModalNew(formatObjToIsoDate(new Date()), (new Date().getHours()+1)*60, (new Date().getHours()+2)*60)} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", padding: "8px 16px", borderRadius: "24px", color: "var(--text-main)", cursor: "pointer", transition: "0.2s" }} onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"} onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}>
                         + Create Event
                     </button>

                     <button 
                         className="btn-outline" 
                         disabled={isSyncingGoogle}
                         onClick={handleSyncGoogleCalendarClick} 
                         style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(66, 133, 244, 0.1)", border: "1px solid rgba(66, 133, 244, 0.4)", padding: "8px 16px", borderRadius: "24px", color: "#4285F4", cursor: isSyncingGoogle ? "wait" : "pointer", transition: "0.2s" }} 
                         onMouseOver={e => !isSyncingGoogle && (e.currentTarget.style.background = "rgba(66, 133, 244, 0.2)")} 
                         onMouseOut={e => e.currentTarget.style.background = "rgba(66, 133, 244, 0.1)"}
                     >
                         {isSyncingGoogle ? <RefreshCw size={16} className="animate-spin" /> : <Calendar size={16} />} 
                         {isSyncingGoogle ? "Syncing..." : "Sync Google Calendar"}
                     </button>

                     <div style={{ display: "flex", gap: "4px", alignItems: "center", marginLeft: "12px" }}>
                         <button disabled={currentWeekOffset === 0} onClick={() => setCurrentWeekOffset(prev => Math.max(0, prev - 1))} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.05)", color: currentWeekOffset === 0 ? "var(--text-muted)" : "var(--text-main)", display: "flex", alignItems: "center", justifyContent: "center", cursor: currentWeekOffset === 0 ? "not-allowed" : "pointer" }}>&lt;</button>
                         <button disabled={!hasNextWeek} onClick={() => setCurrentWeekOffset(prev => prev + 1)} style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.05)", color: !hasNextWeek ? "var(--text-muted)" : "var(--text-main)", display: "flex", alignItems: "center", justifyContent: "center", cursor: !hasNextWeek ? "not-allowed" : "pointer" }}>&gt;</button>
                     </div>
                 </div>
                 
                 <div style={{ display: "flex", gap: "1rem", alignItems: "center", minHeight: "36px" }}>
                     {isSaving && (
                         <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                             <RefreshCw size={14} className="animate-spin" /> Saving to cloud...
                         </div>
                     )}
                 </div>
            </div>

            {/* Grid Container */}
            <div style={{ display: "flex", flexDirection: "column", height: "500px", overflowY: "auto", overflowX: "auto", position: "relative" }} ref={gridRef}>
                
                {/* Headers Row (Sticky Top) */}
                <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 10, background: "var(--bg-base)", width: "100%", minWidth: "min-content" }}>
                    {/* Top-Left Corner (Sticky Left + Top) */}
                    <div style={{ width: "60px", minWidth: "60px", borderRight: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)", position: "sticky", left: 0, background: "var(--bg-base)", zIndex: 11 }}></div>
                    
                    {/* Day Headers (Scrolls X freely) */}
                    <div style={{ display: "flex", flex: 1, minWidth: "700px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-base)" }}>
                        {days.map(d => {
                            const isToday = d.toDateString() === new Date().toDateString();
                            return (
                                <div key={d.toISOString()} style={{ flex: 1, textAlign: "center", borderRight: "1px solid var(--border-subtle)", fontSize: "12px", color: "var(--text-muted)", textTransform: "uppercase", display: "flex", flexDirection: "column", justifyContent: "center", padding: "4px 0", height: "50px" }}>
                                    <span style={{ color: isToday ? "var(--btn-primary)" : "inherit", lineHeight: 1 }}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]}</span>
                                    <span style={{ fontSize: "20px", color: isToday ? "white" : "var(--text-main)", background: isToday ? "var(--btn-primary)" : "transparent", borderRadius: "50%", width: "26px", height: "26px", display: "inline-flex", justifyContent: "center", alignItems: "center", margin: "2px auto 0", lineHeight: 1 }}>{d.getDate()}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Body Row (Grid + Time Gutter) */}
                <div style={{ display: "flex", flex: 1, width: "100%", minWidth: "min-content" }}>
                    {/* Time Gutter (Sticky Left) */}
                    <div style={{ width: "60px", minWidth: "60px", borderRight: "1px solid var(--border-subtle)", position: "sticky", left: 0, background: "var(--bg-base)", zIndex: 5 }}>
                        {hours.map(h => (
                            <div key={h} style={{ height: "60px", textAlign: "right", paddingRight: "8px", color: "var(--text-muted)", fontSize: "11px", transform: "translateY(-7px)", position: "relative" }}>
                                {h === 0 ? '' : `${h%12||12} ${h>=12?'PM':'AM'}`}
                            </div>
                        ))}
                    </div>

                    {/* Day Columns */}
                    <div style={{ display: "flex", flex: 1, minWidth: "700px", cursor: "crosshair", position: "relative" }}>
                        {days.map(d => renderDayColumn(formatObjToIsoDate(d)))}
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}>
                    <div className="glass-panel animate-in" style={{ padding: "1.5rem", width: "90%", maxWidth: "420px", position: "relative", display: "flex", flexDirection: "column", gap: "1.2rem", background: "rgba(20,20,20,0.95)", border: "1px solid var(--border-subtle)", borderRadius: "12px", boxShadow: "0 24px 38px 3px rgba(0,0,0,0.4)" }}>
                        <button onClick={handleCloseModal} style={{ position: "absolute", top: 15, right: 15, background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={18} /></button>
                        
                        <h3 style={{ margin: 0, color: "var(--text-main)", fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "8px" }}>
                            {editingBlockId ? "Edit Block" : "Time Scheduler"} <Clock size={16} />
                        </h3>

                        {/* Status Type (Flex) */}
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                             {([['green', 'Free'], ['orange', 'Maybe'], ['red', 'Busy']] as [BlockStatus, string][]).map(([col, label]) => (
                                 <button 
                                     key={col}
                                     onClick={() => setModalColor(col)} 
                                     style={{ flex: 1, padding: "8px", borderRadius: "8px", border: modalColor === col ? `2px solid var(--text-main)` : "2px solid transparent", background: COLOR_MAP[col], color: "white", cursor: "pointer", fontWeight: 600, transition: "0.2s" }}
                                 >{label}</button>
                             ))}
                        </div>

                        {/* Time Setup */}
                        <div style={{ display: "flex", gap: "1rem" }}>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Start</label>
                                <input type="time" step="900" style={{ border: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "4px", color: "white" }} value={modalStart} onChange={(e) => setModalStart(e.target.value)} />
                            </div>
                            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>End</label>
                                <input type="time" step="900" style={{ border: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "4px", color: "white" }} value={modalEnd} onChange={(e) => setModalEnd(e.target.value)} />
                            </div>
                        </div>

                        {/* Note area */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Notes (Optional)</label>
                            <input type="text" placeholder="e.g. Call me if absolutely needed" value={modalNote} onChange={(e) => setModalNote(e.target.value)} style={{ border: "1px solid var(--border-subtle)", background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "4px", color: "white" }} />
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                            {editingBlockId ? <button onClick={handleDeleteLocal} style={{ background: "transparent", color: "#fca5a5", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>Delete Block</button> : <div></div>}
                            <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
                                <button onClick={handleCloseModal} style={{ background: "transparent", border: "1px solid var(--border-subtle)", padding: "8px 12px", borderRadius: "8px", color: "var(--text-main)", cursor: "pointer", fontSize: "0.9rem" }}>Cancel</button>
                                <button onClick={handleApplyModal} className="btn-primary" style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "0.9rem" }}>Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {syncPrivacyPromptOpen && (
                <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }} onClick={() => setSyncPrivacyPromptOpen(false)}>
                    <div style={{ background: "var(--bg-surface)", padding: "32px", borderRadius: "16px", width: "100%", maxWidth: "450px", border: "1px solid var(--border-subtle)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", animation: "slideUpFade 0.2s ease-out" }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 16px 0", color: "var(--text-main)", fontSize: "1.25rem" }}>
                            Calendar Privacy Settings
                        </h2>
                        <p style={{ color: "var(--text-muted)", fontSize: "1rem", lineHeight: 1.5, marginBottom: "24px" }}>
                            Do you want to include the real event titles on the grid? <br/><br/>
                            • <strong>Yes</strong>: Share the titles (e.g. 'Doctor Appointment').<br/>
                            • <strong>No</strong>: Keep them completely anonymous ('Busy').
                        </p>
                        
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "1rem" }}>
                            <button 
                                onClick={() => performGcalSync(false)}
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "var(--text-main)", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: 500, transition: "0.2s" }}
                                onMouseOver={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                                onMouseOut={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                            >
                                No
                            </button>
                            <button 
                                onClick={() => performGcalSync(true)}
                                style={{ background: "var(--accent-primary)", border: "1px solid var(--accent-primary)", color: "white", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: 500, display: "flex", alignItems: "center", gap: "6px" }}
                            >
                                Yes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
