import os
from typing import Dict, List, Optional, Tuple

# --- 规则解析和转换函数 ---

def is_functional_rule(line: str) -> bool:
    """检查一行是否是功能性规则（非注释、非空行）。"""
    stripped = line.strip()
    return bool(stripped) and not stripped.startswith(('#', ';', '//'))

def parse_rule_key(rule_line: str) -> Optional[str]:
    """从规则行中提取唯一的对比键（域名或IP）。"""
    if not is_functional_rule(rule_line):
        return None
        
    parts = [p.strip() for p in rule_line.strip().split(',', 2)]
    if len(parts) < 3:
        return None
    
    rule_type = parts[0].lower()
    rule_value = parts[1].lower()

    # DOMAIN-KEYWORD 的值可能与 DOMAIN-SUFFIX 或 HOST-SUFFIX 的值冲突，
    # 故需要将类型作为键的一部分，确保唯一性。
    if "keyword" in rule_type:
        return f"{rule_type}:{rule_value}"
    
    # 其他类型的规则，直接使用值作为键。
    return rule_value

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
        
        # 检查是否有新规则被成功转换
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
            old_rules_map: Dict[str, str] = {}
            
            # A. 找到 [rule] 节的起始行
            for i, line in enumerate(plugin_lines):
                if line.strip().lower() == "[rule]":
                    rule_section_start_index = i
                    break
            
            if rule_section_start_index == -1:
                print(f"错误：在 {plugin_path} 中未找到 [rule] 部分。无法同步规则。")
                return 

            # B. 找到 [rule] 部分的结束行，并解析现有规则
            for i in range(rule_section_start_index + 1, len(plugin_lines)):
                current_line = plugin_lines[i]
                stripped_line = current_line.strip()
                
                # 找到下一个节标题
                if stripped_line.startswith("[") and stripped_line.endswith("]"): 
                    rule_section_end_index = i
                    break
                
                # 解析现有规则，构建旧规则字典
                key = parse_rule_key(current_line)
                if key:
                    # 注意：这里存储的是旧文件中的原始行，以便合并时可以保留未修改的旧行
                    old_rules_map[key] = current_line

            if rule_section_end_index == -1:
                rule_section_end_index = len(plugin_lines) # 直到文件末尾


            # C. 构建合并后的规则块 (Merged Rule Block)
            merged_rule_block: List[str] = []
            
            # 1. 遍历旧规则块的内容，进行覆盖/保留操作
            for i in range(rule_section_start_index + 1, rule_section_end_index):
                line = plugin_lines[i]
                key = parse_rule_key(line)
                
                if key: # 如果是功能性规则
                    if key in new_rules_map:
                        # 冲突：使用新规则覆盖旧规则，并从新规则字典中移除，避免重复添加
                        merged_rule_block.append(new_rules_map[key])
                        del new_rules_map[key]
                    else:
                        # 无冲突：保留旧规则
                        merged_rule_block.append(line)
                else:
                    # 非规则行（注释或空行）：保留在原位
                    merged_rule_block.append(line)

            # 2. 将所有剩余（即完全新增）的规则添加到块的末尾
            if new_rules_map:
                # 添加一个空行作为新增规则的分隔
                merged_rule_block.append("\n# === Start of Newly Added Rules ===\n")
                
                # 将剩余的新规则按键排序后添加，以确保输出稳定
                for key in sorted(new_rules_map.keys()):
                    merged_rule_block.append(new_rules_map[key])
                
                merged_rule_block.append("\n# === End of Newly Added Rules ===\n")

            # D. 重组并写入文件
            
            # 头部内容 (从文件开始到 [rule] 节，包含 [rule] 这一行)
            new_plugin_content = plugin_lines[:rule_section_start_index + 1] 

            # 插入合并后的规则块
            new_plugin_content.extend(merged_rule_block)

            # 尾部内容 (从 [rule] 节结束后到文件末尾)
            new_plugin_content.extend(plugin_lines[rule_section_end_index:])

            # 写回文件
            f.seek(0)
            f.writelines(new_plugin_content)
            f.truncate() 

        print(f"✅ 成功将 {rule_list_path} 中的 QX 规则与 {plugin_path} 中的现有规则进行了智能合并。")

    except Exception as e:
        print(f"处理 {plugin_path} 文件时发生错误：{e}")

if __name__ == "__main__":
    convert_and_sync_rules_to_loon_plugin_merge()