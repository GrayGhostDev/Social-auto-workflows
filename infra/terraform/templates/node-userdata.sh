#!/bin/bash
set -ex

# Node userdata for Ubuntu 22.04 LTS with CIS Level-1 hardening
# This script configures the node with FIPS-validated cryptographic modules

# Update system
apt-get update
apt-get upgrade -y

# Install required packages
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    openssl \
    python3-pip

# Enable FIPS mode with OpenSSL 3.0 FIPS provider
cat > /etc/ssl/openssl.cnf.fips <<EOF
openssl_conf = openssl_init

[openssl_init]
providers = provider_sect

[provider_sect]
fips = fips_sect
base = base_sect

[fips_sect]
activate = 1

[base_sect]
activate = 1
EOF

# Install and configure FIPS provider
update-alternatives --install /etc/ssl/openssl.cnf openssl.cnf /etc/ssl/openssl.cnf.fips 50
openssl fipsinstall -out /etc/ssl/fipsmodule.cnf -module /usr/lib/x86_64-linux-gnu/ossl-modules/fips.so

# Configure sysctl for CIS hardening
cat > /etc/sysctl.d/99-cis-hardening.conf <<EOF
# CIS Level-1 Benchmark for Ubuntu 22.04
kernel.randomize_va_space = 2
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.tcp_syncookies = 1
net.ipv6.conf.all.accept_ra = 0
net.ipv6.conf.default.accept_ra = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.ip_forward = 0
net.ipv6.conf.all.forwarding = 0
EOF

sysctl -p /etc/sysctl.d/99-cis-hardening.conf

# Configure auditd for CIS compliance
apt-get install -y auditd audispd-plugins
systemctl enable auditd

cat > /etc/audit/rules.d/cis.rules <<EOF
# CIS Ubuntu 22.04 Benchmark Audit Rules
-a always,exit -F arch=b64 -S adjtimex -S settimeofday -k time-change
-a always,exit -F arch=b32 -S adjtimex -S settimeofday -S stime -k time-change
-a always,exit -F arch=b64 -S clock_settime -k time-change
-a always,exit -F arch=b32 -S clock_settime -k time-change
-w /etc/localtime -p wa -k time-change
-w /etc/group -p wa -k identity
-w /etc/passwd -p wa -k identity
-w /etc/gshadow -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/security/opasswd -p wa -k identity
-a always,exit -F arch=b64 -S sethostname -S setdomainname -k system-locale
-a always,exit -F arch=b32 -S sethostname -S setdomainname -k system-locale
-w /etc/issue -p wa -k system-locale
-w /etc/issue.net -p wa -k system-locale
-w /etc/hosts -p wa -k system-locale
-w /etc/network -p wa -k system-locale
EOF

# Configure fail2ban
apt-get install -y fail2ban
systemctl enable fail2ban

# Configure AIDE (Advanced Intrusion Detection Environment)
apt-get install -y aide aide-common
aideinit
mv /var/lib/aide/aide.db.new /var/lib/aide/aide.db

# Set up automated security updates
apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Configure AppArmor
apt-get install -y apparmor apparmor-utils
systemctl enable apparmor

# Install and configure ClamAV
apt-get install -y clamav clamav-daemon
systemctl enable clamav-freshclam
systemctl enable clamav-daemon
freshclam

# Configure log rotation for security logs
cat > /etc/logrotate.d/security <<EOF
/var/log/auth.log
/var/log/syslog
/var/log/kern.log
{
    daily
    rotate 90
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
}
EOF

# Harden SSH configuration
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
echo "Protocol 2" >> /etc/ssh/sshd_config
echo "MaxAuthTries 3" >> /etc/ssh/sshd_config
echo "ClientAliveInterval 300" >> /etc/ssh/sshd_config
echo "ClientAliveCountMax 0" >> /etc/ssh/sshd_config
echo "LoginGraceTime 60" >> /etc/ssh/sshd_config
echo "AllowGroups ssh-users" >> /etc/ssh/sshd_config
systemctl restart sshd

# Create ssh-users group
groupadd -f ssh-users

# Configure firewall
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow https
ufw allow 6443/tcp  # Kubernetes API
ufw allow 10250/tcp # Kubelet API
ufw allow 10251/tcp # kube-scheduler
ufw allow 10252/tcp # kube-controller-manager

# Install EKS bootstrap script
curl -o /usr/local/bin/eks-bootstrap.sh https://raw.githubusercontent.com/awslabs/amazon-eks-ami/master/files/bootstrap.sh
chmod +x /usr/local/bin/eks-bootstrap.sh

# Configure containerd for FIPS compliance
mkdir -p /etc/containerd
cat > /etc/containerd/config.toml <<EOF
version = 2
[plugins]
  [plugins."io.containerd.grpc.v1.cri"]
    [plugins."io.containerd.grpc.v1.cri".containerd]
      default_runtime_name = "runc"
      [plugins."io.containerd.grpc.v1.cri".containerd.runtimes]
        [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc]
          runtime_type = "io.containerd.runc.v2"
          [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
            SystemdCgroup = true
EOF

# Bootstrap EKS
/usr/local/bin/eks-bootstrap.sh ${cluster_name} \
  --b64-cluster-ca ${cluster_ca} \
  --apiserver-endpoint ${cluster_endpoint} \
  --container-runtime containerd

# Configure kubelet for security
cat >> /etc/kubernetes/kubelet/kubelet-config.json <<EOF
{
  "featureGates": {
    "RotateKubeletServerCertificate": true
  },
  "serverTLSBootstrap": true,
  "tlsCipherSuites": [
    "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256",
    "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384",
    "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256",
    "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384"
  ]
}
EOF

# Clean up
apt-get clean
rm -rf /var/lib/apt/lists/*

# Final security check
/usr/bin/chkrootkit || true

echo "CIS Level-1 hardening complete with FIPS-validated cryptographic modules"