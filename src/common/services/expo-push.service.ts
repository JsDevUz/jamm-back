import { Injectable, Logger } from '@nestjs/common';

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  icon?: string;
  richContent?: {
    image: string;
  };
};

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly endpoint = 'https://exp.host/--/api/v2/push/send';

  isExpoPushToken(token?: string | null) {
    return /^(Expo|Exponent)PushToken\[.+\]$/.test(String(token || '').trim());
  }

  async send(messages: PushMessage[]) {
    const payload = messages.filter((message) =>
      this.isExpoPushToken(message.to),
    );

    if (!payload.length) {
      return;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      let responseBody: any = null;
      try {
        responseBody = await response.json();
      } catch {
        responseBody = null;
      }

      if (!response.ok) {
        this.logger.warn(
          `Expo push send failed with status ${response.status}`,
        );
        if (responseBody) {
          this.logger.warn(JSON.stringify(responseBody));
        }
        return;
      }

      const ticketErrors = (responseBody?.data || []).filter(
        (entry: any) => entry?.status === 'error',
      );
      if (ticketErrors.length) {
        this.logger.warn(
          `Expo push ticket errors: ${JSON.stringify(ticketErrors)}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Expo push send failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
