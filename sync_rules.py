import os

def sync_mihomo_rules(repo_root_dir="."):
    """
    将 rule.list 中的 Mihomo 规则同步到 resource/loon/rule.plugin。

    Args:
        repo_root_dir (str): GitHub 仓库的根目录路径。
                              默认为当前目录。
    """
    rule_list_path = os.path.join(repo_root_dir, "rule.list")
    plugin_path = os.path.join(repo_root_dir, "resource", "loon", "rule.plugin")

    # 检查 rule.list 是否存在
    if not os.path.exists(rule_list_path):
        print(f"错误：找不到 {rule_list_path} 文件。请确认路径是否正确。")
        return

    # 定义 rule.plugin 的模板头部
    plugin_header = """#!name=WXhttpdns
#!desc=单独放行微信httpdns

[rule]
"""

    # 读取 rule.list 的内容
    with open(rule_list_path, 'r', encoding='utf-8') as f:
        mihomo_rules = f.read().strip() # 读取内容并去除首尾空白

    # 确保 resource/loon 目录存在
    os.makedirs(os.path.dirname(plugin_path), exist_ok=True)

    # 写入或更新 rule.plugin 文件
    with open(plugin_path, 'w', encoding='utf-8') as f:
        f.write(plugin_header)
        # 将 mihomo 规则逐行写入，确保每行末尾没有多余的空格或换行符
        for line in mihomo_rules.splitlines():
            if line.strip(): # 避免写入空行
                f.write(f"{line.strip()}\n")

    print(f"成功将 {rule_list_path} 的规则同步到 {plugin_path}。")

if __name__ == "__main__":
    # 假设脚本在仓库的根目录下运行
    sync_mihomo_rules()