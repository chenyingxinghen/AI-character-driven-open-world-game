-- Create database
CREATE DATABASE ai_narrative_game;


-- Connect to database
\c ai_narrative_game;

-- Create tables in the correct order to handle dependencies
-- 1. First, create tables with no foreign key dependencies
CREATE TABLE IF NOT EXISTS game_sessions (
    id VARCHAR(36) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    player_id VARCHAR(36),
    game_state JSONB,
    is_active BOOLEAN DEFAULT true
);

-- 2. Create tables that depend on game_sessions
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

-- 3. Create remaining tables that have foreign key dependencies
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

-- 创建地点表
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    location_type VARCHAR(50),
    region_id VARCHAR(100),
    position_x NUMERIC(10,2),
    position_y NUMERIC(10,2),
    location_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建世界背景故事表
CREATE TABLE IF NOT EXISTS world_lore (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
    lore_type VARCHAR(50) NOT NULL, -- 'main_story', 'history', 'legend', 'culture', 'geography'
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    inspiration TEXT, -- 用户提供的灵感或空值表示随机生成
    generation_seed VARCHAR(100), -- 生成种子，用于重现生成过程
    metadata JSONB, -- 额外的元数据
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

-- 游戏模式相关表
-- 游戏会话模式表
CREATE TABLE IF NOT EXISTS game_mode_sessions (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
    mode_type VARCHAR(20) CHECK (mode_type IN ('free', 'script')) NOT NULL,
    config JSONB NOT NULL,
    state JSONB NOT NULL,
    player_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 故事大纲表
CREATE TABLE IF NOT EXISTS story_outlines (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    genre VARCHAR(50) NOT NULL,
    summary TEXT,
    acts JSONB NOT NULL, -- 存储章节信息
    characters JSONB, -- 存储角色信息
    locations JSONB, -- 存储地点信息
    themes TEXT[],
    estimated_duration INTEGER, -- 预估时长（分钟）
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 故事进展表
CREATE TABLE IF NOT EXISTS story_progress (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
    story_outline_id VARCHAR(36) REFERENCES story_outlines(id),
    current_act INTEGER DEFAULT 1,
    completed_plot_points TEXT[], -- 已完成的剧情点ID列表
    completion_percentage NUMERIC(5,2) DEFAULT 0,
    story_variables JSONB, -- 故事变量
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 偏离记录表
CREATE TABLE IF NOT EXISTS deviation_records (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
    player_action TEXT NOT NULL,
    expected_action TEXT NOT NULL,
    deviation_score NUMERIC(5,2) NOT NULL,
    current_plot_point VARCHAR(36),
    impact VARCHAR(20) CHECK (impact IN ('minor', 'moderate', 'major', 'critical')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 干预记录表
CREATE TABLE IF NOT EXISTS intervention_records (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
    intervention_type VARCHAR(50) NOT NULL,
    intensity VARCHAR(20) CHECK (intensity IN ('none', 'subtle', 'moderate', 'strong', 'forced')),
    trigger_reason TEXT,
    outcome VARCHAR(30) CHECK (outcome IN ('successful', 'partially_successful', 'failed')),
    effectiveness NUMERIC(5,2),
    player_reaction TEXT,
    notes TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 导演控制器表
CREATE TABLE IF NOT EXISTS director_controllers (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
    intervention_level INTEGER CHECK (intervention_level >= 0 AND intervention_level <= 100),
    deviation_tolerance INTEGER CHECK (deviation_tolerance >= 0 AND deviation_tolerance <= 100),
    total_interventions INTEGER DEFAULT 0,
    successful_interventions INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    cooldown_data JSONB, -- 存储各类型干预的冷却时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 动态内容缓存表（用于自由模式）
CREATE TABLE IF NOT EXISTS dynamic_content_cache (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_mode_sessions(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL, -- 'character', 'location', 'event', 'item'
    cache_key VARCHAR(200) NOT NULL,
    content_data JSONB NOT NULL,
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, cache_key)
);

-- 剧情大纲生成表
CREATE TABLE IF NOT EXISTS story_outlines_generated (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
    world_lore_ids TEXT[], -- 关联的世界背景ID列表
    story_outline JSONB NOT NULL, -- 完整的故事大纲
    core_elements JSONB NOT NULL, -- 核心元素（冲突、角色、地点等）
    context_mapping JSONB NOT NULL, -- 上下文映射
    validation_report JSONB NOT NULL, -- 验证报告
    generation_params JSONB, -- 生成参数
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 初始场景包表
CREATE TABLE IF NOT EXISTS initial_scene_packages (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
    story_outline_id VARCHAR(36) REFERENCES story_outlines_generated(id),
    starting_location JSONB NOT NULL, -- 起始位置信息
    nearby_characters JSONB NOT NULL, -- 附近角色列表
    immersive_description TEXT NOT NULL, -- 沉浸式描述
    player_guidance JSONB NOT NULL, -- 玩家指导信息
    environment_details JSONB NOT NULL, -- 环境细节
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 导演指引记录表
CREATE TABLE IF NOT EXISTS director_guidance_records (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) REFERENCES game_sessions(id) ON DELETE CASCADE,
    story_outline_id VARCHAR(36) REFERENCES story_outlines_generated(id),
    current_plot_point VARCHAR(100), -- 当前剧情点
    guidance_type VARCHAR(50) NOT NULL, -- 引导类型
    guidance_content TEXT NOT NULL, -- 引导内容
    player_deviation_score NUMERIC(5,2) DEFAULT 0, -- 玩家偏离度
    effectiveness_score NUMERIC(5,2), -- 效果评分
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
-- Ensure all tables are created before creating indexes
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
CREATE INDEX IF NOT EXISTS idx_locations_type ON locations(location_type);
CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region_id);
CREATE INDEX IF NOT EXISTS idx_world_lore_session_id ON world_lore(session_id);
CREATE INDEX IF NOT EXISTS idx_world_lore_type ON world_lore(lore_type);

-- 游戏模式相关索引
CREATE INDEX IF NOT EXISTS idx_game_mode_sessions_session_id ON game_mode_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_game_mode_sessions_mode_type ON game_mode_sessions(mode_type);
CREATE INDEX IF NOT EXISTS idx_story_outlines_genre ON story_outlines(genre);
CREATE INDEX IF NOT EXISTS idx_story_progress_session_id ON story_progress(session_id);
CREATE INDEX IF NOT EXISTS idx_story_progress_story_outline_id ON story_progress(story_outline_id);
CREATE INDEX IF NOT EXISTS idx_deviation_records_session_id ON deviation_records(session_id);
CREATE INDEX IF NOT EXISTS idx_deviation_records_created_at ON deviation_records(created_at);
CREATE INDEX IF NOT EXISTS idx_intervention_records_session_id ON intervention_records(session_id);
CREATE INDEX IF NOT EXISTS idx_intervention_records_applied_at ON intervention_records(applied_at);
CREATE INDEX IF NOT EXISTS idx_director_controllers_session_id ON director_controllers(session_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_content_cache_session_id ON dynamic_content_cache(session_id);
CREATE INDEX IF NOT EXISTS idx_dynamic_content_cache_content_type ON dynamic_content_cache(content_type);

-- 新增表的索引
CREATE INDEX IF NOT EXISTS idx_story_outlines_generated_session_id ON story_outlines_generated(session_id);
CREATE INDEX IF NOT EXISTS idx_story_outlines_generated_created_at ON story_outlines_generated(created_at);
CREATE INDEX IF NOT EXISTS idx_initial_scene_packages_session_id ON initial_scene_packages(session_id);
CREATE INDEX IF NOT EXISTS idx_initial_scene_packages_story_outline_id ON initial_scene_packages(story_outline_id);
CREATE INDEX IF NOT EXISTS idx_director_guidance_records_session_id ON director_guidance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_director_guidance_records_story_outline_id ON director_guidance_records(story_outline_id);
CREATE INDEX IF NOT EXISTS idx_director_guidance_records_applied_at ON director_guidance_records(applied_at);