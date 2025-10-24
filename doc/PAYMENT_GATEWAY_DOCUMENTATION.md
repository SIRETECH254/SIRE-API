# 💳 SIRE Tech API - Payment Gateway Documentation

## 📋 Table of Contents
- [Payment Gateway Overview](#payment-gateway-overview)
- [M-Pesa Integration](#m-pesa-integration)
- [Paystack Integration](#paystack-integration)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Webhook Configuration](#webhook-configuration)
- [Testing](#testing)

---

## 🔄 Payment Gateway Overview

The SIRE Tech API supports multiple payment gateways for invoice payments:

### Supported Payment Methods
- **M-Pesa (Daraja API)** - Mobile money payments via STK Push
- **Paystack** - Card payments and bank transfers
- **Cash** - Offline cash payments
- **Bank Transfer** - Manual bank transfers

### Payment Flow
1. **Initiate Payment** → Create payment record and initiate gateway-specific process
2. **Gateway Processing** → Handle payment through M-Pesa/Paystack
3. **Webhook/Callback** → Receive payment confirmation from gateway
4. **Update Status** → Mark payment as completed and update invoice
5. **Real-time Updates** → Emit Socket.io events for frontend updates

---

## 📱 M-Pesa Integration

### Features
- **STK Push** - Direct mobile money payments
- **Callback Handling** - Automatic payment confirmation
- **Status Querying** - Fallback polling for payment status
- **Phone Validation** - Kenyan phone number format validation

### M-Pesa Payment Flow
1. Client initiates payment with phone number
2. System sends STK Push to client's phone
3. Client enters M-Pesa PIN on phone
4. Safaricom sends callback to webhook
5. System processes callback and updates payment status

### Required Environment Variables
```env
# M-Pesa Daraja API Configuration
MPESA_ENV=sandbox                    # or 'production'
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORT_CODE=your_short_code
MPESA_PASSKEY=your_passkey
```

### M-Pesa API Endpoints
- **Initiate Payment**: `POST /api/payments/initiate`
- **Webhook**: `POST /api/payments/webhooks/mpesa`
- **Status Query**: `GET /api/payments/:paymentId/mpesa-status`
- **Status by Checkout ID**: `GET /api/payments/mpesa-status/:checkoutRequestId`

---

## 💳 Paystack Integration

### Features
- **Card Payments** - Credit/debit card processing
- **Bank Transfers** - Direct bank account transfers
- **Webhook Handling** - Automatic payment confirmation
- **Transaction Verification** - Verify payment status

### Paystack Payment Flow
1. Client initiates payment with email
2. System creates Paystack transaction
3. Client redirected to Paystack payment page
4. Client completes payment on Paystack
5. Paystack sends webhook to system
6. System processes webhook and updates payment status

### Required Environment Variables
```env
# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_...     # or sk_live_... for production
PAYSTACK_PUBLIC_KEY=pk_test_...     # or pk_live_... for production
PAYSTACK_CURRENCY=KES               # Default currency
```

### Paystack API Endpoints
- **Initiate Payment**: `POST /api/payments/initiate`
- **Webhook**: `POST /api/payments/webhooks/paystack`

---

## 🔧 Environment Variables

### Complete Environment Configuration
```env
# Server Configuration
NODE_ENV=development
PORT=5000
API_BASE_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/sire-tech

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_refresh_secret_key_here

# M-Pesa Daraja API
MPESA_ENV=sandbox                    # 'sandbox' or 'production'
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORT_CODE=your_short_code
MPESA_PASSKEY=your_passkey

# Paystack
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PUBLIC_KEY=pk_test_...
PAYSTACK_CURRENCY=KES

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# SMS Configuration (for notifications)
AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username
```

---

## 🛣️ API Endpoints

### Payment Initiation
```http
POST /api/payments/initiate
Authorization: Bearer <token>
Content-Type: application/json

{
  "invoiceId": "invoice_id_here",
  "method": "mpesa",              // or "paystack", "cash", "bank_transfer"
  "amount": 1000,
  "payerPhone": "254712345678",   // Required for M-Pesa
  "payerEmail": "user@example.com", // Required for Paystack
  "callbackUrl": "https://yourdomain.com/callback" // Optional
}
```

### M-Pesa Response
```json
{
  "success": true,
  "message": "M-Pesa payment initiated",
  "data": {
    "paymentId": "payment_id_here",
    "status": "pending",
    "daraja": {
      "merchantRequestId": "ws_CO_123456789",
      "checkoutRequestId": "ws_CO_123456789"
    }
  }
}
```

### Paystack Response
```json
{
  "success": true,
  "message": "Paystack payment initiated",
  "data": {
    "paymentId": "payment_id_here",
    "status": "pending",
    "authorizationUrl": "https://checkout.paystack.com/...",
    "reference": "INV-invoice_id-timestamp"
  }
}
```

### Query M-Pesa Status
```http
GET /api/payments/:paymentId/mpesa-status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully."
  }
}
```

---

## 🔗 Webhook Configuration

### M-Pesa Webhook
**URL**: `https://yourdomain.com/api/payments/webhooks/mpesa`

**Payload Example:**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "ws_CO_123456789",
      "CheckoutRequestID": "ws_CO_123456789",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 1000
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "NLJ7RT61SV"
          },
          {
            "Name": "PhoneNumber",
            "Value": 254712345678
          }
        ]
      }
    }
  }
}
```

### Paystack Webhook
**URL**: `https://yourdomain.com/api/payments/webhooks/paystack`

