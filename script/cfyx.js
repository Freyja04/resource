// Sub-Store operator script.
// Replaces VLESS WebSocket / XHTTP proxies' servers with the endpoints below
// (LOCAL_LIST when set, otherwise every endpoint in REMOTE_LIST), one 优选 copy
// per endpoint. Only `server`/`port` are swapped: sni/servername, xhttp-opts and
// every other field are inherited from the original proxy untouched (no `host`
// is added).
//
// Argument:
//   delyx=<订阅名>[, <订阅名>...]  Names of the subscriptions whose unusable VLESS
//     nodes are dropped before the replacement. On the Node runtime those are the
//     WS nodes, on every other runtime the XHTTP ones. Without delyx nothing is
//     ever dropped.
// Expansion targets exactly the VLESS WS and the VLESS XHTTP nodes, in every
// environment. VLESS nodes on any other transport, and every non-VLESS node
// (vmess, trojan, ...), are passed through unchanged.
async function operator(proxies) {
  const $ = $substore
  const inArg = $arguments || {}
  const isNodeEnv = $substore.env.isNode === true

  // delyx is matched case-insensitively as a substring of `_subName`, so DDO also
  // matches a subscription named "CF DDO". Several names may be separated by
  // commas or spaces.
  let delRaw = String(inArg.delyx ?? '')
  try {
    delRaw = decodeURI(delRaw)
  } catch (error) {
    // not valid percent-encoding: keep the raw value
  }
  const delNames = delRaw
    .split(/[,\s]+/)
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)

  // The Node runtime cannot use WS nodes, every other runtime cannot use XHTTP.
  const droppedNetwork = isNodeEnv ? 'ws' : 'xhttp'

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

  const endpoints = body.split(/\r?\n/).map((line) => parseEndpoint(line)).filter(Boolean)

  if (endpoints.length === 0) {
    $.error(`No usable endpoints found in ${source}`)
    return proxies
  }

  const result = []
  for (const proxy of proxies) {
    const protocol = String(proxy.type || '').toLowerCase()
    const network = String(proxy.network || '').toLowerCase()

    if (delNames.length > 0 && protocol === 'vless' && network === droppedNetwork && isNamedSub(proxy)) {
      continue
    }

    if (protocol !== 'vless' || (network !== 'ws' && network !== 'xhttp')) {
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

  function isNamedSub(proxy) {
    const sub = String(proxy._subName || proxy.subName || '').trim().toLowerCase()
    if (!sub) return false
    return delNames.some((name) => sub.includes(name))
  }

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