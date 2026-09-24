#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define STEAM_BRIDGE_MACOS_LAUNCHER_ID "STEAM_BRIDGE_MACOS_ENV_LAUNCHER_V1"

__attribute__((used)) static const char steam_bridge_macos_launcher_id[] = STEAM_BRIDGE_MACOS_LAUNCHER_ID;

static const char *value_after_equals(const char *arg, const char *name) {
  size_t name_len = strlen(name);
  if (strncmp(arg, name, name_len) != 0 || arg[name_len] != '=') {
    return NULL;
  }
  return arg + name_len + 1;
}

static char *copy_string(const char *value) {
  char *copy = strdup(value);
  if (!copy) {
    perror("strdup");
    exit(2);
  }
  return copy;
}

static char *copy_executable_path(const char *path) {
  if (access(path, X_OK) != 0) {
    return NULL;
  }
  return copy_string(path);
}

static void resolve_launcher_path(const char *argv0, char launcher_path[PATH_MAX]) {
  if (realpath(argv0, launcher_path) == NULL) {
    if (strchr(argv0, '/')) {
      if (snprintf(launcher_path, PATH_MAX, "%s", argv0) >= (int)PATH_MAX) {
        fprintf(stderr, "Launcher path is too long: %s\n", argv0);
        exit(2);
      }
    } else if (getcwd(launcher_path, PATH_MAX) == NULL) {
      perror("getcwd");
      exit(2);
    } else {
      size_t used = strlen(launcher_path);
      if (snprintf(launcher_path + used, PATH_MAX - used, "/%s", argv0) >=
          (int)(PATH_MAX - used)) {
        fprintf(stderr, "Launcher path is too long: %s\n", argv0);
        exit(2);
      }
    }
  }
}

static char *default_target_for_launcher(const char *argv0) {
  char launcher_path[PATH_MAX];
  char directory[PATH_MAX];
  char target[PATH_MAX];
  const char *last_slash;
  const char *base_name;
  char *resolved_target;

  resolve_launcher_path(argv0, launcher_path);
  last_slash = strrchr(launcher_path, '/');
  if (!last_slash) {
    fprintf(stderr, "Cannot resolve launcher directory from: %s\n", launcher_path);
    exit(2);
  }

  size_t dir_len = (size_t)(last_slash - launcher_path);
  if (dir_len >= sizeof(directory)) {
    fprintf(stderr, "Launcher directory is too long: %s\n", launcher_path);
    exit(2);
  }
  memcpy(directory, launcher_path, dir_len);
  directory[dir_len] = '\0';
  base_name = last_slash + 1;

  if (snprintf(target, sizeof(target), "%s/%s.electron", directory, base_name) >= (int)sizeof(target)) {
    fprintf(stderr, "Sibling Electron target path is too long under: %s\n", directory);
    exit(2);
  }
  resolved_target = copy_executable_path(target);
  if (resolved_target) {
    return resolved_target;
  }

  if (snprintf(
        target,
        sizeof(target),
        "%s/%s.app/Contents/MacOS/%s.electron",
        directory,
        base_name,
        base_name
      ) >= (int)sizeof(target)) {
    fprintf(stderr, "Nested Electron target path is too long under: %s\n", directory);
    exit(2);
  }
  resolved_target = copy_executable_path(target);
  if (resolved_target) {
    return resolved_target;
  }

  if (snprintf(target, sizeof(target), "%s/%s.app/Contents/MacOS/%s", directory, base_name, base_name) >=
      (int)sizeof(target)) {
    fprintf(stderr, "Nested app target path is too long under: %s\n", directory);
    exit(2);
  }
  resolved_target = copy_executable_path(target);
  if (resolved_target) {
    return resolved_target;
  }

  fprintf(
    stderr,
    "Cannot infer Electron target for launcher %s. Pass --steam-bridge-launch-target or place an executable "
    "%s.electron beside the launcher.\n",
    launcher_path,
    base_name
  );
  exit(2);
}

static char *confined_explicit_target(const char *argv0, const char *requested) {
  char launcher_path[PATH_MAX];
  char directory[PATH_MAX];
  char resolved_directory[PATH_MAX];
  char resolved_target[PATH_MAX];
  const char *last_slash;
  size_t directory_length;

  resolve_launcher_path(argv0, launcher_path);
  last_slash = strrchr(launcher_path, '/');
  if (!last_slash || (size_t)(last_slash - launcher_path) >= sizeof(directory)) {
    fprintf(stderr, "Cannot resolve launcher directory from: %s\n", launcher_path);
    exit(2);
  }
  memcpy(directory, launcher_path, (size_t)(last_slash - launcher_path));
  directory[last_slash - launcher_path] = '\0';
  if (realpath(directory[0] ? directory : "/", resolved_directory) == NULL ||
      realpath(requested, resolved_target) == NULL) {
    fprintf(stderr, "Cannot resolve launch target %s: %s\n", requested, strerror(errno));
    exit(2);
  }
  directory_length = strlen(resolved_directory);
  if (strncmp(resolved_target, resolved_directory, directory_length) != 0 ||
      resolved_target[directory_length] != '/' || access(resolved_target, X_OK) != 0) {
    fprintf(
      stderr,
      "Launch target %s must be an executable inside the launcher directory %s\n",
      requested,
      resolved_directory
    );
    exit(2);
  }
  return copy_string(resolved_target);
}

