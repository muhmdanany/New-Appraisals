package handlers

import (
        "errors"
        "net/http"
        "strconv"
        "strings"

        "competency/internal/domain"
        "competency/internal/httpx"

        "github.com/jackc/pgconn"
)

// writeDBErr maps known Postgres errors (e.g. unique violations) to friendly
// Arabic problem responses, falling back to the generic error writer.
func writeDBErr(w http.ResponseWriter, err error) {
        var pgErr *pgconn.PgError
        if errors.As(err, &pgErr) && pgErr.Code == "23505" {
                field := pgErr.ConstraintName + " " + pgErr.Detail
                msg := "القيمة مكررة، يوجد سجل بنفس البيانات"
                if strings.Contains(strings.ToLower(field), "employeenumber") {
                        msg = "الرقم الوظيفي مستخدم مسبقًا"
                }
                httpx.Error(w, http.StatusConflict, msg)
                return
        }
        httpx.WriteErr(w, err)
}

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
