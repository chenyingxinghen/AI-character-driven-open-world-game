-- Create database
CREATE DATABASE ai_narrative_game;

-- Connect to database
\c ai_narrative_game;

-- Create tables
CREATE TABLE IF NOT EXISTS game_sessions (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    player_id VARCHAR(36),
    game_state JSONB
);

CREATE TABLE IF NOT EXISTS characters (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_sessions(id),
    name VARCHAR(100) NOT NULL,
    personality JSONB,
    background TEXT,
    current_location VARCHAR(100),
    emotional_state JSONB,
    is_active BOOLEAN DEFAULT true,
    character_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_memories (
    id VARCHAR(36) PRIMARY KEY,
    character_id VARCHAR(36) REFERENCES characters(id),
    session_id VARCHAR(36) REFERENCES game_sessions(id),
    content TEXT NOT NULL,
    emotional_weight NUMERIC(3,2),
    associated_characters TEXT[],
    tags TEXT[],
    memory_type VARCHAR(20) CHECK (memory_type IN ('dialogue', 'observation', 'action')),
    significance INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_sessions(id),
    character_id VARCHAR(36) REFERENCES characters(id),
    message_type VARCHAR(20) CHECK (message_type IN ('player_input', 'character_response', 'narration', 'system_message')),
    content TEXT NOT NULL,
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS character_relationships (
    id VARCHAR(36) PRIMARY KEY,
    character_id VARCHAR(36) REFERENCES characters(id),
    target_character_id VARCHAR(36) REFERENCES characters(id),
    relationship_type VARCHAR(50),
    strength NUMERIC(3,2),
    relationship_data JSONB,
    session_id VARCHAR(36) REFERENCES game_sessions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS story_events (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_sessions(id),
    event_type VARCHAR(50),
    description TEXT,
    location VARCHAR(100),
    involved_characters TEXT[],
    impact_level INTEGER,
    story_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_characters_session_id ON characters(session_id);
CREATE INDEX IF NOT EXISTS idx_character_memories_character_id ON character_memories(character_id);
CREATE INDEX IF NOT EXISTS idx_character_memories_session_id ON character_memories(session_id);
CREATE INDEX IF NOT EXISTS idx_character_memories_created_at ON character_memories(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_character_id ON conversations(character_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_character_relationships_character_id ON character_relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_session_id ON character_relationships(session_id);
CREATE INDEX IF NOT EXISTS idx_story_events_session_id ON story_events(session_id);
CREATE INDEX IF NOT EXISTS idx_story_events_created_at ON story_events(created_at);