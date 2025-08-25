package api

import (
	"encoding/json"
	"os"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/zlog"
	"github.com/Valentin-Kaiser/hdns/pkg/config"
)

func init() {
	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/object/config",
		}, map[string]Handler{
			"GET": GetConfig,
			"PUT": UpdateConfig,
			"OPTIONS": func(context *Context) (interface{}, error) {
				return nil, nil
			},
		})

	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/object/log",
		}, map[string]Handler{
			"GET": GetLog,
		})
}

func GetConfig(c *Context) (interface{}, error) {
	return config.Get().Service, nil
}

func UpdateConfig(c *Context) (interface{}, error) {
	var newConfig config.ServiceConfig
	err := json.NewDecoder(c.req.Body).Decode(&newConfig)
	if err != nil {
		return nil, apperror.NewError("failed to decode request body").AddError(err)
	}
	err = newConfig.Validate()
	if err != nil {
		return nil, apperror.NewError("invalid configuration").AddError(err)
	}
	cfg := config.Get()
	cfg.Service = newConfig
	err = config.Write(&cfg)
	if err != nil {
		return nil, apperror.NewError("failed to save configuration").AddError(err)
	}
	return config.Get().Service, nil
}

func GetLog(c *Context) (interface{}, error) {
	content, err := os.ReadFile(zlog.Logger().GetFile().Filename)
	if err != nil {
		return nil, apperror.NewError("failed to read log file").AddError(err)
	}
	return string(content), nil
}
