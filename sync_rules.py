import os
from typing import Dict, List, Optional, Tuple

# --- 规则解析和转换函数 ---

def is_functional_rule(line: str) -> bool:
    """检查一行是否是功能性规则（非注释、非空行）。"""
    stripped = line.strip()
    return bool(stripped) and not stripped.startswith(('#', ';', '//'))

def parse_rule_key(rule_line: str) -> Optional[str]:
    """
    从规则行中提取唯一的对比键（类型+域名/IP）。
    确保不同类型的规则即使值相同也不会冲突。
    """
    if not is_functional_rule(rule_line):
        return None
        
    parts = [p.strip() for p in rule_line.strip().split(',', 2)]
    if len(parts) < 3:
        return None
    
    rule_type = parts[0].lower()
    rule_value = parts[1].lower()

    # 总是使用类型和值作为键，确保唯一性。
    return f"{rule_type}:{rule_value}"

def convert_rule_line(line: str) -> Tuple[Optional[str], str]:
    """
    将 QX 格式规则转换为小写标准格式。
    返回: (规则键, 转换后的规则行)
    """
    if not is_functional_rule(line):
        return None, line

    parts = [p.strip() for p in line.strip().split(',', 2)]
    if len(parts) < 3:
        return None, line
    
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
    elif rule_type_upper == "IP6-CIDR": # QX 格式转标准格式
        new_rule_type = "IP-CIDR6"    
    elif rule_type_upper in ("IP-CIDR", "GEOIP", "GEOIP-CN", "FINAL"):
        pass 
    else:
        # 无法识别的规则类型，返回 None，表示不转换/忽略
        return None, line

    # 构建转换后的标准规则，类型名称转小写
    new_rule_line = f"{new_rule_type.lower()},{rule_value},{policy}\n"
    key = parse_rule_key(new_rule_line)
    
    return key, new_rule_line


def convert_and_sync_rules_to_loon_plugin_merge(repo_root_dir="."):
    """
    将 rule.list 中的 QX 规则转换为标准格式，并与 loon/plugin/rule.plugin 文件中 
    [rule] 节的现有内容进行智能合并。
    """
    rule_list_path = os.path.join(repo_root_dir, "rule.list")
    plugin_path = os.path.join(repo_root_dir, "loon", "plugin", "rule.plugin")

    # --- 1. 检查文件 ---
    if not os.path.exists(rule_list_path) or not os.path.exists(plugin_path):
        print("错误：源文件或目标文件不存在，请检查路径。")
        return

    # --- 2. 读取 rule.list 并构建新规则字典 (New Rules) ---
    new_rules_map: Dict[str, str] = {}
    
    try:
        with open(rule_list_path, 'r', encoding='utf-8') as f:
            for line in f:
                key, converted_line = convert_rule_line(line)
                if key:
                    new_rules_map[key] = converted_line
        
        if not new_rules_map:
             print("警告：rule.list 中没有找到可识别并转换的规则，跳过同步。")
             return

    except Exception as e:
        print(f"读取或转换 {rule_list_path} 文件时发生错误：{e}")
        return
    
    # --- 3. 处理 rule.plugin 文件并合并规则 ---
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

            # B. 找到 [rule] 部分的结束行
            for i in range(rule_section_start_index + 1, len(plugin_lines)):
                stripped_line = plugin_lines[i].strip()
                if stripped_line.startswith("[") and stripped_line.endswith("]"): 
                    rule_section_end_index = i
                    break
            
            if rule_section_end_index == -1:
                rule_section_end_index = len(plugin_lines) 

            # C. 构建合并后的规则块 (Merged Rule Block)
            merged_rule_block: List[str] = []
            
            # 1. 遍历旧规则块的内容，进行覆盖/保留操作
            for i in range(rule_section_start_index + 1, rule_section_end_index):
                line = plugin_lines[i]
                
                # 转换旧规则行以生成对比键
                key_old, converted_old_line = convert_rule_line(line)
                
                if key_old: # 如果是功能性规则
                    if key_old in new_rules_map:
                        # 冲突：使用新规则覆盖旧规则，并从新规则字典中移除
                        merged_rule_block.append(new_rules_map[key_old])
                        del new_rules_map[key_old]
                    else:
                        # 无冲突：保留旧规则
                        merged_rule_block.append(line)
                else:
                    # 非规则行（注释或空行）：保留在原位
                    merged_rule_block.append(line)

            # 2. 将所有剩余（即完全新增）的规则添加到块的末尾
            if new_rules_map:
                # 仅在有新增内容时添加一个空行
                merged_rule_block.append("\n")
                
                for key in sorted(new_rules_map.keys()):
                    merged_rule_block.append(new_rules_map[key])
                
                merged_rule_block.append("\n") # 新增内容后再添加一个空行

            # D. 重组并写入文件
            new_plugin_content = plugin_lines[:rule_section_start_index + 1] 
            new_plugin_content.extend(merged_rule_block)
            new_plugin_content.extend(plugin_lines[rule_section_end_index:])

            f.seek(0)
            f.writelines(new_plugin_content)
            f.truncate() 

        print(f"✅ 成功将 {rule_list_path} 中的 QX 规则与 {plugin_path} 中的现有规则进行了智能合并。")

    except Exception as e:
        print(f"处理 {plugin_path} 文件时发生错误：{e}")


if __name__ == "__main__":
    convert_and_sync_rules_to_loon_plugin_merge()