#include <cstdint>

extern "C" void *SteamAPI_SteamGameServer_v015();
extern "C" void *SteamAPI_SteamUtils_v010();
extern "C" void *SteamInternal_CreateInterface(const char *version);

namespace {

// These methods are present in the SDK C++ headers but omitted from
// steam_api_flat.h. Keep the vtable layouts in sync with SteamClient023,
// SteamGameServer015, and SteamUtils010.
constexpr const char *kSteamClientInterfaceVersion = "SteamClient023";

struct SteamIPAddressBridge {
  uint8_t bytes[20];
};

class ISteamClientHeaderOnly {
 public:
  virtual int32_t CreateSteamPipe() = 0;
  virtual bool BReleaseSteamPipe(int32_t hSteamPipe) = 0;
  virtual int32_t ConnectToGlobalUser(int32_t hSteamPipe) = 0;
  virtual int32_t CreateLocalUser(int32_t *phSteamPipe, int32_t eAccountType) = 0;
  virtual void ReleaseUser(int32_t hSteamPipe, int32_t hUser) = 0;
  virtual void *GetISteamUser(int32_t hSteamUser, int32_t hSteamPipe,
                              const char *pchVersion) = 0;
  virtual void *GetISteamGameServer(int32_t hSteamUser, int32_t hSteamPipe,
                                    const char *pchVersion) = 0;
  virtual void SetLocalIPBinding(const SteamIPAddressBridge &unIP, uint16_t usPort) = 0;
  virtual void *GetISteamFriends(int32_t hSteamUser, int32_t hSteamPipe,
                                 const char *pchVersion) = 0;
  virtual void *GetISteamUtils(int32_t hSteamPipe, const char *pchVersion) = 0;
  virtual void *GetISteamMatchmaking(int32_t hSteamUser, int32_t hSteamPipe,
                                     const char *pchVersion) = 0;
  virtual void *GetISteamMatchmakingServers(int32_t hSteamUser, int32_t hSteamPipe,
                                            const char *pchVersion) = 0;
  virtual void *GetISteamGenericInterface(int32_t hSteamUser, int32_t hSteamPipe,
                                          const char *pchVersion) = 0;
  virtual void *GetISteamUserStats(int32_t hSteamUser, int32_t hSteamPipe,
                                   const char *pchVersion) = 0;
  virtual void *GetISteamGameServerStats(int32_t hSteamUser, int32_t hSteamPipe,
                                         const char *pchVersion) = 0;
  virtual void *GetISteamApps(int32_t hSteamUser, int32_t hSteamPipe,
                              const char *pchVersion) = 0;
  virtual void *GetISteamNetworking(int32_t hSteamUser, int32_t hSteamPipe,
                                    const char *pchVersion) = 0;
  virtual void *GetISteamRemoteStorage(int32_t hSteamUser, int32_t hSteamPipe,
                                       const char *pchVersion) = 0;
  virtual void *GetISteamScreenshots(int32_t hSteamUser, int32_t hSteamPipe,
                                     const char *pchVersion) = 0;
  virtual void RunFrame() = 0;
  virtual uint32_t GetIPCCallCount() = 0;
  virtual void SetWarningMessageHook(void *pFunction) = 0;
  virtual bool BShutdownIfAllPipesClosed() = 0;
  virtual void *GetISteamHTTP(int32_t hSteamUser, int32_t hSteamPipe,
                              const char *pchVersion) = 0;
  virtual void *GetISteamController(int32_t hSteamUser, int32_t hSteamPipe,
                                    const char *pchVersion) = 0;
  virtual void *GetISteamUGC(int32_t hSteamUser, int32_t hSteamPipe,
                             const char *pchVersion) = 0;
  virtual void *GetISteamMusic(int32_t hSteamUser, int32_t hSteamPipe,
                               const char *pchVersion) = 0;
  virtual void *GetISteamHTMLSurface(int32_t hSteamUser, int32_t hSteamPipe,
                                     const char *pchVersion) = 0;
  virtual void DEPRECATED_Set_SteamAPI_CPostAPIResultInProcess(void (*func)()) = 0;
  virtual void DEPRECATED_Remove_SteamAPI_CPostAPIResultInProcess(void (*func)()) = 0;
  virtual void Set_SteamAPI_CCheckCallbackRegisteredInProcess(
      uint32_t (*func)(int32_t iCallbackNum)) = 0;
  virtual void *GetISteamInventory(int32_t hSteamUser, int32_t hSteamPipe,
                                   const char *pchVersion) = 0;
  virtual void *GetISteamVideo(int32_t hSteamUser, int32_t hSteamPipe,
                               const char *pchVersion) = 0;
  virtual void *GetISteamParentalSettings(int32_t hSteamUser, int32_t hSteamPipe,
                                          const char *pchVersion) = 0;
  virtual void *GetISteamInput(int32_t hSteamUser, int32_t hSteamPipe,
                               const char *pchVersion) = 0;
  virtual void *GetISteamParties(int32_t hSteamUser, int32_t hSteamPipe,
                                 const char *pchVersion) = 0;
  virtual void *GetISteamRemotePlay(int32_t hSteamUser, int32_t hSteamPipe,
                                    const char *pchVersion) = 0;
  virtual void DestroyAllInterfaces() = 0;
};

class ISteamGameServerHeaderOnly {
 public:
  virtual bool InitGameServer(uint32_t unIP, uint16_t usGamePort, uint16_t usQueryPort,
                              uint32_t unFlags, uint32_t nGameAppId,
                              const char *pchVersionString) = 0;
  virtual void SetProduct(const char *pszProduct) = 0;
  virtual void SetGameDescription(const char *pszGameDescription) = 0;
  virtual void SetModDir(const char *pszModDir) = 0;
  virtual void SetDedicatedServer(bool bDedicated) = 0;
  virtual void LogOn(const char *pszToken) = 0;
  virtual void LogOnAnonymous() = 0;
  virtual void LogOff() = 0;
  virtual bool BLoggedOn() = 0;
  virtual bool BSecure() = 0;
  virtual uint64_t GetSteamID() = 0;
  virtual bool WasRestartRequested() = 0;
  virtual void SetMaxPlayerCount(int cPlayersMax) = 0;
  virtual void SetBotPlayerCount(int cBotplayers) = 0;
  virtual void SetServerName(const char *pszServerName) = 0;
  virtual void SetMapName(const char *pszMapName) = 0;
  virtual void SetPasswordProtected(bool bPasswordProtected) = 0;
  virtual void SetSpectatorPort(uint16_t unSpectatorPort) = 0;
  virtual void SetSpectatorServerName(const char *pszSpectatorServerName) = 0;
  virtual void ClearAllKeyValues() = 0;
  virtual void SetKeyValue(const char *pKey, const char *pValue) = 0;
  virtual void SetGameTags(const char *pchGameTags) = 0;
  virtual void SetGameData(const char *pchGameData) = 0;
  virtual void SetRegion(const char *pszRegion) = 0;
  virtual void SetAdvertiseServerActive(bool bActive) = 0;
  virtual uint32_t GetAuthSessionTicket(void *pTicket, int cbMaxTicket, uint32_t *pcbTicket,
                                        const void *pSnid) = 0;
  virtual int32_t BeginAuthSession(const void *pAuthTicket, int cbAuthTicket,
                                   uint64_t steamID) = 0;
  virtual void EndAuthSession(uint64_t steamID) = 0;
  virtual void CancelAuthTicket(uint32_t hAuthTicket) = 0;
  virtual int32_t UserHasLicenseForApp(uint64_t steamID, uint32_t appID) = 0;
  virtual bool RequestUserGroupStatus(uint64_t steamIDUser, uint64_t steamIDGroup) = 0;
  virtual void GetGameplayStats() = 0;
  virtual uint64_t GetServerReputation() = 0;
  virtual SteamIPAddressBridge GetPublicIP() = 0;
  virtual bool HandleIncomingPacket(const void *pData, int cbData, uint32_t srcIP,
                                    uint16_t srcPort) = 0;
  virtual int GetNextOutgoingPacket(void *pOut, int cbMaxOut, uint32_t *pNetAdr,
                                    uint16_t *pPort) = 0;
  virtual uint64_t AssociateWithClan(uint64_t steamIDClan) = 0;
  virtual uint64_t ComputeNewPlayerCompatibility(uint64_t steamIDNewPlayer) = 0;
  virtual bool SendUserConnectAndAuthenticate_DEPRECATED(uint32_t unIPClient,
                                                         const void *pvAuthBlob,
                                                         uint32_t cubAuthBlobSize,
                                                         uint64_t *pSteamIDUser) = 0;
  virtual uint64_t CreateUnauthenticatedUserConnection() = 0;
  virtual void SendUserDisconnect_DEPRECATED(uint64_t steamIDUser) = 0;
  virtual bool BUpdateUserData(uint64_t steamIDUser, const char *pchPlayerName,
                               uint32_t uScore) = 0;
  virtual void SetMasterServerHeartbeatInterval_DEPRECATED(int iHeartbeatInterval) = 0;
  virtual void ForceMasterServerHeartbeat_DEPRECATED() = 0;
};

class ISteamUtilsHeaderOnly {
 public:
  virtual uint32_t GetSecondsSinceAppActive() = 0;
  virtual uint32_t GetSecondsSinceComputerActive() = 0;
  virtual int32_t GetConnectedUniverse() = 0;
  virtual uint32_t GetServerRealTime() = 0;
  virtual const char *GetIPCountry() = 0;
  virtual bool GetImageSize(int iImage, uint32_t *pnWidth, uint32_t *pnHeight) = 0;
  virtual bool GetImageRGBA(int iImage, uint8_t *pubDest, int nDestBufferSize) = 0;
  virtual bool GetCSERIPPort(uint32_t *unIP, uint16_t *usPort) = 0;
};

ISteamClientHeaderOnly *steam_bridge_client_header_only() {
  return static_cast<ISteamClientHeaderOnly *>(
      SteamInternal_CreateInterface(kSteamClientInterfaceVersion));
}

ISteamGameServerHeaderOnly *steam_bridge_game_server_header_only() {
  return static_cast<ISteamGameServerHeaderOnly *>(SteamAPI_SteamGameServer_v015());
}

ISteamUtilsHeaderOnly *steam_bridge_utils_header_only() {
  return static_cast<ISteamUtilsHeaderOnly *>(SteamAPI_SteamUtils_v010());
}

}  // namespace

