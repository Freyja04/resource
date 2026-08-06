#!/usr/bin/env bash

set -o pipefail

sleep 1

red='\e[91m'
green='\e[92m'
yellow='\e[93m'
magenta='\e[95m'
cyan='\e[96m'
none='\e[0m'

XRAY_INSTALL_SCRIPT="https://github.com/XTLS/Xray-install/raw/main/install-release.sh"
XRAY_RELEASE_API="https://api.github.com/repos/XTLS/Xray-core/releases/latest"
XRAY_CONFIG_FILE="/usr/local/etc/xray/config.json"
HYSTERIA_INSTALL_SCRIPT="https://get.hy2.sh/"
HYSTERIA_RELEASE_API="https://api.github.com/repos/apernet/hysteria/releases/latest"
HYSTERIA_CONFIG_FILE="/etc/hysteria/config.yaml"
DOMAIN_CERT_DIR="/etc/domain/certs"
LAST_CONFIG_BACKUP=""
LAST_HYSTERIA_CONFIG_BACKUP=""

error() {
    echo -e "\n${red}输入错误!${none}\n"
}

warn() {
    echo -e "\n${yellow}$1${none}\n"
}

ok() {
    echo -e "${green}$1${none}"
}

notice() {
    echo -e "${yellow}$1${none}"
}

run_xray_installer() {
    local script

    if ! script=$(curl -fsSL "$XRAY_INSTALL_SCRIPT"); then
        warn "下载 Xray 官方安装脚本失败，已停止当前操作。"
        return 1
    fi

    if ! bash -c "$script" @ "$@"; then
        warn "执行 Xray 官方安装脚本失败，已停止当前操作。"
        return 1
    fi
}

run_hysteria_installer() {
    local script

    if ! script=$(curl -fsSL "$HYSTERIA_INSTALL_SCRIPT"); then
        warn "下载 Hysteria 2 官方安装脚本失败，已停止当前操作。"
        return 1
    fi

    if ! bash -s -- "$@" <<< "$script"; then
        warn "执行 Hysteria 2 官方安装脚本失败，已停止当前操作。"
        return 1
    fi
}

pause() {
    read -rsp "$(echo -e "按 ${green}Enter 回车键${none} 继续....或按 ${red}Ctrl + C${none} 取消.")" -d $'\n'
    echo
}

print_logo() {
    clear
}

get_latest_xray_version() {
    curl -fsSL "$XRAY_RELEASE_API" 2>/dev/null | grep -oP '"tag_name":\s*"\K[^"]+' | head -n 1
}

get_latest_hysteria_version() {
    curl -fsSL "$HYSTERIA_RELEASE_API" 2>/dev/null | grep -oP '"tag_name":\s*"\K[^"]+' | head -n 1
}

get_installed_xray_version() {
    if ! command -v xray >/dev/null 2>&1; then
        return 0
    fi

    xray version 2>/dev/null | awk 'NR==1 {print $2}'
}

normalize_xray_version() {
    local version="$1"

    if [[ -z "$version" ]]; then
        return
    fi

    if [[ "$version" == v* ]]; then
        echo "$version"
    else
        echo "v$version"
    fi
}

get_installed_hysteria_version() {
    local output
    local version

    if ! command -v hysteria >/dev/null 2>&1; then
        return 0
    fi

    output=$(hysteria version 2>/dev/null || hysteria --version 2>/dev/null || hysteria -v 2>/dev/null) || return 0
    version=$(printf '%s\n' "$output" | grep -oE 'v?[0-9]+(\.[0-9]+){1,3}([+.-][0-9A-Za-z.-]+)?' | head -n 1)

    if [[ -n "$version" ]]; then
        echo "$version"
    else
        printf '%s\n' "$output" | head -n 1
    fi
}

normalize_hysteria_version() {
    local version="$1"

    [[ -z "$version" ]] && return
    version="${version#app/}"

    if [[ "$version" == v* ]]; then
        echo "$version"
    else
        echo "v$version"
    fi
}

is_hysteria_running() {
    if ! command -v hysteria >/dev/null 2>&1; then
        return 1
    fi

    if command -v systemctl >/dev/null 2>&1; then
        systemctl is-active --quiet hysteria-server
    else
        service hysteria-server status >/dev/null 2>&1
    fi
}

is_bbr_enabled() {
    local congestion_control
    local default_qdisc

    congestion_control=$(sysctl -n net.ipv4.tcp_congestion_control 2>/dev/null)
    default_qdisc=$(sysctl -n net.core.default_qdisc 2>/dev/null)

    [[ "$congestion_control" == "bbr" && "$default_qdisc" == "fq" ]]
}

refresh_status() {
    latest_xray_version=$(get_latest_xray_version)
    installed_xray_version=$(get_installed_xray_version)
    installed_xray_version=$(normalize_xray_version "$installed_xray_version")
    installed_hysteria_version=$(get_installed_hysteria_version)
    latest_hysteria_version=$(get_latest_hysteria_version)
    latest_hysteria_version=$(normalize_hysteria_version "$latest_hysteria_version")

    if [[ -z "$installed_xray_version" ]]; then
        xray_running_status="$(notice "未安装")"
    elif is_xray_running; then
        xray_running_status="$(ok "正常运行")"
    else
        xray_running_status="$(notice "未运行")"
    fi

    if ! command -v hysteria >/dev/null 2>&1; then
        installed_hysteria_version="未安装"
        hysteria_status="$(notice "未安装")"
    else
        [[ -z "$installed_hysteria_version" ]] && installed_hysteria_version="未知"
    fi

    if command -v hysteria >/dev/null 2>&1 && is_hysteria_running; then
        hysteria_status="$(ok "正常运行")"
    elif command -v hysteria >/dev/null 2>&1; then
        hysteria_status="$(notice "未运行")"
    fi

    if is_bbr_enabled; then
        bbr_status="$(ok "已安装")"
    else
        bbr_status="$(notice "未安装")"
    fi
}

print_status() {
    echo "---------------- 当前状态 ----------------"
    echo -e "Xray 已安装版本: ${cyan}${installed_xray_version:-未安装}${none}"
    echo -e "Xray 最新稳定版: ${cyan}${latest_xray_version:-未知}${none}"
    echo -e "Xray 运行状态: ${xray_running_status}"
    echo -e "Hysteria 2 已安装版本: ${cyan}${installed_hysteria_version}${none}"
    echo -e "Hysteria 2 最新稳定版: ${cyan}${latest_hysteria_version:-未知}${none}"
    echo -e "Hysteria 2 运行状态: ${hysteria_status}"
    echo -e "BBR 状态: ${bbr_status}"
    echo "------------------------------------------"
    echo
}

