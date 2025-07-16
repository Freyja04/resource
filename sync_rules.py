import os

def sync_mihomo_rules_to_loon_plugin(repo_root_dir="."):
    """
    将 rule.list 的内容（包括规则、注释、空行）同步到 loon/plugin/rule.plugin 文件中
    [rule] 节后面的内容。
    如果 loon/plugin/rule.plugin 文件不存在，则打印错误并退出。
    """
    rule_list_path = os.path.join(repo_root_dir, "rule.list")
    plugin_path = os.path.join(repo_root_dir, "loon", "plugin", "rule.plugin")

    # --- 1. 检查文件是否存在 ---
    if not os.path.exists(rule_list_path):
        print(f"错误：找不到 {rule_list_path} 文件。请确认路径是否正确。")
        return

    if not os.path.exists(plugin_path):
        print(f"错误：{plugin_path} 文件不存在。请先手动创建该文件。")
        return

    # --- 2. 读取 rule.list 的内容 ---
    # 读取所有行，包括注释和空行，保持原样
    with open(rule_list_path, 'r', encoding='utf-8') as f:
        new_rules_content_lines = f.readlines()

    # --- 3. 处理 rule.plugin 文件 ---
    try:
        with open(plugin_path, 'r+', encoding='utf-8') as f:
            plugin_lines = f.readlines()
            
            rule_section_start_index = -1
            rule_section_end_index = -1

            # 找到 [rule] 部分的起始行
            for i, line in enumerate(plugin_lines):
                if line.strip() == "[rule]":
                    rule_section_start_index = i
                    break
            
            if rule_section_start_index == -1:
                print(f"错误：在 {plugin_path} 中未找到 [rule] 部分。无法同步规则。")
                return # 无法找到 [rule] 节，无法进行替换

            # 找到 [rule] 部分的结束行
            # 结束行是下一个以 '[' 开头的节，或者文件末尾
            for i in range(rule_section_start_index + 1, len(plugin_lines)):
                stripped_line = plugin_lines[i].strip()
                if stripped_line.startswith("[") and stripped_line != "[rule]": # 确保不是 [rule] 自身
                    rule_section_end_index = i
                    break
            
            if rule_section_end_index == -1:
                rule_section_end_index = len(plugin_lines) # 如果没有找到下一个节，就到文件末尾

            # 构建新的文件内容
            # 头部内容 (从文件开始到 [rule] 节结束)
            new_plugin_content = plugin_lines[:rule_section_start_index + 1] # 包含 [rule] 这一行

            # 插入来自 rule.list 的新规则内容
            new_plugin_content.extend(new_rules_content_lines)

            # 尾部内容 (从 [rule] 节结束后到文件末尾)
            new_plugin_content.extend(plugin_lines[rule_section_end_index:])

            # 写回修改后的内容
            f.seek(0)
            f.writelines(new_plugin_content)
            f.truncate() # 裁剪文件到当前写入位置，防止旧内容残留

        print(f"成功将 {rule_list_path} 的内容同步到 {plugin_path} 的 [rule] 部分。")

    except Exception as e:
        print(f"处理 {plugin_path} 文件时发生错误：{e}")

if __name__ == "__main__":
    # 假设脚本在仓库的根目录下运行
    sync_mihomo_rules_to_loon_plugin()