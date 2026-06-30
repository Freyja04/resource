// ------------------ 传参说明 ------------------
// 布尔参数传 true/false或任意值启用，想关闭直接不传这个参数

// nm: true/false 未匹配到地区时是否保留原节点；true 保留，false 过滤
// clear: 追加过滤词，用英文逗号或中文逗号分隔；未传则只使用默认过滤词
// dqpx: 指定地区排序顺序，用英文逗号或中文逗号分隔，如 "香港,日本,美国"

//识别倍率标签、保留或过滤高倍率节点、标签节点排序
// bl: true/false 从节点名中识别倍率并追加为倍率标记，如 2×、3×、2.5×
// nx: true/false 过滤掉高倍率节点
// blnx: true/false 只保留高倍率节点
// blgd: true/false 保留节点名中的固定倍率或线路标签，如 2×、IPLC、优选、V6
// blpx: true/false 将带倍率或线路标签的特殊节点排到同地区普通节点后面
// blkey: 自定义保留关键词，多个用 "+" 分隔，支持 "关键词>替换值"

// 节点重命名
// name: 自定义名称前缀或后缀；如果节点有 _subName，会优先使用 _subName
// flag: true/false 在地区名左侧添加对应旗帜 emoji
// nf: true/false 将 name 放到最终节点名前面；否则放到地区名前后方的默认位置
// fgf: 最终节点名各部分之间的分隔符，默认空格
// sn: 节点序号前的分隔符，默认空格

// 优选ip或域名替换
// yx: 优选 IP 替换配置，字段用英文逗号或中文逗号分隔
// "香港,1.2.3.4"       → 匹配含「香港」的节点，协议不限
// "香港,vless,1.2.3.4" → 关键词和协议都指定
// ",,1.2.3.4"          → 匹配所有 VLESS+WS 和 VMess+WS 节点

// in: 指定输入节点名中的地区格式；cn/zh 中文，us/en 英文代码，quan 英文全称，gq/flag 旗帜；未传则自动匹配
// out: 指定输出节点名中的地区格式，取值同 in

// blockquic: QUIC 设置；"on" 强制开启，"off" 强制关闭，其他值删除该字段
// delech: 删除 ech-opts 规则；不传则不删除；可传 "香港"、"vless"、"香港,vless"

// substore获取当前运行环境
// const isNodeEnv = $substore && $substore.env && $substore.env.isNode === true; 或
// const $ = $substore
// console.log($.env.isNode)
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

const inArg = $arguments;
const addflag = inArg.flag || true,
  nx = inArg.nx || false,
  bl = inArg.bl || false,
  nf = inArg.nf || false,
  blgd = inArg.blgd || false,
  blpx = inArg.blpx || false,
  blnx = inArg.blnx || false,
  nm = inArg.nm || false;

const FGF = inArg.fgf == undefined ? " " : decodeURI(inArg.fgf),
  XHFGF = inArg.sn == undefined ? " " : decodeURI(inArg.sn),
  BLKEY = inArg.blkey == undefined ? "" : decodeURI(inArg.blkey),
  blockquic = inArg.blockquic == undefined ? "" : decodeURI(inArg.blockquic);

const clearRaw = inArg.clear == undefined ? "" : decodeURI(inArg.clear);
const dqpx = inArg.dqpx == undefined ? "" : decodeURI(inArg.dqpx);
const preferRaw = inArg.yx == undefined ? "" : decodeURI(inArg.yx);
const delechRaw = inArg.delech == undefined ? "" : decodeURI(inArg.delech);
const delechRule = parseDelechRule(delechRaw);
const pref = preferRaw ? (function() {
  var parts = splitCommaList(preferRaw, true);
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
})() : null;

// ------------------ 地区映射与语言选择 ------------------
const nameMap = {
    cn: "cn", zh: "cn",
    us: "us", en: "us",
    quan: "quan",
    gq: "gq", flag: "gq",
  },
  inname = nameMap[inArg.in] || "",
  outputName = nameMap[inArg.out] || "";

