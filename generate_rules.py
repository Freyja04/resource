# 文件名: generate_rules.py
# 这个脚本将读取 domain.list 文件，并根据其中的规则类型、目标、策略名以及可选的排除标记
# 生成适用于 Quantumult X, Loon 和 Mihomo/Clash Meta 的代理规则集。
# 仅支持 DOMAIN, DOMAIN-SUFFIX, DOMAIN-KEYWORD, IP-CIDR 四种规则类型。
# 域名/IP和排除类型的大小写将统一转换为小写，策略名将保持原始大小写。
# 对于 IP-CIDR 规则，Loon 和 Mihomo 默认会添加 ',no-resolve' 字段，无论 domain.list 中是否显式指定。

import os
from datetime import datetime
import ipaddress # 用于验证IP地址格式

def get_current_formatted_time():
    """
    获取当前格式化的本地时间，用于规则集中的时间戳。
    Returns:
        str: 格式化的时间字符串。
    """
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S %Z')

# 定义各种规则类型及其在不同代理工具中的对应格式
# None 表示该规则类型不被当前工具直接支持，将被跳过并发出警告
RULE_MAPPING = {
    'domain': {
        'qx': 'HOST', # QX通常使用HOST匹配DOMAIN
        'loon': 'DOMAIN',
        'mihomo': 'DOMAIN',
    },
    'domain-suffix': {
        'qx': 'HOST-SUFFIX',
        'loon': 'DOMAIN-SUFFIX',
        'mihomo': 'DOMAIN-SUFFIX',
    },
    'domain-keyword': {
        'qx': 'HOST-KEYWORD',
        'loon': 'DOMAIN-KEYWORD',
        'mihomo': 'DOMAIN-KEYWORD',
    },
    'ip-cidr': { # IP-CIDR/IP-CIDR6 将在生成函数内部根据IP版本判断
        'qx': 'IP-CIDR',
        'loon': 'IP-CIDR',
        'mihomo': 'IP-CIDR',
    },
}

def generate_quantumultx_rules(all_parsed_rules):
    """
    根据解析后的规则生成 Quantumult X 规则集内容。
    Args:
        all_parsed_rules (list): 包含所有解析规则的对象列表。
    Returns:
        str: 生成的 Quantumult X 规则集字符串。
    """
    rules = []
    current_time = get_current_formatted_time()
    rules.append(f"# Quantumult X Rule Set generated from your domain.list")
    rules.append(f"# Last updated: {current_time}")
    rules.append("")

    for item in all_parsed_rules:
        rule_type_from_list = item.get('type') # 例如 'domain', 'ip-cidr'
        target = item.get('target') # 域名或IP/CIDR (已转换为小写)
        policy = item.get('policy') # 策略名 (保持原始大小写)
        
        # 检查是否需要从 Quantumult X 规则中排除
        if 'qx' in item.get('exclude_from', set()):
            print(f"信息: '{target}' ({rule_type_from_list}) 被标记为 'exclude:qx'，已从 Quantumult X 规则中跳过。")
            continue

        # 获取 Quantumult X 对应的规则类型前缀
        qx_rule_prefix = RULE_MAPPING.get(rule_type_from_list, {}).get('qx')

        if qx_rule_prefix is None:
            print(f"警告: Quantumult X 不支持规则类型 '{rule_type_from_list}' (目标: '{target}')，已跳过。")
            continue # 跳过不支持的规则类型

        if target and policy:
            if rule_type_from_list == 'ip-cidr':
                try:
                    ip_network = ipaddress.ip_network(target, strict=False)
                    if ip_network.version == 4:
                        rules.append(f"IP-CIDR,{target},{policy}")
                    elif ip_network.version == 6:
                        rules.append(f"IP-CIDR6,{target},{policy}")
                except ValueError:
                    print(f"警告: Quantumult X 规则 '{target}' (IP-CIDR) 不是有效的 IP CIDR，跳过。")
            else:
                rules.append(f"{qx_rule_prefix},{target},{policy}")
        else:
            print(f"警告: 跳过 Quantumult X 规则，因为目标或策略缺失: {item}")
    return "\n".join(rules)