install_xray_latest() {
    echo
    echo -e "${yellow}安装 Xray 最新稳定版${none}"
    echo "----------------------------------------------------------------"
    run_xray_installer install
}

install_xray_version() {
    local version

    read -rp "$(echo -e "请输入 Xray 版本号，例如 ${cyan}v26.3.27${none}: ")" version
    if [[ -z "$version" ]]; then
        error
        return 1
    fi

    echo
    echo -e "${yellow}安装 Xray ${version}${none}"
    echo "----------------------------------------------------------------"
    run_xray_installer install --version "$version"
}

install_xray_menu() {
    local choice

    echo
    echo "请选择安装方式:"
    echo -e "  1. 安装最新稳定版 ${green}(默认)${none}"
    echo "  2. 手动指定版本"
    read -rp "请输入选项 [1-2]: " choice

    case "$choice" in
    2)
        install_xray_version || return 1
        ;;
    1 | "")
        install_xray_latest || return 1
        ;;
    *)
        install_xray_latest || return 1
        ;;
    esac

    echo
    echo -e "${yellow}更新 Xray geodata${none}"
    echo "----------------------------------------------------------------"
    run_xray_installer install-geodata || return 1
}

update_and_restart_xray() {
    echo
    echo -e "${yellow}更新 Xray 到官方最新稳定版${none}"
    echo "----------------------------------------------------------------"
    install_xray_latest || return 1

    echo
    echo -e "${yellow}更新 Xray geodata${none}"
    echo "----------------------------------------------------------------"
    run_xray_installer install-geodata || return 1

    echo
    echo -e "${yellow}重启 Xray${none}"
    echo "----------------------------------------------------------------"
    if ! restart_xray; then
        warn "Xray 重启失败，已停止当前操作。"
        return 1
    fi

    if ! is_xray_running; then
        warn "Xray 重启后未正常运行，已停止当前操作。"
        return 1
    fi

    ok "Xray 已更新并正常运行。"
}

update_xray_geodata() {
    echo
    echo -e "${yellow}更新 Xray geodata${none}"
    echo "----------------------------------------------------------------"
    run_xray_installer install-geodata || return 1
    ok "Xray geodata 更新完成。"
}

uninstall_xray() {
    echo
    echo -e "${yellow}卸载 Xray${none}"
    echo "----------------------------------------------------------------"
    if ! command -v xray >/dev/null 2>&1; then
        warn "未检测到 xray，跳过卸载。"
        return 0
    fi

    run_xray_installer remove || return 1
    ok "Xray 已卸载。"
}

manage_xray_menu() {
    local choice

    while :; do
        echo
        echo "请选择 xray 管理功能:"
        echo "  1. 安装 xray"
        echo "  2. 更新 xray（更新完成后自动重启）"
        echo "  3. 更新 geodata"
        echo "  4. 卸载 xray"
        echo "  5. 返回上级菜单"
        read -rp "请输入选项 [1-5]: " choice

        case "$choice" in
        1)
            install_xray_menu
            ;;
        2)
            update_and_restart_xray
            ;;
        3)
            update_xray_geodata
            ;;
        4)
            uninstall_xray
            ;;
        5)
            return
            ;;
        *)
            error
            ;;
        esac

        echo
        pause
    done
}

is_hysteria_installed() {
    command -v hysteria >/dev/null 2>&1
}

install_hysteria2() {
    echo
    echo -e "${yellow}安装 Hysteria 2 最新版本${none}"
    echo "----------------------------------------------------------------"
    run_hysteria_installer || return 1

    if command -v systemctl >/dev/null 2>&1; then
        if ! systemctl enable hysteria-server >/dev/null 2>&1; then
            warn "设置 Hysteria 2 开机启动失败，已停止当前操作。"
            return 1
        fi
    fi

    echo
    notice "Hysteria 2 安装完成，配置文件位于 ${HYSTERIA_CONFIG_FILE}"
    notice "请使用主菜单『生成 hysteria 2 节点』写入配置后再启动服务。"
}

update_and_restart_hysteria2() {
    echo
    echo -e "${yellow}更新 Hysteria 2 到最新版本${none}"
    echo "----------------------------------------------------------------"
    if ! is_hysteria_installed; then
        warn "未安装 Hysteria 2，请先选择安装。"
        return 1
    fi

    run_hysteria_installer || return 1

    echo
    echo -e "${yellow}重启 Hysteria 服务${none}"
    echo "----------------------------------------------------------------"
    if ! restart_hysteria2; then
        warn "Hysteria 2 重启失败，已停止当前操作。"
        return 1
    fi

    if ! is_hysteria_running; then
        warn "Hysteria 2 重启后未正常运行，已停止当前操作。"
        return 1
    fi

    ok "Hysteria 2 已更新并正常运行。"
}

restore_last_hysteria_config_backup() {
    if [[ -z "$LAST_HYSTERIA_CONFIG_BACKUP" || ! -f "$LAST_HYSTERIA_CONFIG_BACKUP" ]]; then
        warn "没有可恢复的 Hysteria 2 旧配置。"
        return 1
    fi

    if ! sudo cp "$LAST_HYSTERIA_CONFIG_BACKUP" "$HYSTERIA_CONFIG_FILE"; then
        warn "恢复 Hysteria 2 旧配置失败。"
        return 1
    fi

    warn "已恢复上一次备份配置: $LAST_HYSTERIA_CONFIG_BACKUP"

    if ! restart_hysteria2; then
        warn "旧配置已恢复，但 Hysteria 2 重启失败。"
        return 1
    fi

    sleep 1
    if ! is_hysteria_running; then
        warn "旧配置已恢复，但 Hysteria 2 仍未正常运行。"
        return 1
    fi

    ok "Hysteria 2 已使用旧配置重新启动。"
}

uninstall_hysteria2() {
    local remove_config

    echo
    echo -e "${yellow}卸载 Hysteria 2${none}"
    echo "----------------------------------------------------------------"
    if ! is_hysteria_installed; then
        warn "未检测到 hysteria，跳过二进制卸载。"
    else
        run_hysteria_installer --remove || return 1
    fi

    read -rp "$(echo -e "是否同时删除配置目录 ${cyan}/etc/hysteria${none} 和 hysteria 用户? [y/N]: ")" remove_config
    if [[ "$remove_config" == "y" || "$remove_config" == "Y" ]]; then
        if ! sudo rm -rf /etc/hysteria; then
            warn "删除 /etc/hysteria 失败，已停止当前操作。"
            return 1
        fi
        if id hysteria >/dev/null 2>&1; then
            if ! sudo userdel -r hysteria; then
                warn "删除 hysteria 用户失败，已停止当前操作。"
                return 1
            fi
        fi
        ok "已删除 /etc/hysteria 配置目录和 hysteria 用户。"
    else
        notice "已保留 /etc/hysteria 配置目录。"
    fi
}

