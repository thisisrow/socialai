const env = import.meta.env;

export const IG_APP_ID = env.VITE_IG_APP_ID || "";
export const IG_REDIRECT_URI = env.VITE_IG_REDIRECT_URI || "";
export const API_BASE = env.VITE_API_BASE || "";

export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];
