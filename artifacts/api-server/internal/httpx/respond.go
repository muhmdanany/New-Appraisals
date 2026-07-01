// Package httpx provides JSON and RFC7807 problem+json response helpers.
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// Problem is an RFC 7807 problem detail.
type Problem struct {
	Type   string `json:"type,omitempty"`
	Title  string `json:"title"`
	Status int    `json:"status"`
	Detail string `json:"detail,omitempty"`
}

// JSON writes a value as application/json with the given status.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

// Error writes a problem+json error response.
func Error(w http.ResponseWriter, status int, detail string) {
	w.Header().Set("Content-Type", "application/problem+json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(Problem{
		Title:  http.StatusText(status),
		Status: status,
		Detail: detail,
	})
}

// APIError carries an HTTP status alongside a message.
type APIError struct {
	Status  int
	Message string
}

func (e *APIError) Error() string { return e.Message }

func NewError(status int, msg string) *APIError { return &APIError{Status: status, Message: msg} }

// WriteErr inspects an error and writes an appropriate problem response.
func WriteErr(w http.ResponseWriter, err error) {
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		Error(w, apiErr.Status, apiErr.Message)
		return
	}
	Error(w, http.StatusInternalServerError, "Internal server error")
}

// Decode parses a JSON request body into dst, rejecting empty/oversized bodies.
func Decode(r *http.Request, dst any) error {
	if r.Body == nil {
		return NewError(http.StatusBadRequest, "Request body is required")
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			return NewError(http.StatusBadRequest, "Request body is required")
		}
		return NewError(http.StatusBadRequest, "Invalid request body: "+err.Error())
	}
	return nil
}
