//go:build windows

package ai

import (
	"os/exec"
	"syscall"
)

// hideWindow 让子进程在后台静默运行（Windows 平台）。
//
// 说明：Go 的 SysProcAttr.HideWindow 在 Windows 上会自动附加 CREATE_NO_WINDOW，
// 足以避免弹窗。这里刻意不额外设置 CreationFlags ——
// edge-tts 是 Python 程序，额外叠加 CREATE_NO_WINDOW（0x08000000）会让它的
// asyncio 事件循环与网络请求严重变慢（实测：单条音频从 3 秒变成 6 分钟）。
func hideWindow(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.HideWindow = true
}
