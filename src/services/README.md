# 📧 SIRE Tech - Notification Services

## 📁 Service Architecture

```
services/
├── internal/              # Internal business logic services
│   └── notificationService.ts    # Orchestrates email & SMS notifications
└── external/              # External API integrations
    ├── emailService.ts    # Nodemailer email integration
    └── smsService.ts      # Africa's Talking SMS integration
```

---

## 🔧 Internal Services

### `notificationService.ts`
**Purpose:** Orchestrates multi-channel notifications (email + SMS)

**Functions:**
- `sendOTPNotification(email, phone, otp, name)` - Send OTP via email and SMS
- `sendPasswordResetNotification(email, phone, resetToken, name)` - Send password reset instructions
- `sendWelcomeNotification(email, phone, name)` - Send welcome message after verification

**Features:**
- Dual-channel delivery (email + SMS)
- Graceful failure handling
- Success tracking for each channel
- Configurable based on environment variables

---

## 🌐 External Services

### `emailService.ts`
**Purpose:** Email delivery via Nodemailer

**Functions:**
- `sendOTPEmail(email, otp, name)` - Send OTP verification email
- `sendPasswordResetEmail(email, resetToken, name)` - Send password reset email
- `sendWelcomeEmail(email, name)` - Send welcome email

**Configuration:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

**Features:**
- HTML email templates
- Professional styling
- Branded emails with SIRE Tech identity
- Error handling and logging

---

### `smsService.ts`
**Purpose:** SMS delivery via Africa's Talking

**Functions:**
- `sendOTPSMS(phone, otp, name)` - Send OTP verification SMS
- `sendPasswordResetSMS(phone, resetToken, name)` - Send password reset SMS
- `sendWelcomeSMS(phone, name)` - Send welcome SMS

**Configuration:**
```env
AFRICAS_TALKING_API_KEY=your-africastalking-api-key
AFRICAS_TALKING_USERNAME=your-africastalking-username
```

**Features:**
- Phone number formatting for Kenya (+254)
- Automatic country code handling
- Cost tracking
- Graceful failure if credentials not configured

---

## 📝 Usage Examples

### In Controllers

```typescript
import { sendOTPNotification, sendPasswordResetNotification, sendWelcomeNotification } from '../services/internal/notificationService';

// Send OTP during registration
const notificationResult = await sendOTPNotification(
    email, 
    phone, 
    otp, 
    `${firstName} ${lastName}`
);

// Send password reset
const resetResult = await sendPasswordResetNotification(
    user.email, 
    user.phone, 
    resetToken, 
    `${user.firstName} ${user.lastName}`
);

// Send welcome message
const welcomeResult = await sendWelcomeNotification(
    user.email, 
    user.phone, 
    `${user.firstName} ${user.lastName}`
);
```

### Response Structure

```typescript
{
    success: boolean,           // Overall success (at least one channel succeeded)
    results: {
        email: {
            success: boolean,
            attempted: boolean,
            messageId?: string,
            error?: string
        },
        sms: {
            success: boolean,
            attempted: boolean,
            messageId?: string,
            cost?: string,
            error?: string
        }
    },
    message: string,           // Human-readable message
    successCount: number       // Number of successful channels
}
```

---

## 🔐 Security Features

### Email Security
- Secure SMTP connection
- Environment-based configuration
- No hardcoded credentials
- Error message sanitization

### SMS Security
- Phone number validation and formatting
- Credential validation before initialization
- Graceful degradation if not configured
- Cost tracking for billing

---

## 🚨 Error Handling

### Email Errors
- Missing SMTP configuration
- Invalid credentials
- Network failures
- Template rendering errors

### SMS Errors
- Missing Africa's Talking credentials
- Invalid phone numbers
- Insufficient balance
- Network failures

### Graceful Degradation
- If email fails, SMS still attempts
- If SMS fails, email still attempts
- Success if at least one channel succeeds
- Detailed error logging for debugging

---

## 🧪 Testing

### Development Mode
When credentials are not configured:
- Email: Throws error with clear message
- SMS: Logs warning and continues without sending
- OTP/tokens logged to console for testing

### Production Mode
Ensure all credentials are properly configured:
```bash
# Test email configuration
npm run test:email

# Test SMS configuration
npm run test:sms
```

---

## 📊 Monitoring

### Logging
All services log:
- Successful sends with message IDs
- Failed attempts with error details
- Configuration warnings
- Cost information (SMS)

### Console Output Examples
```
OTP email sent successfully to user@example.com: <message-id>
OTP SMS sent successfully to +254712345678: {...}
OTP notification result: { success: true, successCount: 2, ... }
```

---

## 🔄 Future Enhancements

### Planned Features
- Push notifications via Firebase
- WhatsApp Business API integration
- Email templates with Handlebars
- SMS delivery status webhooks
- Notification queue with Bull/Redis
- Retry mechanism for failed sends
- Analytics and reporting

---

## 📞 Provider Setup

### Gmail SMTP Setup
1. Enable 2-Factor Authentication
2. Generate App Password
3. Use App Password in SMTP_PASS

### Africa's Talking Setup
1. Sign up at https://africastalking.com
2. Get API Key from dashboard
3. Register sender ID (optional)
4. Add test credits or go live

---

**Last Updated:** October 2025  
**Status:** ✅ Implemented and Ready  
**Dependencies:** nodemailer, africastalking
