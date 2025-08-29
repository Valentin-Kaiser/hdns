package model

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"time"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/flag"
	"github.com/Valentin-Kaiser/go-core/security"
)

type Record struct {
	BaseModel
	Token      Token     `gorm:"uniqueIndex;not null" json:"token"`
	ZoneID     string    `gorm:"not null" json:"zone_id"`
	Domain     string    `gorm:"not null" json:"domain"`
	Name       string    `gorm:"not null" json:"name"`
	TTL        uint32    `gorm:"not null" json:"ttl"`
	AddressID  *uint64   `json:"address_id,omitempty"`
	Address    *Address  `gorm:"foreignKey:AddressID" json:"address,omitempty"`
	LastUpdate time.Time `gorm:"not null" json:"last_update"`
}

type Token string

func (r *Record) Validate() error {
	if strings.TrimSpace(r.Token.String()) == "" {
		return apperror.NewError("token is required")
	}
	if strings.TrimSpace(r.ZoneID) == "" {
		return apperror.NewError("zone_id is required")
	}
	if strings.TrimSpace(r.Domain) == "" {
		return apperror.NewError("domain is required")
	}
	if strings.TrimSpace(r.Name) == "" {
		return apperror.NewError("name is required")
	}
	return nil
}

func (t Token) MarshalJSON() ([]byte, error) {
	return []byte(`"` + string(t) + `"`), nil
}

func (t *Token) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	*t = Token(s)
	return nil
}

func (t Token) Value() (driver.Value, error) {
	if t == "" {
		return nil, nil
	}

	passphrase, err := security.ReadOrSavePassphrase(filepath.Join(flag.Path, ".key"), 32)
	if err != nil {
		return nil, apperror.Wrap(err)
	}

	var buf bytes.Buffer
	err = security.NewAesCipher().WithPassphrase(passphrase).Encrypt(string(t), &buf).Error
	if err != nil {
		return nil, apperror.Wrap(err)
	}

	return buf.String(), nil
}

func (t *Token) Scan(value interface{}) error {
	if value == nil {
		*t = ""
		return nil
	}

	var s string
	switch v := value.(type) {
	case []byte:
		s = string(v)
	case string:
		s = v
	default:
		return errors.New("failed to scan password")
	}

	passphrase, err := security.ReadOrSavePassphrase(filepath.Join(flag.Path, ".key"), 32)
	if err != nil {
		return apperror.Wrap(err)
	}

	var buf bytes.Buffer
	err = security.NewAesCipher().WithPassphrase(passphrase).Decrypt(s, &buf).Error
	if err != nil {
		return apperror.Wrap(err)
	}

	*t = Token(buf.String())
	return nil
}

func (t Token) String() string {
	return string(t)
}
