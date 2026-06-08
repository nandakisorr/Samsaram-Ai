# Chatbot Frontend

A modern, modular React frontend for an AI chatbot backend with text-to-speech (TTS) support. Built with a microservices-inspired architecture where each backend service has its own dedicated module.

## Architecture Overview

```
frontend/
├── src/
│   ├── core/                    # Shared core infrastructure
│   │   ├── api/                 # HTTP client (Axios) with interceptors
│   │   ├── types/               # Global TypeScript types
│   │   ├── utils/               # Token & audio utilities
│   │   └── providers/           # React context (AuthProvider)
│   │
│   ├── modules/                 # Feature modules (one per backend service)
│   │   ├── auth/                # Authentication (login/register/logout)
│   │   │   ├── components/      # LoginForm, LogoutButton
│   │   │   ├── services/        # authService (API calls)
│   │   │   ├── hooks/           # useAuth, useLogin, useLogout
│   │   │   └── types/
│   │   │
│   │   ├── chat/                # Chat messaging (streaming)
│   │   │   ├── components/      # ChatMessage, ChatInput, ChatContainer
│   │   │   ├── services/        # chatService (streaming generator)
│   │   │   ├── hooks/           # useChat (state management)
│   │   │   └── types/
│   │   │
│   │   ├── tts/                 # Text-to-Speech
│   │   │   ├── components/      # AudioPlayer, EmotionSelector, VoiceSelector
│   │   │   ├── services/        # ttsService (base64 audio)
│   │   │   ├── hooks/           # useTTS (playback control)
│   │   │   └── types/
│   │   │
│   │   └── history/             # Session history
│   │       ├── components/      # SessionList, SessionView
│   │       ├── services/        # historyService (CRUD)
│   │       ├── hooks/           # useHistory (state)
│   │       └── types/
│   │
│   ├── pages/                   # Page-level components
│   │   └── ChatPage.tsx         # Main chat page with TTS toggle
│   │
│   ├── styles/                  # Global styles
│   │   └── global.css
│   │
│   ├── App.tsx                  # Main app (routing, layout)
│   └── main.tsx                 # Entry point
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md                    # This file
```

## Tech Stack

- **React 18** + TypeScript
- **Vite** - Fast build tool with path aliases
- **React Router v6** - Client-side routing
- **Axios** - HTTP client with interceptors
- **Zustand** (optional) - State management (can replace Context)
- **CSS Modules** - Scoped styling

## Module Responsibilities

| Module   | Responsibility                        | Backend Endpoints                         |
|----------|---------------------------------------|-------------------------------------------|
| `auth`   | User registration, login, JWT storage | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| `chat`   | Send messages, streaming responses    | `POST /chat/message` (stream), `POST /chat/session` |
| `tts`    | Generate & play audio                 | `POST /chat/tts`                       |
| `history`| List & view sessions                  | `GET /chat/history`, `GET /chat/history/{id}`, `DELETE /chat/history/{id}` |

## Key Features

### 1. Modual Design
Each module is self-contained with:
- `services/` - API communication
- `hooks/` - Custom React hooks (business logic)
- `components/` - Reusable UI
- `types/` - TypeScript interfaces

### 2. Streaming Chat
The chat module uses async generators to stream text tokens as they arrive from OpenAI.

```typescript
for await (const chunk of sendMessageStream(sessionId, message)) {
  // chunk is a string token
  console.log(chunk);
}
```

### 3. TTS Integration
The TTS module:
- Converts base64 MP3 to playable audio
- Manages audio playback state (play/pause/stop)
- Emotion-based voice selection
- Automatic regeneration on emotion change

### 4. Auth Context
JWT token stored in localStorage, injected into all requests via Axios interceptor. Auto-login on page refresh.

## Getting Started

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure backend URL

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Or modify `vite.config.ts` to change the proxy target.

### 3. Start development server

```bash
npm run dev
```

Visit http://localhost:5173

## Usage Flow

### Authentication

1. User registers/logs in → receives JWT token
2. Token stored in localStorage
3. AuthProvider sets `isAuthenticated` state globally
4. All API requests auto-include `Authorization: Bearer <token>`

### Chat

1. On first load, `useChat` creates a new session via `POST /chat/session`
2. User types message → `onSend` calls `sendMessage`
3. If `tts: false` (default) → streaming response via `ReadableStream`
4. Messages accumulated in React state → rendered by `MessageList`

### TTS (Voice Response)

1. Toggle "Enable Voice Response" in chat UI
2. When assistant replies, `AudioPlayer` component appears
3. Click "Play" → calls `ttsService.generate(text, emotion)`
4. Receives base64 audio → converts to Blob URL → plays via `Audio` element

### History

1. Navigate to `/history`
2. `useHistory` fetches all sessions on mount
3. Click session → loads full message history
4. Delete button removes session

## API Response Patterns

### Streaming Text (Chat)
```
POST /api/
Content-Type: application/json
Authorization: Bearer <token>

{
  "session_id": 1,
  "message": "Hello",
  "tts": false,
  "emotion": "neutral"
}

Response: text/plain stream (chunks like "Hello", " how", " are", " you?")
```

### TTS JSON Response
```
POST /api/chat/tts
Response: application/json

{
  "text": "Hello, how are you?",
  "audio": "//PkxABhnDn8...",
  "format": "mp3",
  "voice": "nova",
  "emotion": "cheerful",
  "speed": 1.1
}
```

## Customization

### Adding a New Emotion
Edit `modules/tts/types/index.ts`:
```typescript
export const EMOTION_OPTIONS = [
  { value: 'excited', label: 'Excited', voice: 'shimmer', speed: 1.2 },
  // ...
];
```

### Changing Backend URL
Update `vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://your-backend.com',  // ← change this
  },
}
```

### Extending a Module
Each module follows the same pattern:

1. Add new API method to `services/`
2. Create custom hook in `hooks/` (optional)
3. Build component in `components/`
4. Export from module `index.ts`

## Troubleshooting

**CORS errors**: Backend CORS is configured via the `ALLOWED_ORIGINS` environment variable. Add your frontend URL to the allowed origins list in the backend `.env` file and restart the backend.

**401 Unauthorized**: Token expired → logout & re-login  
**Module not found**: Check `tsconfig.json` path aliases match your folder structure  
**Audio not playing**: Verify backend returns base64 audio, check browser console for decode errors  

## Deployment

1. Build the frontend:
```bash
npm run build
```
Output goes to `dist/` folder.

2. Deploy `dist/` to any static hosting service (Vercel, Netlify, GitHub Pages, etc.)

3. Set environment variables:
   - **Frontend**: Set `VITE_API_URL` to your production backend URL (e.g., `https://api.yourapp.com` or `/api` if same domain)
   - **Backend**: Set `ALLOWED_ORIGINS` to include your deployed frontend URL(s)

4. For production, ensure backend CORS allows your frontend domain via `ALLOWED_ORIGINS` env var and is reachable publicly.

## Environment Configuration

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://127.0.0.1:8000  # Change to your backend URL
```

**Backend** (root `.env`):
```env
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-domain.com
```

## License

MIT
