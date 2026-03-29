import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionType } from '@prisma/client';

interface ParsedImageTransaction {
  amount: number;
  type: TransactionType;
  description: string;
  date: string | null;
}

interface OpenAiJsonResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface OpenAiErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

export class OpenAiParsingError extends Error {
  constructor(
    message: string,
    readonly options: {
      status: number;
      type?: string;
      code?: string;
      retryable: boolean;
    }
  ) {
    super(message);
    this.name = 'OpenAiParsingError';
  }
}

@Injectable()
export class OpenAiService {
  constructor(private readonly configService: ConfigService) {}

  async parseTransactionFromImage(
    imageBuffer: Buffer,
    mimeType: string
  ): Promise<ParsedImageTransaction> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY', '');

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is missing');
    }

    const model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o');
    const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'transaction_from_image',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                amount: {
                  type: 'number',
                  minimum: 0
                },
                type: {
                  type: 'string',
                  enum: ['EXPENSE', 'INCOME']
                },
                description: {
                  type: 'string',
                  minLength: 1
                },
                date: {
                  anyOf: [
                    {
                      type: 'string',
                      pattern: '^\\d{4}-\\d{2}-\\d{2}$'
                    },
                    {
                      type: 'null'
                    }
                  ]
                }
              },
              required: ['amount', 'type', 'description', 'date']
            }
          }
        },
        messages: [
          {
            role: 'system',
            content:
              'Extraia dados financeiros da imagem e responda somente JSON valido no schema solicitado.'
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia valor, tipo (EXPENSE/INCOME), descricao curta e data (YYYY-MM-DD). Se data nao estiver clara, use null.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageDataUrl
                }
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      const parsedError = this.tryParseError(responseText);
      const errorType = parsedError?.error?.type;
      const errorCode = parsedError?.error?.code;
      const retryable = this.isRetryableError(
        response.status,
        errorType,
        errorCode
      );
      const reason =
        parsedError?.error?.message?.trim() ||
        `OpenAI request failed with status ${response.status}`;

      throw new OpenAiParsingError(reason, {
        status: response.status,
        type: errorType,
        code: errorCode,
        retryable
      });
    }

    const payload = (await response.json()) as OpenAiJsonResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenAI returned empty content');
    }

    const parsed = JSON.parse(content) as {
      amount: number;
      type: 'EXPENSE' | 'INCOME';
      description: string;
      date: string | null;
    };

    if (!Number.isFinite(parsed.amount) || parsed.amount <= 0) {
      throw new Error('OpenAI returned invalid amount');
    }

    if (!parsed.description?.trim()) {
      throw new Error('OpenAI returned empty description');
    }

    if (parsed.date) {
      const parsedDate = new Date(parsed.date);

      if (Number.isNaN(parsedDate.getTime())) {
        throw new Error('OpenAI returned invalid date');
      }
    }

    return {
      amount: parsed.amount,
      type:
        parsed.type === 'EXPENSE' ? TransactionType.EXPENSE : TransactionType.INCOME,
      description: parsed.description.trim(),
      date: parsed.date
    };
  }

  private tryParseError(responseText: string): OpenAiErrorResponse | null {
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText) as OpenAiErrorResponse;
    } catch {
      return null;
    }
  }

  private isRetryableError(
    status: number,
    type: string | undefined,
    code: string | undefined
  ): boolean {
    if (status === 429 && (type === 'insufficient_quota' || code === 'insufficient_quota')) {
      return false;
    }

    if (status === 429 || status >= 500) {
      return true;
    }

    return false;
  }
}
