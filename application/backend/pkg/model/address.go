package model

type Address struct {
	BaseModel
	IP string `gorm:"uniqueIndex;not null" json:"ip"`
}
