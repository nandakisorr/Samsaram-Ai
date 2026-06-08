import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage } from '../types';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';

interface MessageListProps {
  messages: ChatMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <motion.div
            key={message.time}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="transform-gpu"
          >
            <ChatMessageComponent message={message} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};