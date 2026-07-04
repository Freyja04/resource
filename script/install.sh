#!/usr/bin/env bash

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
LAST_CONFIG_BACKUP=""

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

    if [[ -z "$installed_xray_version" ]]; then
        xray_status="$(notice "未安装")"
    elif [[ -z "$latest_xray_version" ]]; then
        xray_status="$(notice "无法检查最新版本")"
    elif [[ "$installed_xray_version" == "$latest_xray_version" ]]; then
        xray_status="$(ok "无需更新")"
    else
        xray_status="$(notice "待更新")"
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
    echo -e "Xray 状态: ${xray_status}"
    echo -e "BBR 状态: ${bbr_status}"
    echo "------------------------------------------"
    echo
}

install_xray_latest() {
    echo
    echo -e "${yellow}安装 Xray 最新稳定版${none}"
    echo "----------------------------------------------------------------"
    bash -c "$(curl -L "$XRAY_INSTALL_SCRIPT")" @ install
}

install_xray_version() {
    local version

    read -rp "$(echo -e "请输入 Xray 版本号，例如 ${cyan}v26.3.27${none}: ")" version
    if [[ -z "$version" ]]; then
        error
        return
    fi

    echo
    echo -e "${yellow}安装 Xray ${version}${none}"
    echo "----------------------------------------------------------------"
    bash -c "$(curl -L "$XRAY_INSTALL_SCRIPT")" @ install --version "$version"
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
        install_xray_version
        ;;
    1 | "")
        install_xray_latest
        ;;
    *)
        install_xray_latest
        ;;
    esac

    echo
    echo -e "${yellow}更新 Xray geodata${none}"
    echo "----------------------------------------------------------------"
    bash -c "$(curl -L "$XRAY_INSTALL_SCRIPT")" @ install-geodata
}

update_and_restart_xray() {
    echo
    echo -e "${yellow}更新 Xray 到官方最新稳定版${none}"
    echo "----------------------------------------------------------------"
    install_xray_latest

    echo
    echo -e "${yellow}更新 Xray geodata${none}"
    echo "----------------------------------------------------------------"
    bash -c "$(curl -L "$XRAY_INSTALL_SCRIPT")" @ install-geodata

    echo
    echo -e "${yellow}重启 Xray${none}"
    echo "----------------------------------------------------------------"
    if command -v systemctl >/dev/null 2>&1; then
        systemctl restart xray
    else
        service xray restart
    fi
}

placeholder_entry() {
    local name="$1"

    echo
    echo -e "${yellow}${name}${none}"
    echo "----------------------------------------------------------------"
    echo "该功能目前只是入口，暂未写入实际生成脚本。"
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

generate_spider_x() {
    local token

    if command -v openssl >/dev/null 2>&1; then
        token=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 16)
    else
        token=$(hexdump -n 8 -e '8/1 "%02x"' /dev/urandom)
    fi

    echo "/${token}"
}

generate_ws_path() {
    local token

    if command -v openssl >/dev/null 2>&1; then
        token=$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 16)
    else
        token=$(hexdump -n 8 -e '8/1 "%02x"' /dev/urandom)
    fi

    echo "/${token}"
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
    if [[ -n "$LAST_CONFIG_BACKUP" && -f "$LAST_CONFIG_BACKUP" ]]; then
        cp "$LAST_CONFIG_BACKUP" "$XRAY_CONFIG_FILE"
        warn "已恢复上一次备份配置: $LAST_CONFIG_BACKUP"
    fi
}

