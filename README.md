<p align="center">
  <img src="application/frontend/src/assets/hdns.png" width="365">
</p>

# HDNS - Hetzner Dynamic DNS Management

A modern web-based Dynamic DNS management solution specifically designed for Hetzner DNS services. HDNS provides an intuitive interface for managing DNS records and automatically updating them with your current IP address.

## 🚀 Features

- **Dynamic DNS Updates**: Automatically updates your DNS records with your current IP address
- **Web Interface**: Modern web frontend for easy management
- **Multi-platform**: Docker support for easy deployment

## 📦 Installation

### Docker (Recommended)

```bash
docker pull ghcr.io/valentin-kaiser/hdns:latest
docker run -p 8080:8080 ghcr.io/valentin-kaiser/hdns:latest
```


```bash
# Clone the repository
git clone https://github.com/Valentin-Kaiser/hdns.git
cd hdns

# Build and run with Docker
docker build --tag hdns .
docker run -p 8080:8080 hdns
```

## ⚙️ Configuration

Configuration is managed through the `hdns.yaml` file located in `application/backend/cmd/data/`:

```yaml
service:
  loglevel: -1              # Log level (-1 = Debug, 0 = Info, 1 = Warn, 2 = Error)
  webport: 8080            # Web server port
  refresh: '*/30 * * * * *' # Cron schedule for DNS updates (every 30 seconds)
  dnsserver: hydrogen.ns.hetzner.com:53  # Hetzner DNS server

database:
  driver: sqlite           # Database driver
  host: 127.0.0.1         # Database host (for non-SQLite)
  port: 3306              # Database port
  user: hdns              # Database user
  password: hdns          # Database password
  name: hdns              # Database name
```