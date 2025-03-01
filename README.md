# RetroChat

A retro-styled anonymous chat forum built with Node.js, Express, and React.

## Project Overview

RetroChat is an online chat application that provides users with a nostalgic, retro-styled interface while maintaining complete anonymity. The platform allows users to engage in conversations without requiring registration, personal information, or persistent identities.

## Key Features

- **Complete Anonymity**: No registration, login, or personal information required
- **Retro Aesthetic**: Visual design inspired by early internet chat rooms and BBS systems
- **Real-time Messaging**: Instant message delivery using WebSockets
- **Channel-based Conversations**: Multiple chat rooms/channels for different topics
- **Ephemeral Messages**: Optional auto-deletion of messages after a configurable timeframe
- **Markdown Support**: Basic formatting for chat messages
- **Responsive Design**: Works on desktop and mobile devices
- **Content Moderation**: Built-in system to filter inappropriate content and promote a safe environment

## Technology Stack

- **Frontend**: React, CSS, Socket.io client
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **Database**: MongoDB (for message storage)

## Project Structure

```
retrochat/
├── client/             # React frontend
│   ├── public/         # Static files
│   └── src/            # React source code
└── server/             # Node.js/Express backend
    ├── config/         # Configuration files
    ├── controllers/    # Request handlers
    ├── models/         # Data models
    ├── routes/         # API routes
    └── socket/         # Socket.io event handlers
```

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn
- MongoDB (local or remote)

### Installation

1. Clone the repository
2. Install backend dependencies:
   ```
   cd server
   npm install
   ```
3. Install frontend dependencies:
   ```
   cd client
   npm install
   ```

### Running the Application

1. Start the backend server:
   ```
   cd server
   npm start
   ```
2. Start the frontend development server:
   ```
   cd client
   npm start
   ```
3. Access the application at `http://localhost:3000`

## Design Principles

- **Simplicity**: Easy to use interface with minimal learning curve
- **Performance**: Fast loading and message delivery
- **Nostalgia**: Visual and interactive elements that evoke the early internet era
- **Privacy**: No tracking, no personal data collection

## Content Moderation System

RetroChat includes a robust content moderation system to maintain a safe and welcoming environment while preserving user anonymity:

### Moderation Features

- **Profanity Filtering**: Automatic detection and filtering of offensive language
- **Spam Detection**: Pattern recognition to prevent message flooding and repetitive content
- **Rate Limiting**: Prevention of excessive messaging from a single user
- **Message Reporting**: User-driven reporting of inappropriate content
- **Multi-level Moderation Actions**:
  - **Filter**: Replace offensive content with asterisks
  - **Block**: Prevent messages with severe violations from being sent
  - **Flag**: Mark suspicious content for review

### Moderation Workflow

1. **Automatic Moderation**: All messages pass through content filters before being broadcast
2. **User Reporting**: Any user can report problematic messages via the UI
3. **Notification System**: Users are notified when their messages are filtered or blocked
4. **Review System**: Flagged messages can be reviewed by administrators

## Future Enhancements

- Custom user "handles" (temporary nicknames)
- Text formatting and emoji support
- Image sharing capabilities
- Dark/light mode toggle
- Mobile app versions
- Advanced moderation dashboard for administrators
- Integration with third-party content moderation APIs
