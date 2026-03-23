export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_PROMPT_LENGTH = 2000;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 50;

export type PipelineStep =
  | 'GENERATING_CREATIVE'
  | 'CREATING_CAMPAIGN'
  | 'CREATING_AD_SET'
  | 'CREATING_AD'
  | 'PUBLISHING';
