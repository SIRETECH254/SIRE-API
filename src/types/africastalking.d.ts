declare module 'africastalking' {
  interface AfricasTalkingOptions {
    apiKey: string;
    username: string;
  }

  interface SMSOptions {
    to: string | string[];
    message: string;
    from?: string;
  }

  interface SMSResponse {
    SMSMessageData: {
      Message: string;
      Recipients: Array<{
        statusCode: number;
        number: string;
        status: string;
        cost: string;
        messageId: string;
      }>;
    };
  }

  class AfricasTalking {
    constructor(options: AfricasTalkingOptions);
    SMS: {
      send(options: SMSOptions): Promise<SMSResponse>;
    };
  }

  export = AfricasTalking;
}
