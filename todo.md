# Sales Reply Coach - Project TODO

## Core Features

- [x] User authentication with account creation
- [x] Dashboard layout with sidebar navigation
- [x] Screenshot upload with OCR text extraction
- [x] Direct text paste input for conversations
- [x] Video URL upload for knowledge base
- [x] PDF document upload for knowledge base
- [x] Knowledge base management UI (view/delete items)
- [x] AI-powered reply suggestion engine
- [x] Context-aware conversation analysis (objections, tone, referrals)
- [x] Conversation history storage and display
- [x] User profile settings (sales style, industry, product, tone)

## Database Schema

- [x] Users table (extended with profile fields)
- [x] Knowledge base items table (videos, PDFs)
- [x] Conversations table
- [x] Suggestions table

## UI Pages

- [x] Landing page (unauthenticated)
- [x] Main conversation assistant page
- [x] Knowledge base management page
- [x] Conversation history page
- [x] Profile settings page

## Enhancements

- [x] Loading states and error handling
- [x] Mobile responsive design
- [x] Toast notifications for actions

## New Features (v2)

- [x] Friend/Expert Mode toggle in conversation coach
- [x] "What I Learned" summary for knowledge base items
- [x] Conversation buyer/prospect tagging

## New Features (v3)

- [x] Change "Add Video" to "Add URL" (YouTube/Instagram support with video transcription)
- [x] Conversation threading (follow-up messages within existing conversations)
- [x] Success tracking (won/lost status and conversion rate analytics)

## Major Rebuild (v4) - WhatsApp-Style Sales CRM

### Database Schema Redesign
- [x] Workspaces table (niche-based user profiles)
- [x] Prospects table (buyer profiles with social links)
- [x] Chat messages table (WhatsApp-style conversation threads)
- [x] Update knowledge base to support deep learning storage

### Workspace/Niche Management
- [x] Create workspace with niche name
- [x] Add user's own IG/TikTok/store URL to workspace
- [x] Option to type niche description if no social media
- [x] Switch between workspaces easily

### WhatsApp-Style Chat UI
- [x] Sidebar with list of prospects (like WhatsApp contacts)
- [x] Chat thread view for each prospect
- [x] Upload screenshots directly into chat
- [x] AI responses appear in chat thread
- [x] Create new chat for new prospects

### Prospect Profile Analysis
- [x] Paste prospect's Instagram URL for analysis
- [x] Paste prospect's TikTok URL for analysis
- [x] Paste prospect's store/website URL for analysis
- [x] AI analyzes profile to suggest first message
- [x] Save prospect with name and profile info

### Deep Knowledge Learning
- [x] PDF: Read entire book page by page, understand everything
- [x] Video: Watch and understand full content (not just objections)
- [x] Learn: sales psychology, rapport building, conversation starters, closing techniques
- [x] Store all learned knowledge persistently
- [x] AI continuously improves based on absorbed knowledge
- [x] Show detailed "What I Learned" summary

### AI Integration
- [x] AI uses workspace profile (your products/niche) in responses
- [x] AI uses all knowledge base content in conversations
- [x] AI suggests first messages based on prospect analysis
- [x] AI adapts responses based on conversation stage

## Bug Fixes

- [x] Fix /dashboard route returning 404 error
- [x] Fix workspace.getActive returning undefined instead of null
- [x] Fix LLM invoke 500 error when processing knowledge base content
- [x] Fix HTML error response handling when LLM API returns error page

## New Features (v5)

- [x] Convert web app to Progressive Web App (PWA)
- [x] Add PWA manifest file
- [x] Add service worker for offline support
- [x] Add install prompt for mobile users

## Bug Fixes (v5)

- [x] Fix stuck "processing" status for knowledge base uploads

## Major Enhancement (v6) - Smart Knowledge Base

### Knowledge Base Intelligence
- [x] Research RAG (Retrieval Augmented Generation) best practices
- [x] Implement proper content extraction and chunking from PDFs/videos
- [x] Store extracted knowledge in searchable format
- [x] Ensure AI actually retrieves and uses knowledge in responses
- [x] Add AI intelligence level indicator (show learning progress)
- [x] Display what the AI has learned from each source

### Conversation Import Feature
- [x] Add "Import Conversation" option for prospects who seen but not replied
- [x] Upload full conversation history for context
- [x] AI analyzes conversation to understand where to re-engage
- [x] Suggest re-engagement messages based on conversation history
