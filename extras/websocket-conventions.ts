/**
 * ============================================
 * WEBSOCKET CONVENTIONS
 * ============================================
 *
 * Nguyên tắc:
 * 1. NestJS Gateway — sử dụng @WebSocketGateway
 * 2. Authentication — verify JWT trên WebSocket handshake
 * 3. Rooms — group connections theo context (user, order, chat)
 * 4. Error handling — graceful error responses
 * 5. Reconnection — client-side retry logic
 * 6. Rate limiting — tránh spam messages
 */

// ═══════════════════════════════════════════
// Rule 1: NestJS WebSocket Gateway Setup
// ═══════════════════════════════════════════

// ❌ BAD: Raw WebSocket không structured
/*
const ws = new WebSocket.Server({ port: 8080 });
ws.on('connection', (socket) => {
  socket.on('message', (data) => {
    // Không validation, không auth, không error handling
    const parsed = JSON.parse(data.toString());
    // Process...
  });
});
*/

// ✅ GOOD: NestJS Gateway với proper structure
const gatewayExample = `
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);
  private readonly connectedUsers = new Map<string, string[]>(); // userId → socketIds

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.authenticateSocket(client);
      client.data.userId = user.id;

      // Track connection
      const existing = this.connectedUsers.get(user.id) || [];
      existing.push(client.id);
      this.connectedUsers.set(user.id, existing);

      // Join user-specific room
      client.join(\`user:\${user.id}\`);

      this.logger.log(\`Client connected: \${client.id} (user: \${user.id})\`);
    } catch (error) {
      this.logger.warn(\`Auth failed for \${client.id}: \${error.message}\`);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data.userId;
    if (userId) {
      const sockets = this.connectedUsers.get(userId) || [];
      const updated = sockets.filter(id => id !== client.id);
      if (updated.length === 0) {
        this.connectedUsers.delete(userId);
      } else {
        this.connectedUsers.set(userId, updated);
      }
    }
    this.logger.log(\`Client disconnected: \${client.id}\`);
  }

  private async authenticateSocket(client: Socket): Promise<{ id: string }> {
    const token = client.handshake.auth?.token
      || client.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) throw new Error('No token provided');
    return this.authService.verifyToken(token);
  }
}
`;

// ═══════════════════════════════════════════
// Rule 2: Event Handlers
// ═══════════════════════════════════════════

// ✅ GOOD: Typed event handlers
interface WsEvent<T = unknown> {
  event: string;
  data: T;
  timestamp: string;
}

interface ChatMessage {
  roomId: string;
  content: string;
  type: 'text' | 'image' | 'file';
}

interface TypingEvent {
  roomId: string;
  isTyping: boolean;
}

const eventHandlerExample = `
@SubscribeMessage('chat:send')
async handleChatMessage(
  @ConnectedSocket() client: Socket,
  @MessageBody(new ValidationPipe()) data: ChatMessageDto,
): Promise<WsResponse<ChatMessage>> {
  const userId = client.data.userId;

  // Validate user is in room
  const isMember = await this.chatService.isRoomMember(data.roomId, userId);
  if (!isMember) {
    throw new WsException('Not a member of this room');
  }

  // Save message
  const message = await this.chatService.saveMessage({
    roomId: data.roomId,
    senderId: userId,
    content: data.content,
    type: data.type,
  });

  // Broadcast to room (except sender)
  client.to(\`room:\${data.roomId}\`).emit('chat:message', {
    event: 'chat:message',
    data: message,
    timestamp: new Date().toISOString(),
  });

  // Return to sender (acknowledgment)
  return { event: 'chat:message', data: message };
}

@SubscribeMessage('chat:typing')
handleTyping(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: TypingDto,
): void {
  client.to(\`room:\${data.roomId}\`).emit('chat:typing', {
    userId: client.data.userId,
    isTyping: data.isTyping,
  });
}

@SubscribeMessage('room:join')
async handleJoinRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { roomId: string },
): Promise<void> {
  const userId = client.data.userId;
  const isMember = await this.chatService.isRoomMember(data.roomId, userId);
  if (!isMember) throw new WsException('Access denied');

  client.join(\`room:\${data.roomId}\`);
  client.to(\`room:\${data.roomId}\`).emit('room:user-joined', { userId });
}

@SubscribeMessage('room:leave')
handleLeaveRoom(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { roomId: string },
): void {
  client.leave(\`room:\${data.roomId}\`);
  client.to(\`room:\${data.roomId}\`).emit('room:user-left', {
    userId: client.data.userId,
  });
}
`;

