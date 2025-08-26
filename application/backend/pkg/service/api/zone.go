package api

import (
	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/hdns/pkg/dns"
)

func init() {
	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/object/zone/{token}",
		}, map[string]Handler{
			"GET": GetZone,
			"OPTIONS": func(context *Context) (interface{}, error) {
				return nil, nil
			},
		})
}

func GetZone(c *Context) (interface{}, error) {
	token := c.req.PathValue("token")
	if token == "" {
		return nil, apperror.NewError("API token is required")
	}
	return dns.FetchZones(token)
}
