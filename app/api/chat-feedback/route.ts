import { createClient } from '@supabase/supabase-js';
import type { FeedbackValue } from '@/lib/chat-feedback';
import { getMessageText } from '@/lib/chat-memory';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

type FeedbackRequest = {
  assistantMessage?: {
    id?: string;
    parts?: Array<{ type: string; text?: string }>;
    role?: 'assistant';
  };
  feedback?: FeedbackValue | null;
  sessionId?: string;
};

export async function POST(request: Request) {
  if (!supabase) {
    return Response.json({ error: 'Supabase is not configured.' }, { status: 500 });
  }

  const { assistantMessage, feedback, sessionId } = (await request.json()) as FeedbackRequest;
  const assistantResponse =
    assistantMessage && assistantMessage.role === 'assistant'
      ? getMessageText(assistantMessage as never)
      : '';

  if (!sessionId || !assistantResponse) {
    return Response.json({ error: 'sessionId and assistant response are required.' }, { status: 400 });
  }

  const { data: memory, error: selectError } = await supabase
    .from('chat_memories')
    .select('id, metadata')
    .eq('session_id', sessionId)
    .eq('assistant_response', assistantResponse)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    console.error('chat feedback select failed', selectError);
    return Response.json({ error: selectError.message }, { status: 500 });
  }

  if (!memory) {
    return Response.json({ error: 'Chat memory not found for feedback.' }, { status: 404 });
  }

  const nextMetadata = {
    ...((memory.metadata as Record<string, unknown> | null) ?? {}),
    feedback,
    feedbackUpdatedAt: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from('chat_memories')
    .update({ is_favorite: feedback === 'up', metadata: nextMetadata })
    .eq('id', memory.id);

  if (updateError) {
    console.error('chat feedback update failed', updateError);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ ok: true, feedback, id: memory.id, isFavorite: feedback === 'up' });
}
