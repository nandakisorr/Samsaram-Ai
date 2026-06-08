# Chatbot Frontend - Project Summary

## Architecture: Modular Microservices-Inspired

A **modular monolith** frontend where each backend service (Auth, Chat, TTS, History) is encapsulated in its own standalone module. This mirrors the microservices architecture on the backend while keeping frontend complexity manageable.

### Module Pattern

Each module follows a **Service-Hook-Component** triad:

```
modules/[module-name]/
├── services/   # Pure functions, API communication
├── hooks/      # Custom React hooks (state + business logic)
├── components/ # Reusable UI, CSS Modules
└── types/      # TypeScript interfaces (module-specific)
```

**Benefits**: High cohesion, loose coupling, easy to test, reusable across pages.

## Completed Structure

```
frontend/
├── src/
│   ├── core/                      # Shared layer
│   │   ├── api/client.ts          # Axios instance + interceptors
│   │   ├── types/index.ts         # Global types (User, Message, etc.)
│   │   ├── utils/
│   │   │   ├── token.ts           # JWT storage + expiry checking
│   │   │   └── audio.ts           # Base64 ↔ Blob conversion utilities
│   │   └── providers/AuthProvider # React Context for auth state
│   │
│   ├── modules/
│   │   ├── auth/                  # ── Authentication Service ──
│   │   │   ├── services/authService.ts
│   │   │   ├── hooks/useAuth.ts
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   └── LogoutButton.tsx
│   │   │   └── types/
│   │   │
│   │   ├── chat/                  # ── Chat Messaging Service ──
│   │   │   ├── services/chatService.ts         # Streaming support
│   │   │   ├── hooks/useChat.ts                 # State machine
│   │   │   ├── components/
│   │   │   │   ├── ChatMessage.tsx
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   ├── ChatContainer.tsx
│   │   │   │   └── MessageList.tsx
│   │   │   └── types/
│   │   │
│   │   ├── tts/                   # ── Text-to-Speech Service ──
│   │   │   ├── services/ttsService.ts           # Base64 audio + playback
│   │   │   ├── hooks/useTTS.ts                  # Audio control state
│   │   │   ├── components/
│   │   │   │   ├── AudioPlayer.tsx              # Main player UI
│   │   │   │   ├── EmotionSelector.tsx          # Mood picker
│   │   │   │   └── VoiceSelector.tsx            # Voice picker
│   │   │   └── types/
│   │   │
│   │   └── history/               # ── Session History Service ──
│   │       ├── services/historyService.ts       # CRUD operations
│   │       ├── hooks/useHistory.ts              # State management
│   │       ├── components/
│   │       │   ├── SessionList.tsx              # Sidebar list
│   │       │   └── SessionView.tsx              # Message viewer
│   │       └── types/
│   │
│   ├── pages/                     # Page compositions
│   │   ├── ChatPage.tsx           # Chat UI + TTS toggle
│   │   └── index.ts
│   │
│   ├── styles/global.css          # Reset + base styles
│   ├── App.tsx                    # Router + layout
│   └── main.tsx                   # Entry point (AuthProvider wrapper)
│
├── package.json
├── vite.config.ts                 # Path aliases: @core, @modules, @pages
├── tsconfig.json
└── README.md                     # Full documentation
```

## Feature Highlights

### 1. Streaming Chat (SSE/ReadableStream)
```typescript
for await (const chunk of sendMessageStream(sessionId, "Hello")) {
  console.log(chunk);  // "Hello", " there!", " How", " are", " you?"
}
```

### 2. TTS with Emotion Mapping
```typescript
// Backend maps emotion → (voice, speed)
// EmotionSelector auto-regenerates audio on change
<AudioPlayer text="Hello!" emotion="cheerful" />
```

### 3. JWT Auth with Auto-Refresh
```typescript
// Axios interceptor adds token to every request
// Token expiry checked on app load → auto-logout
```

### 4. Session History
```typescript
// Fetch all sessions → click to view full messages
// Delete sessions with confirmation
```

## Data Flow

```
User Action
   ↓
Component (UI)
   ↓
Hook (state + logic)
   ↓
Service (API call)
   ↓
Axios (interceptor adds token)
   ↓
Backend
   ↓
Stream/JSON response
   ↓
Service parses → Hook updates state → Component re-renders
```

## API Contracts (TypeScript Types)

All backend responses typed in `core/types/`:

```typescript
interface ChatResponseWithTTS {
  text: string;
  audio: string;    // base64 MP3
  format: string;
  voice: string;
  emotion: string;
  speed: number;
}
```

## CSS Strategy

- **CSS Modules** (`.module.css`) for component-scoped styles
- No global namespace pollution
- BEM-like naming inside modules
- Global reset + base styles in `styles/global.css`

## Routing

```
/                 → ChatPage (protected, requires JWT)
/history          → Session history (protected)
/login            → LoginForm (public)
/register         → RegisterForm (public)
```

Protected routes redirect to `/login` if not authenticated.

## Build & Deploy

```bash
cd frontend
npm install
npm run build   # → dist/

# Deploy `dist/` to Vercel/Netlify/GitHub Pages
```

## Extensibility

To add a new feature module:

1. `src/modules/new-module/` with standard subfolders
2. Create `services/newService.ts`
3. Add custom hook `hooks/useNew.ts`
4. Add components under `components/`
5. Export from `modules/new-module/index.ts`
6. Use in pages: `import { useNew } from '@/modules/new-module'`

---

**Status**: All core modules (Auth, Chat, TTS, History) are fully implemented and ready for integration.
