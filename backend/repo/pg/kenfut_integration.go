package pg

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/chaitin/panda-wiki/domain"
	storePG "github.com/chaitin/panda-wiki/store/pg"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrKenFutEventConflict = errors.New("event id already used with a different payload")

type KenFutIntegrationRepository struct{ db *storePG.DB }

func NewKenFutIntegrationRepository(db *storePG.DB) *KenFutIntegrationRepository {
	return &KenFutIntegrationRepository{db: db}
}
func (r *KenFutIntegrationRepository) Products(ctx context.Context, kbID string) ([]domain.KenFutProduct, error) {
	items := []domain.KenFutProduct{}
	err := r.db.WithContext(ctx).Where("kb_id = ?", kbID).Order("created_at,id").Find(&items).Error
	return items, err
}
func (r *KenFutIntegrationRepository) Product(ctx context.Context, kbID, id string) (*domain.KenFutProduct, error) {
	var item domain.KenFutProduct
	err := r.db.WithContext(ctx).Where("id = ? AND kb_id = ?", id, kbID).First(&item).Error
	return &item, err
}
func (r *KenFutIntegrationRepository) SaveProduct(ctx context.Context, item *domain.KenFutProduct, create bool) error {
	if create {
		return r.db.WithContext(ctx).Create(item).Error
	}
	pages, err := json.Marshal(item.Pages)
	if err != nil {
		return err
	}
	result := r.db.WithContext(ctx).Model(&domain.KenFutProduct{}).Where("id = ? AND kb_id = ?", item.ID, item.KBID).Updates(map[string]any{"name": item.Name, "origin": item.Origin, "enabled": item.Enabled, "pages": string(pages), "updated_at": time.Now()})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
func (r *KenFutIntegrationRepository) Credentials(ctx context.Context, productID string) ([]domain.KenFutCredential, error) {
	items := []domain.KenFutCredential{}
	err := r.db.WithContext(ctx).Where("product_id = ?", productID).Order("created_at DESC").Find(&items).Error
	return items, err
}
func (r *KenFutIntegrationRepository) CreateCredential(ctx context.Context, item *domain.KenFutCredential) error {
	return r.db.WithContext(ctx).Create(item).Error
}
func (r *KenFutIntegrationRepository) Revoke(ctx context.Context, productID, id string) error {
	result := r.db.WithContext(ctx).Model(&domain.KenFutCredential{}).Where("product_id = ? AND id = ?", productID, id).Update("revoked_at", time.Now())
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
func (r *KenFutIntegrationRepository) Authenticate(ctx context.Context, hash string) (*domain.KenFutCredential, *domain.KenFutProduct, error) {
	var key domain.KenFutCredential
	if err := r.db.WithContext(ctx).Where("token_hash = ? AND revoked_at IS NULL", hash).First(&key).Error; err != nil {
		return nil, nil, err
	}
	var product domain.KenFutProduct
	if err := r.db.WithContext(ctx).Where("id = ? AND enabled = true", key.ProductID).First(&product).Error; err != nil {
		return nil, nil, err
	}
	return &key, &product, nil
}

// RecordEvent uses PostgreSQL uniqueness, so retries remain safe across processes.
func (r *KenFutIntegrationRepository) RecordEvent(ctx context.Context, event *domain.KenFutEvent, stat *domain.StatPage) (*domain.KenFutEvent, error) {
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(event)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			var prior domain.KenFutEvent
			if err := tx.Where("kb_id = ? AND product_id = ? AND event_id = ?", event.KBID, event.ProductID, event.EventID).First(&prior).Error; err != nil {
				return err
			}
			if prior.PayloadHash != event.PayloadHash {
				return ErrKenFutEventConflict
			}
			*event = prior
			return nil
		}
		if stat != nil {
			if err := tx.Create(stat).Error; err != nil {
				return err
			}
			if stat.Scene == domain.StatPageSceneNodeDetail && stat.NodeID != "" {
				return incrementKenFutPV(tx, stat.KBID, stat.NodeID)
			}
		}
		return nil
	})
	return event, err
}

