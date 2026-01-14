//substore根据ip+port去重脚本,前面必须添加域名解析
function operator(proxies) {
    const uniqueProxies = new Map();

    proxies.forEach((proxy) => {
        // 使用 解析后的 IP + 端口 作为唯一 key
        const key = `${proxy.server}:${proxy.port}`;
        uniqueProxies.set(key, proxy);
    });

    // 去重完成后，统一还原域名
    return Array.from(uniqueProxies.values()).map((proxy) => {
        if (proxy._domain) {
            proxy.server = proxy._domain;
        }
        return proxy;
    });
}