// ------------------ 地区对照表（索引一一对应） ------------------
// prettier-ignore
const FG = ['🇭🇰','🇲🇴','🇹🇼','🇯🇵','🇰🇷','🇸🇬','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇦🇺','🇦🇪','🇦🇫','🇦🇱','🇩🇿','🇦🇴','🇦🇷','🇦🇲','🇦🇹','🇦🇿','🇧🇭','🇧🇩','🇧🇾','🇧🇪','🇧🇿','🇧🇯','🇧🇹','🇧🇴','🇧🇦','🇧🇼','🇧🇷','🇻🇬','🇧🇳','🇧🇬','🇧🇫','🇧🇮','🇰🇭','🇨🇲','🇨🇦','🇨🇻','🇰🇾','🇨🇫','🇹🇩','🇨🇱','🇨🇴','🇰🇲','🇨🇬','🇨🇩','🇨🇷','🇭🇷','🇨🇾','🇨🇿','🇩🇰','🇩🇯','🇩🇴','🇪🇨','🇪🇬','🇸🇻','🇬🇶','🇪🇷','🇪🇪','🇪🇹','🇫🇯','🇫🇮','🇬🇦','🇬🇲','🇬🇪','🇬🇭','🇬🇷','🇬🇱','🇬🇹','🇬🇳','🇬🇾','🇭🇹','🇭🇳','🇭🇺','🇮🇸','🇮🇳','🇮🇩','🇮🇷','🇮🇶','🇮🇪','🇮🇲','🇮🇱','🇮🇹','🇨🇮','🇯🇲','🇯🇴','🇰🇿','🇰🇪','🇰🇼','🇰🇬','🇱🇦','🇱🇻','🇱🇧','🇱🇸','🇱🇷','🇱🇾','🇱🇹','🇱🇺','🇲🇰','🇲🇬','🇲🇼','🇲🇾','🇲🇻','🇲🇱','🇲🇹','🇲🇷','🇲🇺','🇲🇽','🇲🇩','🇲🇨','🇲🇳','🇲🇪','🇲🇦','🇲🇿','🇲🇲','🇳🇦','🇳🇵','🇳🇱','🇳🇿','🇳🇮','🇳🇪','🇳🇬','🇰🇵','🇳🇴','🇴🇲','🇵🇰','🇵🇦','🇵🇾','🇵🇪','🇵🇭','🇵🇹','🇵🇷','🇶🇦','🇷🇴','🇷🇺','🇷🇼','🇸🇲','🇸🇦','🇸🇳','🇷🇸','🇸🇱','🇸🇰','🇸🇮','🇸🇴','🇿🇦','🇪🇸','🇱🇰','🇸🇩','🇸🇷','🇸🇿','🇸🇪','🇨🇭','🇸🇾','🇹🇯','🇹🇿','🇹🇭','🇹🇬','🇹🇴','🇹🇹','🇹🇳','🇹🇷','🇹🇲','🇻🇮','🇺🇬','🇺🇦','🇺🇾','🇺🇿','🇻🇪','🇻🇳','🇾🇪','🇿🇲','🇿🇼','🇦🇩','🇷🇪','🇵🇱','🇬🇺','🇻🇦','🇱🇮','🇨🇼','🇸🇨','🇦🇶','🇬🇮','🇨🇺','🇫🇴','🇦🇽','🇧🇲','🇹🇱'];
// FG: 旗帜 emoji 数组
// prettier-ignore
const EN = ['HK','MO','TW','JP','KR','SG','US','GB','FR','DE','AU','AE','AF','AL','DZ','AO','AR','AM','AT','AZ','BH','BD','BY','BE','BZ','BJ','BT','BO','BA','BW','BR','VG','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CO','KM','CG','CD','CR','HR','CY','CZ','DK','DJ','DO','EC','EG','SV','GQ','ER','EE','ET','FJ','FI','GA','GM','GE','GH','GR','GL','GT','GN','GY','HT','HN','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','CI','JM','JO','KZ','KE','KW','KG','LA','LV','LB','LS','LR','LY','LT','LU','MK','MG','MW','MY','MV','ML','MT','MR','MU','MX','MD','MC','MN','ME','MA','MZ','MM','NA','NP','NL','NZ','NI','NE','NG','KP','NO','OM','PK','PA','PY','PE','PH','PT','PR','QA','RO','RU','RW','SM','SA','SN','RS','SL','SK','SI','SO','ZA','ES','LK','SD','SR','SZ','SE','CH','SY','TJ','TZ','TH','TG','TO','TT','TN','TR','TM','VI','UG','UA','UY','UZ','VE','VN','YE','ZM','ZW','AD','RE','PL','GU','VA','LI','CW','SC','AQ','GI','CU','FO','AX','BM','TL'];
// EN: 英文代码（2 字母缩写）数组
// prettier-ignore
const ZH = ['香港','澳门','台湾','日本','韩国','新加坡','美国','英国','法国','德国','澳大利亚','阿联酋','阿富汗','阿尔巴尼亚','阿尔及利亚','安哥拉','阿根廷','亚美尼亚','奥地利','阿塞拜疆','巴林','孟加拉国','白俄罗斯','比利时','伯利兹','贝宁','不丹','玻利维亚','波斯尼亚和黑塞哥维那','博茨瓦纳','巴西','英属维京群岛','文莱','保加利亚','布基纳法索','布隆迪','柬埔寨','喀麦隆','加拿大','佛得角','开曼群岛','中非共和国','乍得','智利','哥伦比亚','科摩罗','刚果(布)','刚果(金)','哥斯达黎加','克罗地亚','塞浦路斯','捷克','丹麦','吉布提','多米尼加共和国','厄瓜多尔','埃及','萨尔瓦多','赤道几内亚','厄立特里亚','爱沙尼亚','埃塞俄比亚','斐济','芬兰','加蓬','冈比亚','格鲁吉亚','加纳','希腊','格陵兰','危地马拉','几内亚','圭亚那','海地','洪都拉斯','匈牙利','冰岛','印度','印尼','伊朗','伊拉克','爱尔兰','马恩岛','以色列','意大利','科特迪瓦','牙买加','约旦','哈萨克斯坦','肯尼亚','科威特','吉尔吉斯斯坦','老挝','拉脱维亚','黎巴嫩','莱索托','利比里亚','利比亚','立陶宛','卢森堡','马其顿','马达加斯加','马拉维','马来','马尔代夫','马里','马耳他','毛利塔尼亚','毛里求斯','墨西哥','摩尔多瓦','摩纳哥','蒙古','黑山共和国','摩洛哥','莫桑比克','缅甸','纳米比亚','尼泊尔','荷兰','新西兰','尼加拉瓜','尼日尔','尼日利亚','朝鲜','挪威','阿曼','巴基斯坦','巴拿马','巴拉圭','秘鲁','菲律宾','葡萄牙','波多黎各','卡塔尔','罗马尼亚','俄罗斯','卢旺达','圣马力诺','沙特阿拉伯','塞内加尔','塞尔维亚','塞拉利昂','斯洛伐克','斯洛文尼亚','索马里','南非','西班牙','斯里兰卡','苏丹','苏里南','斯威士兰','瑞典','瑞士','叙利亚','塔吉克斯坦','坦桑尼亚','泰国','多哥','汤加','特立尼达和多巴哥','突尼斯','土耳其','土库曼斯坦','美属维尔京群岛','乌干达','乌克兰','乌拉圭','乌兹别克斯坦','委内瑞拉','越南','也门','赞比亚','津巴布韦','安道尔','留尼汪','波兰','关岛','梵蒂冈','列支敦士登','库拉索','塞舌尔','南极','直布罗陀','古巴','法罗群岛','奥兰群岛','百慕达','东帝汶'];
// ZH: 中文全称数组
// prettier-ignore
const QC = ['Hong Kong','Macao','Taiwan','Japan','Korea','Singapore','United States','United Kingdom','France','Germany','Australia','Dubai','Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','British Virgin Islands','Brunei','Bulgaria','Burkina-faso','Burundi','Cambodia','Cameroon','Canada','CapeVerde','CaymanIslands','Central African Republic','Chad','Chile','Colombia','Comoros','Congo-Brazzaville','Congo-Kinshasa','CostaRica','Croatia','Cyprus','Czech Republic','Denmark','Djibouti','Dominican Republic','Ecuador','Egypt','EISalvador','Equatorial Guinea','Eritrea','Estonia','Ethiopia','Fiji','Finland','Gabon','Gambia','Georgia','Ghana','Greece','Greenland','Guatemala','Guinea','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Isle of Man','Israel','Italy','Ivory Coast','Jamaica','Jordan','Kazakstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Macedonia','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar(Burma)','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','NorthKorea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Portugal','PuertoRico','Qatar','Romania','Russia','Rwanda','SanMarino','SaudiArabia','Senegal','Serbia','SierraLeone','Slovakia','Slovenia','Somalia','SouthAfrica','Spain','SriLanka','Sudan','Suriname','Swaziland','Sweden','Switzerland','Syria','Tajikstan','Tanzania','Thailand','Togo','Tonga','TrinidadandTobago','Tunisia','Turkey','Turkmenistan','U.S.Virgin Islands','Uganda','Ukraine','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe','Andorra','Reunion','Poland','Guam','Vatican','Liechtensteins','Curacao','Seychelles','Antarctica','Gibraltar','Cuba','Faroe Islands','Ahvenanmaa','Bermuda','Timor-Leste'];
// QC: 英文全称数组

