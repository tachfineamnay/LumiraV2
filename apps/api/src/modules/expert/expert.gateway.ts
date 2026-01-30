import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

interface ExpertSocket extends Socket {
  expertId?: string;
  expertEmail?: string;
}

@WebSocketGateway({
  namespace: '/expert',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class ExpertGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ExpertGateway.name);
  private connectedExperts: Map<string, ExpertSocket> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: ExpertSocket) {
    try {
      const token = client.handshake.auth?.token || 
                    client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      client.expertId = payload.sub;
      client.expertEmail = payload.email;
      
      this.connectedExperts.set(client.id, client);
      
      // Join expert-specific room
      client.join(`expert:${payload.sub}`);
      // Join global experts room
      client.join('experts');

      this.logger.log(`✅ Expert connected: ${payload.email} (${client.id})`);
      
      // Send connection confirmation
      client.emit('connected', {
        expertId: payload.sub,
        connectedAt: new Date().toISOString(),
      });

      // Broadcast online count to all experts
      this.broadcastOnlineCount();
    } catch (error) {
      this.logger.warn(`Connection rejected: Invalid token - ${error instanceof Error ? error.message : 'Unknown error'}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: ExpertSocket) {
    this.connectedExperts.delete(client.id);
    this.logger.log(`Expert disconnected: ${client.expertEmail || client.id}`);
    this.broadcastOnlineCount();
  }

  private broadcastOnlineCount() {
    this.server.to('experts').emit('online-count', {
      count: this.connectedExperts.size,
    });
  }

  // ============== ORDER EVENTS ==============

  /**
   * Broadcast when a new order is paid
   */
  notifyNewOrder(order: {
    id: string;
    orderNumber: string;
    level: number;
    clientName: string;
    amount: number;
  }) {
    this.logger.log(`📦 Broadcasting new order: ${order.orderNumber}`);
    this.server.to('experts').emit('order:new', {
      ...order,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast when order status changes
   */
  notifyOrderStatusChange(order: {
    id: string;
    orderNumber: string;
    previousStatus: string;
    newStatus: string;
    updatedBy?: string;
  }) {
    this.logger.log(`🔄 Order ${order.orderNumber}: ${order.previousStatus} → ${order.newStatus}`);
    this.server.to('experts').emit('order:status-changed', {
      ...order,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast when AI generation completes
   */
  notifyGenerationComplete(orderId: string, orderNumber: string, success: boolean, error?: string) {
    this.logger.log(`🤖 Generation ${success ? 'complete' : 'failed'}: ${orderNumber}`);
    this.server.to('experts').emit('order:generation-complete', {
      orderId,
      orderNumber,
      success,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast when order is sealed/finalized
   */
  notifyOrderSealed(order: {
    id: string;
    orderNumber: string;
    sealedBy: string;
  }) {
    this.logger.log(`🔒 Order sealed: ${order.orderNumber} by ${order.sealedBy}`);
    this.server.to('experts').emit('order:sealed', {
      ...order,
      timestamp: new Date().toISOString(),
    });
  }

  // ============== COLLABORATION EVENTS ==============

  /**
   * When expert starts working on an order
   */
  @SubscribeMessage('order:focus')
  handleOrderFocus(
    @ConnectedSocket() client: ExpertSocket,
    @MessageBody() data: { orderId: string },
  ) {
    // Leave previous order room if any
    const rooms = Array.from(client.rooms);
    rooms.forEach(room => {
      if (room.startsWith('order:')) {
        client.leave(room);
      }
    });

    // Join new order room
    client.join(`order:${data.orderId}`);
    
    // Notify others that this expert is viewing the order
    this.server.to(`order:${data.orderId}`).emit('order:viewer-joined', {
      orderId: data.orderId,
      expertId: client.expertId,
      expertEmail: client.expertEmail,
    });

    this.logger.log(`👁 Expert ${client.expertEmail} focusing on order ${data.orderId}`);
  }

  /**
   * When expert stops working on an order
   */
  @SubscribeMessage('order:blur')
  handleOrderBlur(
    @ConnectedSocket() client: ExpertSocket,
    @MessageBody() data: { orderId: string },
  ) {
    client.leave(`order:${data.orderId}`);
    
    this.server.to(`order:${data.orderId}`).emit('order:viewer-left', {
      orderId: data.orderId,
      expertId: client.expertId,
    });
  }

  /**
   * Real-time cursor/selection sync for collaborative editing
   */
  @SubscribeMessage('editor:cursor')
  handleEditorCursor(
    @ConnectedSocket() client: ExpertSocket,
    @MessageBody() data: { orderId: string; position: number; selection?: { from: number; to: number } },
  ) {
    // Broadcast to other experts viewing the same order
    client.to(`order:${data.orderId}`).emit('editor:cursor-update', {
      expertId: client.expertId,
      expertEmail: client.expertEmail,
      ...data,
    });
  }

  // ============== PING/PONG ==============

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: ExpertSocket) {
    client.emit('pong', { timestamp: Date.now() });
  }

  // ============== STATS ==============

  /**
   * Broadcast updated stats to all experts
   */
  broadcastStats(stats: {
    pendingCount: number;
    processingCount: number;
    validationCount: number;
    completedToday: number;
    revenueToday: number;
  }) {
    this.server.to('experts').emit('stats:update', {
      ...stats,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connected experts count
   */
  getConnectedCount(): number {
    return this.connectedExperts.size;
  }
}