manage_hysteria2_menu() {
    local choice

    while :; do
        echo
        echo "请选择 hysteria 2 管理功能:"
        echo "  1. 安装 hysteria 2"
        echo "  2. 更新 hysteria 2（更新完成后自动重启）"
        echo "  3. 卸载 hysteria 2"
        echo "  4. 返回上级菜单"
        read -rp "请输入选项 [1-4]: " choice

        case "$choice" in
        1)
            install_hysteria2
            ;;
        2)
            update_and_restart_hysteria2
            ;;
        3)
            uninstall_hysteria2
            ;;
        4)
            return
            ;;
        *)
            error
            ;;
        esac

        echo
        pause
    done
}

restart_hysteria2() {
    if command -v systemctl >/dev/null 2>&1; then
        systemctl restart hysteria-server
    else
        service hysteria-server restart
    fi
}

write_hysteria2_config() {
    local port="$1"
    local cert_file="$2"
    local key_file="$3"
    local password="$4"
    local enable_obfs="$5"
    local obfs_password="$6"
    local enable_masq="$7"
    local masq_url="$8"

    if [[ -f "$HYSTERIA_CONFIG_FILE" ]]; then
        LAST_HYSTERIA_CONFIG_BACKUP="${HYSTERIA_CONFIG_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        if ! sudo cp "$HYSTERIA_CONFIG_FILE" "$LAST_HYSTERIA_CONFIG_BACKUP"; then
            warn "备份 Hysteria 2 配置失败，已停止当前操作。"
            return 1
        fi
    else
        LAST_HYSTERIA_CONFIG_BACKUP=""
    fi

    if ! sudo mkdir -p "$(dirname "$HYSTERIA_CONFIG_FILE")"; then
        warn "创建 Hysteria 2 配置目录失败，已停止当前操作。"
        return 1
    fi

    if ! {
        printf '%s\n' "listen: :${port}"
        printf '%s\n' "tls:"
        printf '%s\n' "  cert: ${cert_file}"
        printf '%s\n' "  key: ${key_file}"
        printf '%s\n' "auth:"
        printf '%s\n' "  type: password"
        printf '%s\n' "  password: ${password}"
        if [[ "$enable_obfs" == "y" || "$enable_obfs" == "Y" ]]; then
            printf '%s\n' "obfs:"
            printf '%s\n' "  type: salamander"
            printf '%s\n' "  salamander:"
            printf '%s\n' "    password: ${obfs_password}"
        fi
        printf '%s\n' "quic:"
        printf '%s\n' "  initStreamReceiveWindow: 8388608"
        printf '%s\n' "  maxStreamReceiveWindow: 8388608"
        printf '%s\n' "  initConnReceiveWindow: 20971520"
        printf '%s\n' "  maxConnReceiveWindow: 20971520"
        printf '%s\n' "  maxIdleTimeout: 30s"
        printf '%s\n' "  disablePathMTUDiscovery: false"
        if [[ "$enable_masq" == "y" || "$enable_masq" == "Y" ]]; then
            printf '%s\n' "masquerade:"
            printf '%s\n' "  type: proxy"
            printf '%s\n' "  proxy:"
            printf '%s\n' "    url: ${masq_url}"
            printf '%s\n' "    rewriteHost: true"
        fi
    } | sudo tee "$HYSTERIA_CONFIG_FILE" >/dev/null; then
        warn "写入 Hysteria 2 配置失败，已停止当前操作。"
        return 1
    fi
}

