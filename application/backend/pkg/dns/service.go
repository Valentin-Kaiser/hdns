package dns

import (
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/hdns/pkg/config"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

var job *cron.Cron

func Start() {
	job = cron.New(cron.WithSeconds())
	_, err := job.AddFunc(config.Get().Service.Refresh, Refresh)
	if err != nil {
		log.Error().Err(err).Msg("failed to add cron job for DNS refresh")
		return
	}
	job.Start()
}

func Stop() {
	ctx := job.Stop()
	<-ctx.Done()
}

func Restart() {
	Stop()
	Start()
	log.Info().Msg("[DNS] refresh cron job restarted")
}

func Refresh() {
	current, err := UpdateAddress()
	if err != nil {
		log.Error().Err(err).Msg("failed to update public IP address")
		return
	}
	var records []*model.Record
	err = database.Execute(func(db *gorm.DB) error {
		return db.Find(&records).Error
	})
	if err != nil {
		log.Error().Err(err).Msg("failed to fetch DNS records")
		return
	}
	for _, record := range records {
		rec, err := FetchRecord(record)
		if err != nil {
			log.Error().Err(err).Msgf("failed to fetch DNS record %s.%s", record.Name, record.Domain)
			continue
		}

		if rec.Value == current.IP {
			log.Info().Msgf("[DNS] record %s.%s is already up-to-date with address %s", record.Name, record.Domain, current.IP)
			continue
		}

		err = UpdateRecord(record, current)
		if err != nil {
			log.Error().Err(err).Msgf("failed to update DNS record %s.%s", record.Name, record.Domain)
		}
	}
}
