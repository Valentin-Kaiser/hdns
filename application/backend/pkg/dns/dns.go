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