func (r *KenFutIntegrationRepository) View(ctx context.Context, kbID, nodeID, viewID, sessionID string) error {
	var count int64
	if err := r.db.WithContext(ctx).Model(&domain.KenFutEvent{}).Where("kb_id = ? AND node_id = ? AND event_id = ? AND session_id = ? AND kind = 'article_view'", kbID, nodeID, viewID, sessionID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *KenFutIntegrationRepository) RecordConversion(ctx context.Context, event *domain.KenFutEvent, clickID string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Serialize a product's milestone updates. A first-generation callback may arrive first.
		var product domain.KenFutProduct
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", event.ProductID).First(&product).Error; err != nil {
			return err
		}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(event)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			var prior domain.KenFutEvent
			if err := tx.Where("kb_id = ? AND product_id = ? AND event_id = ?", event.KBID, event.ProductID, event.EventID).First(&prior).Error; err != nil {
				return err
			}
			if prior.PayloadHash != event.PayloadHash {
				return ErrKenFutEventConflict
			}
			return nil
		}
		attributed := ""
		if event.Kind == "registered" && clickID != "" {
			var initial domain.KenFutEvent
			err := tx.Where("kb_id = ? AND product_id = ? AND click_id = ? AND kind = 'cta_click'", event.KBID, event.ProductID, clickID).First(&initial).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			if err == nil {
				var latest domain.KenFutEvent
				err = tx.Where("product_id = ? AND session_id = ? AND kind = 'cta_click' AND occurred_at <= ? AND occurred_at >= ?", event.ProductID, initial.SessionID, event.OccurredAt, event.OccurredAt.Add(-30*24*time.Hour)).Order("occurred_at DESC,id DESC").First(&latest).Error
				if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				if err == nil && latest.ClickID != nil {
					attributed = *latest.ClickID
				}
			}
		}
		milestone := domain.KenFutMilestone{ProductID: event.ProductID, SubjectHash: event.SubjectHash, Kind: event.Kind, ClickID: attributed, OccurredAt: event.OccurredAt}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&milestone).Error
	})
}

func eventFilter(q *gorm.DB, req domain.KenFutFunnelReq, alias string) *gorm.DB {
	q = q.Where(alias+".kb_id = ? AND "+alias+".occurred_at >= ? AND "+alias+".occurred_at < ?", req.KBID, req.From, req.To)
	if req.ProductID != "" {
		q = q.Where(alias+".product_id = ?", req.ProductID)
	}
	if req.NodeID != "" {
		q = q.Where(alias+".node_id = ?", req.NodeID)
	}
	if req.CTAID != "" {
		q = q.Where(alias+".cta_id = ?", req.CTAID)
	}
	return q
}
func (r *KenFutIntegrationRepository) Funnel(ctx context.Context, req domain.KenFutFunnelReq) (*domain.KenFutFunnelResp, error) {
	response := &domain.KenFutFunnelResp{Items: []domain.KenFutFunnelItem{}}
	if err := r.populateFunnelConnection(ctx, req, response); err != nil {
		return nil, err
	}
	views := r.db.WithContext(ctx).Table("kenfut_events e").Where("e.kind='article_view'")
	// A product's view cohort consists of pages whose published CTA targets that product,
	// including visitors who did not click. Never use clicks as the view denominator.
	if req.ProductID != "" {
		views = views.Where("EXISTS (SELECT 1 FROM kenfut_content_releases cr, jsonb_array_elements(COALESCE(cr.metadata->'ctas','[]'::jsonb)) cta WHERE cr.node_release_id=e.node_release_id AND cta->'target'->>'product_id'=?)", req.ProductID)
	}
	if req.CTAID != "" {
		views = views.Where("EXISTS (SELECT 1 FROM kenfut_content_releases cr, jsonb_array_elements(COALESCE(cr.metadata->'ctas','[]'::jsonb)) cta WHERE cr.node_release_id=e.node_release_id AND cta->>'id'=?)", req.CTAID)
	}
	viewReq := req
	viewReq.ProductID = ""
	viewReq.CTAID = ""
	var v struct {
		Views   int64
		Viewers int64
	}
	if err := eventFilter(views, viewReq, "e").Select("COUNT(*) AS views,COUNT(DISTINCT e.session_id) AS viewers").Scan(&v).Error; err != nil {
		return nil, err
	}
	response.Views = v.Views
	response.Viewers = v.Viewers
	var c struct {
		Clicks   int64
		Clickers int64
	}
	clicks := eventFilter(r.db.WithContext(ctx).Table("kenfut_events e").Where("e.kind='cta_click'"), req, "e")
	if err := clicks.Select("COUNT(*) AS clicks,COUNT(DISTINCT e.session_id) AS clickers").Scan(&c).Error; err != nil {
		return nil, err
	}
	response.Clicks = c.Clicks
	response.Clickers = c.Clickers
	attributed := r.db.WithContext(ctx).Table("kenfut_milestones r").Joins("JOIN kenfut_events e ON e.click_id=r.click_id AND e.product_id=r.product_id").Where("r.kind='registered' AND r.occurred_at >= e.occurred_at AND r.occurred_at <= e.occurred_at + INTERVAL '30 days'")
	attributed = eventFilter(attributed, req, "e")
	if err := attributed.Count(&response.Registrations).Error; err != nil {
		return nil, err
	}
	if err := attributed.Session(&gorm.Session{}).Distinct("e.session_id").Count(&response.RegisteredVisitors).Error; err != nil {
		return nil, err
	}

	generated := attributed.Session(&gorm.Session{}).Joins("JOIN kenfut_milestones g ON g.product_id=r.product_id AND g.subject_hash=r.subject_hash AND g.kind='first_generation_success'").Where("g.occurred_at >= r.occurred_at AND g.occurred_at <= e.occurred_at + INTERVAL '30 days'")
	if err := generated.Count(&response.FirstGenerations).Error; err != nil {
		return nil, err
	}
	if err := generated.Session(&gorm.Session{}).Distinct("e.session_id").Count(&response.FirstGenerationVisitors).Error; err != nil {
		return nil, err
	}

	if err := r.populateUnattributedFunnel(ctx, req, response); err != nil {
		return nil, err
	}
	if err := populateFunnelItems(response, []*gorm.DB{eventFilter(views.Session(&gorm.Session{}), viewReq, "e"), clicks, attributed, generated}); err != nil {
		return nil, err
	}
	return response, nil
}

