package dns

import (
	"context"
	"errors"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/hdns/pkg/config"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

// Resolution represents the result of a DNS lookup from a specific server
type Resolution struct {
	Server       string   `json:"server"`
	Addresses    []string `json:"addresses"`
	ResponseTime int64    `json:"response_time"`
	Error        error    `json:"error"`
}

// Resolver handles DNS resolution against multiple servers
type Resolver struct {
	servers []string
	timeout time.Duration
}

// Lookup performs DNS lookup using the enhanced multi-server resolver
func Lookup(record *model.Record) (*model.Address, bool, error) {
	return NewDNSResolver().Lookup(record)
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
				Error:        err,
			}

			if err != nil {
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

// Lookup performs enhanced DNS lookup for a record with multiple server validation
func (r *Resolver) Lookup(record *model.Record) (*model.Address, bool, error) {
	if record == nil {
		return nil, false, apperror.NewError("record cannot be nil")
	}

	if record.AddressID != nil {
		err := database.Execute(func(db *gorm.DB) error {
			return db.Where("id = ?", record.AddressID).First(&record.Address).Error
		})
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, apperror.NewErrorf("failed to fetch address for record %s.%s", record.Name, record.Domain).AddError(err)
		}
	}

	var current *model.Address
	err := database.Execute(func(db *gorm.DB) error {
		return db.Where("current = ?", true).First(&current).Error
	})
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, apperror.NewError("failed to fetch current address").AddError(err)
	}

	domain := r.BuildDomain(record)
	results, err := r.Resolve(domain)
	if err != nil {
		return nil, false, apperror.NewErrorf("failed to resolve domain %s", domain).AddError(err)
	}

	ips := r.consens(results)
	if len(ips) == 0 {
		fastestResult := r.fastest(results)
		if fastestResult == nil || len(fastestResult.Addresses) == 0 {
			return nil, false, apperror.NewErrorf("no successful DNS resolution for domain %s", domain)
		}
		ips = fastestResult.Addresses
	}

	// Check if any of the IPs match the current address
	if record.Address != nil {
		for _, ip := range ips {
			if current.IP == ip {
				return record.Address, true, nil
			}
		}
	}

	var address *model.Address
	if len(ips) > 0 {
		err = database.Execute(func(db *gorm.DB) error {
			return db.Where("ip = ?", ips[0]).First(&address).Error
		})
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, apperror.NewErrorf("failed to check existing address for record %s.%s", record.Name, record.Domain).AddError(err)
		}
	}

	return address, false, nil
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

// consens finds IP addresses that appear from multiple DNS servers
func (r *Resolver) consens(results []Resolution) []string {
	ipCount := make(map[string]int)

	for _, result := range results {
		if result.Error == nil {
			for _, ip := range result.Addresses {
				ipCount[ip]++
			}
		}
	}

	var consensusIPs []string
	successfulServers := 0
	for _, result := range results {
		if result.Error == nil {
			successfulServers++
		}
	}

	minConsensus := 2
	if successfulServers == 1 {
		minConsensus = 1
	}

	for ip, count := range ipCount {
		if count >= minConsensus {
			consensusIPs = append(consensusIPs, ip)
		}
	}

	return consensusIPs
}

// fastest returns the result with the lowest response time that succeeded
func (r *Resolver) fastest(results []Resolution) *Resolution {
	var fastest *Resolution

	for i := range results {
		if results[i].Error == nil && len(results[i].Addresses) > 0 {
			if fastest == nil || results[i].ResponseTime < fastest.ResponseTime {
				fastest = &results[i]
			}
		}
	}

	return fastest
}
