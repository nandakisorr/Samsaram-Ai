import React from 'react';
import { motion } from 'framer-motion';
import type { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm backdrop-blur-sm border transition-all duration-200 ${
          isUser
            ? 'bg-blue-500/20 dark:bg-blue-600/30 text-white border-blue-500/30 dark:border-blue-600/40'
            : 'bg-white/10 dark:bg-gray-800/20 text-gray-800 dark:text-gray-200 border-white/20 dark:border-gray-700/30'
        }`}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
        <p className={`text-xs mt-1 ${isUser ? 'text-blue-200/70' : 'text-gray-500/70'}`}>
          {new Date(message.time).toLocaleTimeString()}
        </p>
      </div>
    </motion.div>
  );
};