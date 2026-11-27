/**
 * Lullaby Manor — domain licence (fallback used when the shared SDK is absent).
 * Allowed: local development + pipygames.com family. Any other host finishes
 * loading, shows the lock card, then redirects after three seconds.
 */
export const DOMAIN_CONFIG = {
  enabled: true,
  allowedHosts: [
    "localhost",
    "127.0.0.1",
    "::1",
    "pipygames.com",
    "www.pipygames.com",
    "*.pipygames.com"
  ],
  redirectUrl: "https://pipygames.com",
  redirectDelayMs: 3000,
  allowFileProtocol: true,
  allowIframe: false,
  debug: true
};
