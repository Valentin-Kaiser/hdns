package main

import (
	"fmt"
	"os"
	"syscall"
	"time"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/go-core/flag"
	"github.com/Valentin-Kaiser/go-core/interruption"
	"github.com/Valentin-Kaiser/go-core/version"
	"github.com/Valentin-Kaiser/go-core/web"
	"github.com/Valentin-Kaiser/go-core/zlog"
	"github.com/Valentin-Kaiser/hdns/pkg/config"
	"github.com/Valentin-Kaiser/hdns/pkg/dns"
	"github.com/Valentin-Kaiser/hdns/pkg/service"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func init() {
	defer interruption.Catch()
	apperror.ErrorHandler = func(err error, msg string) {
		log.Error().Err(err).Msg(msg)
	}

	config.Init()
	zlog.Logger().WithConsole().WithLogFile().Init("hdns", zerolog.Level(config.Get().Service.LogLevel))
	config.OnChange(func(c *config.ServerConfig) error {
		zlog.Logger().SetLevel(zerolog.Level(c.Service.LogLevel))
		database.Reconnect()
		err := web.Instance().Restart()
		if err != nil {
			log.Error().Err(err).Msg("[Service] web server failed to restart")
		}
		dns.Restart()
		return nil
	})
}

func main() {
	defer interruption.Catch()

	if flag.Help {
		flag.Print()
		return
	}

	if flag.Version {
		fmt.Print(version.String())
		return
	}

	log.Info().Msgf("=== Hetzner DynDNS %s ===", version.String())
	if flag.Debug {
		log.Debug().Msg("[Init] running in debug mode")
		log.Debug().Msgf("[App] data path: %s", flag.Path)
		log.Debug().Msgf("[Git] git tag: %s", version.GitTag)
		log.Debug().Msgf("[Git] git commit: %s", version.GitCommit)
		log.Debug().Msgf("[Git] git short: %s", version.GitShort)
		log.Debug().Msgf("[Git] build date: %s", version.BuildDate)
		log.Debug().Msgf("[Runtime] version: %s %s", version.GoVersion, version.Platform)

		for _, mod := range version.Modules {
			log.Debug().Msgf("[Module] %s %s %s", mod.Path, mod.Version, mod.Sum)
		}
	}

	go database.Connect(time.Second, config.Get().Database)
	go service.Start()
	database.AwaitConnection()
	dns.Start()

	ctx := interruption.OnSignal([]func() error{
		database.Disconnect,
		web.Instance().Stop,
		func() error {
			log.Info().Msg("[Service] service stopped gracefully")
			return nil
		},
	}, os.Interrupt, syscall.SIGTERM)
	interruption.WaitForShutdown(ctx)
}