generate_hysteria2_node() {
    local server
    local server_for_url
    local port
    local domain
    local cert_file
    local key_file
    local password
    local custom_password
    local enable_obfs
    local obfs_password
    local obfs_custom
    local enable_masq
    local masq_url
    local node_name
    local uri_query
    local hy2_url

    if ! is_hysteria_installed; then
        warn "未找到 hysteria 命令，请先进入『管理 hysteria 2』安装。"
        return 1
    fi

    echo
    echo -e "${yellow}生成 hysteria 2 节点${none}"
    echo "----------------------------------------------------------------"

    server=$(read_required "请输入客户端连接的节点地址（域名或 IP）: ")
    port=$(read_port "请输入监听端口 [默认 443]: " "443")
    domain=$(read_required "请输入域名（作为 SNI，需与证书中的域名一致）: ")

    if [[ "$domain" == *:* || "$domain" == */* ]]; then
        warn "域名不能包含端口或路径。"
        return 1
    fi

    echo -e "${yellow}提示: Hysteria 服务以 hysteria 用户运行，证书和私钥文件需要允许该用户读取。${none}"
    cert_file=$(read_existing_file "请输入 TLS 证书 fullchain 文件路径: ")
    key_file=$(read_existing_file "请输入 TLS 私钥文件路径: ")

    if command -v openssl >/dev/null 2>&1; then
        password=$(openssl rand -base64 16 | tr -d '\n')
    else
        password=$(dd if=/dev/urandom bs=18 count=1 status=none | base64 | tr -d '\n')
    fi
    if [[ -z "$password" ]]; then
        warn "生成 Hysteria 2 认证密码失败，已停止当前操作。"
        return 1
    fi

    read -rp "$(echo -e "已生成认证密码: ${cyan}${password}${none}，直接回车使用，或输入自定义密码: ")" custom_password
    if [[ -n "$custom_password" ]]; then
        password="$custom_password"
    fi

    read -rp "$(echo -e "是否启用 ${magenta}Salamander${none} 混淆? [y/N]: ")" enable_obfs
    if [[ "$enable_obfs" == "y" || "$enable_obfs" == "Y" ]]; then
        if command -v openssl >/dev/null 2>&1; then
            obfs_password=$(openssl rand -base64 12 | tr -d '\n')
        else
            obfs_password=$(dd if=/dev/urandom bs=12 count=1 status=none | base64 | tr -d '\n')
        fi
        if [[ -z "$obfs_password" ]]; then
            warn "生成 Salamander 混淆密码失败，已停止当前操作。"
            return 1
        fi
        read -rp "$(echo -e "已生成混淆密码: ${cyan}${obfs_password}${none}，直接回车使用，或输入自定义密码: ")" obfs_custom
        if [[ -n "$obfs_custom" ]]; then
            obfs_password="$obfs_custom"
        fi
    fi

    read -rp "是否启用 masquerade 伪装（反代到指定网站，让端口看起来像普通网站）? [y/N]: " enable_masq
    if [[ "$enable_masq" == "y" || "$enable_masq" == "Y" ]]; then
        masq_url=$(read_required "请输入伪装目标 URL，例如 https://www.bing.com: ")
    fi

    if ! write_hysteria2_config "$port" "$cert_file" "$key_file" "$password" "$enable_obfs" "$obfs_password" "$enable_masq" "$masq_url"; then
        if [[ -n "$LAST_HYSTERIA_CONFIG_BACKUP" ]]; then
            restore_last_hysteria_config_backup
        fi
        return 1
    fi

    echo
    echo -e "${yellow}重启 Hysteria 服务${none}"
    echo "----------------------------------------------------------------"
    if ! restart_hysteria2; then
        warn "Hysteria 服务重启失败，正在恢复旧配置。"
        restore_last_hysteria_config_backup
        return 1
    fi

    sleep 1
    if ! is_hysteria_running; then
        warn "Hysteria 服务未正常运行，正在恢复旧配置。"
        restore_last_hysteria_config_backup
        return 1
    fi
    ok "Hysteria 2 已正常运行。"

    server_for_url=$(format_server_for_url "$server")
    uri_query="insecure=0&sni=${domain}"
    if [[ "$enable_obfs" == "y" || "$enable_obfs" == "Y" ]]; then
        uri_query+="&obfs=salamander&obfs-password=$(url_encode "$obfs_password")"
    fi
    node_name="HYSTERIA2"
    hy2_url="hysteria2://$(url_encode "$password")@${server_for_url}:${port}?${uri_query}#${node_name}"

    echo
    echo "---------- Hysteria 2 节点信息 ----------"
    echo -e "${green}${hy2_url}${none}"
    echo "------------------------------------------"
}

validate_port() {
    local port="$1"

    [[ "$port" =~ ^[0-9]+$ ]] && ((port >= 1 && port <= 65535))
}

read_required() {
    local prompt="$1"
    local value

    while :; do
        read -rp "$prompt" value
        if [[ -n "$value" ]]; then
            echo "$value"
            return
        fi
        error >&2
    done
}

read_port() {
    local prompt="$1"
    local default_port="$2"
    local port

    while :; do
        read -rp "$prompt" port
        [[ -z "$port" ]] && port="$default_port"

        if validate_port "$port"; then
            echo "$port"
            return
        fi

        error >&2
    done
}

generate_short_id() {
    if command -v openssl >/dev/null 2>&1; then
        openssl rand -hex 8
    else
        hexdump -n 8 -e '8/1 "%02x"' /dev/urandom
    fi
}

url_encode() {
    local string="$1"
    local length=${#string}
    local i
    local char

    for ((i = 0; i < length; i++)); do
        char="${string:i:1}"
        case "$char" in
        [a-zA-Z0-9.~_-])
            printf '%s' "$char"
            ;;
        *)
            printf '%%%02X' "'$char"
            ;;
        esac
    done
}

format_server_for_url() {
    local server="$1"

    if [[ "$server" == *:* && "$server" != \[*\] ]]; then
        echo "[$server]"
    else
        echo "$server"
    fi
}

read_existing_file() {
    local prompt="$1"
    local value

    while :; do
        read -rp "$prompt" value
        if [[ -f "$value" ]]; then
            echo "$value"
            return
        fi

        warn "文件不存在: $value" >&2
    done
}

restart_xray() {
    if command -v systemctl >/dev/null 2>&1; then
        systemctl restart xray
    else
        service xray restart
    fi
}

is_xray_running() {
    if command -v systemctl >/dev/null 2>&1; then
        systemctl is-active --quiet xray
    else
        service xray status >/dev/null 2>&1
    fi
}

test_xray_config() {
    if ! command -v xray >/dev/null 2>&1; then
        warn "未找到 xray 命令，请先安装 xray。"
        return 1
    fi

    xray run -test -config "$XRAY_CONFIG_FILE" >/tmp/xray_config_test.log 2>&1
}

restore_last_config_backup() {
    if [[ -z "$LAST_CONFIG_BACKUP" || ! -f "$LAST_CONFIG_BACKUP" ]]; then
        warn "没有可恢复的 Xray 旧配置。"
        return 1
    fi

    if ! cp "$LAST_CONFIG_BACKUP" "$XRAY_CONFIG_FILE"; then
        warn "恢复 Xray 旧配置失败。"
        return 1
    fi

    warn "已恢复上一次备份配置: $LAST_CONFIG_BACKUP"

    if ! restart_xray; then
        warn "旧配置已恢复，但 Xray 重启失败。"
        return 1
    fi

    sleep 1
    if ! is_xray_running; then
        warn "旧配置已恢复，但 Xray 仍未正常运行。"
        return 1
    fi

    ok "Xray 已使用旧配置重新启动。"
}

restart_and_check_xray() {
    echo
    echo -e "${yellow}测试 Xray 配置${none}"
    echo "----------------------------------------------------------------"
    if ! test_xray_config; then
        warn "Xray 配置测试失败，错误信息如下:"
        cat /tmp/xray_config_test.log
        restore_last_config_backup
        return 1
    fi

    echo
    echo -e "${yellow}重启 Xray${none}"
    echo "----------------------------------------------------------------"
    if ! restart_xray; then
        warn "Xray 重启失败，正在恢复旧配置。"
        restore_last_config_backup
        return 1
    fi

    sleep 1
    if ! is_xray_running; then
        warn "Xray 未正常运行，正在恢复旧配置。"
        restore_last_config_backup
        return 1
    fi

    ok "Xray 已正常运行。"
}

write_vless_reality_config() {
    local port="$1"
    local uuid="$2"
    local private_key="$3"
    local short_id="$4"
    local sni="$5"
    local target_port="$6"

    if ! command -v python3 >/dev/null 2>&1; then
        warn "未找到 python3，正在安装 python3。"
        if ! sudo apt update; then
            warn "更新软件包索引失败，已停止当前操作。"
            return 1
        fi
        if ! sudo apt install -y python3; then
            warn "安装 python3 失败，已停止当前操作。"
            return 1
        fi
    fi

    if [[ -f "$XRAY_CONFIG_FILE" ]]; then
        LAST_CONFIG_BACKUP="${XRAY_CONFIG_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        if ! cp "$XRAY_CONFIG_FILE" "$LAST_CONFIG_BACKUP"; then
            warn "备份 Xray 配置失败，已停止当前操作。"
            return 1
        fi
    else
        LAST_CONFIG_BACKUP=""
    fi

    if ! mkdir -p "$(dirname "$XRAY_CONFIG_FILE")"; then
        warn "创建 Xray 配置目录失败，已停止当前操作。"
        return 1
    fi

    XRAY_CONFIG_FILE="$XRAY_CONFIG_FILE" \
    XRAY_PORT="$port" \
    XRAY_UUID="$uuid" \
    XRAY_PRIVATE_KEY="$private_key" \
    XRAY_SHORT_ID="$short_id" \
    XRAY_SNI="$sni" \
    XRAY_TARGET_PORT="$target_port" \
    python3 <<'PY'
import json
import os
from pathlib import Path

config_file = Path(os.environ["XRAY_CONFIG_FILE"])
node_tag = "vless-reality-vision"

default_config = {
    "log": {
        "access": "/var/log/xray/access.log",
        "error": "/var/log/xray/error.log",
        "loglevel": "warning",
    },
    "inbounds": [],
    "outbounds": [
        {"tag": "direct", "protocol": "freedom"},
        {"tag": "block", "protocol": "blackhole"},
    ],
    "routing": {
        "domainStrategy": "IPIfNonMatch",
        "rules": [
            {
                "type": "field",
                "ip": ["geoip:private"],
                "outboundTag": "block",
            }
        ],
    },
}

if config_file.exists() and config_file.stat().st_size > 0:
    with config_file.open("r", encoding="utf-8") as f:
        config = json.load(f)
else:
    config = default_config

if not isinstance(config, dict):
    config = default_config

config.setdefault("log", default_config["log"])
config.setdefault("inbounds", [])
config.setdefault("outbounds", default_config["outbounds"])
config.setdefault("routing", default_config["routing"])

inbound = {
    "tag": node_tag,
    "listen": "0.0.0.0",
    "port": int(os.environ["XRAY_PORT"]),
    "protocol": "vless",
    "settings": {
        "clients": [
            {
                "id": os.environ["XRAY_UUID"],
                "flow": "xtls-rprx-vision",
            }
        ],
        "decryption": "none",
    },
    "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
            "show": False,
            "dest": f'{os.environ["XRAY_SNI"]}:{os.environ["XRAY_TARGET_PORT"]}',
            "xver": 0,
            "serverNames": [os.environ["XRAY_SNI"]],
            "privateKey": os.environ["XRAY_PRIVATE_KEY"],
            "shortIds": [os.environ["XRAY_SHORT_ID"]],
        },
    },
    "sniffing": {
        "enabled": True,
        "destOverride": ["http", "tls"],
    },
}

inbounds = config.get("inbounds")
if not isinstance(inbounds, list):
    inbounds = []

replaced = False
for index, item in enumerate(inbounds):
    if isinstance(item, dict) and item.get("tag") == node_tag:
        inbounds[index] = inbound
        replaced = True
        break

if not replaced:
    inbounds.append(inbound)

config["inbounds"] = inbounds

with config_file.open("w", encoding="utf-8") as f:
    json.dump(config, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
}

write_vless_ws_tls_config() {
    local listen_port="$1"
    local uuid="$2"
    local ws_path="$3"
    local cert_file="$4"
    local key_file="$5"

    if ! command -v python3 >/dev/null 2>&1; then
        warn "未找到 python3，正在安装 python3。"
        if ! sudo apt update; then
            warn "更新软件包索引失败，已停止当前操作。"
            return 1
        fi
        if ! sudo apt install -y python3; then
            warn "安装 python3 失败，已停止当前操作。"
            return 1
        fi
    fi

    if [[ -f "$XRAY_CONFIG_FILE" ]]; then
        LAST_CONFIG_BACKUP="${XRAY_CONFIG_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        if ! cp "$XRAY_CONFIG_FILE" "$LAST_CONFIG_BACKUP"; then
            warn "备份 Xray 配置失败，已停止当前操作。"
            return 1
        fi
    else
        LAST_CONFIG_BACKUP=""
    fi

    if ! mkdir -p "$(dirname "$XRAY_CONFIG_FILE")"; then
        warn "创建 Xray 配置目录失败，已停止当前操作。"
        return 1
    fi

    XRAY_CONFIG_FILE="$XRAY_CONFIG_FILE" \
    XRAY_LISTEN_PORT="$listen_port" \
    XRAY_UUID="$uuid" \
    XRAY_WS_PATH="$ws_path" \
    XRAY_CERT_FILE="$cert_file" \
    XRAY_KEY_FILE="$key_file" \
    python3 <<'PY'
import json
import os
from pathlib import Path

config_file = Path(os.environ["XRAY_CONFIG_FILE"])
node_tag = "vless-ws-tls"

default_config = {
    "log": {
        "access": "/var/log/xray/access.log",
        "error": "/var/log/xray/error.log",
        "loglevel": "warning",
    },
    "inbounds": [],
    "outbounds": [
        {"tag": "direct", "protocol": "freedom"},
        {"tag": "block", "protocol": "blackhole"},
    ],
    "routing": {
        "domainStrategy": "IPIfNonMatch",
        "rules": [
            {
                "type": "field",
                "ip": ["geoip:private"],
                "outboundTag": "block",
            }
        ],
    },
}

if config_file.exists() and config_file.stat().st_size > 0:
    with config_file.open("r", encoding="utf-8") as f:
        config = json.load(f)
else:
    config = default_config

if not isinstance(config, dict):
    config = default_config

config.setdefault("log", default_config["log"])
config.setdefault("inbounds", [])
config.setdefault("outbounds", default_config["outbounds"])
config.setdefault("routing", default_config["routing"])

inbound = {
    "tag": node_tag,
    "listen": "0.0.0.0",
    "port": int(os.environ["XRAY_LISTEN_PORT"]),
    "protocol": "vless",
    "settings": {
        "clients": [
            {
                "id": os.environ["XRAY_UUID"],
            }
        ],
        "decryption": "none",
    },
    "streamSettings": {
        "network": "ws",
        "security": "tls",
        "tlsSettings": {
            "certificates": [
                {
                    "certificateFile": os.environ["XRAY_CERT_FILE"],
                    "keyFile": os.environ["XRAY_KEY_FILE"],
                }
            ],
        },
        "wsSettings": {
            "path": os.environ["XRAY_WS_PATH"],
        },
    },
    "sniffing": {
        "enabled": True,
        "destOverride": ["http", "tls"],
    },
}

inbounds = config.get("inbounds")
if not isinstance(inbounds, list):
    inbounds = []

replaced = False
for index, item in enumerate(inbounds):
    if isinstance(item, dict) and item.get("tag") == node_tag:
        inbounds[index] = inbound
        replaced = True
        break

if not replaced:
    inbounds.append(inbound)

config["inbounds"] = inbounds

with config_file.open("w", encoding="utf-8") as f:
    json.dump(config, f, ensure_ascii=False, indent=2)
    f.write("\n")
PY
}

generate_vless_reality_vision() {
    local server
    local server_for_url
    local port
    local sni
    local target_port
    local uuid
    local keys
    local private_key
    local public_key
    local short_id
    local node_name
    local vless_url

    if ! command -v xray >/dev/null 2>&1; then
        warn "未找到 xray 命令，请先选择 1 安装 xray。"
        return 1
    fi

    echo
    echo -e "${yellow}生成 vless+xtls-rprx-vision+reality 节点${none}"
    echo "----------------------------------------------------------------"

    server=$(read_required "请输入 server 节点地址（域名或 IP）: ")
    port=$(read_port "请输入监听端口 [默认 443]: " "443")
    sni=$(read_required "请输入 SNI 域名: ")
    target_port=$(read_port "请输入 REALITY 目标端口 [默认 443]: " "443")

    if [[ "$sni" == *:* || "$sni" == */* ]]; then
        warn "SNI 必须是域名，不能包含端口或路径。"
        return 1
    fi

    uuid=$(xray uuid)
    keys=$(xray x25519)
    private_key=$(echo "$keys" | awk -F': ' '/PrivateKey|Private key/ {print $2; exit}')
    public_key=$(echo "$keys" | awk -F': ' '/PublicKey|Public key|Password/ {print $2; exit}')
    short_id=$(generate_short_id)
    node_name="VLESS_REALITY"
    server_for_url=$(format_server_for_url "$server")

    if [[ -z "$uuid" || -z "$private_key" || -z "$public_key" || -z "$short_id" ]]; then
        warn "参数生成失败，请确认 xray 命令可正常执行。"
        return 1
    fi

    if ! write_vless_reality_config "$port" "$uuid" "$private_key" "$short_id" "$sni" "$target_port"; then
        warn "写入 Xray 配置失败。请确认现有配置文件是标准 JSON 格式。"
        restore_last_config_backup
        return 1
    fi

    if ! restart_and_check_xray; then
        return 1
    fi

    vless_url="vless://${uuid}@${server_for_url}:${port}?encryption=none&flow=xtls-rprx-vision&fp=chrome&pbk=${public_key}&security=reality&sid=${short_id}&sni=${sni}&spx=%2F&type=tcp#${node_name}"

    echo
    echo "---------- VLESS Reality 节点信息 ----------"
    echo -e "${green}${vless_url}${none}"
    echo "--------------------------------------------"
}

