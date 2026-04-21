-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL,
  last_message_id UUID,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'text',
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participants ON chat_rooms USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message_at ON chat_rooms (last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages (room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_read ON chat_messages (is_read) WHERE is_read = FALSE;