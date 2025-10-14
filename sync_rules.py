import os
from typing import List, Tuple, Optional

# --- 辅助函数：用于规则转换 ---

def is_functional_rule(line: str) -> bool:
    """检查一行是否是功能性规则（非注释、非空行）。"""
    stripped = line.strip()
    return bool(stripped) and not stripped.startswith(('#', ';', '//'))

def convert_rule_line(line: str) -> str:
    """
    将 QX 格式规则转换为小写标准格式。
    如果无法识别或转换，则返回原行。
    """
    if not is_functional_rule(line):
        return line # 保留非规则行

    parts = [p.strip() for p in line.strip().split(',', 2)]
    if len(parts) < 3:
        # 格式错误，保留原行
        return line
    
    # 统一转换为大写以便匹配
    rule_type_upper = parts[0].upper()
    rule_value = parts[1].lower() # 规则值转小写
    policy = parts[2].lower()     # 策略组名称转小写
    
    new_rule_type = rule_type_upper
    
    # 规则类型转换逻辑
    if rule_type_upper == "HOST":
        new_rule_type = "DOMAIN" 
    elif rule_type_upper == "HOST-SUFFIX":
        new_rule_type = "DOMAIN-SUFFIX"
    elif rule_type_upper == "HOST-KEYWORD":
        new_rule_type = "DOMAIN-KEYWORD"
    elif rule_type_upper == "HOST-WILDCARD":
        new_rule_type = "DOMAIN-WILDCARD"
    elif rule_type_upper == "IP6-CIDR":
        new_rule_type = "IP-CIDR6"    
    elif rule_type_upper in ("IP-CIDR", "GEOIP", "GEOIP-CN", "FINAL"):
        pass # 兼容规则类型保持不变
    else:
        # 无法识别的规则类型，保留原行
        return line

    # 构建转换后的标准规则，类型名称转小写
    return f"{new_rule_type.lower()},{rule_value},{policy}\n"

def process_rule_list(rule_list_path: str) -> List[str]:
    """读取 rule.list，对所有规则行进行转换，并保留注释/空行。"""
    processed_lines = []
    try:
        with open(rule_list_path, 'r', encoding='utf-8') as f:
            for line in f:
                processed_lines.append(convert_rule_line(line))
    except Exception as e:
        print(f"处理 {rule_list_path} 文件时发生错误：{e}")
    return processed_lines


def sync_rules_to_loon_plugin_replace(repo_root_dir="."):
    """
    将 rule.list 转换后的内容完全替换到 loon/plugin/rule.plugin 文件中 [rule] 节后面的内容。
    """
    rule_list_path = os.path.join(repo_root_dir, "rule.list")
    plugin_path = os.path.join(repo_root_dir, "loon", "plugin", "rule.plugin")

    # --- 1. 检查文件是否存在 ---
    if not os.path.exists(rule_list_path) or not os.path.exists(plugin_path):
        print("错误：源文件或目标文件不存在，请检查路径。")
        return

    # --- 2. 处理 rule.list，获取转换后的内容 ---
    converted_rules = process_rule_list(rule_list_path)
    
    # --- 3. 处理 rule.plugin 文件并替换 [rule] 节 ---
    try:
        with open(plugin_path, 'r+', encoding='utf-8') as f:
            plugin_lines = f.readlines()
            
            rule_section_start_index = -1
            rule_section_end_index = -1

            # A. 找到 [rule] 节的起始行
            for i, line in enumerate(plugin_lines):
                if line.strip().lower() == "[rule]":
                    rule_section_start_index = i
                    break
            
            if rule_section_start_index == -1:
                print(f"错误：在 {plugin_path} 中未找到 [rule] 部分。无法同步规则。")
                return 

            # B. 找到 [rule] 部分的结束行（下一个以 '[' 开头的节，或者文件末尾）
            for i in range(rule_section_start_index + 1, len(plugin_lines)):
                stripped_line = plugin_lines[i].strip()
                # 找到下一个节标题
                if stripped_line.startswith("[") and stripped_line.endswith("]"): 
                    rule_section_end_index = i
                    break
            
            if rule_section_end_index == -1:
                rule_section_end_index = len(plugin_lines) 

            # C. 构建新的文件内容
            
            # 头部内容 (从文件开始到 [rule] 节，包含 [rule] 这一行)
            new_plugin_content = plugin_lines[:rule_section_start_index + 1] 

            # 插入 rule.list 转换后的内容，确保开头有一个空行以保持格式美观
            new_plugin_content.append('\n')
            new_plugin_content.extend(converted_rules)

            # 尾部内容 (从 [rule] 节结束后到文件末尾)
            new_plugin_content.extend(plugin_lines[rule_section_end_index:])

            # D. 写回文件
            f.seek(0)
            f.writelines(new_plugin_content)
            f.truncate() 

        print(f"✅ 成功：{plugin_path} 文件中 [rule] 节的内容已被 {rule_list_path} 转换后的内容完全替换。")

    except Exception as e:
        print(f"处理 {plugin_path} 文件时发生错误：{e}")

if __name__ == "__main__":
    sync_rules_to_loon_plugin_replace()