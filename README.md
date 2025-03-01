# RetroChat

A secure retro-styled chat application built with Node.js, Express, and React with modern security features.

## Project Overview

RetroChat is an online chat application that provides users with a nostalgic, retro-styled interface while incorporating robust security and privacy features. The platform includes user authentication, channel-based communication, private messaging, and comprehensive content moderation.

## Key Features

- **User Authentication**: Secure registration and login with JWT authentication
- **Two-Factor Authentication**: Additional security with 2FA support
- **Retro Aesthetic**: Visual design inspired by early internet chat rooms and BBS systems
- **Real-time Messaging**: Instant message delivery using WebSockets
- **Channel-based Conversations**: Multiple chat rooms/channels for different topics
- **Private Messaging**: Secure direct messaging between users
- **Content Moderation**: Built-in system to filter inappropriate content and promote a safe environment
- **Message Editing and Deletion**: Users can edit or delete their messages within a time window
- **Image Sharing**: Secure image uploads with content moderation
- **Markdown Support**: Basic formatting for chat messages
- **Responsive Design**: Works on desktop and mobile devices
- **Security Auditing**: Comprehensive security logging and monitoring

## Technology Stack

- **Frontend**: React, Styled Components, Socket.io client
- **Backend**: Node.js, Express, JWT
- **Real-time Communication**: Socket.io
- **Database**: MongoDB (for message and user storage)
- **Security**: Helmet, CSRF protection, XSS protection, Rate limiting
- **Email**: Nodemailer for email verification and notifications

## Project Structure

```
retrochat/
├── client/                  # React frontend
│   ├── public/              # Static files
│   └── src/                 # React source code
│       ├── components/      # Reusable UI components
│       ├── context/         # React context providers
│       ├── screens/         # Page components
│       └── utils/           # Utility functions
└── server/                  # Node.js/Express backend
    ├── config/              # Configuration files
    ├── middleware/          # Express middleware
    ├── models/              # MongoDB data models
    ├── routes/              # API routes
    ├── uploads/             # Image upload directory
    ├── utils/               # Utility functions
    └── validators/          # Input validation
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
4. Create environment files (see configuration section below)

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

### Configuration

#### Server Configuration

Create a `.env` file in the server directory with the following variables:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/retrochat
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# Email configuration 
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@example.com
EMAIL_PASSWORD=your_email_password
EMAIL_FROM=RetroChat <noreply@yourdomain.com>

# Development email (Ethereal)
ETHEREAL_EMAIL=your_ethereal_email
ETHEREAL_PASSWORD=your_ethereal_password

# Client URL for email links
CLIENT_URL=http://localhost:3000
```

For production, make sure to:
- Use strong, unique JWT secrets
- Set NODE_ENV=production
- Configure a proper MONGO_URI for your production database
- Set up real email credentials
- Update CLIENT_URL to your production domain

#### Client Configuration

Create a `.env` file in the client directory with the following variables:

```
REACT_APP_API_URL=http://localhost:5000
```

For production, set this to your API domain.

## Design Principles

- **Security**: Strong emphasis on data protection and user privacy
- **Performance**: Fast loading and message delivery
- **Nostalgia**: Visual and interactive elements that evoke the early internet era
- **Usability**: Intuitive interface with modern functionality

## Security Features

RetroChat includes comprehensive security measures:

- **JWT Authentication**: Secure stateless authentication using JSON Web Tokens
- **CSRF Protection**: Prevention of cross-site request forgery attacks
- **XSS Protection**: Content sanitization to prevent cross-site scripting
- **Rate Limiting**: Prevention of brute force and DoS attacks
- **Content Security Policy**: Restricted resource loading to prevent various attacks
- **Secure Headers**: Comprehensive security headers using Helmet
- **Input Validation**: Server-side validation of all user inputs
- **Two-Factor Authentication**: Additional security layer for user accounts
- **Security Logging**: Comprehensive audit logs for security-related events
- **Email Verification**: Account verification via email
- **Password Reset**: Secure password recovery workflow

## Content Moderation System

RetroChat includes a robust content moderation system to maintain a safe and welcoming environment:

### Moderation Features

- **Profanity Filtering**: Automatic detection and filtering of offensive language
- **Spam Detection**: Pattern recognition to prevent message flooding and repetitive content
- **Rate Limiting**: Prevention of excessive messaging from a single user
- **Message Reporting**: User-driven reporting of inappropriate content
- **Image Moderation**: Scanning of uploaded images for inappropriate content
- **Multi-level Moderation Actions**:
  - **Filter**: Replace offensive content with asterisks
  - **Block**: Prevent messages with severe violations from being sent
  - **Flag**: Mark suspicious content for review

### Moderation Workflow

1. **Automatic Moderation**: All messages and images pass through content filters before being broadcast
2. **User Reporting**: Any user can report problematic content via the UI
3. **Notification System**: Users are notified when their content is filtered or blocked
4. **Review System**: Flagged content can be reviewed by administrators

## Deployment

### Server Deployment

For production deployment:

1. Set NODE_ENV=production in your .env file
2. Configure a production MongoDB instance
3. Set up a proper email service (not Ethereal)
4. Set up SSL/TLS for secure connections
5. Consider using PM2 or similar for process management:
   ```
   npm install -g pm2
   cd server
   pm2 start index.js
   ```

### Client Deployment

For the React frontend:

1. Build the production version:
   ```
   cd client
   npm run build
   ```
2. Serve the build directory using Nginx, Apache, or a static hosting service

### Using Docker (optional)

The project can be containerized using Docker:

1. Create separate Dockerfiles for client and server
2. Use docker-compose for local development
3. For production, consider using Docker Swarm or Kubernetes for orchestration

## Future Enhancements

- Enhanced admin dashboard with analytics
- Customizable user profiles
- End-to-end encryption for private messages
- Voice and video chat capabilities
- Integration with third-party authentication providers
- Mobile app versions
- Offline support with PWA capabilities

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
