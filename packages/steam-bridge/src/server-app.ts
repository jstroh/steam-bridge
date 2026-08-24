import {
  createPublisherWebApiClient,
  type SteamWebApiClient,
  type SteamWebApiClientOptions
} from "./server";

export type {
  SteamWebApiBody,
  SteamWebApiClient,
  SteamWebApiEndpointAccess,
  SteamWebApiEndpointHost,
  SteamWebApiEndpointOptions,
  SteamWebApiFetch,
  SteamWebApiFetchResponse,
  SteamWebApiMethod,
  SteamWebApiParams,
  SteamWebApiRequestOptions,
  SteamWebApiResponse
} from "./server";

/** Safe options for the trusted-server facade. Client-runtime overrides are advanced-only. */
export type SteamPublisherApiOptions = Omit<
  SteamWebApiClientOptions,
  "dangerouslyAllowClientSidePublisherSecrets"
>;

/**
 * Create the server-only Steam publisher Web API client.
 *
 * This entrypoint rejects renderer/browser runtimes and sources the publisher
 * key from explicit options or the documented server environment variables.
 */
export function createSteamPublisherApi(
  options: SteamPublisherApiOptions = {}
): SteamWebApiClient {
  return createPublisherWebApiClient(options);
}
