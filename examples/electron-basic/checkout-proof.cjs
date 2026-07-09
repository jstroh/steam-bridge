const CLIENT_SESSION_QUERY_SCHEMA = 1;

const CLIENT_SESSION_QUERY_FIELDS = Object.freeze([
  "schema",
  "attempted",
  "reason",
  "endpoint",
  "id",
  "ok",
  "httpStatus",
  "result",
  "status",
  "errorCode",
  "requestError",
  "hasErrorDescription",
  "hasTransactionId",
  "hasOrderId",
  "hasSteamId64"
]);

const MICRO_TXN_RESULTS = new Map([
  ["ok", "OK"],
  ["failure", "Failure"]
]);

const MICRO_TXN_STATUSES = new Map(
  [
    "Init",
    "Approved",
    "Succeeded",
    "Failed",
    "Refunded",
    "PartialRefund",
    "Chargedback",
    "RefundedSuspectedFraud",
    "RefundedFriendlyFraud"
  ].map((value) => [value.toLowerCase(), value])
);

const MICRO_TXN_ERROR_CODES = new Set([
  ...Array.from({ length: 16 }, (_, index) => String(index + 1)),
  ...Array.from({ length: 8 }, (_, index) => String(index + 100))
]);

function startManagedCheckoutOperation(overlay, operation, options = {}, hooks = {}) {
  if (!overlay || typeof overlay.openCheckoutAndWait !== "function") {
    throw new TypeError("A managed Steam overlay is required for checkout proof.");
  }
  if (typeof operation !== "function") {
    throw new TypeError("A checkout operation function is required.");
  }

  return overlay.openCheckoutAndWait(async () => {
    try {
      hooks.onOperationStart?.();
      const completed = await operation();
      hooks.onOperationComplete?.(completed);
      return completed.transaction;
    } catch (error) {
      hooks.onOperationError?.(error);
      throw error;
    }
  }, options);
}

function createMicroTxnCheckoutCorrelationTracker() {
  let active;

  return {
    begin({ appId, orderId } = {}) {
      if (active) {
        throw new Error("A checkout callback correlation is already active.");
      }
      const normalizedAppId = normalizeAppId(appId);
      const normalizedOrderId = normalizeUnsignedIntegerString(orderId);
      const token = Symbol("microtxn-checkout-correlation");
      const prepared = normalizedAppId !== undefined && normalizedOrderId !== "";
      active = prepared ? { token, appId: normalizedAppId, orderId: normalizedOrderId } : undefined;

      return {
        prepared,
        release() {
          if (active?.token === token) {
            active = undefined;
          }
        }
      };
    },
    matches(event) {
      if (!active) {
        return false;
      }
      const payload = microTxnPayload(event);
      const appId = readFirstValue(payload, ["appId", "app_id", "m_unAppID", "m_nAppID"]);
      const orderId = readFirstValue(payload, ["orderId", "orderID", "order_id", "orderid", "m_ulOrderID", "m_ulOrderId"]);
      return normalizeAppId(appId) === active.appId && normalizeUnsignedIntegerString(orderId) === active.orderId;
    },
    clear() {
      active = undefined;
    }
  };
}

function microTxnAuthorizationDiagnostic(event) {
  const payload = microTxnPayload(event);
  const appId = readFirstValue(payload, ["appId", "app_id", "m_unAppID", "m_nAppID"]);
  const orderId = readFirstValue(payload, ["orderId", "orderID", "order_id", "orderid", "m_ulOrderID", "m_ulOrderId"]);
  const authorized = readFirstValue(payload, ["authorized", "m_bAuthorized"]);
  return {
    appId: normalizeAppId(appId),
    authorized: normalizeAuthorization(authorized),
    hasOrderId: normalizeUnsignedIntegerString(orderId) !== ""
  };
}

function checkoutCallbackCorrelationFromResult(result, appId) {
  const source = findCheckoutTargetSource(result);
  return {
    appId,
    orderId: source ? readUnambiguousCheckoutOrderId(source) : undefined
  };
}

function readUnambiguousCheckoutOrderId(source) {
  const normalized = ["orderId", "orderID", "order_id", "orderid"]
    .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
    .map((key) => normalizeUnsignedIntegerString(source[key]))
    .filter(Boolean);
  const unique = [...new Set(normalized)];
  return unique.length === 1 ? unique[0] : undefined;
}

function findCheckoutTargetSource(value, seen = new Set(), depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || seen.has(value) || depth > 8) {
    return undefined;
  }
  seen.add(value);

  if (isSteamWebApiResponseEnvelope(value)) {
    const responseSource = findCheckoutTargetSource(value.data, seen, depth + 1);
    if (responseSource) {
      return responseSource;
    }
  }

  if (hasCheckoutTargetField(value)) {
    return value;
  }

  for (const key of ["data", "response", "params"]) {
    const source = findCheckoutTargetSource(value[key], seen, depth + 1);
    if (source) {
      return source;
    }
  }
  return undefined;
}

