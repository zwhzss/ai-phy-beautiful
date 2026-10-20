package service

import (
	"errors"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/internal/seed"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// InitDB 初始化数据库：自动迁移 + 实验目录种子数据 + 讲解稿件 + 管理员账号。
func InitDB(cfg *config.Config) error {
	if err := repository.InitDB(cfg); err != nil {
		return err
	}
	if err := SeedCatalog(); err != nil {
		return err
	}
	if err := SeedNarrations(); err != nil {
		return err
	}
	if err := SeedMilestoneNarrations(); err != nil {
		return err
	}
	if err := SeedContentBaseline(); err != nil {
		return err
	}
	return SeedAdmin(cfg)
}

// SeedMilestoneNarrations 幂等导入里程碑讲解（架构 §4.4：核心里程碑配双音色讲解）。
func SeedMilestoneNarrations() error {
	ms, lines, err := seed.ImportMilestoneNarrations(repository.GetDB(), true)
	if err != nil {
		return err
	}
	if ms > 0 {
		zap.L().Info("里程碑讲解种子数据已应用",
			zap.Int("milestones", ms),
			zap.Int("lines", lines),
		)
	}
	return nil
}

// SeedNarrations 幂等地把内置讲解稿件写入数据库。
//
// 已有讲解的实验会被跳过，因此不会覆盖用户或 AI 生成的内容；
// 新增稿件（如数学史里程碑定理）会在下次启动时自动补齐。
func SeedNarrations() error {
	exps, lines, err := seed.ImportNarrations(repository.GetDB(), true)
	if err != nil {
		return err
	}
	if exps > 0 {
		zap.L().Info("讲解稿件种子数据已应用",
			zap.Int("experiments", exps),
			zap.Int("lines", lines),
		)
	}
	return nil
}

// SeedCatalog 幂等地写入《架构设计.md》中的实验目录（375+ 个实验）。
func SeedCatalog() error {
	res, err := seed.ApplyWithTx(repository.GetDB())
	if err != nil {
		return err
	}
	zap.L().Info("实验目录种子数据已应用",
		zap.Int("categories", res.Categories),
		zap.Int("created", res.ExperimentsCreated),
		zap.Int("updated", res.ExperimentsUpdated),
		zap.Int("total", res.Total),
	)
	return nil
}

// SeedAdmin 在系统还没有任何管理员时创建默认管理员账号。
// 账号来自配置项 admin.username / admin.password（可用环境变量覆盖）。
func SeedAdmin(cfg *config.Config) error {
	db := repository.GetDB()
	var count int64
	if err := db.Model(&model.User{}).Where("role = ?", "admin").Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	username := cfg.Admin.Username
	if username == "" {
		username = "admin"
	}
	password := cfg.Admin.Password
	if password == "" {
		password = "admin123"
	}
	email := cfg.Admin.Email
	if email == "" {
		email = "admin@phy-beauty.local"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := &model.User{
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
		Role:         "admin",
	}
	if err := db.Create(user).Error; err != nil {
		// 用户名/邮箱已存在（例如同名普通用户）时，直接提升为管理员。
		var existing model.User
		if findErr := db.Where("username = ?", username).First(&existing).Error; findErr != nil {
			if errors.Is(findErr, gorm.ErrRecordNotFound) {
				return err
			}
			return findErr
		}
		existing.Role = "admin"
		existing.PasswordHash = string(hash)
		if saveErr := db.Save(&existing).Error; saveErr != nil {
			return saveErr
		}
		zap.L().Info("已提升既有账号为管理员", zap.String("username", username))
		return nil
	}

	zap.L().Info("默认管理员账号已创建",
		zap.String("username", username),
		zap.String("hint", "请登录后立即修改默认密码"),
	)
	return nil
}

// SeedContentBaseline 为所有实验导出「种子版」教学内容基线（幂等）。
//
// 这样 AI 生成的内容会作为独立版本存档，种子内容随时可以切回。
func SeedContentBaseline() error {
	svc := NewContentVersionService()
	created, err := svc.EnsureAllSeedVersions()
	if err != nil {
		return err
	}
	if created > 0 {
		zap.L().Info("内容版本基线已建立", zap.Int("experiments", created))
	}
	// 老库里的「空文稿」种子版存档要自愈：稿件是分批进种子文件的，
	// 早期启动快照下来的空存档必须补上，否则前端「文稿（种子版）」永远空白。
	fixed, err := svc.BackfillEmptySeedNarrations()
	if err != nil {
		return err
	}
	if fixed > 0 {
		zap.L().Info("种子版空文稿存档已回填", zap.Int("experiments", fixed))
	}
	return nil
}
