import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  REDIS_HOST: Joi.string().hostname().required(),
  REDIS_PORT: Joi.number().port().required(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  JWT_SECRET: Joi.string().min(8).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),
  STRIPE_PRICE_ESSENTIAL: Joi.string().required(),
  STRIPE_PRICE_PREMIUM: Joi.string().required(),
  STRIPE_SUCCESS_URL: Joi.string().uri().required(),
  STRIPE_CANCEL_URL: Joi.string().uri().required(),
  STRIPE_PORTAL_RETURN_URL: Joi.string().uri().required(),
  EVOLUTION_API_URL: Joi.string().uri().required(),
  EVOLUTION_API_KEY: Joi.string().required(),
  EVOLUTION_INSTANCE_NAME: Joi.string().required(),
  EVOLUTION_WEBHOOK_URL: Joi.string().uri().required(),
  WHATSAPP_WEBHOOK_TOKEN: Joi.string().allow('').optional(),
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  OPENAI_MODEL: Joi.string().default('gpt-4o'),
  WHATSAPP_IMAGE_CACHE_TTL_SECONDS: Joi.number().integer().positive().default(604800)
});
