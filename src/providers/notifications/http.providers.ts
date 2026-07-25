import type { NotificationChannel } from '@prisma/client';
import { assertPublicDestination } from '../../shared/utils/url.js';
import type { NotificationPayload, NotificationProvider } from './types.js';

type ChannelConfig = { url?: string; headers?: Record<string, string> };

async function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<void> {
  await assertPublicDestination(url);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Notification endpoint returned HTTP ${response.status}`);
}

export class DiscordProvider implements NotificationProvider {
  supports(channel: NotificationChannel): boolean {
    return channel.type === 'DISCORD';
  }
  async send(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const config = channel.configuration as ChannelConfig;
    if (!config.url) throw new Error('Discord channel is missing its webhook URL');
    await post(config.url, {
      username: 'Leviathan Tracker',
      embeds: [
        {
          title: `🚨 ${payload.title}`,
          description: payload.message,
          url: payload.url,
          color: 0x00bcd4,
          fields: payload.fields,
          timestamp: new Date().toISOString(),
        },
      ],
    });
  }
}

export class WebhookProvider implements NotificationProvider {
  supports(channel: NotificationChannel): boolean {
    return channel.type === 'WEBHOOK';
  }
  async send(channel: NotificationChannel, payload: NotificationPayload): Promise<void> {
    const config = channel.configuration as ChannelConfig;
    if (!config.url) throw new Error('Webhook channel is missing its URL');
    await post(config.url, payload, config.headers);
  }
}
