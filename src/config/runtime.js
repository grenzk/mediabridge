export function getCdpPort() {
  return process.env.MEDIABRIDGE_CDP_PORT || '9222'
}

export function getDefaultCdpUrl() {
  return `http://127.0.0.1:${getCdpPort()}`
}
