// Sub-Store operator script.
// Replaces VLESS/VMess WebSocket and XHTTP proxies' servers with local endpoints
// when set, otherwise every endpoint in REMOTE_LIST.
// Only `server`/`port` are swapped: sni/servername, xhttp-opts and every other
// field are inherited from the original proxy untouched (no `host` is added).
// Unusable VLESS nodes are removed before the replacement: the WebSocket ones in
// the Node runtime, the XHTTP ones in every other runtime.
async function operator(proxies) {
  const $ = $substore
  const inArg = $arguments || {}
  const isNodeEnv = $substore && $substore.env && $substore.env.isNode === true
  // Node runtime cannot use WS nodes, other runtimes cannot use XHTTP nodes.
  const droppedNetwork = isNodeEnv ? 'ws' : 'xhttp'
  const protocolFilter = inArg.yx === undefined
    ? ''
    : decodeURI(inArg.yx).trim().toLowerCase()
  // One endpoint per line. Supported forms: example.com, example.com:443#HK, 1.2.3.4#US.
  // Keep this empty to use REMOTE_LIST.
  const LOCAL_LIST = `
    cf.877774.xyz
    cloudflare.182682.xyz
    bestcf.top
    cf.0sm.com
    cfip.1323123.xyz
    cnamefuckxxs.yuchen.icu
    cloudflare-ip.mofashi.ltd
    cdn.tzpro.xyz
`
  const REMOTE_LIST = 'https://raw.githubusercontent.com/Freyja04/resource/main/script/cfyx.txt'

  let body = LOCAL_LIST
  let source = 'LOCAL_LIST'
  if (!body.trim()) {
    try {
      const response = await $.http.get({ url: REMOTE_LIST })
      body = response?.body || ''
      source = REMOTE_LIST
    } catch (error) {
      $.error(`Failed to fetch ${REMOTE_LIST}: ${error.message ?? error}`)
      return proxies
    }
  }

  const endpoints = []

  for (const line of body.split(/\r?\n/)) {
    const endpoint = parseEndpoint(line)
    if (!endpoint) continue
    endpoints.push(endpoint)
  }

  if (endpoints.length === 0) {
    $.error(`No usable endpoints found in ${source}`)
    return proxies
  }

  const result = []
  for (const proxy of proxies) {
    const protocol = String(proxy.type || '').toLowerCase()
    const network = String(proxy.network || '').toLowerCase()
    if (protocol === 'vless' && network === droppedNetwork) continue // delete it
    const isTargetProtocol = protocol === 'vless' || protocol === 'vmess'
    const isTargetNetwork = network === 'ws' || network === 'xhttp'
    if (!isTargetProtocol || !isTargetNetwork || (protocolFilter && protocol !== protocolFilter)) {
      result.push(proxy)
      continue
    }

    for (const endpoint of endpoints) {
      result.push({
        ...proxy,
        name: `${proxy.name || ''} 优选`,
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
