// Sub-Store operator script.
// Replaces VLESS/VMess WebSocket proxies' servers with every endpoint in REMOTE_LIST.
async function operator(proxies) {
  const $ = $substore
  const inArg = $arguments || {}
  const protocolFilter = inArg.yx === undefined
    ? ''
    : decodeURI(inArg.yx).trim().toLowerCase()
  const REMOTE_LIST = 'https://raw.githubusercontent.com/Freyja04/resource/main/cfyx.txt'

  let body
  try {
    const response = await $.http.get({ url: REMOTE_LIST })
    body = response?.body || ''
  } catch (error) {
    $.error(`Failed to fetch ${REMOTE_LIST}: ${error.message ?? error}`)
    return proxies
  }

  const endpoints = []

  for (const line of body.split(/\r?\n/)) {
    const endpoint = parseEndpoint(line)
    if (!endpoint) continue
    endpoints.push(endpoint)
  }

  if (endpoints.length === 0) {
    $.error(`No usable endpoints found in ${REMOTE_LIST}`)
    return proxies
  }

  const result = []
  for (const proxy of proxies) {
    const protocol = String(proxy.type || '').toLowerCase()
    const network = String(proxy.network || '').toLowerCase()
    const isTargetProtocol = protocol === 'vless' || protocol === 'vmess'
    if (!isTargetProtocol || network !== 'ws' || (protocolFilter && protocol !== protocolFilter)) {
      result.push(proxy)
      continue
    }

    for (const endpoint of endpoints) {
      result.push({
        ...proxy,
        server: endpoint.server,
        port: endpoint.port || proxy.port,
      })
    }
  }

  return result

  // Accepted forms: example.com, example.com:443#HK, and 1.2.3.4#US.
  // Blank lines and lines starting with # or // are ignored.
  function parseEndpoint(line) {
    const value = line.trim()
    if (!value || /^(#|\/\/)/.test(value)) return null

    const match = value.match(/^(.+?)(?:#(.*))?$/)
    const address = match?.[1]?.trim()
    const name = match?.[2]?.trim()
    if (!address) return null

    let server
    let port
    const hostWithPort = address.match(/^([^:]+):(\d+)$/)

    if (hostWithPort) {
      server = hostWithPort[1].trim()
      port = hostWithPort[2]
    } else if (!/[:\[\]\s]/.test(address)) {
      // Bare domains and IPv4 addresses use the proxy's original port.
      server = address
    }

    if (!server) return null
    return { server, port: port ? Number(port) : undefined, name }
  }
}
