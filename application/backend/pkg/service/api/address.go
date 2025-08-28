package api

import (
	"errors"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/hdns/pkg/dns"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"gorm.io/gorm"
)

func init() {
	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/object/address",
		}, map[string]Handler{
			"GET": GetAddress,
			"OPTIONS": func(context *Context) (interface{}, error) {
				return nil, nil
			},
		})

	RegisterEndpoint(
		EndpointTransportWebsocket,
		EndpointEncodingJSON,
		[]string{
			"/api/stream/address",
		}, map[string]Handler{
			"WS": streamAddress,
		})

	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/object/history",
		}, map[string]Handler{
			"GET":    GetHistory,
			"DELETE": DeleteHistory,
			"OPTIONS": func(context *Context) (interface{}, error) {
				return nil, nil
			},
		})

	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/action/refresh/address",
		}, map[string]Handler{
			"GET": RefreshAddress,
		})

	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/action/resolve/{id}",
		}, map[string]Handler{
			"GET": ResolveAddress,
		},
	)

	RegisterEndpoint(
		EndpointTransportWebsocket,
		EndpointEncodingJSON,
		[]string{
			"/api/stream/address",
		}, map[string]Handler{
			"WS": streamAddress,
		},
	)

	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/action/refresh/address",
		}, map[string]Handler{
			"GET": RefreshAddress,
		})

	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/action/resolve/{id}",
		}, map[string]Handler{
			"GET": ResolveAddress,
		},
	)

	RegisterEndpoint(
		EndpointTransportWebsocket,
		EndpointEncodingJSON,
		[]string{
			"/api/stream/resolve/{id}",
		}, map[string]Handler{
			"WS": streamResolveAddress,
		},
	)
}

func RefreshAddress(c *Context) (interface{}, error) {
	address, err := dns.UpdateAddress()
	if err != nil {
		return nil, apperror.Wrap(err)
	}
	return address, nil
}

func GetAddress(c *Context) (interface{}, error) {
	var address model.Address
	err := database.Execute(func(db *gorm.DB) error {
		return db.Last(&address).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to get address").AddError(err)
	}

	return address, nil
}

// Stream address sends the current address the first time and every change
func streamAddress(c *Context) (interface{}, error) {
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			return nil, nil
		}

		var current *model.Address
		err = database.Execute(func(db *gorm.DB) error {
			err := db.Where("current = ?", true).First(&current).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			return nil
		})
		if err != nil {
			return nil, apperror.NewError("failed to get address").AddError(err)
		}

		err = c.conn.WriteJSON(current)
		if err != nil {
			return nil, apperror.Wrap(err)
		}
	}
}

// GetHistory retrieves the history of addresses.
func GetHistory(c *Context) (interface{}, error) {
	var addresses []model.Address
	err := database.Execute(func(db *gorm.DB) error {
		return db.Order("created_at DESC").Find(&addresses).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to fetch addresses").AddError(err)
	}

	return addresses, nil
}

// DeleteHistory deletes the history of addresses except the most recent one.
func DeleteHistory(c *Context) (interface{}, error) {
	var addresses []model.Address
	err := database.Execute(func(db *gorm.DB) error {
		return db.Order("created_at DESC").Find(&addresses).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to fetch addresses").AddError(err)
	}

	if len(addresses) <= 1 {
		return nil, apperror.NewError("no history to delete")
	}

	// Keep the most recent address and delete the rest
	addresses = addresses[1:]

	err = database.Execute(func(db *gorm.DB) error {
		return db.Delete(&addresses).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to delete address history").AddError(err)
	}

	return map[string]any{"deleted": len(addresses)}, nil
}

func ResolveAddress(c *Context) (interface{}, error) {
	id := c.req.PathValue("id")

	if id == "" {
		return nil, apperror.NewError("missing address ID")
	}

	var record model.Record
	err := database.Execute(func(db *gorm.DB) error {
		return db.Where("id = ?", id).First(&record).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to resolve address").AddError(err)
	}

	resolver := dns.NewDNSResolver()
	domain := resolver.BuildDomain(&record)
	return resolver.Resolve(domain)
}

func streamResolveAddress(c *Context) (interface{}, error) {
	id := c.req.PathValue("id")

	if id == "" {
		return nil, apperror.NewError("missing address ID")
	}

	var record model.Record
	err := database.Execute(func(db *gorm.DB) error {
		return db.Where("id = ?", id).First(&record).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to resolve address").AddError(err)
	}

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			return nil, nil
		}

		resolver := dns.NewDNSResolver()
		domain := resolver.BuildDomain(&record)
		resolution, err := resolver.Resolve(domain)
		if err != nil {
			return nil, apperror.Wrap(err)
		}

		err = c.conn.WriteJSON(resolution)
		if err != nil {
			return nil, apperror.Wrap(err)
		}
	}
}
