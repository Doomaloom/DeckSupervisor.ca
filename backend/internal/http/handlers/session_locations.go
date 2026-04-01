package handlers

import "strings"

func normalizeSessionLocation(value string) string {
	return strings.TrimSpace(value)
}

func normalizeSessionLocationKey(value string) string {
	return strings.ToLower(normalizeSessionLocation(value))
}

func normalizeSessionLocations(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}

	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := normalizeSessionLocation(value)
		if trimmed == "" {
			continue
		}
		key := normalizeSessionLocationKey(trimmed)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func sessionPayloadSourceLocations(payload map[string]any) []string {
	raw, exists := payload["source_locations"]
	if !exists || raw == nil {
		return nil
	}

	switch typed := raw.(type) {
	case []string:
		return typed
	case []any:
		values := make([]string, 0, len(typed))
		for _, item := range typed {
			if value, ok := item.(string); ok {
				values = append(values, value)
			}
		}
		return values
	default:
		return nil
	}
}

func normalizeSessionPayloadLocations(payload map[string]any) {
	location, _ := payload["location"].(string)
	location = normalizeSessionLocation(location)
	if location == "" {
		payload["location"] = nil
	} else {
		payload["location"] = location
	}

	sourceLocations := normalizeSessionLocations(sessionPayloadSourceLocations(payload))
	if len(sourceLocations) == 0 && location != "" {
		sourceLocations = []string{location}
	}
	payload["source_locations"] = sourceLocations
}

func effectiveSessionSourceLocations(location *string, sourceLocations []string) []string {
	normalized := normalizeSessionLocations(sourceLocations)
	if len(normalized) > 0 {
		return normalized
	}
	if location == nil {
		return []string{}
	}
	trimmed := normalizeSessionLocation(*location)
	if trimmed == "" {
		return []string{}
	}
	return []string{trimmed}
}
