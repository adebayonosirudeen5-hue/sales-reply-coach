import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);

const migrations = [
  // Create workspaces table
  `CREATE TABLE IF NOT EXISTS workspaces (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    name VARCHAR(256) NOT NULL,
    nicheDescription TEXT,
    instagramUrl TEXT,
    tiktokUrl TEXT,
    storeUrl TEXT,
    otherUrl TEXT,
    profileAnalysis TEXT,
    productsDetected TEXT,
    defaultReplyMode ENUM('friend', 'expert') DEFAULT 'friend',
    isActive BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
  )`,
  
  // Create prospects table
  `CREATE TABLE IF NOT EXISTS prospects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    workspaceId INT NOT NULL,
    userId INT NOT NULL,
    name VARCHAR(256) NOT NULL,
    instagramUrl TEXT,
    tiktokUrl TEXT,
    storeUrl TEXT,
    otherUrl TEXT,
    profileAnalysis TEXT,
    detectedInterests TEXT,
    suggestedFirstMessage TEXT,
    conversationStage ENUM('first_contact', 'warm_rapport', 'pain_discovery', 'objection_resistance', 'trust_reinforcement', 'referral_to_expert', 'expert_close') DEFAULT 'first_contact',
    replyMode ENUM('friend', 'expert') DEFAULT 'friend',
    outcome ENUM('active', 'won', 'lost', 'ghosted') DEFAULT 'active',
    outcomeNotes TEXT,
    lastMessageAt TIMESTAMP NULL,
    unreadCount INT DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
  )`,
  
  // Create chat_messages table
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prospectId INT NOT NULL,
    userId INT NOT NULL,
    direction ENUM('inbound', 'outbound') NOT NULL,
    content TEXT NOT NULL,
    screenshotUrl TEXT,
    analysisContext ENUM('first_contact', 'warm_rapport', 'pain_discovery', 'objection_resistance', 'trust_reinforcement', 'referral_to_expert', 'expert_close', 'general'),
    detectedTone VARCHAR(64),
    reasoning TEXT,
    isAiSuggestion BOOLEAN DEFAULT FALSE,
    suggestionType ENUM('primary', 'alternative', 'soft', 'custom'),
    wasSent BOOLEAN DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  
  // Create ai_suggestions table
  `CREATE TABLE IF NOT EXISTS ai_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    messageId INT NOT NULL,
    prospectId INT NOT NULL,
    userId INT NOT NULL,
    suggestionText TEXT NOT NULL,
    suggestionType ENUM('primary', 'alternative', 'soft') DEFAULT 'primary' NOT NULL,
    whyThisWorks TEXT,
    pushyWarning TEXT,
    wasUsed BOOLEAN DEFAULT FALSE,
    feedback ENUM('helpful', 'not_helpful'),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  
  // Add new columns to knowledge_base_items
  `ALTER TABLE knowledge_base_items ADD COLUMN workspaceId INT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN fullContent TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN comprehensiveSummary TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN salesPsychology TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN rapportTechniques TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN conversationStarters TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN objectionFrameworks TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN closingTechniques TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN languagePatterns TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN emotionalTriggers TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN trustStrategies TEXT NULL`,
  `ALTER TABLE knowledge_base_items ADD COLUMN processingProgress INT DEFAULT 0`,
  `ALTER TABLE knowledge_base_items ADD COLUMN errorMessage TEXT NULL`,
];

console.log('Running migrations...');
for (const sql of migrations) {
  try {
    await connection.execute(sql);
    console.log('✓', sql.substring(0, 60) + '...');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⊘ Already exists:', sql.substring(0, 50) + '...');
    } else {
      console.error('✗ Error:', err.message);
    }
  }
}

await connection.end();
console.log('Done!');
