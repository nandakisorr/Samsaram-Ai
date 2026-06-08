# Frontend Setup Guide

## Prerequisites

- Node.js 18+ installed
- Backend server running on `http://127.0.0.1:8000` (or configured `VITE_API_URL`)
- Recent web browser

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Environment Variables

Create `.env` in the `frontend/` folder:

```env
VITE_API_URL=http://127.0.0.1:8000
```

**Note**: Vite requires `VITE_` prefix for env variables to be exposed to client code.

## Project Structure

```
src/
├── core/           # Shared (API client, types, utilities, context)
├── modules/        # Feature modules
│   ├── auth/      # Login/Register
│   ├── chat/      # Messaging with streaming
│   ├── tts/       # Text-to-speech player
│   └── history/   # Session management
├── pages/          # Page-level compositions
├── styles/         # Global CSS
```

Each module follows the **Service-Hook-Component** pattern:

```
module/
├── services/   # API calls (pure functions)
├── hooks/      # State + business logic (React hooks)
├── components/ # UI (reusable)
└── types/      # TypeScript definitions
```

## Available Scripts

| Command        | Description                           |
|----------------|---------------------------------------|
| `npm run dev`  | Start development server (hot reload) |
| `npm run build`| Build for production (outputs to `dist/`) |
| `npm run preview` | Preview production build locally   |
| `npm run lint` | Run ESLint (if configured)            |

## API Routes

The frontend expects these backend endpoints:

| Method | Endpoint                  | Module   | Description                  |
|--------|---------------------------|----------|------------------------------|
| POST   | `/auth/register`          | auth     | Create new user              |
| POST   | `/auth/login`             | auth     | Login → returns JWT token    |
| GET    | `/auth/me`                | auth     | Get current user (protected) |
| POST   | `/chat/session`           | chat     | Create new chat session      |
| POST   | `/chat/message`           | chat     | Send message (stream)        |
| GET    | `/chat/history`           | history  | List all sessions            |
| GET    | `/chat/history/{id}`      | history  | Get session messages         |
| DELETE | `/chat/history/{id}`      | history  | Delete session               |
| POST   | `/chat/tts`               | tts      | Generate speech audio        |

## Module Usage Examples

### Auth

```typescript
import { useLogin, useLogout } from '@/modules/auth';

function MyComponent() {
  const login = useLogin();
  const logout = useLogout();

  const handleLogin = async () => {
    await login({ username: 'user', password: 'pass' });
  };

  const handleLogout = async () => {
    await logout();
  };
}
```

### Chat (Streaming)

```typescript
import { useChat } from '@/modules/chat';

function ChatComponent() {
  const { messages, sendMessage, currentSessionId } = useChat();

  const handleSend = async (text: string) => {
    await sendMessage({
      sessionId: currentSessionId!,
      message: text,
      emotion: 'neutral',
      tts: false, // false = stream text
    });
  };
}
```

### TTS

```typescript
import { AudioPlayer } from '@/modules/tts';

function MyComponent({ text }: { text: string }) {
  return (
    <AudioPlayer
      text={text}
      autoPlay={false}
      onGenerating={() => console.log('Generating...')}
      onGenerated={() => console.log('Done')}
      onError={(err) => console.error(err)}
    />
  );
}
```

### History

```typescript
import { useHistory } from '@/modules/history';

function HistoryComponent() {
  const { sessions, fetchSessions, fetchSession, deleteSession } = useHistory();

  useEffect(() => {
    fetchSessions();
  }, []);
}
```

## Troubleshooting

**Module not found errors**  
Check that `tsconfig.json` paths match your folder structure. The `@` alias points to `src/`.

**401 Unauthorized**  
Make sure you've logged in. Token might have expired → re-login.

**CORS errors**  
Backend CORS is configured via the `ALLOWED_ORIGINS` environment variable in the backend `.env` file.  
Add your frontend URL to the allowed origins list (comma-separated):

```env
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-domain.com
```

The backend must be restarted after changing this value.

**Audio doesn't play**  
1. Verify backend returns base64 audio string  
2. Check browser console for decode errors  
3. Ensure audio format is MP3 (mime type `audio/mpeg`)

**Streaming not working**  
`ReadableStream` requires the backend to return `text/plain` with chunked transfer encoding. Confirm FastAPI endpoint uses `StreamingResponse`.

## Production Build

```bash
npm run build
```

Deploy the `dist/` folder to any static hosting service. Set `VITE_API_URL` to your production backend.

## Contributing

Follow the module pattern when adding new features:
1. Create module folder in `src/modules/your-module/`
2. Follow `services/` → `hooks/` → `components/` order
3. Export from module `index.ts`
4. Update this README
