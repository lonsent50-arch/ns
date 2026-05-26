-- ============================================================
-- Novel Studio — 云端多用户隔离数据库架构（幂等版）
-- 可重复执行，不会因 Policy/Trigger 已存在而报错
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS — 自动从 auth.users 创建 profile
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    user_tier TEXT NOT NULL DEFAULT 'free' CHECK (user_tier IN ('free', 'basic', 'pro', 'premium', 'platinum')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, user_tier)
  VALUES (NEW.id, NEW.email, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- BOOKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '未命名项目',
    description TEXT DEFAULT '',
    genre TEXT DEFAULT '',
    tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_books_user_id ON books(user_id);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "books_select_own" ON public.books;
CREATE POLICY "books_select_own" ON public.books FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "books_insert_own" ON public.books;
CREATE POLICY "books_insert_own" ON public.books FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "books_update_own" ON public.books;
CREATE POLICY "books_update_own" ON public.books FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "books_delete_own" ON public.books;
CREATE POLICY "books_delete_own" ON public.books FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHAPTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT '新章节',
    content TEXT DEFAULT '',
    word_count INTEGER DEFAULT 0,
    source TEXT DEFAULT 'manual',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON chapters(user_id);

ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chapters_select_own" ON public.chapters;
CREATE POLICY "chapters_select_own" ON public.chapters FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "chapters_insert_own" ON public.chapters;
CREATE POLICY "chapters_insert_own" ON public.chapters FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "chapters_update_own" ON public.chapters;
CREATE POLICY "chapters_update_own" ON public.chapters FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "chapters_delete_own" ON public.chapters;
CREATE POLICY "chapters_delete_own" ON public.chapters FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHARACTERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gender TEXT DEFAULT '',
    age TEXT DEFAULT '',
    personality TEXT DEFAULT '',
    background TEXT DEFAULT '',
    goal TEXT DEFAULT '',
    appearance TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_characters_book_id ON characters(book_id);
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);

ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "characters_select_own" ON public.characters;
CREATE POLICY "characters_select_own" ON public.characters FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "characters_insert_own" ON public.characters;
CREATE POLICY "characters_insert_own" ON public.characters FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "characters_update_own" ON public.characters;
CREATE POLICY "characters_update_own" ON public.characters FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "characters_delete_own" ON public.characters;
CREATE POLICY "characters_delete_own" ON public.characters FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- OUTLINE NODES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.outline_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES outline_nodes(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    level INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_outline_nodes_book_id ON outline_nodes(book_id);
CREATE INDEX IF NOT EXISTS idx_outline_nodes_user_id ON outline_nodes(user_id);

ALTER TABLE public.outline_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outline_select_own" ON public.outline_nodes;
CREATE POLICY "outline_select_own" ON public.outline_nodes FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "outline_insert_own" ON public.outline_nodes;
CREATE POLICY "outline_insert_own" ON public.outline_nodes FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "outline_update_own" ON public.outline_nodes;
CREATE POLICY "outline_update_own" ON public.outline_nodes FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "outline_delete_own" ON public.outline_nodes;
CREATE POLICY "outline_delete_own" ON public.outline_nodes FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- PLOT THREADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plot_threads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    thread_type TEXT DEFAULT 'subplot',
    status TEXT DEFAULT 'active',
    start_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    end_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plot_threads_book_id ON plot_threads(book_id);
CREATE INDEX IF NOT EXISTS idx_plot_threads_user_id ON plot_threads(user_id);

ALTER TABLE public.plot_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plot_threads_select_own" ON public.plot_threads;
CREATE POLICY "plot_threads_select_own" ON public.plot_threads FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "plot_threads_insert_own" ON public.plot_threads;
CREATE POLICY "plot_threads_insert_own" ON public.plot_threads FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "plot_threads_update_own" ON public.plot_threads;
CREATE POLICY "plot_threads_update_own" ON public.plot_threads FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "plot_threads_delete_own" ON public.plot_threads;
CREATE POLICY "plot_threads_delete_own" ON public.plot_threads FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- WORLDBUILDING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.worldbuilding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    details JSONB DEFAULT '{}',
    sort_order REAL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_worldbuilding_book_id ON worldbuilding(book_id);
CREATE INDEX IF NOT EXISTS idx_worldbuilding_user_id ON worldbuilding(user_id);

ALTER TABLE public.worldbuilding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "worldbuilding_select_own" ON public.worldbuilding;
CREATE POLICY "worldbuilding_select_own" ON public.worldbuilding FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "worldbuilding_insert_own" ON public.worldbuilding;
CREATE POLICY "worldbuilding_insert_own" ON public.worldbuilding FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "worldbuilding_update_own" ON public.worldbuilding;
CREATE POLICY "worldbuilding_update_own" ON public.worldbuilding FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "worldbuilding_delete_own" ON public.worldbuilding;
CREATE POLICY "worldbuilding_delete_own" ON public.worldbuilding FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHAPTER SUMMARIES (RAG with long-context management)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chapter_summaries (
    chapter_id UUID PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    key_events JSONB DEFAULT '[]',
    character_states JSONB DEFAULT '{}',
    plot_threads JSONB DEFAULT '[]',
    generated_at TIMESTAMPTZ,
    word_count INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chapter_summaries_book_id ON chapter_summaries(book_id);
CREATE INDEX IF NOT EXISTS idx_chapter_summaries_user_id ON chapter_summaries(user_id);

ALTER TABLE public.chapter_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chapter_summaries_select_own" ON public.chapter_summaries;
CREATE POLICY "chapter_summaries_select_own" ON public.chapter_summaries FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "chapter_summaries_insert_own" ON public.chapter_summaries;
CREATE POLICY "chapter_summaries_insert_own" ON public.chapter_summaries FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "chapter_summaries_update_own" ON public.chapter_summaries;
CREATE POLICY "chapter_summaries_update_own" ON public.chapter_summaries FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "chapter_summaries_delete_own" ON public.chapter_summaries;
CREATE POLICY "chapter_summaries_delete_own" ON public.chapter_summaries FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- KEY EVENTS (cross-chapter tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.key_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    event_type TEXT DEFAULT 'event',
    involved_characters JSONB DEFAULT '[]',
    sort_order REAL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_key_events_book_id ON key_events(book_id);
CREATE INDEX IF NOT EXISTS idx_key_events_user_id ON key_events(user_id);

ALTER TABLE public.key_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "key_events_select_own" ON public.key_events;
CREATE POLICY "key_events_select_own" ON public.key_events FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "key_events_insert_own" ON public.key_events;
CREATE POLICY "key_events_insert_own" ON public.key_events FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "key_events_update_own" ON public.key_events;
CREATE POLICY "key_events_update_own" ON public.key_events FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "key_events_delete_own" ON public.key_events;
CREATE POLICY "key_events_delete_own" ON public.key_events FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHARACTER STATES (per-chapter snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.character_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    location TEXT DEFAULT '',
    status TEXT DEFAULT 'alive',
    emotional_state TEXT DEFAULT '',
    knowledge_gained TEXT DEFAULT '',
    relationships JSONB DEFAULT '{}',
    snapshot_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_character_states_book_id ON character_states(book_id);
CREATE INDEX IF NOT EXISTS idx_character_states_user_id ON character_states(user_id);

ALTER TABLE public.character_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "character_states_select_own" ON public.character_states;
CREATE POLICY "character_states_select_own" ON public.character_states FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "character_states_insert_own" ON public.character_states;
CREATE POLICY "character_states_insert_own" ON public.character_states FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "character_states_update_own" ON public.character_states;
CREATE POLICY "character_states_update_own" ON public.character_states FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "character_states_delete_own" ON public.character_states;
CREATE POLICY "character_states_delete_own" ON public.character_states FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHARACTER KNOWLEDGE (information isolation wall)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.character_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    known_names JSONB DEFAULT '[]',
    known_items JSONB DEFAULT '[]',
    known_events JSONB DEFAULT '[]',
    snapshot_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_character_knowledge_book_id ON character_knowledge(book_id);
CREATE INDEX IF NOT EXISTS idx_character_knowledge_user_id ON character_knowledge(user_id);

ALTER TABLE public.character_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "char_knowledge_select_own" ON public.character_knowledge;
CREATE POLICY "char_knowledge_select_own" ON public.character_knowledge FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "char_knowledge_insert_own" ON public.character_knowledge;
CREATE POLICY "char_knowledge_insert_own" ON public.character_knowledge FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "char_knowledge_update_own" ON public.character_knowledge;
CREATE POLICY "char_knowledge_update_own" ON public.character_knowledge FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "char_knowledge_delete_own" ON public.character_knowledge;
CREATE POLICY "char_knowledge_delete_own" ON public.character_knowledge FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- WRITING STATS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.writing_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    chars_added INTEGER DEFAULT 0,
    chars_deleted INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    sessions INTEGER DEFAULT 0,
    UNIQUE(book_id, date)
);
CREATE INDEX IF NOT EXISTS idx_writing_stats_book_id ON writing_stats(book_id);
CREATE INDEX IF NOT EXISTS idx_writing_stats_user_id ON writing_stats(user_id);

ALTER TABLE public.writing_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "writing_stats_select_own" ON public.writing_stats;
CREATE POLICY "writing_stats_select_own" ON public.writing_stats FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "writing_stats_insert_own" ON public.writing_stats;
CREATE POLICY "writing_stats_insert_own" ON public.writing_stats FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "writing_stats_update_own" ON public.writing_stats;
CREATE POLICY "writing_stats_update_own" ON public.writing_stats FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "writing_stats_delete_own" ON public.writing_stats;
CREATE POLICY "writing_stats_delete_own" ON public.writing_stats FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- WRITING GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.writing_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_type TEXT,
    target_value INTEGER,
    current_value INTEGER DEFAULT 0,
    deadline TEXT,
    is_active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_writing_goals_book_id ON writing_goals(book_id);
CREATE INDEX IF NOT EXISTS idx_writing_goals_user_id ON writing_goals(user_id);

ALTER TABLE public.writing_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "writing_goals_select_own" ON public.writing_goals;
CREATE POLICY "writing_goals_select_own" ON public.writing_goals FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "writing_goals_insert_own" ON public.writing_goals;
CREATE POLICY "writing_goals_insert_own" ON public.writing_goals FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "writing_goals_update_own" ON public.writing_goals;
CREATE POLICY "writing_goals_update_own" ON public.writing_goals FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "writing_goals_delete_own" ON public.writing_goals;
CREATE POLICY "writing_goals_delete_own" ON public.writing_goals FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHAPTER SNAPSHOTS (version history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chapter_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title TEXT,
    content TEXT,
    word_count INTEGER DEFAULT 0,
    snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chapter_snapshots_chapter ON chapter_snapshots(chapter_id, version);
CREATE INDEX IF NOT EXISTS idx_chapter_snapshots_user_id ON chapter_snapshots(user_id);

ALTER TABLE public.chapter_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chapter_snapshots_select_own" ON public.chapter_snapshots;
CREATE POLICY "chapter_snapshots_select_own" ON public.chapter_snapshots FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "chapter_snapshots_insert_own" ON public.chapter_snapshots;
CREATE POLICY "chapter_snapshots_insert_own" ON public.chapter_snapshots FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "chapter_snapshots_update_own" ON public.chapter_snapshots;
CREATE POLICY "chapter_snapshots_update_own" ON public.chapter_snapshots FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "chapter_snapshots_delete_own" ON public.chapter_snapshots;
CREATE POLICY "chapter_snapshots_delete_own" ON public.chapter_snapshots FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'general',
    topic TEXT DEFAULT '',
    source_tab TEXT DEFAULT 'chat',
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_book_id ON ai_conversations(book_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_conversations_select_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_select_own" ON public.ai_conversations FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "ai_conversations_insert_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_insert_own" ON public.ai_conversations FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "ai_conversations_update_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_update_own" ON public.ai_conversations FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "ai_conversations_delete_own" ON public.ai_conversations;
CREATE POLICY "ai_conversations_delete_own" ON public.ai_conversations FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- AI MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON ai_messages(user_id);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_messages_select_own" ON public.ai_messages;
CREATE POLICY "ai_messages_select_own" ON public.ai_messages FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "ai_messages_insert_own" ON public.ai_messages;
CREATE POLICY "ai_messages_insert_own" ON public.ai_messages FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "ai_messages_update_own" ON public.ai_messages;
CREATE POLICY "ai_messages_update_own" ON public.ai_messages FOR UPDATE USING (user_id = auth.uid());
DROP POLICY IF EXISTS "ai_messages_delete_own" ON public.ai_messages;
CREATE POLICY "ai_messages_delete_own" ON public.ai_messages FOR DELETE USING (user_id = auth.uid());
