# 文件名: generate_rules.py
# 这个脚本将读取 domain.list 文件，并根据其中的域名、策略名以及可选的排除标记
# 生成适用于 Quantumult X, Loon 和 Mihomo/Clash Meta 的代理规则集。

import os
from datetime import datetime

def get_current_formatted_time():
    """
    获取当前格式化的本地时间，用于规则集中的时间戳。
    Returns:
        str: 格式化的时间字符串。
    """
    # 使用strftime格式化时间，并添加时区信息
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S %Z')

def generate_quantumultx_rules(domain_policies):
    """
    根据域名和策略生成 Quantumult X 规则集内容。
    格式: HOST,域名,策略名
    Args:
        domain_policies (list): 包含域名和策略的对象列表，例如 [{'domain': 'example.com', 'policy': 'PolicyName', 'exclude_from': set()}]。
    Returns:
        str: 生成的 Quantumult X 规则集字符串。
    """
    rules = []
    current_time = get_current_formatted_time()
    rules.append(f"# Quantumult X Rule Set generated from your domain.list")
    rules.append(f"# Last updated: {current_time}")
    rules.append("") # 添加一个空行以提高可读性

    for item in domain_policies:
        domain = item.get('domain')
        policy = item.get('policy')
        # 检查是否需要从 Quantumult X 规则中排除
        if 'qx' in item.get('exclude_from', set()):
            print(f"信息: 域名 '{domain}' 被标记为 'exclude:qx'，已从 Quantumult X 规则中跳过。")
            continue # 跳过此域名

        # 确保域名和策略都存在且非空，避免生成无效规则
        if domain and policy:
            rules.append(f"HOST,{domain},{policy}")
        else:
            print(f"警告: 跳过 Quantumult X 规则，因为域名或策略缺失: {item}")
    return "\n".join(rules)

def generate_loon_rules(domain_policies):
    """
    根据域名和策略生成 Loon 规则集内容。
    格式: DOMAIN,域名,策略名
    Args:
        domain_policies (list): 包含域名和策略的对象列表。
    Returns:
        str: 生成的 Loon 规则集字符串。
    """
    rules = []
    current_time = get_current_formatted_time()
    rules.append(f";; Loon Rule Set generated from your domain.list")
    rules.append(f";; Last updated: {current_time}")
    rules.append("") # 添加一个空行以提高可读性

    for item in domain_policies:
        domain = item.get('domain')
        policy = item.get('policy')
        # 检查是否需要从 Loon 规则中排除
        if 'loon' in item.get('exclude_from', set()):
            print(f"信息: 域名 '{domain}' 被标记为 'exclude:loon'，已从 Loon 规则中跳过。")
            continue # 跳过此域名

        # 确保域名和策略都存在且非空
        if domain and policy:
            rules.append(f"DOMAIN,{domain},{policy}")
        else:
            print(f"警告: 跳过 Loon 规则，因为域名或策略缺失: {item}")
    return "\n".join(rules)

def generate_mihomo_rules(domain_policies):
    """
    根据域名和策略生成 Mihomo (Clash Meta) 规则集内容。
    格式: DOMAIN-SUFFIX,域名,策略名
    对于 Mihomo/Clash，DOMAIN-SUFFIX 通常用于匹配主域名及其所有子域名。
    Args:
        domain_policies (list): 包含域名和策略的对象列表。
    Returns:
        str: 生成的 Mihomo 规则集字符串。
    """
    rules = []
    current_time = get_current_formatted_time()
    rules.append(f"# Mihomo (Clash Meta) Rule Set generated from your domain.list")
    rules.append(f"# Last updated: {current_time}")
    rules.append("") # 添加一个空行以提高可读性

    for item in domain_policies:
        domain = item.get('domain')
        policy = item.get('policy')
        # 检查是否需要从 Mihomo 规则中排除
        if 'mihomo' in item.get('exclude_from', set()):
            print(f"信息: 域名 '{domain}' 被标记为 'exclude:mihomo'，已从 Mihomo 规则中跳过。")
            continue # 跳过此域名

        # 确保域名和策略都存在且非空
        if domain and policy:
            rules.append(f"DOMAIN-SUFFIX,{domain},{policy}")
        else:
            print(f"警告: 跳过 Mihomo 规则，因为域名或策略缺失: {item}")
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

    domain_policies = []
    try:
        # 以UTF-8编码读取 domain.list 文件内容
        with open(domain_list_file, "r", encoding="utf-8") as f:
            for line in f:
                trimmed_line = line.strip()
                # 跳过空行和注释行
                if not trimmed_line or trimmed_line.startswith('#'):
                    continue

                # 使用逗号分割域名、策略和可选的排除标记
                # 最多分割3次，得到4部分：domain, policy, exclude_keyword, exclude_types_str (如果有的话)
                parts = trimmed_line.split(',', 3) 

                if len(parts) >= 2:
                    domain = parts[0].strip()
                    policy = parts[1].strip()
                    exclude_types = set() # 用集合存储排除类型，方便查询

                    if len(parts) == 3: # 只有三部分，说明第三部分是排除标记
                        exclude_part = parts[2].strip().lower()
                        if exclude_part.startswith('exclude:'):
                            # 解析 exclude:qx,loon 这种格式
                            types_str = exclude_part[len('exclude:'):]
                            if types_str:
                                exclude_types = set(t.strip() for t in types_str.split(',') if t.strip())
                        # else: 如果第三部分不是 "exclude:..."，则不作为排除标记处理

                    # 确保域名和策略都不为空
                    if domain and policy:
                        domain_policies.append({
                            'domain': domain,
                            'policy': policy,
                            'exclude_from': exclude_types
                        })
                    else:
                        print(f"警告: 跳过格式不正确的行 (域名或策略为空): \"{trimmed_line}\"")
                else:
                    print(f"警告: 跳过格式不正确的行 (缺少逗号或策略): \"{trimmed_line}\"")
    except FileNotFoundError:
        print(f"错误: {domain_list_file} 未找到。请确保文件存在且每行格式正确。")
        exit(1) # 遇到错误时退出脚本
    except Exception as e:
        print(f"读取 {domain_list_file} 时发生错误: {e}")
        exit(1) # 遇到错误时退出脚本

    # 生成 Quantumult X 规则并写入文件
    try:
        qx_rules_content = generate_quantumultx_rules(domain_policies)
        with open(quantumultx_output_file, "w", encoding="utf-8") as f:
            f.write(qx_rules_content)
        print(f"已生成 {quantumultx_output_file}")
    except Exception as e:
        print(f"生成 Quantumult X 规则时发生错误: {e}")

    # 生成 Loon 规则并写入文件
    try:
        loon_rules_content = generate_loon_rules(domain_policies)
        with open(loon_output_file, "w", encoding="utf-8") as f:
            f.write(loon_rules_content)
        print(f"已生成 {loon_output_file}")
    except Exception as e:
        print(f"生成 Loon 规则时发生错误: {e}")

    # 生成 Mihomo 规则并写入文件
    try:
        mihomo_rules_content = generate_mihomo_rules(domain_policies)
        with open(mihomo_output_file, "w", encoding="utf-8") as f:
            f.write(mihomo_rules_content)
        print(f"已生成 {mihomo_output_file}")
    except Exception as e:
        print(f"生成 Mihomo 规则时发生错误: {e}")

if __name__ == "__main__":
    main()
