// Package curriculum contains supported lesson-plan levels generated from Rectab.
package curriculum

import (
	"embed"
	"encoding/json"
)

//go:embed levels.json
var assets embed.FS

var supported = func() map[string]bool {
	data, err := assets.ReadFile("levels.json")
	if err != nil {
		panic(err)
	}
	var levels []string
	if err := json.Unmarshal(data, &levels); err != nil {
		panic(err)
	}
	result := make(map[string]bool, len(levels))
	for _, id := range levels {
		result[id] = true
	}
	return result
}()

func SupportsLevel(id string) bool { return supported[id] }
