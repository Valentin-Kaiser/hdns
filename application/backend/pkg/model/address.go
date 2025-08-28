package model

type Address struct {
	BaseModel
	IP      string `gorm:"not null" json:"ip"`
	Current bool   `gorm:"default:false" json:"current"`
}
