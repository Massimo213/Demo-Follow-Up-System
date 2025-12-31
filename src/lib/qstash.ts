/**
 * QStash client for job scheduling
 * Handles message publishing and signature verification
 */

import { Client, Receiver } from '@upstash/qstash';

let _client: Client | null = null;
let _receiver: Receiver | null = null;

export function getQStashClient(): Client {
  if (_client) return _client;

  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error('Missing QSTASH_TOKEN');

  _client = new Client({ token });
  return _client;
}

export function getQStashReceiver(): Receiver {
  if (_receiver) return _receiver;

  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    throw new Error('Missing QStash signing keys');
  }

  _receiver = new Receiver({
    currentSigningKey,
    nextSigningKey,
  });

  return _receiver;
}

export const qstash = {
  get client() {
    return getQStashClient();
  },
  get receiver() {
    return getQStashReceiver();
  },
};

