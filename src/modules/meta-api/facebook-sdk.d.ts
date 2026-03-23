declare module 'facebook-nodejs-business-sdk' {
  export class FacebookAdsApi {
    static init(
      accessToken: string,
      appId?: string,
      appSecret?: string,
    ): FacebookAdsApi;
  }

  export class AdAccount {
    constructor(id: string);
    createCampaign(
      fields: string[],
      params: Record<string, unknown>,
    ): Promise<{ id: string; _data?: { id: string } }>;
    createAdSet(
      fields: string[],
      params: Record<string, unknown>,
    ): Promise<{ id: string; _data?: { id: string } }>;
    createAdImage(
      fields: string[],
      params: Record<string, unknown>,
    ): Promise<{
      _data?: { images: Record<string, { hash: string }> };
      images: Record<string, { hash: string }>;
    }>;
    createAdCreative(
      fields: string[],
      params: Record<string, unknown>,
    ): Promise<{ id: string; _data?: { id: string } }>;
    createAd(
      fields: string[],
      params: Record<string, unknown>,
    ): Promise<{ id: string; _data?: { id: string } }>;
  }

  const bizSdk: {
    FacebookAdsApi: typeof FacebookAdsApi;
    AdAccount: typeof AdAccount;
  };

  export default bizSdk;
}
