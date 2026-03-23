import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().required(),
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  META_ACCESS_TOKEN: Joi.string().optional().allow(''),
  META_APP_ID: Joi.string().optional().allow(''),
  META_APP_SECRET: Joi.string().optional().allow(''),
  GEMINI_API_KEY: Joi.string().required(),
});
