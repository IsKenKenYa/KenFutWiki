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

import httpRequest, { ContentType, RequestParams } from "./httpClient";
import {
  DomainKenFutContentMetadata,
  DomainPWResponse,
  GetApiKenfutV1ContentsNodeIdParams,
  PutApiKenfutV1ContentsNodeIdParams,
} from "./types";

/**
 * No description
 *
 * @tags kenfut_content
 * @name GetApiKenfutV1ContentsNodeId
 * @summary Get content metadata draft
 * @request GET:/api/kenfut/v1/contents/{node_id}
 * @secure
 * @response `200` `(DomainPWResponse & {
    data?: DomainKenFutContentMetadata,

})` OK
 */

export const getApiKenfutV1ContentsNodeId = (
  { nodeId, ...query }: GetApiKenfutV1ContentsNodeIdParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainKenFutContentMetadata;
    }
  >({
    path: `/api/kenfut/v1/contents/${nodeId}`,
    method: "GET",
    query: query,
    secure: true,
    ...params,
  });

/**
 * No description
 *
 * @tags kenfut_content
 * @name PutApiKenfutV1ContentsNodeId
 * @summary Update content metadata draft
 * @request PUT:/api/kenfut/v1/contents/{node_id}
 * @secure
 * @response `200` `(DomainPWResponse & {
    data?: DomainKenFutContentMetadata,

})` OK
 */

export const putApiKenfutV1ContentsNodeId = (
  { nodeId, ...query }: PutApiKenfutV1ContentsNodeIdParams,
  body: DomainKenFutContentMetadata,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: DomainKenFutContentMetadata;
    }
  >({
    path: `/api/kenfut/v1/contents/${nodeId}`,
    method: "PUT",
    query: query,
    body: body,
    secure: true,
    type: ContentType.Json,
    ...params,
  });