// ------------------ 正则与匹配规则 ------------------

const specialRegex = [
  /(\d\.)?\d+×/,                          // 匹配倍率（如 2×、1.5×）
  /IPLC|IEPL|Kern|Edge|Pro|Std|Exp|Game|Buy|中转|优选|商宽|家宽|专线|V6/i,  // 特殊线路类型
];
// specialRegex: blpx= true 时按此分组排序，匹配第一组的优先，第二组其次
const chineseSpecialTags = ["中转", "优选", "商宽", "家宽", "专线"];

const defaultNameclear = /(群|邀请|返利|循环|官网|网站|网址|到期|机场|版本|官址|备用|过期|邮箱|工单|余额|失联|邮件|通知|地址|频道|AFF|TOTAL|EXPIRE|EMAIL|Panel)/i;
const clearWords = splitCommaList(clearRaw);
const nameclear = clearWords.length
  ? new RegExp(defaultNameclear.source + "|" + clearWords.map(escapeRegExp).join("|"), "i")
  : defaultNameclear;
// nameclear: 默认过滤词 + clear 传入的追加过滤词

// prettier-ignore
const regexArray=[/ˣ²/, /ˣ³/, /ˣ⁴/, /ˣ⁵/, /ˣ⁶/, /ˣ⁷/, /ˣ⁸/, /ˣ⁹/, /ˣ¹⁰/, /ˣ²⁰/, /ˣ³⁰/, /ˣ⁴⁰/, /ˣ⁵⁰/, /IPLC/i, /IEPL/i, /核心/, /边缘/, /高级/, /标准/, /实验/, /游戏|game/i, /购物/, /中转/, /优选/, /商宽/, /家宽/, /专线/, /V6/i,];
// regexArray: blgd=true 时匹配固定格式倍率/线路类型的正则列表