function isSteamWebApiResponseEnvelope(value) {
  return (
    Object.prototype.hasOwnProperty.call(value, "data") &&
    ["ok", "status", "headers", "text"].some((key) => Object.prototype.hasOwnProperty.call(value, key))
  );
}

function hasCheckoutTargetField(value) {
  return [
    "type",
    "url",
    "steamUrl",
    "steamurl",
    "transactionId",
    "transactionID",
    "transid",
    "returnUrl",
    "returnurl",
    "modal"
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function summarizeClientSessionQueryTxnResponse(response, context = {}) {
  const data = objectOrEmpty(response && response.data);
  const envelope = objectOrEmpty(data.response);
  const params = objectOrEmpty(envelope.params);
  const error = objectOrEmpty(envelope.error);
  return {
    schema: CLIENT_SESSION_QUERY_SCHEMA,
    attempted: true,
    reason: "none",
    endpoint: normalizeQueryEndpoint(context.endpoint),
    id: normalizeQueryId(context.id),
    ok: Boolean(response && response.ok),
    httpStatus: normalizeHttpStatus(response && response.status),
    result: normalizeMicroTxnResult(envelope.result),
    status: normalizeMicroTxnStatus(params.status),
    errorCode: normalizeMicroTxnErrorCode(error.errorcode ?? error.errorCode),
    requestError: "none",
    hasErrorDescription: hasPresentValue(error.errordesc ?? error.errorDescription),
    hasTransactionId: Boolean(
      context.queriedTransactionId === true || hasPresentValue(params.transid ?? params.transactionId)
    ),
    hasOrderId: Boolean(context.queriedOrderId === true || hasPresentValue(params.orderid ?? params.orderId)),
    hasSteamId64: hasPresentValue(params.steamid ?? params.steamId64 ?? params.steamId)
  };
}

function clientSessionQueryErrorDiagnostic(error, context = {}) {
  const timedOut = isAbortError(error);
  return {
    schema: CLIENT_SESSION_QUERY_SCHEMA,
    attempted: true,
    reason: "none",
    endpoint: normalizeQueryEndpoint(context.endpoint),
    id: normalizeQueryId(context.id),
    ok: false,
    httpStatus: null,
    result: "missing",
    status: "missing",
    errorCode: "missing",
    requestError: timedOut ? "timeout" : "request-failed",
    hasErrorDescription: false,
    hasTransactionId: context.queriedTransactionId === true,
    hasOrderId: context.queriedOrderId === true,
    hasSteamId64: false
  };
}

function clientSessionQuerySkippedDiagnostic(reason, context = {}) {
  return {
    schema: CLIENT_SESSION_QUERY_SCHEMA,
    attempted: false,
    reason: normalizeQueryReason(reason),
    endpoint: normalizeQueryEndpoint(context.endpoint),
    id: normalizeQueryId(context.id),
    ok: false,
    httpStatus: null,
    result: "missing",
    status: "missing",
    errorCode: "missing",
    requestError: "none",
    hasErrorDescription: false,
    hasTransactionId: context.queriedTransactionId === true,
    hasOrderId: context.queriedOrderId === true,
    hasSteamId64: false
  };
}

function isClientSessionQueryClosedDiagnostic(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  if (
    keys.length !== CLIENT_SESSION_QUERY_FIELDS.length ||
    !CLIENT_SESSION_QUERY_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(value, field))
  ) {
    return false;
  }
  if (
    value.schema !== CLIENT_SESSION_QUERY_SCHEMA ||
    typeof value.attempted !== "boolean" ||
    typeof value.ok !== "boolean" ||
    typeof value.hasErrorDescription !== "boolean" ||
    typeof value.hasTransactionId !== "boolean" ||
    typeof value.hasOrderId !== "boolean" ||
    typeof value.hasSteamId64 !== "boolean" ||
    value.reason !== normalizeQueryReason(value.reason) ||
    value.endpoint !== normalizeQueryEndpoint(value.endpoint) ||
    value.id !== normalizeQueryId(value.id) ||
    !(value.httpStatus === null || value.httpStatus === normalizeHttpStatus(value.httpStatus)) ||
    value.result !== normalizeMicroTxnResult(value.result) ||
    value.status !== normalizeMicroTxnStatus(value.status) ||
    value.errorCode !== normalizeMicroTxnErrorCode(value.errorCode) ||
    value.requestError !== normalizeRequestError(value.requestError)
  ) {
    return false;
  }
  if (value.attempted !== (value.reason === "none")) {
    return false;
  }
  if (!value.attempted) {
    return (
      value.ok === false &&
      value.httpStatus === null &&
      value.result === "missing" &&
      value.status === "missing" &&
      value.errorCode === "missing" &&
      value.requestError === "none" &&
      value.hasErrorDescription === false
    );
  }
  if (value.requestError !== "none") {
    return (
      value.ok === false &&
      value.httpStatus === null &&
      value.result === "missing" &&
      value.status === "missing" &&
      value.errorCode === "missing" &&
      value.hasErrorDescription === false
    );
  }
  return true;
}

function normalizeMicroTxnResult(value) {
  const normalized = normalizedScalar(value);
  if (!normalized) {
    return "missing";
  }
  const lowered = normalized.toLowerCase();
  if (lowered === "missing" || lowered === "unknown") {
    return lowered;
  }
  return MICRO_TXN_RESULTS.get(lowered) || "unknown";
}

function normalizeMicroTxnStatus(value) {
  const normalized = normalizedScalar(value);
  if (!normalized) {
    return "missing";
  }
  const lowered = normalized.toLowerCase();
  if (lowered === "missing" || lowered === "unknown") {
    return lowered;
  }
  return MICRO_TXN_STATUSES.get(lowered) || "unknown";
}

function normalizeMicroTxnErrorCode(value) {
  const normalized = normalizedScalar(value);
  if (!normalized) {
    return "missing";
  }
  if (normalized === "missing" || normalized === "unknown") {
    return normalized;
  }
  return MICRO_TXN_ERROR_CODES.has(normalized) ? normalized : "unknown";
}

function normalizeQueryEndpoint(value) {
  const normalized = normalizedScalar(value).toLowerCase();
  return normalized === "sandbox" || normalized === "production" ? normalized : "unknown";
}

function normalizeQueryId(value) {
  const normalized = normalizedScalar(value).toLowerCase();
  return normalized === "transaction" || normalized === "order" || normalized === "none" ? normalized : "none";
}

function normalizeQueryReason(value) {
  const normalized = normalizedScalar(value).toLowerCase();
  return ["none", "not-configured", "disabled", "missing-query-id"].includes(normalized)
    ? normalized
    : "none";
}

function normalizeRequestError(value) {
  const normalized = normalizedScalar(value).toLowerCase();
  return ["none", "timeout", "request-failed"].includes(normalized) ? normalized : "request-failed";
}

function normalizeHttpStatus(value) {
  const status = typeof value === "number" ? value : Number(value);
  return Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function microTxnPayload(event) {
  const source = objectOrEmpty(event);
  return objectOrEmpty(source["0"] || source);
}

function readFirstValue(source, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(source, name)) {
      return source[name];
    }
  }
  return undefined;
}

