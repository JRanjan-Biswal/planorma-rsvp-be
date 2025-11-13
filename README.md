# Planorama Backend API

Express.js backend API for the Planorama RSVP application with MongoDB and JWT authentication.

## Features

- 🔐 JWT-based authentication
- 📝 Event management (CRUD operations)
- ✅ RSVP management
- 🎫 Token-based event invitations
- 🔒 Role-based access control (Admin/User)
- ⚡ Rate limiting
- 🛡️ Input validation with Zod
- 📊 MongoDB with Mongoose

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Validation**: Zod
- **Rate Limiting**: express-rate-limit
- **TypeScript**: Full type safety

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # MongoDB connection
│   ├── models/
│   │   ├── User.ts              # User model
│   │   ├── Event.ts             # Event model
│   │   ├── RSVP.ts              # RSVP model
│   │   └── Token.ts              # Token model
│   ├── routes/
│   │   ├── auth.ts               # Authentication routes
│   │   ├── events.ts             # Event routes
│   │   ├── rsvps.ts              # RSVP routes
│   │   └── tokens.ts             # Token routes
│   ├── middleware/
│   │   ├── auth.ts               # Authentication middleware
│   │   ├── errorHandler.ts       # Error handling middleware
│   │   └── rateLimiter.ts        # Rate limiting middleware
│   └── server.ts                 # Express app entry point
├── package.json
└── tsconfig.json
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - Login user
- `POST /api/auth/signup` - Sign up new user
- `GET /api/auth/me` - Get current user

### Events

- `GET /api/events` - Get all events (admin only)
- `GET /api/events/:id` - Get event by ID (admin only)
- `POST /api/events` - Create event (admin only)

### RSVPs

- `GET /api/rsvps/:eventId` - Get RSVP for event (admin only)
- `POST /api/rsvps/:eventId` - Create/update RSVP (admin only)
- `GET /api/rsvps/event/:eventId/all` - Get all RSVPs for event (admin only)

### Tokens

- `GET /api/tokens/:eventId` - Get all tokens for event (admin only)
- `POST /api/tokens/:eventId` - Create token for event (admin only)
- `GET /api/tokens/token/:token` - Get event by token (public)

## Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file with your configuration

3. Start development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## Database Models

### User
- `email` (String, unique, required)
- `password` (String, required, hashed)
- `role` (Enum: 'user' | 'admin', default: 'user')

### Event
- `title` (String, required)
- `description` (String, optional)
- `date` (Date, required)
- `location` (String, required)
- `category` (String, required)
- `capacity` (Number, required)
- `createdBy` (ObjectId, ref: User)

### RSVP
- `eventId` (ObjectId, ref: Event)
- `userId` (ObjectId, ref: User)
- `status` (Enum: 'going' | 'maybe' | 'not-going')

### Token
- `eventId` (ObjectId, ref: Event)
- `email` (String, required)
- `name` (String, optional)
- `token` (String, unique, required)

## Security Features

- JWT token authentication
- Password hashing with bcrypt
- Rate limiting on all endpoints
- Input validation with Zod
- Error handling middleware
- CORS configuration
- MongoDB injection prevention (Mongoose)

## Error Handling

The API uses a centralized error handler that:
- Handles Zod validation errors
- Handles MongoDB duplicate key errors
- Handles JWT errors
- Returns appropriate HTTP status codes
- Provides error messages without exposing sensitive information

## Rate Limiting

- Authentication endpoints: 5 requests per 15 minutes
- API endpoints: 100 requests per 15 minutes
- RSVP endpoints: 20 requests per minute

## License

This project is created for the Planorama interview assignment.

