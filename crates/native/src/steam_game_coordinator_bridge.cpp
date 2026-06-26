#include <cstdint>

extern "C" int32_t SteamAPI_GetHSteamUser();
extern "C" void *SteamInternal_FindOrCreateUserInterface(int32_t hSteamUser, const char *version);

namespace {

// steamworks-sys 0.13 ships isteamgamecoordinator.h, but this legacy interface
// is omitted from the generated flat bindings. Keep this vtable layout in sync
// with SteamGameCoordinator001.
enum EGCResults {
  k_EGCResultOK = 0,
  k_EGCResultNoMessage = 1,
  k_EGCResultBufferTooSmall = 2,
  k_EGCResultNotLoggedOn = 3,
  k_EGCResultInvalidMessage = 4,
};

class ISteamGameCoordinator {
 public:
  virtual EGCResults SendMessage(uint32_t unMsgType, const void *pubData, uint32_t cubData) = 0;
  virtual bool IsMessageAvailable(uint32_t *pcubMsgSize) = 0;
  virtual EGCResults RetrieveMessage(
      uint32_t *punMsgType, void *pubDest, uint32_t cubDest, uint32_t *pcubMsgSize) = 0;
};

ISteamGameCoordinator *steam_bridge_game_coordinator() {
  return static_cast<ISteamGameCoordinator *>(SteamInternal_FindOrCreateUserInterface(
      SteamAPI_GetHSteamUser(), "SteamGameCoordinator001"));
}

}  // namespace

extern "C" int32_t steam_bridge_game_coordinator_send_message(
    uint32_t message_type, const uint8_t *data, uint32_t data_length) {
  ISteamGameCoordinator *coordinator = steam_bridge_game_coordinator();
  if (coordinator == nullptr || (data == nullptr && data_length > 0)) {
    return k_EGCResultNotLoggedOn;
  }
  return static_cast<int32_t>(coordinator->SendMessage(message_type, data, data_length));
}

extern "C" bool steam_bridge_game_coordinator_is_message_available(uint32_t *message_size) {
  ISteamGameCoordinator *coordinator = steam_bridge_game_coordinator();
  return coordinator != nullptr && message_size != nullptr &&
         coordinator->IsMessageAvailable(message_size);
}

extern "C" int32_t steam_bridge_game_coordinator_retrieve_message(
    uint32_t *message_type, uint8_t *data, uint32_t data_length, uint32_t *message_size) {
  ISteamGameCoordinator *coordinator = steam_bridge_game_coordinator();
  if (coordinator == nullptr || message_type == nullptr || message_size == nullptr ||
      (data == nullptr && data_length > 0)) {
    return k_EGCResultNotLoggedOn;
  }
  return static_cast<int32_t>(
      coordinator->RetrieveMessage(message_type, data, data_length, message_size));
}