extern "C" bool steam_bridge_client_run_frame() {
  ISteamClientHeaderOnly *client = steam_bridge_client_header_only();
  if (client == nullptr) {
    return false;
  }
  client->RunFrame();
  return true;
}

extern "C" bool steam_bridge_client_set_post_api_result_in_process(void (*callback)()) {
  ISteamClientHeaderOnly *client = steam_bridge_client_header_only();
  if (client == nullptr) {
    return false;
  }
  client->DEPRECATED_Set_SteamAPI_CPostAPIResultInProcess(callback);
  return true;
}

extern "C" bool steam_bridge_client_remove_post_api_result_in_process(void (*callback)()) {
  ISteamClientHeaderOnly *client = steam_bridge_client_header_only();
  if (client == nullptr) {
    return false;
  }
  client->DEPRECATED_Remove_SteamAPI_CPostAPIResultInProcess(callback);
  return true;
}

extern "C" bool steam_bridge_client_set_check_callback_registered_in_process(
    uint32_t (*callback)(int32_t)) {
  ISteamClientHeaderOnly *client = steam_bridge_client_header_only();
  if (client == nullptr) {
    return false;
  }
  client->Set_SteamAPI_CCheckCallbackRegisteredInProcess(callback);
  return true;
}

extern "C" bool steam_bridge_client_destroy_all_interfaces() {
  ISteamClientHeaderOnly *client = steam_bridge_client_header_only();
  if (client == nullptr) {
    return false;
  }
  client->DestroyAllInterfaces();
  return true;
}