func (r *KenFutIntegrationRepository) populateFunnelConnection(ctx context.Context, req domain.KenFutFunnelReq, response *domain.KenFutFunnelResp) error {
	connected := r.db.WithContext(ctx).Table("kenfut_milestones m").Joins("JOIN kenfut_products p ON p.id=m.product_id").Where("p.kb_id=?", req.KBID)
	if req.ProductID != "" {
		connected = connected.Where("p.id=?", req.ProductID)
	}
	var status struct {
		Registration bool
		Generation   bool
	}
	if err := connected.Select("COALESCE(bool_or(m.kind='registered'),false) AS registration,COALESCE(bool_or(m.kind='first_generation_success'),false) AS generation").Scan(&status).Error; err != nil {
		return err
	}
	response.RegistrationConnected = status.Registration
	response.GenerationConnected = status.Generation
	response.ConversionConnected = status.Registration && status.Generation

	return nil
}
func (r *KenFutIntegrationRepository) populateUnattributedFunnel(ctx context.Context, req domain.KenFutFunnelReq, response *domain.KenFutFunnelResp) error {
	unassigned := r.db.WithContext(ctx).Table("kenfut_milestones m").Joins("JOIN kenfut_products p ON p.id=m.product_id").Where("p.kb_id=? AND m.occurred_at>=? AND m.occurred_at<?", req.KBID, req.From, req.To)
	if req.ProductID != "" {
		unassigned = unassigned.Where("m.product_id=?", req.ProductID)
	}
	if req.NodeID == "" && req.CTAID == "" {
		if err := unassigned.Session(&gorm.Session{}).Where("m.kind='registered' AND m.click_id='' ").Count(&response.UnattributedRegistrations).Error; err != nil {
			return err
		}
		if err := unassigned.Session(&gorm.Session{}).Where("m.kind='first_generation_success' AND NOT EXISTS (SELECT 1 FROM kenfut_milestones r WHERE r.product_id=m.product_id AND r.subject_hash=m.subject_hash AND r.kind='registered' AND r.click_id<>'')").Count(&response.UnattributedFirstGenerations).Error; err != nil {
			return err
		}
	}
	return nil
}
func populateFunnelItems(response *domain.KenFutFunnelResp, queries []*gorm.DB) error {
	groups := map[string]*domain.KenFutFunnelItem{}
	for index, q := range queries {
		var rows []struct {
			NodeID string
			Count  int64
		}
		if err := q.Session(&gorm.Session{}).Select("e.node_id,COUNT(*) AS count").Group("e.node_id").Scan(&rows).Error; err != nil {
			return err
		}
		for _, row := range rows {
			if groups[row.NodeID] == nil {
				groups[row.NodeID] = &domain.KenFutFunnelItem{NodeID: row.NodeID}
			}
			item := groups[row.NodeID]
			switch index {
			case 0:
				item.Views = row.Count
			case 1:
				item.Clicks = row.Count
			case 2:
				item.Registrations = row.Count
			case 3:
				item.FirstGenerations = row.Count
			}
		}
	}
	for _, item := range groups {
		response.Items = append(response.Items, *item)
	}
	sort.Slice(response.Items, func(i, j int) bool {
		if response.Items[i].Views != response.Items[j].Views {
			return response.Items[i].Views > response.Items[j].Views
		}
		return response.Items[i].NodeID < response.Items[j].NodeID
	})

	return nil
}

