package share

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"

	"github.com/chaitin/panda-wiki/domain"
	"github.com/chaitin/panda-wiki/handler"
	"github.com/chaitin/panda-wiki/usecase"
)

type ShareKenFutContentHandler struct {
	usecase     *usecase.KenFutContentUsecase
	integration *usecase.KenFutIntegrationUsecase
}

func NewShareKenFutContentHandler(e *echo.Echo, base *handler.BaseHandler, u *usecase.KenFutContentUsecase, integration *usecase.KenFutIntegrationUsecase) *ShareKenFutContentHandler {
	h := &ShareKenFutContentHandler{usecase: u, integration: integration}
	group := e.Group("/share/kenfut/v1", base.ShareAuthMiddleware.Authorize)
	group.GET("/contents", h.List)
	group.GET("/contents/:node_id", h.Detail)
	group.GET("/articles/:slug", h.Article)
	group.GET("/contents/:node_id/related", h.Related)
	group.GET("/pages", h.Pages)
	group.GET("/taxonomies", h.Taxonomies)
	return h
}

func contentPublicReply(c echo.Context, data any, err error) error {
	if err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		} else {
			c.Logger().Error(err)
		}
		return c.JSON(status, domain.PWResponse{Success: false, Message: "content unavailable"})
	}
	return c.JSON(http.StatusOK, domain.PWResponse{Success: true, Data: data})
}

// List queries the current published manifest, never draft content.
//
//	@Summary	Query published content
//	@Tags		kenfut_content
//	@Param		X-KB-ID		header		string	true	"Knowledge base"
//	@Param		q			query		string	false	"Keywords"
//	@Param		channel		query		string	false	"all, docs, article"
//	@Param		category	query		string	false	"Category"
//	@Param		tag			query		string	false	"Tag"
//	@Param		featured	query		boolean	false	"Featured only"
//	@Param		page		query		int		false	"Page"
//	@Param		page_size	query		int		false	"Page size, maximum 100"
//	@Success	200			{object}	domain.PWResponse{data=domain.KenFutContentListResp}
//	@Router		/share/kenfut/v1/contents [get]
func (h *ShareKenFutContentHandler) List(c echo.Context) error {
	var req domain.KenFutContentListReq
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, domain.PWResponse{Message: "invalid query"})
	}
	req.KBID = c.Request().Header.Get("X-KB-ID")
	if req.KBID == "" {
		return c.JSON(http.StatusBadRequest, domain.PWResponse{Message: "knowledge base is required"})
	}
	if (req.Channel != "" && req.Channel != "all" && req.Channel != "docs" && req.Channel != "article") || len([]rune(req.Query)) > 200 {
		return c.JSON(http.StatusBadRequest, domain.PWResponse{Message: "invalid content query"})
	}
	result, err := h.usecase.List(c.Request().Context(), req, domain.GetAuthID(c))
	if err == nil {
		for i := range result.Items {
			if err = h.integration.ProjectCTAs(c.Request().Context(), &result.Items[i], domain.GetAuthID(c)); err != nil {
				break
			}
		}
	}
	return contentPublicReply(c, result, err)
}

// Detail returns an authorized published content snapshot.
//
//	@Summary	Published content detail
//	@Tags		kenfut_content
//	@Param		X-KB-ID	header		string	true	"Knowledge base"
//	@Param		node_id	path		string	true	"Node ID"
//	@Success	200		{object}	domain.PWResponse{data=domain.KenFutContentItem}
//	@Router		/share/kenfut/v1/contents/{node_id} [get]
func (h *ShareKenFutContentHandler) Detail(c echo.Context) error {
	result, err := h.usecase.Detail(c.Request().Context(), c.Request().Header.Get("X-KB-ID"), c.Param("node_id"), domain.GetAuthID(c))
	if err == nil {
		err = h.integration.ProjectCTAs(c.Request().Context(), result, domain.GetAuthID(c))
	}
	return contentPublicReply(c, result, err)
}

