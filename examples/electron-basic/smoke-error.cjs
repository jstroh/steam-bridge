function serializeSmokeError(error) {
  if (error instanceof Error) {
    return serializeErrorObject(error);
  }

  if (error && typeof error === "object") {
    return serializeErrorObject(error);
  }

  return {
    name: "Error",
    message: String(error)
  };
}

function serializeErrorObject(error) {
  const source = error;
  const serialized = {
    name: typeof source.name === "string" && source.name ? source.name : "Error",
    message: typeof source.message === "string" ? source.message : String(source)
  };

  if (typeof source.stack === "string") {
    serialized.stack = source.stack;
  }
  copyStringField(serialized, source, "code");
  copyStringField(serialized, source, "reason");
  copyStringField(serialized, source, "state");
  copyNumberField(serialized, source, "timeoutMs");
  copyOverlayTargetSnapshot(serialized, source, "targetSnapshot");
  copyOverlayTargetSnapshot(serialized, source, "checkoutTargetSnapshot");
  copyMacOverlayEnvironment(serialized, source);
  return serialized;
}

function copyStringField(target, source, field) {
  if (typeof source[field] === "string" && source[field]) {
    target[field] = source[field];
  }
}

function copyNumberField(target, source, field) {
  if (typeof source[field] === "number" && Number.isFinite(source[field])) {
    target[field] = source[field];
  }
}

function copyOverlayTargetSnapshot(target, source, field) {
  const snapshot = source[field];
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  const serialized = {};
  copyStringField(serialized, snapshot, "type");
  copyNumberField(serialized, snapshot, "appId");
  copyNumberField(serialized, snapshot, "flag");
  copyStringOrNumberField(serialized, snapshot, "dialog");
  copyStringField(serialized, snapshot, "route");
  copyBooleanField(serialized, snapshot, "modal");
  copyBooleanField(serialized, snapshot, "hasUrl");
  copyBooleanField(serialized, snapshot, "hasSteamUrl");
  copyBooleanField(serialized, snapshot, "hasTransactionId");
  copyBooleanField(serialized, snapshot, "hasReturnUrl");
  copyBooleanField(serialized, snapshot, "hasSteamId64");

  if (typeof serialized.type === "string") {
    target[field] = serialized;
  }
}

function copyStringOrNumberField(target, source, field) {
  if (typeof source[field] === "string" || typeof source[field] === "number") {
    target[field] = source[field];
  }
}

function copyBooleanField(target, source, field) {
  if (typeof source[field] === "boolean") {
    target[field] = source[field];
  }
}

function copyMacOverlayEnvironment(target, source) {
  const environment = source.macOverlayEnvironment;
  if (!environment || typeof environment !== "object") {
    return;
  }

  target.macOverlayEnvironment = {
    screenLocked: Boolean(environment.screenLocked),
    displayAsleep: Boolean(environment.displayAsleep)
  };
}

module.exports = {
  serializeSmokeError
};
