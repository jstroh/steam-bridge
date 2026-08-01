import {
  buildSteamWebApiUrl,
  createSteamWebApiClient as createBaseSteamWebApiClient,
  encryptedAppTicket,
  type SteamWebApiClient,
  type SteamWebApiClientOptions,
  type SteamWebApiRequestOptions,
  type SteamWebApiResponse
} from "./index";
import {
  assertSteamPublisherServerRuntime,
  SteamPublisherSecretsClientRuntimeError
} from "./publisher-security";

export type {
  SteamWebApiBody,
  SteamWebApiClient,
  SteamWebApiClientOptions,
  SteamWebApiEndpointAccess,
  SteamWebApiEndpointHost,
  SteamWebApiEndpointOptions,
  SteamWebApiFetch,
  SteamWebApiFetchResponse,
  SteamWebApiMethod,
  SteamWebApiParams,
  SteamWebApiRequestOptions,
  SteamWebApiResponse
} from "./index";
export { buildSteamWebApiUrl, encryptedAppTicket, SteamPublisherSecretsClientRuntimeError };

export interface SteamWebApiServerClientOptions extends SteamWebApiClientOptions {}

interface SteamWebApiInternalServerClientOptions extends SteamWebApiClientOptions {
  serverEnvironmentApiKey?: string | null;
}

export function createPublisherWebApiClient(
  options: SteamWebApiServerClientOptions = {}
): SteamWebApiClient {
  assertSteamPublisherServerRuntime(options);
  const clientOptions: SteamWebApiInternalServerClientOptions = { ...options };
  if (options.publisherApiKey === undefined && options.apiKey === undefined) {
    clientOptions.serverEnvironmentApiKey =
      process.env.STEAM_PUBLISHER_WEB_API_KEY ?? process.env.STEAM_WEB_API_KEY;
  }
  return createBaseSteamWebApiClient(clientOptions);
}

export const createSteamWebApiClient = createPublisherWebApiClient;

export async function requestSteamWebApi<T = unknown>(
  request: SteamWebApiRequestOptions,
  options: SteamWebApiServerClientOptions = {}
): Promise<SteamWebApiResponse<T>> {
  return createPublisherWebApiClient(options).request<T>(request);
}

const serverApi = {
  buildSteamWebApiUrl,
  createPublisherWebApiClient,
  createSteamWebApiClient,
  encryptedAppTicket,
  requestSteamWebApi,
  SteamPublisherSecretsClientRuntimeError
};

export default serverApi;
