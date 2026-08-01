import {
  buildSteamWebApiUrl as buildSteamWebApiUrlImpl,
  createSteamWebApiClient as createBaseSteamWebApiClient,
  encryptedAppTicket as encryptedAppTicketImpl,
  type SteamWebApiClient,
  type SteamWebApiClientOptions,
  type SteamWebApiRequestOptions,
  type SteamWebApiResponse
} from "./index";
import {
  assertSteamPublisherServerRuntime,
  SteamPublisherSecretsClientRuntimeError as SteamPublisherSecretsClientRuntimeErrorImpl
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
// Assign re-exported values explicitly so Node 18/20/22 ESM consumers can
// discover every named export through their CommonJS lexer.
export const buildSteamWebApiUrl = buildSteamWebApiUrlImpl;
export const encryptedAppTicket = encryptedAppTicketImpl;
export const SteamPublisherSecretsClientRuntimeError =
  SteamPublisherSecretsClientRuntimeErrorImpl;
export type SteamPublisherSecretsClientRuntimeError = InstanceType<
  typeof SteamPublisherSecretsClientRuntimeErrorImpl
>;

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
