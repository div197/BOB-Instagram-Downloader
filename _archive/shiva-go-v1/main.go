// Command shiva is the ultra-tiny L1 extractor (stdlib only, no third-party deps).
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

var (
	dataSJSRe = regexp.MustCompile(`<script[^>]*data-sjs[^>]*>(.*?)</script>`)
	shortRe   = regexp.MustCompile(`instagram\.com/(?:[A-Za-z0-9_.]+/)?(p|reel|reels|tv)/([A-Za-z0-9_\-]{8,})`)

	mu    sync.Mutex
	cache = map[string]cacheEntry{}
)

const maxCacheKeys = 10000
const cacheTTL = 6 * time.Hour

type cacheEntry struct {
	expires time.Time
	body    []byte
}

type Media struct {
	Shortcode string `json:"shortcode"`
	Owner     string `json:"owner"`
	Caption   string `json:"caption"`
	VideoURL  string `json:"video_url"`
	Thumb     string `json:"thumbnail"`
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

// parseXIG finds xig_polaris_media via recursive walk (signature, not path).
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
	// duration from DASH
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

func cachedGET(shortcode string) ([]byte, bool) {
	mu.Lock()
	defer mu.Unlock()
	e, ok := cache[shortcode]
	if !ok || time.Now().After(e.expires) {
		delete(cache, shortcode)
		return nil, false
	}
	return e.body, true
}
func cachePut(shortcode string, body []byte) {
	mu.Lock()
	defer mu.Unlock()
	if len(cache) >= maxCacheKeys {
		// evict expired first, else arbitrary one (LRU approx: oldest write)
		for k, e := range cache {
			if time.Now().After(e.expires) {
				delete(cache, k)
			}
		}
	}
	cache[shortcode] = cacheEntry{expires: time.Now().Add(cacheTTL), body: body}
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func fetchIG(shortcode string) ([]byte, string) {
	client := &http.Client{Timeout: 25 * time.Second, Transport: &http.Transport{MaxIdleConnsPerHost: 10}}
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodGet, "https://www.instagram.com/p/"+shortcode+"/", nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://www.instagram.com/")
	req.Header.Set("Accept", "text/html,application/xhtml+xml")
	resp, err := client.Do(req)
	if err != nil {
		return nil, "EXTRACTION_FAILED: " + err.Error()
	}
	defer resp.Body.Close()
	if resp.StatusCode == 429 {
		return nil, "SOURCE_RATE_LIMITED"
	}
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return nil, "PRIVATE"
	}
	body := make([]byte, 0, 1<<20)
	buf := make([]byte, 32768)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			body = append(body, buf[:n]...)
			// cap 8 MB — reel HTML is ~1 MB, no point buffering more
			if len(body) > 8<<20 {
				break
			}
		}
		if err != nil {
			break
		}
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

// iOS fallback: same-origin stream so <a download> honors the attribute.
// Usage: /proxy?u=<encoded-cdn-url>&name=bob-reel.mp4
func handleProxy(w http.ResponseWriter, r *http.Request) {
	u := r.URL.Query().Get("u")
	name := r.URL.Query().Get("name")
	if u == "" || !(strings.HasPrefix(u, "https://")) {
		http.Error(w, "INVALID_URL", 400)
		return
	}
	if name == "" {
		name = "bob-reel.mp4"
	}
	client := &http.Client{Timeout: 120 * time.Second}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, u, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0")
	req.Header.Set("Referer", "https://www.instagram.com/")
	if rg := r.Header.Get("Range"); rg != "" {
		req.Header.Set("Range", rg)
	}
	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, "MEDIA_UNAVAILABLE", 502)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", resp.Header.Get("Content-Type"))
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename=%q`, name))
	if cl := resp.Header.Get("Content-Length"); cl != "" {
		w.Header().Set("Content-Length", cl)
	}
	if cr := resp.Header.Get("Content-Range"); cr != "" {
		w.Header().Set("Content-Range", cr)
	}
	w.WriteHeader(resp.StatusCode)
	io.CopyBuffer(w, resp.Body, make([]byte, 65536))
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
	mux.HandleFunc("/proxy", handleProxy)
	log.Printf("shiva listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, withCORS(mux)))
}
