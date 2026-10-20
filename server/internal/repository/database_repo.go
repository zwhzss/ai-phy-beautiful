package repository

import "gorm.io/gorm"

// DatabaseRepo provides raw database access for admin operations
type DatabaseRepo struct {
	db *gorm.DB
}

func NewDatabaseRepo() *DatabaseRepo {
	return &DatabaseRepo{db: GetDB()}
}

func (r *DatabaseRepo) DB() *gorm.DB {
	return r.db
}

// Delegate common GORM methods for convenience
func (r *DatabaseRepo) Where(query interface{}, args ...interface{}) *gorm.DB {
	return r.db.Where(query, args...)
}

func (r *DatabaseRepo) Model(value interface{}) *gorm.DB {
	return r.db.Model(value)
}

func (r *DatabaseRepo) Create(value interface{}) *gorm.DB {
	return r.db.Create(value)
}

func (r *DatabaseRepo) First(value interface{}, conds ...interface{}) *gorm.DB {
	return r.db.First(value, conds...)
}

func (r *DatabaseRepo) Find(value interface{}, conds ...interface{}) *gorm.DB {
	return r.db.Find(value, conds...)
}

func (r *DatabaseRepo) Delete(value interface{}, conds ...interface{}) *gorm.DB {
	return r.db.Delete(value, conds...)
}

func (r *DatabaseRepo) Save(value interface{}) *gorm.DB {
	return r.db.Save(value)
}

func (r *DatabaseRepo) Updates(value interface{}) *gorm.DB {
	return r.db.Updates(value)
}

func (r *DatabaseRepo) Preload(column string, args ...interface{}) *gorm.DB {
	return r.db.Preload(column, args...)
}
