import {
  createElectronNativeInputForwarder,
  createElectronSteamInputService,
  electronConfigureSteamOverlay,
  electronDisableSteamOverlayRepaintLoop,
  registerElectronSteamInputPreload,
  type ElectronNativeInputForwarderOptions,
  type ElectronNativeInputForwarderDiagnostics,
  type ElectronNativeInputWebContents,
  type ElectronSteamInputIpcMain,
  type ElectronSteamInputPreloadOptions,
  type ElectronSteamInputPreloadSession,
  type ElectronSteamInputServiceOptions,
  type ElectronSteamInputServiceDiagnostics,
  type ElectronSteamInputServiceWebContents,
  type ElectronSteamOverlayConfigResult,
  type ElectronSteamOverlayProfileOptions
} from "./electron";
import type {
  NativeOverlayInputEvent,
  SteamInputDefinition,
  SteamInputFrame,
  SteamInputSession
} from "./index";

export interface ConfigureSteamElectronOptions {
  /** Chromium/Steam presentation policy, applied immediately before Electron becomes ready. */
  presentation?: ElectronSteamOverlayProfileOptions;
}

export interface SteamElectronInputInstallation {
  readonly closed: boolean;
  close(): void;
}

export interface SteamElectronActionInput<TDefinition extends SteamInputDefinition = SteamInputDefinition> {
  readonly closed: boolean;
  read(): SteamInputFrame<TDefinition> | null;
  reconnect(): void;
  diagnostics(): ElectronSteamInputServiceDiagnostics;
  close(): void;
}

export interface SteamElectronNativeInput {
  handle(event: NativeOverlayInputEvent): boolean;
  setActive(active: boolean): void;
  diagnostics(): ElectronNativeInputForwarderDiagnostics;
  close(): void;
}

export interface SteamElectron {
  readonly presentation: ElectronSteamOverlayConfigResult;
  readonly closed: boolean;
  installRendererInput(
    electronSession: ElectronSteamInputPreloadSession,
    options?: ElectronSteamInputPreloadOptions
  ): SteamElectronInputInstallation;
  connectActionInput<TDefinition extends SteamInputDefinition>(
    session: SteamInputSession<TDefinition>,
    ipcMain: ElectronSteamInputIpcMain,
    webContents: ElectronSteamInputServiceWebContents,
    options?: ElectronSteamInputServiceOptions
  ): SteamElectronActionInput<TDefinition>;
  connectNativeInput(
    webContents: ElectronNativeInputWebContents,
    options: ElectronNativeInputForwarderOptions
  ): SteamElectronNativeInput;
  close(): void;
}

interface Closable {
  close(): void;
}

let activeSteamElectron: SteamElectron | null = null;

export function configureSteamElectron(
  options: ConfigureSteamElectronOptions = {}
): SteamElectron {
  if (activeSteamElectron) {
    throw new Error("Steam Bridge already has an active Electron integration. Close it before configuring another.");
  }
  const presentation = electronConfigureSteamOverlay(options.presentation);
  const resources = new Set<Closable>();
  let closed = false;

  const ensureOpen = (): void => {
    if (closed) throw new Error("Steam Electron integration is closed.");
  };
  const own = <T extends Closable>(resource: T): T => {
    resources.add(resource);
    return resource;
  };
  const release = (resource: Closable): void => {
    resources.delete(resource);
  };

  const integration: SteamElectron = {
    presentation,
    get closed(): boolean {
      return closed;
    },
    installRendererInput(electronSession, preloadOptions = {}): SteamElectronInputInstallation {
      ensureOpen();
      const registration = registerElectronSteamInputPreload(electronSession, preloadOptions);
      let registrationClosed = false;
      const installation: SteamElectronInputInstallation = own({
        get closed(): boolean {
          return registrationClosed;
        },
        close(): void {
          if (registrationClosed) return;
          registrationClosed = true;
          release(installation);
          registration.unregister();
        }
      });
      return installation;
    },
    connectActionInput<TDefinition extends SteamInputDefinition>(
      session: SteamInputSession<TDefinition>,
      ipcMain: ElectronSteamInputIpcMain,
      webContents: ElectronSteamInputServiceWebContents,
      serviceOptions: ElectronSteamInputServiceOptions = {}
    ): SteamElectronActionInput<TDefinition> {
      ensureOpen();
      const service = createElectronSteamInputService(session, ipcMain, webContents, serviceOptions);
      const connection: SteamElectronActionInput<TDefinition> = own({
        get closed(): boolean {
          return service.closed;
        },
        read: service.update,
        reconnect: service.attach,
        diagnostics: service.getDiagnostics,
        close(): void {
          release(connection);
          service.close();
        }
      });
      return connection;
    },
    connectNativeInput(webContents, forwarderOptions): SteamElectronNativeInput {
      ensureOpen();
      const forwarder = createElectronNativeInputForwarder(webContents, forwarderOptions);
      let connectionClosed = false;
      const connection: SteamElectronNativeInput = own({
        handle(event): boolean {
          return !connectionClosed && forwarder.forward(event);
        },
        setActive(active): void {
          if (!connectionClosed) forwarder.setActive(active);
        },
        diagnostics: forwarder.getDiagnostics,
        close(): void {
          if (connectionClosed) return;
          connectionClosed = true;
          release(connection);
          forwarder.release();
        }
      });
      return connection;
    },
    close(): void {
      if (closed) return;
      closed = true;
      let firstError: unknown;
      for (const resource of [...resources].reverse()) {
        try {
          resource.close();
        } catch (error) {
          firstError ??= error;
        }
      }
      resources.clear();
      if (presentation.repaintIntervalMs > 0) {
        try {
          electronDisableSteamOverlayRepaintLoop();
        } catch (error) {
          firstError ??= error;
        }
      }
      if (activeSteamElectron === integration) activeSteamElectron = null;
      if (firstError !== undefined) throw firstError;
    }
  };
  activeSteamElectron = integration;
  return integration;
}
