import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('Creating knowledge_chunks table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      sourceId INT NOT NULL,
      category ENUM('opening_lines', 'rapport_building', 'pain_discovery', 'objection_handling', 'trust_building', 'closing_techniques', 'psychology_insight', 'language_pattern', 'emotional_trigger', 'general_wisdom') NOT NULL,
      content TEXT NOT NULL,
      triggerPhrases TEXT,
      usageExample TEXT,
      relevanceScore INT DEFAULT 50,
      brainType ENUM('friend', 'expert', 'both') DEFAULT 'both',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log('knowledge_chunks table created.');
  
  console.log('Creating ai_brain_stats table...');
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS ai_brain_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL UNIQUE,
      totalSources INT DEFAULT 0,
      totalChunks INT DEFAULT 0,
      categoryBreakdown JSON,
      intelligenceLevel INT DEFAULT 1,
      intelligenceTitle VARCHAR(64) DEFAULT 'Beginner',
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log('ai_brain_stats table created.');
  
  await connection.end();
  console.log('Migration complete!');
}

migrate().catch(console.error);
