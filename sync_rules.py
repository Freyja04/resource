import os

def append_mihomo_rules_to_existing_loon_plugin(repo_root_dir="."):
    """
    将 rule.list 中的 Mihomo 规则内容追加到 **已存在的** loon/rule.plugin 文件中。
    如果 loon/rule.plugin 文件不存在，则不进行任何操作并打印错误。
    规则将被追加到 [rule] 部分的末尾。
    """
    rule_list_path = os.path.join(repo_root_dir, "rule.list")
    plugin_path = os.path.join(repo_root_dir, "loon", "rule.plugin")

    # --- 1. 检查文件是否存在 ---
    if not os.path.exists(rule_list_path):
        print(f"错误：找不到 {rule_list_path} 文件。请确认路径是否正确。")
        return

    if not os.path.exists(plugin_path):
        print(f"错误：{plugin_path} 文件不存在。请先手动创建该文件。")
        return

    # --- 2. 读取 rule.list 的内容 ---
    with open(rule_list_path, 'r', encoding='utf-8') as f:
        mihomo_rules_to_append = [line.strip() for line in f if line.strip()] # 读取内容并去除空白行和首尾空白

    if not mihomo_rules_to_append:
        print(f"警告：{rule_list_path} 文件中没有有效规则，无需追加。")
        return

    # --- 3. 处理 rule.plugin 文件 ---
    try:
        with open(plugin_path, 'r+', encoding='utf-8') as f:
            content_lines = f.readlines()
            
            rule_section_start_index = -1
            # 找到 [rule] 部分的起始行
            for i, line in enumerate(content_lines):
                if line.strip() == "[rule]":
                    rule_section_start_index = i
                    break
            
            if rule_section_start_index == -1:
                print(f"警告：在 {plugin_path} 中未找到 [rule] 部分。规则将追加到文件末尾。")
                # 如果没有 [rule] 部分，将内容和新的 [rule] 标记添加到文件末尾
                content_lines.append("\n[rule]\n")
                append_index = len(content_lines)
            else:
                # 找到 [rule] 部分的结束位置，即下一个空行或下一个 [section] 之前的行
                # 或者文件末尾
                append_index = len(content_lines) # 默认追加到文件末尾
                for i in range(rule_section_start_index + 1, len(content_lines)):
                    stripped_line = content_lines[i].strip()
                    if not stripped_line or stripped_line.startswith("["):
                        append_index = i # 找到下一个空行或新节的起始行
                        break
            
            # 将新规则插入到指定位置
            # 注意：这里我们插入时会带上换行符，因为 readlines() 读取的行通常也包含换行符
            # 确保每条规则后面都有一个换行符
            rules_to_insert = [f"{rule}\n" for rule in mihomo_rules_to_append]
            content_lines[append_index:append_index] = rules_to_insert
            
            # 写回修改后的内容
            f.seek(0)
            f.writelines(content_lines)
            f.truncate() # 裁剪文件到当前写入位置，防止旧内容残留

        print(f"成功将 {rule_list_path} 的规则追加到 {plugin_path}。")

    except Exception as e:
        print(f"处理 {plugin_path} 文件时发生错误：{e}")

if __name__ == "__main__":
    # 假设脚本在仓库的根目录下运行
    append_mihomo_rules_to_existing_loon_plugin()