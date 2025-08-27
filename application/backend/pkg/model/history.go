package model

import "time"

type RecordHistory struct {
	BaseModel
	RecordID   uint64    `gorm:"not null;index" json:"record_id"`
	Record     *Record   `gorm:"foreignKey:RecordID" json:"record,omitempty"`
	AddressID  uint64    `gorm:"not null" json:"address_id"`
	Address    *Address  `gorm:"foreignKey:AddressID" json:"address,omitempty"`
	ResolvedIP string    `gorm:"not null" json:"resolved_ip"`
	ResolvedAt time.Time `gorm:"not null" json:"resolved_at"`
}
