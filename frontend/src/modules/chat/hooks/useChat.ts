import { useState, useCallback, useRef, useEffect } from 'react';
import { useLanguageStore } from '@/core/stores/languageStore';
import { useLLMStore } from '@/core/stores/llmStore';
import type { ChatMessage, ChatState, SendMessageParams, ChatResponseWithTTS } from '../types';
import type { SessionDetail } from '@/core/types';
import chatService from '../services/chatService';

export function useChat(initialSessionId?: number) {
  console.log('useChat: initializing hook', { initialSessionId });
  const [state, setState] = useState<ChatState>({
    messages: [],
    currentSessionId: initialSessionId || null,
    isLoading: false,
    isStreaming: false,
    isLoadingSession: false,
    error: null,
    currentText: '',
  });

  const selectedLanguage = useLanguageStore((state) => state.language);
  const { provider, model } = useLLMStore();

   const abortControllerRef = useRef<AbortController | null>(null);
   const existingAssistantIdsRef = useRef<Set<number>>(new Set());
   const prevAssistantCountRef = useRef(0);
   const mountedRef = useRef(true);

   // Cleanup on unmount
   useEffect(() => {
     return () => {
       mountedRef.current = false;
     };
   }, []);

    // Create a new session
    const createSession = useCallback(async () => {
      console.log('createSession: called');
      try {
        if (mountedRef.current) {
          setState(prev => ({ ...prev, isLoading: true, error: null }));
        }
        const session = await chatService.createSession();
        console.log('createSession: success', session);
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            currentSessionId: session.session_id,
            isLoading: false,
          }));
        }
        return session;
      } catch (error: any) {
        console.error('createSession: failed', error);
        if (mountedRef.current) {
          setState(prev => ({ ...prev, error: error.detail || error.message }));
        }
        return undefined;
      } finally {
        if (mountedRef.current) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    }, []);

     // Send message with streaming
     const sendMessage = useCallback(
       async (params: SendMessageParams) => {
         if (!state.currentSessionId) {
           throw new Error('No active session. Create one first.');
         }

         // Add user message to chat
         const userMsg: ChatMessage = {
           role: 'user',
           content: params.message,
           time: new Date().toISOString(),
         };

         if (mountedRef.current) {
           setState(prev => ({
             ...prev,
             messages: [...prev.messages, userMsg],
             isLoading: true,
             error: null,
             currentText: '',
           }));
         }

         try {
           // Track abort controller for cancellation detection
           abortControllerRef.current = new AbortController();

      if (params.tts) {
        // TTS mode - use non‑streaming endpoint to get full response + audio (reliable)
        console.log('sendMessage: TTS enabled, using non‑streaming endpoint');
        const result = await chatService.sendMessage(
          params.sessionId,
          params.message,
          params.emotion,
          true,
          params.language || 'en',
          provider,
          model
        ) as ChatResponseWithTTS;

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: result.text,
          time: new Date().toISOString(),
          audio: result.audio,
          voice: result.voice,
          emotion: result.emotion,
        };

        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            messages: [...prev.messages, assistantMsg],
            isStreaming: false,
            currentText: '',
            isLoading: false,
          }));
        }
        console.log('sendMessage: TTS message complete');
        return result;
      } else {
              // Streaming mode
              console.log('sendMessage: entering streaming mode, calling sendMessageStream...');
              if (mountedRef.current) {
                setState(prev => ({ ...prev, isStreaming: true }));
              }
              let fullText = '';

              let chunkCount = 0;
              for await (const chunk of chatService.sendMessageStream(
                params.sessionId,
                params.message,
                params.emotion,
                false,
                params.language || 'en',
                provider,
                model
              )) {
                // If stop was called, abortControllerRef is null -> break early
                if (!abortControllerRef.current) {
                  console.log('sendMessageStream: abortController cleared, stopping');
                  break;
                }
                chunkCount++;
                console.log(`sendMessageStream: chunk ${chunkCount}:`, JSON.stringify(chunk));
                fullText += chunk;
                if (mountedRef.current) {
                  setState(prev => ({ ...prev, currentText: fullText }));
                }
              }
              console.log(`sendMessageStream: finished after ${chunkCount} chunks, total length=${fullText.length}`);

             // Ensure the final currentText update is processed so TTS effects can run.
             await new Promise(resolve => setTimeout(resolve, 0));

             const assistantMsg: ChatMessage = {
               role: 'assistant',
               content: fullText,
               time: new Date().toISOString(),
             };

             if (mountedRef.current) {
               setState(prev => ({
                 ...prev,
                 messages: [...prev.messages, assistantMsg],
                 isStreaming: false,
                 currentText: '',
                 isLoading: false,
               }));
             }
             console.log('sendMessage: streaming done, state updated');

             return { text: fullText };
           }
         } catch (error: any) {
           // If aborted by user, don't show error
           if (error.name === 'AbortError' || error.message === 'AbortError' || (typeof error.message === 'string' && error.message.includes('abort'))) {
             console.log('Streaming aborted by user');
             if (mountedRef.current) {
               setState(prev => ({
                 ...prev,
                 isStreaming: false,
                 isLoading: false,
                 currentText: '',
               }));
             }
             return { text: '' };
           }
           if (mountedRef.current) {
             setState(prev => ({
               ...prev,
               error: error.detail || error.message,
               isLoading: false,
               isStreaming: false,
             }));
           }
           throw error;
         } finally {
           // Clear the abort controller ref
           abortControllerRef.current = null;
         }
       },
       [state.currentSessionId, provider, model]
     );

    // Stop streaming (if needed)
    const stopGeneration = useCallback(() => {
      // Abort the fetch request via chatService's controller
      chatService.stopGeneration();
      // Also clear our local ref to signal loop to exit
      abortControllerRef.current = null;
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isStreaming: false,
          isLoading: false,
        }));
      }
    }, []);

   // Clear error
   const clearError = useCallback(() => {
     if (mountedRef.current) {
       setState(prev => ({ ...prev, error: null }));
     }
   }, []);

   // Load existing session with streaming replay
   const loadSession = useCallback(async (sessionId: number) => {
     console.log('loadSession: streaming replay', sessionId);
     try {
       existingAssistantIdsRef.current.clear();
       if (mountedRef.current) {
         setState(prev => ({ ...prev, isLoading: true, error: null, isLoadingSession: true, messages: [] }));
       }
       let messages: ChatMessage[] = [];
       for await (const msg of chatService.streamSession(sessionId)) {
         const newMsg: ChatMessage = {
           role: msg.role as 'user' | 'assistant',
           content: msg.content,
           time: msg.time || new Date().toISOString(),
         };
         messages = [...messages, newMsg];
         if (mountedRef.current) {
           setState(prev => ({ ...prev, messages }));
         }
       }
       // Mark existing assistant messages to prevent TTS re-init
       const existingAssistantIndices = new Set<number>();
       messages.forEach((msg, idx) => {
         if (msg.role === 'assistant') existingAssistantIndices.add(idx);
       });
       existingAssistantIdsRef.current = existingAssistantIndices;
       // Set prev assistant count for new-message detection
       prevAssistantCountRef.current = messages.filter(m => m.role === 'assistant').length;
       if (mountedRef.current) {
         setState(prev => ({
           ...prev,
           currentSessionId: sessionId,
           isLoading: false,
           isLoadingSession: false,
         }));
       }
       const sessionDetail: SessionDetail = {
         session_id: sessionId,
         started_at: messages[0]?.time || new Date().toISOString(),
         messages: messages.map(m => ({ role: m.role, content: m.content, time: m.time })),
       };
       return sessionDetail;
     } catch (error: any) {
       console.error('loadSession: failed', error);
       if (mountedRef.current) {
         setState(prev => ({ ...prev, error: error.message || 'Failed to load session', isLoading: false, isLoadingSession: false }));
       }
       return undefined;
     }
   }, []);

   // Reset chat (new session)
   const resetChat = useCallback(() => {
     if (mountedRef.current) {
       setState({
         messages: [],
         currentSessionId: null,
         isLoading: false,
         isStreaming: false,
         isLoadingSession: false,
         error: null,
         currentText: '',
       });
     }
   }, []);

  // Delete a session
  const deleteSession = useCallback(async (sessionId: number) => {
    try {
      await chatService.deleteSession(sessionId);
      // If we deleted the current session, reset chat
      if (state.currentSessionId === sessionId) {
        resetChat();
      }
      return true;
    } catch (error: any) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }, [state.currentSessionId, resetChat]);

  return {
    ...state,
    selectedLanguage,
    sendMessage,
    createSession,
    loadSession,
    stopGeneration,
    clearError,
    resetChat,
    deleteSession,
  };
}

export default useChat;

