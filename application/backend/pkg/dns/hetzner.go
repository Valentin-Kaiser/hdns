package dns

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/go-core/version"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

const (
	hetznerBaseURL = "https://dns.hetzner.com/api/v1"
)

type client struct {
	APIToken string
}

type Record struct {
	ID     string `json:"id"`
	ZoneID string `json:"zone_id"`
	Type   string `json:"type"`
	Name   string `json:"name"`
	Value  string `json:"value"`
	TTL    uint32 `json:"ttl"`
	Error  string `json:"error"`
}

type Zone struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	RecordsCount int    `json:"records_count"`
}

func UpdateRecord(r *model.Record, addr *model.Address) error {
	err := updateHetzner(r, addr.IP)
	if err != nil {
		return apperror.Wrap(err)
	}
	log.Info().Msgf("DNS record %s.%s updated successfully", r.Name, r.Domain)

	r.AddressID = &addr.ID
	r.Address = addr
	err = database.Execute(func(db *gorm.DB) error {
		return db.Save(&r).Error
	})
	if err != nil {
		return apperror.NewErrorf("failed to update DNS record %s.%s in database", r.Name, r.Domain).AddError(err)
	}

	return nil
}

func FetchZones(token string) ([]Zone, error) {
	c := &client{APIToken: token}
	url := hetznerBaseURL + "/zones"
	body, err := c.fetch(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	var res struct {
		Zones []Zone `json:"zones"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, apperror.NewError("unmarshal response failed").AddError(err)
	}
	if res.Error != "" {
		return nil, apperror.NewError("zones not found").AddError(apperror.NewError(res.Error))
	}
	return res.Zones, nil
}

func updateHetzner(r *model.Record, ip string) error {
	c := &client{APIToken: r.Token.String()}
	rec, found, err := c.findRecord(r.ZoneID, r.Name)
	if err != nil {
		return apperror.Wrap(err)
	}
	if !found {
		newRecord := &Record{
			ZoneID: r.ZoneID,
			Type:   string(r.Type),
			Name:   r.Name,
			TTL:    r.TTL,
			Value:  ip,
		}
		err = c.createRecord(newRecord)
		if err != nil {
			return apperror.Wrap(err)
		}
	}

	if found {
		rec.Value = ip
		rec.TTL = r.TTL
		err = c.updateRecord(rec)
		if err != nil {
			return apperror.Wrap(err)
		}
	}

	r.LastUpdate = time.Now()
	return nil
}

func (c *client) updateRecord(record *Record) error {
	data, err := json.Marshal(record)
	if err != nil {
		return apperror.NewError("marshaling the update record failed").AddError(err)
	}
	url := hetznerBaseURL + "/records/" + record.ID
	body, err := c.fetch(http.MethodPut, url, data)
	if err != nil {
		return apperror.NewError("updating the record failed").AddError(err)
	}
	return c.handleAPIResponse(body, "update")
}

func (c *client) createRecord(record *Record) error {
	if err := c.validateRecord(record); err != nil {
		return err
	}
	data, err := json.Marshal(record)
	if err != nil {
		return apperror.NewError("marshaling the create record failed").AddError(err)
	}
	body, err := c.fetch(http.MethodPost, hetznerBaseURL+"/records", data)
	if err != nil {
		return err
	}
	return c.handleAPIResponse(body, "create")
}

func (c *client) findRecord(zoneID, recordName string) (*Record, bool, error) {
	url := fmt.Sprintf("%s?zone_id=%s&name=%s", hetznerBaseURL+"/records", zoneID, recordName)
	body, err := c.fetch(http.MethodGet, url, nil)
	if err != nil {
		return nil, false, err
	}
	var res struct {
		Records []Record `json:"records"`
		Error   string   `json:"error"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, false, apperror.NewError("unmarshal response failed").AddError(err)
	}
	if res.Error != "" {
		return nil, false, apperror.NewError("record not found").AddError(apperror.NewError(res.Error))
	}
	if len(res.Records) == 0 {
		return nil, false, nil
	}
	return &res.Records[0], true, nil
}

func (c *client) fetch(method, url string, body []byte) ([]byte, error) {
	req, err := http.NewRequest(method, url, bytes.NewReader(body))
	if err != nil {
		return nil, apperror.NewError("creating HTTP request failed").AddError(err)
	}
	req.Header.Set("User-Agent", "hdns/"+version.GitTag)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Auth-API-Token", c.APIToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, apperror.NewError("sending HTTP request failed").AddError(err)
	}
	defer apperror.Catch(resp.Body.Close, "failed to close response body")
	if resp.StatusCode != http.StatusOK {
		return nil, apperror.NewErrorf("HTTP request failed with status %d: %s", resp.StatusCode, http.StatusText(resp.StatusCode))
	}
	return io.ReadAll(resp.Body)
}

func (c *client) validateRecord(r *Record) error {
	switch {
	case r.ZoneID == "":
		return apperror.NewError("zone ID is required")
	case r.Type == "":
		return apperror.NewError("record type is required")
	case r.Name == "":
		return apperror.NewError("record name is required")
	case r.Value == "":
		return apperror.NewError("record value is required")
	}
	return nil
}

func (c *client) handleAPIResponse(body []byte, action string) error {
	var r Record
	err := json.Unmarshal(body, &r)
	if err != nil {
		return apperror.NewErrorf("unmarshal response for %s action failed", action).AddError(err)
	}
	if r.Error != "" {
		return apperror.NewError("API error occured").AddError(apperror.NewError(r.Error))
	}
	return nil
}
