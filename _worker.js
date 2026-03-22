const MIN_LENGTH = 5;
const MAX_LENGTH = 18;

let DIGIT_COUNT = 4;
let RANGOM_LENGTH = 12;
let MAX_DATA_SIZE = 1024 * 1024;

// env.AUTH
let AUTHORIZATION = "";
const PREFIX = "/api/v1/";
const ALLOWED_METHODS = ["GET", "POST"];
const VALIDCONTENTTYPE = "application/x-www-form-urlencoded";

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  },
};

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);

  if (url.protocol === "http:") {
    url.protocol = "https:";
    return Response.redirect(url.href);
  }

  getConfig(env);

  switch (request.method) {
    case "GET":
      return handleRequestGet(request, env);
    case "POST":
      return handleRequestPost(request, env);
    default:
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: ALLOWED_METHODS.join(", ") },
      });
  }
}

function getConfig(env) {
  AUTHORIZATION = env.AUTH || "";

  if (env.MAX_SIZE) {
    const parsedSize = parseInt(env.MAX_SIZE);
    if (!isNaN(parsedSize) && parsedSize > 0) {
      MAX_DATA_SIZE = parsedSize;
    }
  }

  if (env.ID_LEN) {
    const parsedLen = parseInt(env.ID_LEN);
    if (!isNaN(parsedLen) && parsedLen > 0) {
      RANGOM_LENGTH = parsedLen;
    }
  }

  if (env.DIGITS_LEN) {
    const parsedDigits = parseInt(env.DIGITS_LEN);
    if (!isNaN(parsedDigits) && parsedDigits >= 0) {
      DIGIT_COUNT = parsedDigits;
    }
  }
}

function isValidGetPath(requestUrl) {
  const url = new URL(requestUrl);
  const path = url.pathname;
  const regex = new RegExp(`^/[A-Za-z0-9]{${MIN_LENGTH},${MAX_LENGTH}}$`);
  return regex.test(path);
}

function isValidPostPath(requestUrl) {
  const url = new URL(requestUrl);
  const path = url.pathname;
  const escapedPrefix = PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escapedPrefix}$`);
  return regex.test(path);
}

function isValidPostHeaders(headers) {
  if (AUTHORIZATION === "") {
    return true;
  }
  const authHeader = headers.get("Authorization")?.trim() ?? "";
  const escapedAuthorization = AUTHORIZATION.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const authregex = new RegExp(`^Bearer ${escapedAuthorization}$`);

  const contentTypeHeader = headers.get("Content-Type")?.trim() ?? "";
  const escapedValidcontenttype = VALIDCONTENTTYPE.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const validcontenttyperegex = new RegExp(
    `^${escapedValidcontenttype}(\s*;.*)?$`,
  );
  return (
    authregex.test(authHeader) &&
    validcontenttyperegex.test(contentTypeHeader.toLowerCase())
  );
}

function extractGetKeyFromUrl(requestUrl) {
  const url = new URL(requestUrl);
  const path = url.pathname;
  return path.substring(1);
}

async function extractPostFormData(request) {
  let data = {};
  let success = false;
  try {
    const formData = await request.formData();
    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    if (!data.content || typeof data.content !== "string") {
      return { success, data };
    }

    const encoder = new TextEncoder();
    const byteLength = encoder.encode(data.content).length;
    if (byteLength > MAX_DATA_SIZE) {
      return { success, data };
    }

    let expiryValid = true;
    if (data.expiry !== undefined && data.expiry !== "") {
      const expiryStr = data.expiry;
      let ttl = Number(expiryStr);
      if (isNaN(ttl) || !Number.isInteger(ttl) || ttl <= 0) {
        expiryValid = false;
      } else {
        data.expiry = ttl;
      }
    }
    success = expiryValid;
  } catch {
    return { success, data };
  }
  return { success, data };
}

function adjustRangeLength() {
  if (MIN_LENGTH < 0) MIN_LENGTH = 1;
  if (MAX_LENGTH < MIN_LENGTH) MAX_LENGTH = MIN_LENGTH;
  if (RANGOM_LENGTH < MIN_LENGTH) RANGOM_LENGTH = MIN_LENGTH;
  if (RANGOM_LENGTH > MAX_LENGTH) RANGOM_LENGTH = MAX_LENGTH;
  if (DIGIT_COUNT < 0) DIGIT_COUNT = 0;
  if (DIGIT_COUNT > RANGOM_LENGTH) DIGIT_COUNT = RANGOM_LENGTH;
}

function generateStringUrl() {
  adjustRangeLength();
  const digits = "0123456789";
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  let digitPart = "";
  for (let i = 0; i < DIGIT_COUNT; i++) {
    digitPart += digits[Math.floor(Math.random() * digits.length)];
  }

  const letterCount = RANGOM_LENGTH - DIGIT_COUNT;
  let letterPart = "";
  for (let i = 0; i < letterCount; i++) {
    letterPart += letters[Math.floor(Math.random() * letters.length)];
  }

  // 合并并打乱顺序（Fisher-Yates 洗牌）
  const combined = (digitPart + letterPart).split("");
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join("");
}

async function generateUniquePath(env, maxAttempts = 10) {
  if (!env.KV) {
    throw new Error("KV namespace not configured");
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateStringUrl();
    const existing = await env.KV.get(candidate);
    if (existing === null) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique path after multiple attempts");
}

async function storeData(env, key, data) {
  if (!env.KV) {
    throw new Error("KV namespace not configured");
  }
  let options = {};
  const content = data.content;
  if (
    data.expiry !== undefined &&
    typeof data.expiry === "number" &&
    data.expiry > 0
  ) {
    options.expirationTtl = data.expiry;
  }
  await env.KV.put(key, content, options);
}

async function getData(env, key) {
  if (!env.KV) {
    throw new Error("KV namespace not configured");
  }
  const content = await env.KV.get(key, { type: "text" });
  return { content };
}

async function handleRequestGet(request, env) {
  if (!isValidGetPath(request.url)) {
    return new Response("Invalid path", { status: 400 });
  }

  const key = extractGetKeyFromUrl(request.url);

  try {
    const { content } = await getData(env, key);
    if (content === null) {
      return new Response("Not Found", { status: 404 });
    }

    return new Response(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("GET error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function handleRequestPost(request, env) {
  if (!isValidPostPath(request.url)) {
    return new Response("Invalid path", { status: 400 });
  }

  if (!isValidPostHeaders(request.headers)) {
    return new Response("Invalid header", { status: 401 });
  }

  const { success, data } = await extractPostFormData(request);
  if (!success) {
    return new Response("Invalid data", { status: 400 });
  }

  try {
    const key = await generateUniquePath(env);
    await storeData(env, key, data);

    const location = `/${key}`;
    return new Response(location, {
      status: 201,
      headers: {
        Location: location,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("POST error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
