import os
from typing import List

# --- 保护区标记常量 ---
PROTECT_START_TAG = "# <LOON-BEGIN>" 
PROTECT_END_TAG = "# <LOON-END>"

# --- 辅助函数：用于规则转换 ---

def is_functional_rule(line: str) -> bool:
    """检查一行是否是功能性规则（非注释、非空行）。"""
    stripped = line.strip()
    return bool(stripped) and not stripped.startswith(('#', ';', '//'))

def convert_rule_line(line: str) -> str:
    """
    将 QX 格式规则转换为小写标准格式，并为 IP 类规则添加 no-resolve。
    如果无法识别或转换，则返回原行。
    """
    if not is_functional_rule(line):
        return line 

    parts = [p.strip() for p in line.strip().split(',', 2)]
    if len(parts) < 3:
        return line
    
    rule_type_upper = parts[0].upper()
    rule_value = parts[1].lower()
    policy = parts[2].lower()
    
    new_rule_type = rule_type_upper
    extra_params = "" # 用于存储 no-resolve

    # 规则类型转换逻辑
    if rule_type_upper == "HOST":
        new_rule_type = "DOMAIN" 
    elif rule_type_upper == "HOST-SUFFIX":
        new_rule_type = "DOMAIN-SUFFIX"
    elif rule_type_upper == "HOST-KEYWORD":
        new_rule_type = "DOMAIN-KEYWORD"
    elif rule_type_upper == "HOST-WILDCARD":
        new_rule_type = "DOMAIN-WILDCARD"
    
    # --- IP 类规则：进行格式转换并添加 no-resolve ---
    elif rule_type_upper == "IP-CIDR":
        new_rule_type = "IP-CIDR"
        extra_params = ",no-resolve"
    elif rule_type_upper == "IP6-CIDR":
        new_rule_type = "IP-CIDR6"    # QX 格式转标准格式
        extra_params = ",no-resolve"
    
    # --- 其他兼容规则 ---
    elif rule_type_upper in ("GEOIP", "GEOIP-CN", "FINAL"):
        pass
    else:
        return line

    # 构建转换后的标准规则： 类型,值,策略,no-resolve\n
    return f"{new_rule_type.lower()},{rule_value},{policy}{extra_params}\n"

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


def sync_rules_to_loon_plugin_protected_dual_tag(repo_root_dir="."):
    """
    将 rule.list 转换后的内容插入到 loon/plugin/rule.plugin 文件中 
    # <LOON-END> 标记之后，并替换该区域内原有的非保护内容。
    """
    rule_list_path = os.path.join(repo_root_dir, "rule.list")
    plugin_path = os.path.join(repo_root_dir, "loon", "plugin", "rule.plugin")

    # --- 1. 检查文件 ---
    if not os.path.exists(rule_list_path) or not os.path.exists(plugin_path):
        print("错误：源文件或目标文件不存在，请检查路径。")
        return

    # --- 2. 处理 rule.list，获取转换后的内容 ---
    converted_rules = process_rule_list(rule_list_path)
    
    # --- 3. 处理 rule.plugin 文件 ---
    try:
        with open(plugin_path, 'r+', encoding='utf-8') as f:
            plugin_lines = f.readlines()
            
            # 初始化边界索引
            rule_section_start_index = -1  # [rule] 节开始
            protect_start_index = -1       # # <LOON-BEGIN> 标记
            protect_end_index = -1         # # <LOON-END> 标记
            rule_section_end_index = -1    # 下一个节开始或文件末尾

            # 查找所有边界
            for i, line in enumerate(plugin_lines):
                if line.strip().lower() == "[rule]":
                    rule_section_start_index = i
                elif line.strip() == PROTECT_START_TAG:
                    protect_start_index = i
                elif line.strip() == PROTECT_END_TAG:
                    protect_end_index = i
                elif line.strip().startswith("[") and line.strip() != "[rule]":
                    if rule_section_start_index != -1 and rule_section_end_index == -1:
                        rule_section_end_index = i
            
            # 检查关键边界
            if rule_section_start_index == -1:
                print(f"错误：在 {plugin_path} 中未找到 [rule] 部分。无法同步规则。")
                return 

            if rule_section_end_index == -1:
                 rule_section_end_index = len(plugin_lines)
            
            # 检查保护区标记是否存在且顺序正确
            is_protected = (protect_start_index != -1 and protect_end_index != -1 and protect_start_index < protect_end_index)
            
            if not is_protected:
                # 降级为完全替换模式
                replace_start_index = rule_section_start_index + 1 
                
                # A. 头部
                new_plugin_content = plugin_lines[:replace_start_index]
                
                # B. 插入 rule.list 转换后的内容
                new_plugin_content.append('\n')
                new_plugin_content.extend(converted_rules)
                new_plugin_content.append('\n')

                # C. 尾部
                new_plugin_content.extend(plugin_lines[rule_section_end_index:])

            else:
                # 正常保护模式：提取内容并重组
                
                # 保护区内容 (包含标记)
                protected_content = plugin_lines[protect_start_index : protect_end_index + 1]

                # --- 4. 构建新的文件内容 ---
                
                # A. 头部 + [Rule] 节：从文件开始到保护区起始标记之前的所有内容 (包含 [Rule])
                new_plugin_content = plugin_lines[:protect_start_index] 
                
                # B. 插入保护区内容
                new_plugin_content.extend(protected_content)
                new_plugin_content.append('\n') # 保护区后加一个空行

                # C. 插入 rule.list 转换后的最新内容
                new_plugin_content.extend(converted_rules)
                new_plugin_content.append('\n') # 新规则后加一个空行

                # D. 尾部 (从 [rule] 节结束后到文件末尾)
                new_plugin_content.extend(plugin_lines[rule_section_end_index:])


            # --- 5. 写回文件 ---
            f.seek(0)
            f.writelines(new_plugin_content)
            f.truncate() 

        print(f"✅ 成功：规则转换完成，IP 规则已添加 no-resolve 参数，并更新了 {plugin_path} 文件。")

    except Exception as e:
        print(f"处理 {plugin_path} 文件时发生错误：{e}")

if __name__ == "__main__":
    sync_rules_to_loon_plugin_protected_dual_tag()