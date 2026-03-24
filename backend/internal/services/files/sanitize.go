package files

import "strings"

func SanitizeFilename(input string) string {
	const fallback = "sheet"
	clean := strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' {
			return r
		}
		if r >= 'A' && r <= 'Z' {
			return r
		}
		if r >= '0' && r <= '9' {
			return r
		}
		if r == '-' || r == '_' {
			return r
		}
		if r == ' ' {
			return '-'
		}
		return -1
	}, input)
	clean = strings.Trim(clean, "-_")
	if clean == "" {
		return fallback
	}
	return clean
}
