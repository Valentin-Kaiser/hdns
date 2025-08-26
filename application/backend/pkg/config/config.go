package config

import (
	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/config"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/go-core/flag"
	"github.com/fsnotify/fsnotify"
	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"
)

type ServerConfig struct {
	Service  ServiceConfig
	Database database.Config
}

type ServiceConfig struct {
	LogLevel  int8   `usage:"(0 = debug, 1 = info, 2 = warn, 3 = error, 4 = fatal, 5 = panic)" json:"log_level"`
	WebPort   uint16 `usage:"Port of the web server to listen on" json:"web_port"`
	Refresh   string `usage:"Refresh interval in cron format (e.g. @every minute)" json:"refresh_interval"`
	DNSServer string `usage:"DNS server to use for lookups, e.g. 9.9.9.9:53" json:"dns_server"`
}

func Init() {
	defaultConfig := &ServerConfig{
		Service: ServiceConfig{
			LogLevel:  1,
			WebPort:   8080,
			Refresh:   "*/30 * * * * *", // every 30 seconds
			DNSServer: "9.9.9.9:53",     // DNS server for lookups
		},
		Database: database.Config{
			Driver:   "sqlite",
			Host:     "127.0.0.1",
			Port:     3306,
			User:     "hdns",
			Password: "hdns",
			Name:     "hdns",
		},
	}

	err := config.Register("hdns", defaultConfig)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to register configuration")
	}

	flag.Init()
	err = config.Read()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to read configuration")
	}

	if flag.Debug {
		watch()
	}
}

func Get() ServerConfig {
	bc, ok := config.Get().(*ServerConfig)
	if !ok {
		return ServerConfig{}
	}

	if bc == nil {
		return ServerConfig{}
	}

	return *bc
}

func Write(change *ServerConfig) error {
	return apperror.Wrap(config.Write(change))
}

func watch() {
	config.Watch(func(e fsnotify.Event) {
		log.Warn().Str("path", e.Name).Msg("configuration file changed")
		err := config.Read()
		if err != nil {
			log.Error().Err(err).Msg("failed to read configuration")
		}
	})
}

func OnChange(f func(*ServerConfig) error) {
	config.OnChange(func(c config.Config) error {
		if c == nil {
			return apperror.NewError("the configuration provided is nil")
		}

		bc, ok := c.(*ServerConfig)
		if !ok {
			return apperror.NewError("the configuration provided is not a BackendConfig")
		}

		return f(bc)
	})
}

func (c ServerConfig) Validate() error {
	if err := c.Service.Validate(); err != nil {
		return apperror.Wrap(err)
	}

	if err := c.Database.Validate(); err != nil {
		return apperror.Wrap(err)
	}

	return nil
}

func (c ServiceConfig) Validate() error {
	if c.WebPort == 0 {
		return apperror.NewError("web port must be greater than 0")
	}

	if c.Refresh == "" {
		return apperror.NewError("refresh interval is required")
	}

	_, err := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor).Parse(c.Refresh)
	if err != nil {
		return apperror.NewError("invalid cron format for refresh interval").AddError(err)
	}

	return nil
}
