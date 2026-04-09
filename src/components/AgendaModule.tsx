"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase";
import { 
    DndContext, 
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, GripVertical, Trash2 } from "lucide-react";

type AgendaItem = {
    id: string;
    event_id: string;
    idea_id: string;
    duration_mins: number;
    order_index: number;
    // Joined data from brainstorm_ideas
    idea: {
        title: string;
        url: string;
        provider_name: string;
    }
};

export default function AgendaModule({ eventId, startDate, endDate }: { eventId: string, startDate?: string, endDate?: string }) {
    const [items, setItems] = useState<AgendaItem[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Synced configuration state
    const [dateStr, setDateStr] = useState("");
    const [startTimeStr, setStartTimeStr] = useState("09:00");
    const [endTimeStr, setEndTimeStr] = useState("17:00");

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        fetchAgenda();

        // Realtime Multiplayer Sync
        const channel = supabase.channel('agenda-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_items', filter: `event_id=eq.${eventId}` }, () => {
                fetchAgenda();
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, () => {
                fetchAgenda();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [eventId]);

    const fetchAgenda = async () => {
        try {
            // First fetch global event settings (start & end time)
            const { data: evData } = await supabase.from('events').select('agenda_date, agenda_start_time, agenda_end_time').eq('id', eventId).single();
            if (evData) {
                let updates: any = {};
                
                if (evData.agenda_date) { 
                    setDateStr(evData.agenda_date); 
                } else if (startDate) { 
                    updates.agenda_date = startDate; 
                    setDateStr(startDate); 
                }

                if (evData.agenda_start_time) { 
                    setStartTimeStr(evData.agenda_start_time); 
                } else { 
                    updates.agenda_start_time = "09:00"; 
                }

                if (evData.agenda_end_time) { 
                    setEndTimeStr(evData.agenda_end_time); 
                } else { 
                    updates.agenda_end_time = "17:00"; 
                }

                if (Object.keys(updates).length > 0) {
                    await supabase.from('events').update(updates).eq('id', eventId);
                }
            }

            const { data, error } = await supabase
                .from('agenda_items')
                .select(`
                    id, event_id, idea_id, duration_mins, order_index,
                    idea:brainstorm_ideas ( title, url, provider_name )
                `)
                .eq('event_id', eventId)
                .order('order_index', { ascending: true });
                
            if (error) throw error;
            const formatted = (data || []).map(d => ({
                ...d,
                idea: Array.isArray(d.idea) ? d.idea[0] : d.idea
            })) as AgendaItem[];
            setItems(formatted);
        } catch (err: any) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateEventBounds = async (field: 'agenda_date' | 'agenda_start_time' | 'agenda_end_time', val: string) => {
        if (field === 'agenda_date') setDateStr(val);
        if (field === 'agenda_start_time') setStartTimeStr(val);
        if (field === 'agenda_end_time') setEndTimeStr(val);
        // Persist to server for real-time collaboration
        await supabase.from('events').update({ [field]: val }).eq('id', eventId);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        
        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex(item => item.id === active.id);
            const newIndex = items.findIndex(item => item.id === over.id);
            
            const reordered = arrayMove(items, oldIndex, newIndex);
            
            // Optimistic update
            setItems(reordered.map((item, index) => ({ ...item, order_index: index })));
            
            // Persist order logic safely (simple batch update loop since it's small)
            reordered.forEach(async (item, index) => {
                await supabase.from('agenda_items')
                    .update({ order_index: index })
                    .eq('id', item.id);
            });
        }
    };

    const updateDuration = async (id: string, newDuration: number) => {
        setItems(items.map(item => item.id === id ? { ...item, duration_mins: newDuration } : item));
        await supabase.from('agenda_items').update({ duration_mins: newDuration }).eq('id', id);
    };

    const removeFromAgenda = async (id: string) => {
        setItems(items.filter(item => item.id !== id));
        await supabase.from('agenda_items').delete().eq('id', id);
    };

    // Smart Time-Gap Calculus (Dynamic based on user input synced across clients)
    let [startHour, startMinute] = startTimeStr.split(":").map(Number);
    let runningTime = new Date();
    runningTime.setHours(startHour || 9, startMinute || 0, 0, 0);

    let [endHour, endMinute] = endTimeStr.split(":").map(Number);
    let masterEndTime = new Date();
    masterEndTime.setHours(endHour || 17, endMinute || 0, 0, 0);

    return (
        <div className="glass-panel animate-in" style={{ padding: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h2 style={{ display: "flex", alignItems: "center", gap: "10px", margin: "0 0 10px 0" }}>
                        <Clock size={20} color="var(--accent-secondary)" />
                        Smart Agenda Timeline
                    </h2>
                    <div style={{ display: "flex", alignItems: "center", gap: "15px", color: "var(--text-muted)", fontSize: "0.95rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>Date:</span>
                            <input 
                                type="date" 
                                value={dateStr} 
                                min={startDate || undefined}
                                max={endDate || undefined}
                                onChange={e => updateEventBounds('agenda_date', e.target.value)} 
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", padding: "4px 8px", borderRadius: "8px", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
                            />
                        </div>
                        <div style={{ borderLeft: "1px solid var(--border-subtle)", height: "20px" }}></div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>Start:</span>
                            <input 
                                type="time" 
                                value={startTimeStr} 
                                onChange={e => updateEventBounds('agenda_start_time', e.target.value)} 
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", padding: "4px 8px", borderRadius: "8px", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
                            />
                        </div>
                        <div style={{ borderLeft: "1px solid var(--border-subtle)", height: "20px" }}></div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>End constraint:</span>
                            <input 
                                type="time" 
                                value={endTimeStr} 
                                onChange={e => updateEventBounds('agenda_end_time', e.target.value)} 
                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", padding: "4px 8px", borderRadius: "8px", outline: "none", cursor: "pointer", fontFamily: "inherit" }}
                            />
                        </div>
                    </div>
                </div>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "12px" }}>
                    {items.length} Activities
                </span>
            </div>
            
            <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
                Drag and drop your finalized brainstorms to build the locked itinerary. Assign durations and the timeline will automatically calculate your schedule!
            </p>

            {loading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>Loading timeline...</div>
            ) : items.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem", border: "1px dashed var(--border-subtle)", borderRadius: "12px", color: "var(--text-muted)" }}>
                    Your timeline is empty. Add items from the Brainstorm Hub below!
                </div>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {items.map((item, index) => {
                                // Calculate time block for this specific item in the chain
                                const startTimeStr = runningTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                runningTime = new Date(runningTime.getTime() + item.duration_mins * 60000);
                                const endTimeStr = runningTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                                
                                const isOverflowing = runningTime > masterEndTime;
                                
                                return (
                                    <SortableAgendaCard 
                                        key={item.id} 
                                        item={item} 
                                        timeLabel={`${startTimeStr} - ${endTimeStr}`}
                                        isOverflowing={isOverflowing}
                                        onUpdateDuration={updateDuration}
                                        onRemove={removeFromAgenda}
                                    />
                                );
                            })}
                        </div>
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
}

// Draggable Sub-component
function SortableAgendaCard({ item, timeLabel, isOverflowing, onUpdateDuration, onRemove }: { item: AgendaItem, timeLabel: string, isOverflowing: boolean, onUpdateDuration: (id: string, v: number) => void, onRemove: (id: string) => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : 1,
        opacity: isDragging ? 0.8 : 1,
        background: isDragging ? "rgba(255,255,255,0.1)" : (isOverflowing ? "rgba(239, 68, 68, 0.05)" : "var(--bg-surface)"),
        border: `1px solid ${isOverflowing ? "#ef4444" : "var(--border-subtle)"}`,
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        boxShadow: isDragging ? "0 10px 20px rgba(0,0,0,0.3)" : "none"
    };

    // Styling logic to forcefully fix browser/OS dropdown white-on-white text rendering issues
    const optionStyle = { color: "#000", background: "#fff" };

    return (
        <div ref={setNodeRef} style={style}>
            <div {...attributes} {...listeners} style={{ cursor: "grab", color: "var(--text-muted)", padding: "4px" }}>
                <GripVertical size={20} />
            </div>
            
            <div style={{ minWidth: "140px", fontWeight: "bold", color: isOverflowing ? "#ef4444" : "var(--accent-secondary)", fontSize: "0.95rem" }}>
                {timeLabel}
                {isOverflowing && <div style={{ fontSize: "0.7rem", color: "#ef4444", marginTop: "2px" }}>Over time limit</div>}
            </div>

            <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "1.1rem", color: isOverflowing ? "#fca5a5" : "inherit" }}>{item.idea?.title || "Unknown Idea"}</h4>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", gap: "8px", alignItems: "center" }}>
                    {item.idea?.provider_name && <span style={{ textTransform: "uppercase" }}>{item.idea.provider_name}</span>}
                </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <select 
                    value={item.duration_mins}
                    onChange={(e) => onUpdateDuration(item.id, Number(e.target.value))}
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", color: "white", padding: "6px 12px", borderRadius: "8px", outline: "none", cursor: "pointer" }}
                >
                    <option value={15} style={optionStyle}>15 mins</option>
                    <option value={30} style={optionStyle}>30 mins</option>
                    <option value={45} style={optionStyle}>45 mins</option>
                    <option value={60} style={optionStyle}>1 hour</option>
                    <option value={90} style={optionStyle}>1.5 hours</option>
                    <option value={120} style={optionStyle}>2 hours</option>
                    <option value={180} style={optionStyle}>3 hours</option>
                </select>

                <button 
                    onClick={() => onRemove(item.id)}
                    style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", transition: "0.2s" }}
                    onMouseOver={e => e.currentTarget.style.color = "#f87171"}
                    onMouseOut={e => e.currentTarget.style.color = "var(--text-muted)"}
                    title="Remove from block"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
}
