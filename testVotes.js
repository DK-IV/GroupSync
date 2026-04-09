const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('idea_votes').select('*');
  console.log("Q1 Error:", error || "None");
  if (error) return;

  const { data: dbIdeas } = await supabase.from('brainstorm_ideas').select('*').limit(1);
  if (dbIdeas && dbIdeas.length > 0) {
      console.log("Upserting...");
      const { error: upsertErr } = await supabase.from('idea_votes').upsert({
          idea_id: dbIdeas[0].id,
          participant_id: '00000000-0000-0000-0000-000000000000',
          event_id: dbIdeas[0].event_id,
          rank_value: 1
      }, { onConflict: 'idea_id, participant_id' });
      console.log("Upsert Error:", upsertErr);
  }
}
check();
