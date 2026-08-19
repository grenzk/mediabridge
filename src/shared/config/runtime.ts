export function getCdpPort(): string {
  return process.env.MEDIABRIDGE_CDP_PORT || '9222'
}

export function getDefaultCdpUrl(): string {
  return `http://127.0.0.1:${getCdpPort()}`
}
