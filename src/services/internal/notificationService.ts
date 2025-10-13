import { sendOTPEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../external/emailService";
import { sendOTPSMS, sendPasswordResetSMS, sendWelcomeSMS } from "../external/smsService";
import { errorHandler } from "../../middleware/errorHandler";


// Send OTP via both email and SMS
export const sendOTPNotification = async (email: string, phone: string, otp: string, name: string = "User") => {

    const results: {
        email: { success: boolean; attempted: boolean; error?: string };
        sms: { success: boolean; attempted: boolean; error?: string };
    } = {
        email: { success: false, attempted: false },
        sms: { success: false, attempted: false }
    };

    let successCount = 0;

    // Send email
    if (email) {

        results.email.attempted = true;

        try {

            const emailResult: any = await sendOTPEmail(email, otp, name);

            results.email = emailResult;

            if (emailResult.success) successCount++;

        } catch (error: any) {

            console.error('Email service error:', error.message);

            results.email = { success: false, attempted: true, error: error.message };

        }

    }

    // Send SMS - only if credentials are properly configured
    if (phone && process.env.AFRICAS_TALKING_API_KEY && process.env.AFRICAS_TALKING_USERNAME) {

        results.sms.attempted = true;

        try {

            const smsResult: any = await sendOTPSMS(phone, otp, name);

            results.sms = smsResult;

            if (smsResult.success) successCount++;

        } catch (error: any) {

            console.error('SMS service error:', error.message);

            results.sms = { success: false, attempted: true, error: error.message };

        }

    } else if (phone) {

        console.warn('SMS not sent: Africa\'s Talking credentials not configured');

        results.sms = { success: false, attempted: false, error: "SMS credentials not configured" };

    }

    // Determine overall success
    const overallSuccess = successCount > 0;

    let message = "";

    if (successCount === 2) {

        message = "OTP sent successfully via email and SMS";

    } else if (results.email.success) {

        message = "OTP sent successfully via email";

    } else if (results.sms.success) {

        message = "OTP sent successfully via SMS";

    } else {

        message = "Failed to send OTP - please check your configuration";

    }

    return {
        success: overallSuccess,
        results: results,
        message: message,
        successCount: successCount
    };

};


// Send password reset via both email and SMS
export const sendPasswordResetNotification = async (email: string, phone: string, resetToken: string, name: string = "User") => {

    const results: {
        email: { success: boolean; [key: string]: any };
        sms: { success: boolean; [key: string]: any };
    } = {
        email: { success: false },
        sms: { success: false }
    };

    // Send email
    if (email) {

        try {

            const emailResult: any = await sendPasswordResetEmail(email, resetToken, name);

            results.email = emailResult;

        } catch (error: any) {

            console.error('Error sending password reset email:', error);

            results.email = { success: false, error: error.message };

        }

    }

    // Send SMS
    if (phone) {

        try {

            const smsResult: any = await sendPasswordResetSMS(phone, resetToken, name);

            results.sms = smsResult;

        } catch (error: any) {

            console.error('Error sending password reset SMS:', error);

            results.sms = { success: false, error: error.message };

        }

    }

    // Return success if at least one method succeeded
    const overallSuccess = results.email.success || results.sms.success;

    return {
        success: overallSuccess,
        results: results,
        message: overallSuccess 
            ? "Password reset instructions sent successfully" 
            : "Failed to send password reset instructions"
    };

};


// Send welcome message via both email and SMS
export const sendWelcomeNotification = async (email: string, phone: string, name: string) => {

    const results: {
        email: { success: boolean; [key: string]: any };
        sms: { success: boolean; [key: string]: any };
    } = {
        email: { success: false },
        sms: { success: false }
    };

    // Send email
    if (email) {

        try {

            const emailResult: any = await sendWelcomeEmail(email, name);

            results.email = emailResult;

        } catch (error: any) {

            console.error('Error sending welcome email:', error);

            results.email = { success: false, error: error.message };

        }

    }

    // Send SMS
    if (phone) {

        try {

            const smsResult: any = await sendWelcomeSMS(phone, name);

            results.sms = smsResult;

        } catch (error: any) {

            console.error('Error sending welcome SMS:', error);

            results.sms = { success: false, error: error.message };

        }

    }

    // Return success if at least one method succeeded
    const overallSuccess = results.email.success || results.sms.success;

    return {
        success: overallSuccess,
        results: results,
        message: overallSuccess 
            ? "Welcome message sent successfully" 
            : "Failed to send welcome message"
    };

};

