import os

def append_mihomo_rules_to_existing_loon_plugin(repo_root_dir="."):
    """
    将 rule.list 中的 Mihomo 规则内容追加到 **已存在的** loon/rule.plugin 文件中。
    如果 loon/rule.plugin 文件不存在，则不进行任何操作并打印错误。

    Args:
        repo_root_dir (str): GitHub 仓库的根目录路径。
                              默认为当前目录。
    """
    rule_list_path = os.path.join(repo_root_dir, "rule.list")
    plugin_path = os.path.join(repo_root_dir, "loon", "rule.plugin")

    # 检查 rule.list 是否存在
    if not os.path.exists(rule_list_path):
        print(f"错误：找不到 {rule_list_path} 文件。请确认路径是否正确。")
        return

    # 检查 loon/rule.plugin 是否存在
    if not os.path.exists(plugin_path):
        print(f"错误：{plugin_path} 文件不存在。请先手动创建该文件。")
        return

    # 读取 rule.list 的内容
    with open(rule_list_path, 'r', encoding='utf-8') as f:
        mihomo_rules_to_append = f.read().strip() # 读取内容并去除首尾空白

    # 如果文件存在，我们需要找到 [rule] 部分，然后在它后面追加
    with open(plugin_path, 'r+', encoding='utf-8') as f:
        lines = f.readlines()
        f.seek(0) # 将文件指针移到开头
        found_rule_section = False
        
        for line in lines:
            f.write(line) # 先写回原有内容
            if line.strip() == "[rule]":
                found_rule_section = True
        
        if not found_rule_section:
            # 如果没找到 [rule] 部分，就追加到文件末尾（如果需要）
            # 根据你的新需求，这里可以不添加 [rule] 头部，或者警告并添加
            # 这里我选择警告并添加，以确保规则总能找到地方追加
            f.write("\n[rule]\n")
            print(f"警告：在 {plugin_path} 中未找到 [rule] 部分，已在文件末尾追加。")
        
        # 追加新的规则
        for line in mihomo_rules_to_append.splitlines():
            if line.strip(): # 避免写入空行
                f.write(f"{line.strip()}\n")
        f.truncate() # 截断文件，以防原文件更长

    print(f"成功将 {rule_list_path} 的规则追加到 {plugin_path}。")

if __name__ == "__main__":
    # 假设脚本在仓库的根目录下运行
    append_mihomo_rules_to_existing_loon_plugin()