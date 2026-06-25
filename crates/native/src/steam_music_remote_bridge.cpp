#include <cstdint>

extern "C" int32_t SteamAPI_GetHSteamUser();
extern "C" void *SteamInternal_FindOrCreateUserInterface(int32_t hSteamUser, const char *version);

namespace {

// steamworks-sys 0.13 ships isteammusicremote.h, but this interface is omitted
// from the generated macOS flat bindings. Keep this vtable layout in sync with
// STEAMMUSICREMOTE_INTERFACE_VERSION001.
enum AudioPlayback_Status {
  AudioPlayback_Undefined = 0,
  AudioPlayback_Playing = 1,
  AudioPlayback_Paused = 2,
  AudioPlayback_Idle = 3,
};

class ISteamMusicRemote {
 public:
  virtual bool RegisterSteamMusicRemote(const char *pchName) = 0;
  virtual bool DeregisterSteamMusicRemote() = 0;
  virtual bool BIsCurrentMusicRemote() = 0;
  virtual bool BActivationSuccess(bool bValue) = 0;

  virtual bool SetDisplayName(const char *pchDisplayName) = 0;
  virtual bool SetPNGIcon_64x64(void *pvBuffer, uint32_t cbBufferLength) = 0;

  virtual bool EnablePlayPrevious(bool bValue) = 0;
  virtual bool EnablePlayNext(bool bValue) = 0;
  virtual bool EnableShuffled(bool bValue) = 0;
  virtual bool EnableLooped(bool bValue) = 0;
  virtual bool EnableQueue(bool bValue) = 0;
  virtual bool EnablePlaylists(bool bValue) = 0;

  virtual bool UpdatePlaybackStatus(AudioPlayback_Status nStatus) = 0;
  virtual bool UpdateShuffled(bool bValue) = 0;
  virtual bool UpdateLooped(bool bValue) = 0;
  virtual bool UpdateVolume(float flValue) = 0;

  virtual bool CurrentEntryWillChange() = 0;
  virtual bool CurrentEntryIsAvailable(bool bAvailable) = 0;
  virtual bool UpdateCurrentEntryText(const char *pchText) = 0;
  virtual bool UpdateCurrentEntryElapsedSeconds(int nValue) = 0;
  virtual bool UpdateCurrentEntryCoverArt(void *pvBuffer, uint32_t cbBufferLength) = 0;
  virtual bool CurrentEntryDidChange() = 0;

  virtual bool QueueWillChange() = 0;
  virtual bool ResetQueueEntries() = 0;
  virtual bool SetQueueEntry(int nID, int nPosition, const char *pchEntryText) = 0;
  virtual bool SetCurrentQueueEntry(int nID) = 0;
  virtual bool QueueDidChange() = 0;

  virtual bool PlaylistWillChange() = 0;
  virtual bool ResetPlaylistEntries() = 0;
  virtual bool SetPlaylistEntry(int nID, int nPosition, const char *pchEntryText) = 0;
  virtual bool SetCurrentPlaylistEntry(int nID) = 0;
  virtual bool PlaylistDidChange() = 0;
};

ISteamMusicRemote *steam_bridge_music_remote() {
  return static_cast<ISteamMusicRemote *>(SteamInternal_FindOrCreateUserInterface(
      SteamAPI_GetHSteamUser(), "STEAMMUSICREMOTE_INTERFACE_VERSION001"));
}

}  // namespace

#define STEAM_BRIDGE_MUSIC_REMOTE_CALL(method, ...)       \
  ISteamMusicRemote *remote = steam_bridge_music_remote(); \
  return remote != nullptr && remote->method(__VA_ARGS__)

extern "C" bool steam_bridge_music_remote_register(const char *name) {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && name != nullptr && remote->RegisterSteamMusicRemote(name);
}

extern "C" bool steam_bridge_music_remote_deregister() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->DeregisterSteamMusicRemote();
}

extern "C" bool steam_bridge_music_remote_is_current() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->BIsCurrentMusicRemote();
}

