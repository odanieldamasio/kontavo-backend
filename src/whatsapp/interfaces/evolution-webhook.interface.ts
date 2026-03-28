interface EvolutionMessageKey {
  id?: string;
  remoteJid?: string;
  fromMe?: boolean;
}

interface EvolutionMessageContent {
  conversation?: string;
  extendedTextMessage?: {
    text?: string;
  };
  imageMessage?: {
    caption?: string;
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
      };
  key?: EvolutionMessageKey;
  message?: EvolutionMessageContent;
  data?: EvolutionWebhookMessageData & {
    sender?:
      | string
      | {
          id?: string;
          remoteJid?: string;
        };
    messages?: EvolutionWebhookMessageData[];
  };
}
