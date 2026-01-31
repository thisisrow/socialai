function log(...args) {
    console.log(new Date().toISOString(), "-", ...args);
}

function must(v, name) {
    // console.log(`Checking requirement for: ${name}`);
    if (!v) {
        console.error(`Requirement failed: Missing ${name}`);
        throw new Error(`Missing ${name}`);
    }
    // console.log(`Requirement met for: ${name}`);
    return v;
}

function redactToken(token) {
    if (!token) return "";
    const s = String(token);
    if (s.length <= 12) return "****";
    return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

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
    log,
    must,
    redactToken,
    extractErrorMessage,
    isDuplicateKeyError,
};

