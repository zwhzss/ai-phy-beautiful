package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Config 汇总应用的全部配置。
// 优先级：环境变量 > config.yaml > 内置默认值。
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	JWT      JWTConfig      `yaml:"jwt"`
	AI       AIConfig       `yaml:"ai"`
	Admin    AdminConfig    `yaml:"admin"`
}

type ServerConfig struct {
	Port string `yaml:"port"`
	Env  string `yaml:"env"`
	// StaticDir 为前端构建产物目录，配置后后端可直接托管 SPA（桌面端与生产部署使用）。
	StaticDir string `yaml:"static_dir"`
}

type DatabaseConfig struct {
	Path string `yaml:"path"`
}

type JWTConfig struct {
	Secret     string `yaml:"secret"`
	Expiration string `yaml:"expiration"`
}

type AIConfig struct {
	// AudioDir 存放合成的讲解音频，通过 /audio 静态路由对外提供。
	AudioDir string `yaml:"audio_dir"`
	// RequestTimeout 单次大模型调用超时（秒）。
	RequestTimeout int `yaml:"request_timeout"`
	// AutoGenerateOnSeed 预留开关：种子初始化后是否自动生成内容。
	AutoGenerateOnSeed bool `yaml:"auto_generate_on_seed"`
}

type AdminConfig struct {
	// 首次启动时自动创建的超级管理员账号（已存在则跳过）。
	Username string `yaml:"username"`
	Password string `yaml:"password"`
	Email    string `yaml:"email"`
}

// Load 读取配置：默认值 → config.yaml → 环境变量。
func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{Port: "8080", Env: "development"},
		JWT:    JWTConfig{Secret: "phy-beauty-dev-secret-change-in-production", Expiration: "720h"},
		AI:     AIConfig{AudioDir: filepath.Join("data", "audio"), RequestTimeout: 300},
		Admin:  AdminConfig{Username: "admin", Password: "admin123", Email: "admin@phy-beauty.local"},
	}

	path := getEnv("APP_CONFIG", "config.yaml")
	if err := loadYAML(path, cfg); err != nil {
		return nil, err
	}

	applyEnv(cfg)

	// 相对路径统一基于工作目录解析，保证从任意目录启动都能找到资源。
	if !filepath.IsAbs(cfg.Database.Path) {
		cwd, _ := os.Getwd()
		cfg.Database.Path = filepath.Join(cwd, cfg.Database.Path)
	}
	if !filepath.IsAbs(cfg.AI.AudioDir) {
		cwd, _ := os.Getwd()
		cfg.AI.AudioDir = filepath.Join(cwd, cfg.AI.AudioDir)
	}

	return cfg, nil
}

// RequestTimeout 返回大模型调用超时。
func (c *Config) RequestTimeoutDuration() time.Duration {
	if c.AI.RequestTimeout <= 0 {
		return 5 * time.Minute
	}
	return time.Duration(c.AI.RequestTimeout) * time.Second
}

// loadYAML 从文件加载配置；文件不存在时按默认值继续（不报错）。
func loadYAML(path string, cfg *Config) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("读取配置文件 %s 失败: %w", path, err)
	}
	if err := yaml.Unmarshal(raw, cfg); err != nil {
		return fmt.Errorf("解析配置文件 %s 失败: %w", path, err)
	}
	return nil
}

// applyEnv 用环境变量覆盖配置（容器/脚本部署场景）。
func applyEnv(cfg *Config) {
	cfg.Server.Port = getEnv("SERVER_PORT", cfg.Server.Port)
	cfg.Server.Env = getEnv("APP_ENV", cfg.Server.Env)
	cfg.Server.StaticDir = getEnv("STATIC_DIR", cfg.Server.StaticDir)

	if v := getEnv("DB_PATH", ""); v != "" {
		cfg.Database.Path = v
	}
	if cfg.Database.Path == "" {
		cwd, _ := os.Getwd()
		cfg.Database.Path = filepath.Join(cwd, "data", "phy_beauty.db")
	}

	cfg.JWT.Secret = getEnv("JWT_SECRET", cfg.JWT.Secret)
	cfg.JWT.Expiration = getEnv("JWT_EXPIRATION", cfg.JWT.Expiration)

	cfg.AI.AudioDir = getEnv("AUDIO_DIR", cfg.AI.AudioDir)
	if v := getEnv("AI_REQUEST_TIMEOUT", ""); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.AI.RequestTimeout = n
		}
	}

	cfg.Admin.Username = getEnv("ADMIN_USERNAME", cfg.Admin.Username)
	cfg.Admin.Password = getEnv("ADMIN_PASSWORD", cfg.Admin.Password)
	cfg.Admin.Email = getEnv("ADMIN_EMAIL", cfg.Admin.Email)

	// 生产环境必须显式提供 JWT 密钥。
	if cfg.Server.Env == "production" && strings.Contains(cfg.JWT.Secret, "dev-secret") {
		cfg.JWT.Secret = getEnv("JWT_SECRET", "")
	}
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

// EnvOr 读取环境变量，未设置时返回默认值（供 main 等包使用）。
func EnvOr(key, defaultVal string) string {
	return getEnv(key, defaultVal)
}