generate_vless_ws_tls() {
    local server
    local server_for_url
    local client_port
    local listen_port
    local host
    local uuid
    local ws_path
    local encoded_ws_path
    local cert_file
    local key_file
    local node_name
    local vless_url

    if ! command -v xray >/dev/null 2>&1; then
        warn "未找到 xray 命令，请先选择 1 安装 xray。"
        return 1
    fi

    echo
    echo -e "${yellow}生成 vless+ws+tls 优选节点${none}"
    echo "----------------------------------------------------------------"

    host=$(read_required "请输入域名（同时作为 server / Host / SNI）: ")
    client_port=$(read_port "请输入客户端连接端口 [默认 443]: " "443")
    listen_port=$(read_port "请输入 Xray 监听端口 [默认 8443]: " "8443")
    echo -e "${yellow}提示: Xray 服务通常以 nobody 用户运行，证书和私钥文件需要允许 Xray 读取。${none}"
    cert_file=$(read_existing_file "请输入 TLS 证书文件路径 fullchain: ")
    key_file=$(read_existing_file "请输入 TLS 私钥文件路径 private key: ")

    if [[ "$host" == *:* || "$host" == */* ]]; then
        warn "Host/SNI 必须是域名，不能包含端口或路径。"
        return 1
    fi

    uuid=$(xray uuid)
    ws_path="/ws"
    encoded_ws_path=$(url_encode "$ws_path")
    node_name="VLESS_WS_TLS"
    server="$host"
    server_for_url=$(format_server_for_url "$server")

    if [[ -z "$uuid" || -z "$ws_path" ]]; then
        warn "参数生成失败，请确认 xray 命令可正常执行。"
        return 1
    fi

    if ! write_vless_ws_tls_config "$listen_port" "$uuid" "$ws_path" "$cert_file" "$key_file"; then
        warn "写入 Xray 配置失败。请确认现有配置文件是标准 JSON 格式。"
        restore_last_config_backup
        return 1
    fi

    if ! restart_and_check_xray; then
        return 1
    fi

    vless_url="vless://${uuid}@${server_for_url}:${client_port}?encryption=none&security=tls&sni=${host}&fp=chrome&type=ws&host=${host}&path=${encoded_ws_path}#${node_name}"

    echo
    echo "---------- VLESS WS TLS 节点信息 ----------"
    echo -e "${green}${vless_url}${none}"
    echo "-------------------------------------------"
}

enable_bbr() {
    echo
    echo -e "${yellow}开启 BBR${none}"
    echo "----------------------------------------------------------------"

    if ! sudo touch /etc/sysctl.d/99-bbr.conf; then
        warn "创建 BBR 配置文件失败，已停止当前操作。"
        return 1
    fi
    if ! sudo sed -i '/^net\.core\.default_qdisc/d' /etc/sysctl.d/99-bbr.conf; then
        warn "修改 BBR 队列配置失败，已停止当前操作。"
        return 1
    fi
    if ! sudo sed -i '/^net\.ipv4\.tcp_congestion_control/d' /etc/sysctl.d/99-bbr.conf; then
        warn "修改 BBR 拥塞控制配置失败，已停止当前操作。"
        return 1
    fi
    if ! echo 'net.core.default_qdisc=fq' | sudo tee -a /etc/sysctl.d/99-bbr.conf >/dev/null; then
        warn "写入 BBR 队列配置失败，已停止当前操作。"
        return 1
    fi
    if ! echo 'net.ipv4.tcp_congestion_control=bbr' | sudo tee -a /etc/sysctl.d/99-bbr.conf >/dev/null; then
        warn "写入 BBR 拥塞控制配置失败，已停止当前操作。"
        return 1
    fi
    if ! echo 'tcp_bbr' | sudo tee /etc/modules-load.d/bbr.conf >/dev/null; then
        warn "写入 BBR 模块配置失败，已停止当前操作。"
        return 1
    fi
    if ! sudo sysctl --system; then
        warn "应用 BBR 配置失败，已停止当前操作。"
        return 1
    fi

    if ! is_bbr_enabled; then
        warn "BBR 配置已写入，但当前未成功启用。"
        return 1
    fi

    ok "BBR 已成功启用。"
}

update_vps_system() {
    echo
    echo -e "${yellow}更新 VPS 系统${none}"
    echo "----------------------------------------------------------------"
    if ! sudo apt update; then
        warn "更新软件包索引失败，已停止当前操作。"
        return 1
    fi
    if ! sudo apt -y upgrade; then
        warn "升级 VPS 系统失败，已停止当前操作。"
        return 1
    fi
    ok "VPS 系统更新完成。"
}

get_acme_cmd() {
    if command -v acme.sh >/dev/null 2>&1; then
        echo "acme.sh"
    elif [[ -x "$HOME/.acme.sh/acme.sh" ]]; then
        echo "$HOME/.acme.sh/acme.sh"
    elif [[ -x "/root/.acme.sh/acme.sh" ]]; then
        echo "/root/.acme.sh/acme.sh"
    fi
}

ensure_acme_sh() {
    local acme_cmd
    local script

    acme_cmd=$(get_acme_cmd)
    if [[ -n "$acme_cmd" ]]; then
        return 0
    fi

    echo
    echo -e "${yellow}未找到 acme.sh，正在安装${none}"
    echo "----------------------------------------------------------------"
    if ! sudo apt update; then
        warn "更新软件包索引失败，已停止当前操作。"
        return 1
    fi
    if ! sudo apt install -y curl socat cron; then
        warn "安装 acme.sh 依赖失败，已停止当前操作。"
        return 1
    fi
    if ! script=$(curl -fsSL https://get.acme.sh); then
        warn "下载 acme.sh 安装脚本失败，已停止当前操作。"
        return 1
    fi
    if ! sh -s -- <<< "$script"; then
        warn "安装 acme.sh 失败，已停止当前操作。"
        return 1
    fi

    acme_cmd=$(get_acme_cmd)
    if [[ -z "$acme_cmd" ]]; then
        warn "acme.sh 安装完成后仍无法找到命令。"
        return 1
    fi
}

ensure_acme_cron() {
    local acme_cmd
    local cron_service

    acme_cmd=$(get_acme_cmd)
    if [[ -z "$acme_cmd" ]]; then
        warn "未找到 acme.sh，无法设置自动续签。"
        return 1
    fi

    if ! "$acme_cmd" --install-cronjob >/dev/null 2>&1; then
        warn "安装 acme.sh 自动续签任务失败。"
        return 1
    fi

    if command -v systemctl >/dev/null 2>&1; then
        if systemctl list-unit-files cron.service >/dev/null 2>&1; then
            cron_service="cron"
        elif systemctl list-unit-files crond.service >/dev/null 2>&1; then
            cron_service="crond"
        else
            warn "未找到 cron 或 crond 服务，无法启用自动续签。"
            return 1
        fi

        if ! systemctl enable --now "$cron_service" >/dev/null 2>&1; then
            warn "启用 $cron_service 服务失败。"
            return 1
        fi
    fi
}

get_service_restart_command() {
    local service_name="$1"

    if command -v systemctl >/dev/null 2>&1; then
        echo "systemctl restart ${service_name}"
    else
        echo "service ${service_name} restart"
    fi
}

config_uses_cert_file() {
    local config_file="$1"
    local cert_file="$2"

    [[ -f "$config_file" ]] || return 1
    grep -Fq "$cert_file" "$config_file"
}

build_cert_reload_cmd() {
    local cert_file="$1"
    local restart_commands=()
    local reload_cmd=""
    local cmd

    if config_uses_cert_file "$XRAY_CONFIG_FILE" "$cert_file"; then
        restart_commands+=("$(get_service_restart_command xray)")
    fi
    if config_uses_cert_file "$HYSTERIA_CONFIG_FILE" "$cert_file"; then
        restart_commands+=("$(get_service_restart_command hysteria-server)")
    fi

    for cmd in "${restart_commands[@]}"; do
        if [[ -n "$reload_cmd" ]]; then
            reload_cmd+="; "
        fi
        reload_cmd+="$cmd"
    done

    printf '%s' "$reload_cmd"
}

issue_http_cert() {
    local domain
    local acme_cmd
    local cert_dir="$DOMAIN_CERT_DIR"
    local fullchain_file
    local key_file
    local reload_cmd
    local install_args=()

    if ! ensure_acme_sh; then
        return 1
    fi

    acme_cmd=$(get_acme_cmd)
    domain=$(read_required "请输入要申请证书的域名: ")

    if [[ "$domain" == *:* || "$domain" == */* ]]; then
        warn "域名不能包含端口或路径。"
        return 1
    fi

    fullchain_file="${cert_dir}/${domain}.fullchain.cer"
    key_file="${cert_dir}/${domain}.key"
    reload_cmd=$(build_cert_reload_cmd "$fullchain_file")

    echo
    echo -e "${yellow}使用 HTTP 验证申请证书: ${domain}${none}"
    echo "请确保该域名已解析到本 VPS，且 80 端口已放行、未被其他服务占用。"
    echo "----------------------------------------------------------------"
    if ! "$acme_cmd" --set-default-ca --server letsencrypt; then
        warn "设置 Let's Encrypt 为默认证书颁发机构失败，已停止当前操作。"
        return 1
    fi
    if ! "$acme_cmd" --issue --standalone -d "$domain" --keylength ec-256; then
        warn "证书申请失败，已停止当前操作。"
        return 1
    fi

    if ! sudo mkdir -p "$cert_dir"; then
        warn "创建证书目录失败，已停止当前操作。"
        return 1
    fi

    echo
    echo -e "${yellow}安装证书到 ${cert_dir}${none}"
    echo "----------------------------------------------------------------"
    install_args=(--install-cert -d "$domain" --ecc \
        --fullchain-file "$fullchain_file" \
        --key-file "$key_file")
    if [[ -n "$reload_cmd" ]]; then
        install_args+=(--reloadcmd "$reload_cmd")
    fi
    if ! "$acme_cmd" "${install_args[@]}"; then
        warn "证书安装失败，已停止当前操作。"
        return 1
    fi

    if ! sudo chmod 755 /etc/domain "$cert_dir"; then
        warn "设置证书目录权限失败，已停止当前操作。"
        return 1
    fi
    if ! sudo chmod 644 "$fullchain_file" "$key_file"; then
        warn "设置证书文件权限失败，已停止当前操作。"
        return 1
    fi
    if ! ensure_acme_cron; then
        return 1
    fi

    echo
    ok "证书申请并安装成功。"
    echo -e "证书路径: ${cyan}${fullchain_file}${none}"
    echo -e "私钥路径: ${cyan}${key_file}${none}"
    if [[ -n "$reload_cmd" ]]; then
        echo "acme.sh 已设置自动续签；续签成功后将自动重启: ${reload_cmd}"
    else
        echo "acme.sh 已设置自动续签；未检测到 Xray 或 Hysteria 2 配置使用该证书文件，续签后不会自动重启服务。"
    fi
}

