import AfricasTalking from "africastalking";
import { errorHandler } from "../../middleware/errorHandler";


// Initialize Africa's Talking only if credentials are available
let africasTalking: any = null;

let sms: any = null;

if (process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME && 
    process.env.AFRICAS_TALKING_API_KEY !== 'your-africastalking-api-key' && 
    process.env.AFRICAS_TALKING_USERNAME !== 'your-africastalking-username') {

    africasTalking = new AfricasTalking({
        apiKey: process.env.AFRICAS_TALKING_API_KEY,
        username: process.env.AFRICAS_TALKING_USERNAME
    });

    sms = africasTalking.SMS;

} else {

    console.warn('Africa\'s Talking SMS service not initialized: Invalid or missing credentials');

}


// Format phone number for Kenya
const formatPhoneNumber = (phone: string): string => {

    // Remove any spaces, dashes, or plus signs
    let cleanNumber = phone.replace(/[\s\-\+]/g, '');

    // If number starts with 0, replace with 254
    if (cleanNumber.startsWith('0')) {
        cleanNumber = '254' + cleanNumber.substring(1);
    }

    // If number doesn't start with 254, add it
    if (!cleanNumber.startsWith('254')) {
        cleanNumber = '254' + cleanNumber;
    }

    return '+' + cleanNumber;

};


// Send OTP SMS
export const sendOTPSMS = async (phone: string, otp: string, name: string = "User") => {

    if (!phone || !otp) {

        throw errorHandler(400, "Phone number and OTP are required for sending SMS");

    }

    if (!sms) {

        throw errorHandler(500, "SMS service not initialized - check Africa's Talking credentials");

    }

    try {

        const formattedPhone = formatPhoneNumber(phone);

        const message = `Hi ${name}! Your SIRE Tech verification code is: ${otp}. This code expires in ${process.env.OTP_EXP_MINUTES || 10} minutes. Don't share this code with anyone.`;

        const options = {
            to: [formattedPhone],
            message: message,
            from: 'SIRE_TECH' // Optional: Your sender ID (must be registered with Africa's Talking)
        };

        const result = await sms.send(options);

        console.log(`OTP SMS sent successfully to ${formattedPhone}:`, result);

        if (result.SMSMessageData.Recipients[0].status === 'Success') {

            return { 
                success: true, 
                messageId: result.SMSMessageData.Recipients[0].messageId,
                cost: result.SMSMessageData.Recipients[0].cost
            };

        } else {

            return { 
                success: false, 
                error: result.SMSMessageData.Recipients[0].status
            };

        }

    } catch (error: any) {

        console.error('Error sending OTP SMS:', error);

        throw errorHandler(500, `Failed to send OTP SMS: ${error.message}`);

    }

};


// Send password reset SMS
export const sendPasswordResetSMS = async (phone: string, resetToken: string, name: string = "User") => {

    try {

        const formattedPhone = formatPhoneNumber(phone);

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

        const message = `Hi ${name}! Reset your SIRE Tech password using this link: ${resetUrl} This link expires in 15 minutes. If you didn't request this, ignore this message.`;

        const options = {
            to: [formattedPhone],
            message: message,
            from: 'SIRE_TECH'
        };

        const result = await sms.send(options);

        console.log(`Password reset SMS sent successfully to ${formattedPhone}:`, result);

        if (result.SMSMessageData.Recipients[0].status === 'Success') {

            return { 
                success: true, 
                messageId: result.SMSMessageData.Recipients[0].messageId,
                cost: result.SMSMessageData.Recipients[0].cost
            };

        } else {

            return { 
                success: false, 
                error: result.SMSMessageData.Recipients[0].status
            };

        }

    } catch (error: any) {

        console.error('Error sending password reset SMS:', error);

        return { success: false, error: error.message };

    }

};


// Send welcome SMS
export const sendWelcomeSMS = async (phone: string, name: string) => {

    try {

        const formattedPhone = formatPhoneNumber(phone);

        const message = `Welcome to SIRE Tech, ${name}! 🎉 Your account is now verified. Manage your business efficiently at ${process.env.FRONTEND_URL}. - SIRE Tech Team`;

        const options = {
            to: [formattedPhone],
            message: message,
            from: 'SIRE_TECH'
        };

        const result = await sms.send(options);

        console.log(`Welcome SMS sent successfully to ${formattedPhone}:`, result);

        if (result.SMSMessageData.Recipients[0].status === 'Success') {

            return { 
                success: true, 
                messageId: result.SMSMessageData.Recipients[0].messageId,
                cost: result.SMSMessageData.Recipients[0].cost
            };

        } else {

            return { 
                success: false, 
                error: result.SMSMessageData.Recipients[0].status
            };

        }

    } catch (error: any) {

        console.error('Error sending welcome SMS:', error);

        return { success: false, error: error.message };

    }

};

