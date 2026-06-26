#include <cstdint>

extern "C" void *SteamAPI_SteamGameServer_v015();
extern "C" void *SteamAPI_SteamUtils_v010();

namespace {

// These methods are present in the SDK C++ headers but omitted from
// steam_api_flat.h. Keep the vtable layouts in sync with SteamGameServer015 and
// SteamUtils010.
struct SteamIPAddressBridge {
  uint8_t bytes[20];
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

ISteamGameServerHeaderOnly *steam_bridge_game_server_header_only() {
  return static_cast<ISteamGameServerHeaderOnly *>(SteamAPI_SteamGameServer_v015());
}

ISteamUtilsHeaderOnly *steam_bridge_utils_header_only() {
  return static_cast<ISteamUtilsHeaderOnly *>(SteamAPI_SteamUtils_v010());
}

}  // namespace

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
