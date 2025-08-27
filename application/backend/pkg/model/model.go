package model

import (
	"time"

	"github.com/Valentin-Kaiser/go-core/database"
)

func init() {
	database.RegisterSchema(
		&Address{},
		&Record{},
		&RecordHistory{},
	)
}

type BaseModel struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