// Article resolves a current or historic article slug through the active manifest.
//
//	@Summary	Published article detail
//	@Tags		kenfut_content
//	@Param		X-KB-ID	header		string	true	"Knowledge base"
//	@Param		slug	path		string	true	"Article slug"
//	@Success	200		{object}	domain.PWResponse{data=domain.KenFutContentItem}
//	@Router		/share/kenfut/v1/articles/{slug} [get]
func (h *ShareKenFutContentHandler) Article(c echo.Context) error {
	result, err := h.usecase.Article(c.Request().Context(), c.Request().Header.Get("X-KB-ID"), c.Param("slug"), domain.GetAuthID(c))
	if err == nil {
		err = h.integration.ProjectCTAs(c.Request().Context(), result, domain.GetAuthID(c))
	}
	return contentPublicReply(c, result, err)
}

// Related returns at most two permitted current published pages.
//
//	@Summary	Related published pages
//	@Tags		kenfut_content
//	@Param		X-KB-ID	header		string	true	"Knowledge base"
//	@Param		node_id	path		string	true	"Node ID"
//	@Success	200		{object}	domain.PWResponse{data=[]domain.KenFutContentItem}
//	@Router		/share/kenfut/v1/contents/{node_id}/related [get]
func (h *ShareKenFutContentHandler) Related(c echo.Context) error {
	result, err := h.usecase.Related(c.Request().Context(), c.Request().Header.Get("X-KB-ID"), c.Param("node_id"), domain.GetAuthID(c))
	if err == nil {
		for i := range result {
			if err = h.integration.ProjectCTAs(c.Request().Context(), &result[i], domain.GetAuthID(c)); err != nil {
				break
			}
		}
	}
	return contentPublicReply(c, result, err)
}

// Pages lists permitted pages for the shared page picker.
//
//	@Summary	Published page catalog
//	@Tags		kenfut_content
//	@Param		X-KB-ID	header		string	true	"Knowledge base"
//	@Success	200		{object}	domain.PWResponse
//	@Router		/share/kenfut/v1/pages [get]
func (h *ShareKenFutContentHandler) Pages(c echo.Context) error {
	result, err := h.usecase.Pages(c.Request().Context(), c.Request().Header.Get("X-KB-ID"), domain.GetAuthID(c))
	if err != nil {
		return contentPublicReply(c, nil, err)
	}
	products, err := h.integration.Products(c.Request().Context(), c.Request().Header.Get("X-KB-ID"))
	if err != nil {
		return contentPublicReply(c, nil, err)
	}
	for _, product := range products {
		if !product.Enabled {
			continue
		}
		for _, page := range product.Pages {
			target := domain.KenFutLinkTarget{Type: "product", ProductID: product.ID, PageKey: page.Key}
			address, targetErr := h.integration.ResolveTarget(c.Request().Context(), product.KBID, target, "", domain.GetAuthID(c))
			if targetErr != nil {
				return contentPublicReply(c, nil, targetErr)
			}
			result = append(result, domain.KenFutPage{ID: product.ID + ":" + page.Key, Title: product.Name + " / " + page.Name, URL: address, Type: "product", Target: target})
		}
	}
	return contentPublicReply(c, map[string]any{"items": result}, err)
}

// Taxonomies aggregates only permitted published category/tag assignments.
//
//	@Summary	Published categories and tags
//	@Tags		kenfut_content
//	@Param		X-KB-ID	header		string	true	"Knowledge base"
//	@Success	200		{object}	domain.PWResponse{data=domain.KenFutTaxonomies}
//	@Router		/share/kenfut/v1/taxonomies [get]
func (h *ShareKenFutContentHandler) Taxonomies(c echo.Context) error {
	result, err := h.usecase.Taxonomies(c.Request().Context(), c.Request().Header.Get("X-KB-ID"), domain.GetAuthID(c))
	return contentPublicReply(c, result, err)
}
