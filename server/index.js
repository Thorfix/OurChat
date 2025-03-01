const express = require('express');
const http = require('http');
const cors = require('cors');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db');
const Message = require('./models/Message');

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Simple route for API health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'RetroChat server is running' });
});

// Get messages for a specific room
app.get('/api/messages/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ room: roomId })
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json(messages.reverse());
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Join a chat room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  // Handle chat messages
  socket.on('send_message', async (data) => {
    const messageData = {
      content: data.content,
      sender: data.sender || 'anonymous',
      room: data.room,
      timestamp: new Date()
    };
    
    try {
      // Save message to database
      const message = new Message(messageData);
      const savedMessage = await message.save();
      
      // Broadcast the message to everyone in the room
      io.to(data.room).emit('receive_message', {
        content: data.content,
        sender: data.sender || 'anonymous',
        timestamp: new Date().toISOString(),
        id: savedMessage._id || Math.random().toString(36).substr(2, 9)
      });
    } catch (error) {
      console.error('Error saving message:', error);
      // Still emit the message even if there's an error saving to the database
      io.to(data.room).emit('receive_message', {
        content: data.content,
        sender: data.sender || 'anonymous',
        timestamp: new Date().toISOString(),
        id: Math.random().toString(36).substr(2, 9)
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Set up the port
const PORT = process.env.PORT || 5000;

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});