extern "C" bool steam_bridge_game_server_init_game_server(
    uint32_t ip, uint16_t game_port, uint16_t query_port, uint32_t flags, uint32_t app_id,
    const char *version) {
  ISteamGameServerHeaderOnly *server = steam_bridge_game_server_header_only();
  return server != nullptr && version != nullptr &&
         server->InitGameServer(ip, game_port, query_port, flags, app_id, version);
}

extern "C" void steam_bridge_game_server_set_master_server_heartbeat_interval_deprecated(
    int32_t heartbeat_interval) {
  ISteamGameServerHeaderOnly *server = steam_bridge_game_server_header_only();
  if (server != nullptr) {
    server->SetMasterServerHeartbeatInterval_DEPRECATED(heartbeat_interval);
  }
}

extern "C" void steam_bridge_game_server_force_master_server_heartbeat_deprecated() {
  ISteamGameServerHeaderOnly *server = steam_bridge_game_server_header_only();
  if (server != nullptr) {
    server->ForceMasterServerHeartbeat_DEPRECATED();
  }
}

extern "C" bool steam_bridge_utils_get_cser_ip_port(uint32_t *ip, uint16_t *port) {
  ISteamUtilsHeaderOnly *utils = steam_bridge_utils_header_only();
  return utils != nullptr && ip != nullptr && port != nullptr && utils->GetCSERIPPort(ip, port);
}
