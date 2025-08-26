package api

import "github.com/Valentin-Kaiser/hdns/pkg/model"

func init() {
	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/model/record",
		}, map[string]Handler{
			"GET": func(context *Context) (interface{}, error) {
				return &model.Record{}, nil
			},
		})
}
