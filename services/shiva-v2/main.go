// Command shiva-v2 is the Python-free L1 extractor (Go + imroc/req ImpersonateChrome).
// Replaces Python curl_cffi: req/v3 on utls gives HelloChrome_155 + Chrome HTTP/2 + header order.
// Public posts only. No cookies, no login, no private access.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/imroc/req/v3"
)

var (
	dataSJSRe = regexp.MustCompile(`<script[^>]*data-sjs[^>]*>(.*?)</script>`)
	shortRe   = regexp.MustCompile(`instagram\.com/(?:[A-Za-z0-9_.]+/)?(p|reel|reels|tv)/([A-Za-z0-9_\-]{8,})`)

	// shared Chrome-impersonating client (keep-alive, one TLS session family)
	httpClient = newChromeClient()
	mu         sync.Mutex
	cache      = map[string]cacheEntry{}
)

func newChromeClient() *req.Client {
	c := req.C()
	c.ImpersonateChrome()
	c.SetTimeout(20 * time.Second)
	return c
}

const maxCacheKeys = 10000
const cacheTTL = 6 * time.Hour

type cacheEntry struct {
	expires time.Time
	body    []byte
}

type Media struct {
	Shortcode string  `json:"shortcode"`
	Owner     string  `json:"owner"`
	Caption   string  `json:"caption"`
	VideoURL  string  `json:"video_url"`
	Thumb     string  `json:"thumbnail"`
	Duration  float64 `json:"duration"`
}

func extractShortcode(raw string) (string, error) {
	if raw == "" {
		return "", fmt.Errorf("INVALID_URL: empty URL")
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	m := shortRe.FindStringSubmatch(raw)
	if m == nil {
		return "", fmt.Errorf("INVALID_URL: not an Instagram post/reel URL")
	}
	if len(m[2]) > 28 {
		return "", fmt.Errorf("PRIVATE: only public posts; this ID requires login")
	}
	return m[2], nil
}

func parseXIG(html string) map[string]interface{} {
	for _, script := range dataSJSRe.FindAllStringSubmatch(html, -1) {
		if !strings.Contains(script[1], "xig_polaris_media") {
			continue
		}
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(script[1]), &payload); err != nil {
			continue
		}
		if out := walkXIG(payload); out != nil {
			return out
		}
	}
	return nil
}

func walkXIG(v interface{}) map[string]interface{} {
	switch t := v.(type) {
	case map[string]interface{}:
		if inner, ok := t["xig_polaris_media"].(map[string]interface{}); ok {
			return inner
		}
		for _, val := range t {
			if out := walkXIG(val); out != nil {
				return out
			}
		}
	case []interface{}:
		for _, e := range t {
			if out := walkXIG(e); out != nil {
				return out
			}
		}
	}
	return nil
}

func parseMedia(post map[string]interface{}) Media {
	if inner, ok := post["if_not_gated_logged_out"].(map[string]interface{}); ok {
		post = inner
	}
	caption, _ := post["caption"].(map[string]interface{})["text"].(string)
	owner, _ := post["user"].(map[string]interface{})["username"].(string)
	if owner == "" {
		owner, _ = post["owner"].(map[string]interface{})["username"].(string)
	}
	vurl, _ := post["video_url"].(string)
	if vurl == "" {
		if vv, ok := post["video_versions"].([]interface{}); ok && len(vv) > 0 {
			if first, ok := vv[0].(map[string]interface{}); ok {
				vurl, _ = first["url"].(string)
			}
		}
	}
	thumb, _ := post["display_uri"].(string)
	if thumb == "" {
		thumb, _ = post["display_url"].(string)
	}
	dur := 0.0
	if dash, ok := post["video_dash_manifest"].(string); ok {
		if m := regexp.MustCompile(`mediaPresentationDuration="PT([\d.]+)S"`).FindStringSubmatch(dash); m != nil {
			fmt.Sscanf(m[1], "%f", &dur)
		}
	}
	code, _ := post["code"].(string)
	if code == "" {
		code, _ = post["shortcode"].(string)
	}
	return Media{Shortcode: code, Owner: owner, Caption: caption, VideoURL: vurl, Thumb: thumb, Duration: dur}
}

func cachedGET(sc string) ([]byte, bool) {
	mu.Lock()
	defer mu.Unlock()
	e, ok := cache[sc]
	if !ok || time.Now().After(e.expires) {
		delete(cache, sc)
		return nil, false
	}
	return e.body, true
}
func cachePut(sc string, body []byte) {
	mu.Lock()
	defer mu.Unlock()
	if len(cache) >= maxCacheKeys {
		for k, e := range cache {
			if time.Now().After(e.expires) {
				delete(cache, k)
			}
		}
	}
	cache[sc] = cacheEntry{expires: time.Now().Add(cacheTTL), body: body}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func fetchIG(shortcode string) ([]byte, string) {
	resp, err := httpClient.R().
		SetHeader("Accept", "text/html,application/xhtml+xml").
		SetHeader("Accept-Language", "en-US,en;q=0.9").
		SetHeader("Referer", "https://www.instagram.com/").
		Get("https://www.instagram.com/p/" + shortcode + "/")
	if err != nil {
		return nil, "EXTRACTION_FAILED: " + err.Error()
	}
	if resp.StatusCode == 429 {
		return nil, "SOURCE_RATE_LIMITED"
	}
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return nil, "PRIVATE"
	}
	body := []byte(resp.String())
	if len(body) > 8<<20 {
		body = body[:8<<20]
	}
	return body, ""
}

func handleExtract(w http.ResponseWriter, r *http.Request) {
	raw := r.URL.Query().Get("url")
	sc, err := extractShortcode(raw)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(400)
		fmt.Fprintf(w, `{"ok":false,"error":%q}`, err.Error())
		return
	}
	if body, ok := cachedGET(sc); ok {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.Write(body)
		return
	}
	html, errMsg := fetchIG(sc)
	if errMsg != "" {
		w.Header().Set("Content-Type", "application/json")
		code := 502
		if strings.HasPrefix(errMsg, "SOURCE_RATE_LIMITED") {
			code = 429
			w.Header().Set("Retry-After", "60")
		} else if strings.HasPrefix(errMsg, "PRIVATE") {
			code = 403
		}
		w.WriteHeader(code)
		fmt.Fprintf(w, `{"ok":false,"error":%q}`, errMsg)
		return
	}
	media := parseXIG(string(html))
	if media == nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(502)
		fmt.Fprint(w, `{"ok":false,"error":"EXTRACTION_FAILED: xig_polaris_media not found (gated or drift)"}`)
		return
	}
	out := parseMedia(media)
	out.Shortcode = sc
	body, _ := json.Marshal(map[string]interface{}{"ok": true, "media": out, "layer": "L1"})
	cachePut(sc, body)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(body)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"ok":true}`)
	})
	mux.HandleFunc("/extract", handleExtract)
	log.Printf("shiva-v2 (go+utls) listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, withCORS(mux)))
}
