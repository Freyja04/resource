// ========== 1. 固定值常量（不可变） ==========

const inArg = $arguments;
// 传入的参数对象，包含所有用户自定义配置

// ------------------ 布尔开关参数 ------------------
// 以下值均从 inArg 读取，未传入时取默认值：
// true = 启用该功能；false = 关闭
const nx = inArg.nx || false,
  // nx: 过滤掉高倍率节点（匹配 namenx 的节点会被移除）
  bl = inArg.bl || false,
  // bl: 启用正则匹配节点名中的倍率（如 "3×"、"2.5x"）
  nf = inArg.nf || false,
  // nf: 自定义名称（FNAME）放在最终名称最前面
  key = inArg.key || false,
  // key: 只保留热门地区节点（港/新/日/美/韩/土），且节点名含数字 2/4/6/7
  blgd = inArg.blgd || false,
  // blgd: 保留节点名中的固定格式倍率标记（如 2×、3×…50×、IPLC 等）
  blpx = inArg.blpx || false,
  // blpx: 按特殊规则排序——specialRegex 匹配的节点排最后
  blnx = inArg.blnx || false,
  // blnx: 只保留高倍率节点（匹配 nameblnx 的保留，其余过滤）
  numone = inArg.one || false,
  // numone: 去重处理，移除重复节点末尾的序号后缀
  debug = inArg.debug || false,
  // debug: 调试模式
  clear = inArg.clear || false,
  // clear: 过滤含有垃圾关键词的节点
  addflag = inArg.flag || false,
  // addflag: 在地区名左侧添加对应旗帜 emoji
  nm = inArg.nm || false;
  // nm: 未匹配到地区时，true = 保留原名并追加 FNAME；false = 过滤掉

// ------------------ 字符串参数 ------------------
const FGF = inArg.fgf == undefined ? " " : decodeURI(inArg.fgf),
  // FGF: 名称各部分之间的分隔符，默认空格
  XHFGF = inArg.sn == undefined ? " " : decodeURI(inArg.sn),
  // XHFGF: 序号分隔符，同名称节点编号时拼接使用，默认空格
  BLKEY = inArg.blkey == undefined ? "" : decodeURI(inArg.blkey),
  // BLKEY: 自定义关键词标记，多个用 "+" 分隔；支持 "关键词>替换值" 格式
  blockquic = inArg.blockquic == undefined ? "" : decodeURI(inArg.blockquic);
  // blockquic: QUIC 设置，"on" = 强制开启，"off" = 强制关闭，其他值 = 删除该设置

