"""Run as root via SSH stdin, with {version, files, config}; never log payloads."""
import grp
import json
import os
from pathlib import Path
import pwd
import re
import subprocess
import sys
import time
import urllib.request


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def main():
    payload = json.load(sys.stdin)
    version = payload['version']
    if not re.fullmatch(r'\d{8}-\d{3}', version) or set(payload['files']) != {'server.py', 'index.html', 'login.html'}:
        raise ValueError('invalid_release')
    try:
        pwd.getpwnam('jev-console')
    except KeyError:
        run('useradd', '--system', '--no-create-home', '--shell', '/usr/sbin/nologin', 'jev-console')
    group = grp.getgrnam('jev-console').gr_gid
    private = Path('/etc/jev-console')
    private.mkdir(mode=0o750, exist_ok=True)
    os.chown(private, 0, group)
    os.chmod(private, 0o750)
    config = private / 'config.json'
    if config.exists():
        if json.loads(config.read_text()) != payload['config']:
            raise ValueError('private_configuration_mismatch')
    else:
        fd = os.open(config, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o640)
        with os.fdopen(fd, 'w') as output:
            json.dump(payload['config'], output)
        os.chown(config, 0, group)
    root = Path('/srv/jev-console')
    release = root / 'releases' / version
    release.mkdir(parents=True, exist_ok=True)
    for name, value in payload['files'].items():
        target = release / name
        if target.exists() and target.read_text() != value:
            raise ValueError('immutable_release_collision')
        target.write_text(value)
        target.chmod(0o644)
    current = root / 'current'
    previous = os.readlink(current) if current.is_symlink() else None
    temporary = root / 'current.next'
    temporary.symlink_to(release)
    temporary.replace(current)
    unit = Path('/etc/systemd/system/jev-console.service')
    unit.write_text('''[Unit]
Description=JEV private decision console
After=network.target

[Service]
Type=simple
User=jev-console
Group=jev-console
WorkingDirectory=/srv/jev-console/current
ExecStart=/usr/bin/python3 /srv/jev-console/current/server.py --config /etc/jev-console/config.json
Restart=on-failure
RestartSec=3
Environment=PYTHONDONTWRITEBYTECODE=1
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
MemoryMax=128M
TasksMax=64

[Install]
WantedBy=multi-user.target
''')
    run('systemctl', 'daemon-reload')
    run('systemctl', 'enable', 'jev-console.service')
    try:
        run('systemctl', 'restart', 'jev-console.service')
        healthy = False
        for _ in range(30):
            try:
                with urllib.request.urlopen('http://127.0.0.1:8094/jev-console/health', timeout=1) as response:
                    healthy = response.status == 200
                if healthy:
                    break
            except OSError:
                time.sleep(0.2)
        if not healthy:
            raise ValueError('service_health_failed')
        nginx = Path('/etc/nginx/conf.d/00-etc-website.conf')
        old = nginx.read_text()
        backup = root / ('nginx-before-' + version + '.conf')
        if not backup.exists():
            backup.write_text(old)
        snippet = Path('/etc/nginx/snippets/jev-console.conf')
        snippet.write_text('''location = /jev-console { return 308 /jev-console/; }
location ^~ /jev-console/ {
    proxy_pass http://127.0.0.1:8094;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    proxy_connect_timeout 3s;
    proxy_read_timeout 10s;
    client_max_body_size 350k;
    access_log off;
    add_header Cache-Control "no-store" always;
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;
}
''')
        include = '    include snippets/jev-console.conf;'
        if include not in old:
            anchor = '    include snippets/etc-online-api.conf;'
            if old.count(anchor) != 1 or old.index(anchor) < old.index('listen 443'):
                raise ValueError('unexpected_nginx_layout')
            nginx.write_text(old.replace(anchor, anchor + '\n' + include))
        try:
            run('nginx', '-t')
            run('systemctl', 'reload', 'nginx')
        except Exception:
            nginx.write_text(old)
            raise
    except Exception:
        if previous:
            temporary.symlink_to(previous)
            temporary.replace(current)
            run('systemctl', 'restart', 'jev-console.service')
        else:
            run('systemctl', 'stop', 'jev-console.service')
        raise
    print(json.dumps({'deployed': version, 'url': payload['config']['origin'] + '/jev-console/', 'health': 'ok'}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Configuration, stdin and subprocess stderr can contain private values.
        print(json.dumps({'error': type(error).__name__, 'deployed': False}))
        sys.exit(1)
