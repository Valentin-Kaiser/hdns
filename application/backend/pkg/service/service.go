package service

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"strings"

	"github.com/Valentin-Kaiser/go-core/interruption"
	"github.com/Valentin-Kaiser/go-core/web"
	"github.com/Valentin-Kaiser/hdns/pkg/config"
	"github.com/Valentin-Kaiser/hdns/pkg/service/api"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

//go:embed static
var static embed.FS

func Start() {
	defer interruption.Catch()

	frontend, err := fs.Sub(static, "static")
	if err != nil {
		log.Error().Err(err).Msg("[Service] failed to create frontend file system")
		return
	}

	done := make(chan error, 1)
	s := web.Instance().
		WithHost("").
		WithPort(config.Get().Service.WebPort).
		WithSecurityHeaders().
		WithCORSHeaders().
		WithGzip().
		WithLog().
		WithErrorLog().
		WithFS([]string{"/"}, frontend).
		WithWebsocket("/ws", func(w http.ResponseWriter, r *http.Request, conn *websocket.Conn) {
			defer conn.Close()
		})

	for _, code := range web.ErrorCodes {
		s.WithOnHTTPCode(code, []string{"/"}, handleHTTPError)
		s.WithOnHTTPCode(code, []string{"/api/"}, handleAPIError)
	}

	for path, endpoint := range api.LoadEndpoints(api.EndpointTransportHTTP) {
		s.WithHandlerFunc(path, endpoint.HandleHTTP)
	}

	for path, endpoint := range api.LoadEndpoints(api.EndpointTransportWebsocket) {
		s.WithWebsocket(path, endpoint.HandleWebsocket)
	}

	s.StartAsync(done)

	if err := <-done; err != nil {
		log.Error().Err(err).Msg("[Service] web server failed")
	}
}

func handleHTTPError(w http.ResponseWriter, r *http.Request) {
	rw, ok := w.(*web.ResponseWriter)
	if !ok {
		log.Error().Msg("[Service] failed to cast ResponseWriter to web.ResponseWriter")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	rw.Header().Set("Content-Type", "text/html")

	temp := `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>%d %s</title>
  <style>
	html, body {
      margin: 0;
      padding: 0;
      height: 100%%;
	  width: 100%%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: sans-serif;
      background-color: #f8f9fa;
    }

    h1 {
      font-size: 5rem;
      color: #6c757d;
      margin: 0;
    }

    p {
      font-size: 1.5rem;
      color: #343a40;
      margin-top: 1rem;
      text-align: center;
      max-width: 80%%;
    }
  </style>
</head>
<body>
	<h1>%d</h1>
	<p>%s</p>
</body>
</html>`

	_, err := rw.Write([]byte(fmt.Sprintf(temp, rw.Status(), http.StatusText(rw.Status()), rw.Status(), http.StatusText(rw.Status()))))
	if err != nil {
		log.Error().Err(err).Msg("[Service] failed to write error response")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}

func handleAPIError(w http.ResponseWriter, r *http.Request) {
	rw, ok := w.(*web.ResponseWriter)
	if !ok {
		log.Error().Msg("[Service] failed to cast ResponseWriter to web.ResponseWriter")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	rw.Header().Set("Content-Type", "application/json")
	response := map[string]string{
		"code":  fmt.Sprintf("%d", rw.Status()),
		"error": http.StatusText(rw.Status()),
	}

	history := rw.History()
	if len(history) > 0 {
		response["message"] = strings.Trim(string(history[len(history)-1]), "\n")
	}

	data, err := json.Marshal(response)
	if err != nil {
		log.Error().Err(err).Msg("[Service] failed to marshal error response")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	_, err = rw.Write(data)
	if err != nil {
		log.Error().Err(err).Msg("[Service] failed to write error response")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
}
