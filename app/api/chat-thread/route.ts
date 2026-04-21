import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

type DeleteThreadRequest = {
  sessionId?: string;
};

export async function DELETE(request: Request) {
  if (!supabase) {
    return Response.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  const { sessionId } = (await request.json()) as DeleteThreadRequest;

  if (!sessionId) {
    return Response.json({ error: 'sessionId is required.' }, { status: 400 });
  }

  const { error } = await supabase.from('chat_memories').delete().eq('session_id', sessionId);

  if (error) {
    console.error('chat thread delete failed', error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, sessionId });
}
