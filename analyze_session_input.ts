import * as dotenv from 'dotenv';
import { RealDatabaseService } from './src/services/database/RealDatabaseService';
import { DatabaseConfig } from './src/services/database/DatabaseService';

// Load environment variables
dotenv.config();

const config: DatabaseConfig = {
    postgres: {
        host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || process.env.DATABASE_PORT || '5432'),
        database: process.env.DB_NAME || process.env.DATABASE_NAME || 'ai_narrative_game',
        user: process.env.DB_USER || process.env.DATABASE_USER || 'postgres',
        password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD || '',
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: process.env.DB_SSL === 'true'
    }
};

async function analyze() {
    const db = new RealDatabaseService(config);
    try {
        console.log('Connecting to database...');
        await db.connect();
        const sessionId = '876e1ed5-b7c8-4a7e-a7ed-be20b51172ef';

        console.log(`Analyzing session: ${sessionId}`);

        // Get active characters in session
        const characters = await db.getSessionCharacters(sessionId);
        const characterMap = new Map(characters.map(c => [c.id, c.name]));

        console.log('\nActive Characters in Session:');
        characters.forEach(c => {
            console.log(`- ${c.name} (ID: ${c.id}) @ ${c.current_location}`);
        });

        // Get recent conversations
        // Note: getConversationHistory returns recent messages, likely ordered by created_at DESC
        // We want to see the context leading up to "Can I go to your house?"
        const history = await db.getConversationHistory(sessionId, 20);

        console.log('\nRecent Conversation History:');
        // Reverse to show chronological order
        [...history].reverse().forEach(msg => {
            const sender = msg.message_type === 'player_input' ? 'Player' : (characterMap.get(msg.character_id) || msg.character_id || 'System');
            console.log(`[${msg.created_at.toISOString()}] ${sender} (${msg.message_type}): ${msg.content}`);
        });

        // Get session info to see current location
        const session = await db.getSession(sessionId);
        if (session) {
            console.log(`\nCurrent Location: ${session.current_location}`);
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await db.disconnect();
    }
}

analyze();
