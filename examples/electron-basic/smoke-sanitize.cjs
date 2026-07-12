const SENSITIVE_KEY_NAMES = new Set([
  "accountid",
  "apikey",
  "apitoken",
  "authkey",
  "authticket",
  "checkoutjsonfile",
  "checkouturl",
  "inittxnapikey",
  "inittxnapikeyenv",
  "inittxnrequestfile",
  "cookie",
  "key",
  "orderid",
  "password",
  "prefixhex",
  "publisherkey",
  "returnurl",
  "secret",
  "sessionid",
  "steamid",
  "steamid32",
  "steamid64",
  "steamurl",
  "ticket",
  "ticketbase64",
  "token",
  "transactionid",
  "transid",
  "txnid",
  "url",
  "userid"
]);

const SENSITIVE_KEY_PARTS = [
  "apikey",
  "authticket",
  "checkouturl",
  "inittxnapikey",
  "inittxnrequest",
  "orderid",
  "publisherkey",
  "returnurl",
  "secret",
  "sessionid",
  "steamurl",
  "transactionid",
  "transid",
  "ticketbase64",
  "txnid"
];

const SENSITIVE_ARG_PREFIXES = [
  "--steam-bridge-smoke-checkout-url",
  "--steam-bridge-smoke-checkout-return-url",
  "--steam-bridge-smoke-checkout-transaction-id",
  "--steam-bridge-smoke-checkout-json-file",
  "--steam-bridge-smoke-init-txn-api-key-env",
  "--steam-bridge-smoke-init-txn-request-file",
  "--steam-bridge-smoke-control-token"
];

const CHECKOUT_URL_PATTERN = /https?:\/\/checkout\.steampowered\.com\/checkout\/approvetxn\/[^/\s"'<>]+/i;
const STEAM_ID64_PATTERN = /\b7656119\d{10}\b/g;

function sanitizeSmokeValue(value) {
  return sanitizeValue(value);
}

function sanitizeValue(value, key) {
  if (isSensitiveKey(key)) {
    if (isRedactionMarker(value)) {
      return {
        redacted: true,
        present: value.present,
        type: value.type
      };
    }
    return redactValue(value);
  }

  if (typeof value === "bigint") {
    return sanitizeString(value.toString());
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Buffer.isBuffer(value)) {
    return {
      type: "Buffer",
      byteLength: value.length,
      redacted: true
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, key));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([entryKey, entry]) => [entryKey, sanitizeValue(entry, entryKey)]));
  }

  return value;
}

function isRedactionMarker(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  return (
    keys.length === 3 &&
    keys[0] === "present" &&
    keys[1] === "redacted" &&
    keys[2] === "type" &&
    value.redacted === true &&
    typeof value.present === "boolean" &&
    typeof value.type === "string"
  );
}

function sanitizeString(value) {
  if (!value) {
    return value;
  }
  if (isSensitiveCliArgument(value) || CHECKOUT_URL_PATTERN.test(value) || value.startsWith("steam://return")) {
    return redactValue(value);
  }
  return value.replace(STEAM_ID64_PATTERN, "[redacted-steam-id]");
}

function isSensitiveCliArgument(value) {
  const trimmed = value.trim().toLowerCase();
  return SENSITIVE_ARG_PREFIXES.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}=`));
}

function isSensitiveKey(key) {
  if (!key) {
    return false;
  }
  const normalized = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!normalized || normalized.startsWith("has")) {
    return false;
  }
  return (
    SENSITIVE_KEY_NAMES.has(normalized) ||
    SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
  );
}

function redactValue(value) {
  return {
    redacted: true,
    present: value !== undefined && value !== null && value !== "",
    type: Buffer.isBuffer(value) ? "buffer" : Array.isArray(value) ? "array" : typeof value
  };
}

module.exports = {
  sanitizeSmokeValue
};
