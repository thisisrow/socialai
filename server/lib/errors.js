function extractErrorMessage(e) {
  const data = e?.response?.data;
  if (typeof data === "string") return data;
  if (data?.error_message) return String(data.error_message);
  if (data?.error?.message) return String(data.error.message);
  if (data?.message) return String(data.message);
  if (e?.message) return String(e.message);
  try {
    return JSON.stringify(data);
  } catch {
    return "Unknown error";
  }
}

function isDuplicateKeyError(e) {
  return e?.code === 11000 || (typeof e?.message === "string" && e.message.includes("E11000 duplicate key"));
}

module.exports = {
  extractErrorMessage,
  isDuplicateKeyError,
};
