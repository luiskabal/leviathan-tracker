import type { NotificationChannel } from '@prisma/client';

export type NotificationPayload = {
  title: string;
  message: string;
  url: string;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
};

export interface NotificationProvider {
  supports(channel: NotificationChannel): boolean;
  send(channel: NotificationChannel, payload: NotificationPayload): Promise<void>;
}
