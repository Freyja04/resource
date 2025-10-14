import os

def convert_and_sync_rules_to_loon_plugin(repo_root_dir="."):
    """
    1. 将 rule.list 中的 QX 格式规则转换为标准的、小写的规则格式。
    2. 将转换后的规则内容同步（替换）到 loon/plugin/rule.plugin 文件中 [rule] 节后面的内容。
    """
    rule_list_path = os.path.join(repo_root_dir, "rule.list")
    plugin_path = os.path.join(repo_root_dir, "loon", "plugin", "rule.plugin") # 目标文件路径

    # --- 1. 检查文件是否存在 ---
    if not os.path.exists(rule_list_path):
        print(f"错误：找不到源文件 {rule_list_path}。请确认路径是否正确。")
        return

    if not os.path.exists(plugin_path):
        print(f"错误：目标文件 {plugin_path} 不存在。请先手动创建该文件。")
        return

    # --- 2. 读取 rule.list 的内容并进行转换 ---
    converted_rules = []
    
    try:
        with open(rule_list_path, 'r', encoding='utf-8') as f:
            for line in f:
                original_line = line # 保留原始行用于注释或非规则行
                stripped_line = line.strip()
                
                # 忽略空行和注释，并保留原始行
                if not stripped_line or stripped_line.startswith(('#', ';', '//')):
                    # 如果需要保留注释和空行在 [rule] 节内，则直接添加
                    converted_rules.append(original_line)
                    continue
                
                parts = [p.strip() for p in stripped_line.split(',', 2)]
                
                if len(parts) < 3:
                    print(f"警告: 规则格式不完整，已跳过: {stripped_line}")
                    continue
                    
                # 统一转换为大写以便匹配
                rule_type_upper = parts[0].upper()
                rule_value = parts[1].lower() # 规则值转小写
                policy = parts[2].lower()     # 策略组名称转小写
                
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
                elif rule_type_upper in ("IP-CIDR", "IP-CIDR6", "GEOIP", "GEOIP-CN", "FINAL"):
                    pass 
                else:
                    # 忽略其他不希望转换的规则类型
                    continue
                
                # 构建转换后的标准规则，类型名称转小写
                standard_rule = f"{new_rule_type.lower()},{rule_value},{policy}\n"
                converted_rules.append(standard_rule)
                
    except Exception as e:
        print(f"读取或处理 {rule_list_path} 文件时发生错误：{e}")
        return
        
    # 在转换后的规则前添加一个空行，美观
    final_rules_to_insert = ["\n"] + converted_rules

    # --- 3. 处理 rule.plugin 文件并替换 [rule] 节 ---
    try:
        # 使用 'r+' 模式，以便读取后可以重置指针并写入
        with open(plugin_path, 'r+', encoding='utf-8') as f:
            plugin_lines = f.readlines()
            
            rule_section_start_index = -1
            rule_section_end_index = -1

            # 找到 [rule] 节的起始行
            for i, line in enumerate(plugin_lines):
                if line.strip().lower() == "[rule]": # 兼容大小写
                    rule_section_start_index = i
                    break
            
            if rule_section_start_index == -1:
                print(f"错误：在 {plugin_path} 中未找到 [rule] 部分。无法同步规则。")
                return 

            # 找到 [rule] 部分的结束行（下一个以 '[' 开头的节，或者文件末尾）
            for i in range(rule_section_start_index + 1, len(plugin_lines)):
                stripped_line = plugin_lines[i].strip()
                # 找到下一个节标题
                if stripped_line.startswith("[") and stripped_line.endswith("]"): 
                    rule_section_end_index = i
                    break
            
            if rule_section_end_index == -1:
                rule_section_end_index = len(plugin_lines) # 如果没有找到下一个节，就到文件末尾

            # 构建新的文件内容
            # 头部内容 (从文件开始到 [rule] 节)
            new_plugin_content = plugin_lines[:rule_section_start_index + 1] # 包含 [rule] 这一行

            # 插入来自 rule.list 转换后的新规则内容
            new_plugin_content.extend(final_rules_to_insert)

            # 尾部内容 (从 [rule] 节结束后到文件末尾)
            new_plugin_content.extend(plugin_lines[rule_section_end_index:])

            # 写回文件
            f.seek(0)
            f.writelines(new_plugin_content)
            f.truncate() # 清除旧内容中多余的部分

        print(f"✅ 成功将 {rule_list_path} 中的 QX 规则转换为小写标准格式，并替换到 {plugin_path} 的 [rule] 节中。")

    except Exception as e:
        print(f"处理 {plugin_path} 文件时发生错误：{e}")


if __name__ == "__main__":
    convert_and_sync_rules_to_loon_plugin()