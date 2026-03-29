interface EvolutionMessageKey {
  id?: string;
  remoteJid?: string;
  remoteJidAlt?: string;
  fromMe?: boolean;
}

interface EvolutionMessageContent {
  conversation?: string;
  extendedTextMessage?: {
    text?: string;
  };
  imageMessage?: {
    caption?: string;
    url?: string;
    mimetype?: string;
    mediaUrl?: string;
    mediaKey?: string;
    directPath?: string;
    base64?: string;
  };
  videoMessage?: {
    caption?: string;
  };
}

interface EvolutionWebhookMessageData {
  key?: EvolutionMessageKey;
  message?: EvolutionMessageContent;
  pushName?: string;
}

export interface EvolutionWebhookPayload {
  event?: string;
  instance?: string;
  sender?:
    | string
    | {
        id?: string;
        remoteJid?: string;
        remoteJidAlt?: string;
      };
  key?: EvolutionMessageKey;
  message?: EvolutionMessageContent;
  data?: EvolutionWebhookMessageData & {
    sender?:
      | string
      | {
          id?: string;
          remoteJid?: string;
          remoteJidAlt?: string;
        };
    messages?: EvolutionWebhookMessageData[];
  };
}
