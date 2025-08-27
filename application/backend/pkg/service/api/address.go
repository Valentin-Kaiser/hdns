package api

import (
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
			"/api/object/record/history",
		}, map[string]Handler{
			"GET":    GetRecordHistory,
			"DELETE": DeleteRecordHistory,
			"OPTIONS": func(context *Context) (interface{}, error) {
				return nil, nil
			},
		})

	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/object/record/{id}/history",
		}, map[string]Handler{
			"GET": GetRecordHistoryByID,
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

// GetRecordHistory retrieves the DNS record resolution history for all records
func GetRecordHistory(c *Context) (interface{}, error) {
	var history []model.RecordHistory
	err := database.Execute(func(db *gorm.DB) error {
		return db.Preload("Record").Preload("Address").
			Order("resolved_at DESC").
			Find(&history).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to fetch record history").AddError(err)
	}

	return history, nil
}

// GetRecordHistoryByID retrieves the DNS record resolution history for a specific record
func GetRecordHistoryByID(c *Context) (interface{}, error) {
	recordID := c.req.PathValue("id")
	if recordID == "" {
		return nil, apperror.NewError("record ID is required")
	}

	var history []model.RecordHistory
	err := database.Execute(func(db *gorm.DB) error {
		return db.Preload("Record").Preload("Address").
			Where("record_id = ?", recordID).
			Order("resolved_at DESC").
			Find(&history).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to fetch record history").AddError(err)
	}

	return history, nil
}

// DeleteRecordHistory deletes DNS record resolution history
func DeleteRecordHistory(c *Context) (interface{}, error) {
	var history []model.RecordHistory
	err := database.Execute(func(db *gorm.DB) error {
		return db.Find(&history).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to fetch record history").AddError(err)
	}

	if len(history) == 0 {
		return nil, apperror.NewError("no record history to delete")
	}

	err = database.Execute(func(db *gorm.DB) error {
		return db.Delete(&history).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to delete record history").AddError(err)
	}

	return map[string]any{"deleted": len(history)}, nil
}
