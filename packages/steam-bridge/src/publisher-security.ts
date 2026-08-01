export interface SteamPublisherServerRuntimeOptions {
  dangerouslyAllowClientSidePublisherSecrets?: boolean;
}

export class SteamPublisherSecretsClientRuntimeError extends Error {
  readonly code = "STEAM_PUBLISHER_SECRETS_CLIENT_RUNTIME";

  constructor() {
    super(
      "Steam publisher credentials and encrypted-ticket keys are server-only. " +
        "Use steam-bridge/server from a trusted Node.js server; never ship these secrets in a browser or Electron app."
    );
    this.name = "SteamPublisherSecretsClientRuntimeError";
  }
}

export function isSteamClientRuntime(): boolean {
  const runtime = globalThis as unknown as Record<string, unknown>;
  const versions = process.versions as NodeJS.ProcessVersions & { electron?: string };
  return Boolean(versions.electron) || (runtime.window !== undefined && runtime.document !== undefined);
}

export function assertSteamPublisherServerRuntime(
  options: SteamPublisherServerRuntimeOptions = {}
): void {
  if (
    isSteamClientRuntime() &&
    options.dangerouslyAllowClientSidePublisherSecrets !== true
  ) {
    throw new SteamPublisherSecretsClientRuntimeError();
  }
}
