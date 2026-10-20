package handler

import (
	"context"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

const ctxUserID = "user_id"
const ctxUserRole = "user_role"

// aiTimeout 是 AI 生成/合成接口的默认超时，启动时可由配置覆盖。
var aiTimeout = 10 * time.Minute

// SetAITimeout 由路由层在启动时注入大模型调用超时。
func SetAITimeout(d time.Duration) {
	if d > 0 {
		aiTimeout = d
	}
}

// contextWithAITimeout 为 AI 调用创建独立的超时上下文。
// 客户端断开时也会取消，避免无效的长任务占用。
func contextWithAITimeout(c *gin.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(c.Request.Context(), aiTimeout)
}

// SetUserIDInContext sets the user ID in the request context (for testing/internal use)
func SetUserIDInContext(c *gin.Context, userID uint) {
	c.Set(ctxUserID, userID)
}

// GetUserIDFromContext retrieves the user ID from the request context
func getUserIDFromContext(c *gin.Context) uint {
	if v, exists := c.Get(ctxUserID); exists {
		if id, ok := v.(uint); ok {
			return id
		}
		if s, ok := v.(string); ok {
			if n, err := strconv.ParseUint(s, 10, 32); err == nil {
				return uint(n)
			}
		}
	}
	return 0
}
