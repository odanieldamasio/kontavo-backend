import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , action] = process.argv;
const env = {
  ...loadDotEnv(resolve(process.cwd(), '.env')),
  ...process.env
};

const instanceName = env.EVOLUTION_INSTANCE_NAME;
const apiKey = env.EVOLUTION_API_KEY;
const baseUrl = sanitizeBaseUrl(env.EVOLUTION_HOST_URL || 'http://localhost:8080');
const webhookUrl = env.EVOLUTION_WEBHOOK_URL || 'http://backend:3000/whatsapp/webhook';
const webhookToken = env.WHATSAPP_WEBHOOK_TOKEN;

if (!action) {
  printHelp();
  process.exit(1);
}

if (!instanceName || !apiKey) {
  console.error(
    'Missing EVOLUTION_INSTANCE_NAME or EVOLUTION_API_KEY in .env or environment.'
  );
  process.exit(1);
}

switch (action) {
  case 'delete-instance':
    await request(`/instance/delete/${instanceName}`, {
      method: 'DELETE'
    });
    break;
  case 'create-instance':
    await request('/instance/create', {
      method: 'POST',
      body: {
        instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      }
    });
    break;
  case 'connect-instance':
    await request(`/instance/connect/${instanceName}`);
    break;
  case 'connection-state':
    await request(`/instance/connectionState/${instanceName}`);
    break;
  case 'set-webhook':
    await request(`/webhook/set/${instanceName}`, {
      method: 'POST',
      body: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          events: ['MESSAGES_UPSERT'],
          webhook_by_events: false,
          webhook_base64: false,
          ...(webhookToken
            ? {
                headers: {
                  'x-webhook-token': webhookToken
                }
              }
            : {})
        }
      }
    });
    break;
  case 'find-webhook':
    await request(`/webhook/find/${instanceName}`);
    break;
  case 'check-webhook': {
    const result = await request(`/webhook/find/${instanceName}`, {
      silent: true
    });
    const validation = validateWebhookConfiguration(result.body);

    if (!validation.valid) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            status: result.status,
            body: result.body,
            validation
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          status: result.status,
          body: result.body,
          validation
        },
        null,
        2
      )
    );
    break;
  }
  default:
    printHelp();
    process.exit(1);
}

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const responseText = await response.text();
  const parsedBody = tryParseJson(responseText);

  if (!response.ok) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          status: response.status,
          body: parsedBody
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (!options.silent) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          status: response.status,
          body: parsedBody
        },
        null,
        2
      )
    );
  }

  return {
    ok: true,
    status: response.status,
    body: parsedBody
  };
}

function sanitizeBaseUrl(value) {
  return value.replace(/\/$/, '');
}

function tryParseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function validateWebhookConfiguration(webhook) {
  if (!webhook || typeof webhook !== 'object') {
    return {
      valid: false,
      reason:
        'Webhook not configured. Run "node ./scripts/evolution-api.mjs set-webhook" first.'
    };
  }

  const configuredUrl = typeof webhook.url === 'string' ? webhook.url : '';
  const enabled = webhook.enabled === true;
  const events = Array.isArray(webhook.events) ? webhook.events : [];
  const hasMessagesUpsertEvent = events.includes('MESSAGES_UPSERT');

  if (!enabled) {
    return {
      valid: false,
      reason: 'Webhook is disabled.'
    };
  }

  if (configuredUrl !== webhookUrl) {
    return {
      valid: false,
      reason: `Webhook URL mismatch. Expected "${webhookUrl}" and got "${configuredUrl || 'empty'}".`
    };
  }

  if (!hasMessagesUpsertEvent) {
    return {
      valid: false,
      reason: 'Webhook does not include the MESSAGES_UPSERT event.'
    };
  }

  return {
    valid: true,
    reason: 'Webhook is active and correctly configured.'
  };
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((accumulator, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return accumulator;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      accumulator[key] = stripQuotes(value);
      return accumulator;
    }, {});
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function printHelp() {
  console.error(
    [
      'Usage: node ./scripts/evolution-api.mjs <command>',
      '',
      'Commands:',
      '  delete-instance',
      '  create-instance',
      '  connect-instance',
      '  connection-state',
      '  set-webhook',
      '  find-webhook',
      '  check-webhook'
    ].join('\n')
  );
}