static int is_allowed_env_file_name(const char *name) {
  if (strcmp(name, "SteamAppId") == 0 || strcmp(name, "SteamGameId") == 0 ||
      strcmp(name, "SteamOverlayGameId") == 0) {
    return 1;
  }
  return strncmp(name, "STEAM_BRIDGE_", strlen("STEAM_BRIDGE_")) == 0 &&
    strcmp(name, "STEAM_BRIDGE_NATIVE_PATH") != 0 &&
    strncmp(name, "STEAM_BRIDGE_MACOS_NATIVE_LAUNCHER", strlen("STEAM_BRIDGE_MACOS_NATIVE_LAUNCHER")) != 0;
}

static const char *read_option_value(int argc, char **argv, int *index, const char *name) {
  const char *inline_value = value_after_equals(argv[*index], name);
  if (inline_value) {
    return inline_value;
  }

  if (strcmp(argv[*index], name) == 0) {
    *index += 1;
    if (*index >= argc) {
      fprintf(stderr, "Missing value for %s\n", name);
      exit(2);
    }
    return argv[*index];
  }

  return NULL;
}

static void set_required_env(const char *name, const char *value) {
  if (!value || value[0] == '\0') {
    return;
  }
  if (setenv(name, value, 1) != 0) {
    fprintf(stderr, "Failed to set %s: %s\n", name, strerror(errno));
    exit(2);
  }
}

static int is_env_name_char(char value) {
  return (value >= 'A' && value <= 'Z') || (value >= 'a' && value <= 'z') || (value >= '0' && value <= '9') ||
    value == '_';
}

static void read_env_file(const char *path) {
  FILE *file;
  char line[8192];
  unsigned long line_number = 0;

  if (!path || path[0] == '\0') {
    return;
  }

  file = fopen(path, "r");
  if (!file) {
    fprintf(stderr, "Failed to open launcher env file %s: %s\n", path, strerror(errno));
    exit(2);
  }

  while (fgets(line, sizeof(line), file)) {
    char *equals;
    char *value;
    size_t length;

    line_number += 1;
    length = strlen(line);
    while (length > 0 && (line[length - 1] == '\n' || line[length - 1] == '\r')) {
      line[--length] = '\0';
    }
    if (length == sizeof(line) - 1 && line[length - 1] != '\0') {
      fprintf(stderr, "Launcher env file line is too long at %s:%lu\n", path, line_number);
      fclose(file);
      exit(2);
    }
    if (line[0] == '\0' || line[0] == '#') {
      continue;
    }

    equals = strchr(line, '=');
    if (!equals || equals == line) {
      fprintf(stderr, "Invalid launcher env file line at %s:%lu\n", path, line_number);
      fclose(file);
      exit(2);
    }

    *equals = '\0';
    value = equals + 1;
    for (char *name_cursor = line; *name_cursor; name_cursor += 1) {
      if (!is_env_name_char(*name_cursor)) {
        fprintf(stderr, "Invalid environment variable name at %s:%lu: %s\n", path, line_number, line);
        fclose(file);
        exit(2);
      }
    }
    if (!is_allowed_env_file_name(line)) {
      fprintf(stderr, "Launcher env file may not set %s at %s:%lu\n", line, path, line_number);
      fclose(file);
      exit(2);
    }
    if (setenv(line, value, 1) != 0) {
      fprintf(stderr, "Failed to set %s from %s:%lu: %s\n", line, path, line_number, strerror(errno));
      fclose(file);
      exit(2);
    }
  }

  if (ferror(file)) {
    fprintf(stderr, "Failed to read launcher env file %s: %s\n", path, strerror(errno));
    fclose(file);
    exit(2);
  }
  fclose(file);
}

int main(int argc, char **argv) {
  char *target = NULL;
  const char *requested_target = NULL;
  const char *app_id = NULL;
  const char *overlay_game_id = NULL;
  const char *env_file = NULL;
  char **child_argv = calloc((size_t)argc + 1, sizeof(char *));
  int child_argc = 1;

  if (!child_argv) {
    perror("calloc");
    return 2;
  }

  for (int index = 1; index < argc; index += 1) {
    const char *value;

    value = read_option_value(argc, argv, &index, "--steam-bridge-launch-target");
    if (value) {
      requested_target = value;
      continue;
    }

    value = read_option_value(argc, argv, &index, "--steam-bridge-launch-app-id");
    if (value) {
      app_id = value;
      continue;
    }

    value = read_option_value(argc, argv, &index, "--steam-bridge-launch-overlay-game-id");
    if (value) {
      overlay_game_id = value;
      continue;
    }

    value = read_option_value(argc, argv, &index, "--steam-bridge-launch-env-file");
    if (value) {
      env_file = value;
      continue;
    }

    if (strcmp(argv[index], "--") == 0) {
      for (index += 1; index < argc; index += 1) {
        child_argv[child_argc++] = argv[index];
      }
      break;
    }

    child_argv[child_argc++] = argv[index];
  }

  target = requested_target ? confined_explicit_target(argv[0], requested_target)
                           : default_target_for_launcher(argv[0]);

  read_env_file(env_file);
  set_required_env("SteamAppId", app_id);
  set_required_env("SteamGameId", app_id);
  set_required_env("SteamOverlayGameId", overlay_game_id ? overlay_game_id : app_id);
  set_required_env("STEAM_BRIDGE_MACOS_NATIVE_LAUNCHER", "1");
  set_required_env("STEAM_BRIDGE_MACOS_NATIVE_LAUNCHER_TARGET", target);

  child_argv[0] = target;
  child_argv[child_argc] = NULL;

  execv(target, child_argv);
  fprintf(stderr, "Failed to exec %s: %s\n", target, strerror(errno));
  return 127;
}
