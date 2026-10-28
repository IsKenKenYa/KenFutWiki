/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import httpRequest, { RequestParams } from "./httpClient";
import {
  DomainKenFutContentItem,
  DomainKenFutContentListResp,
  DomainKenFutTaxonomies,
  DomainPWResponse,
  GetShareKenfutV1ArticlesSlugParams,
  GetShareKenfutV1ContentsNodeIdParams,
  GetShareKenfutV1ContentsNodeIdRelatedParams,
  GetShareKenfutV1ContentsParams,
} from "./types";

/**
 * No description
 *
 * @tags kenfut_content
 * @name GetShareKenfutV1ArticlesSlug
 * @summary Published article detail
 * @request GET:/share/kenfut/v1/articles/{slug}
 * @response `200` `(DomainPWResponse & {
    data?: DomainKenFutContentItem,

})` OK
 */

export const getShareKenfutV1ArticlesSlug = (
  { slug, ...query }: GetShareKenfutV1ArticlesSlugParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainKenFutContentItem;
    }
  >({
    path: `/share/kenfut/v1/articles/${slug}`,
    method: "GET",
    ...params,
  });

/**
 * No description
 *
 * @tags kenfut_content
 * @name GetShareKenfutV1Contents
 * @summary Query published content
 * @request GET:/share/kenfut/v1/contents
 * @response `200` `(DomainPWResponse & {
    data?: DomainKenFutContentListResp,

})` OK
 */

export const getShareKenfutV1Contents = (
  query: GetShareKenfutV1ContentsParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainKenFutContentListResp;
    }
  >({
    path: `/share/kenfut/v1/contents`,
    method: "GET",
    query: query,
    ...params,
  });

/**
 * No description
 *
 * @tags kenfut_content
 * @name GetShareKenfutV1ContentsNodeId
 * @summary Published content detail
 * @request GET:/share/kenfut/v1/contents/{node_id}
 * @response `200` `(DomainPWResponse & {
    data?: DomainKenFutContentItem,

})` OK
 */

export const getShareKenfutV1ContentsNodeId = (
  { nodeId, ...query }: GetShareKenfutV1ContentsNodeIdParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainKenFutContentItem;
    }
  >({
    path: `/share/kenfut/v1/contents/${nodeId}`,
    method: "GET",
    ...params,
  });

/**
 * No description
 *
 * @tags kenfut_content
 * @name GetShareKenfutV1ContentsNodeIdRelated
 * @summary Related published pages
 * @request GET:/share/kenfut/v1/contents/{node_id}/related
 * @response `200` `(DomainPWResponse & {
    data?: (DomainKenFutContentItem)[],

})` OK
 */

export const getShareKenfutV1ContentsNodeIdRelated = (
  { nodeId, ...query }: GetShareKenfutV1ContentsNodeIdRelatedParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainKenFutContentItem[];
    }
  >({
    path: `/share/kenfut/v1/contents/${nodeId}/related`,
    method: "GET",
    ...params,
  });

/**
 * No description
 *
 * @tags kenfut_content
 * @name GetShareKenfutV1Pages
 * @summary Published page catalog
 * @request GET:/share/kenfut/v1/pages
 * @response `200` `DomainPWResponse` OK
 */

export const getShareKenfutV1Pages = (params: RequestParams = {}) =>
  httpRequest<DomainPWResponse>({
    path: `/share/kenfut/v1/pages`,
    method: "GET",
    ...params,
  });

/**
 * No description
 *
 * @tags kenfut_content
 * @name GetShareKenfutV1Taxonomies
 * @summary Published categories and tags
 * @request GET:/share/kenfut/v1/taxonomies
 * @response `200` `(DomainPWResponse & {
    data?: DomainKenFutTaxonomies,

})` OK
 */

export const getShareKenfutV1Taxonomies = (params: RequestParams = {}) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainKenFutTaxonomies;
    }
  >({
    path: `/share/kenfut/v1/taxonomies`,
    method: "GET",
    ...params,
  });