list_acme_domains() {
    local acme_cmd

    acme_cmd=$(get_acme_cmd)
    "$acme_cmd" --list 2>/dev/null | awk 'NR > 1 && $1 != "" {print $1}'
}

setup_cert_reloadcmd() {
    local acme_cmd
    local domains
    local domain
    local matched=0
    local fullchain_file
    local key_file
    local reload_cmd

    if ! ensure_acme_sh; then
        return 1
    fi

    acme_cmd=$(get_acme_cmd)
    domains=$(list_acme_domains)
    if [[ -z "$domains" ]]; then
        warn "当前没有 acme.sh 证书。"
        return 1
    fi

    echo "---------- 当前 acme.sh 证书列表 ----------"
    "$acme_cmd" --list
    echo "-------------------------------------------"

    read -rp "请输入要设置续签自动重启的域名: " domain
    if [[ -z "$domain" ]]; then
        echo "未设置。"
        return 1
    fi

    while IFS= read -r item; do
        if [[ "$item" == "$domain" ]]; then
            matched=1
            break
        fi
    done <<< "$domains"

    if [[ "$matched" -ne 1 ]]; then
        warn "输入的域名不在证书列表中。"
        return 1
    fi

    fullchain_file="${DOMAIN_CERT_DIR}/${domain}.fullchain.cer"
    key_file="${DOMAIN_CERT_DIR}/${domain}.key"

    if [[ ! -f "$fullchain_file" || ! -f "$key_file" ]]; then
        warn "未找到已安装证书文件: ${fullchain_file} / ${key_file}"
        return 1
    fi

    reload_cmd=$(build_cert_reload_cmd "$fullchain_file")
    if [[ -z "$reload_cmd" ]]; then
        warn "未检测到 Xray 或 Hysteria 2 配置使用 ${fullchain_file}，未设置自动重启。"
        return 1
    fi

    if ! "$acme_cmd" --install-cert -d "$domain" --ecc \
        --fullchain-file "$fullchain_file" \
        --key-file "$key_file" \
        --reloadcmd "$reload_cmd"; then
        warn "设置 ${domain} 的续签自动重启命令失败。"
        return 1
    fi

    ok "已设置 ${domain} 续签后自动重启: ${reload_cmd}"
}

