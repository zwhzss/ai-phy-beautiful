//go:build !windows

package ai

import "os/exec"

// hideWindow 在非 Windows 平台无需处理（占位以保持跨平台编译）。
func hideWindow(cmd *exec.Cmd) {}
