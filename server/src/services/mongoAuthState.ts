/**
 * mongoAuthState.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * MongoDB-based auth state adapter for Baileys.
 *
 * Drop-in replacement for Baileys' `useMultiFileAuthState()`.
 * Instead of reading/writing thousands of JSON files to disk,
 * this adapter stores every credential and key as a document
 * in the `whatsapp_sessions` MongoDB collection.
 *
 * Usage:
 *   const { state, saveCreds } = await useMongoDBAuthState();
 *   // Pass `state` and `saveCreds` to makeWASocket() exactly
 *   // as you would with useMultiFileAuthState().
 */

import { WhatsAppSession } from '../models/WhatsAppSession';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readData(sessionId: string): Promise<any | null> {
  try {
    const doc = await WhatsAppSession.findOne({ sessionId });
    if (!doc) return null;
    return JSON.parse(doc.data);
  } catch {
    return null;
  }
}

async function writeData(sessionId: string, data: any): Promise<void> {
  const serialized = JSON.stringify(data);
  await WhatsAppSession.updateOne(
    { sessionId },
    { $set: { sessionId, data: serialized } },
    { upsert: true }
  );
}

async function removeData(sessionId: string): Promise<void> {
  await WhatsAppSession.deleteOne({ sessionId });
}

// ─── BufferJSON replacer/reviver (same as Baileys internal) ───────────────────

const BufferJSON = {
  replacer: (_key: string, value: any) => {
    if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
      return { __buffer: true, data: Buffer.from(value.data).toString('base64') };
    }
    return value;
  },
  reviver: (_key: string, value: any) => {
    if (value && value.__buffer === true) {
      return Buffer.from(value.data, 'base64');
    }
    return value;
  },
};

// ─── Main Adapter ─────────────────────────────────────────────────────────────

export async function useMongoDBAuthState() {
  // Dynamically import Baileys types
  const { proto, initAuthCreds } = await import('@whiskeysockets/baileys' as any);

  // ── Load or initialise credentials ──────────────────────────────────────
  const credsData = await readData('creds');
  const creds = credsData
    ? JSON.parse(JSON.stringify(credsData), BufferJSON.reviver)
    : initAuthCreds();

  const saveCreds = async () => {
    await writeData('creds', JSON.parse(JSON.stringify(creds, BufferJSON.replacer)));
  };

  // ── Key store read/write ────────────────────────────────────────────────
  const keys: any = {
    get: async (type: string, ids: string[]) => {
      const result: Record<string, any> = {};
      const sessionIds = ids.map((id) => `${type}-${id}`);

      // Batch read: single $in query instead of N serial findOne calls
      const docs = await WhatsAppSession.find({ sessionId: { $in: sessionIds } }).lean();

      for (const doc of docs) {
        // Extract the original id by removing the "type-" prefix
        const id = doc.sessionId.slice(type.length + 1);
        try {
          let value = JSON.parse(doc.data);
          value = JSON.parse(JSON.stringify(value), BufferJSON.reviver);

          if (type === 'app-state-sync-key') {
            value = proto.Message.AppStateSyncKeyData.fromObject(value);
          }

          result[id] = value;
        } catch {
          // Skip corrupted entries silently
        }
      }
      return result;
    },

    set: async (data: Record<string, Record<string, any>>) => {
      const ops: Promise<void>[] = [];
      for (const category of Object.keys(data)) {
        const categoryData = data[category];
        if (!categoryData) continue;
        for (const id of Object.keys(categoryData)) {
          const sessionId = `${category}-${id}`;
          const value = categoryData[id];
          if (value) {
            const serializable = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
            ops.push(writeData(sessionId, serializable));
          } else {
            ops.push(removeData(sessionId));
          }
        }
      }
      await Promise.all(ops);
    },
  };

  return { state: { creds, keys }, saveCreds };
}
