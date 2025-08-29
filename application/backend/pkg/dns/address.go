package dns

import (
	"io"
	"net"
	"net/http"
	"strings"

	"github.com/Valentin-Kaiser/go-core/apperror"
	"github.com/Valentin-Kaiser/go-core/database"
	"github.com/Valentin-Kaiser/go-core/version"
	"github.com/Valentin-Kaiser/hdns/pkg/model"
	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

var (
	resolvers = []string{
		"https://nms.intellitrend.de",
		"https://api.ipify.org",
		"https://api.my-ip.io/ip",
		"https://api.ipy.ch",
		"https://ident.me/",
		"https://ifconfig.me/ip",
		"https://icanhazip.com/",
	}
)

func UpdateAddress() (*model.Address, error) {
	ip, err := getPublicIP()
	if err != nil {
		return nil, apperror.Wrap(err)
	}
	addr := &model.Address{
		IP: ip,
	}
	err = database.Execute(func(db *gorm.DB) error {
		return db.FirstOrCreate(&addr, model.Address{IP: ip}).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to save public IP address to database").AddError(err)
	}
	err = database.Execute(func(db *gorm.DB) error {
		err := db.Model(&model.Address{}).Where("current = ?", true).Update("current", false).Error
		if err != nil {
			return apperror.NewError("failed to update current address in database").AddError(err)
		}

		return db.Model(addr).Update("current", true).Error
	})
	if err != nil {
		return nil, apperror.NewError("failed to update current address in database").AddError(err)
	}
	return addr, nil
}

func getPublicIP() (string, error) {
	for _, r := range resolvers {
		addr, err := resolveIPAddress(r)
		if err != nil {
			log.Error().Err(err).Msgf("resolver %s failed", r)
			continue
		}
		log.Info().Msgf("[DNS] resolved public IP: %s using resolver %s", addr, r)
		return addr, nil
	}
	return "", apperror.NewError("failed to resolve public IP address using all resolvers")
}

func resolveIPAddress(url string) (string, error) {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", apperror.NewErrorf("failed to create request for %s", url).AddError(err)
	}
	req.Header.Set("User-Agent", "hdns/"+version.GitTag)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", apperror.NewErrorf("failed to get public IP from %s", url).AddError(err)
	}
	defer apperror.Catch(resp.Body.Close, "failed to close response body")
	bytes, err := io.ReadAll(io.LimitReader(resp.Body, 15))
	if err != nil {
		return "", apperror.NewErrorf("failed to read response from %s", url).AddError(err)
	}
	addr := strings.TrimSpace(string(bytes))
	if !ValidateAddress(addr) {
		return "", apperror.NewErrorf("invalid IP address %s from %s", addr, url)
	}
	return addr, nil
}

func ValidateAddress(ip string) bool {
	addr := net.ParseIP(ip)
	if addr == nil {
		return false
	}
	if addr.IsUnspecified() {
		return false
	}
	if addr.IsPrivate() {
		return false
	}
	if addr.IsLoopback() {
		return false
	}
	if addr.IsMulticast() {
		return false
	}
	if addr.To4() == nil {
		return false
	}
	return true
}