manage_certs() {
    local choice
    local acme_cmd

    if ! ensure_acme_sh; then
        return 1
    fi

    acme_cmd=$(get_acme_cmd)

    while :; do
        echo
        echo "---------- 当前 acme.sh 证书列表 ----------"
        if ! "$acme_cmd" --list; then
            warn "读取 acme.sh 证书列表失败，已停止当前操作。"
            return 1
        fi
        echo "-------------------------------------------"
        echo
        echo "请选择证书管理功能:"
        echo "  1. 为已有证书设置续签后自动重启服务"
        echo "  2. 删除证书"
        echo "  3. 返回上级菜单"
        read -rp "请输入选项 [1-3]: " choice

        case "$choice" in
        1)
            setup_cert_reloadcmd
            ;;
        2)
            delete_acme_cert
            ;;
        3)
            return
            ;;
        *)
            error
            ;;
        esac

        echo
        pause
    done
}

delete_acme_cert() {
    local acme_cmd
    local domains
    local domain
    local matched=0
    local confirm
    local removed=0
    local acme_home
    local directory
    local candidate
    local directory_found=0
    local directory_removed=0

    if ! ensure_acme_sh; then
        return 1
    fi

    acme_cmd=$(get_acme_cmd)

    echo
    echo "---------- 当前 acme.sh 证书列表 ----------"
    if ! "$acme_cmd" --list; then
        warn "读取 acme.sh 证书列表失败，已停止当前操作。"
        return 1
    fi
    echo "-------------------------------------------"
    echo

    domains=$(list_acme_domains)
    if [[ -z "$domains" ]]; then
        warn "当前没有 acme.sh 证书。"
        return 0
    fi

    read -rp "请输入要删除的 ECC/非 ECC 证书域名，直接回车则不删除: " domain
    if [[ -z "$domain" ]]; then
        echo "未删除任何证书。"
        return 0
    fi

    while IFS= read -r item; do
        if [[ "$item" == "$domain" ]]; then
            matched=1
            break
        fi
    done <<< "$domains"

    if [[ "$matched" -ne 1 ]]; then
        warn "输入的域名不在证书列表中，未删除。"
        return 1
    fi

    read -rp "确认停止 ${domain} 的自动续签并删除证书文件? [y/N]: " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "已取消删除。"
        return 0
    fi

    echo
    echo -e "${yellow}删除证书: ${domain}${none}"
    echo "----------------------------------------------------------------"
    if "$acme_cmd" --remove -d "$domain" --ecc >/dev/null 2>&1; then
        removed=1
    elif "$acme_cmd" --remove -d "$domain" >/dev/null 2>&1; then
        removed=1
    fi
    if [[ "$removed" -ne 1 ]]; then
        warn "从 acme.sh 删除证书记录失败，已停止当前操作。"
        return 1
    fi

    for acme_home in "$HOME/.acme.sh" "/root/.acme.sh"; do
        for directory in "_ecc" ""; do
            candidate="$acme_home/${domain}${directory}"
            if [[ ! -d "$candidate" ]]; then
                continue
            fi

            directory_found=1
            if rm -rf "$candidate"; then
                directory_removed=1
                break 2
            fi
        done
    done

    if [[ "$directory_found" -eq 1 && "$directory_removed" -ne 1 ]]; then
        warn "删除 acme.sh 证书目录失败，已停止当前操作。"
        return 1
    fi
    if ! rm -f "$DOMAIN_CERT_DIR/${domain}.fullchain.cer" "$DOMAIN_CERT_DIR/${domain}.key"; then
        warn "删除已安装证书文件失败，已停止当前操作。"
        return 1
    fi

    ok "已删除 ${domain} 的 ECC/非 ECC 自动续签记录、证书目录和 ${DOMAIN_CERT_DIR} 中的安装文件。"
    notice "未停止或重启任何服务，请按实际配置手动处理。"
}

