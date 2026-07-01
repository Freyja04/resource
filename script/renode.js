// ------------------ 传参说明 ------------------
// 本脚本用于已完成重命名的节点列表，建议放在重命名脚本之后执行

// yx: 优选ip或域名替换，字段用英文逗号或中文逗号分隔
// "香港,1.2.3.4"       -> 匹配含「香港」的节点，协议不限
// "香港,vless,1.2.3.4" -> 关键词和协议都指定
// ",,1.2.3.4"          -> 匹配所有 VLESS+WS 和 VMess+WS 节点

// delech: 禁用 ech-opts 规则；不传则不处理；可传 "香港"、"vless"、"香港,vless"
// blockquic: QUIC 设置；"on" 强制开启，"off" 强制关闭，其他值删除该字段
// 自动添加 client-fingerprint: 给 Mihomo 支持 uTLS 指纹且未配置的协议补 chrome

// 获取当前运行环境
// {
//   isQX: false,
//   isLoon: false,
//   isSurge: false,
//   isNode: true,
//   isStash: false,
//   isShadowRocket: false,
//   isEgern: false,
//   isLanceX: false,
//   isGUIforCores: false
// }
const isNodeEnv = $substore && $substore.env && $substore.env.isNode === true;
// tlsFeatureProtocols: ech-opts 与 client-fingerprint 处理共用的协议白名单
const tlsFeatureProtocols = ["vmess", "vless", "trojan", "anytls"];

const inArg = $arguments;
const blockquic = inArg.blockquic == undefined ? "" : decodeURI(inArg.blockquic);

const preferRaw = inArg.yx == undefined ? "" : decodeURI(inArg.yx);
const delechRaw = inArg.delech == undefined ? "" : decodeURI(inArg.delech);
const delechRule = parseDelechRule(delechRaw);
const pref = parsePreferRule(preferRaw);

// operator: 按顺序处理优选替换、block-quic、client-fingerprint、ech-opts
function operator(pro) {
  pro.forEach(function(node) {
    replacePreferredServer(node);
    setBlockQuic(node);
    addClientFingerprint(node);
    disableEchOpts(node);
  });
  return pro;
}

// replacePreferredServer: 按 yx 规则替换 VLESS+WS 或 VMess+WS 节点的 server
function replacePreferredServer(node) {
  if (!pref || !pref.ip || !node || !node.name || (pref.keyword && node.name.indexOf(pref.keyword) === -1)) return;
  var protocol = String(node.type || "").toLowerCase();
  var network = String(node.network || "").toLowerCase();
  var isProtoMatch = false;

  if (!pref.protocol || pref.protocol === "vless") {
    if (protocol === "vless" && network === "ws") isProtoMatch = true;
  }
  if (!pref.protocol || pref.protocol === "vmess") {
    if (protocol === "vmess" && network === "ws") isProtoMatch = true;
  }
  if (isProtoMatch) {
    node.server = pref.ip;
  }
}

// setBlockQuic: 根据 blockquic 参数设置、关闭或删除 block-quic 字段
function setBlockQuic(node) {
  if (!node) return;
  if (blockquic == "on") {
    node["block-quic"] = "on";
  } else if (blockquic == "off") {
    node["block-quic"] = "off";
  } else {
    delete node["block-quic"];
  }
}

// addClientFingerprint: 仅给支持 uTLS 指纹且未配置的协议补 client-fingerprint: chrome
function addClientFingerprint(node) {
  if (
    node &&
    !node["client-fingerprint"] &&
    tlsFeatureProtocols.indexOf(String(node.type || "").toLowerCase()) !== -1
  ) {
    node["client-fingerprint"] = "chrome";
  }
}

// disableEchOpts: 在 Node 环境中按 delech 规则将已有 ech-opts.enable 设为 false
function disableEchOpts(node) {
  if (!isNodeEnv || !delechRule || !node || !node.name) return;
  var keywordMatched = !delechRule.keyword || node.name.indexOf(delechRule.keyword) !== -1;
  var protocolMatched = !delechRule.protocol || String(node.type || "").toLowerCase() === delechRule.protocol;
  if (keywordMatched && protocolMatched && node["ech-opts"]) {
    node["ech-opts"].enable = false;
  }
}

// parsePreferRule: 解析 yx 参数，支持 "关键词,IP" 或 "关键词,协议,IP"
function parsePreferRule(raw) {
  if (!raw) return null;
  var parts = splitCommaList(raw, true);
  if (parts.length < 2) return null;
  if (parts.length === 2) {
    return {
      keyword: parts[0],
      protocol: "",
      ip: parts[1]
    };
  }
  return {
    keyword: parts[0] || "",
    protocol: (parts[1] || "").toLowerCase(),
    ip: parts[2] || ""
  };
}

// parseDelechRule: 解析 delech 参数；单个协议按协议匹配，否则按最终节点名关键词匹配
function parseDelechRule(raw) {
  if (!raw) return null;
  var parts = splitCommaList(raw);
  if (!parts.length) return null;
  if (parts.length === 1) {
    var only = parts[0].toLowerCase();
    if (tlsFeatureProtocols.indexOf(only) !== -1) {
      return { keyword: "", protocol: only };
    }
    return { keyword: parts[0], protocol: "" };
  }
  var protocol = parts[1].toLowerCase();
  return {
    keyword: parts[0],
    protocol: tlsFeatureProtocols.indexOf(protocol) !== -1 ? protocol : "__unsupported__"
  };
}

// splitCommaList: 统一按英文逗号或中文逗号拆分参数
function splitCommaList(text, keepEmpty) {
  if (!text) return [];
  var parts = String(text).split(/[,，]/).map(function(part) { return part.trim(); });
  return keepEmpty ? parts : parts.filter(Boolean);
}