extern "C" bool steam_bridge_music_remote_activation_success(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(BActivationSuccess, value);
}

extern "C" bool steam_bridge_music_remote_set_display_name(const char *display_name) {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && display_name != nullptr && remote->SetDisplayName(display_name);
}

extern "C" bool steam_bridge_music_remote_set_png_icon_64x64(
    const uint8_t *data, uint32_t data_length) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(SetPNGIcon_64x64, const_cast<uint8_t *>(data), data_length);
}

extern "C" bool steam_bridge_music_remote_enable_play_previous(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(EnablePlayPrevious, value);
}

extern "C" bool steam_bridge_music_remote_enable_play_next(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(EnablePlayNext, value);
}

extern "C" bool steam_bridge_music_remote_enable_shuffled(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(EnableShuffled, value);
}

extern "C" bool steam_bridge_music_remote_enable_looped(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(EnableLooped, value);
}

extern "C" bool steam_bridge_music_remote_enable_queue(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(EnableQueue, value);
}

extern "C" bool steam_bridge_music_remote_enable_playlists(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(EnablePlaylists, value);
}

extern "C" bool steam_bridge_music_remote_update_playback_status(int32_t status) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(UpdatePlaybackStatus, static_cast<AudioPlayback_Status>(status));
}

extern "C" bool steam_bridge_music_remote_update_shuffled(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(UpdateShuffled, value);
}

extern "C" bool steam_bridge_music_remote_update_looped(bool value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(UpdateLooped, value);
}

extern "C" bool steam_bridge_music_remote_update_volume(float value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(UpdateVolume, value);
}

extern "C" bool steam_bridge_music_remote_current_entry_will_change() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->CurrentEntryWillChange();
}

extern "C" bool steam_bridge_music_remote_current_entry_is_available(bool available) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(CurrentEntryIsAvailable, available);
}

extern "C" bool steam_bridge_music_remote_update_current_entry_text(const char *text) {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && text != nullptr && remote->UpdateCurrentEntryText(text);
}

extern "C" bool steam_bridge_music_remote_update_current_entry_elapsed_seconds(int32_t value) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(UpdateCurrentEntryElapsedSeconds, value);
}

extern "C" bool steam_bridge_music_remote_update_current_entry_cover_art(
    const uint8_t *data, uint32_t data_length) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(UpdateCurrentEntryCoverArt, const_cast<uint8_t *>(data), data_length);
}

extern "C" bool steam_bridge_music_remote_current_entry_did_change() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->CurrentEntryDidChange();
}

extern "C" bool steam_bridge_music_remote_queue_will_change() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->QueueWillChange();
}

extern "C" bool steam_bridge_music_remote_reset_queue_entries() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->ResetQueueEntries();
}

extern "C" bool steam_bridge_music_remote_set_queue_entry(
    int32_t id, int32_t position, const char *entry_text) {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && entry_text != nullptr &&
         remote->SetQueueEntry(id, position, entry_text);
}

extern "C" bool steam_bridge_music_remote_set_current_queue_entry(int32_t id) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(SetCurrentQueueEntry, id);
}

extern "C" bool steam_bridge_music_remote_queue_did_change() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->QueueDidChange();
}

extern "C" bool steam_bridge_music_remote_playlist_will_change() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->PlaylistWillChange();
}

extern "C" bool steam_bridge_music_remote_reset_playlist_entries() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->ResetPlaylistEntries();
}

extern "C" bool steam_bridge_music_remote_set_playlist_entry(
    int32_t id, int32_t position, const char *entry_text) {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && entry_text != nullptr &&
         remote->SetPlaylistEntry(id, position, entry_text);
}

extern "C" bool steam_bridge_music_remote_set_current_playlist_entry(int32_t id) {
  STEAM_BRIDGE_MUSIC_REMOTE_CALL(SetCurrentPlaylistEntry, id);
}

extern "C" bool steam_bridge_music_remote_playlist_did_change() {
  ISteamMusicRemote *remote = steam_bridge_music_remote();
  return remote != nullptr && remote->PlaylistDidChange();
}
