# StudyNook Server

Express API for the StudyNook library study room booking platform.

## Setup

1. Copy `.env.example` to `.env` and fill in values.
2. Install dependencies: `npm install`
3. Run development server: `npm run dev`
4. Production: `npm start`

## Environment variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `CLIENT_URL` | Frontend URL for CORS and OAuth redirect |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL |

## API overview

### Auth
- `POST /api/auth/register` — Register with email/password
- `POST /api/auth/login` — Login, sets httpOnly `token` cookie
- `POST /api/auth/logout` — Clear cookie (requires auth)
- `GET /api/auth/me` — Current user profile
- `GET /api/auth/google` — Google OAuth
- `GET /api/auth/google/callback` — OAuth callback

### Rooms
- `GET /api/rooms/latest` — Latest 6 rooms (home page)
- `GET /api/rooms?search=&amenities=&minRate=&maxRate=` — List with filters
- `GET /api/rooms/mine` — Owner listings (auth)
- `GET /api/rooms/:id` — Room details
- `POST /api/rooms` — Create room (auth)
- `PUT /api/rooms/:id` — Update room (auth, owner)
- `DELETE /api/rooms/:id` — Delete room (auth, owner)

### Bookings
- `GET /api/bookings/mine` — User bookings with room data (auth)
- `POST /api/bookings` — Create booking with conflict check (auth)
- `PATCH /api/bookings/:id/cancel` — Cancel booking, `$pull` from user (auth)

## MongoDB collections

- `users` — name, email, passwordHash, photoUrl, googleId, bookingIds[]
- `rooms` — room details, ownerId, bookingCount
- `bookings` — roomId, userId, date, startTime, endTime, status

## Sample data

Create a user via `POST /api/auth/register`, then add rooms via the client or API.
