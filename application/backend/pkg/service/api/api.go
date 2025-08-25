package api

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

var (
	mutex     = &sync.RWMutex{}
	endpoints = make(map[string]*Endpoint)
)

type Context struct {
	// Context is the context of a Endpoint
	// It contains the request and the response writer
	// It can contains other opional data
	// like the user, the session, or a websocket connection
	req  *http.Request
	resp http.ResponseWriter
	conn *websocket.Conn
	// other optional data
	info map[string]any
}

type Endpoint struct {
	endpointType     EndpointTransport
	endpointEncoding EndpointEncoding
	patterns         []string
	handler          map[string]Handler
}

type EndpointTransport int

const (
	EndpointTransportNone EndpointTransport = iota
	EndpointTransportWebsocket
	EndpointTransportHTTP
)

type EndpointEncoding int

const (
	EndpointEncodingNone EndpointEncoding = iota
	EndpointEncodingRaw
	EndpointEncodingJSON
	EndpointEncodingXML
	EndpointEncodingProtobuf
)

type Handler func(context *Context) (interface{}, error)

func init() {
	RegisterEndpoint(
		EndpointTransportHTTP,
		EndpointEncodingJSON,
		[]string{
			"/api/info",
		},
		map[string]Handler{
			"GET": func(c *Context) (interface{}, error) {
				return map[string]any{"status": database.Connected()}, nil
			},
			"OPTIONS": func(c *Context) (interface{}, error) {
				// returns the patterns for the endpoints and the allowed methods
				mutex.RLock()
				defer mutex.RUnlock()
				patterns := make(map[string][]string)
				for _, endpoint := range endpoints {
					methods := []string{}
					for method := range endpoint.handler {
						methods = append(methods, method)
					}
					for _, pattern := range endpoint.patterns {
						patterns[pattern] = methods
					}
				}

				return map[string]interface{}{
					"patterns": patterns,
				}, nil
			},
		},
	)
}

func RegisterEndpoint(t EndpointTransport, enconding EndpointEncoding, pattern []string, handler map[string]Handler) {
	if len(pattern) == 0 {
		panic("pattern cannot be empty")
	}
	if handler == nil {
		panic("handler cannot be nil")
	}

	endpoint := &Endpoint{
		endpointType:     t,
		endpointEncoding: enconding,
		patterns:         pattern,
		handler:          handler,
	}

	mutex.Lock()
	defer mutex.Unlock()
	for _, p := range pattern {
		endpoints[p] = endpoint
	}
}

func LoadEndpoints(t EndpointTransport) map[string]*Endpoint {
	mutex.Lock()
	defer mutex.Unlock()

	loadedEndpoints := make(map[string]*Endpoint)
	for path, endpoint := range endpoints {
		if endpoint.endpointType != t {
			continue
		}
		loadedEndpoints[path] = endpoint
	}
	return loadedEndpoints
}

func (e *Endpoint) HandleHTTP(w http.ResponseWriter, r *http.Request) {
	handler, ok := e.handler[r.Method]
	if !ok {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	resp, err := handler(&Context{
		req:  r,
		resp: w,
		conn: nil,
		info: make(map[string]any),
	})
	if err != nil {
		log.Error().Err(err).Msg("an api error occurred")
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	data, err := json.Marshal(resp)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_, err = w.Write(data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (e *Endpoint) HandleWebsocket(w http.ResponseWriter, r *http.Request, conn *websocket.Conn) {
	defer conn.Close()
	handler, ok := e.handler["WS"]
	if !ok {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	for {
		resp, err := handler(&Context{
			req:  r,
			resp: w,
			conn: conn,
			info: make(map[string]any),
		})
		if err != nil {
			werr := conn.WriteMessage(websocket.TextMessage, []byte(err.Error()))
			if werr != nil {
				log.Error().Err(werr).Msg("error writing message")
				return
			}
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if resp != nil {
			w.Header().Set("Content-Type", "application/json")
			data, err := json.Marshal(resp)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			_, err = w.Write(data)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			return
		}
	}
}