**Payload Example:**
```json
{
  "event": "charge.success",
  "data": {
    "id": 123456789,
    "domain": "test",
    "status": "success",
    "reference": "INV-invoice_id-timestamp",
    "amount": 100000,
    "currency": "KES",
    "customer": {
      "id": 123456,
      "email": "user@example.com"
    }
  }
}
```

---

## 🧪 Testing

### M-Pesa Sandbox Testing
1. **Test Phone Numbers**: Use Safaricom's test numbers
   - `254708374149` - Success
   - `254708374150` - Insufficient funds
   - `254708374151` - User cancelled

2. **Test Amounts**: Use specific amounts for different scenarios
   - `1` - Success
   - `2` - Insufficient funds
   - `3` - User cancelled

### Paystack Testing
1. **Test Cards**: Use Paystack's test card numbers
   - `4084084084084081` - Success
   - `4084084084084085` - Insufficient funds
   - `4084084084084087` - Do not honor

2. **Test Email**: Use any email for testing

### Testing Commands
```bash
# Test M-Pesa payment
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "invoiceId": "invoice_id",
    "method": "mpesa",
    "amount": 1000,
    "payerPhone": "254708374149"
  }'

# Test Paystack payment
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "invoiceId": "invoice_id",
    "method": "paystack",
    "amount": 1000,
    "payerEmail": "test@example.com"
  }'

# Query M-Pesa status
curl -X GET http://localhost:5000/api/payments/payment_id/mpesa-status \
  -H "Authorization: Bearer <token>"
```

---

## 🔒 Security Considerations

### Webhook Security
- **M-Pesa**: Validate callback signatures (implement IP whitelisting)
- **Paystack**: Verify webhook signatures using secret key
- **Rate Limiting**: Implement rate limiting on webhook endpoints

### Data Protection
- **PCI Compliance**: Never store card details
- **Encryption**: Encrypt sensitive payment data
- **Audit Logs**: Log all payment activities

### Error Handling
- **Retry Logic**: Implement retry for failed webhooks
- **Fallback Polling**: Use status query as fallback
- **Monitoring**: Monitor payment success rates

---

## 📊 Monitoring and Analytics

### Key Metrics to Track
- **Payment Success Rate**: Percentage of successful payments
- **Gateway Performance**: Response times and success rates
- **Error Rates**: Failed payments by gateway and reason
- **Revenue Tracking**: Total payments processed

### Real-time Updates
The system emits Socket.io events for real-time updates:
- `payment.updated` - Payment status changes
- `invoice.updated` - Invoice status changes
- `callback.received` - M-Pesa callback received

---

## 🚀 Production Deployment

### Environment Setup
1. **Production URLs**: Update webhook URLs for production
2. **SSL Certificates**: Ensure HTTPS for webhook endpoints
3. **Database**: Use production MongoDB instance
4. **Monitoring**: Set up payment monitoring and alerts

### Gateway Configuration
1. **M-Pesa**: Switch to production environment
2. **Paystack**: Use live API keys
3. **Webhooks**: Configure production webhook URLs
4. **Testing**: Thoroughly test all payment flows

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Maintainer:** SIRE Tech Development Team
