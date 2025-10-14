import os

def convert_quantumultx_rules_to_standard_final(repo_root_dir="."):
    """
    将 QX 格式规则（源文件 rule.list）转换为标准的规则格式（目标文件 rule.plugin），
    并将规则类型、值（域名/IP）和策略组全部转换为小写。
    
    涉及转换：HOST, HOST-SUFFIX, HOST-KEYWORD, HOST-WILDCARD, IP-CIDR, IP-CIDR6, GEOIP, FINAL
    """
    # 根据用户要求设置源文件和目标文件路径
    qx_input_path = os.path.join(repo_root_dir, "rule.list") 
    standard_output_path = os.path.join(repo_root_dir, "rule.plugin") 

    # --- 1. 检查文件是否存在 ---
    if not os.path.exists(qx_input_path):
        print(f"错误：找不到源文件 {qx_input_path}。请确认路径是否正确。")
        return

    # --- 2. 读取 QX 规则并转换 ---
    converted_rules = []
    
    try:
        with open(qx_input_path, 'r', encoding='utf-8') as f:
            for line in f:
                original_line = line
                stripped_line = line.strip()
                
                # 忽略空行和注释，并保留原始行（保持注释内容的原样）
                if not stripped_line or stripped_line.startswith(('#', ';', '//')):
                    converted_rules.append(original_line)
                    continue
                
                # QX 规则通常是逗号分隔
                parts = [p.strip() for p in stripped_line.split(',', 2)]
                
                if len(parts) < 3:
                    print(f"警告: 规则格式不完整，已跳过: {stripped_line}")
                    continue
                    
                # 统一转换为大写以便匹配
                rule_type_upper = parts[0].upper()
                rule_value = parts[1].lower() # 规则值统一转小写
                policy = parts[2].lower()     # 策略组名称统一转小写
                
                # 规则类型转换逻辑
                new_rule_type = rule_type_upper
                
                if rule_type_upper == "HOST":
                    new_rule_type = "DOMAIN" 
                    
                elif rule_type_upper == "HOST-SUFFIX":
                    new_rule_type = "DOMAIN-SUFFIX"

                elif rule_type_upper == "HOST-KEYWORD":
                    new_rule_type = "DOMAIN-KEYWORD"

                elif rule_type_upper == "HOST-WILDCARD":
                    new_rule_type = "DOMAIN-WILDCARD"
                
                # IP-CIDR 和 GEOIP 等直接兼容
                elif rule_type_upper in ("IP-CIDR", "IP-CIDR6", "GEOIP", "GEOIP-CN", "FINAL"):
                    pass 
                
                else:
                    # 忽略其他不希望转换的规则类型
                    continue
                
                # 构建转换后的标准规则，类型名称转小写
                standard_rule = f"{new_rule_type.lower()},{rule_value},{policy}\n"
                converted_rules.append(standard_rule)
                
    except Exception as e:
        print(f"读取或处理 {qx_input_path} 文件时发生错误：{e}")
        return

    # --- 3. 写入转换后的规则到目标文件 ---
    try:
        with open(standard_output_path, 'w', encoding='utf-8') as f:
            f.write("## Standard Rule List converted from Quantumult X format (ALL LOWERCASE)\n\n")
            f.writelines(converted_rules)

        print(f"成功将 {qx_input_path} 中的 QX 规则转换为小写标准格式，并写入到 {standard_output_path}。")

    except Exception as e:
        print(f"写入 {standard_output_path} 文件时发生错误：{e}")

if __name__ == "__main__":
    convert_quantumultx_rules_to_standard_final()