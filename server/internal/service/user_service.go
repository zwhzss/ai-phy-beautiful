package service

import (
	"errors"
	"time"

	"github.com/ai-phy-beautiful/server/internal/config"
	"github.com/ai-phy-beautiful/server/internal/model"
	"github.com/ai-phy-beautiful/server/internal/repository"
	"github.com/ai-phy-beautiful/server/pkg/jwt"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService struct {
	db            *gorm.DB
	jwtExpiration time.Duration
}

func NewUserService(cfg *config.Config) *UserService {
	expiration, _ := time.ParseDuration(cfg.JWT.Expiration)
	return &UserService{db: repository.GetDB(), jwtExpiration: expiration}
}

func (s *UserService) Register(username, email, password string) (*model.User, error) {
	var count int64
	s.db.Model(&model.User{}).Where("username = ? OR email = ?", username, email).Count(&count)
	if count > 0 {
		return nil, errors.New("用户名或邮箱已被注册，请更换后重试")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &model.User{
		Username:     username,
		Email:        email,
		PasswordHash: string(hash),
		Role:         "user",
	}
	if err := s.db.Create(user).Error; err != nil {
		return nil, err
	}
	return user, nil
}

func (s *UserService) Login(username, password string) (*model.User, string, error) {
	var user model.User
	if err := s.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, "", errors.New("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", errors.New("invalid credentials")
	}

	token, err := jwt.GenerateToken(user.ID, user.Username, user.Role, s.jwtExpiration)
	if err != nil {
		return nil, "", errors.New("failed to generate token")
	}
	return &user, token, nil
}

func (s *UserService) GetByID(id uint) (*model.User, error) {
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}
