# Chatbot Frontend - Microservices Modular Architecture

## Architecture Overview

This frontend follows a **modular/microservices-inspired architecture** where each backend service (Auth, Chat, TTS, History) has its own dedicated module with:

- **Services** - API communication layer
- **Components** - Reusable UI elements
- **Hooks** - Custom React hooks for state logic
- **Types** - TypeScript interfaces
- **Utils** - Shared utilities

## Module Structure

```
src/
├── core/                 # Shared core functionality
│   ├── api/             # Base HTTP client, interceptors
│   ├── types/           # Global TypeScript types
│   ├── utils/           # Shared utilities (token, storage)
│   └── providers/       # React context providers
├── modules/             # Feature modules (one per backend service)
│   ├── auth/           # Authentication module
│   │   ├── components/ # LoginForm, LogoutButton
│   │   ├── services/   # authService
│   │   ├── hooks/      # useAuth, useLogin, useLogout
│   │   ├── types/      # Auth-specific types
│   │   └── index.ts    # Module exports
│   ├── chat/           # Chat module
│   │   ├── components/ # ChatMessage, ChatInput, MessageList
│   │   ├── services/   # chatService
│   │   ├── hooks/      # useChat, useSendMessage
│   │   └── types/
│   ├── tts/            # Text-to-Speech module
│   │   ├── components/ # AudioPlayer, VoiceSelector
│   │   ├── services/   # ttsService
│   │   ├── hooks/      # useTTS
│   │   └── types/
│   └── history/        # Session history module
│       ├── components/ # SessionList, MessageHistory
│       ├── services/   # historyService
│       ├── hooks/      # useHistory
│       └── types/
├── App.tsx             # Main app with routing
├── main.tsx            # Entry point
└── styles/             # Global styles
```

## Design Principles

1. **Separation of Concerns**: Each module is independent and self-contained
2. **Single Responsibility**: Each module handles ONE backend service
3. **Loose Coupling**: Modules communicate via props/events, not direct imports
4. **Reusability**: Shared code lives in `core/`
5. **Scalability**: Easy to add new modules or replace existing ones

## Communication Patterns

- **Auth Module**: Provides JWT token via React Context → other modules use it
- **Chat Module**: Streaming text responses via SSE/ReadableStream
- **TTS Module**: Base64 audio → decoded to Blob URL for playback
- **History Module**: RESTful GET requests for session/message data

## Technology Stack

- **React 18+** with TypeScript
- **Vite** for fast builds
- **React Router** for navigation
- **Zustand** or **Context API** for state management
- **Axios** for HTTP requests
- **TailwindCSS** for styling
