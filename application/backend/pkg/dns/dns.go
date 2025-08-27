package dns

import (
	"context"
	"errors"
	"fmt"
	"net"
	"time"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/hdns/pkg/config"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

var resolver = &net.Resolver{
	PreferGo: true,
	Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
		d := net.Dialer{
			Timeout: time.Second * 2,
		}
		return d.DialContext(ctx, "udp", config.Get().Service.DNSServer)
	},
}

func Lookup(record *model.Record) (*model.Address, bool, error) {
	if record == nil {
		return nil, false, apperror.NewError("record cannot be nil")
	}

	if record.AddressID != nil {
		err := database.Execute(func(db *gorm.DB) error {
			return db.Where("id = ?", record.AddressID).First(&record.Address).Error
		})
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, false, apperror.NewErrorf("address with ID %d not found for record %s.%s", *record.AddressID, record.Name, record.Domain)
			}
			return nil, false, apperror.NewErrorf("failed to fetch address for record %s.%s", record.Name, record.Domain).AddError(err)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	domain := record.Domain
	if record.Name == "*" {
		domain = "wildcard." + record.Domain
	}

	if record.Name != "@" && record.Name != "*" {
		domain = fmt.Sprintf("%s.%s", record.Name, record.Domain)
	}

	ips, err := resolver.LookupHost(ctx, domain)
	if err != nil {
		return nil, false, apperror.NewErrorf("failed to lookup DNS record %s", domain).AddError(err)
	}

	var address *model.Address
	for _, ip := range ips {
		if net.ParseIP(ip) == nil {
			return nil, false, fmt.Errorf("invalid IP address %s for record %s.%s", ip, record.Name, record.Domain)
		}

		// Track DNS record resolution history
		err = trackRecordResolution(record, ip)
		if err != nil {
			log.Error().Err(err).Msgf("failed to track DNS record resolution for %s.%s -> %s", record.Name, record.Domain, ip)
		}

		if record.Address != nil && record.Address.IP == ip {
			return record.Address, true, nil
		}

		// Check if the IP is already in the database
		err = database.Execute(func(db *gorm.DB) error {
			return db.Where("ip = ?", ip).First(&address).Error
		})
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, apperror.NewErrorf("failed to check existing address for record %s.%s", record.Name, record.Domain).AddError(err)
		}
	}

	return address, false, nil
}

// trackRecordResolution saves the DNS record resolution history
func trackRecordResolution(record *model.Record, resolvedIP string) error {
	// Check if this is the most recent resolution for this record
	var lastHistory model.RecordHistory
	err := database.Execute(func(db *gorm.DB) error {
		return db.Where("record_id = ?", record.ID).
			Order("resolved_at DESC").
			First(&lastHistory).Error
	})

	// If this is the same IP as the last resolution, don't create a duplicate entry
	if err == nil && lastHistory.ResolvedIP == resolvedIP {
		// Check if it was resolved recently (within the last hour to avoid spam)
		if time.Since(lastHistory.ResolvedAt) < time.Hour {
			return nil
		}
	}

	// Find or create the address for this IP
	var address model.Address
	err = database.Execute(func(db *gorm.DB) error {
		return db.FirstOrCreate(&address, model.Address{IP: resolvedIP}).Error
	})
	if err != nil {
		return apperror.NewErrorf("failed to find or create address for IP %s", resolvedIP).AddError(err)
	}

	// Create the record history entry
	history := &model.RecordHistory{
		RecordID:   record.ID,
		AddressID:  address.ID,
		ResolvedIP: resolvedIP,
		ResolvedAt: time.Now(),
	}

	err = database.Execute(func(db *gorm.DB) error {
		return db.Create(history).Error
	})
	if err != nil {
		return apperror.NewErrorf("failed to create record history for %s.%s -> %s", record.Name, record.Domain, resolvedIP).AddError(err)
	}

	log.Info().Msgf("tracked DNS record resolution: %s.%s -> %s", record.Name, record.Domain, resolvedIP)
	return nil
}
