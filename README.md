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

## Future Enhancements

- Custom user "handles" (temporary nicknames)
- Text formatting and emoji support
- Image sharing capabilities
- Dark/light mode toggle
- Mobile app versions