// prettier-ignore
const valueArray= [ "2×","3×","4×","5×","6×","7×","8×","9×","10×","20×","30×","40×","50×","「IPLC」","「IEPL」","「Kern」","「Edge」","「Pro」","「Std」","「Exp」","「Game」","「Buy」","「中转」","「优选」","「商宽」","「家宽」","「专线」","「V6」"];
// valueArray: 与 regexArray 一一对应的替换值

const nameblnx = /(高倍|(?!1)2+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
// nameblnx: blnx=true 时的保留规则——匹配高倍率（2+ 个 x/倍 或上标格式）

const namenx = /(高倍|(?!1)(0\.|\d)+(x|倍)|ˣ²|ˣ³|ˣ⁴|ˣ⁵|ˣ¹⁰)/i;
// namenx: nx=true 时的过滤规则——匹配高倍率节点（排除纯 "1x"）

const rurekey = {
  GB: /UK/,
  "B-G-P": /BGP/,
  "Russia Moscow": /Moscow/,
  "Korea Chuncheon": /Chuncheon|Seoul/,
  "Hong Kong": /Hongkong|HONG KONG/i,
  "United Kingdom London": /London|Great Britain/,
  "Dubai United Arab Emirates": /United Arab Emirates/,
  "Taiwan TW 台湾 🇹🇼": /(台|Tai\s?wan|TW).*?🇨🇳|🇨🇳.*?(台|Tai\s?wan|TW)/,
  "United States": /USA|Los Angeles|San Jose|Silicon Valley|Michigan/,
  澳大利亚: /澳洲|墨尔本|悉尼|土澳|(深|沪|呼|京|广|杭)澳/,
  德国: /(深|沪|呼|京|广|杭)德(?!.*(I|线))|法兰克福|滬德/,
  香港: /(深|沪|呼|京|广|杭)港(?!.*(I|线))/,
  日本: /(深|沪|呼|京|广|杭|中|辽)日(?!.*(I|线))|东京|大坂/,
  新加坡: /狮城|(深|沪|呼|京|广|杭)新/,
  美国: /(深|沪|呼|京|广|杭)美|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|芝加哥|美国|LA|US|us/,
  波斯尼亚和黑塞哥维那: /波黑共和国/,
  印尼: /印度尼西亚|雅加达/,
  印度: /孟买/,
  阿联酋: /迪拜|阿拉伯联合酋长国/,
  孟加拉国: /孟加拉/,
  捷克: /捷克共和国/,
  台湾: /新台|新北|台(?!.*线)/,
  Taiwan: /Taipei/,
  韩国: /春川|韩|首尔/,
  Japan: /Tokyo|Osaka/,
  英国: /伦敦/,
  India: /Mumbai/,
  Germany: /Frankfurt/,
  Switzerland: /Zurich/,
  俄罗斯: /莫斯科/,
  土耳其: /伊斯坦布尔/,
  泰国: /泰國|曼谷/,
  法国: /巴黎/,
  G: /\d\s?GB/i,
  Esnc: /esnc/i,
};
// rurekey: 节点名替换映射，将英文/缩写替换为标准地区名称
//   键 = 替换后的标准名称，值 = 匹配的正则
//   例：/London|Great Britain/ → "United Kingdom London"

// ========== 2. 可变变量（运行时修改） ==========

let FNAME = inArg.name == undefined ? "" : decodeURI(inArg.name)

// operator: 主处理函数，负责过滤、重命名、改写节点字段、排序和编号
function operator(pro) {
  const Allmap = {};
  const outList = getList(outputName);
  let inputList;
  if (inname !== "") {
    inputList = [getList(inname)];
  } else {
    inputList = [ZH, FG, QC, EN];
  }

  inputList.forEach((arr) => {
    arr.forEach((value, valueIndex) => {
      Allmap[value] = outList[valueIndex];
    });
  });
  const AMK = Object.entries(Allmap);
  const rureEntries = Object.entries(rurekey);

  if (nx || blnx || nameclear) {
    pro = pro.filter((res) => {
      const resname = res.name;
      const shouldKeep =
        !nameclear.test(resname) &&
        !(nx && namenx.test(resname)) &&
        !(blnx && !nameblnx.test(resname));
      return shouldKeep;
    });
  }

  const BLKEYS = BLKEY ? BLKEY.split("+") : [];

  pro.forEach((e) => {
    if(pro.length > 0) {
      FNAME = e._subName || ""
    }
    let bktf = false, ens = e.name, retainKey = ""
    rureEntries.forEach(([ikey, regex]) => {
      if (regex.test(e.name)) {
        var replaceRegex = new RegExp(regex.source, regex.ignoreCase ? "gi" : "g");
        e.name = e.name.replace(replaceRegex, ikey);
      if (BLKEY) {
        bktf = true
        let BLKEY_REPLACE = "",
        re = false;
      BLKEYS.forEach((i) => {
        if (i.includes(">") && ens.includes(i.split(">")[0])) {
          if (regex.test(i.split(">")[0])) {
              e.name += " " + i.split(">")[0]
            }
          if (i.split(">")[1]) {
            BLKEY_REPLACE = i.split(">")[1];
            re = true;
          }
        } else {
          if (ens.includes(i)) {
             e.name += " " + i
            }
        }
        retainKey = re
        ? BLKEY_REPLACE
        : BLKEYS.filter((items) => e.name.includes(items));
      });}
      }
    });
    // 优选替换：rurekey 改名后匹配关键词
    if (pref && pref.ip && (!pref.keyword || e.name.indexOf(pref.keyword) !== -1)) {
      var isProtoMatch = false;
      if (!pref.protocol || pref.protocol === "vless") {
        if (e.type === "vless" && e.network === "ws") isProtoMatch = true;
      }
      if (!pref.protocol || pref.protocol === "vmess") {
        if (e.type === "vmess" && e.network === "ws") isProtoMatch = true;
      }
       if (isProtoMatch) {
         e.server = pref.ip;
        }
    }
    if (blockquic == "on") {
      e["block-quic"] = "on";
    } else if (blockquic == "off") {
      e["block-quic"] = "off";
    } else {
      delete e["block-quic"];
    }
    
    if (!e["client-fingerprint"]) {
      e["client-fingerprint"] = "chrome";
    }

    // 自定义
    if (!bktf && BLKEY) {
      let BLKEY_REPLACE = "",
        re = false;
      BLKEYS.forEach((i) => {
        if (i.includes(">") && e.name.includes(i.split(">")[0])) {
          if (i.split(">")[1]) {
            BLKEY_REPLACE = i.split(">")[1];
            re = true;
          }
        }
      });
      retainKey = re
        ? BLKEY_REPLACE
        : BLKEYS.filter((items) => e.name.includes(items));
    }

    let ikey = "",
      ikeys = "";
    // 保留固定格式 倍率
    if (blgd) {
      regexArray.forEach((regex, index) => {
        if (regex.test(e.name)) {
          ikeys = valueArray[index];
        }
      });
    }

    // 正则 匹配倍率
    if (bl) {
      const match = e.name.match(
        /((倍率|X|x|×)\D?((\d{1,3}\.)?\d+)\D?)|((\d{1,3}\.)?\d+)(倍|X|x|×)/
      );
      if (match) {
        const rev = match[0].match(/(\d[\d.]*)/)[0];
        if (rev !== "1") {
          const newValue = rev + "×";
          ikey = newValue;
        }
      }
    }

    // 匹配 Allkey 地区
    const findKey = AMK.find(([regionName]) =>
      e.name.includes(regionName)
    )
    
    let firstName = "",
      nNames = "";

    const WrappedFNAME = `${FNAME}`; 

    if (nf) {
      firstName = WrappedFNAME;
    } else {
      nNames = WrappedFNAME;
    }
    if (findKey?.[1]) {
      const findKeyValue = findKey[1]; e._region = findKeyValue;
      let keyover = [],
        usflag = "";
      if (addflag) {
        const index = outList.indexOf(findKeyValue);
        if (index !== -1) {
          usflag = FG[index];
          usflag = usflag === "🇹🇼" ? "🇨🇳" : usflag;
        }
      }
      // 将 ikeys 暂存到节点上，稍后在序号后面追加
      e._ikeys = ikeys;
      keyover = keyover
        .concat(firstName, usflag, nNames, findKeyValue, retainKey, ikey)
        .filter((k) => k !== "");
      e.name = keyover.join(FGF);
    } else {
      if (nm) {
        e.name = FNAME + FGF + e.name;
      } else {
        e.name = null;
      }
    }
    deleteEchOpts(e);
  });
  pro = pro.filter((e) => e.name !== null);
  pro = sortAndNumber(pro);
  return pro;
}

// getList: 按地区格式返回对应的地区名称表
// prettier-ignore
function getList(arg) { switch (arg) { case 'us': return EN; case 'gq': return FG; case 'quan': return QC; default: return ZH; }}

// escapeRegExp: 将 clear 传入的普通文本转成安全的正则文本
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// splitCommaList: 统一按英文逗号或中文逗号拆分参数
function splitCommaList(text, keepEmpty) {
  if (!text) return [];
  var parts = String(text).split(/[,，]/).map(function(part) { return part.trim(); });
  return keepEmpty ? parts : parts.filter(Boolean);
}

// parseDelechRule: 解析 ech-opts 删除规则；单个协议名按协议匹配，否则按节点名关键词匹配
function parseDelechRule(raw) {
  if (!raw) return null;
  var parts = splitCommaList(raw);
  if (!parts.length) return null;
  var protocols = ["vless", "vmess", "trojan", "ss", "hysteria2", "anytls"];
  if (parts.length === 1) {
    var only = parts[0].toLowerCase();
    if (protocols.indexOf(only) !== -1) {
      return { keyword: "", protocol: only };
    }
    return { keyword: parts[0], protocol: "" };
  }
  return { keyword: parts[0], protocol: parts[1].toLowerCase() };
}

// deleteEchOpts: 仅在 delech 规则匹配时删除节点的 ech-opts 字段
function deleteEchOpts(node) {
  if (!isNodeEnv || !delechRule || !node || !node.name) return;
  var keywordMatched = !delechRule.keyword || node.name.indexOf(delechRule.keyword) !== -1;
  var protocolMatched = !delechRule.protocol || String(node.type || "").toLowerCase() === delechRule.protocol;
  if (keywordMatched && protocolMatched) {
    delete node["ech-opts"];
  }
}

// sortAndNumber: 统一处理 dqpx 排序、blpx 特殊节点后置和同名节点编号
function sortAndNumber(pro) {
  var areas = splitCommaList(dqpx);
  if (areas.length) {
    var buckets = areas.map(function() { return []; });
    var rest = [];
    for (var i = 0; i < pro.length; i++) {
      var node = pro[i], index = -1;
      for (var a = 0; a < areas.length; a++) {
        if ((node._region && node._region.includes(areas[a])) || (node.name && node.name.includes(areas[a]))) {
          index = a;
          break;
        }
      }
      index === -1 ? rest.push(node) : buckets[index].push(node);
    }
    pro = buckets.reduce(function(acc, list) { return acc.concat(list); }, []).concat(rest);
  }

  if (blpx) {
    var regions = [], regionMap = {}, ungrouped = [];
    for (var j = 0; j < pro.length; j++) {
      var proxy = pro[j];
      if (proxy._region) {
        if (!regionMap[proxy._region]) {
          regionMap[proxy._region] = [];
          regions.push(proxy._region);
        }
        regionMap[proxy._region].push(proxy);
      } else {
        ungrouped.push(proxy);
      }
    }

    pro = [];
    for (var r = 0; r < regions.length; r++) {
      pro.push.apply(pro, sortSpecialLast(regionMap[regions[r]]));
    }
    if (ungrouped.length) {
      pro.push.apply(pro, sortSpecialLast(ungrouped));
    }
  }

  return numberSameName(pro);
}

// sortSpecialLast: 将同地区内的普通节点放前面，特殊节点放后面并按标签规则排序
function sortSpecialLast(nodes) {
  var normal = [], special = [];
  for (var i = 0; i < nodes.length; i++) {
    var node = nodes[i];
    var name = node._ikeys ? node.name + FGF + node._ikeys : node.name;
    var idx = specialRegex.findIndex(function(regex) { return regex.test(name); });
    var cnIdx = chineseSpecialTags.findIndex(function(tag) { return name.indexOf(tag) !== -1; });
    idx === -1 ? normal.push(node) : special.push({ node: node, idx: idx, cnIdx: cnIdx, name: name });
  }
  special.sort(function(a, b) {
    if (a.cnIdx !== -1 && b.cnIdx !== -1 && a.cnIdx !== b.cnIdx) {
      return a.cnIdx - b.cnIdx;
    }
    return a.idx - b.idx || a.name.localeCompare(b.name);
  });
  return normal.concat(special.map(function(item) { return item.node; }));
}

// numberSameName: 按相同节点名分组并追加 01、02 这类序号
function numberSameName(pro) {
  var groups = [], groupMap = Object.create(null);
  for (var i = 0; i < pro.length; i++) {
    var node = pro[i];
    if (!groupMap[node.name]) {
      groupMap[node.name] = { count: 0, items: [] };
      groups.push(groupMap[node.name]);
    }
    var group = groupMap[node.name];
    var item = { ...node, name: node.name + XHFGF + (++group.count).toString().padStart(2, "0") };
    if (item._ikeys) {
      item.name += FGF + item._ikeys;
      delete item._ikeys;
    }
    group.items.push(item);
  }
  return groups.reduce(function(acc, group) { return acc.concat(group.items); }, []);
}