// ═══════════════════════════════════════════
// Rule 3: Server-to-Client Push Notifications
// ═══════════════════════════════════════════

// ✅ GOOD: Push to specific user from service
const pushNotificationExample = `
@Injectable()
export class NotificationPushService {
  constructor(
    @Inject(forwardRef(() => NotificationGateway))
    private readonly gateway: NotificationGateway,
  ) {}

  // Push to specific user (across all their connected devices)
  notifyUser(userId: string, event: string, data: unknown): void {
    this.gateway.server
      .to(\`user:\${userId}\`)
      .emit(event, {
        data,
        timestamp: new Date().toISOString(),
      });
  }

  // Push to room
  notifyRoom(roomId: string, event: string, data: unknown): void {
    this.gateway.server
      .to(\`room:\${roomId}\`)
      .emit(event, { data });
  }

  // Broadcast to all connected users
  broadcast(event: string, data: unknown): void {
    this.gateway.server.emit(event, { data });
  }

  // Check if user is online
  isUserOnline(userId: string): boolean {
    const room = this.gateway.server.sockets.adapter.rooms.get(\`user:\${userId}\`);
    return !!room && room.size > 0;
  }
}

// Usage from OrderService:
@Injectable()
export class OrderService {
  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const order = await this.orderRepo.save({ id: orderId, status });

    // Push real-time update to buyer
    this.notificationPush.notifyUser(order.userId, 'order:updated', {
      orderId,
      status,
      message: \`Your order is now \${status}\`,
    });
  }
}
`;

// ═══════════════════════════════════════════
// Rule 4: Client-Side Reconnection
// ═══════════════════════════════════════════

// ✅ GOOD: Socket.IO client with auto-reconnect
const clientReconnectionExample = `
// Frontend (React/Vue/Angular)
import { io, Socket } from 'socket.io-client';

class WebSocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  connect(token: string): void {
    this.socket = io(process.env.WS_URL + '/notifications', {
      auth: { token },
      transports: ['websocket', 'polling'],   // WebSocket first, fallback to polling
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,            // Start with 1s
      reconnectionDelayMax: 30000,        // Max 30s
      timeout: 10000,                      // Connection timeout
    });

    this.socket.on('connect', () => {
      console.log('Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      // 'io server disconnect' → server kicked us, must reconnect manually
      if (reason === 'io server disconnect') {
        this.socket?.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      console.error(\`Connection error (attempt \${this.reconnectAttempts}):\`, error.message);

      if (error.message === 'Authentication failed') {
        // Token expired → refresh token, then reconnect
        this.refreshTokenAndReconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  on(event: string, handler: (data: unknown) => void): void {
    this.socket?.on(event, handler);
  }

  emit(event: string, data: unknown): void {
    this.socket?.emit(event, data);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private async refreshTokenAndReconnect(): Promise<void> {
    // Implement token refresh logic
  }
}
`;

// ═══════════════════════════════════════════
// Rule 5: WebSocket Best Practices
// ═══════════════════════════════════════════

const WS_BEST_PRACTICES = {
  authentication: [
    'Verify JWT on handshake (handleConnection)',
    'Reject unauthenticated connections immediately',
    'Handle token expiry → re-auth without disconnect',
  ],
  performance: [
    'Use rooms for targeted messaging (not broadcast all)',
    'Limit message size (max payload)',
    'Debounce high-frequency events (typing indicators)',
    'Use binary data for large payloads (ArrayBuffer)',
  ],
  reliability: [
    'Client auto-reconnect with exponential backoff',
    'Implement heartbeat/ping-pong',
    'Handle offline → queue messages, sync on reconnect',
    'Idempotent message handling (message IDs)',
  ],
  scaling: [
    'Use Redis adapter for multi-instance (sticky sessions OR Redis pub/sub)',
    'Horizontal scale: socket.io-redis-adapter',
    'Monitor: track connected users, messages/sec, rooms',
  ],
};

export {
  gatewayExample,
  eventHandlerExample,
  pushNotificationExample,
  clientReconnectionExample,
  WS_BEST_PRACTICES,
  type WsEvent,
  type ChatMessage,
  type TypingEvent,
};