def generate_loon_rules(all_parsed_rules):
    """
    根据解析后的规则生成 Loon 规则集内容。
    Args:
        all_parsed_rules (list): 包含所有解析规则的对象列表。
    Returns:
        str: 生成的 Loon 规则集字符串。
    """
    rules = []
    current_time = get_current_formatted_time()
    rules.append(f";; Loon Rule Set generated from your domain.list")
    rules.append(f";; Last updated: {current_time}")
    rules.append("")

    for item in all_parsed_rules:
        rule_type_from_list = item.get('type')
        target = item.get('target')
        policy = item.get('policy')
        # needs_no_resolve = item.get('needs_no_resolve', False) # 不再直接控制，而是默认添加

        if 'loon' in item.get('exclude_from', set()):
            print(f"信息: '{target}' ({rule_type_from_list}) 被标记为 'exclude:loon'，已从 Loon 规则中跳过。")
            continue

        loon_rule_prefix = RULE_MAPPING.get(rule_type_from_list, {}).get('loon')

        if loon_rule_prefix is None:
            print(f"警告: Loon 不支持规则类型 '{rule_type_from_list}' (目标: '{target}')，已跳过。")
            continue

        if target and policy:
            if rule_type_from_list == 'ip-cidr':
                # 对于Loon的IP规则，无论domain.list中是否指定，都默认添加',no-resolve'
                no_resolve_suffix = ",no-resolve" 
                try:
                    ip_network = ipaddress.ip_network(target, strict=False)
                    if ip_network.version == 4:
                        rules.append(f"IP-CIDR,{target},{policy}{no_resolve_suffix}")
                    elif ip_network.version == 6:
                        rules.append(f"IP-CIDR6,{target},{policy}{no_resolve_suffix}")
                except ValueError:
                    print(f"警告: Loon 规则 '{target}' (IP-CIDR) 不是有效的 IP CIDR，跳过。")
            else:
                rules.append(f"{loon_rule_prefix},{target},{policy}")
        else:
            print(f"警告: 跳过 Loon 规则，因为目标或策略缺失: {item}")
    return "\n".join(rules)

def generate_mihomo_rules(all_parsed_rules):
    """
    根据解析后的规则生成 Mihomo (Clash Meta) 规则集内容。
    Args:
        all_parsed_rules (list): 包含所有解析规则的对象列表。
    Returns:
        str: 生成的 Mihomo 规则集字符串。
    """
    rules = []
    current_time = get_current_formatted_time()
    rules.append(f"# Mihomo (Clash Meta) Rule Set generated from your domain.list")
    rules.append(f"# Last updated: {current_time}")
    rules.append("")

    for item in all_parsed_rules:
        rule_type_from_list = item.get('type')
        target = item.get('target')
        policy = item.get('policy')
        # needs_no_resolve = item.get('needs_no_resolve', False) # 不再直接控制，而是默认添加

        if 'mihomo' in item.get('exclude_from', set()):
            print(f"信息: '{target}' ({rule_type_from_list}) 被标记为 'exclude:mihomo'，已从 Mihomo 规则中跳过。")
            continue

        mihomo_rule_prefix = RULE_MAPPING.get(rule_type_from_list, {}).get('mihomo')

        if mihomo_rule_prefix is None:
            print(f"警告: Mihomo 不支持规则类型 '{rule_type_from_list}' (目标: '{target}')，已跳过。")
            continue # 跳过不支持的规则类型

        if target and policy:
            if rule_type_from_list == 'ip-cidr':
                # 对于Mihomo的IP规则，无论domain.list中是否指定，都默认添加',no-resolve'
                no_resolve_suffix = ",no-resolve" 
                try:
                    ip_network = ipaddress.ip_network(target, strict=False)
                    if ip_network.version == 4:
                        rules.append(f"IP-CIDR,{target},{policy}{no_resolve_suffix}")
                    elif ip_network.version == 6:
                        rules.append(f"IP-CIDR6,{target},{policy}{no_resolve_suffix}")
                except ValueError:
                    print(f"警告: Mihomo 规则 '{target}' (IP-CIDR) 不是有效的 IP CIDR，跳过。")
            else:
                rules.append(f"{mihomo_rule_prefix},{target},{policy}")
        else:
            print(f"警告: 跳过 Mihomo 规则，因为目标或策略缺失: {item}")
    return "\n".join(rules)

