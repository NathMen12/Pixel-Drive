import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const userSockets = new Map(); // userId -> Set(socketId)
const nodePresence = new Map(); // nodeId -> Map(userId -> { socketId, username, cursor })
const socketToUser = new Map(); // socketId -> userId

/**
 * Initialize Socket.io server
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.APP_URL,
      credentials: true,
    },
    path: '/socket.io',
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.sub;
      socket.username = decoded.username;
      socket.userRole = decoded.role;

      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    const username = socket.username;

    console.log(`🔌 Socket connected: ${username} (${socket.id})`);

    // Track user sockets
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);
    socketToUser.set(socket.id, userId);

    // Broadcast user online status
    socket.broadcast.emit('user:online', { userId, username });

    // Handle joining a node (folder/file) for presence
    socket.on('node:join', ({ nodeId }) => {
      if (!nodeId) return;

      socket.join(`node:${nodeId}`);

      if (!nodePresence.has(nodeId)) {
        nodePresence.set(nodeId, new Map());
      }

      nodePresence.get(nodeId).set(userId, {
        socketId: socket.id,
        username,
        cursor: { x: 0, y: 0 },
      });

      // Notify others in the node
      socket.to(`node:${nodeId}`).emit('presence:join', {
        userId,
        username,
      });

      // Send current presence list to the joining user
      const presentUsers = [];
      for (const [uid, data] of nodePresence.get(nodeId)) {
        if (uid !== userId) {
          presentUsers.push({ userId: uid, username: data.username });
        }
      }
      socket.emit('presence:list', { nodeId, users: presentUsers });
    });

    // Handle leaving a node
    socket.on('node:leave', ({ nodeId }) => {
      if (!nodeId) return;

      socket.leave(`node:${nodeId}`);

      if (nodePresence.has(nodeId)) {
        nodePresence.get(nodeId).delete(userId);

        // Notify others
        socket.to(`node:${nodeId}`).emit('presence:leave', { userId });

        // Clean up empty nodes
        if (nodePresence.get(nodeId).size === 0) {
          nodePresence.delete(nodeId);
        }
      }
    });

    // Handle cursor movement
    socket.on('cursor:move', ({ nodeId, x, y }) => {
      if (!nodeId) return;

      if (nodePresence.has(nodeId)) {
        const userData = nodePresence.get(nodeId).get(userId);
        if (userData) {
          userData.cursor = { x, y };
        }
      }

      // Broadcast to others in the node
      socket.to(`node:${nodeId}`).emit('cursor:move', {
        userId,
        username,
        x,
        y,
      });
    });

    // Handle typing indicator (for future collaborative editing)
    socket.on('typing:start', ({ nodeId }) => {
      if (nodeId) {
        socket.to(`node:${nodeId}`).emit('typing:start', { userId, username });
      }
    });

    socket.on('typing:stop', ({ nodeId }) => {
      if (nodeId) {
        socket.to(`node:${nodeId}`).emit('typing:stop', { userId });
      }
    });

    // Handle file operations broadcast
    socket.on('file:create', (data) => {
      socket.broadcast.emit('file:create', data);
    });

    socket.on('file:update', (data) => {
      socket.broadcast.emit('file:update', data);
    });

    socket.on('file:delete', (data) => {
      socket.broadcast.emit('file:delete', data);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Socket disconnected: ${username} (${socket.id}) - ${reason}`);

      // Remove from user sockets
      const userSocketSet = userSockets.get(userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          userSockets.delete(userId);
          // User fully disconnected
          io.emit('user:offline', { userId, username });
        }
      }

      socketToUser.delete(socket.id);

      // Remove from all node presence
      for (const [nodeId, users] of nodePresence) {
        if (users.has(userId)) {
          users.delete(userId);
          socket.to(`node:${nodeId}`).emit('presence:leave', { userId });

          if (users.size === 0) {
            nodePresence.delete(nodeId);
          }
        }
      }
    });
  });

  return io;
}

/**
 * Get online users
 * @returns {string[]} Array of online user IDs
 */
export function getOnlineUsers() {
  return Array.from(userSockets.keys());
}

/**
 * Check if user is online
 * @param {string} userId
 * @returns {boolean}
 */
export function isUserOnline(userId) {
  return userSockets.has(userId);
}

/**
 * Get presence for a node
 * @param {string} nodeId
 * @returns {Map} Map of userId -> presence data
 */
export function getNodePresence(nodeId) {
  return nodePresence.get(nodeId) || new Map();
}

/**
 * Emit event to all sockets of a user
 * @param {import('socket.io').Server} io
 * @param {string} userId
 * @param {string} event
 * @param {any} data
 */
export function emitToUser(io, userId, event, data) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit(event, data);
    }
  }
}

/**
 * Emit event to all users in a node
 * @param {import('socket.io').Server} io
 * @param {string} nodeId
 * @param {string} event
 * @param {any} data
 * @param {string} [excludeUserId] - User ID to exclude
 */
export function emitToNode(io, nodeId, event, data, excludeUserId = null) {
  const users = nodePresence.get(nodeId);
  if (users) {
    for (const [uid, userData] of users) {
      if (uid !== excludeUserId) {
        io.to(userData.socketId).emit(event, data);
      }
    }
  }
}

export default {
  initSocket,
  getOnlineUsers,
  isUserOnline,
  getNodePresence,
  emitToUser,
  emitToNode,
};