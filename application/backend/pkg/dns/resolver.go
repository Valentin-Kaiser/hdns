package dns

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/hdns/pkg/config"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"github.com/rs/zerolog/log"
)

// Resolution represents the result of a DNS lookup from a specific server
type Resolution struct {
	Server       string   `json:"server"`
	Addresses    []string `json:"addresses"`
	ResponseTime int64    `json:"response_time"`
	Error        string   `json:"error"`
}

// Resolver handles DNS resolution against multiple servers
type Resolver struct {
	servers []string
	timeout time.Duration
}

// NewDNSResolver creates a new DNS resolver with the configured servers
func NewDNSResolver() *Resolver {
	return &Resolver{
		servers: config.Get().Service.DNSServers,
		timeout: 5 * time.Second,
	}
}

// Resolve resolves a domain against all configured DNS servers concurrently
func (r *Resolver) Resolve(domain string) ([]Resolution, error) {
	if len(r.servers) == 0 {
		return nil, apperror.NewError("no DNS servers configured")
	}

	ctx, cancel := context.WithTimeout(context.Background(), r.timeout)
	defer cancel()

	results := make([]Resolution, len(r.servers))
	var wg sync.WaitGroup

	for i, server := range r.servers {
		wg.Add(1)
		go func(index int, dnsServer string) {
			defer wg.Done()

			start := time.Now()
			resolver := &net.Resolver{
				PreferGo: true,
				Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
					d := net.Dialer{
						Timeout: 2 * time.Second,
					}
					return d.DialContext(ctx, "udp", dnsServer)
				},
			}

			ips, err := resolver.LookupHost(ctx, domain)
			responseTime := time.Since(start)

			results[index] = Resolution{
				Server:       dnsServer,
				Addresses:    ips,
				ResponseTime: responseTime.Milliseconds(),
			}

			if err != nil {
				results[index].Error = err.Error()

				log.Warn().
					Str("server", dnsServer).
					Str("domain", domain).
					Dur("response_time", responseTime).
					Err(err).
					Msg("DNS resolution failed")
				return
			}

			log.Debug().
				Str("server", dnsServer).
				Str("domain", domain).
				Strs("ips", ips).
				Dur("response_time", responseTime).
				Msg("DNS resolution successful")
		}(i, server)
	}

	wg.Wait()
	return results, nil
}

// buildDomain constructs the full domain name from record name and domain
func (r *Resolver) BuildDomain(record *model.Record) string {
	domain := record.Domain
	if record.Name == "*" {
		domain = "wildcard." + record.Domain
	} else if record.Name != "@" && record.Name != "*" {
		domain = fmt.Sprintf("%s.%s", record.Name, record.Domain)
	}
	return domain
}