print_menu() {
    echo "请选择功能:"
    echo "  1. 管理 xray"
    echo "  2. 管理 hysteria 2"
    echo "  3. 生成 vless+xtls-rprx-vision+reality 节点"
    echo "  4. 生成 vless+ws+tls 优选节点"
    echo "  5. 生成 hysteria 2 节点"
    echo "  6. 开启 bbr"
    echo "  7. 更新 vps 系统"
    echo "  8. 申请域名证书"
    echo "  9. 管理证书"
    echo "  0. 退出"
    echo
}

main() {
    local choice

    while :; do
        print_logo
        refresh_status
        print_status
        print_menu
        read -rp "请输入选项 [0-9]: " choice

        case "$choice" in
        1)
            manage_xray_menu
            ;;
        2)
            manage_hysteria2_menu
            ;;
        3)
            generate_vless_reality_vision
            ;;
        4)
            generate_vless_ws_tls
            ;;
        5)
            generate_hysteria2_node
            ;;
        6)
            enable_bbr
            ;;
        7)
            update_vps_system
            ;;
        8)
            issue_http_cert
            ;;
        9)
            manage_certs
            ;;
        0)
            echo "已退出。"
            exit 0
            ;;
        *)
            error
            ;;
        esac

        echo
        pause
    done
}

main
