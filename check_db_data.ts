import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'ai_narrative_game',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
});

async function checkData() {
    const sessionId = '876e1ed5-b7c8-4a7e-a7ed-be20b51172ef';
    const tables = [
        'game_sessions',
        'characters',
        'conversations',
        'character_memories',
        'character_relationships',
        'locations',
        'world_lore',
        'story_events'
    ];

    try {
        for (const table of tables) {
            const res = await pool.query(`SELECT COUNT(*) FROM ${table} WHERE ${table === 'game_sessions' ? 'id' : 'session_id'} = $1`, [sessionId]);
            console.log(`${table}: ${res.rows[0].count}`);
        }

        const convs = await pool.query(`SELECT * FROM conversations WHERE session_id = $1 ORDER BY created_at DESC LIMIT 10`, [sessionId]);
        console.log('\nRecent conversations:');
        convs.rows.forEach(c => console.log(`[${c.message_type}] ${c.content}`));

        const chars = await pool.query(`SELECT * FROM characters WHERE session_id = $1`, [sessionId]);
        console.log('\nCharacters:');
        chars.rows.forEach(c => console.log(`- ${c.name} (${c.id})`));

        const locs = await pool.query(`SELECT * FROM locations WHERE session_id = $1`, [sessionId]);
        console.log('\nLocations:');
        locs.rows.forEach(l => console.log(`- ${l.name} (${l.id})`));

    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

checkData();