def main():
    """
    主函数，负责读取输入文件，解析数据，生成所有规则集并写入输出文件。
    """
    domain_list_file = "domain.list"  # 输入文件名

    # 定义输出目录
    output_directory = "rules"
    # 定义输出文件名和后缀
    quantumultx_output_file = os.path.join(output_directory, "quantumultx_rules.list")
    loon_output_file = os.path.join(output_directory, "loon_rules.list")
    mihomo_output_file = os.path.join(output_directory, "mihomo_rules.list")

    # 确保输出目录存在，如果不存在则创建
    os.makedirs(output_directory, exist_ok=True)

    all_parsed_rules = [] # 存储解析后的所有规则信息
    try:
        # 以UTF-8编码读取 domain.list 文件内容
        with open(domain_list_file, "r", encoding="utf-8") as f:
            for line in f:
                trimmed_line = line.strip()
                # 跳过空行和注释行
                if not trimmed_line or trimmed_line.startswith('#'):
                    continue

                # 使用逗号分割所有部分
                parts = [p.strip() for p in trimmed_line.split(',')]

                # 至少需要规则类型、目标和策略
                if len(parts) < 3:
                    print(f"警告: 跳过格式不正确的行 (至少需要规则类型、目标和策略): \"{trimmed_line}\" (原始行)。")
                    continue

                rule_type_str_raw = parts[0]
                target_str_raw = parts[1]
                policy_raw = parts[2]
                
                # 统一转换为小写进行匹配，策略名保持原始大小写
                rule_type = rule_type_str_raw.lower()
                target = target_str_raw.lower()
                policy = policy_raw # 策略名保持原始大小写

                # 初始化可选字段
                # needs_no_resolve = False # 不再需要，因为是默认添加
                exclude_types = set()

                # 处理剩余的可选部分（从第四部分开始）
                if len(parts) > 3:
                    for i in range(3, len(parts)):
                        optional_part = parts[i].strip().lower() # 转换为小写进行匹配

                        # if optional_part == 'no-resolve': # 不再需要显式判断 no-resolve，它是默认行为
                        #     needs_no_resolve = True
                        if optional_part.startswith('exclude:'):
                            types_str = optional_part[len('exclude:'):]
                            if types_str:
                                exclude_types.update(t.strip().lower() for t in types_str.split(',') if t.strip())
                        else:
                            print(f"警告: 无法识别的可选字段 '{parts[i]}'，已忽略。行: \"{trimmed_line}\" (原始行)。")


                # 验证规则类型是否是我们支持的类型
                if rule_type not in RULE_MAPPING:
                    print(f"警告: 提供的规则类型 '{rule_type_str_raw}' 不受支持，已跳过行: \"{trimmed_line}\" (原始行)。")
                    continue

                # 验证 IP CIDR 格式（如果是 IP-CIDR 类型）
                if rule_type == 'ip-cidr':
                    try:
                        ipaddress.ip_network(target, strict=False)
                    except ValueError:
                        print(f"警告: IP CIDR格式不正确，跳过行: \"{trimmed_line}\" (原始行)。")
                        continue
                
                # 确保目标和策略都不为空
                if target and policy:
                    all_parsed_rules.append({
                        'type': rule_type,
                        'target': target,
                        'policy': policy,
                        'exclude_from': exclude_types,
                        # 'needs_no_resolve': needs_no_resolve # 不再需要，因为是默认添加
                    })
                else:
                    print(f"警告: 跳过格式不正确的行 (目标或策略为空): \"{trimmed_line}\" (原始行)。")
    except FileNotFoundError:
        print(f"错误: {domain_list_file} 未找到。请确保文件存在且每行格式正确。")
        exit(1)
    except Exception as e:
        print(f"读取 {domain_list_file} 时发生错误: {e}")
        exit(1)

    # 生成 Quantumult X 规则并写入文件
    try:
        qx_rules_content = generate_quantumultx_rules(all_parsed_rules)
        with open(quantumultx_output_file, "w", encoding="utf-8") as f:
            f.write(qx_rules_content)
        print(f"已生成 {quantumultx_output_file}")
    except Exception as e:
        print(f"生成 Quantumult X 规则时发生错误: {e}")

    # 生成 Loon 规则并写入文件
    try:
        loon_rules_content = generate_loon_rules(all_parsed_rules)
        with open(loon_output_file, "w", encoding="utf-8") as f:
            f.write(loon_rules_content)
        print(f"已生成 {loon_output_file}")
    except Exception as e:
        print(f"生成 Loon 规则时发生错误: {e}")

    # 生成 Mihomo 规则并写入文件
    try:
        mihomo_rules_content = generate_mihomo_rules(all_parsed_rules)
        with open(mihomo_output_file, "w", encoding="utf-8") as f:
            f.write(mihomo_rules_content)
        print(f"已生成 {mihomo_output_file}")
    except Exception as e:
        print(f"生成 Mihomo 规则时发生错误: {e}")

if __name__ == "__main__":
    main()
