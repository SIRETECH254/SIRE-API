import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SIRE Tech API',
      version: '1.0.0',
      description: 'A comprehensive business management API for SIRE Tech - handling clients, services, quotations, invoices, payments, and projects',
      contact: {
        name: 'SIRE Tech Support',
        email: 'support@siretech.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.siretech.com' 
          : `http://localhost:${process.env.PORT || 5000}`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Bearer token in the format: Bearer <token>'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'User ID'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            role: {
              type: 'string',
              enum: ['super_admin', 'finance', 'project_manager', 'staff'],
              description: 'User role'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether user account is active'
            },
            emailVerified: {
              type: 'boolean',
              description: 'Whether user email is verified'
            },
            avatar: {
              type: 'string',
              description: 'User avatar URL'
            },
            fullName: {
              type: 'string',
              description: 'User full name (virtual field)'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        CreateUser: {
          type: 'object',
          required: ['firstName', 'lastName', 'email', 'password'],
          properties: {
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password (min 6 characters)'
            },
            role: {
              type: 'string',
              enum: ['super_admin', 'finance', 'project_manager', 'staff'],
              default: 'staff',
              description: 'User role'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            isActive: {
              type: 'boolean',
              default: true,
              description: 'Whether user account is active'
            },
            avatar: {
              type: 'string',
              description: 'User avatar URL'
            }
          }
        },
        UpdateUser: {
          type: 'object',
          properties: {
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              minLength: 6,
              description: 'User password (min 6 characters)'
            },
            role: {
              type: 'string',
              enum: ['super_admin', 'finance', 'project_manager', 'staff'],
              description: 'User role'
            },
            phone: {
              type: 'string',
              description: 'User phone number'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether user account is active'
            },
            emailVerified: {
              type: 'boolean',
              description: 'Whether user email is verified'
            },
            avatar: {
              type: 'string',
              description: 'User avatar URL'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              description: 'User password'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User'
                },
                accessToken: {
                  type: 'string',
                  description: 'JWT access token'
                },
                refreshToken: {
                  type: 'string',
                  description: 'JWT refresh token'
                }
              }
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              description: 'Success message'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            error: {
              type: 'string',
              description: 'Detailed error information'
            }
          }
        },
        PaginationParams: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              minimum: 1,
              default: 1,
              description: 'Page number'
            },
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 100,
              default: 10,
              description: 'Items per page'
            },
            sort: {
              type: 'string',
              description: 'Sort field'
            },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              default: 'desc',
              description: 'Sort order'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object'
              },
              description: 'Array of items'
            },
            pagination: {
              type: 'object',
              properties: {
                currentPage: {
                  type: 'number',
                  description: 'Current page number'
                },
                totalPages: {
                  type: 'number',
                  description: 'Total number of pages'
                },
                totalItems: {
                  type: 'number',
                  description: 'Total number of items'
                },
                itemsPerPage: {
                  type: 'number',
                  description: 'Items per page'
                },
                hasNextPage: {
                  type: 'boolean',
                  description: 'Whether there is a next page'
                },
                hasPrevPage: {
                  type: 'boolean',
                  description: 'Whether there is a previous page'
                }
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Users',
        description: 'Admin user management'
      },
      {
        name: 'Clients',
        description: 'Client management'
      },
      {
        name: 'Services',
        description: 'Service catalog management'
      },
      {
        name: 'Quotations',
        description: 'Quotation management'
      },
      {
        name: 'Invoices',
        description: 'Invoice management'
      },
      {
        name: 'Payments',
        description: 'Payment processing'
      },
      {
        name: 'Projects',
        description: 'Project management'
      },
      {
        name: 'Testimonials',
        description: 'Testimonial management'
      },
      {
        name: 'Notifications',
        description: 'Notification system'
      },
      {
        name: 'Contact',
        description: 'Contact message management'
      },
      {
        name: 'Dashboard',
        description: 'Dashboard analytics'
      }
    ]
  },
  apis: [
    './src/routes/*.ts',
    './src/controllers/*.ts',
    './src/models/*.ts'
  ]
};

const specs = swaggerJsdoc(options);

const swaggerConfig = {
  swaggerUi,
  specs,
  options: {
    explorer: true,
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #2563eb }
      .swagger-ui .scheme-container { background: #f8f9fa }
      .swagger-ui .info .description { font-size: 16px; color: #6b7280; }
    `,
    customSiteTitle: 'SIRE Tech API Documentation',
    customfavIcon: '/favicon.ico'
  }
};

export default swaggerConfig;
