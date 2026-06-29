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
  copyMacOverlayEnvironment(serialized, source);
  return serialized;
}

function copyStringField(target, source, field) {
  if (typeof source[field] === "string" && source[field]) {
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
