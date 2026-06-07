package handlers

import (
        "net/http"
        "strconv"
        "strings"

        "competency/internal/domain"
        "competency/internal/httpx"
)

func qInt(r *http.Request, key string) int {
        v := r.URL.Query().Get(key)
        if v == "" {
                return 0
        }
        n, _ := strconv.Atoi(v)
        return n
}

func qStr(r *http.Request, key string) string {
        return strings.TrimSpace(r.URL.Query().Get(key))
}

// validateEnum writes a 400 and returns false if v is not in the set.
func validateEnum(w http.ResponseWriter, set []string, v, field string) bool {
        if !domain.InSet(set, v) {
                httpx.Error(w, http.StatusBadRequest, "Invalid value for "+field)
                return false
        }
        return true
}

func required(w http.ResponseWriter, v, field string) bool {
        if strings.TrimSpace(v) == "" {
                httpx.Error(w, http.StatusBadRequest, field+" is required")
                return false
        }
        return true
}

// emptyToNil returns nil if the pointed-to string is empty or whitespace,
// so optional/nullable fields and foreign keys aren't sent as "".
func emptyToNil(v *string) *string {
        if v == nil || strings.TrimSpace(*v) == "" {
                return nil
        }
        return v
}