function normalizeAppId(value) {
  const appId = typeof value === "number" ? value : Number(value);
  return Number.isInteger(appId) && appId > 0 && appId <= 0xffffffff ? appId : undefined;
}

function normalizeAuthorization(value) {
  if (value === true || value === 1 || value === "1" || value === "true") {
    return true;
  }
  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }
  return undefined;
}

function normalizeUnsignedIntegerString(value) {
  if (typeof value === "bigint") {
    return value >= 0n ? value.toString() : "";
  }
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? String(value) : "";
  }
  if (typeof value !== "string") {
    return "";
  }
  const normalized = value.trim();
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, "") : "";
}

function normalizedScalar(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }
  return String(value).trim();
}

function hasPresentValue(value) {
  if (typeof value === "bigint") {
    return true;
  }
  return value !== undefined && value !== null && normalizedScalar(value) !== "";
}

function isAbortError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }
  return error.name === "AbortError" || error.code === "ABORT_ERR";
}

function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

module.exports = {
  CLIENT_SESSION_QUERY_FIELDS,
  CLIENT_SESSION_QUERY_SCHEMA,
  clientSessionQueryErrorDiagnostic,
  clientSessionQuerySkippedDiagnostic,
  checkoutCallbackCorrelationFromResult,
  createMicroTxnCheckoutCorrelationTracker,
  isClientSessionQueryClosedDiagnostic,
  microTxnAuthorizationDiagnostic,
  normalizeHttpStatus,
  normalizeMicroTxnErrorCode,
  normalizeMicroTxnResult,
  normalizeMicroTxnStatus,
  normalizeQueryEndpoint,
  normalizeQueryId,
  normalizeQueryReason,
  normalizeRequestError,
  startManagedCheckoutOperation,
  summarizeClientSessionQueryTxnResponse
};
