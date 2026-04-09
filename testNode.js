const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
    const { data: events, error: evErr } = await supabase.from('events').select('id').limit(1);
    if (!events || events.length === 0) return console.log("No events");
    const eventId = events[0].id;
    
    const { data: part } = await supabase.from('participants').select('id').eq('event_id', eventId).limit(1);
    if (!part || part.length === 0) return console.log("No part");
    const participantId = part[0].id;

    console.log("Found event and participant:", eventId, participantId);
    
    // Check blocks
    const { data: blocks, error } = await supabase.from('calendar_blocks').select('*').eq('event_id', eventId);
    console.log("Blocks in DB:", blocks?.length, "Error:", error);
    
    // Try mock insert
    const { data: insData, error: insErr } = await supabase.from('calendar_blocks').insert([
        {
            event_id: eventId,
            participant_id: participantId,
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 3600000).toISOString(),
            status_color: 'green',
            custom_note: 'Test Node'
        }
    ]).select();
    
    console.log("Insert Result:", insData, "Insert Error:", insErr);
}

test();
