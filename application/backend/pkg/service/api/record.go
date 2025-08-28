package api

import (
	"encoding/json"
	"errors"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/hdns/pkg/dns"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func init() {
	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/object/record",
			"/api/object/record/{id}",
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
		EndpointTransportWebsocket,
		EndpointEncodingJSON,
		[]string{
			"/api/stream/record",
		}, map[string]Handler{
			"WS": streamRecord,
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
	log.Info().Msgf("DNS record %s.%s refreshed successfully", record.Name, record.Domain)
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

func streamRecord(c *Context) (interface{}, error) {
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			return nil, nil
		}

		var records []model.Record
		err = database.Execute(func(db *gorm.DB) error {
			err := db.Preload(clause.Associations).Find(&records).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			return nil
		})
		if err != nil {
			return nil, apperror.NewError("failed to get address").AddError(err)
		}

		err = c.conn.WriteJSON(records)
		if err != nil {
			return nil, apperror.Wrap(err)
		}
	}
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

	var existingRecord model.Record
	err = database.Execute(func(db *gorm.DB) error {
		return db.Where("name = ? AND zone_id = ? AND type = ?", record.Name, record.ZoneID, record.Type).First(&existingRecord).Error
	})
	if err == nil {
		return nil, apperror.NewError("a record with the same name, zone ID, and type already exists")
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
	var record model.Record
	err := json.NewDecoder(c.req.Body).Decode(&record)
	if err != nil {
		return nil, apperror.NewError("failed to decode request body").AddError(err)
	}
	err = record.Validate()
	if err != nil {
		return nil, apperror.Wrap(err)
	}
	if record.ID == 0 {
		return nil, apperror.NewError("record ID is required")
	}

	var existingRecord model.Record
	err = database.Execute(func(db *gorm.DB) error {
		return db.Where("name = ? AND zone_id = ? AND type = ? AND id != ?", record.Name, record.ZoneID, record.Type, record.ID).First(&existingRecord).Error
	})
	if err == nil {
		return nil, apperror.NewError("a record with the same name, zone ID, and type already exists")
	}

	err = database.Execute(func(db *gorm.DB) error {
		return db.Model(&model.Record{}).Where("id = ?", record.ID).Updates(record).Error
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
