function readNpmPackEntries(stdout) {
  const parsed = JSON.parse(stdout);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed && typeof parsed === "object") {
    return Object.values(parsed);
  }
  return [];
}

module.exports = {
  readNpmPackEntries
};