restart_and_check_xray() {
    echo
    echo -e "${yellow}测试 Xray 配置${none}"
    echo "----------------------------------------------------------------"
    if ! test_xray_config; then
        warn "Xray 配置测试失败，未重启服务。错误信息如下:"
        cat /tmp/xray_config_test.log
        restore_last_config_backup
        return 1
    fi

    echo
    echo -e "${yellow}重启 Xray${none}"
    echo "----------------------------------------------------------------"
    if ! restart_xray; then
        warn "Xray 重启失败。"
        restore_last_config_backup
        return 1
    fi

    sleep 1
    if ! is_xray_running; then
        warn "Xray 未正常运行，请检查日志。"
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
    local spider_x="$7"

    if ! command -v python3 >/dev/null 2>&1; then
        warn "未找到 python3，正在安装 python3。"
        sudo apt update
        sudo apt install -y python3
    fi

    if [[ -f "$XRAY_CONFIG_FILE" ]]; then
        LAST_CONFIG_BACKUP="${XRAY_CONFIG_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        cp "$XRAY_CONFIG_FILE" "$LAST_CONFIG_BACKUP"
    else
        LAST_CONFIG_BACKUP=""
    fi

    mkdir -p "$(dirname "$XRAY_CONFIG_FILE")"

    XRAY_CONFIG_FILE="$XRAY_CONFIG_FILE" \
    XRAY_PORT="$port" \
    XRAY_UUID="$uuid" \
    XRAY_PRIVATE_KEY="$private_key" \
    XRAY_SHORT_ID="$short_id" \
    XRAY_SNI="$sni" \
    XRAY_TARGET_PORT="$target_port" \
    XRAY_SPIDER_X="$spider_x" \
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
            "target": f'{os.environ["XRAY_SNI"]}:{os.environ["XRAY_TARGET_PORT"]}',
            "xver": 0,
            "serverNames": [os.environ["XRAY_SNI"]],
            "privateKey": os.environ["XRAY_PRIVATE_KEY"],
            "shortIds": [os.environ["XRAY_SHORT_ID"]],
            "spiderX": os.environ["XRAY_SPIDER_X"],
        },
    },
    "sniffing": {
        "enabled": True,
        "destOverride": ["http", "tls", "quic"],
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
    local host="$3"
    local ws_path="$4"
    local cert_file="$5"
    local key_file="$6"

    if ! command -v python3 >/dev/null 2>&1; then
        warn "未找到 python3，正在安装 python3。"
        sudo apt update
        sudo apt install -y python3
    fi

    if [[ -f "$XRAY_CONFIG_FILE" ]]; then
        LAST_CONFIG_BACKUP="${XRAY_CONFIG_FILE}.bak.$(date +%Y%m%d%H%M%S)"
        cp "$XRAY_CONFIG_FILE" "$LAST_CONFIG_BACKUP"
    else
        LAST_CONFIG_BACKUP=""
    fi

    mkdir -p "$(dirname "$XRAY_CONFIG_FILE")"

    XRAY_CONFIG_FILE="$XRAY_CONFIG_FILE" \
    XRAY_LISTEN_PORT="$listen_port" \
    XRAY_UUID="$uuid" \
    XRAY_HOST="$host" \
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
            "alpn": ["http/1.1"],
            "certificates": [
                {
                    "certificateFile": os.environ["XRAY_CERT_FILE"],
                    "keyFile": os.environ["XRAY_KEY_FILE"],
                }
            ],
        },
        "wsSettings": {
            "path": os.environ["XRAY_WS_PATH"],
            "headers": {
                "Host": os.environ["XRAY_HOST"],
            },
        },
    },
    "sniffing": {
        "enabled": True,
        "destOverride": ["http", "tls", "quic"],
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
    local spider_x
    local encoded_spider_x
    local node_name
    local vless_url

    if ! command -v xray >/dev/null 2>&1; then
        warn "未找到 xray 命令，请先选择 1 安装 xray。"
        return
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
        return
    fi

    uuid=$(xray uuid)
    keys=$(xray x25519)
    private_key=$(echo "$keys" | awk -F': ' '/PrivateKey|Private key/ {print $2; exit}')
    public_key=$(echo "$keys" | awk -F': ' '/PublicKey|Public key|Password/ {print $2; exit}')
    short_id=$(generate_short_id)
    spider_x=$(generate_spider_x)
    encoded_spider_x=$(url_encode "$spider_x")
    node_name="VLESS_REALITY"
    server_for_url=$(format_server_for_url "$server")

    if [[ -z "$uuid" || -z "$private_key" || -z "$public_key" || -z "$short_id" || -z "$spider_x" ]]; then
        warn "参数生成失败，请确认 xray 命令可正常执行。"
        return
    fi

    if ! write_vless_reality_config "$port" "$uuid" "$private_key" "$short_id" "$sni" "$target_port" "$spider_x"; then
        warn "写入 Xray 配置失败。请确认现有配置文件是标准 JSON 格式。"
        restore_last_config_backup
        return
    fi

    if ! restart_and_check_xray; then
        return
    fi

    vless_url="vless://${uuid}@${server_for_url}:${port}?encryption=none&flow=xtls-rprx-vision&fp=chrome&pbk=${public_key}&security=reality&sid=${short_id}&sni=${sni}&spx=${encoded_spider_x}&type=tcp&headerType=none#${node_name}"

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
        return
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
        return
    fi

    uuid=$(xray uuid)
    ws_path=$(generate_ws_path)
    encoded_ws_path=$(url_encode "$ws_path")
    node_name="VLESS_WS_TLS"
    server="$host"
    server_for_url=$(format_server_for_url "$server")

    if [[ -z "$uuid" || -z "$ws_path" ]]; then
        warn "参数生成失败，请确认 xray 命令可正常执行。"
        return
    fi

    if ! write_vless_ws_tls_config "$listen_port" "$uuid" "$host" "$ws_path" "$cert_file" "$key_file"; then
        warn "写入 Xray 配置失败。请确认现有配置文件是标准 JSON 格式。"
        restore_last_config_backup
        return
    fi

    if ! restart_and_check_xray; then
        return
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
    sudo touch /etc/sysctl.d/99-bbr.conf
    sudo sed -i '/^net\.core\.default_qdisc/d' /etc/sysctl.d/99-bbr.conf
    sudo sed -i '/^net\.ipv4\.tcp_congestion_control/d' /etc/sysctl.d/99-bbr.conf
    echo 'net.core.default_qdisc=fq' | sudo tee -a /etc/sysctl.d/99-bbr.conf
    echo 'net.ipv4.tcp_congestion_control=bbr' | sudo tee -a /etc/sysctl.d/99-bbr.conf
    echo 'tcp_bbr' | sudo tee /etc/modules-load.d/bbr.conf
    sudo sysctl --system
}

