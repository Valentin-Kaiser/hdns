package api

import (
	"encoding/json"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/hdns/pkg/dns"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

func init() {
	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/object/record",
		}, map[string]Handler{
			"GET":    GetRecord,
			"POST":   CreateRecord,
			"PUT":    UpdateRecord,
			"DELETE": DeleteRecord,
			"OPTIONS": func(context *Context) (interface{}, error) {
				return nil, nil
			},
		})

	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/action/refresh/record/{id}",
		}, map[string]Handler{
			"GET": RefreshRecord,
			"OPTIONS": func(context *Context) (interface{}, error) {
				return nil, nil
			},
		})
}

func RefreshRecord(c *Context) (interface{}, error) {
	id := c.req.PathValue("id")
	if id == "" {
		return nil, apperror.NewError("record ID is required")
	}
	var record model.Record
	err := database.Execute(func(db *gorm.DB) error {
		return db.First(&record, id).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to find record").AddError(err)
	}
	address, err := dns.UpdateAddress()
	if err != nil {
		return nil, apperror.Wrap(err)
	}
	err = dns.UpdateRecord(&record, address)
	if err != nil {
		return nil, apperror.Wrap(err)
	}
	log.Info().Msgf("DNS record %s refreshed successfully", record.Name)
	return record, nil
}

func GetRecord(c *Context) (interface{}, error) {
	var records []model.Record
	err := database.Execute(func(db *gorm.DB) error {
		return db.Preload("Address").Find(&records).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to find records").AddError(err)
	}
	return records, nil
}

func CreateRecord(c *Context) (interface{}, error) {
	var record model.Record
	err := json.NewDecoder(c.req.Body).Decode(&record)
	if err != nil {
		return nil, apperror.NewError("failed to decode request body").AddError(err)
	}

	err = record.Validate()
	if err != nil {
		return nil, apperror.Wrap(err)
	}

	err = database.Execute(func(db *gorm.DB) error {
		return db.Create(&record).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to create record").AddError(err)
	}

	return record, nil
}

func UpdateRecord(c *Context) (interface{}, error) {
	id := c.req.PathValue("id")
	if id == "" {
		return nil, apperror.NewError("record ID is required")
	}

	var record model.Record
	err := json.NewDecoder(c.req.Body).Decode(&record)
	if err != nil {
		return nil, apperror.NewError("failed to decode request body").AddError(err)
	}
	err = record.Validate()
	if err != nil {
		return nil, apperror.Wrap(err)
	}

	err = database.Execute(func(db *gorm.DB) error {
		return db.Model(&model.Record{}).Where("id = ?", id).Updates(record).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to update record").AddError(err)
	}

	return record, nil
}

func DeleteRecord(c *Context) (interface{}, error) {
	id := c.req.PathValue("id")
	if id == "" {
		return nil, apperror.NewError("record ID is required")
	}

	err := database.Execute(func(db *gorm.DB) error {
		return db.Delete(&model.Record{}, id).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to delete record").AddError(err)
	}

	return nil, nil
}
