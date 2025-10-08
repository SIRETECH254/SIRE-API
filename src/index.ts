import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import "dotenv/config";
import path from "path";
import { createServer } from 'http';
import { Server } from 'socket.io';
import swaggerConfig from './config/swagger.js';

const app = express();

const PORT = process.env.PORT || 3000;

// CORS Configuration with fallback defaults
const getAllowedOrigins = () => {
  // Default fallback origins for SIRE API
  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:5174',
    'https://siretech.com',
    'https://admin.siretech.com'
  ];
  
  if (!process.env.CORS_ORIGIN) {
    console.warn('⚠️  CORS_ORIGIN not set in environment variables, using default origins:', defaultOrigins);
    return defaultOrigins;
  }
  
  const origins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean);
  
  if (origins.length === 0) {
    console.warn('⚠️  CORS_ORIGIN is empty, using default origins:', defaultOrigins);
    return defaultOrigins;
  }
  
  console.log('✅ CORS configured with allowed origins:', origins);
  return origins;
};

const allowedOrigins = getAllowedOrigins();

// CORS middleware configuration
app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// DB CONNECTION
mongoose.connect(process.env.MONGO_URI as string)
.then(() => console.log("DB CONNECTED"))
.catch((err) => console.log("DB Connection Error:", err.message));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Import Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';

// API ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

// TODO: Implement remaining routes
// app.use("/api/clients", clientRoutes);
// app.use("/api/services", serviceRoutes);
// app.use("/api/quotations", quotationRoutes);
// app.use("/api/invoices", invoiceRoutes);
// app.use("/api/payments", paymentRoutes);
// app.use("/api/projects", projectRoutes);
// app.use("/api/testimonials", testimonialRoutes);
// app.use("/api/notifications", notificationRoutes);
// app.use("/api/contact", contactRoutes);
// app.use("/api/dashboard", dashboardRoutes);

// Health check endpoint
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'OK', 
    message: 'SIRE Tech API Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

// CORS debug endpoint (helpful for troubleshooting)
app.get('/api/debug/cors', (req: express.Request, res: express.Response) => {
  res.json({
    allowedOrigins,
    requestOrigin: req.get('origin') || 'No origin header',
    corsEnabled: true,
    environmentVariable: process.env.CORS_ORIGIN ? 'Set' : 'Not Set',
    timestamp: new Date().toISOString()
  });
});

// Swagger Documentation
app.use('/api/docs', swaggerConfig.swaggerUi.serve, swaggerConfig.swaggerUi.setup(swaggerConfig.specs, swaggerConfig.options));

// Socket.io setup for real-time features
// Create HTTP server that wraps the Express app
const server = createServer(app);

// Attach Socket.io to the HTTP server
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Store socket connections for real-time notifications
const socketConnections = new Map<string, string>();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Listen for user authentication to map socket to user
  socket.on('authenticate', (userId: string) => {
    socketConnections.set(userId, socket.id);
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });
  
  // Listen for project updates
  socket.on('subscribe-to-project', (projectId: string) => {
    socket.join(`project_${projectId}`);
    console.log(`Client subscribed to project updates: ${projectId}`);
  });
  
  // Listen for payment status updates
  socket.on('subscribe-to-payment', (paymentId: string) => {
    socket.join(`payment_${paymentId}`);
    console.log(`Client subscribed to payment updates: ${paymentId}`);
  });
  
  // Listen for invoice updates
  socket.on('subscribe-to-invoice', (invoiceId: string) => {
    socket.join(`invoice_${invoiceId}`);
    console.log(`Client subscribed to invoice updates: ${invoiceId}`);
  });
  
  // Listen for quotation updates
  socket.on('subscribe-to-quotation', (quotationId: string) => {
    socket.join(`quotation_${quotationId}`);
    console.log(`Client subscribed to quotation updates: ${quotationId}`);
  });
  
  socket.on('disconnect', () => {
    // Remove from connections
    for (const [key, value] of socketConnections.entries()) {
      if (value === socket.id) {
        socketConnections.delete(key);
        break;
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Make io and socketConnections available to controllers
app.set('io', io);
app.set('socketConnections', socketConnections);

// Main API endpoint
app.get('/api', (req: express.Request, res: express.Response) => {
  res.json({
    message: 'Welcome to SIRE Tech API',
    version: '1.0.0',
    documentation: '/api/docs',
    features: [
      'User & Client Management',
      'Service Catalog',
      'Quotation & Invoice Generation',
      'Payment Processing (M-Pesa, Stripe, PayPal)',
      'Project Management',
      'Real-time notifications',
      'Testimonial Management',
      'Contact Form Handling',
      'Dashboard Analytics'
    ],
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      clients: '/api/clients',
      services: '/api/services',
      quotations: '/api/quotations',
      invoices: '/api/invoices',
      payments: '/api/payments',
      projects: '/api/projects',
      testimonials: '/api/testimonials',
      notifications: '/api/notifications',
      contact: '/api/contact',
      dashboard: '/api/dashboard'
    }
  });
});

// 404 handler
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { 
      error: err.message,
      stack: err.stack 
    })
  });
});

// Start server
// We listen on the HTTP server (which includes the Express app)
// This allows both HTTP routes AND Socket.io connections to work
server.listen(PORT, (err?: Error) => {
  if (!err) 
  {
    console.log(`🚀 SIRE Tech API Server running on http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 CORS Origins: ${process.env.CORS_ORIGIN || 'Using defaults'}`);
    console.log(`🔌 Socket.io enabled for real-time features`);
  } 
  else 
  {
    console.error('Failed to start server:', err);
  }
});