update_vps_system() {
    echo
    echo -e "${yellow}更新 VPS 系统${none}"
    echo "----------------------------------------------------------------"
    sudo apt update
    sudo apt -y upgrade
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

    acme_cmd=$(get_acme_cmd)
    if [[ -n "$acme_cmd" ]]; then
        return 0
    fi

    echo
    echo -e "${yellow}未找到 acme.sh，正在安装${none}"
    echo "----------------------------------------------------------------"
    sudo apt update
    sudo apt install -y curl socat cron
    curl https://get.acme.sh | sh

    acme_cmd=$(get_acme_cmd)
    if [[ -z "$acme_cmd" ]]; then
        warn "acme.sh 安装失败。"
        return 1
    fi
}

ensure_acme_cron() {
    local acme_cmd

    acme_cmd=$(get_acme_cmd)
    "$acme_cmd" --install-cronjob >/dev/null 2>&1 || true

    if command -v systemctl >/dev/null 2>&1; then
        systemctl enable --now cron >/dev/null 2>&1 || true
        systemctl enable --now crond >/dev/null 2>&1 || true
    fi
}

issue_http_cert() {
    local domain
    local acme_cmd
    local cert_dir="/etc/xray/certs"
    local fullchain_file
    local key_file

    if ! ensure_acme_sh; then
        return
    fi

    acme_cmd=$(get_acme_cmd)
    domain=$(read_required "请输入要申请证书的域名: ")

    if [[ "$domain" == *:* || "$domain" == */* ]]; then
        warn "域名不能包含端口或路径。"
        return
    fi

    fullchain_file="${cert_dir}/${domain}.fullchain.cer"
    key_file="${cert_dir}/${domain}.key"

    echo
    echo -e "${yellow}使用 HTTP 验证申请证书: ${domain}${none}"
    echo "请确保该域名已解析到本 VPS，且 80 端口已放行、未被其他服务占用。"
    echo "----------------------------------------------------------------"
    "$acme_cmd" --set-default-ca --server letsencrypt >/dev/null 2>&1 || true
    if ! "$acme_cmd" --issue --standalone -d "$domain" --keylength ec-256; then
        warn "证书申请失败。"
        return
    fi

    sudo mkdir -p "$cert_dir"

    echo
    echo -e "${yellow}安装证书到 ${cert_dir}${none}"
    echo "----------------------------------------------------------------"
    if ! "$acme_cmd" --install-cert -d "$domain" --ecc \
        --fullchain-file "$fullchain_file" \
        --key-file "$key_file" \
        --reloadcmd "systemctl restart xray"; then
        warn "证书安装失败。"
        return
    fi

    sudo chmod 755 /etc/xray "$cert_dir"
    sudo chmod 644 "$fullchain_file" "$key_file"
    ensure_acme_cron

    echo
    ok "证书申请并安装成功。"
    echo -e "证书路径: ${cyan}${fullchain_file}${none}"
    echo -e "私钥路径: ${cyan}${key_file}${none}"
    echo "acme.sh 已设置自动续签；续签成功后会自动重启 Xray。"
}

list_acme_domains() {
    local acme_cmd

    acme_cmd=$(get_acme_cmd)
    "$acme_cmd" --list 2>/dev/null | awk 'NR > 1 && $1 != "" {print $1}'
}

manage_certs() {
    local acme_cmd
    local domains
    local domain
    local matched=0

    if ! ensure_acme_sh; then
        return
    fi

    acme_cmd=$(get_acme_cmd)

    echo
    echo "---------- 当前 acme.sh 证书列表 ----------"
    "$acme_cmd" --list
    echo "-------------------------------------------"
    echo

    domains=$(list_acme_domains)
    if [[ -z "$domains" ]]; then
        warn "当前没有 acme.sh 证书。"
        return
    fi

    read -rp "请输入要删除的域名，直接回车则不删除: " domain
    if [[ -z "$domain" ]]; then
        echo "未删除任何证书。"
        return
    fi

    while IFS= read -r item; do
        if [[ "$item" == "$domain" ]]; then
            matched=1
            break
        fi
    done <<< "$domains"

    if [[ "$matched" -ne 1 ]]; then
        warn "输入的域名不在证书列表中，未删除。"
        return
    fi

    echo
    echo -e "${yellow}删除证书: ${domain}${none}"
    echo "----------------------------------------------------------------"
    "$acme_cmd" --remove -d "$domain" --ecc >/dev/null 2>&1 || true
    "$acme_cmd" --remove -d "$domain" >/dev/null 2>&1 || true

    rm -rf "$HOME/.acme.sh/${domain}_ecc" "$HOME/.acme.sh/${domain}" \
        "/root/.acme.sh/${domain}_ecc" "/root/.acme.sh/${domain}"
    rm -f "/etc/xray/certs/${domain}.fullchain.cer" "/etc/xray/certs/${domain}.key"

    ok "已删除 ${domain} 的 acme.sh 记录、证书目录和 /etc/xray/certs 中的安装文件。"
}

print_menu() {
    echo "请选择功能:"
    echo "  1. 安装 xray"
    echo "  2. 更新并重启 xray"
    echo "  3. 生成 vless+xtls-rprx-vision+reality 节点"
    echo "  4. 生成 vless+ws+tls 优选节点"
    echo "  5. 生成 anytls 节点"
    echo "  6. 生成 hysteria 2 节点"
    echo "  7. 开启 bbr"
    echo "  8. 更新 vps 系统"
    echo "  9. 申请域名证书"
    echo "  10. 管理证书"
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
        read -rp "请输入选项 [0-10]: " choice

        case "$choice" in
        1)
            install_xray_menu
            ;;
        2)
            update_and_restart_xray
            ;;
        3)
            generate_vless_reality_vision
            ;;
        4)
            generate_vless_ws_tls
            ;;
        5)
            placeholder_entry "生成 anytls 节点"
            ;;
        6)
            placeholder_entry "生成 hysteria 2 节点"
            ;;
        7)
            enable_bbr
            ;;
        8)
            update_vps_system
            ;;
        9)
            issue_http_cert
            ;;
        10)
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