// ------------------ 优选替换参数 ------------------
const preferRaw = inArg.prefer || "";
// preferRaw: 优选替换配置，格式 "关键词 协议 IP" 或 "关键词 IP"
//   字段用空格隔开
//   关键词+IP:   "香港 1.2.3.4"         → 匹配含「香港」的节点，协议不限
//   协议+IP:    " vless 1.2.3.4"       → 关键词空，匹配所有 VLESS+WS 节点
//   完整格式:   "香港 vless 1.2.3.4"   → 关键词和协议都指定
//   全部节点:   " 1.2.3.4"             → 匹配所有 VLESS+WS 和 VMess+WS 节点
const pref = preferRaw ? (function() {
  var parts = preferRaw.split(/\s+/);
  if (parts.length < 2) return null;
  if (parts.length === 2) {
    return {
      keyword: parts[0].trim(),
      protocol: "",
      ip: parts[1].trim()
    };
  }
  return {
    keyword: (parts[0] || "").trim(),
    protocol: (parts[1] || "").trim().toLowerCase(),
    ip: parts[2] ? parts[2].trim() : ""
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
  // inname: 输入节点名的地区格式缩写
  //   "cn"/"zh" = 中文全称；"us"/"en" = 英文代码；
  //   "quan" = 英文全称；"gq"/"flag" = 旗帜 emoji
  //   空字符串 = 自动匹配所有格式
  outputName = nameMap[inArg.out] || "";
  // outputName: 输出节点的地区格式缩写，值同上

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

const nameclear =
  /(群|邀请|返利|循环|官网|客服|网站|网址|获取|订阅|到期|机场|下次|版本|官址|备用|过期|已用|联系|邮箱|工单|余额|失联|邮件|贩卖|软件|证书|通知|倒卖|防止|国内|地址|频道|无法|说明|使用|提示|特别|访问|支持|TLS|AFF|USE|USED|TOTAL|EXPIRE|EMAIL|Panel)/i;
// nameclear: clear=true 时过滤的垃圾关键词

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

const keya =
  /港|Hong|HK|新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR|🇸🇬|🇭🇰|🇯🇵|🇺🇸|🇰🇷|🇹🇷/i;
// keya: 热门地区匹配规则（港/新/日/美/韩/土）

const keyb =
  /(((1|2|3|4)\d)|(香港|Hong|HK) 0[5-9]|((新加坡|SG|Singapore|日本|Japan|JP|美国|United States|US|韩|土耳其|TR|Turkey|Korea|KR) 0[3-9]))/i;
// keyb: key=true 时的二次过滤——地区名后跟编号的，仅保留合理范围

const rurekey = {
  GB: /UK/g,
  "B-G-P": /BGP/g,
  "Russia Moscow": /Moscow/g,
  "Korea Chuncheon": /Chuncheon|Seoul/g,
  "Hong Kong": /Hongkong|HONG KONG/gi,
  "United Kingdom London": /London|Great Britain/g,
  "Dubai United Arab Emirates": /United Arab Emirates/g,
  "Taiwan TW 台湾 🇹🇼": /(台|Tai\s?wan|TW).*?🇨🇳|🇨🇳.*?(台|Tai\s?wan|TW)/g,
  "United States": /USA|Los Angeles|San Jose|Silicon Valley|Michigan/g,
  澳大利亚: /澳洲|墨尔本|悉尼|土澳|(深|沪|呼|京|广|杭)澳/g,
  德国: /(深|沪|呼|京|广|杭)德(?!.*(I|线))|法兰克福|滬德/g,
  香港: /(深|沪|呼|京|广|杭)港(?!.*(I|线))/g,
  日本: /(深|沪|呼|京|广|杭|中|辽)日(?!.*(I|线))|东京|大坂/g,
  新加坡: /狮城|(深|沪|呼|京|广|杭)新/g,
  美国: /(深|沪|呼|京|广|杭)美|波特兰|芝加哥|哥伦布|纽约|硅谷|俄勒冈|西雅图|芝加哥|美国|LA|US|us/g,
  波斯尼亚和黑塞哥维那: /波黑共和国/g,
  印尼: /印度尼西亚|雅加达/g,
  印度: /孟买/g,
  阿联酋: /迪拜|阿拉伯联合酋长国/g,
  孟加拉国: /孟加拉/g,
  捷克: /捷克共和国/g,
  台湾: /新台|新北|台(?!.*线)/g,
  Taiwan: /Taipei/g,
  韩国: /春川|韩|首尔/g,
  Japan: /Tokyo|Osaka/g,
  英国: /伦敦/g,
  India: /Mumbai/g,
  Germany: /Frankfurt/g,
  Switzerland: /Zurich/g,
  俄罗斯: /莫斯科/g,
  土耳其: /伊斯坦布尔/g,
  泰国: /泰國|曼谷/g,
  法国: /巴黎/g,
  G: /\d\s?GB/gi,
  Esnc: /esnc/gi,
};
// rurekey: 节点名替换映射，将英文/缩写替换为标准地区名称
//   键 = 替换后的标准名称，值 = 匹配的正则
//   例：/London|Great Britain/g → "United Kingdom London"

// ========== 2. 可变变量（运行时修改） ==========

let FNAME = inArg.name == undefined ? "" : decodeURI(inArg.name)
// FNAME: 自定义名称前缀/后缀
//   来自 inArg.name（URL 编码），默认空字符串
//   在 operator() 循环中被 e._subName 覆盖

let GetK = false, AMK = []
// GetK: 标记 Allmap 是否已转为键值对数组，避免重复转换
// AMK: Object.entries(Allmap) 的缓存结果，用于地区名查找匹配
//   初始化 false/[]，首次调用 ObjKA() 后填充并设为 true

function ObjKA(i) {
  GetK = true
  AMK = Object.entries(i)
}

function operator(pro) {
  const Allmap = {};
  const outList = getList(outputName);
  let inputList,
    retainKey = "";
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

  if (clear || nx || blnx || key) {
    pro = pro.filter((res) => {
      const resname = res.name;
      const shouldKeep =
        !(clear && nameclear.test(resname)) &&
        !(nx && namenx.test(resname)) &&
        !(blnx && !nameblnx.test(resname)) &&
        !(key && !(keya.test(resname) && /2|4|6|7/i.test(resname)));
      return shouldKeep;
    });
  }

  const BLKEYS = BLKEY ? BLKEY.split("+") : "";

  pro.forEach((e) => {
    if(pro.length > 0) {
      FNAME = e._subName
    }
    let bktf = false, ens = e.name
    Object.keys(rurekey).forEach((ikey) => {
      if (rurekey[ikey].test(e.name)) {
        e.name = e.name.replace(rurekey[ikey], ikey);
      if (BLKEY) {
        bktf = true
        let BLKEY_REPLACE = "",
        re = false;
      BLKEYS.forEach((i) => {
        if (i.includes(">") && ens.includes(i.split(">")[0])) {
          if (rurekey[ikey].test(i.split(">")[0])) {
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
          delete e["ech-opts"];
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

    !GetK && ObjKA(Allmap)
    // 匹配 Allkey 地区
    const findKey = AMK.find(([key]) =>
      e.name.includes(key)
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
      const findKeyValue = findKey[1];
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
  });
  pro = pro.filter((e) => e.name !== null);
  jxh(pro);
  // 将固定格式标签（「优选」「V6」等）追加到编号之后
  pro.forEach((e) => {
    if (e._ikeys) {
      e.name += FGF + e._ikeys;
      delete e._ikeys;
    }
  });
  numone && oneP(pro);
  blpx && (pro = fampx(pro));
  key && (pro = pro.filter((e) => !keyb.test(e.name)));
  return pro;
}

// prettier-ignore
function getList(arg) { switch (arg) { case 'us': return EN; case 'gq': return FG; case 'quan': return QC; default: return ZH; }}
// prettier-ignore
function jxh(e) { const n = e.reduce((e, n) => { const t = e.find((e) => e.name === n.name); if (t) { t.count++; t.items.push({ ...n, name: `${n.name}${XHFGF}${t.count.toString().padStart(2, "0")}`, }); } else { e.push({ name: n.name, count: 1, items: [{ ...n, name: `${n.name}${XHFGF}01` }], }); } return e; }, []);const t=(typeof Array.prototype.flatMap==='function'?n.flatMap((e) => e.items):n.reduce((acc, e) => acc.concat(e.items),[])); e.splice(0, e.length, ...t); return e;}
// prettier-ignore
function oneP(e) { const t = e.reduce((e, t) => { const n = t.name.replace(/[^A-Za-z0-9\u00C0-\u017F\u4E00-\u9FFF]+\d+$/, ""); if (!e[n]) { e[n] = []; } e[n].push(t); return e; }, {}); for (const e in t) { if (t[e].length === 1 && t[e][0].name.endsWith("01")) {/* const n = t[e][0]; n.name = e;*/ t[e][0].name= t[e][0].name.replace(/[^.]01/, "") } } return e; }
// prettier-ignore
function fampx(pro) { const wis = []; const wnout = []; for (const proxy of pro) { const fan = specialRegex.some((regex) => regex.test(proxy.name)); if (fan) { wis.push(proxy); } else { wnout.push(proxy); } } const sps = wis.map((proxy) => specialRegex.findIndex((regex) => regex.test(proxy.name)) ); wis.sort( (a, b) => sps[wis.indexOf(a)] - sps[wis.indexOf(b)] || a.name.localeCompare(b.name) ); wnout.sort((a, b) => pro.indexOf(a) - pro.indexOf(b)); return wnout.concat(wis);}
