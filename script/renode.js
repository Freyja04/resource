// ------------------ 传参说明 ------------------
// 本脚本用于已完成重命名的节点列表，建议放在重命名脚本之后执行

// delech: 禁用 ech-opts 规则；不传则不处理；可传 "香港"、"vless"、"香港,vless"
// blockquic: 按节点类型设置 block-quic；可传 "vless"、"vless,vmess"，分隔符支持 , 或 ，
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
const blockquicTypes = parseBlockquicRule(inArg.blockquic);

const delechRaw = inArg.delech == undefined ? "" : decodeURI(inArg.delech);
const delechRule = parseDelechRule(delechRaw);

// operator: 按顺序处理 block-quic、client-fingerprint、ech-opts
function operator(pro) {
  pro.forEach(function(node) {
    setBlockQuic(node);
    addClientFingerprint(node);
    disableEchOpts(node);
  });
  return pro;
}

// setBlockQuic: 将匹配到的节点类型的 block-quic 设为 on；不传或参数无效则保留原样
function setBlockQuic(node) {
  if (!node || !blockquicTypes) return;
  if (blockquicTypes.indexOf(String(node.type || "").toLowerCase()) !== -1) {
    node["block-quic"] = "on";
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

// parseBlockquicRule: 解析 blockquic 参数，仅接受白名单协议类型；无效值不处理
function parseBlockquicRule(raw) {
  if (raw == undefined) return null;
  var parts = splitCommaList(decodeURI(raw));
  if (!parts.length) return null;
  var types = [];
  for (var i = 0; i < parts.length; i++) {
    var type = parts[i].toLowerCase();
    if (tlsFeatureProtocols.indexOf(type) === -1) return null;
    if (types.indexOf(type) === -1) types.push(type);
  }
  return types;
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
