// HTTP ports supported by Cloudflare: 80, 8080, 8880, 2052, 2082, 2086, 2095
// HTTPS ports supported by Cloudflare 443, 2053, 2083, 2087, 2096, 8443
async function operator(proxies) {
  // 浏览器查看 https://cf.090227.xyz 获取更多优选 例如移动 https://addressesapi.090227.xyz/cmcc https://cm.xxxxxxxx.tk
  // 直接写在本地(兼容如下格式, 支持注释)
  const SERVERS_LOCAL = `
    cf.zhetengsha.eu.org:2096#CF
    cf.090227.xyz:2087#CM
    // www.wto.org:8443#官方优选 WTO 
    // www.visa.com.sg#官方优选 Visa 
    // icook.hk
    // 47.236.116.182#SG Alibaba
    // 43.153.80.208:443#US Tencent
    // 47.254.66.75:443#US Alibaba
    // 8.219.144.168:443#SG Alibaba
    // 8.222.181.139:443#SG Alibaba
  `
  // 从远程加载(若有, 就跟本地的叠加)
  const SERVERS_REMOTE = '' // 如: `https://cu.xxxxxxxx.tk`

  // 彩蛋
  const EASTER_EGG = false

  // proxyIP
  // 直接写在本地
  const PROXYIP_LOCAL = `
    // 格式: proxyIP#名称
    // 支持注释
    // CMLiu 佬维护
    # proxyip.us.fxxk.dedyn.io#US
    # proxyip.sg.fxxk.dedyn.io#SG
    # proxyip.jp.fxxk.dedyn.io#JP
    // proxyip.hk.fxxk.dedyn.io#HK
    // proxyip.aliyun.fxxk.dedyn.io#Alibaba
    # proxyip.oracle.fxxk.dedyn.io#Oracle
    # proxyip.digitalocean.fxxk.dedyn.io#DO
    # proxyip.vultr.fxxk.dedyn.io#Vultr
    
    // Mingyu 维护
    # bestproxy.onecf.eu.org#Mingyu
    // my-telegram-is-herocore.onecf.eu.org#Mingyu

    // 天诚 维护
    // us.gitgoogle.com#US
    # aliyun.gitgoogle.com#Alibaba
    # oracle.gitgoogle.com#Oracle
    # collect.gitgoogle.com#Telegram 收集

    // workers.cloudflare.cyou#白嫖哥

    // 43.153.80.208:443#US Tencent
    // 47.254.66.75:443#US Alibaba
    // 47.243.179.249:443#HK Alibaba
    // 8.218.149.193:443#HK Alibaba
    // 8.219.144.168:443#SG Alibaba
    // 8.222.181.139:443#SG Alibaba
    // 8.219.140.63:443#SG Alibaba
    // 8.222.208.38:443#SG Alibaba
    // 8.222.199.55:443#SG Alibaba
    // 64.110.88.46:443#JP Oracle

    // proxy.cf.zhetengsha.eu.org#Proxy
    // us.cf.zhetengsha.eu.org#US
    sg.cf.zhetengsha.eu.org#SG
    hk.cf.zhetengsha.eu.org#HK
    // jp.cf.zhetengsha.eu.org#JP

    // cdn.xn--b6gac.eu.org#↗↘↗


  `
  // 从远程加载(若有, 就跟本地的叠加)
  const PROXYIP_REMOTE = ''

  // 使用 SOCKS5 而不是 PROXYIP  
  // 需使用支持 SOCKS5 的 Workers/Pages 版本
  // 如: https://github.com/cmliu/epeius
  // 若有本地+远程叠加后, 存在有效的 SOCKS5 代理, 将忽略 PROXYIP
  const SOCKS5_LOCAL = `
  // 格式: user:pass@host:port 或 host:port
  // user:pass@1.2.3.4:1234#名称
  `
  // 从远程加载(若有, 就跟本地的叠加)
  const SOCKS5_REMOTE = '' // 例如 `https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.json` 没有统一格式, 目前下面的逻辑仅支持从这个格式中读取
  const SOCKS5_REMOTE_COUNTRIES = ['SG'] // 筛选这些

  //
  const $ = $substore
  let servers = `${SERVERS_LOCAL || ''}`
  if (SERVERS_REMOTE) {
    try {
      const { body } = await $.http.get({ url: SERVERS_REMOTE })
      servers = `${servers}\n${body || ''}`
    } catch (e) {
      $.error(`从远程 ${SERVERS_REMOTE} 获取失败\n${e.message ?? e}`)
    }
  }

  const set = new Set()
  servers.split(/\r?\n/g).map(i => {
    const [_, server, __, port, ___, name] = i.trim().match(/^(.*?)(:(\d+))?(#(.*?))?$/)
    if (server && !/^(#|\/\/)/.test(server)) set.add({ server: clearServer(server), port, name })
  })

  if (EASTER_EGG) {
    const EASTER_EGG_REMOTE = 'https://trojan.gitgoogle.com/CMLiu'
    try {
      let { body } = await $.http.get({ url: EASTER_EGG_REMOTE, headers: { 'User-Agent': 'sing-box' } })
      body = JSON.parse(body)
      body.outbounds.map(({ tag: name, server, server_port: port }) => {
        if (server && port) set.add({ server: clearServer(server), port, name: ProxyUtils.getISO(name) })
      })
    } catch (e) {
      $.error(`从远程 ${EASTER_EGG_REMOTE} 获取失败\n${e.message ?? e}`)
    }
  }
  let list = []

  
  const socks5set = new Set()
  SOCKS5_LOCAL.split(/\r?\n/g).map(i => {
    const [_, proxy, __, name] = i.trim().match(/^(.*?)(#(.*?))?$/)
    if (proxy && !/^(#|\/\/)/.test(proxy)) socks5set.add({ proxy, name })
  })
  if (SOCKS5_REMOTE) {
    try {
      let { body } = await $.http.get({ url: SOCKS5_REMOTE })
      body = JSON.parse(body)
      body.map(({ ip, port, geolocation } = {}) => {
        if (ip && port && SOCKS5_REMOTE_COUNTRIES.includes(geolocation?.country)) socks5set.add({ proxy: `${ip}:${port}`, name: geolocation?.country })
      })
    } catch (e) {
      $.error(`从远程 ${SOCKS5_REMOTE} 获取失败\n${e.message ?? e}`)
    }
  }
  list = Array.from(socks5set)
  const socks5enabled = list.length > 0

  if (!socks5enabled) {
    let proxyIPs = `${PROXYIP_LOCAL || ''}`
    if (PROXYIP_REMOTE) {
      try {
        const { body } = await $.http.get({ url: PROXYIP_REMOTE })
        proxyIPs = `${proxyIPs}\n${body || ''}`
      } catch (e) {
        $.error(`从远程 ${PROXYIP_REMOTE} 获取失败\n${e.message ?? e}`)
      }
    }
    const proxyIPset = new Set()
    proxyIPs.split(/\r?\n/g).map(i => {
      const [_, server, __, port, ___, name] = i.trim().match(/^(.*?)(:(\d+))?(#(.*?))?$/)
      if (server && !/^(#|\/\/)/.test(server)) proxyIPset.add({ server: clearServer(server), name })
    })
    list = Array.from(proxyIPset)
  }

  // HTTP ports supported by Cloudflare: 80, 8080, 8880, 2052, 2082, 2086, 2095
  // HTTPS ports supported by Cloudflare 443, 2053, 2083, 2087, 2096, 8443

  let result = []
  Array.from(set).map(({ server, port, name }) => {
    list.map(item => {
      proxies.map(p => {
        result.push({
          ...p,
          name: `${name ? name : server} ➮ ${item.name} ${p.name}`,
          server,
          port: parseInt(port || p.port, 10),
          'skip-cert-verify': true,
          'ws-opts': {
            ...p['ws-opts'],
            path: socks5enabled ? `/?socks5=${item.proxy}` : `/proxyIP=${item.server}`,
          },
        })
      })
    })
  })

  return result

  function clearServer(server) {
    return `${server}`.trim().replace(/^\[/, '').replace(/\]$/, '')
  }
}
