import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChat } from '../hooks/useChat';
import { useLLMStore } from '@/core/stores/llmStore';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { ThemeSelector } from '@/modules/theme';

export const ChatContainer: React.FC = () => {
  const { messages, sendMessage, isLoading, isStreaming, resetChat, selectedLanguage, stopGeneration, currentSessionId } = useChat();
  const { provider, model } = useLLMStore();
  const [backgroundType, setBackgroundType] = useState<'gradient' | 'image'>('gradient');
  const [customImage, setCustomImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = useCallback((message: string) => {
    if (currentSessionId) {
      sendMessage({ sessionId: currentSessionId, message, language: selectedLanguage, provider, model });
    }
  }, [sendMessage, selectedLanguage, provider, model, currentSessionId]);

  const handleStop = useCallback(() => {
    stopGeneration();
  }, [stopGeneration]);

  const handleClearChat = useCallback(() => {
    resetChat();
  }, [resetChat]);

  return (
    <div className={`min-h-screen transition-colors duration-300 bg-gray-50 dark:bg-gray-900`}>
      {/* Background */}
      <div
        className={`fixed inset-0 transition-all duration-500 ${
          backgroundType === 'image' && customImage
            ? 'bg-cover bg-center'
            : ''
        }`}
        style={{
          backgroundImage: backgroundType === 'image' && customImage
            ? `url(${customImage})`
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backgroundBlendMode: 'overlay',
          backgroundColor: 'var(--overlay-color)',
        }}
      />

       <div className="relative z-10 min-h-screen flex flex-col">
         {/* Header */}
         <header className="p-4 border-b backdrop-blur-md bg-white/10 dark:bg-black/10 border-white/20 dark:border-gray-700/50">
           <div className="max-w-4xl mx-auto flex items-center justify-between">
             <button
               onClick={() => window.location.reload()}
               className="text-xl font-semibold text-white hover:text-blue-300 transition-colors cursor-pointer"
               title="Reload page"
             >
               Chat Assistant
             </button>
              <div className="flex items-center gap-3">
               <button
                 onClick={handleClearChat}
                 className="px-3 py-1.5 text-sm bg-red-500/20 hover:bg-red-500/30 text-white rounded-lg transition-colors border border-red-500/30"
               >
                 Clear
               </button>
               <ThemeSelector />
             </div>
          </div>
        </header>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col p-4">
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key="chat-area"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col"
              >
                <MessageList messages={messages} />

                {/* Typing Indicator */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-4 px-4"
                    >
                      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                        <div className="flex gap-1">
                          <motion.span
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0 }}
                            className="w-2 h-2 bg-current rounded-full inline-block"
                          />
                          <motion.span
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                            className="w-2 h-2 bg-current rounded-full inline-block"
                          />
                          <motion.span
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
                            className="w-2 h-2 bg-current rounded-full inline-block"
                          />
                        </div>
                        <span className="text-sm">Typing...</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

         {/* Floating Input Bar */}
         <footer className="p-4">
           <div className="max-w-4xl mx-auto">
             <ChatInput 
               onSend={handleSendMessage} 
               disabled={isLoading} 
               isGenerating={isStreaming}
               onStop={handleStop}
             />
           </div>
         </footer>
      </div>
    </div>
  );
};