func (r *KenFutIntegrationRepository) GetPrompt(ctx context.Context, kbID string) (*domain.Prompt, error) {
	var setting domain.Setting
	err := r.db.WithContext(ctx).Where("kb_id = ? AND key = ?", kbID, domain.SettingKeySystemPrompt).First(&setting).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &domain.Prompt{}, nil
	}
	if err != nil {
		return nil, err
	}
	var prompt domain.Prompt
	err = json.Unmarshal(setting.Value, &prompt)
	return &prompt, err
}
func (r *KenFutIntegrationRepository) SavePrompt(ctx context.Context, kbID string, prompt domain.Prompt) error {
	data, err := json.Marshal(prompt)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var kb domain.KnowledgeBase
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Select("id").Where("id = ?", kbID).First(&kb).Error; err != nil {
			return err
		}
		var setting domain.Setting
		err := tx.Where("kb_id = ? AND key = ?", kbID, domain.SettingKeySystemPrompt).First(&setting).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return tx.Create(&domain.Setting{KBID: kbID, Key: domain.SettingKeySystemPrompt, Value: data, CreatedAt: time.Now(), UpdatedAt: time.Now()}).Error
		}
		if err != nil {
			return err
		}
		return tx.Model(&setting).Updates(map[string]any{"value": string(data), "updated_at": time.Now()}).Error
	})
}
func (r *KenFutIntegrationRepository) Moderate(ctx context.Context, kbID, id string, status int) error {
	result := r.db.WithContext(ctx).Model(&domain.Comment{}).Where("kb_id = ? AND id = ?", kbID, id).Update("status", status)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *KenFutIntegrationRepository) PurgeEvents(ctx context.Context, before time.Time) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtext('kenfut-event-retention'))").Error; err != nil {
			return err
		}
		// Preserve daily event totals before removing old detail. Business milestones
		// remain separately deduplicated; event counts are never labelled accounts.
		if err := tx.Exec(`INSERT INTO kenfut_daily_event_totals(day,kb_id,product_id,node_id,cta_id,kind,records)
 SELECT (occurred_at AT TIME ZONE 'UTC')::date,kb_id,product_id,node_id,cta_id,kind,COUNT(*)
 FROM kenfut_events WHERE received_at < ? AND occurred_at < ?
 GROUP BY 1,2,3,4,5,6
 ON CONFLICT(day,kb_id,product_id,node_id,cta_id,kind)
 DO UPDATE SET records=kenfut_daily_event_totals.records+EXCLUDED.records`, before, before).Error; err != nil {
			return err
		}
		return tx.Where("received_at < ? AND occurred_at < ?", before, before).Delete(&domain.KenFutEvent{}).Error
	})
}

func (r *KenFutIntegrationRepository) CheckProduct(ctx context.Context, kbID, id string) error {
	_, err := r.Product(ctx, kbID, id)
	if err != nil {
		return fmt.Errorf("product is not available: %w", err)
	}
	return nil
}
